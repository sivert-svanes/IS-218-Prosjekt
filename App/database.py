import os
import sqlalchemy
from sqlalchemy import text
from dotenv import load_dotenv

load_dotenv()
CONN_STR = os.getenv("DATABASE_URL")

# Create a single shared engine with limited pool size for Supabase
# Supabase in session mode has strict connection limits
_engine = None

def create_engine():
    global _engine
    if _engine is None:
        if not CONN_STR:
            raise ValueError("DATABASE_URL mangler i .env / environment.")
        # pool_size=2, max_overflow=1 limits concurrent connections
        # Supabase session mode has strict limits
        _engine = sqlalchemy.create_engine(
            CONN_STR,
            future=True,
            pool_size=2,
            max_overflow=1,
            pool_recycle=3600,  # Recycle connections after 1 hour
            pool_pre_ping=True  # Test connections before using
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
    Data is stored as WKT text in geo.wkt column (EPSG:32633 UTM33).
    """
    def web_mercator_to_wgs84(x: float, y: float) -> tuple:
        import math
        lng = (x / 20037508.34) * 180
        lat = math.degrees(2 * math.atan(math.exp(y / 20037508.34)) - math.pi / 2)
        return (lng, lat)

    min_lng, min_lat = web_mercator_to_wgs84(min_x, min_y)
    max_lng, max_lat = web_mercator_to_wgs84(max_x, max_y)

    with engine.connect() as conn:
        result = conn.execute(text("""
            SELECT "geo.wkt", "net.typeveg"
            FROM public.nvdb_roads
            WHERE ST_Intersects(
                ST_SetSRID(ST_GeomFromText("geo.wkt"), 32633),
                ST_Transform(ST_MakeEnvelope(:minx, :miny, :maxx, :maxy, 4326), 32633)
            );
        """), {"minx": min_lng, "miny": min_lat, "maxx": max_lng, "maxy": max_lat})
        return result.fetchall()


def get_nvdb_as_geojson(engine, min_x, min_y, max_x, max_y):
    """Get NVDB segments as GeoJSON from PostGIS.
    Input bounds are in EPSG:3857 (Web Mercator).
    Data is stored as geometry in geom column (EPSG:32633 UTM33).
    Returns GeoJSON in EPSG:4326 (WGS84).
    """
    # Convert Web Mercator bounds to WGS84
    def web_mercator_to_wgs84(x: float, y: float) -> tuple:
        import math
        lng = (x / 20037508.34) * 180
        lat = math.degrees(2 * math.atan(math.exp(y / 20037508.34)) - math.pi / 2)
        return (lng, lat)

    # Convert bounds
    min_lng, min_lat = web_mercator_to_wgs84(min_x, min_y)
    max_lng, max_lat = web_mercator_to_wgs84(max_x, max_y)

    with engine.connect() as conn:
        result = conn.execute(text("""
            SELECT json_build_object(
                'type', 'FeatureCollection',
                'features', COALESCE(json_agg(
                    json_build_object(
                        'type', 'Feature',
                        'geometry', ST_AsGeoJSON(ST_Transform(geom, 4326))::json,
                        'properties', json_build_object(
                            'typeVeg', "net.typeveg"
                        )
                    )
                ), '[]'::json)
            ) AS geojson
            FROM public.nvdb_roads
            WHERE ST_Intersects(
                geom,
                ST_Transform(ST_MakeEnvelope(:minx, :miny, :maxx, :maxy, 4326), 32633)
            );
        """), {"minx": min_lng, "miny": min_lat, "maxx": max_lng, "maxy": max_lat})
        row = result.fetchone()
        return row[0] if row else {"type": "FeatureCollection", "features": []}
