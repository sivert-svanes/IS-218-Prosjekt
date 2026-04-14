import type * as MaplibreGL from "maplibre-gl";
import { AddShortestPathLayer, ClearShortestPathLayer } from "./layer.js";
import type { ShelterFeature } from "./interfaces.js";

const API_TIMEOUT_MS = 5000;
const ROUTE_CACHE = new Map<string, any>();
const REQUEST_DELAY_MS = 300;
let lastRequestTime = 0;
let exclusionZoneInitialized = false;

// Hardcoded exclusion zone GeoJSON for testing
const EXCLUSION_ZONE_GEOJSON: GeoJSON.FeatureCollection = {
  type: "FeatureCollection",
  features: [
    {
      type: "Feature",
      properties: {},
      geometry: {
        coordinates: [
          [
            [8.002146669116485, 58.15867389469662],
            [8.002146669116485, 58.156220484299666],
            [8.013841355471442, 58.156220484299666],
            [8.013841355471442, 58.15867389469662],
            [8.002146669116485, 58.15867389469662]
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
  console.log('Exclusion zone set (with height):', bounds);
}

export function clearExclusionZone(): void {
  exclusionZone = null;
  console.log('Exclusion zone cleared');
}

function isPointInZone(lng: number, lat: number, elevation: number, zone: [number, number, number, number, number, number]): boolean {
  const [minLng, minLat, maxLng, maxLat, minElevation, maxElevation] = zone;
  // Add buffer to make zone bigger and catch points on edges
  const buffer = 0.0001;
  return lng >= (minLng - buffer) && lng <= (maxLng + buffer) &&
         lat >= (minLat - buffer) && lat <= (maxLat + buffer) &&
         elevation >= minElevation && elevation <= maxElevation;
}

function routePassesThroughZone(coords: [number, number][], zone: [number, number, number, number, number, number]): boolean {
  // Check if ANY point in the route is in the zone (assume elevation 0 for 2D coordinates)
  return coords.some(([lng, lat]) => isPointInZone(lng, lat, 0, zone));
}

export function initializeExclusionZoneLayer(map: MaplibreGL.Map): void {
  const sourceId = 'exclusion-zone-source';
  const layerId = 'exclusion-zone-layer';

  // Remove if already exists
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

  // Extract bounds and set exclusion zone with height
  const coords = (EXCLUSION_ZONE_GEOJSON.features[0].geometry as GeoJSON.Polygon).coordinates[0];
  const lngs = coords.map(c => c[0]);
  const lats = coords.map(c => c[1]);
  const minLng = Math.min(...lngs);
  const maxLng = Math.max(...lngs);
  const minLat = Math.min(...lats);
  const maxLat = Math.max(...lats);

  // Set elevation bounds: from ground level (-1000m) to very high (10000m) to block all routes including tunnels
  const minElevation = -1000;
  const maxElevation = 10000;

  setExclusionZone([minLng, minLat, maxLng, maxLat, minElevation, maxElevation]);
  console.log('Exclusion zone layer initialized with bounds:', [minLng, minLat, maxLng, maxLat, minElevation, maxElevation]);
}

async function delayForRateLimit(): Promise<void> {
  const delayNeeded = REQUEST_DELAY_MS - (Date.now() - lastRequestTime);
  if (delayNeeded > 0) {
    await new Promise(resolve => setTimeout(resolve, delayNeeded));
  }
  lastRequestTime = Date.now();
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

    // Add exclusion zone to request if it exists
    if (exclusionZone) {
      const [minLng, minLat, maxLng, maxLat, minElevation, maxElevation] = exclusionZone;
      requestBody.exclude_polygons = [
        [
          [minLng, minLat],
          [maxLng, minLat],
          [maxLng, maxLat],
          [minLng, maxLat],
          [minLng, minLat]
        ]
      ];
    }

    const response = await Promise.race([
      fetch('/api/valhalla-route', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody)
      }),
      new Promise<Response>((_, reject) =>
        setTimeout(() => reject(new Error('Timeout')), API_TIMEOUT_MS)
      )
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

function decodePolyline(encoded: string): [number, number][] {
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
    // Initialize exclusion zone layer on first call
    if (!exclusionZoneInitialized) {
      initializeExclusionZoneLayer(map);
      exclusionZoneInitialized = true;
    }

    const shelters = await findNearestShelters(lat, lng, 5);
    if (!shelters.length) return;

    const shelter = shelters[0];
    const [shelterLng, shelterLat] = shelter.geometry.coordinates;
    let route = await getRoute(lng, lat, shelterLng, shelterLat);

    if (!route) return;

    let shape = route.shape || route.legs?.[0]?.shape;
    if (!shape) {
      console.warn('No shape found in route');
      return;
    }

    let pathCoords = decodePolyline(shape);
    if (pathCoords.length < 2) {
      console.warn('Not enough coordinates:', pathCoords.length);
      return;
    }

    console.log('Path coordinates count:', pathCoords.length);
    console.log('Exclusion zone active:', exclusionZone ? 'yes' : 'no');
    console.log('First path point:', pathCoords[0]);
    console.log('Last path point:', pathCoords[pathCoords.length - 1]);


    const shelterFeature: ShelterFeature = shelter.type === 'Feature'
      ? (shelter as ShelterFeature)
      : { type: 'Feature', geometry: shelter.geometry as GeoJSON.Point, properties: shelter.properties || {} } as ShelterFeature;

    AddShortestPathLayer(map, pathCoords, shelter.properties?.fylke_id, shelterFeature);
  } catch (err) {
    console.error('Shortest path error:', err);
  }
}

export function clearPath(map: MaplibreGL.Map): void {
  ClearShortestPathLayer(map);
}