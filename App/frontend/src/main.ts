import type * as MaplibreGL from 'maplibre-gl';
import {
  AddLayerObject,
  LayerSpecification,
  LngLatLike,
  PropertyValueSpecification
} from "maplibre-gl";
import { registerKonamiCode } from './middleEarth.js';
import {AddShelterLayerGeospatial, AddDSBWmsLayers, AddVannOgVassdragLayers, AddFKBVeiLayer, AddNVDBRoadsLayer} from './layer.js'

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
    style: '../static/style/mapstyle.json' as string,
    center: [8.0, 59.0] as LngLatLike,
    zoom: 2 as number,
  });

  window.map = map;
  registerKonamiCode(map);

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

  const scale = new maplibregl.ScaleControl({ maxWidth: 320, unit: 'metric' });
  map.addControl(scale, 'bottom-left');


  map.on('style.load', () => {
    map.setProjection({
      type: 'globe' as string,
    });

    // Stars layer
    import("./starsLayer.js").then(({ createStarsLayer }) => {
      try {
        const starsLayer = createStarsLayer({
          id: 'stars',
          intensity: 1.0 as number,
          density: 0.55 as number,
        });
        if (!map.getLayer('stars')) {
          const layers : LayerSpecification[] = map.getStyle().layers;
          const firstLayerId : string | undefined = layers && layers.length > 0 ? layers[0].id : undefined;
          map.addLayer(starsLayer as AddLayerObject, firstLayerId);
        }
      } catch (err) {
        console.warn('Failed to add stars layer:', err);
      }
    }).catch((err: any) => {
      console.warn('Failed to load starsLayer module:', err);
    });

    const LIGHT_THETA_DEG : number = -37;
    const LIGHT_PHI_DEG : number = 4;
    const LIGHT_RADIAL_DIST : number = 300000.0;
    const LIGHT_COLOR : string = '#ffffff';

    // Maximum light intensity when fully zoomed out (globe view)
    // Maximum atmosphere-blend when fully zoomed out (1.0 = full atmosphere glow)
    const  LIGHT_INTENSITY_MAX : number = 1.0 as number;
    const ATMOSPHERE_BLEND_MAX : number = 1.0 as number;

    // Zoom range over which globe effects (light, atmosphere, dark colors)
    // are fully active vs. fully faded out to the normal map style.
    // At or below FADE_ZOOM_START everything is in "globe/dark" mode.
    // At or above FADE_ZOOM_END everything matches the original bright style.
    const FADE_ZOOM_START : number = 6;
    const FADE_ZOOM_END : number = 10;

    // Calculate light position (radial distance, azimuthal angle, polar angle)
    const p = (Math.acos(Math.cos((LIGHT_THETA_DEG / 180 as number + 1 as number) * Math.PI)
        * Math.cos((LIGHT_PHI_DEG / 180 as number) * Math.PI)) / Math.PI) * 180 as number;
    const a = 90 as number + (Math.atan2(
      Math.sin((LIGHT_PHI_DEG / 180 as number) * Math.PI),
      Math.sin((LIGHT_THETA_DEG / 180 as number + 1 as number) * Math.PI) * Math.cos((LIGHT_PHI_DEG / 180 as number) * Math.PI)
    ) / Math.PI) * 180 as number;

    //interpolate a value between two zoom stops
    function lerpAtZoom(zoom: number, z1: number, v1: number, z2: number, v2: number): number {
      if (zoom <= z1) return v1;
      if (zoom >= z2) return v2;
      return v1 + (v2 - v1) * ((zoom - z1) / (z2 - z1));
    }

    //fade light intensity over zoom range so brightness fades consistently with zoom level
    function updateLightForZoom() {
      const z : number = map.getZoom();
      const intensity : number = lerpAtZoom(z, FADE_ZOOM_START, LIGHT_INTENSITY_MAX, FADE_ZOOM_END, 0);
      map.setLight({
        anchor: 'map' as PropertyValueSpecification<"map">,
        position: [LIGHT_RADIAL_DIST, a, p],
        intensity: intensity as number,
        color: LIGHT_COLOR as string,
      });
    }

    updateLightForZoom(); //set initial light
    map.on('zoom', updateLightForZoom);

    // Set sky – atmosphere-blend fades out/in-step with the light intensity
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

    //dark style for on globe view, to properly show the contrast between day and night
    const darkPaint: [string, string, string, string][] = [
      ['background',          'background-color', 'rgb(11, 11, 15)',    'rgb(242, 243, 240)'],
      ['water',               'fill-color',       'rgb(5, 8, 18)',    'rgb(194, 200, 202)'],
      ['water',               'fill-outline-color','rgb(3, 5, 14)',    'rgb(194, 200, 202)'],
      ['park',                'fill-color',       'rgb(8, 12, 8)',    'rgb(230, 233, 229)'],
      ['landcover_ice_shelf', 'fill-color',       'rgb(12, 12, 14)',  'hsl(0, 0%, 98%)'],
      ['landcover_glacier',   'fill-color',       'rgb(12, 12, 14)',  'hsl(0, 0%, 98%)'],
      ['landuse_residential', 'fill-color',       'rgb(10, 10, 12)',  'rgb(234, 234, 230)'],
      ['landcover_wood',      'fill-color',       'rgb(6, 10, 6)',    'rgb(230, 233, 229)'],
      ['building',            'fill-color',       'rgb(14, 14, 16)',  'rgb(234, 234, 229)'],
      ['building',            'fill-outline-color','rgb(10, 10, 12)', 'rgb(219, 219, 218)'],
      ['waterway',            'line-color',       'rgb(5, 8, 18)',    'rgb(194, 200, 202)'],
      ['boundary_2',          'line-color',       'rgb(5, 5, 8)',       'hsl(0, 0%, 70%)'],
      ['boundary_3',          'line-color',       'rgb(5, 5, 8)',       'hsl(0, 0%, 70%)'],
      ['boundary_disputed',   'line-color',       'rgb(5, 5, 8)',       'hsl(0, 0%, 70%)'],
      ['label_country_1',     'text-color',       'rgb(35, 35, 45)',    '#000000'],
      ['label_country_1',     'text-halo-color',  'rgb(2, 2, 4)',      '#ffffff'],
      ['label_country_2',     'text-color',       'rgb(35, 35, 45)',    '#000000'],
      ['label_country_2',     'text-halo-color',  'rgb(2, 2, 4)',      '#ffffff'],
      ['label_country_3',     'text-color',       'rgb(35, 35, 45)',    '#000000'],
      ['label_country_3',     'text-halo-color',  'rgb(2, 2, 4)',      '#ffffff'],
      ['label_city',          'text-color',       'rgb(35, 35, 45)',    '#000000'],
      ['label_city',          'text-halo-color',  'rgb(2, 2, 4)',      '#ffffff'],
      ['label_city_capital',  'text-color',       'rgb(35, 35, 45)',    '#000000'],
      ['label_city_capital',  'text-halo-color',  'rgb(2, 2, 4)',      '#ffffff'],
      ['label_town',          'text-color',       'rgb(35, 35, 45)',    '#000000'],
      ['label_town',          'text-halo-color',  'rgb(2, 2, 4)',      '#ffffff'],
      ['label_state',         'text-color',       'rgb(35, 35, 45)',    '#333333'],
      ['label_state',         'text-halo-color',  'rgb(2, 2, 4)',      '#ffffff'],
      ['waterway_line_label',   'text-halo-color', 'rgba(2, 2, 4, 0.7)',  'rgba(255, 255, 255, 0.7)'],
      ['waterway_line_label',   'text-color',      'rgb(20, 25, 40)',     'hsl(0, 0%, 66%)'],
      ['water_name_point_label','text-halo-color',  'rgba(2, 2, 4, 0.7)', 'rgba(255, 255, 255, 0.7)'],
      ['water_name_point_label','text-color',       'rgb(15, 20, 45)',    '#495e91'],
      ['water_name_line_label', 'text-halo-color',  'rgba(2, 2, 4, 0.7)', 'rgba(255, 255, 255, 0.7)'],
      ['water_name_line_label', 'text-color',       'rgb(15, 20, 45)',    '#495e91'],
      ['tunnel_motorway_casing',        'line-color', 'rgb(10, 10, 14)',  'rgb(213, 213, 213)'],
      ['highway_major_casing',          'line-color', 'rgb(10, 10, 14)',  'rgb(213, 213, 213)'],
      ['highway_motorway_casing',       'line-color', 'rgb(10, 10, 14)',  'rgb(213, 213, 213)'],
      ['highway_motorway_bridge_casing','line-color', 'rgb(10, 10, 14)',  'rgb(213, 213, 213)'],
      ['tunnel_motorway_inner',         'line-color', 'rgb(12, 12, 16)',  'rgb(234, 234, 234)'],
      ['highway_major_inner',           'line-color', 'rgb(12, 12, 16)',  '#ffffff'],
      ['highway_motorway_inner',        'line-color', 'rgb(12, 12, 16)',  '#ffffff'],
      ['highway_motorway_bridge_inner', 'line-color', 'rgb(12, 12, 16)',  '#ffffff'],
      ['highway_major_subtle',          'line-color', 'rgba(10,10,14,0.69)', 'hsla(0,0%,85%,0.69)'],
      ['highway_motorway_subtle',       'line-color', 'rgba(10,10,14,0.53)', 'hsla(0,0%,85%,0.53)'],
      ['highway_path',                  'line-color', 'rgb(12, 12, 16)',  'rgb(234, 234, 234)'],
      ['highway_minor',                 'line-color', 'rgb(10, 10, 14)',  'hsl(0, 0%, 88%)'],
      ['road_area_pier',                'fill-color', 'rgb(8, 8, 12)',    'rgb(242, 243, 240)'],
      ['road_pier',                     'line-color', 'rgb(8, 8, 12)',    'rgb(242, 243, 240)'],
      ['railway',                       'line-color', 'rgb(10, 10, 14)',  '#dddddd'],
      ['railway_dashline',              'line-color', 'rgb(12, 12, 16)',  '#fafafa'],
      ['railway_transit',               'line-color', 'rgb(10, 10, 14)',  '#dddddd'],
      ['railway_transit_dashline',      'line-color', 'rgb(12, 12, 16)',  '#fafafa'],
      ['railway_service',               'line-color', 'rgb(10, 10, 14)',  '#dddddd'],
      ['railway_service_dashline',      'line-color', 'rgb(12, 12, 16)',  '#fafafa'],
    ];
    for (const entry of darkPaint) {
      if (map.getLayer(entry[0])) {
        map.setPaintProperty(entry[0], entry[1], [
          'interpolate',
          ['linear'],
          ['zoom'],
          0, entry[2],
          FADE_ZOOM_START, entry[2],
          FADE_ZOOM_END, entry[3],
        ]);
      }
    }
    const fylkeIds = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15];
    AddShelterLayerGeospatial(map, fylkeIds);
    AddDSBWmsLayers(map);
    AddVannOgVassdragLayers(map);
    AddFKBVeiLayer(map);
    AddNVDBRoadsLayer(map);
  }
)}