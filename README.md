# IS-218-Prosjekt
A verry nice little project to do stuff and be a good person. 

## 1. Dependencies

- NodeJS
  - Typescript
  - MaplibreGL-gl-js
- Flask

## 2. Setup
1. Clone repo
   ```powershell
    git clone https://github.com/sivert-svanes/IS-218-Prosjekt.git
   ```
2. Compile typescript
    1. CD to frontend folder
        ```powershell
        cd App\frontend
       ```
    2. Install dependencies
        ```powershell
        npm install
       ```
    3. Compile typescript
        ```powershell
        npm run build
       ```
3. Setup python environment
   1. CD root folder
   2. Setup virtual env
      1. Create virtual env
         ```powershell
         py -3 -m venv .venv
         ```
      2. Activate virtual env
           ```powershell
           .venv\Scripts\activate
           ```
    3. Install dependencies
        1. Install Flask
              ```powershell
              pip install Flask
              ```
4. Start server, from root folder
   ```powershell
    flask --app .\App\app.py run --debug
    ```
    
    
- Prosjektnavn & TLDR: Hva løser dette kartet? (Maks 3 setninger).
- Demo av system: Video / gif som demonstrerer systemet 
- Teknisk Stack: Liste over biblioteker og versjoner. 
- Datakatalog: En tabell som beskriver: | Datasett | Kilde | Format | Bearbeiding  
- Arkitekturskisse: En enkel oversikt over hvordan data flyter fra kilde til kart. 
- Refleksjon: Diskuter kort forbedringspunkter ved din nåværende løsning (4-5 setninger / punkter) 

![Jork IT](https://media1.tenor.com/m/grh1asJHzg4AAAAC/freaky.gif)
