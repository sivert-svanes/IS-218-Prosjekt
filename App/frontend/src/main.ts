// Use the global provided by the CDN instead of importing a node-style package
import type * as MaplibreGL from 'maplibre-gl';
import {
  AddLayerObject,
  LayerSpecification,
  LngLatLike,
  PropertyValueSpecification
} from "maplibre-gl";


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
    center: [0, 0] as LngLatLike,
    zoom: 6 as number,
  });

  window.map = map;

  // ── Layer-toggle dropdown ──────────────────────────────────────
  const layersToggle = document.getElementById('layers-toggle');
  const layersMenu   = document.getElementById('layers-menu');

  // Open / close the dropdown when clicking the toggle button
  layersToggle?.addEventListener('click', (e) => {
    e.stopPropagation();
    layersMenu?.classList.toggle('open');
    // Align the fixed menu with the toggle button
    if (layersMenu?.classList.contains('open') && layersToggle) {
      const rect = layersToggle.getBoundingClientRect();
      layersMenu.style.top = (rect.bottom + 16) + 'px';
      layersMenu.style.left = rect.left + 'px';
    }
  });
  // Close when clicking anywhere else on the page
  document.addEventListener('click', () => {
    layersMenu?.classList.remove('open');
  });
  // Prevent clicks inside the menu from closing it
  layersMenu?.addEventListener('click', (e) => e.stopPropagation());

  /**
   * Register a map layer in the Layers dropdown so the user can toggle it.
   *
   * @param layerId   – The MapLibre layer id to toggle visibility for.
   * @param label     – Human-readable label shown in the menu.
   * @param visible   – Whether the layer starts visible (default true).
   */
  function registerLayer(layerId: string, label: string, visible: boolean = true) {
    if (!layersMenu) return;

    // Remove the "no layers" placeholder if present
    const empty = layersMenu.querySelector('.dropdown-empty');
    if (empty) empty.remove();

    const item = document.createElement('label');
    item.className = 'dropdown-item prevent-select';

    const cb = document.createElement('input');
    cb.type = 'checkbox';
    cb.checked = visible;

    cb.addEventListener('change', () => {
      map.setLayoutProperty(layerId, 'visibility', cb.checked ? 'visible' : 'none');
    });

    const span = document.createElement('span');
    span.textContent = label;

    item.appendChild(cb);
    item.appendChild(span);
    layersMenu.appendChild(item);
  }
  // ───────────────────────────────────────────────────────────────

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

    // Fetch brannstasjoner and add as a layer
    fetch('/api/brannstasjoner')
      .then(res => res.json())
      .then((geojson) => {
        map.addSource('brannstasjoner', { type: 'geojson', data: geojson });

        map.addLayer({
          id: 'brannstasjoner-circle' as string,
          type: 'circle',
          source: 'brannstasjoner' as string,
          paint: {
            'circle-radius': 6 as number,
            'circle-color': '#e74c3c' as string,
            'circle-stroke-width': 1 as number,
            'circle-stroke-color': '#ffffff' as string,
          },
        });

        registerLayer('brannstasjoner-circle', 'Brannstasjoner', true);

        map.on('click', 'brannstasjoner-circle', (e) => {
          if (!e.features || e.features.length === 0) return;
          const feature = e.features[0];
          const coords = (feature.geometry as GeoJSON.Point).coordinates.slice() as [number, number];
          const props = feature.properties || {} as Record<string, string>;

          const html = `
            <div style="font-family: sans-serif; max-width: 260px;">
              <h3 style="margin: 0 0 6px 0; font-size: 14px;">${props.brannstasjon || 'Ukjent stasjon'}</h3>
              ${props.brannvesen ? `<p style="margin: 2px 0;"><strong>Brannvesen:</strong> ${props.brannvesen}</p>` : ''}
              ${props.stasjonstype ? `<p style="margin: 2px 0;"><strong>Stasjonstype:</strong> ${props.stasjonstype}</p>` : ''}
              ${props.kasernert ? `<p style="margin: 2px 0;"><strong>Kasernert:</strong> ${props.kasernert}</p>` : ''}
              <p style="margin: 2px 0;"><strong>Koordinater:</strong> ${coords[1].toFixed(6)}, ${coords[0].toFixed(6)}</p>
            </div>`;

          while (Math.abs(e.lngLat.lng - coords[0]) > 180) {
            coords[0] += e.lngLat.lng > coords[0] ? 360 : -360;
          }

          new maplibregl.Popup({ offset: 10 }).setLngLat(coords).setHTML(html).addTo(map);
        });

        map.on('mouseenter', 'brannstasjoner-circle', () => { map.getCanvas().style.cursor = 'pointer'; });
        map.on('mouseleave', 'brannstasjoner-circle', () => { map.getCanvas().style.cursor = ''; });
      })
      .catch(err => console.error('Failed to load brannstasjoner:', err));

  }); // end style.load

}