import os
import json
import math
import sqlalchemy
from sqlalchemy import text
from sqlalchemy.pool import QueuePool
from dotenv import load_dotenv
from enum import Enum

load_dotenv()
CONN_STR = os.getenv("DATABASE_URL")
CACHE_FILE = "coverage_cache.json"

if os.path.exists(CACHE_FILE):
    with open(CACHE_FILE, "r") as f:
        _coverage_analysis_cache = json.load(f)
else:
    _coverage_analysis_cache = {}

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


def get_fylker(engine):
    with engine.connect() as conn:
        rows = conn.execute(text("""
            SELECT id, navn
            FROM public.fylker
            ORDER BY id;
        """)).fetchall()
        return [{"id": int(row[0]), "navn": row[1]} for row in rows]


def get_coverage_shelters(engine, scope: str, fylke_id: int | None = None):
    with engine.connect() as conn:
        rows = conn.execute(text("""
            SELECT
                s.fid,
                COALESCE(s.plasser, 0)::INT AS plasser,
                ST_X(ST_Transform(s.posisjon, 25833)) AS x,
                ST_Y(ST_Transform(s.posisjon, 25833)) AS y
            FROM public.shelters s
            WHERE s.posisjon IS NOT NULL
              AND (
                    :scope = 'norway'
                    OR EXISTS (
                        SELECT 1
                        FROM public.fylker f
                        WHERE f.id = :fylke_id
                          AND ST_Covers(f.geomfylke, s.posisjon)
                    )
              )
            ORDER BY s.fid;
        """), {"scope": scope, "fylke_id": fylke_id}).fetchall()

        return [
            {
                "fid": int(row[0]),
                "plasser": int(row[1] or 0),
                "x": float(row[2]),
                "y": float(row[3]),
            }
            for row in rows
        ]


def get_coverage_population_cells(engine, scope: str, fylke_id: int | None = None):
    with engine.connect() as conn:
        rows = conn.execute(text("""
            SELECT
                COALESCE(g.poptot, 0)::INT AS poptot,
                ST_X(ST_PointOnSurface(g.geometry)) AS x,
                ST_Y(ST_PointOnSurface(g.geometry)) AS y
            FROM public.befolkning_rutenett_250m_2025 g
            WHERE :scope = 'norway'
               OR EXISTS (
                    SELECT 1
                    FROM public.fylker f
                    WHERE f.id = :fylke_id
                      AND ST_Intersects(g.geometry, ST_Transform(f.geomfylke, 25833))
               )
            ORDER BY g.ogc_fid;
        """), {"scope": scope, "fylke_id": fylke_id}).fetchall()

        return [
            {
                "poptot": int(row[0] or 0),
                "x": float(row[1]),
                "y": float(row[2]),
            }
            for row in rows
        ]


def calculate_coverage_analysis(shelters, population_cells):
    remaining_capacity = {}
    normalized_shelters = []

    for shelter in shelters:
        fid = shelter.get("fid")
        if fid is None:
            continue

        capacity = max(0, int(shelter.get("plasser") or 0))
        normalized = {
            "fid": int(fid),
            "x": float(shelter.get("x")),
            "y": float(shelter.get("y")),
            "plasser": capacity,
        }
        normalized_shelters.append(normalized)
        remaining_capacity[normalized["fid"]] = capacity

    total_population = 0
    total_capacity = sum(s["plasser"] for s in normalized_shelters)
    covered_population = 0

    for cell in population_cells:
        people_left = max(0, int(cell.get("poptot") or 0))
        if people_left <= 0:
            continue

        total_population += people_left
        cx = float(cell.get("x"))
        cy = float(cell.get("y"))

        ordered = sorted(
            normalized_shelters,
            key=lambda s: ((s["x"] - cx) ** 2 + (s["y"] - cy) ** 2, s["fid"])
        )

        for shelter in ordered:
            if people_left <= 0:
                break

            available = remaining_capacity.get(shelter["fid"], 0)
            if available <= 0:
                continue

            assigned = min(people_left, available)
            remaining_capacity[shelter["fid"]] = available - assigned
            people_left -= assigned
            covered_population += assigned

    uncovered_population = total_population - covered_population
    coverage_ratio = (covered_population / total_population) if total_population else 0.0

    return {
        "total_population": total_population,
        "total_capacity": total_capacity,
        "shelter_count": len(normalized_shelters),
        "covered_population": covered_population,
        "uncovered_population": uncovered_population,
        "coverage_ratio": coverage_ratio,
    }

def get_coverage_analysis(engine, scope: str, fylke_id: int | None = None):
    cache_key = f"{scope}_{fylke_id}"

    if cache_key in _coverage_analysis_cache:
        print(f"Using cached coverage analysis for {cache_key}")
        return _coverage_analysis_cache[cache_key]

    print(f"Calculating coverage analysis for {cache_key}")

    shelters = get_coverage_shelters(engine, scope, fylke_id)
    population_cells = get_coverage_population_cells(engine, scope, fylke_id)

    summary = calculate_coverage_analysis(shelters, population_cells)

    _coverage_analysis_cache[cache_key] = summary

    with open(CACHE_FILE, "w") as f:
        json.dump(_coverage_analysis_cache, f)

    return summary

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
