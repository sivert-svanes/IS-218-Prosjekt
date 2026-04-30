**Status**: Active Development | **Last Updated**: March 2026
# ShelterLog

Our goal is to display public shelters and their current supplies on the map. The system will recognize locations with
low supply and provide routes to get supplies, accounting for threats.

## 1. Demo

> [!IMPORTANT]
> <details>
> <summary style="font-size: 14px; font-weight: bold">System Demonstration</summary>
>
> [Video: ShelterLog System Demo](https://github.com/user-attachments/assets/5c992780-a2aa-41cc-8a2d-52d6fa990b9b)
>
> </details>

## 2. Technical Stack

### Frontend
| Component   | Version    | Usage                                              |
|-------------|------------|----------------------------------------------------|
| TypeScript  | ^4.9.5     | Javascript is ass, i refuse to write it            |
| MapLibre GL | ^4.7.1     | Interactive map rendering and layer management     |
| Node.js     | Latest LTS | JavaScript runtime for development and build tools |

### Backend
| Component   | Version | Usage                                            |
|-------------|---------|--------------------------------------------------|
| Python      | 3.10    | Core programming language for backend            |
| Flask       | 3.1.3   | Web framework                                    |
| SQLAlchemy  | 2.0.46  | ORM for database abstraction and queries         |
| GeoAlchemy2 | 0.18.1  | PostGIS extension for spatial data in SQLAlchemy |
| diskcache   | n.a.    | Optional disk-based caching for performance      |
| spglib      | 2.7.0   | Space group library for crystallographic data    |
| psycopg2    | 2.9.11  | PostgreSQL adapter for Python                    |
| psycopg     | 3.3.3   | Modern PostgreSQL adapter (psycopg3)             |
| hashlib     | n.a.    | Built-in cryptographic hashing                   |

### Database
| Component  | Version     | Usage                                                      |
|------------|-------------|------------------------------------------------------------|
| PostgreSQL | 17.6 (GCC)  | Relational database server for data persistence            |
| PostGIS    | 3.3.7 (GCC) | Spatial extension for storing and querying geospatial data |

## 4. Data Catalog

| Dataset              | Source                                                                                                                  | Format   | Processing                                                                 |
|----------------------|-------------------------------------------------------------------------------------------------------------------------|----------|----------------------------------------------------------------------------|
| Emergency Shelters   | [GeoNorge](https://kartkatalog.geonorge.no/metadata/tilfluktsrom-offentlige/dbae9aae-10e7-4b75-8d67-7f0e8828f3d8)       | GML      | Converted to PostGIS geometry, indexed for spatial queries                 |
| NVDB                 | [Statens Vegvesen](https://www.nvdb.no/hent-og-se-data/eksport/nvdb-eksport/brukerveiledning/)                          | WKT(CSV) | Converted to PostGIS geometry, spatial indexing, TOAST compression         |
| County Boundaries    | [GeoNorge](https://kartkatalog.geonorge.no/metadata/administrative-enheter-fylker/6093c8a8-fa80-11e6-bc64-92361f002671) | GeoJSON  | Converted to PostGIS polygons for administrative filtering                 |
| Map Style            | [OpenMapTiles](https://raw.githubusercontent.com/openmaptiles/positron-gl-style/refs/heads/master/style.json)           | JSON     | Applied globe projection and custom styling                                |
| FKB                  | [Kartverket](https://wms.geonorge.no/skwms1/wms.fkb?service=wms&request=getcapabilities)                                | WMS      | Caching of tiles in memory and on disk                                     |
| Population Grid 250m | [GeoNorge](https://kartkatalog.geonorge.no/metadata/befolkning-paa-rutenett-250-m/0c0ad0ce-55e8-4d73-9c12-0eb0e2454acb) | FGDB     | Imported to PostGIS, used for population aggregation and coverage analysis |
| OSM(Overpass)        | [Overpass Turbo](https://overpass-turbo.eu/)                                                                            | OSM JSON | Converted to PostGIS points using [OSMparser](https://github.com/Gorilla-Mode/OSMparser)
## 5. Architecture Overview

### 1. Application Architecture

```
┌──────────────────────────────────────────────────────────────┐
│                 Frontend (TypeScript/MapLibre)               │
│   ┌───────────────────────────────────────────────────────┐  │
│   │ main.ts - Application Entry Point & Map Manager       │  │
│   │  - Initializes MapLibre map with globe projection     │  │
│   │  - Manages geolocation                                │  │
│   │  - Loads dynamic layers                               │  │
│   │                                                       │  │
│   │ layer.ts - Data Loading                               │  │
│   │  - Functions for adding data layers to the map        │  │
│   │  - Fetch and cache WMS raster tiles                   │  │
│   │                                                       │  │
│   │ layerControl.ts - Manages UI and layers               │  │
│   │  - Manages dropdown menus for layer toggling          │  │
│   │  - Functions for registering styles and layers        │  │
│   │                                                       │  │
│   │ shortestPath.ts - Pathfinding & Route Calculation     │  │
│   │  - Implements A* algorithm for path finding           │  │
│   │  - Fetches and caches road network data               │  │
│   │                                                       │  │
│   │ mapStyles.ts - Map Styling & Visual Effects           │  │
│   │  - Defines base style and custom styles               │  │
│   │  - Registers new styles                               │  │
│   │                                                       │  │
│   │ starsLayer.ts - Custom WebGL Star Field               │  │
│   │  - Generates procedural star field using WebGL        │  │
│   │  - Renders with camera-relative parallax              │  │
│   │  - Because its cool                                   │  │
│   │                                                       │  │
│   │ coverageAnalysis.ts - Coverage Analysis Visualization │  │
│   │  - Visualizes shelter coverage with grid overlays     │  │
│   │  - Calculates and displays coverage statistics        │  │
│   │  - Fetches population data and coverage analysis      │  │
│   │                                                       │  │
│   │ search.ts - Shelter Search & Filtering                │  │
│   │  - Registers and indexes shelters by county           │  │
│   │  - Provides fuzzy search functionality                │  │
│   │  - Handles shelter filtering and display              │  │
│   │                                                       │  │
│   │ shelterDetails.ts - Shelter Information Display       │  │
│   │  - Displays detailed shelter information              │  │
│   │  - Manages amenity buttons (water, food, equipment)   │  │
│   │  - Fetches nearby amenities from OSM data             │  │
│   │                                                       │  │
│   │ exclusion.ts - Exclusion Zone Management              │  │
│   │  - Fetches and manages exclusion zones                │  │
│   │  - Handles flood zones, hazards, warzones, etc.       │  │
│   │  - Provides bounds calculation for zones              │  │
│   │                                                       │  │
│   │ exclusionDraw.ts - Exclusion Zone Drawing Tool        │  │
│   │  - Drawing interface for custom exclusion zones       │  │
│   │  - Allows users to mark danger areas on map           │  │
│   │                                                       │  │
│   │ patterns.ts - Custom Layer Patterns & Styling         │  │
│   │  - Defines pattern fills for exclusion zones          │  │
│   │  - Custom visual effects for layer rendering          │  │
│   │                                                       │  │
│   │ middleEarth.ts - Easter Egg / Theme System            │  │
│   │  - Alternative map styling (LOTR-themed)              │  │
│   │  - Custom layer variations                            │  │
│   │                                                       │  │
│   │ enum.ts - Enumerations & Constants                    │  │
│   │  - Amenity types and exclusion zone types             │  │
│   │  - Color mappings for visual elements                 │  │
│   │                                                       │  │
│   │ utils.ts - Utility Functions                          │  │
│   │  - Coordinate bounds calculation                      │  │
│   │  - Geometry processing helpers                        │  │
│   │  - Common mathematical utilities                      │  │
│   │                                                       │  │
│   │ interfaces.ts - TypeScript Type Definitions           │  │
│   │  - Shelter features and WMS layer configurations      │  │
│   │  - Graph node and road segment types                  │  │
│   │  - Bounding box and cache types                       │  │
│   │                                                       │  │
│   │ types/ - Extended Type Definitions                    │  │
│   │  - MapLibre GL window augmentations                   │  │
│   │  - Debug geolocation override interface               │  │
│   └───────────────────────────────────────────────────────┘  │
└──────────────────────┬───────────────────────────────────────┘
                       │ HTTP API
┌──────────────────────▼───────────────────────────────────────┐
│                  Backend (Flask/Python)                      │
│   ┌───────────────────────────────────────────────────────┐  │
│   │ app.py - Flask Application & WMS Proxy                │  │
│   │  - Main Flask application entry point                 │  │
│   │  - WMS tile proxy with memory/disk caching            │  │
│   │  - Tile cache management and filtering                │  │
│   │  - County bbox computation for tile filtering         │  │
│   │                                                       │  │
│   │ database.py - Database Abstraction Layer              │  │
│   │  - SQLAlchemy ORM and connection pooling              │  │
│   │  - PostGIS spatial queries and functions              │  │
│   │  - Coverage analysis and caching                      │  │
│   │  - Road type enumerations                             │  │
│   │  - Coordinate system conversions                      │  │
│   │                                                       │  │
│   │ raster.py - Raster Data Processing (WMS)              │  │
│   │  - WMS tile fetching and caching                      │  │
│   │  - Raster to array conversion (PNG to numpy)          │  │
│   │  - Coordinate system transformations                  │  │
│   │                                                       │  │
│   │  API Endpoints:                                       │  │
│   │  - GET / - Renders main index                         │  │
│   │  - GET /api/fylke/{id} - Get shelters by county       │  │
│   │  - GET /api/fylker - Get all counties                 │  │
│   │  - GET /api/nearest-shelters - K-nearest shelters     │  │
│   │  - GET /shelter-details/{fid} - Render detail page    │  │
│   │  - GET /api/shelter-details/{fid} - Shelter JSON      │  │
│   │  - GET /api/amenities - Get all amenity types         │  │
│   │  - GET /api/amenities/{type} - Get amenities by type  │  │
│   │  - GET /api/nearest-buildings - Find nearby POIs      │  │
│   │  - POST /api/valhalla-route - Matrix routing          │  │
│   │  - POST /api/valhalla-route-polyline - Route polyline │  │
│   │  - GET /api/nvdb/roads - Query road network data      │  │
│   │  - GET /api/coverage-analysis - Coverage statistics   │  │
│   │  - GET /api/fylke-outline/{id} - County boundaries    │  │
│   │  - GET /api/exclusion-zones - Fetch exclusion zones   │  │
│   │  - POST /api/exclusion-zones - Add exclusion zone     │  │
│   │  - GET /api/wms-proxy - WMS tile proxy with caching   │  │
│   │  - GET /api/brannstasjoner - Fire stations (legacy)   │  │
│   │                                                       │  │
│   │  HTTP Methods:                                        │  │
│   │  - Get_Index: POST - Renders index                    │  │
│   └───────────────────────────────────────────────────────┘  │
└──────────────────────┬───────────────────────────────────────┘
                       │ PL/pgSQL Stored Functions
┌──────────────────────▼───────────────────────────────────────┐
│             PostgreSQL + PostGIS Database                    │
│   ┌───────────────────────────────────────────────────────┐  │
│   │  Stored Functions (in sp.sql):                        │  │
│   │  - get_shelters_within_fylke: Fetch shelters by id    │  │
│   │  - get_k_nearest_shelters: K-NN spatial search        │  │
│   │  - get_nvdb_roads_geojson: Query road network         │  │
│   │  - get_exclusion_zones: Fetch exclusion zones         │  │
│   │  - get_coverage_analysis: Coverage statistics         │  │
│   │  - build_geojson_feature: Utility for GeoJSON format  │  │
│   │  - build_geojson_collection: Aggregate GeoJSON data   │  │
│   │  - get_k_nearest_features: from selected table        │  │
│   └───────────────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────────────┘
```

**Data Flow:**
1. User requests current location → Frontend sends lat/lng to backend
2. Backend queries nearest shelters using k-NN spatial queries
3. Backend calculates shortest path using A* algorithm on road network
4. Results returned as GeoJSON to frontend
5. Frontend visualizes path and shelter locations on interactive map

## 3. Database Schema

### 1. Database Tables

```
┌──────────────────────────────────────────────────────────────┐
│              PostgreSQL + PostGIS Database                   │
│   ┌─────────────────────────────────────────────────────┐    │
│   │ Table: shelters                                     │    │
│   ├─────────────────────────────────────────────────────┤    │
│   │ Columns:                                            │    │
│   │  - fid: INTEGER, PK                                 │    │
│   │  - gmlId: VARCHAR                                   │    │
│   │  - lokalId: VARCHAR(36)                             │    │
│   │  - navnerom: VARCHAR(60)                            │    │
│   │  - versjonId: INTEGER                               │    │
│   │  - datauttaksdato: TIMESTAMP WITH TIME ZONE         │    │
│   │  - opphav: VARCHAR(47)                              │    │
│   │  - romNr: INTEGER                                   │    │
│   │  - plasser: INTEGER                                 │    │
│   │  - adresse: VARCHAR(52)                             │    │
│   │  - posisjon: GEOMETRY(Point, 4326)                  │    │
│   │  - navn: VARCHAR                                    │    │
│   │                                                     │    │
│   │ Indexes:                                            │    │
│   │  - fid: UNIQUE                                      │    │ 
│   │  - posisjon: GIST                                   │    │
│   └─────────────────────────────────────────────────────┘    │
│                                                              │
│   ┌─────────────────────────────────────────────────────┐    │
│   │ Table: fylker                                       │    │
│   ├─────────────────────────────────────────────────────┤    │
│   │ Columns:                                            │    │
│   │  - id: INTEGER, PK                                  │    │
│   │  - navn: VARCHAR                                    │    │
│   │  - geomfylke: GEOMETRY(Polygon, 4326)               │    │
│   │                                                     │    │
│   │ Indexes:                                            │    │
│   │  - id: UNIQUE                                       │    │
│   │  - geomfylke: GIST                                  │    │
│   └─────────────────────────────────────────────────────┘    │ 
│                                                              │
│   ┌─────────────────────────────────────────────────────┐    │
│   │ Table: befolkning_rutenett_250m_2025                │    │
│   ├─────────────────────────────────────────────────────┤    │
│   │ Columns:                                            │    │
│   │  - ogc_fid: INTEGER, PK                             │    │
│   │  - objtype: VARCHAR(32)                             │    │
│   │  - lokalid: VARCHAR(100)                            │    │
│   │  - navnerom: VARCHAR(100)                           │    │
│   │  - versjonid: VARCHAR(100)                          │    │
│   │  - oppdateringsdato: TIMESTAMP WITH TIME ZONE       │    │
│   │  - datauttaksdato: TIMESTAMP WITH TIME ZONE         │    │
│   │  - opphav: VARCHAR(255)                             │    │
│   │  - ssid250m: VARCHAR(14)                            │    │
│   │  - poptot: INTEGER                                  │    │
│   │  - statistikkaar: INTEGER                           │    │
│   │  - geometry: GEOMETRY(MultiPolygon,25833)           │    │
│   │                                                     │    │
│   │ Indexes:                                            │    │
│   │  - ..._pkey: UNIQUE                                 │    │
│   │  - ..._geometry_geom_idx: GIST                      │    │
│   │                                                     │    │
│   └─────────────────────────────────────────────────────┘    │
│                                                              │
│   ┌─────────────────────────────────────────────────────┐    │
│   │ Table: exclusion_type                               │    │
│   ├─────────────────────────────────────────────────────┤    │
│   │ Columns:                                            │    │
│   │  - id: INTEGER, PK                                  │    │
│   │  - type: VARCHAR(32), NOT NULL                      │    │
│   │                                                     │    │
│   │ Purpose:                                            │    │
│   │ Defines enumeration of exclusion zone types:        │    │
│   │  - Flood Zone, Radiation Hazard, Toxic Hazard       │    │
│   │  - Biological Hazard, Fire, Ruins                   │    │
│   │  - Active Warzone, Low Air Quality                  │    │
│   └─────────────────────────────────────────────────────┘    │
│                                                              │
│   ┌─────────────────────────────────────────────────────┐    │
│   │ Table: exclusionzone                                │    │
│   ├─────────────────────────────────────────────────────┤    │
│   │ Columns:                                            │    │
│   │  - id: INTEGER, PK                                  │    │
│   │  - geom_wkt: TEXT, NOT NULL                         │    │
│   │  - type: INTEGER, FK → exclusion_type(id)           │    │
│   │                                                     │    │
│   │ Purpose:                                            │    │
│   │ Stores dangerous/hazardous areas to avoid during    │    │
│   │ routing and shelter path calculations               │    │
│   │                                                     │    │
│   │ Foreign Keys:                                       │    │
│   │  - type → exclusion_type(id)                        │    │
│   └─────────────────────────────────────────────────────┘    │
│                                                              │
│   ┌─────────────────────────────────────────────────────┐    │
│   │ Table: shelter_egenskaper                           │    │
│   ├─────────────────────────────────────────────────────┤    │
│   │ Columns:                                            │    │
│   │  - id: INTEGER, PK                                  │    │
│   │  - shelter_id: INTEGER, FK → shelters(fid)          │    │
│   │  - mat: INTEGER                                     │    │
│   │  - vann: INTEGER                                    │    │
│   │  - medisin: INTEGER                                 │    │
│   │  - utstyr: INTEGER                                  │    │
│   │  - plasser: INTEGER                                 │    │
│   │  - mat_kapasitet: INTEGER                           │    │
│   │  - vann_kapasitet: INTEGER                          │    │
│   │  - medisin_kapasitet: INTEGER                       │    │
│   │  - utstyr_kapasitet: INTEGER                        │    │
│   │  - plasser_opptatt: INTEGER (default 0)             │    │
│   │  - adresse: VARCHAR(52)                             │    │
│   │  - posisjon: GEOMETRY(Point, 4326)                  │    │
│   │  - romnr: INTEGER                                   │    │
│   │                                                     │    │
│   │ Purpose:                                            │    │
│   │ Stores detailed supply and capacity info for each   │    │
│   │ shelter (food, water, medicine, equipment, spaces)  │    │
│   │                                                     │    │
│   │ Foreign Keys:                                       │    │
│   │  - shelter_id → shelters(fid)                       │    │
│   └─────────────────────────────────────────────────────┘    │
│                                                              │
│   ┌─────────────────────────────────────────────────────┐    │
│   │ View: shelter_status                                │    │
│   ├─────────────────────────────────────────────────────┤    │
│   │ Columns:                                            │    │
│   │  - id: INTEGER                                      │    │
│   │  - shelter_id: INTEGER                              │    │
│   │  - er_fullt: BOOLEAN                                │    │
│   │  - prosent_mat: DOUBLE                              │    │
│   │  - prosent_vann: DOUBLE                             │    │
│   │  - prosent_medisin: DOUBLE                          │    │
│   │  - prosent_utstyr: DOUBLE                           │    │
│   │  - dager_til_mat_tom: INTEGER                       │    │
│   │  - dager_til_vann_tom: INTEGER                      │    │
│   │  - dager_til_medisin_tom: INTEGER                   │    │
│   │  - dager_til_utstyr_tom: INTEGER                    │    │
│   │  - antall_plasser_igjen: INTEGER                    │    │
│   │                                                     │    │
│   │ Purpose:                                            │    │
│   │ Aggregates shelter_egenskaper into status metrics   │    │
│   │ for monitoring supply levels and occupancy.         │    │
│   │ Calculates percentages and days-until-empty.        │    │
│   │                                                     │    │
│   │ Based on:                                           │    │
│   │  - View built from shelter_egenskaper table         │    │
│   └─────────────────────────────────────────────────────┘    │
│   ┌─────────────────────────────────────────────────────┐    │
│   │ Table: Buildings                                    │    │
│   ├─────────────────────────────────────────────────────┤    │
│   │ Columns:                                            │    │
│   │  - fid: BIGINT, PK                                  │    │
│   │  - key: Varchar(24), NOT NULL                       │    │
│   │  - wkt_geom: Point                                  │    │
│   │                                                     │    │
│   │ Purpose:                                            │    │
│   │ Stores building point data for routing              │    │
│   │                                                     │    │
│   │ Indexes:                                            │    │
│   │  - buildings_key_index: UNIQUE                      |    |
│   └─────────────────────────────────────────────────────┘    │
└──────────────────────────────────────────────────────────────┘
```

# Deliverable 1 - Webutvikling, GIS, Kartografi

## 1. Further Improvements

- base back-end of the project
  - Begin creating a more robust front-end
- Switch to more relevant dataset
  - Remove firestations dataset
  - Add shelters dataset
  - Add API for large emergency network coverage data
  - Calculate or use dataset for flooding zones
  - Road graph
  - Point data for grocerys stores, pharmacies, etc.
- code in Main.ts will need to be refactored, as it currently has too much responsibility.
  - Split layer handling into seperate file
  - Split maprender into seperate file
- Use compiled PLpgSQL functions and procedures instead of raw SQL.
  - extract all sql queries into a seperate stored functions or prodecures
  - use the stored functions and procedures in the backend instead of raw SQL

# Deliverable 2 - GIScience og Romling Analyse
## 1. Section A

### 1. Overview

This section presents a spatial analysis of emergency shelters and population distribution in Agder, conducted in a Jupyter Notebook.

The analysis investigates how well shelters are geographically distributed relative to where people live, and identifies areas with potential gaps in coverage.

---

### 2. Data & Tools

**Datasets:**

- Shelters (PostGIS – Supabase)  
- County boundaries (Agder)  
- Population grid (250m resolution)  
- DEM (terrain raster data)  

**Tools:**

- pandas, geopandas → vector data processing  
- sqlalchemy → database access (PostGIS)  
- rasterio → raster analysis  
- shapely → geometry handling  
- matplotlib → visualization  

---

### 3. Analysis

**Vector analysis:**

- Filtering shelters to Agder  
- 500m buffer around shelters  
- Overlay with population grid  
- Spatial aggregation of covered population  

**Results:**

- ~828 population cells covered  
- ~20.56% of population within coverage  
- ~1351 cells identified with high population and low coverage  

---

**Raster analysis:**

- Slope derived from DEM  
- Filtering of areas with slope > 30°  
- Polygonization of steep areas  
- Two hillshade visualizations  

This provides insight into terrain conditions that may affect accessibility.

---

### 4. Key Insight

The analysis shows that shelter coverage is uneven, with large parts of the population located outside immediate reach.

GIS methods such as buffer, overlay, and raster analysis are effective for identifying these spatial patterns.

---

### 5. Notebook Link

[Open Notebook analysis](notebooks/analysis.ipynb)

## 2. Section B

### 1. Overview

**Shortest Path Calculation Process**

The ShelterLog application calculates optimal routes to the nearest emergency shelter through the following process:

1. **User Location & Nearest Shelter Query**
   - User's current location is obtained via maplibre geolocation
   - Dynamic SQL query finds the k=10 nearest shelters using PostGIS spatial indexing

2. **Road Network Retrieval**
   - NVDB road network data is fetched from the database
     - If no road graph is cached
     - If the cached road graph fails to find a route
     - The size of the bounding box is based on the haversine distance between the user's location and the nearest shelter

3. **Astar Pathfinding Algorithm**
   - Astar algorithm finds the shortest path to a shelter
   - Heuristic function estimates remaining distance to destination

4. **Visualization**
   - Calculated path is returned as GeoJSON LineString
   - Path is added as a new layer on the interactive map
   - Information about the shelter is displayed

---

### 2. Dynamic SQL

#### How "Find Nearest Shelter" Uses Dynamic SQL

1. **User Geolocation Retrieval**
   - Frontend (`shortestPath.ts`) requests user's current location using MapLibre's built-in geolocation
   - Coordinates are obtained as latitude (lat) and longitude (lng)

2. **Dynamic SQL Query Construction**
   - Frontend sends coordinates to backend: `/api/nearest-shelters?lat=6.77&lng=6.77&k=10`
   - Backend receives parameters and constructs a dynamic SQL query using PostGIS spatial functions

3. **Example Query Flow**
   ```sql
   -- Example call from frontend
   SELECT get_k_nearest_shelters(
       p_lat := 6.77,
       p_lng := 6.77,
       p_k := 10
   );
   ```
   
   ```sql
   -- Snippet from sp.sql
   CREATE OR REPLACE FUNCTION get_k_nearest_shelters(
       p_lat FLOAT8,
       p_lng FLOAT8,
       p_k INT DEFAULT 10
   )   
   RETURNS JSON AS $$
   SELECT 
        --GEOJSON FeatureCollection of the nearest shelters, removed for brevity
   FROM (
       SELECT *,
           ST_Distance(posisjon, ST_SetSRID(ST_Point(p_lng, p_lat), 4326)) as dist_m
       FROM public.shelters
       ORDER BY posisjon <-> ST_SetSRID(ST_Point(p_lng, p_lat), 4326)
       LIMIT LEAST(GREATEST(p_k, 1), 50)
   ) t;
   $$ LANGUAGE sql IMMUTABLE STRICT;
   ```
---

### 3. ST-functions

**PostGIS Spatial Functions in get_nvdb_roads_geojson**

The `get_nvdb_roads_geojson` is a stored function that retrieves road network data from the database, using spatial ST functions.

1. **Stored Function Snippet**
    
    ```sql
   --Get road graph function snippet
    CREATE OR REPLACE FUNCTION get_nvdb_roads_geojson(
        p_min_lng FLOAT8,
        p_min_lat FLOAT8,
        p_max_lng FLOAT8,
        p_max_lat FLOAT8,
        p_road_types TEXT[] DEFAULT NULL
    )
    RETURNS JSON AS $$
        SELECT
        --GEOJSON FeatureCollection of roads, removed for brevity
        FROM public.nvdb_roads
        WHERE ST_Intersects(
            geom_4326,
            ST_MakeEnvelope(p_min_lng, p_min_lat, p_max_lng, p_max_lat, 4326)
        )
        AND (p_road_types IS NULL OR "net.typeveg" = ANY(p_road_types));
    $$ LANGUAGE sql IMMUTABLE STRICT;
   ```

#### ST_MakeEnvelope - Creating Bounding Box Geometry



1. **Envelope Construction**
   - Frontend A* function sends bbox coordinates: `min_lng, min_lat, max_lng, max_lat`
   - Stored function creates a polygonal envelope using `ST_MakeEnvelope()`

2. **Example**
   ```sql
   --Envelope snippet
    ST_MakeEnvelope(p_min_lng, p_min_lat, p_max_lng, p_max_lat, 4326)
   ```
   - Creates polygon based on the haversine distance between the user's location and the nearest shelters
   - Enables efficient spatial comparison with road geometries

#### ST_Intersects - Spatial Intersection Query

1. **Intersection Check**
   ```sql
   --Intersection snippet
   WHERE ST_Intersects(
       geom_4326,
       ST_MakeEnvelope(p_min_lng, p_min_lat, p_max_lng, p_max_lat, 4326)
   )
   ```
   - Checks which road segments overlap with the requested bbox
   - Uses spatial index for O(log n) performance instead of O(n) table scan
   - Returns road graph with segments that intersect the bounding box

---

### 4. User Interface

**Overview**

The user interface is an interactive map where users can find the nearest shelter
by clicking a button. The shortest path to a shelter is calculated and displayed.

#### Finding Shelter
<img width="517" height="63" alt="image" src="https://github.com/user-attachments/assets/812b2659-e7d7-4307-bd3f-45d0834f6763" />

- User clicks the "Find Shelter" button on the map interface
- A loading animation is displayed while the application runs the calculation
    - Especially useful when fetching road graph from the database, as it can take a few seconds


#### Path Display
<img width="1500" height="1191" alt="image" src="https://github.com/user-attachments/assets/46b55aec-b765-4549-959b-9003e17b3989" />

- The shortest path is displayed as a blue line on the map
- The map is automatically fitted to the bounds of the path
- Information about the shelter is displayed

## 4. Further Improvements

- NEW DATASET! Current doesn't cover Norway, one that does might be too big 
- Routing function does not care about the concept of traffic laws
- It doesn't care about the concept of road sizes
- Use OSRM instead of own implementation
- Make UI look nicer

## 4. Setup Instructions

### Clone Repository
```powershell
git clone https://github.com/sivert-svanes/IS-218-Prosjekt.git
```

> [!IMPORTANT]
> <details>
> <summary style="font-size: 14px; font-weight: bold">1. Using build.py</summary>
> 1. In root directory run build.py
>
> Use this unless it breaks (It likes to break, and never in the same way)
>
>    ```powershell
>     python build.py
>    ```
> </details>

> [!IMPORTANT]
> <details>
> <summary style="font-size: 14px; font-weight: bold">2. Manual Setup</summary>
>
> #### 1. Compile TypeScript
> 1. CD to frontend folder
>     ```powershell
>     cd App\frontend
>     ```
> 2. Install dependencies
>     ```powershell
>     npm install
>     ```
> 3. Compile typescript
>     ```powershell
>     npm run build
>     ```
>
> #### 2. Setup Python Environment
> 1. CD root folder
> 2. Setup virtual env
>    1. Create virtual env
>       ```powershell
>       py -3 -m venv .venv
>       ```
>    2. Activate virtual env
>        ```powershell
>        .venv\Scripts\activate
>        ```
> 3. Install dependencies
>     ```powershell
>     pip install Flask SQLAlchemy GeoAlchemy2
>     ```
>
> #### 3. Setup Environment Variables
> 1. In the root folder create a .env file:
>     ```powershell
>     echo > .env
>     ```
> 2. Add the following line to the .env file
>     ```
>     DATABASE_URL=postgresql://user:password@localhost/shelterlog
>     ```
>
> #### 4. Start Server
> From root folder:
>   ```powershell
>     flask --app .\App\app.py run --debug
>  ```
</details>

> [!IMPORTANT]
> <details>
> <summary style="font-size: 14px; font-weight: bold">Important Image</summary>
>
> ![Jork IT](https://media1.tenor.com/m/grh1asJHzg4AAAAC/freaky.gif)
>
> </details>
