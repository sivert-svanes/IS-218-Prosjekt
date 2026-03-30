import type * as MaplibreGL from "maplibre-gl";
declare global {
  interface Window {
    // The global injected by the CDN; optional because it may not be present in some environments
    maplibregl?: typeof MaplibreGL;
    // Exposed for debugging
    map?: MaplibreGL.Map;
  }
}

const maplibregl = window.maplibregl;
const layersToggle = document.getElementById('layers-toggle');
const layersMenu   = document.getElementById('layers-menu');
const stylesToggle = document.getElementById('styles-toggle');
const stylesMenu   = document.getElementById('styles-menu');

const WMS_PROXY = '/api/wms-proxy';
const DSB_WMS_BASE_URL = 'https://ogc.dsb.no/wms.ashx';
const GEONORGE_GRUNNKART_BASE_URL = 'https://wms.geonorge.no/skwms1/wms.norges_grunnkart';

// Tracks visible layers and active dropdowns
const layerCheckboxes = new Map<string, HTMLInputElement>();
const styleLayers = new Set<string>();

function createShelterPopup(map: MaplibreGL.Map, feature: GeoJSON.Feature, lngLat?: { lng: number; lat: number }): void {
  const coords = (feature.geometry as GeoJSON.Point).coordinates.slice() as [number, number];
  const props = feature.properties || {} as Record<string, string>;
  const fid = props.fid || '';

  const html = `
    <div id="s_${fid}" style="font-family: sans-serif; max-width: 260px;">
      <h3 style="margin: 0 0 6px 0; font-size: 14px;">Tilfluktsrom - ${props.romnr || 'Ukjent adresse'}</h3>
      ${props.plasser ? `<p style="margin: 2px 0;"><strong>Kapasitet:</strong> ${props.plasser} personer</p>` : ''}
      ${props.adresse ? `<p style="margin: 2px 0;"><strong>Adresse:</strong> ${props.adresse}</p>` : ''}
      <p style="margin: 2px 0;"><strong>Koordinater:</strong> ${coords[1].toFixed(6)}, ${coords[0].toFixed(6)}</p>
    </div>`;

  // Handle date line wrapping if needed
  if (lngLat) {
    while (Math.abs(lngLat.lng - coords[0]) > 180) {
      coords[0] += lngLat.lng > coords[0] ? 360 : -360;
    }
  }

  if (maplibregl) {
    new maplibregl.Popup({ offset: 10 }).setLngLat(coords).setHTML(html).addTo(map);
  }
}

// Geonorge Vann og vassdrag layers
// Layer names sourced from GetCapabilities: wms.norges_grunnkart
const GEONORGE_VANN_LAYERS: { name: string; title: string }[] = [
  { name: 'Vann',     title: 'Vannflater' },
  { name: 'Vassdrag', title: 'Vassdrag'   },
];

const GEONORGE_FKB_VEI_LAYERS = [
  'fkb_veg',
  'fkb_vegavgrensning',
  'fkb_vegavgrensning_sub',
  'fkb_bru',
  'fkb_vegbru',
  'fkb_vegavgrensningbru',
  'fkb_bane',
  'fkb_baneitunnel',
  'fkb_lufthavn',
].join(',');

const DSB_WMS_LAYERS: { name: string; title: string }[] = [
  { name: 'layer_444', title: 'Nødnett dekning håndholdt' },
  { name: 'layer_443', title: 'Nødnett dekning kjøretøymontert' },
];

// Helper function to close both dropdowns
function closeAllDropdowns() {
  layersMenu?.classList.remove('open');
  stylesMenu?.classList.remove('open');
  overlay?.classList.remove('dropdown-open');
}

// Helper function to open a specific dropdown
function openDropdown(menu: HTMLElement | null, toggle: HTMLElement | null) {
  if (!menu || !overlay) return;

  // Close the other menu
  if (menu === layersMenu) {
    stylesMenu?.classList.remove('open');
  } else {
    layersMenu?.classList.remove('open');
  }

  // Open the selected menu
  menu.classList.add('open');
  overlay.classList.add('dropdown-open');

  // Align dropdown to span the full overlay width
  const overlayRect = overlay.getBoundingClientRect();
  menu.style.top = overlayRect.bottom + 'px';
  menu.style.left = overlayRect.left + 'px';
  menu.style.width = overlayRect.width + 'px';
}

// Open / close the dropdown when clicking the toggle button
const overlay = document.querySelector('.map-overlay') as HTMLElement | null;
layersToggle?.addEventListener('click', (e) => {
  e.stopPropagation();
  const isOpen = layersMenu?.classList.contains('open');
  closeAllDropdowns();
  if (!isOpen) {
    openDropdown(layersMenu, layersToggle);
  }
});

document.addEventListener('click', () => {
  closeAllDropdowns();
});

// Prevent clicks inside the menu from closing it
layersMenu?.addEventListener('click', (e) => e.stopPropagation());

// Open / close the styles dropdown when clicking the toggle button
stylesToggle?.addEventListener('click', (e) => {
  e.stopPropagation();
  const isOpen = stylesMenu?.classList.contains('open');
  closeAllDropdowns();
  if (!isOpen) {
    openDropdown(stylesMenu, stylesToggle);
  }
});

// Prevent clicks inside the styles menu from closing it
stylesMenu?.addEventListener('click', (e) => e.stopPropagation());

/**
 * Register a map layer in the Layers dropdown so the user can toggle it.
 * @param layerId The MapLibre layer id to toggle visibility for.
 * @param label Human-readable label shown in the menu.
 * @param visible Whether the layer starts visible (default true).
 * @param map The map to add the layer to
 */
function registerLayer(layerId: string, label: string, visible: boolean, map: MaplibreGL.Map) {
  if (!layersMenu) return;

  // Remove the "no layers" placeholder if present
  const empty = layersMenu.querySelector('.dropdown-empty');
  if (empty) empty.remove();

  const item = document.createElement('label');
  item.className = 'dropdown-item prevent-select';

  const cb = document.createElement('input');
  cb.type = 'checkbox';
  cb.checked = visible;

  cb.addEventListener('change', () => {
    map.setLayoutProperty(layerId, 'visibility', cb.checked ? 'visible' : 'none');
  });

  const span = document.createElement('span');
  span.textContent = label;

  item.appendChild(cb);
  item.appendChild(span);
  layersMenu.appendChild(item);

  layerCheckboxes.set(layerId, cb);
}

/**
 * Register a style layer in the Layers dropdown so the user can toggle it.
 * Only layers created by registerStyle() should use this function.
 * @param styleId The style id (as used in registerStyle)
 * @param label Human-readable label shown in the menu
 * @param visible Whether the layer starts visible (default false)
 * @param map The map instance
 */
export function registerStyleLayer(styleId: string, label: string, visible: boolean, map: MaplibreGL.Map): void {
  const layerId = `${styleId}-layer`;

  styleLayers.add(layerId);
  registerLayer(layerId, label, visible, map);
}

/**
 * Register a style layer in the Styles dropdown menu so the user can toggle it.
 * @param styleId The style id (as used in registerStyle)
 * @param label Human-readable label shown in the menu
 * @param visible Whether the layer starts visible (default false)
 * @param map The map instance
 */
export function registerStyleInMenu(styleId: string, label: string, visible: boolean, map: MaplibreGL.Map): void {
  if (!stylesMenu) return;

  // Remove the "no styles" placeholder if present
  const empty = stylesMenu.querySelector('.dropdown-empty');
  if (empty) empty.remove();

  const layerId = `${styleId}-layer`;

  const item = document.createElement('label');
  item.className = 'dropdown-item prevent-select';

  const cb = document.createElement('input');
  cb.type = 'checkbox';
  cb.checked = visible;

  cb.addEventListener('change', () => {
    if (map.getLayer(layerId)) {
      map.setLayoutProperty(layerId, 'visibility', cb.checked ? 'visible' : 'none');
    }
  });

  const span = document.createElement('span');
  span.textContent = label;

  item.appendChild(cb);
  item.appendChild(span);
  stylesMenu.appendChild(item);
}

interface WmsRasterLayerConfig {
  sourceId: string;
  layerId: string;
  label: string;
  tileUrl: string;
  opacity?: number;
}

/**
 * Generic function to add WMS layers from a configuration array
 * @param map The MapLibre map instance
 * @param layers Array of layer configurations with name and title
 * @param configBuilder Function that builds the tile URL and layer config from a layer
 * @param visible Whether the layers start visible
 */
function addWmsLayers<T extends { name: string; title: string }>(
  map: MaplibreGL.Map,
  layers: T[],
  configBuilder: (layer: T) => WmsRasterLayerConfig,
  visible: boolean = false
): void {
  const visibility = visible ? 'visible' : 'none';

  for (const layer of layers) {
    const config = configBuilder(layer);
    const { sourceId, layerId, label, tileUrl, opacity = 0.85 } = config;

    map.addSource(sourceId, {
      type: 'raster',
      tiles: [tileUrl],
      tileSize: 256,
    });

    map.addLayer({
      id: layerId,
      type: 'raster',
      source: sourceId,
      paint: { 'raster-opacity': opacity },
      layout: { visibility },
    });

    registerLayer(layerId, label, visible, map);
  }
}

/**
 * Wrapper function to add the DSB WMS layers to the map
 */
export function AddDSBWmsLayers(map: MaplibreGL.Map, visible: boolean = false): void {
  addWmsLayers(
    map,
    DSB_WMS_LAYERS,
    (layer) => ({
      sourceId: `dsb-wms-${layer.name}`,
      layerId: `dsb-wms-layer-${layer.name}`,
      label: `DSB: ${layer.title}`,
      tileUrl:
        `${WMS_PROXY}/5?url=${encodeURIComponent(DSB_WMS_BASE_URL)}&SERVICE=WMS&VERSION=1.3.0&REQUEST=GetMap` +
        `&LAYERS=${layer.name}&STYLES=en` +
        `&FORMAT=image/png&TRANSPARENT=true` +
        `&CRS=EPSG:3857` +
        `&BBOX={bbox-epsg-3857}&WIDTH=256&HEIGHT=256`,
      opacity: 0.85,
    }),
    visible
  );
}

/**
 * Wrapper function to add the Geonorge Vann og Vassdrag WMS layers to the map
 */
export function AddVannOgVassdragLayers(map: MaplibreGL.Map, visible: boolean = false): void {
  addWmsLayers(
    map,
    GEONORGE_VANN_LAYERS,
    (layer) => ({
      sourceId: `geonorge-vann-${layer.name.toLowerCase()}`,
      layerId: `geonorge-vann-layer-${layer.name.toLowerCase()}`,
      label: `Vann og vassdrag: ${layer.title}`,
      tileUrl:
        `${WMS_PROXY}/5?url=${encodeURIComponent(GEONORGE_GRUNNKART_BASE_URL)}&SERVICE=WMS&VERSION=1.3.0&REQUEST=GetMap` +
        `&LAYERS=${layer.name}&STYLES=` +
        `&FORMAT=image/png&TRANSPARENT=true` +
        `&CRS=EPSG:3857` +
        `&BBOX={bbox-epsg-3857}&WIDTH=256&HEIGHT=256`,
      opacity: 0.85,
    }),
    visible
  );
}

/**
 * Wrapper function to add the Geonorge FKB Vei WMS layer to the map
 */
export function AddFKBVeiLayer(map: MaplibreGL.Map, visible: boolean = false): void {
  addWmsLayers(
    map,
    [{
      name: 'fkb',
      title: 'FKB Vei',
    }],
    () => ({
      sourceId: 'geonorge-fkb-vei',
      layerId: 'geonorge-fkb-vei-layer',
      label: 'FKB Vei',
      tileUrl:
        `${WMS_PROXY}/5?url=${encodeURIComponent(GEONORGE_GRUNNKART_BASE_URL)}&SERVICE=WMS&VERSION=1.3.0&REQUEST=GetMap` +
        `&LAYERS=${encodeURIComponent(GEONORGE_FKB_VEI_LAYERS)}&STYLES=` +
        `&FORMAT=image/png&TRANSPARENT=true` +
        `&CRS=EPSG:3857` +
        `&BBOX={bbox-epsg-3857}&WIDTH=256&HEIGHT=256`,
      opacity: 0.9,
    }),
    visible
  );
}

/**
 * Fetches shelters from the API and adds a map layer for each county.
 * @param map The map the layers are added to
 * @param fylkeIds The ids of the counties to request
 * @param visible Controls if the layer is displayed once it's been loaded
 */
export async function AddShelterLayerGeospatial(map: MaplibreGL.Map, fylkeIds: number[], visible: boolean = false): Promise<void> {
  const layerVisibility = visible ? 'visible' : 'none';

  for (const fylkeId of fylkeIds) {
    try {
      const res = await fetch(`/api/fylke/${fylkeId}`);
      const geojson = await res.json();

      const sourceId = `shelters-fylke-${fylkeId}`;
      const layerId  = `shelters-circle-${fylkeId}`;
      const fylkeNavn = geojson.fylke_navn || `Fylke ${fylkeId}`;

      map.addSource(sourceId, { type: 'geojson', data: geojson });

      map.addLayer({
        id: layerId,
        type: 'circle',
        source: sourceId,
        paint: {
          'circle-radius': 6,
          'circle-color': '#3498db',
          'circle-stroke-width': 1,
          'circle-stroke-color': '#ffffff',
        },
        layout: { visibility: layerVisibility },
      });

      registerLayer(layerId, `Tilfluktsrom - ${fylkeNavn}`, visible, map);

      map.on('click', layerId, (e) => {
        if (!e.features || e.features.length === 0) return;
        const feature = e.features[0];
        createShelterPopup(map, feature, e.lngLat);
      });

      map.on('mouseenter', layerId, () => { map.getCanvas().style.cursor = 'pointer'; });
      map.on('mouseleave', layerId, () => { map.getCanvas().style.cursor = ''; });

      await new Promise(resolve => setTimeout(resolve, 100));

    } catch (err) {
      console.error(`Failed to load shelters for fylke ${fylkeId}:`, err);
    }
  }
}

function calculateBounds(coordinates: [number, number][]): { minLng: number; maxLng: number; minLat: number; maxLat: number } {
  let minLng = coordinates[0][0];
  let maxLng = coordinates[0][0];
  let minLat = coordinates[0][1];
  let maxLat = coordinates[0][1];

  for (const [lng, lat] of coordinates) {
    minLng = Math.min(minLng, lng);
    maxLng = Math.max(maxLng, lng);
    minLat = Math.min(minLat, lat);
    maxLat = Math.max(maxLat, lat);
  }

  return { minLng, maxLng, minLat, maxLat };
}

/**
 * Adds the shortest path layer to the map with a green line. Removes any existing shortest path layer/source first.
 * Automatically fits the map bounds to show the entire path. Enables the shelter layer for the destination county.
 * @param map The MapLibre map instance
 * @param coordinates Array of [lng, lat] coordinates forming the path
 * @param destinationShelterFylkeId The fylke ID where the shelter is located (optional)
 * @param shelterFeature The shelter feature to display popup for (optional)
 */
interface ShelterFeatureProperties {
  fylkeId: number;
  [key: string]: unknown;
}

type ShelterFeature = GeoJSON.Feature<GeoJSON.Point, ShelterFeatureProperties>;
type ShelterFylkeId = ShelterFeatureProperties['fylkeId'];

export function AddShortestPathLayer(
  map: MaplibreGL.Map,
  coordinates: [number, number][],
  destinationShelterFylkeId?: ShelterFylkeId,
  shelterFeature?: ShelterFeature
): void {
  const sourceId = 'shortest-path-source';
  const layerId = 'shortest-path-layer';

  if (map.getLayer(layerId)) map.removeLayer(layerId);
  if (map.getSource(sourceId)) map.removeSource(sourceId);

  map.addSource(sourceId, {
    type: 'geojson',
    data: {
      type: 'FeatureCollection',
      features: [{ type: 'Feature', geometry: { type: 'LineString', coordinates }, properties: {} }]
    }
  });

  map.addLayer({
    id: layerId,
    type: 'line',
    source: sourceId,
    paint: { 'line-color': '#0378be', 'line-width': 4, 'line-opacity': 0.9 },
    layout: { 'line-join': 'round', 'line-cap': 'round' }
  });

  const bounds = calculateBounds(coordinates);
  const camera = map.cameraForBounds(
    [[bounds.minLng, bounds.minLat], [bounds.maxLng, bounds.maxLat]],
    { padding: 100 }
  );

  map.once('render', () => {
    map.flyTo({
        center: camera?.center ?? [(bounds.minLng + bounds.maxLng) / 2, (bounds.minLat + bounds.maxLat) / 2],
      zoom: camera?.zoom ?? 12,
      bearing: camera?.bearing ?? map.getBearing(),
      duration: 1500,
      essential: true
    });

    if (destinationShelterFylkeId && shelterFeature?.geometry.type === 'Point') {
      const shelterLayerId = `shelters-circle-${destinationShelterFylkeId}`;

      if (map.getLayer(shelterLayerId)) {
        map.setLayoutProperty(shelterLayerId, 'visibility', 'visible');

        const cb = layerCheckboxes.get(shelterLayerId);
        if (cb) cb.checked = true;

        try {
          createShelterPopup(map, shelterFeature);
        } catch (err) {
          console.error('Error triggering popup:', err);
        }
      }
    }
  });

  const btn = document.getElementById('clear-path-btn');
  if (btn) btn.style.display = 'flex';
}

/**
 * Removes the shortest path layer and source from the map.
 * @param map The MapLibre map instance
 */
export function ClearShortestPathLayer(map: MaplibreGL.Map): void {
  const sourceId = 'shortest-path-source';
  const layerId = 'shortest-path-layer';

  if (map.getLayer(layerId)) map.removeLayer(layerId);
  if (map.getSource(sourceId)) map.removeSource(sourceId);

  const btn = document.getElementById('clear-path-btn');
  if (btn) btn.style.display = 'none';
}

/**
 * Checks if a layer is a style layer (created by registerStyle)
 * @param layerId The layer ID to check
 * @returns true if the layer is a style layer
 */
export function isStyleLayer(layerId: string): boolean {
  return styleLayers.has(layerId);
}

/**
 * Gets all registered style layers
 * @returns Array of style layer IDs
 */
export function getStyleLayers(): string[] {
  return Array.from(styleLayers);
}