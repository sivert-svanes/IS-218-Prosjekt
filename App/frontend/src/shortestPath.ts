import type * as MaplibreGL from "maplibre-gl";
import { AddShortestPathLayer, ClearShortestPathLayer } from "./layer.js";

const OSRM_API_BASE = "https://router.project-osrm.org/route/v1/driving";
const OSRM_TIMEOUT_MS = 3000;
const ROUTE_CACHE = new Map<string, any>();

async function findNearestShelters(lat: number, lng: number, k: number = 5): Promise<any[]> {
  try {
    const response = await fetch(`/api/nearest-shelters?lat=${lat}&lng=${lng}&k=${k}`);
    return response.ok ? await response.json().then(g => g.features || []) : [];
  } catch (err) {
    console.error('Failed to fetch nearest shelters:', err);
    return [];
  }
}

async function getOSRMRoute(userLng: number, userLat: number, shelterLng: number, shelterLat: number): Promise<any> {
  const cacheKey = `${userLng},${userLat};${shelterLng},${shelterLat}`;
  if (ROUTE_CACHE.has(cacheKey)) return ROUTE_CACHE.get(cacheKey);

  try {
    const url = `${OSRM_API_BASE}/${userLng},${userLat};${shelterLng},${shelterLat}?geometries=geojson&overview=full`;
    const timeoutPromise = new Promise<Response>((_, reject) =>
      setTimeout(() => reject(new Error('Timeout')), OSRM_TIMEOUT_MS)
    );

    const response = await Promise.race([fetch(url), timeoutPromise]) as Response;
    if (response?.ok) {
      const data = await response.json();
      if (data.routes?.[0]) {
        ROUTE_CACHE.set(cacheKey, data.routes[0]);
        return data.routes[0];
      }
    }
  } catch (err) {
    console.error('Failed to fetch OSRM route:', err);
  }
  return null;
}

export async function calculateAndDisplayPath(map: MaplibreGL.Map, lat: number, lng: number): Promise<void> {
  try {
    const shelters = await findNearestShelters(lat, lng, 5);
    if (!shelters.length) return;

    const routes = await Promise.all(
      shelters
        .filter(s => s.geometry?.type === 'Point')
        .map(async (shelter) => {
          const [shelterLng, shelterLat] = shelter.geometry.coordinates;
          return { route: await getOSRMRoute(lng, lat, shelterLng, shelterLat), shelter };
        })
    );

    let best = routes.reduce((min, r) =>
      (r.route && r.route.distance < (min.route?.distance ?? Infinity)) ? r : min,
      { route: null as any, shelter: null as any }
    );

    if (best.route && best.shelter) {
      const pathCoords = best.route.geometry?.coordinates || [];
      if (pathCoords.length >= 2) {
        AddShortestPathLayer(map, pathCoords, best.shelter.properties?.fylke_id, best.shelter);
      }
    }
  } catch (err) {
    console.error('Shortest path error:', err);
  }
}

export function clearPath(map: MaplibreGL.Map): void {
  ClearShortestPathLayer(map);
}