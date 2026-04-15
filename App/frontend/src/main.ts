import { AddLayerObject, LayerSpecification, LngLatLike, PropertyValueSpecification } from "maplibre-gl";
import { registerKonamiCode } from './middleEarth.js';
import {
  AddShelterLayerGeospatial,
  AddDSBWmsLayers,
  AddVannOgVassdragLayers,
  AddFKBVeiLayer,
} from './layer.js'
import {registerStyleInMenu, initializeDropdownMenus} from './layerControl.js'
import {registerStyle} from "./mapStyles.js";
import { calculateAndDisplayPath, clearPath } from './shortestPath.js'
import { initializeExclusionZones } from './exclusion.js'
import { getMapStyle, GLOBE_FADE_CONFIG, DARK_PAINTS } from './mapStyles.js';
import './interfaces.js';

const maplibregl = window.maplibregl;
if (!maplibregl) {
  console.warn('MapLibre GL not found on window as maplibregl');
} else {
  // Create a local `map` variable so TypeScript knows it's defined when we call methods on it.
  const map = new maplibregl.Map({
    container: 'map' as string,
    style: getMapStyle('positron'),
    center: [8.0, 59.0] as LngLatLike,
    zoom: 2 as number,
  });

  window.map = map;
  registerKonamiCode(map);
  initializeDropdownMenus();

  const geolocate = new maplibregl.GeolocateControl({
    positionOptions: { enableHighAccuracy: true as boolean },
    trackUserLocation: true as boolean,
    showAccuracyCircle: true as boolean,
  });
  map.addControl(geolocate, 'top-right');

  map.on('load', () => {
    try {
      geolocate?.trigger();
    } catch (err) {
      console.warn('Geolocate trigger failed:', err);
    }
  });

  const scale = new maplibregl.ScaleControl({ maxWidth: 320, unit: 'metric' });
  map.addControl(scale, 'bottom-left');

  // Shortest path button handler
  const shortestPathBtn = document.getElementById('shortest-path-btn');
  if (shortestPathBtn) {
    shortestPathBtn.addEventListener('click', async () => {
      const loadingBar = shortestPathBtn.querySelector('.loading-bar') as HTMLElement;
      loadingBar?.classList.add('active');

      let lat: number | undefined;
      let lng: number | undefined;

      // Override geolocation for testing (e.g., oslo: window.debugGeoLocation = {lat: 59.9139, lng: 10.7522})
      if (window.debugGeoLocation) {
        lat = window.debugGeoLocation.lat;
        lng = window.debugGeoLocation.lng;
      } else {
        lat = geolocate && (geolocate as any)._lastKnownPosition?.coords?.latitude;
        lng = geolocate && (geolocate as any)._lastKnownPosition?.coords?.longitude;
      }

      if (!lat || !lng) {
        const center = map.getCenter();
        lat = center.lat;
        lng = center.lng;
      }

      await calculateAndDisplayPath(map, lat, lng);
      loadingBar?.classList.remove('active');
    });
  }

  // Clear path button handler
  const clearPathBtn = document.getElementById('clear-path-btn');
  if (clearPathBtn) {
    clearPathBtn.addEventListener('click', () => {
      clearPath(map);
    });
  }

  map.on('style.load', () => {
    map.setProjection({
      type: 'globe' as string,
    });

    // Register OSM raster layer that fades in when zoomed in
    registerStyle(map, {
      id: 'osm-raster',
      tiles: ['https://tile.openstreetmap.org/{z}/{x}/{y}.png'],
      type: 'raster',
      tileSize: 256,
      attribution: '© OpenStreetMap contributors',
      fadeZoomStart: 6,
      fadeZoomEnd: 10,
    });

    // Add OSM raster layer to the styles menu
    registerStyleInMenu('osm-raster', 'OpenStreetMap Raster', false, map);

    // Stars layer
    import("./starsLayer.js").then(({ createStarsLayer }) => {
      try {
        const starsLayer = createStarsLayer({
          id: 'stars',
          intensity: 1.0 as number,
          density: 0.55 as number,
        });
        if (!map.getLayer('stars')) {
          const layers: LayerSpecification[] = map.getStyle().layers;
          const firstLayerId: string | undefined = layers && layers.length > 0 ? layers[0].id : undefined;
          map.addLayer(starsLayer as AddLayerObject, firstLayerId);
        }
      } catch (err) {
        console.warn('Failed to add stars layer:', err);
      }
    }).catch((err: any) => {
      console.warn('Failed to load starsLayer module:', err);
    });

    const LIGHT_THETA_DEG: number = GLOBE_FADE_CONFIG.LIGHT_THETA_DEG;
    const LIGHT_PHI_DEG: number = GLOBE_FADE_CONFIG.LIGHT_PHI_DEG;
    const LIGHT_RADIAL_DIST: number = GLOBE_FADE_CONFIG.LIGHT_RADIAL_DIST;
    const LIGHT_COLOR: string = GLOBE_FADE_CONFIG.LIGHT_COLOR;
    const LIGHT_INTENSITY_MAX: number = GLOBE_FADE_CONFIG.LIGHT_INTENSITY_MAX;
    const ATMOSPHERE_BLEND_MAX: number = GLOBE_FADE_CONFIG.ATMOSPHERE_BLEND_MAX;
    const FADE_ZOOM_START: number = GLOBE_FADE_CONFIG.FADE_ZOOM_START;
    const FADE_ZOOM_END: number = GLOBE_FADE_CONFIG.FADE_ZOOM_END;

    // Calculate light position (radial distance, azimuthal angle, polar angle)
    const p = (Math.acos(Math.cos((LIGHT_THETA_DEG / 180 as number + 1 as number) * Math.PI)
        * Math.cos((LIGHT_PHI_DEG / 180 as number) * Math.PI)) / Math.PI) * 180 as number;
    const a = 90 as number + (Math.atan2(
      Math.sin((LIGHT_PHI_DEG / 180 as number) * Math.PI),
      Math.sin((LIGHT_THETA_DEG / 180 as number + 1 as number) * Math.PI) * Math.cos((LIGHT_PHI_DEG / 180 as number) * Math.PI)
    ) / Math.PI) * 180 as number;

    // Interpolate a value between two zoom stops
    function lerpAtZoom(zoom: number, z1: number, v1: number, z2: number, v2: number): number {
      if (zoom <= z1) return v1;
      if (zoom >= z2) return v2;
      return v1 + (v2 - v1) * ((zoom - z1) / (z2 - z1));
    }

    function updateLightForZoom() {
      const z: number = map.getZoom();
      const intensity: number = lerpAtZoom(z, FADE_ZOOM_START, LIGHT_INTENSITY_MAX, FADE_ZOOM_END, 0);
      map.setLight({
        anchor: 'map' as PropertyValueSpecification<"map">,
        position: [LIGHT_RADIAL_DIST, a, p],
        intensity: intensity as number,
        color: LIGHT_COLOR as string,
      });
    }

    updateLightForZoom(); // Set initial light
    map.on('zoom', updateLightForZoom);

    map.setSky({
      'atmosphere-blend': [
        'interpolate',
        ['linear'],
        ['zoom'],
        0, ATMOSPHERE_BLEND_MAX,
        FADE_ZOOM_START, ATMOSPHERE_BLEND_MAX,
        FADE_ZOOM_END, 0
      ],
    });

    // Apply dark-to-light color transitions for each layer
    DARK_PAINTS.forEach(([layerId, property, darkColor, lightColor]) => {
      const layer = map.getLayer(layerId);
      if (layer) {
        map.setPaintProperty(layerId, property, [
          'interpolate',
          ['linear'],
          ['zoom'],
          0, darkColor,
          FADE_ZOOM_START, darkColor,
          FADE_ZOOM_END, lightColor,
        ]);
      }
    });

    // Load all layers
    const fylkeIds = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15];
    (async () => {
      await initializeExclusionZones(map);
      await AddShelterLayerGeospatial(map, fylkeIds);
      AddDSBWmsLayers(map);
      AddVannOgVassdragLayers(map);
      AddFKBVeiLayer(map);
    })().catch(err => console.error('Error loading layers:', err));
  });
}
