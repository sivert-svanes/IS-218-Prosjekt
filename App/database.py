import os
import math
import sqlalchemy
from sqlalchemy import text
from sqlalchemy.pool import QueuePool
from dotenv import load_dotenv
from enum import Enum

load_dotenv()
CONN_STR = os.getenv("DATABASE_URL")

# Constants for Web Mercator conversion (EPSG:3857)
_MERCATOR_HALF = 20037508.34
_PI_HALF = math.pi / 2

class RoadType(Enum):
    BILFERJE          = "Bilferje"
    ENKEL_BILVEG      = "Enkel bilveg"
    FORTAU            = "Fortau"
    GÅGATE            = "Gågate"
    GANG_OG_SYKKELVEG = "Gang- og sykkelveg"
    GANGFELT          = "Gangfelt"
    GANGVEG           = "Gangveg"
    GATETUN           = "Gatetun"
    KANALISERT_VEG    = "Kanalisert veg"
    PASSASJERFERJE    = "Passasjerferje"
    RAMPE             = "Rampe"
    RUNDKJØRING       = "Rundkjøring"
    STI               = "Sti"
    SYKKELVEG         = "Sykkelveg"
    TRAKTORVEG        = "Traktorveg"
    TRAPP             = "Trapp"


def web_mercator_to_wgs84(x: float, y: float) -> tuple:
    """Convert Web Mercator (EPSG:3857) to WGS84 (EPSG:4326).
    Pre-compute constants to avoid repeated calculations."""
    lng = (x / _MERCATOR_HALF) * 180
    lat = math.degrees(2 * math.atan(math.exp(y / _MERCATOR_HALF)) - _PI_HALF)
    return (lng, lat)

# Create a single shared engine with limited pool size for Supabase
_engine = None

def create_engine():
    global _engine
    if _engine is None:
        if not CONN_STR:
            raise ValueError("DATABASE_URL mangler i .env / environment.")
        # Pool configuration for Supabase session mode
        _engine = sqlalchemy.create_engine(
            CONN_STR,
            future=True,
            poolclass=QueuePool,
            pool_size=5,
            max_overflow=5,
            pool_recycle=1800,  # Recycle connections after 30 min
            pool_pre_ping=True,  # Test connections before using
            pool_timeout=10,  # Wait up to 10 seconds for a connection
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


def get_nvdb_segments_in_bbox(engine, min_x, min_y, max_x, max_y, road_types=None):
    """Query pre-loaded NVDB segments from PostGIS.
    Input bounds are in EPSG:3857 (Web Mercator).
    Data is stored as geometry in geom_4326 column (EPSG:4326 WGS84).

    Args:
        engine: SQLAlchemy engine
        min_x, min_y, max_x, max_y: Bounding box in EPSG:3857
        road_types: Optional list/set of road type values to filter by (net.typeveg).
                   If None, all road types are returned.
    """
    min_lng, min_lat = web_mercator_to_wgs84(min_x, min_y)
    max_lng, max_lat = web_mercator_to_wgs84(max_x, max_y)

    with engine.connect() as conn:
        query = """
            SELECT geom_4326, "net.typeveg"
            FROM public.nvdb_roads
            WHERE ST_Intersects(
                geom_4326,
                ST_MakeEnvelope(:minx, :miny, :maxx, :maxy, 4326)
            )
        """
        params = {"minx": min_lng, "miny": min_lat, "maxx": max_lng, "maxy": max_lat}

        if road_types:
            query += ' AND "net.typeveg" = ANY(:road_types)'
            params["road_types"] = list(road_types)

        query += ";"
        result = conn.execute(text(query), params)
        return result.fetchall()


def get_nvdb_as_geojson(engine, min_x, min_y, max_x, max_y, road_types=None):
    """Get NVDB segments as GeoJSON from PostGIS.
    Input bounds are in EPSG:3857 (Web Mercator).
    Data is stored as geometry in geom_4326 column (EPSG:4326 WGS84).
    Returns GeoJSON in EPSG:4326 (WGS84).
    Strips Z coordinates for compatibility with MapLibre.

    Args:
        engine: SQLAlchemy engine
        min_x, min_y, max_x, max_y: Bounding box in EPSG:3857
        road_types: Optional list/set of road type values to filter by (net.typeveg).
                   If None, all road types are returned.
    """
    min_lng, min_lat = web_mercator_to_wgs84(min_x, min_y)
    max_lng, max_lat = web_mercator_to_wgs84(max_x, max_y)

    with engine.connect() as conn:
        query = """
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
            )
        """
        params = {"minx": min_lng, "miny": min_lat, "maxx": max_lng, "maxy": max_lat}

        if road_types:
            query += ' AND "net.typeveg" = ANY(:road_types)'
            params["road_types"] = list(road_types)

        query += ";"
        result = conn.execute(text(query), params)
        row = result.fetchone()
        return row[0] if row else {"type": "FeatureCollection", "features": []}


def get_nearest_shelter(engine, lat: float, lng: float):
    """Get the nearest shelter to given coordinates.

    Args:
        engine: SQLAlchemy engine
        lat, lng: Coordinates in WGS84 (EPSG:4326)

    Returns:
        Tuple of (shelter_id, shelter_lat, shelter_lng, distance_km) or None
    """
    with engine.connect() as conn:
        row = conn.execute(text("""
            SELECT fid, ST_Y(posisjon), ST_X(posisjon), ST_Distance(posisjon, ST_SetSRID(ST_Point(:lng, :lat), 4326)) / 1000 as dist_km
            FROM public.shelters
            ORDER BY posisjon <-> ST_SetSRID(ST_Point(:lng, :lat), 4326)
            LIMIT 1;
        """), {"lat": lat, "lng": lng}).fetchone()
        if row:
            print(f"[DB] Found nearest shelter: {row}")
        else:
            print(f"[DB] No shelter found for coordinates ({lat}, {lng})")
        return row if row else None
