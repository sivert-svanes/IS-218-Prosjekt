# IS-218-Prosjekt
A verry nice little project to do stuff and be a good person. 

## 1. Dependencies

- NodeJS
  - Typescript
  - MaplibreGL-gl-js
- Flask
- SQLAlchemy
- GeoAlchemy2

## 2. Setup

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

## 3. Data sources

| Description  | Format  | Modifications    | Source                                                                                                                  |
|--------------|---------|------------------|-------------------------------------------------------------------------------------------------------------------------|
| Map style    | JSON    | Globe projection | [OpenMapTiles](https://raw.githubusercontent.com/openmaptiles/positron-gl-style/refs/heads/master/style.json)           |
| Counties     | GeoJson | -> PostGIS       | [GeoNorge](https://kartkatalog.geonorge.no/metadata/administrative-enheter-fylker/6093c8a8-fa80-11e6-bc64-92361f002671) |
| Firestations | GML     | -> PostGIS       | [GeoNorge](https://kartkatalog.geonorge.no/metadata/brannstasjoner/0ccce81d-a72e-46ca-8bd9-57b362376485)                |



    
    
- Prosjektnavn & TLDR: Hva løser dette kartet? (Maks 3 setninger).
- Demo av system: Video / gif som demonstrerer systemet 
- Teknisk Stack: Liste over biblioteker og versjoner. 
- Datakatalog: En tabell som beskriver: | Datasett | Kilde | Format | Bearbeiding  
- Arkitekturskisse: En enkel oversikt over hvordan data flyter fra kilde til kart. 
- Refleksjon: Diskuter kort forbedringspunkter ved din nåværende løsning (4-5 setninger / punkter) 

## 4. Arkitekturskisse
<img width="722" height="912" alt="Arkitekturskisse(2)" src="https://github.com/user-attachments/assets/10ae8510-8e08-4c8c-8987-cc83ab4ec3df" />


![Jork IT](https://media1.tenor.com/m/grh1asJHzg4AAAAC/freaky.gif)
