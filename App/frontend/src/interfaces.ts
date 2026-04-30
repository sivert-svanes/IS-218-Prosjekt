import type * as MaplibreGL from "maplibre-gl";

declare global {
  interface Window {
    // The global injected by the CDN; optional because it may not be present in some environments
    maplibregl?: typeof MaplibreGL;
    // Exposed for debugging
    map?: MaplibreGL.Map;
    // Debug override for geolocation (for testing with DevTools sensor)
    debugGeoLocation?: { lat: number; lng: number };
  }
}

/**
 * Shelter feature type
 */
export type ShelterFeature = GeoJSON.Feature<GeoJSON.Point, ShelterFeatureProperties>;

/**
 * Shelter fylke ID type
 */
export type ShelterFylkeId = ShelterFeatureProperties['fylkeId'];

export interface WmsRasterLayerConfig {
  sourceId: string;
  layerId: string;
  label: string;
  tileUrl: string;
  opacity?: number;
}

export interface ShelterFeatureProperties {
  fylkeId: number;
  [key: string]: unknown;
}

export interface MapBounds {
  minLng: number;
  maxLng: number;
  minLat: number;
  maxLat: number;
}

export interface StarsLayerOptions {
  id?: string;
  intensity?: number;
  density?: number;
}

export interface RegisterStyleOptions {
  id: string;
  tiles: string[];
  type: 'raster' | 'vector';
  tileSize?: number;
  attribution?: string;
  fadeZoomStart?: number;
  fadeZoomEnd?: number;
}