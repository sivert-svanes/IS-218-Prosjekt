import type * as MaplibreGL from "maplibre-gl";

interface ShelterFeature extends GeoJSON.Feature<GeoJSON.Point> {
    properties: {
        fid: number;
        adresse?: string;
        plasser?: number;
        romnr?: string;
        fylke_id?: number;
        [key: string]: any;
    }
}

let mapInstance: MaplibreGL.Map;
let allShelters: ShelterFeature[] = [];
const registeredFylker = new Set<number>();

/**
 * Registers shelters for a specific county. Can be called as data is loaded.
 */
export function registerShelters(fylkeId: number, geojson: any): void {
    if (registeredFylker.has(fylkeId)) return;
    
    if (geojson && geojson.features && Array.isArray(geojson.features)) {
        const fylkeNavn = geojson.fylke_navn || `Fylke ${fylkeId}`;
        const features = geojson.features.map((f: any) => ({
            ...f,
            properties: {
                ...f.properties,
                fylke_id: fylkeId,
                fylke_navn: fylkeNavn
            }
        }));
        allShelters = allShelters.concat(features);
        registeredFylker.add(fylkeId);
        console.log(`Registered ${features.length} shelters for fylke ${fylkeId} (${fylkeNavn}). Total: ${allShelters.length}`);
    }
}

/**
 * Initialize search functionality
 * @param map The MapLibre map instance
 */
export function initSearch(map: MaplibreGL.Map): void {
    mapInstance = map;
    
    const searchPanel = document.getElementById('search-panel');
    const searchInput = document.getElementById('shelter-search-input') as HTMLInputElement;
    const fylkeFilter = document.getElementById('fylke-filter') as HTMLSelectElement;
    const resultsContainer = document.getElementById('search-results');
    const closeBtn = document.getElementById('close-search-panel');
    const toggleBtn = document.getElementById('search-toggle-btn');

    if (!searchPanel || !searchInput || !fylkeFilter || !resultsContainer || !closeBtn || !toggleBtn) return;

    // Populate fylke dropdown
    fetch('/api/fylker')
        .then(res => res.json())
        .then((fylker: any[]) => {
            // Keep "Alle fylker" as first option
            fylker.forEach((f: any) => {
                const option = document.createElement('option');
                option.value = f.id.toString();
                option.textContent = f.navn;
                fylkeFilter.appendChild(option);
            });
        })
        .catch(err => console.error('Error fetching fylker for search:', err));

    toggleBtn.addEventListener('click', () => {
        const isOpen = searchPanel.classList.toggle('open');
        if (isOpen) {
            searchInput.focus();
            loadAllSheltersFromMap();
            performSearch(searchInput.value, fylkeFilter.value, resultsContainer);
        }
    });

    closeBtn.addEventListener('click', () => {
        searchPanel.classList.remove('open');
    });

    searchInput.addEventListener('input', () => {
        performSearch(searchInput.value, fylkeFilter.value, resultsContainer);
    });

    fylkeFilter.addEventListener('change', () => {
        performSearch(searchInput.value, fylkeFilter.value, resultsContainer);
    });
}

function loadAllSheltersFromMap(): void {
    // If we already have shelters from registration, we don't necessarily need to reload from map
    // unless we suspect the map state has changed. For now, the registration approach is preferred.
    if (allShelters.length > 0) return;

    const style = mapInstance.getStyle();
    if (!style || !style.sources) return;

    for (const sourceId in style.sources) {
        if (sourceId.startsWith('shelters-fylke-')) {
            const source = mapInstance.getSource(sourceId) as any;
            if (!source) continue;

            let data = null;
            if (source._data) {
                data = source._data;
            } else if (typeof source.serialize === 'function') {
                const serialized = source.serialize();
                if (serialized && serialized.data) {
                    data = serialized.data;
                }
            }

            if (data && data.features && Array.isArray(data.features)) {
                const idMatch = sourceId.match(/(\d+)$/);
                const id = idMatch ? parseInt(idMatch[1]) : 0;
                const fylkeNavn = data.fylke_navn || `Fylke ${id}`;
                
                const features = data.features.map((f: any) => ({
                    ...f,
                    properties: {
                        ...f.properties,
                        fylke_id: id,
                        fylke_navn: fylkeNavn
                    }
                }));
                allShelters = allShelters.concat(features);
            }
        }
    }
    console.log(`Loaded ${allShelters.length} shelters from map sources.`);
}

function performSearch(query: string, fylkeId: string, container: HTMLElement): void {
    container.innerHTML = '';
    
    const searchTerms = query.toLowerCase().trim().split(/\s+/).filter(t => t.length > 0);
    
    const filtered = allShelters.filter(f => {
        // Filter by fylke if not "all"
        if (fylkeId !== 'all' && f.properties.fylke_id?.toString() !== fylkeId) {
            return false;
        }
        
        if (searchTerms.length === 0) return true;

        // Search in all properties as requested
        const searchText = Object.values(f.properties)
            .map(v => v === null || v === undefined ? '' : String(v))
            .join(' ')
            .toLowerCase();
        
        return searchTerms.every(term => searchText.includes(term));
    });

    // Sort by capacity (plasser) in descending order as requested
    filtered.sort((a, b) => (b.properties.plasser || 0) - (a.properties.plasser || 0));

    // Limit results for performance
    const displayLimit = 100;
    const toDisplay = filtered.slice(0, displayLimit);

    toDisplay.forEach(f => {
        const item = document.createElement('div');
        item.className = 'search-result-item';
        
        const title = f.properties.adresse || `ID: ${f.properties.fid}`;
        const detail = `ID: ${f.properties.fid} | Adresse: ${f.properties.adresse || 'Ukjent'}`;
        const capacity = `Kapasitet: ${f.properties.plasser || 'Ukjent'}`;
        const romnr = f.properties.romnr ? `<div class="search-result-detail">Romnr: ${f.properties.romnr}</div>` : '';
        const fylkeInfo = f.properties.fylke_navn ? `<div class="search-result-detail">${f.properties.fylke_navn}</div>` : '';

        item.innerHTML = `
            <div class="search-result-title">${title}</div>
            <div class="search-result-detail">${detail}</div>
            <div class="search-result-detail">${capacity}</div>
            ${romnr}
            ${fylkeInfo}
        `;

        item.addEventListener('click', () => {
            const coords = f.geometry.coordinates;
            mapInstance.flyTo({
                center: [coords[0], coords[1]],
                zoom: 17, // Zoomed in a bit more for clarity
                essential: true
            });
            
            // Open details modal
            if (window.openShelterDetailsModal) {
                window.openShelterDetailsModal(f.properties.fid, f);
            }
        });

        container.appendChild(item);
    });

    if (filtered.length === 0 && (query || fylkeId !== 'all')) {
        const noResults = document.createElement('div');
        noResults.style.color = '#c2c8ca';
        noResults.style.padding = '10px';
        noResults.textContent = 'Ingen treff';
        container.appendChild(noResults);
    }
}
