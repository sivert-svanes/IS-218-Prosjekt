import type * as MaplibreGL from "maplibre-gl";
import { AddShortestPathLayer, ClearShortestPathLayer } from "./layer.js";

const OSRM_API_BASE = "http://router.project-osrm.org/route/v1/driving";

async function findNearestSheltersViaAPI(lat: number, lng: number, k: number = 10): Promise<any[]> {
  try {
    const response = await fetch(`/api/nearest-shelters?lat=${lat}&lng=${lng}&k=${k}`);
    if (response.ok) {
      const geojson = await response.json();
      return geojson.features || [];
    }
  } catch (err) {
    console.error('Failed to fetch nearest shelters from API:', err);
  }
  return [];
}

async function getOSRMRoute(userLng: number, userLat: number, shelterLng: number, shelterLat: number): Promise<any> {
  try {
    const url = `${OSRM_API_BASE}/${userLng},${userLat};${shelterLng},${shelterLat}?geometries=geojson&overview=full`;
    const response = await fetch(url);

    if (response.ok) {
      const data = await response.json();
      if (data.routes && data.routes.length > 0) {
        return data.routes[0];
      }
    }
  } catch (err) {
    console.error('Failed to fetch route from OSRM:', err);
  }
  return null;
}

function extractPathCoordinates(route: any): [number, number][] {
  if (route.geometry && route.geometry.coordinates) {
    return route.geometry.coordinates;
  }
  return [];
}


export async function calculateAndDisplayPath(map: MaplibreGL.Map, lat: number, lng: number): Promise<void> {
  try {
    // Get k=10 nearest shelters from database
    const shelterFeatures = await findNearestSheltersViaAPI(lat, lng, 10);
    if (shelterFeatures.length === 0) return;

    let shortestRoute: any = null;
    let shortestShelter: any = null;
    let shortestDistance = Infinity;

    // Query OSRM for each shelter and find the one with the shortest route
    for (const shelterFeature of shelterFeatures) {
      if (shelterFeature.geometry.type !== 'Point') continue;

      const [shelterLng, shelterLat] = shelterFeature.geometry.coordinates;

      const route = await getOSRMRoute(lng, lat, shelterLng, shelterLat);
      if (!route) continue;

      const distance = route.distance || Infinity;

      // Keep track of the shelter with the shortest route distance
      if (distance < shortestDistance) {
        shortestDistance = distance;
        shortestRoute = route;
        shortestShelter = shelterFeature;
      }
    }

    // Display the shortest route
    if (shortestRoute && shortestShelter) {
      const pathCoords = extractPathCoordinates(shortestRoute);
      if (pathCoords.length >= 2) {
        const fylkeId = shortestShelter.properties?.fylke_id;
        AddShortestPathLayer(map, pathCoords, fylkeId, shortestShelter);
      }
    }
  } catch (err) {
    console.error('Shortest path error:', err);
  }
}

export function clearPath(map: MaplibreGL.Map): void {
  ClearShortestPathLayer(map);
}