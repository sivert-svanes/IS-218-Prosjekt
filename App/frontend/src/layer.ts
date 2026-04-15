import type * as MaplibreGL from "maplibre-gl";
import {
  layerCheckboxes,
  registerLayer,
} from './layerControl.js';
import { WmsRasterLayerConfig, ShelterFeature, ShelterFylkeId, MapBounds } from './interfaces.js';

const maplibregl = window.maplibregl;

const WMS_PROXY = '/api/wms-proxy';
const DSB_WMS_BASE_URL = 'https://ogc.dsb.no/wms.ashx';
const GEONORGE_GRUNNKART_BASE_URL = 'https://wms.geonorge.no/skwms1/wms.norges_grunnkart';


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
// Layer configuration constants
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
 * Adds exclusion zones layer to the map and registers it with layer control.
 * @param map The MapLibre map instance
 * @param geojsonData The GeoJSON FeatureCollection with exclusion zones
 */
export function AddExclusionZonesLayer(map: MaplibreGL.Map, geojsonData: GeoJSON.FeatureCollection): void {
  const sourceId = 'exclusion-zones-source';
  const layerId = 'exclusion-zones-layer';
  const outlineLayerId = `${layerId}-line`;
  const labelSourceId = 'exclusion-zones-labels-source';
  const labelLayerId = 'exclusion-zones-labels-layer';

  // Remove existing layers and source if they exist
  if (map.getLayer(labelLayerId)) map.removeLayer(labelLayerId);
  if (map.getLayer(outlineLayerId)) map.removeLayer(outlineLayerId);
  if (map.getLayer(layerId)) map.removeLayer(layerId);
  if (map.getSource(labelSourceId)) map.removeSource(labelSourceId);
  if (map.getSource(sourceId)) map.removeSource(sourceId);

  enum ExclusionZoneType {
  'Flood Zone' = 1,
  'Radiation Hazard' = 2,
  'Biological Hazard' = 3,
  'Toxic Hazard' = 4,
  'Fire' = 5,
  'Ruins' = 6,
  'Active Warzone' = 7,
  'Low Air Quality' = 8
}


  // Add source with all exclusion zones
  map.addSource(sourceId, {
    type: 'geojson',
    data: geojsonData
  });

  // Create point features at the center of each polygon for labeling
  const labelPoints: GeoJSON.FeatureCollection = {
    type: 'FeatureCollection',
    features: geojsonData.features.map((feature) => {
      // Calculate the visual center (pole of inaccessibility) of the polygon
      const coords = (feature.geometry as GeoJSON.Polygon).coordinates[0];

      // Simple approach: find the centroid that is inside the polygon
      // For rectangular exclusion zones, this should work well
      const bounds = {
        minLng: Infinity,
        maxLng: -Infinity,
        minLat: Infinity,
        maxLat: -Infinity
      };

      for (const [lng, lat] of coords) {
        bounds.minLng = Math.min(bounds.minLng, lng);
        bounds.maxLng = Math.max(bounds.maxLng, lng);
        bounds.minLat = Math.min(bounds.minLat, lat);
        bounds.maxLat = Math.max(bounds.maxLat, lat);
      }

      // Center of bounding box (works well for rectangular polygons)
      const centroidLng = (bounds.minLng + bounds.maxLng) / 2;
      const centroidLat = (bounds.minLat + bounds.maxLat) / 2;

      return {
        type: 'Feature' as const,
        properties: {
          type: feature.properties?.type || 'Unknown'
        },
        geometry: {
          type: 'Point' as const,
          coordinates: [centroidLng, centroidLat]
        }
      };
    })
  };

  // Add source for label points
  map.addSource(labelSourceId, {
    type: 'geojson',
    data: labelPoints
  });

  // Add fill layer
  map.addLayer({
    id: layerId,
    type: 'fill',
    source: sourceId,
    paint: {
      'fill-color': '#ff0000',
      'fill-opacity': 0.3
    }
  });

  // Add line layer on top for visible outline
  map.addLayer({
    id: outlineLayerId,
    type: 'line',
    source: sourceId,
    paint: {
      'line-color': '#ff0000',
      'line-width': 2,
      'line-opacity': 0.8
    }
  });

  // Add text label layer using the point features (no tiling issues with points)
  // Build match expression from enum
  const typeMapping: any[] = ['match', ['get', 'type']];
  for (const [key, value] of Object.entries(ExclusionZoneType)) {
    if (!isNaN(Number(key))) continue; // Skip numeric keys
    typeMapping.push(Number(ExclusionZoneType[key as keyof typeof ExclusionZoneType]));
    typeMapping.push(key);
  }
  typeMapping.push('Unknown'); // Default value

  map.addLayer({
    id: labelLayerId,
    type: 'symbol',
    source: labelSourceId,
    minzoom: 6,
    layout: {
      'text-field': ['format', 'Exclusion Zone\n', {}, typeMapping as any, {}] as any,
      'text-size': [
        'interpolate',
        ['linear'],
        ['zoom'],
        5, 10,
        15, 14
      ],
      'text-anchor': 'center',
      'text-justify': 'center',
      'text-line-height': 1.2,
      'text-allow-overlap': false,
      'text-ignore-placement': false
    },
    paint: {
      'text-color': '#ffffff',
      'text-halo-color': '#ff0000',
      'text-halo-width': 1.5,
      'text-halo-blur': 0
    }
  });

  // Register only the fill layer, and sync outline and label visibility with it
  registerLayer(layerId, 'Exclusion Zones', true, map);

  // Sync the outline and label layer visibility with the fill layer
  const originalSetLayoutProperty = map.setLayoutProperty.bind(map);
  const syncVisibility = (layerIdToSync: string, visibility: string) => {
    if (layerIdToSync === layerId) {
      originalSetLayoutProperty(outlineLayerId, 'visibility', visibility);
      originalSetLayoutProperty(labelLayerId, 'visibility', visibility);
    }
  };

  // Override setLayoutProperty to sync visibility
  const originalMethod = map.setLayoutProperty;
  (map as any).setLayoutProperty = function(layerIdToOverride: string, name: string, value: any) {
    originalSetLayoutProperty(layerIdToOverride, name, value);
    if (name === 'visibility') {
      syncVisibility(layerIdToOverride, value);
    }
    return this;
  };
}
