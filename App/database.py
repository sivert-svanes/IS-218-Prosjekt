import os
import json
import math
import sqlalchemy
from sqlalchemy import text
from sqlalchemy.pool import QueuePool
from dotenv import load_dotenv
from enum import Enum
import numpy as np

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
                ST_Y(ST_Transform(s.posisjon, 25833)) AS y,
                ST_X(ST_Transform(s.posisjon, 4326)) AS lng,
                ST_Y(ST_Transform(s.posisjon, 4326)) AS lat
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
                "lng": float(row[4]),
                "lat": float(row[5]),
            }
            for row in rows
        ]


def get_coverage_population_cells(engine, scope: str, fylke_id: int | None = None, include_geometry: bool = False):
    if include_geometry:
        query = text("""
            SELECT
                COALESCE(g.poptot, 0)::INT AS poptot,
                ST_X(ST_PointOnSurface(g.geometry)) AS x,
                ST_Y(ST_PointOnSurface(g.geometry)) AS y,
                ST_AsGeoJSON(ST_Transform(g.geometry, 4326)) AS geojson
            FROM public.befolkning_rutenett_250m_2025 g
            WHERE :scope = 'norway'
               OR EXISTS (
                    SELECT 1
                    FROM public.fylker f
                    WHERE f.id = :fylke_id
                      AND ST_Intersects(g.geometry, ST_Transform(f.geomfylke, 25833))
               )
            ORDER BY g.ogc_fid;
        """)
    else:
        query = text("""
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
        """)

    with engine.connect() as conn:
        rows = conn.execute(query, {"scope": scope, "fylke_id": fylke_id}).fetchall()
        if include_geometry:
            return [{"poptot": int(r[0] or 0), "x": float(r[1]), "y": float(r[2]), "geojson": r[3]} for r in rows]
        else:
            return [{"poptot": int(r[0] or 0), "x": float(r[1]), "y": float(r[2])} for r in rows]

def calculate_coverage_analysis(shelters, population_cells):
    remaining_capacity = {}
    shelter_allocated = {}
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
            "lng": float(shelter.get("lng", 0.0)),
            "lat": float(shelter.get("lat", 0.0)),
            "plasser": capacity,
        }
        normalized_shelters.append(normalized)
        remaining_capacity[normalized["fid"]] = capacity
        shelter_allocated[normalized["fid"]] = 0

    total_population = 0
    total_capacity = sum(s["plasser"] for s in normalized_shelters)
    covered_population = 0

    N = len(population_cells)
    cell_coverages = [0.0] * N

    if normalized_shelters and N > 0:

        cell_xy = np.array([[float(c["x"]), float(c["y"])] for c in population_cells], dtype=np.float64)
        shelter_xy = np.array([[s["x"], s["y"]] for s in normalized_shelters], dtype=np.float64)

        # Finn nærmeste shelter per celle
        CHUNK = 2000
        min_dist_sq = np.empty(N, dtype=np.float64)

        for i in range(0, N, CHUNK):
            chunk = cell_xy[i:i + CHUNK]
            dq = ((chunk[:, None, :] - shelter_xy[None, :, :]) ** 2).sum(2)
            min_dist_sq[i:i + CHUNK] = dq.min(1)

        # GLOBAL SORT (DETTE ER HELE FIXEN)
        sorted_indices = np.argsort(min_dist_sq)

        for cell_idx in sorted_indices:
            cell = population_cells[cell_idx]

            people_left = max(0, int(cell.get("poptot") or 0))
            cell_total = people_left

            if people_left <= 0:
                continue

            total_population += people_left

            # sorter shelters for denne cellen (nærmest først)
            dists = ((shelter_xy - cell_xy[cell_idx]) ** 2).sum(1)
            shelter_order = np.argsort(dists)

            cell_covered = 0

            for si in shelter_order:
                if people_left <= 0:
                    break

                s = normalized_shelters[si]
                available = remaining_capacity.get(s["fid"], 0)

                if available <= 0:
                    continue

                assigned = min(people_left, available)

                remaining_capacity[s["fid"]] -= assigned
                shelter_allocated[s["fid"]] += assigned
                people_left -= assigned
                covered_population += assigned
                cell_covered += assigned

            cell_coverages[cell_idx] = cell_covered / cell_total if cell_total > 0 else 0.0

    uncovered_population = total_population - covered_population
    coverage_ratio = (covered_population / total_population) if total_population else 0.0

    summary = {
        "total_population": total_population,
        "total_capacity": total_capacity,
        "shelter_count": len(normalized_shelters),
        "covered_population": covered_population,
        "uncovered_population": uncovered_population,
        "coverage_ratio": coverage_ratio,
    }

    shelter_features = []
    for s in normalized_shelters:
        capacity = s["plasser"]
        allocated = shelter_allocated.get(s["fid"], 0)
        shelter_features.append({
            "type": "Feature",
            "geometry": {"type": "Point", "coordinates": [s["lng"], s["lat"]]},
            "properties": {
                "fid": s["fid"],
                "capacity": capacity,
                "allocated": allocated,
                "remaining": remaining_capacity.get(s["fid"], 0),
                "utilization": round(allocated / capacity, 3) if capacity > 0 else 0.0,
                "is_full": remaining_capacity.get(s["fid"], 0) == 0 and capacity > 0,
            },
        })

    result = {
        "summary": summary,
        "shelters": {"type": "FeatureCollection", "features": shelter_features},
    }

    # Build cell GeoJSON only when geometry was fetched (county mode)
    if population_cells and "geojson" in population_cells[0]:
        cell_features = []
        for i, cell in enumerate(population_cells):
            geojson_str = cell.get("geojson")
            poptot = int(cell.get("poptot") or 0)
            if not geojson_str or poptot <= 0:
                continue
            coverage_pct = cell_coverages[i] if i < len(cell_coverages) else 0.0
            cell_features.append({
                "type": "Feature",
                "geometry": json.loads(geojson_str),
                "properties": {
                    "poptot": poptot,
                    "covered": round(coverage_pct * poptot),
                    "coverage_pct": round(coverage_pct, 3),
                },
            })
        result["population_cells"] = {"type": "FeatureCollection", "features": cell_features}

    return result

def get_cache_key(scope: str, fylke_id: int | None = None):
    return f"{scope}_{fylke_id}_v5"


def save_coverage_cache():
    try:
        with open(CACHE_FILE, "w", encoding="utf-8") as f:
            json.dump(_coverage_analysis_cache, f)
    except Exception as e:
        print(f"Could not save coverage cache: {e}")


def get_coverage_analysis(engine, scope: str, fylke_id: int | None = None):
    include_geometry = True
    cache_key = get_cache_key(scope, fylke_id)

    if cache_key in _coverage_analysis_cache:
        print(f"Using cached coverage analysis for {cache_key}")
        return _coverage_analysis_cache[cache_key]

    print(f"Calculating coverage analysis for {cache_key}")

    shelters = get_coverage_shelters(engine, scope, fylke_id)
    population_cells = get_coverage_population_cells(
        engine,
        scope,
        fylke_id,
        include_geometry=include_geometry
    )

    result = calculate_coverage_analysis(shelters, population_cells)

    _coverage_analysis_cache[cache_key] = result
    save_coverage_cache()

    return result

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

def get_fylke_outline(engine, fylke_id: int):
    with engine.connect() as conn:
        row = conn.execute(text("""
            SELECT ST_AsGeoJSON(ST_Transform(geomfylke, 4326)) AS geojson, navn
            FROM public.fylker WHERE id = :fylke_id
        """), {"fylke_id": fylke_id}).fetchone()
        if not row or not row[0]:
            return None
        return {"geojson": json.loads(row[0]), "navn": row[1]}


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


# Amenity types as defined in the request
class AmenityType(Enum):
    CONVENIENCE = "convenience"
    DOCTORS = "doctors"
    DRINKING_WATER = "drinking_water"
    HARDWARE = "hardware"
    SUPERMARKET = "supermarket"
    TRADE = "trade"
    HOSPITAL = "hospital"
    CHEMIST = "chemist"


def get_amenities_by_type(engine, amenity_type: str | AmenityType = None, amenity_types: list[str] = None):
    """
    Retrieve amenities from the database and return them organized by type as layers.

    Args:
        engine: SQLAlchemy engine instance
        amenity_type: Optional single amenity type filter (e.g., 'convenience', 'doctors')
        amenity_types: Optional list of amenity types to filter (e.g., ['convenience', 'doctors'])
                     If neither amenity_type nor amenity_types is provided, returns all types.

    Returns:
        If amenity_type or amenity_types is specified:
            A FeatureCollection for those types
        If neither is specified:
            A dictionary with layers for each amenity type
    """

    # Convert AmenityType enum to string if needed
    if isinstance(amenity_type, AmenityType):
        amenity_type = amenity_type.value

    # Build the list of types to query
    if amenity_types:
        types_to_query = amenity_types
    elif amenity_type:
        types_to_query = [amenity_type]
    else:
        types_to_query = [e.value for e in AmenityType]

    # Determine if organizing by type
    organize_by_type = not (amenity_type or amenity_types)
    order_by = "key, fid" if organize_by_type else "fid"

    with engine.connect() as conn:
        query = text(f"""
            SELECT fid, key, ST_AsGeoJSON(wkt_geom::geometry) AS geojson
            FROM public.buildings
            WHERE key = ANY(:amenity_types)
            ORDER BY {order_by};
        """)
        rows = conn.execute(query, {"amenity_types": types_to_query}).fetchall()

        # If not organizing by type, return simple FeatureCollection
        if not organize_by_type:
            features = []
            for row in rows:
                try:
                    feature = {
                        "type": "Feature",
                        "geometry": json.loads(row[2]),
                        "properties": {"fid": int(row[0]), "type": row[1]}
                    }
                    features.append(feature)
                except Exception as e:
                    print(f"Error parsing amenity {row[0]}: {e}")
            return {"type": "FeatureCollection", "features": features}

        # Organize by type
        layers = {e.value: {"type": "FeatureCollection", "features": []} for e in AmenityType}

        for row in rows:
            try:
                amenity_type_str = row[1]
                feature = {
                    "type": "Feature",
                    "geometry": json.loads(row[2]),
                    "properties": {"fid": int(row[0]), "type": amenity_type_str}
                }
                if amenity_type_str in layers:
                    layers[amenity_type_str]["features"].append(feature)
            except Exception as e:
                print(f"Error parsing amenity {row[0]}: {e}")

        return layers
