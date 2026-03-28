# IS-218-Prosjekt

## 0. Introduction – ShelterLog

Our goal is to display public shelters and their current supplies on the map. The system will recognize locations with low supply
and provide routes to get supplies, accounting for threats.

## 1. Demo

[Totally an issue](https://github.com/user-attachments/assets/8ae4a56b-81f2-4691-b293-9cc92c3a3474)

## 2. Dependencies

- NodeJS
  - Typescript | ^4.9.5
  - MaplibreGL-gl | ^4.7.1
- Miniconda
  - Flask | ^3.1.3
  - SQLAlchemy | ^2.0.46
  - GeoAlchemy2 | ^0.18.1

## 3. Setup

 1. Clone repo
   ```powershell
    git clone https://github.com/sivert-svanes/IS-218-Prosjekt.git
   ```

> [!IMPORTANT]
> <details>
> <summary style="font-size: 14px; font-weight: bold">1. Using build.py </summary>
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
> <summary style="font-size: 14px; font-weight: bold">2. Manual setup </summary>
>
>
> 1. Compile typescript
>     1. CD to frontend folder
>         ```powershell
>         cd App\frontend
>        ```
>     2. Install dependencies
>         ```powershell
>         npm install
>        ```
>     3. Compile typescript
>         ```powershell
>        npm run build
>        ```
> 2. Setup python environment
>    1. CD root folder
>    2. Setup virtual env
>       1. Create virtual env
>          ```powershell
>          py -3 -m venv .venv
>          ```
>       2. Activate virtual env
>            ```powershell
>            .venv\Scripts\activate
>            ```
>     3. Install dependencies
>         1. Install Flask
>               ```powershell
>               pip install Flask
>               ```
> 3. Setup envorinment variables
>     1. In the root folder create a .env file, e.g.:
>         ```bash
>         touch .env
>         ```
>         ```powershell
>         echo > .env
>         ```
>     2. Add the following line to the .env file
>         ```bash
>         DATABASE_URL=[DATABASECONNECTIONSTRING]
>         ```
>        
> 4. Start server, from root folder
>   ```powershell
>     flask --app .\App\app.py run --debug
>     ```
> </details>

## 4. Data sources

| Description   | Format  | Modifications    | Source                                                                                                                  |
|---------------|---------|------------------|-------------------------------------------------------------------------------------------------------------------------|
| Map style     | JSON    | Globe projection | [OpenMapTiles](https://raw.githubusercontent.com/openmaptiles/positron-gl-style/refs/heads/master/style.json)           |
| Counties      | GeoJson | -> PostGIS       | [GeoNorge](https://kartkatalog.geonorge.no/metadata/administrative-enheter-fylker/6093c8a8-fa80-11e6-bc64-92361f002671) |
| Fire stations | GML     | -> PostGIS       | [GeoNorge](https://kartkatalog.geonorge.no/metadata/brannstasjoner/0ccce81d-a72e-46ca-8bd9-57b362376485)                |

## 5. Further additions

Currently, this is only this is only the base back-end of the project. Going forward, we will switch to a dateset that is relevant
to the goals of the project. Some code in Main.ts will need to be refactored, as it currently has too much responsibility.
We should also switch to using compiled plsql functions and procedures instead of raw SQL.

## 4. Arkitekturskisse
<img width="722" height="912" alt="Arkitekturskisse(2)" src="https://github.com/user-attachments/assets/10ae8510-8e08-4c8c-8987-cc83ab4ec3df" />


![Jork IT](https://media1.tenor.com/m/grh1asJHzg4AAAAC/freaky.gif)
