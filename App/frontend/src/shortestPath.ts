import type * as MaplibreGL from "maplibre-gl";
import { AddShortestPathLayer, ClearShortestPathLayer } from "./layer.js";
import type { ShelterFeature } from "./interfaces.js";

const API_TIMEOUT_MS = 5000;
const ROUTE_CACHE = new Map<string, any>();
const REQUEST_DELAY_MS = 300;
let lastRequestTime = 0;

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

    const response = await Promise.race([
      fetch('/api/valhalla-route', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          locations: [
            { lat: userLat, lon: userLng },
            { lat: shelterLat, lon: shelterLng }
          ],
          costing: 'auto'
        })
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
    const shelters = await findNearestShelters(lat, lng, 5);
    if (!shelters.length) return;

    const shelter = shelters[0];
    const [shelterLng, shelterLat] = shelter.geometry.coordinates;
    const route = await getRoute(lng, lat, shelterLng, shelterLat);

    if (!route) return;

    const shape = route.shape || route.legs?.[0]?.shape;
    if (!shape) {
      console.warn('No shape found in route');
      return;
    }

    const pathCoords = decodePolyline(shape);
    if (pathCoords.length < 2) {
      console.warn('Not enough coordinates:', pathCoords.length);
      return;
    }

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