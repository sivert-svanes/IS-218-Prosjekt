import type * as MaplibreGL from "maplibre-gl";
import { AddExclusionZonesLayer } from "./layer.js";

let exclusionZonesGeojson: GeoJSON.FeatureCollection = {
  type: "FeatureCollection",
  features: []
};

export async function fetchExclusionZones(): Promise<GeoJSON.FeatureCollection> {
  try {
    const response = await fetch('/api/exclusion-zones');
    if (!response.ok) {
      throw new Error(`Failed to fetch exclusion zones: ${response.statusText}`);
    }
    exclusionZonesGeojson = await response.json();
    console.log(`Fetched ${exclusionZonesGeojson.features.length} exclusion zones`);
    return exclusionZonesGeojson;
  } catch (error) {
    console.error('Error fetching exclusion zones:', error);
    return { type: "FeatureCollection", features: [] };
  }
}

export function getExclusionZonesGeojson(): GeoJSON.FeatureCollection {
  return exclusionZonesGeojson;
}

export type ExclusionZoneBounds = [number, number, number, number, number, number];

let exclusionZones: ExclusionZoneBounds[] = [];

function calculateBoundsForPolygon(coords: number[][][]): [number, number, number, number] {
  let minLng = Infinity, maxLng = -Infinity, minLat = Infinity, maxLat = -Infinity;

  for (const ring of coords) {
    for (const [lng, lat] of ring) {
      minLng = Math.min(minLng, lng);
      maxLng = Math.max(maxLng, lng);
      minLat = Math.min(minLat, lat);
      maxLat = Math.max(maxLat, lat);
    }
  }

  return [minLng, minLat, maxLng, maxLat];
}

export async function initializeExclusionZones(map: MaplibreGL.Map): Promise<void> {
  try {
    await fetchExclusionZones();
    const geojson = getExclusionZonesGeojson();

    // Calculate bounds for each exclusion zone feature
    exclusionZones = [];
    for (const feature of geojson.features) {
      if (feature.geometry?.type === 'Polygon') {
        const [minLng, minLat, maxLng, maxLat] = calculateBoundsForPolygon(feature.geometry.coordinates);
        const minElevation = -1000;
        const maxElevation = 10000;
        exclusionZones.push([minLng, minLat, maxLng, maxLat, minElevation, maxElevation]);
      }
    }

    console.log(`Initialized ${exclusionZones.length} exclusion zones`);

    // Add exclusion zones layer to map using layer.ts
    AddExclusionZonesLayer(map, geojson);
  } catch (error) {
    console.error('Error initializing exclusion zones:', error);
  }
}

export function getExclusionZones(): ExclusionZoneBounds[] {
  return exclusionZones;
}

