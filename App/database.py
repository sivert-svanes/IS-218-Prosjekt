import os
import math
import sqlalchemy
from sqlalchemy import text
from sqlalchemy.pool import QueuePool
from dotenv import load_dotenv

load_dotenv()
CONN_STR = os.getenv("DATABASE_URL")

# Constants for Web Mercator conversion (EPSG:3857)
_MERCATOR_HALF = 20037508.34
_PI_HALF = math.pi / 2

def web_mercator_to_wgs84(x: float, y: float) -> tuple:
    """Convert Web Mercator (EPSG:3857) to WGS84 (EPSG:4326).
    Pre-compute constants to avoid repeated calculations."""
    lng = (x / _MERCATOR_HALF) * 180
    lat = math.degrees(2 * math.atan(math.exp(y / _MERCATOR_HALF)) - _PI_HALF)
    return (lng, lat)

# Create a single shared engine with limited pool size for Supabase
# Supabase in session mode has strict connection limits
_engine = None

def create_engine():
    global _engine
    if _engine is None:
        if not CONN_STR:
            raise ValueError("DATABASE_URL mangler i .env / environment.")
        # Minimal pool configuration for Supabase session mode
        _engine = sqlalchemy.create_engine(
            CONN_STR,
            future=True,
            poolclass=QueuePool,
            pool_size=1,
            max_overflow=0,
            pool_recycle=1800,  # Recycle connections after 30 min
            pool_pre_ping=True,  # Test connections before using
            connect_args={
                "connect_timeout": 10,
                "keepalives": 1,
                "keepalives_idle": 30,
            }
        )
    return _engine


def database_test_query(engine):
    with engine.connect() as conn:
        result = conn.execute(text("SELECT * FROM pg_catalog.pg_tables;"))
        print(result.all())


def get_brannstasjoner(engine):
    with engine.connect() as conn:
        result = conn.execute(text("""
            SELECT json_build_object(
                'type', 'FeatureCollection',
                'features', COALESCE(json_agg(
                    json_build_object(
                        'type', 'Feature',
                        'geometry', ST_AsGeoJSON(geom)::json,
                        'properties', to_jsonb(t.*) - 'geom'
                    )
                ), '[]'::json)
            ) AS geojson
            FROM (
                SELECT *
                FROM public.brannstasjoner
                LIMIT 1000
            ) t;
        """))
        row = result.fetchone()
        return row[0] if row else {"type": "FeatureCollection", "features": []}

def get_fylke_bbox_3857(engine, fylke_id):
    """Return (minx, miny, maxx, maxy) in EPSG:3857 for a county."""
    with engine.connect() as conn:
        row = conn.execute(text("""
            SELECT ST_XMin(b), ST_YMin(b), ST_XMax(b), ST_YMax(b)
            FROM (SELECT ST_Envelope(ST_Transform(geomfylke, 3857)) AS b
                  FROM public.fylker WHERE id = :id) t
        """), {"id": fylke_id}).fetchone()
        return tuple(row) if row else None


def get_shelters_within_fylke(engine, fylke_id):
    with engine.connect() as conn:
        result = conn.execute(text("""
            SELECT json_build_object(
                'type', 'FeatureCollection',
                'fylke_navn', (SELECT navn FROM public.fylker WHERE id = :fylke_id),
                'features', COALESCE(json_agg(
                    json_build_object(
                        'type', 'Feature',
                        'geometry', ST_AsGeoJSON(posisjon)::json,
                        'properties', to_jsonb(t.*) - 'geom'
                    )
                ), '[]'::json)
            ) AS geojson
            FROM (
                SELECT *
                FROM public.shelters b
                WHERE ST_Within(
                    b.posisjon,
                    (SELECT geomfylke FROM public.fylker WHERE id = :fylke_id)
                )) t;
        """), {"fylke_id": fylke_id})
        row = result.fetchone()
        return row[0] if row else {"type": "FeatureCollection", "features": []}


def get_nvdb_segments_in_bbox(engine, min_x, min_y, max_x, max_y, exclude_flooded=True):
    """Query pre-loaded NVDB segments from PostGIS.
    Input bounds are in EPSG:3857 (Web Mercator).
    Data is stored as geometry in geom_4326 column (EPSG:4326 WGS84).
    """
    min_lng, min_lat = web_mercator_to_wgs84(min_x, min_y)
    max_lng, max_lat = web_mercator_to_wgs84(max_x, max_y)

    with engine.connect() as conn:
        result = conn.execute(text("""
            SELECT geom_4326, "net.typeveg"
            FROM public.nvdb_roads
            WHERE ST_Intersects(
                geom_4326,
                ST_MakeEnvelope(:minx, :miny, :maxx, :maxy, 4326)
            );
        """), {"minx": min_lng, "miny": min_lat, "maxx": max_lng, "maxy": max_lat})
        return result.fetchall()


def get_nvdb_as_geojson(engine, min_x, min_y, max_x, max_y):
    """Get NVDB segments as GeoJSON from PostGIS.
    Input bounds are in EPSG:3857 (Web Mercator).
    Data is stored as geometry in geom_4326 column (EPSG:4326 WGS84).
    Returns GeoJSON in EPSG:4326 (WGS84) - no transformation needed.
    Converts to 2D (removes Z coordinates) for compatibility with MapLibre.
    """
    min_lng, min_lat = web_mercator_to_wgs84(min_x, min_y)
    max_lng, max_lat = web_mercator_to_wgs84(max_x, max_y)

    with engine.connect() as conn:
        result = conn.execute(text("""
            SELECT json_build_object(
                'type', 'FeatureCollection',
                'features', COALESCE(json_agg(
                    json_build_object(
                        'type', 'Feature',
                        'geometry', ST_AsGeoJSON(ST_Force2D(geom_4326))::json,
                        'properties', json_build_object(
                            'typeVeg', "net.typeveg"
                        )
                    )
                ), '[]'::json)
            ) AS geojson
            FROM public.nvdb_roads
            WHERE ST_Intersects(
                geom_4326,
                ST_MakeEnvelope(:minx, :miny, :maxx, :maxy, 4326)
            );
        """), {"minx": min_lng, "miny": min_lat, "maxx": max_lng, "maxy": max_lat})
        row = result.fetchone()
        return row[0] if row else {"type": "FeatureCollection", "features": []}
