import type * as MaplibreGL from "maplibre-gl";
import { AddShortestPathLayer, ClearShortestPathLayer } from "./layer.js";
import type { ShelterFeature } from "./interfaces.js";
import { getExclusionZones } from "./exclusion.js";
import { decodePolyline6 } from "./utils.js";

const API_TIMEOUT_MS = 20000;
const ROUTE_CACHE = new Map<string, any>();
const NUM_SHELTERS_TO_REQUEST = 15;


async function findNearestShelters(lat: number, lng: number, k: number = NUM_SHELTERS_TO_REQUEST): Promise<any[]> {
  try {
    const response = await fetch(`/api/nearest-shelters?lat=${lat}&lng=${lng}&k=${k}`);
    return response.ok ? (await response.json()).features || [] : [];
  } catch (err) {
    console.error('Failed to fetch nearest shelters:', err);
    return [];
  }
}

async function findNearestBuildings(lat: number, lng: number, buildingKey: string, k: number = 15): Promise<any[]> {
  try {
    const response = await fetch(`/api/nearest-buildings?lat=${lat}&lng=${lng}&building_key=${buildingKey}&k=${k}`);
    return response.ok ? (await response.json()).features || [] : [];
  } catch (err) {
    console.error('Failed to fetch nearest buildings:', err);
    return [];
  }
}

async function getShortestShelterViaMatrix(userLng: number, userLat: number, shelters: any[]): Promise<{ shelter: any; distance: number; index: number } | null> {
  if (shelters.length === 0) return null;

  try {
    const requestBody: any = {
      sources: [{ lat: userLat, lon: userLng }],
      targets: shelters.map(shelter => {
        const [shelterLng, shelterLat] = shelter.geometry.coordinates;
        return { lat: shelterLat, lon: shelterLng };
      }),
      costing: 'auto'
    };

    // Add all exclusion zones as polygons
    const zones = getExclusionZones();
    if (zones.length > 0) {
      requestBody.exclude_polygons = zones.map(zone => {
        const [minLng, minLat, maxLng, maxLat] = zone;
        return [[minLng, minLat], [maxLng, minLat], [maxLng, maxLat], [minLng, maxLat], [minLng, minLat]];
      });
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
      const matrix = data.sources_to_targets?.[0];

      if (!matrix || matrix.length === 0) {
        console.warn('Empty distance matrix returned');
        return null;
      }

      // Find the shelter with the minimum distance (skip null/unreachable)
      let minIndex = -1;
      let minDistance = Infinity;

      for (let i = 0; i < matrix.length; i++) {
        const distance = matrix[i].distance;
        if (distance !== null && distance !== undefined && distance < minDistance) {
          minDistance = distance;
          minIndex = i;
        }
      }

      if (minIndex === -1) {
        console.warn('All shelters unreachable');
        return null;
      }

      return {
        shelter: shelters[minIndex],
        distance: minDistance,
        index: minIndex
      };
    } else if (response?.status === 429) {
      console.warn('Rate limited (429) on matrix request');
      return null;
    } else if (response?.status === 400) {
      console.warn('Bad request on matrix (e.g., no path found or route blocked by exclusions)');
      return null;
    }
  } catch (err) {
    console.error('Failed to fetch matrix:', err);
  }
  return null;
}

async function getRoute(userLng: number, userLat: number, trgLng: number, trgLat: number): Promise<any> {
  const cacheKey = `${userLng},${userLat};${trgLng},${trgLat}`;
  if (ROUTE_CACHE.has(cacheKey)) return ROUTE_CACHE.get(cacheKey);

  try {
    const requestBody: any = {
      locations: [
        { lat: userLat, lon: userLng },
        { lat: trgLat, lon: trgLng }
      ],
      costing: 'auto',
      shape_match: 'map_snap',
      filters: {
        attributes: ['edge.polyline6'],
        action: 'include'
      }
    };

    // Add all exclusion zones as polygons
    const zones = getExclusionZones();
    if (zones.length > 0) {
      requestBody.exclude_polygons = zones.map(zone => {
        const [minLng, minLat, maxLng, maxLat] = zone;
        return [[minLng, minLat], [maxLng, minLat], [maxLng, maxLat], [minLng, maxLat], [minLng, minLat]];
      });
    }

    const response = await Promise.race([
      fetch('/api/valhalla-route-polyline', {
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
    } else if (response?.status === 400) {
      console.warn('Bad request (e.g., no path found or route blocked by exclusions)');
      return null;
    }
  } catch (err) {
    console.error('Failed to fetch route:', err);
  }
  return null;
}


export async function calculateAndDisplayPath(map: MaplibreGL.Map, lat: number, lng: number): Promise<void> {
  try {
    const shelters = await findNearestShelters(lat, lng, NUM_SHELTERS_TO_REQUEST);
    if (!shelters.length) return;

    // Use Matrix API to find the shortest path in one request
    const shortestResult = await getShortestShelterViaMatrix(lng, lat, shelters);
    if (!shortestResult) {
      console.warn('No valid routes found for any shelter');
      return;
    }

    const { shelter: shortestShelter } = shortestResult;
    const [shelterLng, shelterLat] = shortestShelter.geometry.coordinates;

    // Fetch the actual route with polyline for display
    const route = await getRoute(lng, lat, shelterLng, shelterLat);
    if (!route) {
      console.warn('Failed to fetch route for shortest shelter');
      return;
    }

    const shape = route.shape || route.legs?.[0]?.shape;
    if (!shape) return console.warn('No shape found in route');

    const pathCoords = decodePolyline6(shape);
    if (pathCoords.length < 2) return console.warn('Not enough coordinates:', pathCoords.length);

    const shelterFeature: ShelterFeature = shortestShelter.type === 'Feature'
      ? (shortestShelter as ShelterFeature)
      : { type: 'Feature', geometry: shortestShelter.geometry as GeoJSON.Point, properties: shortestShelter.properties || {} } as ShelterFeature;

    AddShortestPathLayer(map, pathCoords, shortestShelter.properties?.fylke_id, shelterFeature);
  } catch (err) {
    console.error('Shortest path error:', err);
  }
}

export async function calculateAndDisplayPathToBuilding(map: MaplibreGL.Map, shelterLat: number, shelterLng: number, buildingKey: string): Promise<void> {
  try {
    const buildings = await findNearestBuildings(shelterLat, shelterLng, buildingKey, 15);
    if (!buildings.length) {
      console.warn(`No ${buildingKey} buildings found`);
      return;
    }

    // Use Matrix API to find the shortest path from shelter to buildings
    const shortestResult = await getShortestShelterViaMatrix(shelterLng, shelterLat, buildings);
    if (!shortestResult) {
      console.warn(`No valid routes found to any ${buildingKey}`);
      return;
    }

    const { shelter: nearestBuilding } = shortestResult;
    const [buildingLng, buildingLat] = nearestBuilding.geometry.coordinates;

    // Fetch the actual route with polyline for display
    const route = await getRoute(shelterLng, shelterLat, buildingLng, buildingLat);
    if (!route) {
      console.warn(`Failed to fetch route to nearest ${buildingKey}`);
      return;
    }

    const shape = route.shape || route.legs?.[0]?.shape;
    if (!shape) return console.warn('No shape found in route');

    const pathCoords = decodePolyline6(shape);
    if (pathCoords.length < 2) return console.warn('Not enough coordinates:', pathCoords.length);

    const buildingFeature: ShelterFeature = nearestBuilding.type === 'Feature'
      ? (nearestBuilding as ShelterFeature)
      : { type: 'Feature', geometry: nearestBuilding.geometry as GeoJSON.Point, properties: nearestBuilding.properties || {} } as ShelterFeature;

    AddShortestPathLayer(map, pathCoords, undefined, buildingFeature);
  } catch (err) {
    console.error(`Error routing to ${buildingKey}:`, err);
  }
}

export function clearPath(map: MaplibreGL.Map): void {
  ClearShortestPathLayer(map);
}