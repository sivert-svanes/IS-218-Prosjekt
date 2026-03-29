# ShelterLog

## 1. Project Overview

Our goal is to display public shelters and their current supplies on the map. The system will recognize locations with
low supply and provide routes to get supplies, accounting for threats.

## 2. Demo

> [!IMPORTANT]
> <details>
> <summary style="font-size: 14px; font-weight: bold">System Demonstration</summary>
>
> [Video: ShelterLog System Demo](https://github.com/user-attachments/assets/8ae4a56b-81f2-4691-b293-9cc92c3a3474)
>
> </details>

## 3. Technical Stack

### Frontend
| Component   | Version    | Usage                                              |
|-------------|------------|----------------------------------------------------|
| TypeScript  | ^4.9.5     | Javascript is ass, i refuse to write it            |
| MapLibre GL | ^4.7.1     | Interactive map rendering and layer management     |
| Node.js     | Latest LTS | JavaScript runtime for development and build tools |

### Backend
| Component   | Version | Usage                                            |
|-------------|---------|--------------------------------------------------|
| Python      | 3.10+   | Core programming language for backend            |
| Flask       | ^3.1.3  | Web framework                                    |
| SQLAlchemy  | ^2.0.46 | ORM for database abstraction and queries         |
| GeoAlchemy2 | ^0.18.1 | PostGIS extension for spatial data in SQLAlchemy |
| diskcache   | n.a.    | Optional disk-based caching for performance      |
| spglib      | ^2.7.0  | Space group library for crystallographic data    |
| psycopg2    | ^2.9.11 | PostgreSQL adapter for Python                    |
| psycopg     | ^3.3.3  | Modern PostgreSQL adapter (psycopg3)             |
| hashlib     | n.a.    | Built-in cryptographic hashing                   |

### Database
| Component  | Version | Usage |
|------------|---------|-------|
| PostgreSQL | 15+     | Relational database server for data persistence |
| PostGIS    | 3.3+    | Spatial extension for storing and querying geospatial data |

## 4. Data Catalog

| Dataset            | Source                                                                                                                  | Format   | Processing                                                         |
|--------------------|-------------------------------------------------------------------------------------------------------------------------|----------|--------------------------------------------------------------------|
| Emergency Shelters | [GeoNorge](https://kartkatalog.geonorge.no/metadata/tilfluktsrom-offentlige/dbae9aae-10e7-4b75-8d67-7f0e8828f3d8)                | GML      | Converted to PostGIS geometry, indexed for spatial queries         |
| NVDB               | [Statens Vegvesen](https://www.nvdb.no/hent-og-se-data/eksport/nvdb-eksport/brukerveiledning/)                          | WKT(CSV) | Converted to PostGIS geometry, spatial indexing, TOAST compression |
| County Boundaries  | [GeoNorge](https://kartkatalog.geonorge.no/metadata/administrative-enheter-fylker/6093c8a8-fa80-11e6-bc64-92361f002671) | GeoJSON  | Converted to PostGIS polygons for administrative filtering         |
| Map Style          | [OpenMapTiles](https://raw.githubusercontent.com/openmaptiles/positron-gl-style/refs/heads/master/style.json)           | JSON     | Applied globe projection and custom styling                        |
| FKB                | [Kartverket](https://wms.geonorge.no/skwms1/wms.fkb?service=wms&request=getcapabilities)                                | WMS      | Caching of tiles in memory and on disk                             |

## 5. Architecture Overview

```
┌──────────────────────────────────────────────────────────────┐
│                 Frontend (TypeScript/MapLibre)               │
│   ┌───────────────────────────────────────────────────────┐  │
│   │ main.ts - Application Entry Point                     │  │
│   │  - Initializes map and loads all layers               │  │
│   │  - Manages geolocation and user interaction           │  │
│   │                                                       │  │
│   │ layer.ts - Layer Management                           │  │
│   │  - AddShelterLayerGeospatial: Load shelter data       │  │
│   │  - AddShortestPathLayer: Display calculated routes    │  │
│   │  - registerLayer: Register layers in dropdown menu    │  │
│   │                                                       │  │
│   │ shortestPath.ts - Pathfinding & Routing Logic         │  │
│   │  - calculateShortestPath: A* algorithm implementation │  │
│   │  - findNearestShelters: Query API for nearest         │  │
│   │  - Handle path visualization on map                   │  │
│   │                                                       │  │
│   │ starsLayer.ts - Custom Visualization Layer            │  │
│   │  - Add custom styling and effects to map              │  │
│   │                                                       │  │
│   │ types/ - TypeScript Type Definitions                  │  │
│   │  - maplibre-gl-augmentations.d.ts: Extended types     │  │
│   └───────────────────────────────────────────────────────┘  │
└──────────────────────┬───────────────────────────────────────┘
                       │ HTTP REST API
┌──────────────────────▼───────────────────────────────────────┐
│                  Backend (Flask/Python)                      │
│   ┌───────────────────────────────────────────────────────┐  │
│   │  API Endpoints:                                       │  │
│   │  - /api/fylke/{id} - Get shelters by county           │  │
│   │  - /api/nearest-shelters - Find k-nearest shelters    │  │
│   │  - /api/wms-proxy - mem/disk cache for WMS raster     │  │
│   │  - /api/nvdb/roads - Query road network data          │  │
│   └───────────────────────────────────────────────────────┘  │
└──────────────────────┬───────────────────────────────────────┘
                       │ SQL Queries & Stored Procedures
┌──────────────────────▼───────────────────────────────────────┐
│             PostgreSQL + PostGIS Database                    │
│   ┌───────────────────────────────────────────────────────┐  │
│   │  Tables:                                              │  │
│   │  - shelters                                           │  │
│   │    - Emergency shelter locations                      │  │
│   │  - nvdb_roads                                         │  │
│   │    - Road network graph                               │  │
│   │    - Compressed using TOAST                           │  │
│   │  - fylker                                             │  │
│   │    - County administrative boundaries                 │  │
│   │                                                       │  │
│   │  Spatial Indexes:                                     │  │
│   │  - GiST/BRIN indexes on geometry columns              │  │
│   │                                                       │  │
│   │  Stored Functions (in sp.sql):                        │  │
│   │  - get_shelters_within_fylke: Fetch shelters by id    │  │
│   │  - get_k_nearest_shelters: K-NN spatial search        │  │
│   │  - get_nvdb_roads_geojson: Query road network         │  │
│   │  - build_geojson_feature: Utility for GeoJSON format  │  │
│   │  - build_geojson_collection: Aggregate GeoJSON data   │  │
│   └───────────────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────────────┘
```

**Data Flow:**
1. User requests current location → Frontend sends lat/lng to backend
2. Backend queries nearest shelters using k-NN spatial queries
3. Backend calculates shortest path using A* algorithm on road network
4. Results returned as GeoJSON to frontend
5. Frontend visualizes path and shelter locations on interactive map

# 2. Deliverable 1 - Webutvikling, GIS, Kartografi

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

# 3. Deliverable 2 - GIScience og Romling Analyse
## 1. Section A

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
        --GEOJSON FeatureCollection of road, removed for brevity
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

### 4. User Interface

**Overview**

The user interface is an interactive map where users can find the nearest shelter
by clicking a button. The shortest path to a shelter is calculated and displayed..

#### Finding Shelter
<img width="498" height="74" alt="image" src="https://github.com/user-attachments/assets/4f378327-db70-4119-8899-38e18f29b366" />

- User clicks the "Find Nearest Shelter" button on the map interface
- A loading animation is displayed while the application runs the calculation
    - Especially useful when fetching road graph from the database


#### Path Display
<img width="1500" height="1191" alt="image" src="https://github.com/user-attachments/assets/46b55aec-b765-4549-959b-9003e17b3989" />

- The shortest path is displayed as a blue line on the map
- The map is automatically fitted to the bounds of the path
- Information about the shelter is displayed


### 5. Further Improvements

- Routing function does not care about the concept of traffic laws
- It doesn't care about the concept of road sizes
- Use OSRM instead of own implementation
- Make UI look nicer

## 6. Setup Instructions

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

**Status**: Active Development | **Last Updated**: March 2026

> [!IMPORTANT]
> <details>
> <summary style="font-size: 14px; font-weight: bold">Important Image</summary>
>
> ![Jork IT](https://media1.tenor.com/m/grh1asJHzg4AAAAC/freaky.gif)
>
> </details>
