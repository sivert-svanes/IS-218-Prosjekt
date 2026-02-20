// Use the global provided by the CDN instead of importing a node-style package
import type * as MaplibreGL from 'maplibre-gl';

declare global {
  interface Window {
    // The global injected by the CDN; optional because it may not be present in some environments
    maplibregl?: typeof MaplibreGL;
    // Exposed for debugging
    map?: MaplibreGL.Map;
  }
}

const maplibregl = window.maplibregl;
if (!maplibregl) {
  console.warn('MapLibre GL not found on window as maplibregl');
}

window.map = new maplibregl.Map({
  container: 'map' as string,
  style: 'https://tiles.openfreemap.org/styles/positron' as string,
  center: [0, 0] as [number, number],
  zoom: 6 as number
});
