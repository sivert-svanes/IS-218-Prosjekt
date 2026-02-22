// Use the global provided by the CDN instead of importing a node-style package
import type * as MaplibreGL from 'maplibre-gl';
import {LngLatLike} from "maplibre-gl";

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
} else {
  // Create a local `map` variable so TypeScript knows it's defined when we call methods on it.
  const map = new maplibregl.Map({
    container: 'map' as string,
    style: 'https://tiles.openfreemap.org/styles/positron' as string,
    center: [0, 0] as LngLatLike,
    zoom: 6 as number,
  });

  window.map = map;

  map.on('style.load', () => {
    map.setProjection({
      type: 'globe',
    });
  });

  const geolocate = new maplibregl.GeolocateControl({
    positionOptions: { enableHighAccuracy: true as boolean },
    trackUserLocation: true as boolean,
    showAccuracyCircle: true as boolean,
  });

  map.addControl(geolocate, 'top-right');
  map.on('load', () => {
    try {
      geolocate?.trigger();
    }
    catch (err) {
      console.warn('Geolocate trigger failed:', err);
    }
  });
}
