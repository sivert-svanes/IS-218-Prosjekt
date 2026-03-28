# ShelterLog – Emergency Shelter Routing System

## 1. Project Overview

**ShelterLog** is an interactive map application that locates public emergency shelters and calculates optimal routes to the nearest shelter based on your current location. The system integrates real-time geospatial data with pathfinding algorithms to provide users with quick access to critical shelter resources during emergencies.

## 2. Demo

[System demonstration](https://github.com/user-attachments/assets/8ae4a56b-81f2-4691-b293-9cc92c3a3474)

## 3. Technical Stack

### Frontend
| Component | Version |
|-----------|---------|
| TypeScript | ^4.9.5 |
| MapLibre GL | ^4.7.1 |
| Node.js | Latest LTS |

### Backend
| Component | Version |
|-----------|---------|
| Python | 3.10+ |
| Flask | ^3.1.3 |
| SQLAlchemy | ^2.0.46 |
| GeoAlchemy2 | ^0.18.1 |

### Database
| Component | Version |
|-----------|---------|
| PostgreSQL | 15+ |
| PostGIS | 3.3+ |

## 4. Data Catalog

| Dataset             | Source                                                                                                                  | Format  | Processing                                                     |
|---------------------|-------------------------------------------------------------------------------------------------------------------------|---------|----------------------------------------------------------------|
| Emergency Shelters  | [GeoNorge](https://kartkatalog.geonorge.no/metadata/brannstasjoner/0ccce81d-a72e-46ca-8bd9-57b362376485)                | GML     | Converted to PostGIS geometry, indexed for spatial queries     |
| Road Network (NVDB) | [Statens Vegvesen](https://www.vegvesen.no/)                                                                            | CSV     | Imported as PostGIS geometry with spatial indexing for routing |
| County Boundaries   | [GeoNorge](https://kartkatalog.geonorge.no/metadata/administrative-enheter-fylker/6093c8a8-fa80-11e6-bc64-92361f002671) | GeoJSON | Converted to PostGIS polygons for administrative filtering     |
| Map Style           | [OpenMapTiles](https://raw.githubusercontent.com/openmaptiles/positron-gl-style/refs/heads/master/style.json)           | JSON    | Applied globe projection and custom styling                    |

## 5. Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                Frontend (TypeScript/MapLibre)               │
│   ┌──────────────────────────────────────────────────────┐  │
│   │  Interactive Map Display & User Interaction Layer    │  │
│   │  - Geolocation & Real-time Position Tracking         │  │
│   │  - Shortest Path Visualization                       │  │
│   │  - Shelter Layer & County Filtering                  │  │
│   └──────────────────────────────────────────────────────┘  │
└──────────────────────┬──────────────────────────────────────┘
                       │ HTTP REST API
┌──────────────────────▼──────────────────────────────────────┐
│                 Backend (Flask/Python)                      │
│   ┌──────────────────────────────────────────────────────┐  │
│   │  API Endpoints:                                      │  │
│   │  - /api/fylke/{id} - Get shelters by county          │  │
│   │  - /api/nearest-shelters - Find k-nearest shelters   │  │
│   │  - /api/shortest-path - Calculate optimal route      │  │
│   │  - /api/nvdb/roads - Query road network data         │  │
│   └──────────────────────────────────────────────────────┘  │
└──────────────────────┬──────────────────────────────────────┘
                       │ SQL Queries & Stored Procedures
┌──────────────────────▼──────────────────────────────────────┐
│            PostgreSQL + PostGIS Database                    │
│   ┌──────────────────────────────────────────────────────┐  │
│   │  Tables:                                             │  │
│   │  - shelters (emergency shelter locations)            │  │
│   │  - nvdb_roads (road network geometry)                │  │
│   │  - fylker (county administrative boundaries)         │  │
│   │                                                      │  │
│   │  Spatial Indexes:                                    │  │
│   │  - GiST/BRIN indexes on geometry columns             │  │
│   │  - Stored Functions for spatial calculations         │  │
│   └──────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
```

**Data Flow:**
1. User requests current location → Frontend sends lat/lng to backend
2. Backend queries nearest shelters using k-NN spatial queries
3. Backend calculates shortest path using A* algorithm on road network
4. Results returned as GeoJSON to frontend
5. Frontend visualizes path and shelter locations on interactive map

# 2. Deliverable 1 - Reflection and Future Improvements

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