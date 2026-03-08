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

/**
 * Backend proxy base URL for WMS tiles.
 * Routing tiles through the backend allows future server-side raster analysis
 * (e.g. classification, overlay computations) without changing the frontend.
 * Pass the upstream WMS base URL via the `url` query parameter.
 */
const WMS_PROXY = '/api/wms-proxy';
const DSB_WMS_BASE_URL = 'https://ogc.dsb.no/wms.ashx';
const GEONORGE_GRUNNKART_BASE_URL = 'https://wms.geonorge.no/skwms1/wms.norges_grunnkart';

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

// Open / close the dropdown when clicking the toggle button
const overlay = document.querySelector('.map-overlay') as HTMLElement | null;
layersToggle?.addEventListener('click', (e) => {
  e.stopPropagation();
  layersMenu?.classList.toggle('open');
  overlay?.classList.toggle('dropdown-open');
  // Align dropdown to span the full overlay width
  if (layersMenu?.classList.contains('open') && overlay) {
    const overlayRect = overlay.getBoundingClientRect();
    layersMenu.style.top = overlayRect.bottom + 'px';
    layersMenu.style.left = overlayRect.left + 'px';
    layersMenu.style.width = overlayRect.width + 'px';
  }
});
document.addEventListener('click', () => {
  layersMenu?.classList.remove('open');
  overlay?.classList.remove('dropdown-open');
});
// Prevent clicks inside the menu from closing it
layersMenu?.addEventListener('click', (e) => e.stopPropagation());

/**
 * Register a map layer in the Layers dropdown so the user can toggle it.
 *
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
}

/**
 * Adds all DSB WMS layers to the map as individual raster layers,
 * each registered in the layers toggle dropdown.
 * @param map The MapLibre map instance to add layers to
 * @param visible Whether the layers start visible (default false)
 */
export function AddDSBWmsLayers(map: MaplibreGL.Map, visible: boolean = false): void {
  const visibility = visible ? 'visible' : 'none';

  for (const layer of DSB_WMS_LAYERS) {
    const sourceId = `dsb-wms-${layer.name}`;
    const layerId  = `dsb-wms-layer-${layer.name}`;

    const tileUrl =
      `${WMS_PROXY}?url=${encodeURIComponent(DSB_WMS_BASE_URL)}&SERVICE=WMS&VERSION=1.3.0&REQUEST=GetMap` +
      `&LAYERS=${layer.name}&STYLES=en` +
      `&FORMAT=image/png&TRANSPARENT=true` +
      `&CRS=EPSG:3857` +
      `&BBOX={bbox-epsg-3857}&WIDTH=256&HEIGHT=256`;

    map.addSource(sourceId, {
      type: 'raster',
      tiles: [tileUrl],
      tileSize: 256,
    });

    map.addLayer({
      id: layerId,
      type: 'raster',
      source: sourceId,
      paint: { 'raster-opacity': 0.85 },
      layout: { visibility },
    });

    registerLayer(layerId, `DSB: ${layer.title}`, visible, map);
  }
}

/**
 * Adds the Geonorge "Vann og vassdrag" WMS layers (Vannflater + Vassdrag)
 * to the map, routed through the backend proxy for caching and future
 * raster analysis.
 * @param map     The MapLibre map instance
 * @param visible Whether the layers start visible (default false)
 */
export function AddVannOgVassdragLayers(map: MaplibreGL.Map, visible: boolean = false): void {
  const visibility = visible ? 'visible' : 'none';

  for (const layer of GEONORGE_VANN_LAYERS) {
    const sourceId = `geonorge-vann-${layer.name.toLowerCase()}`;
    const layerId  = `geonorge-vann-layer-${layer.name.toLowerCase()}`;

    const tileUrl =
      `${WMS_PROXY}?url=${encodeURIComponent(GEONORGE_GRUNNKART_BASE_URL)}&SERVICE=WMS&VERSION=1.3.0&REQUEST=GetMap` +
      `&LAYERS=${layer.name}&STYLES=` +
      `&FORMAT=image/png&TRANSPARENT=true` +
      `&CRS=EPSG:3857` +
      `&BBOX={bbox-epsg-3857}&WIDTH=256&HEIGHT=256`;

    map.addSource(sourceId, {
      type: 'raster',
      tiles: [tileUrl],
      tileSize: 256,
    });

    map.addLayer({
      id: layerId,
      type: 'raster',
      source: sourceId,
      paint: { 'raster-opacity': 0.85 },
      layout: { visibility },
    });

    registerLayer(layerId, `Vann og vassdrag: ${layer.title}`, visible, map);
  }
}

/**
 * Adds a single combined raster layer built from all FKB layers inside
 * the "Vei" group of the Geonorge grunnkart WMS:
 * fkb_veg, fkb_vegavgrensning, fkb_vegavgrensning_sub, fkb_bru,
 * fkb_vegbru, fkb_vegavgrensningbru, fkb_bane, fkb_baneitunnel, fkb_lufthavn.
 *
 * All layers are passed as a comma-separated LAYERS value in a single WMS
 * request so the server composites them and the frontend handles one source.
 * @param map     The MapLibre map instance
 * @param visible Whether the layer starts visible (default false)
 */
export function AddFKBVeiLayer(map: MaplibreGL.Map, visible: boolean = false): void {
  const sourceId = 'geonorge-fkb-vei';
  const layerId  = 'geonorge-fkb-vei-layer';
  const visibility = visible ? 'visible' : 'none';

  const tileUrl =
    `${WMS_PROXY}?url=${encodeURIComponent(GEONORGE_GRUNNKART_BASE_URL)}&SERVICE=WMS&VERSION=1.3.0&REQUEST=GetMap` +
    `&LAYERS=${encodeURIComponent(GEONORGE_FKB_VEI_LAYERS)}&STYLES=` +
    `&FORMAT=image/png&TRANSPARENT=true` +
    `&CRS=EPSG:3857` +
    `&BBOX={bbox-epsg-3857}&WIDTH=256&HEIGHT=256`;

  map.addSource(sourceId, {
    type: 'raster',
    tiles: [tileUrl],
    tileSize: 256,
  });

  map.addLayer({
    id: layerId,
    type: 'raster',
    source: sourceId,
    paint: { 'raster-opacity': 0.9 },
    layout: { visibility },
  });

  registerLayer(layerId, 'FKB Vei', visible, map);
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
        const coords = (feature.geometry as GeoJSON.Point).coordinates.slice() as [number, number];
        const props = feature.properties || {} as Record<string, string>;

        const html = `
          <div style="font-family: sans-serif; max-width: 260px;">
            <h3 style="margin: 0 0 6px 0; font-size: 14px;">Tilfluktsrom - ${props.romnr || 'Ukjent adresse'}</h3>
            ${props.plasser ? `<p style="margin: 2px 0;"><strong>Kapasitet:</strong> ${props.plasser} personer</p>` : ''}
            ${props.adresse ? `<p style="margin: 2px 0;"><strong>Adresse:</strong> ${props.adresse}</p>` : ''}
            <p style="margin: 2px 0;"><strong>Koordinater:</strong> ${coords[1].toFixed(6)}, ${coords[0].toFixed(6)}</p>
          </div>`;

        while (Math.abs(e.lngLat.lng - coords[0]) > 180) {
          coords[0] += e.lngLat.lng > coords[0] ? 360 : -360;
        }

        if (maplibregl) {
          new maplibregl.Popup({ offset: 10 }).setLngLat(coords).setHTML(html).addTo(map);
        }
      });

      map.on('mouseenter', layerId, () => { map.getCanvas().style.cursor = 'pointer'; });
      map.on('mouseleave', layerId, () => { map.getCanvas().style.cursor = ''; });

      await new Promise(resolve => setTimeout(resolve, 100));

    } catch (err) {
      console.error(`Failed to load shelters for fylke ${fylkeId}:`, err);
    }
  }
}