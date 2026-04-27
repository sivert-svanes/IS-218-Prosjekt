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
        result = conn.execute(text("SELECT get_brannstasjoner();"))
        row = result.fetchone()
        return row[0] if row else {"type": "FeatureCollection", "features": []}

def get_fylke_bbox_3857(engine, fylke_id):
    """Return (minx, miny, maxx, maxy) in EPSG:3857 for a county."""
    with engine.connect() as conn:
        row = conn.execute(text("""
            SELECT * FROM get_fylke_bbox_3857(:fylke_id);
        """), {"fylke_id": fylke_id}).fetchone()
        return tuple(row) if row else None

def get_shelters_within_fylke(engine, fylke_id):
    with engine.connect() as conn:
        result = conn.execute(text("""
            SELECT get_shelters_within_fylke(:fylke_id);
        """), {"fylke_id": fylke_id})
        row = result.fetchone()
        return row[0] if row else {"type": "FeatureCollection", "features": []}

def get_nvdb_as_geojson(engine, min_x, min_y, max_x, max_y, road_types=None):
    min_lng, min_lat = web_mercator_to_wgs84(min_x, min_y)
    max_lng, max_lat = web_mercator_to_wgs84(max_x, max_y)

    with engine.connect() as conn:
        road_types_array = list(road_types) if road_types else None
        result = conn.execute(text("""
            SELECT get_nvdb_roads_geojson(:min_lng, :min_lat, :max_lng, :max_lat, :road_types);
        """), {
            "min_lng": min_lng,
            "min_lat": min_lat,
            "max_lng": max_lng,
            "max_lat": max_lat,
            "road_types": road_types_array
        })
        row = result.fetchone()
        return row[0] if row else {"type": "FeatureCollection", "features": []}


def get_k_nearest_shelters(engine, lat: float, lng: float, k: int = 10):
    with engine.connect() as conn:
        result = conn.execute(text("""
            SELECT get_k_nearest_shelters(:lat, :lng, :k);
        """), {"lat": lat, "lng": lng, "k": k})
        row = result.fetchone()
        return row[0] if row else {"type": "FeatureCollection", "features": []}


def _parse_wkt_polygon(wkt: str) -> list:
    """Parse WKT POLYGON string to GeoJSON coordinates."""
    wkt = wkt.strip()
    if wkt.startswith('POLYGON'):
        wkt = wkt[7:].strip()
    if wkt.startswith('('):
        wkt = wkt[1:]
    if wkt.endswith(')'):
        wkt = wkt[:-1]

    rings = []
    depth = 0
    current_ring = ""

    for char in wkt:
        if char == '(':
            depth += 1
            if depth == 1:
                current_ring = ""
            else:
                current_ring += char
        elif char == ')':
            depth -= 1
            if depth == 0:
                coords_str = current_ring.strip()
                if coords_str:
                    coords = []
                    for point in coords_str.split(','):
                        parts = point.strip().split()
                        if len(parts) >= 2:
                            coords.append([float(parts[0]), float(parts[1])])
                    rings.append(coords)
            else:
                current_ring += char
        else:
            if depth > 0:
                current_ring += char

    return rings if rings else []


def get_exclusion_zones(engine):
    """Get all exclusion zones as a FeatureCollection."""
    with engine.connect() as conn:
        query = text("SELECT geom_wkt, type FROM exclusionzone")
        rows = conn.execute(query).fetchall()

        features = []
        for row in rows:
            wkt = row[0]
            zone_type = row[1]

            try:
                coordinates = _parse_wkt_polygon(wkt)
                if coordinates:
                    feature = {
                        "type": "Feature",
                        "properties": {"type": zone_type},
                        "geometry": {
                            "type": "Polygon",
                            "coordinates": coordinates
                        }
                    }
                    features.append(feature)
            except Exception as e:
                print(f"Error parsing exclusion zone: {e}")
                continue

        return {
            "type": "FeatureCollection",
            "features": features
        }


def get_shelter_details(engine, fid: int):
    """Fetch detailed information for a specific shelter by fid.

    Args:
        engine: Database engine
        fid: Shelter ID (fid) to fetch details for

    Returns:
        Dictionary with shelter details from database, or None if not found
    """
    with engine.connect() as conn:
        # Call the database procedure to get shelter details
        result = conn.execute(text("""
            SELECT get_shelter_details(:fid);
        """), {"fid": fid})
        row = result.fetchone()

        if row and row[0]:
            return row[0]
        return None

