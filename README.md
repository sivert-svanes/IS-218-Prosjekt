# ShelterLog – Emergency Shelter Routing System

## 1. Project Overview

**ShelterLog** is an interactive map application that locates public emergency shelters and calculates optimal routes to the nearest shelter based on your current location. The system integrates real-time geospatial data with pathfinding algorithms to provide users with quick access to critical shelter resources during emergencies.

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

## 2. SECTION B

### 1. Dynamic SQL



### 2. ST-functions

### 3. User Interface


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