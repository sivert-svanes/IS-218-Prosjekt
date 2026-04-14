import type * as MaplibreGL from "maplibre-gl";
import { AddShortestPathLayer, ClearShortestPathLayer } from "./layer.js";
import type { ShelterFeature } from "./interfaces.js";

const API_TIMEOUT_MS = 10000;
const ROUTE_CACHE = new Map<string, any>();
const REQUEST_DELAY_MS = 50;
let exclusionZoneInitialized = false;

const EXCLUSION_ZONE_GEOJSON: GeoJSON.FeatureCollection = {
  type: "FeatureCollection",
  features: [
    {
      type: "Feature",
      properties: {},
      geometry: {
        coordinates: [
            [
            [
              8.011526573080232,
              58.15312720437322
            ],
            [
              8.011934209922373,
              58.15762425550312
            ],
            [
              8.003188546760242,
              58.15756560212239
            ],
            [
              8.002595620443401,
              58.15312720437322
            ],
            [
              8.011526573080232,
              58.15312720437322
            ]
          ]
        ],
        type: "Polygon"
      }
    }
  ]
};

// Exclusion zone bounds [minLng, minLat, maxLng, maxLat, minElevation, maxElevation]
let exclusionZone: [number, number, number, number, number, number] | null = null;

export function setExclusionZone(bounds: [number, number, number, number, number, number]): void {
  exclusionZone = bounds;
}

export function initializeExclusionZoneLayer(map: MaplibreGL.Map): void {
  const sourceId = 'exclusion-zone-source';
  const layerId = 'exclusion-zone-layer';

  if (map.getLayer(layerId)) map.removeLayer(layerId);
  if (map.getSource(sourceId)) map.removeSource(sourceId);

  map.addSource(sourceId, {
    type: 'geojson',
    data: EXCLUSION_ZONE_GEOJSON
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

  // Add outline layer
  map.addLayer({
    id: `${layerId}-outline`,
    type: 'line',
    source: sourceId,
    paint: {
      'line-color': '#ff0000',
      'line-width': 2,
      'line-opacity': 0.8
    }
  });

  const coords = (EXCLUSION_ZONE_GEOJSON.features[0].geometry as GeoJSON.Polygon).coordinates[0];
  const lngs = coords.map(c => c[0]);
  const lats = coords.map(c => c[1]);
  const minLng = Math.min(...lngs);
  const maxLng = Math.max(...lngs);
  const minLat = Math.min(...lats);
  const maxLat = Math.max(...lats);

  // block tunnels and bridges
  const minElevation = -1000;
  const maxElevation = 10000;

  setExclusionZone([minLng, minLat, maxLng, maxLat, minElevation, maxElevation]);
}

async function delayForRateLimit(): Promise<void> {
  await new Promise(resolve => setTimeout(resolve, REQUEST_DELAY_MS));
}

async function findNearestShelters(lat: number, lng: number, k: number = 5): Promise<any[]> {
  try {
    const response = await fetch(`/api/nearest-shelters?lat=${lat}&lng=${lng}&k=${k}`);
    return response.ok ? (await response.json()).features || [] : [];
  } catch (err) {
    console.error('Failed to fetch nearest shelters:', err);
    return [];
  }
}

async function getRoute(userLng: number, userLat: number, shelterLng: number, shelterLat: number): Promise<any> {
  const cacheKey = `${userLng},${userLat};${shelterLng},${shelterLat}`;
  if (ROUTE_CACHE.has(cacheKey)) return ROUTE_CACHE.get(cacheKey);

  try {
    await delayForRateLimit();

    const requestBody: any = {
      locations: [
        { lat: userLat, lon: userLng },
        { lat: shelterLat, lon: shelterLng }
      ],
      costing: 'auto'
    };

    if (exclusionZone) {
      const [minLng, minLat, maxLng, maxLat] = exclusionZone;
      requestBody.exclude_polygons = [[[minLng, minLat], [maxLng, minLat], [maxLng, maxLat], [minLng, maxLat], [minLng, minLat]]];
    }

    const response = await Promise.race([
      fetch('/api/valhalla-route', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody)
      }),
      new Promise<Response>((_, reject) => setTimeout(() => reject(new Error('Timeout')), API_TIMEOUT_MS))
    ]) as Response;

    if (response?.ok) {
      const data = await response.json();
      const route = data.routes?.[0] || data.trip;
      if (route) {
        ROUTE_CACHE.set(cacheKey, route);
        return route;
      }
    }
  } catch (err) {
    console.error('Failed to fetch route:', err);
  }
  return null;
}

function decodePolyline6(encoded: string): [number, number][] {
  const coords: [number, number][] = [];
  let index = 0;
  let lat = 0;
  let lng = 0;

  const decodeValue = () => {
    let result = 0;
    let shift = 0;
    let byte: number;
    do {
      byte = encoded.charCodeAt(index++) - 63;
      result |= (byte & 0x1f) << shift;
      shift += 5;
      if (byte < 0x20) break;
    } while (true);
    return result & 1 ? ~(result >> 1) : result >> 1;
  };

  while (index < encoded.length) {
    lat += decodeValue();
    lng += decodeValue();
    coords.push([lng / 1e6, lat / 1e6]);
  }

  return coords;
}

export async function calculateAndDisplayPath(map: MaplibreGL.Map, lat: number, lng: number): Promise<void> {
  try {
    if (!exclusionZoneInitialized) {
      initializeExclusionZoneLayer(map);
      exclusionZoneInitialized = true;
    }

    const shelters = await findNearestShelters(lat, lng, 5);
    if (!shelters.length) return;

    // Fetch routes sequentially so we don't get rate limited
    const routeResults = [];
    for (const shelter of shelters) {
      const [shelterLng, shelterLat] = shelter.geometry.coordinates;
      const route = await getRoute(lng, lat, shelterLng, shelterLat);
      routeResults.push({ shelter, route, distance: route?.summary?.length || Infinity });
    }

    // Find shortest route
    const shortest = routeResults.reduce((best, current) =>
      current.route && current.distance < best.distance ? current : best,
      { route: null, distance: Infinity, shelter: null }
    );

    if (!shortest.route || !shortest.shelter) {
      console.warn('No valid routes found');
      return;
    }

    const shape = shortest.route.shape || shortest.route.legs?.[0]?.shape;
    if (!shape) return console.warn('No shape found in route');

    const pathCoords = decodePolyline6(shape);
    if (pathCoords.length < 2) return console.warn('Not enough coordinates:', pathCoords.length);

    const shelterFeature: ShelterFeature = shortest.shelter.type === 'Feature'
      ? (shortest.shelter as ShelterFeature)
      : { type: 'Feature', geometry: shortest.shelter.geometry as GeoJSON.Point, properties: shortest.shelter.properties || {} } as ShelterFeature;

    AddShortestPathLayer(map, pathCoords, shortest.shelter.properties?.fylke_id, shelterFeature);
  } catch (err) {
    console.error('Shortest path error:', err);
  }
}

export function clearPath(map: MaplibreGL.Map): void {
  ClearShortestPathLayer(map);
}