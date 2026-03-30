import type { StyleSpecification } from 'maplibre-gl';
import type * as MaplibreGL from "maplibre-gl";

export const GLOBE_FADE_CONFIG = {
  LIGHT_THETA_DEG: -37,
  LIGHT_PHI_DEG: 4,
  LIGHT_RADIAL_DIST: 300000.0,
  LIGHT_COLOR: '#ffffff',
  LIGHT_INTENSITY_MAX: 1.0,
  ATMOSPHERE_BLEND_MAX: 1.0,
  FADE_ZOOM_START: 6,
  FADE_ZOOM_END: 10,
} as const;

export const DARK_PAINTS: [string, string, string, string][] = [
  ['background',          'background-color', 'rgb(11, 11, 15)',    'rgb(242, 243, 240)'],
  ['water',               'fill-color',       'rgb(5, 8, 18)',      'rgb(194, 200, 202)'],
  ['park',                'fill-color',       'rgb(8, 12, 8)',      'rgb(230, 233, 229)'],
  ['landcover_ice_shelf', 'fill-color',       'rgb(12, 12, 14)',    'hsl(0, 0%, 98%)'],
  ['landcover_glacier',   'fill-color',       'rgb(12, 12, 14)',    'hsl(0, 0%, 98%)'],
  ['landuse_residential', 'fill-color',       'rgb(10, 10, 12)',    'rgb(234, 234, 230)'],
  ['landcover_wood',      'fill-color',       'rgb(6, 10, 6)',      'rgb(230, 233, 229)'],
  ['building',            'fill-color',       'rgb(14, 14, 16)',    'rgb(234, 234, 229)'],
  ['building',            'fill-outline-color','rgb(10, 10, 12)',   'rgb(219, 219, 218)'],
  ['waterway',            'line-color',       'rgb(5, 8, 18)',      'rgb(194, 200, 202)'],
  ['boundary_2',          'line-color',       'rgb(5, 5, 8)',       'hsl(0, 0%, 70%)'],
  ['boundary_3',          'line-color',       'rgb(5, 5, 8)',       'hsl(0, 0%, 70%)'],
  ['boundary_disputed',   'line-color',       'rgb(5, 5, 8)',       'hsl(0, 0%, 70%)'],
  ['tunnel_motorway_casing',        'line-color', 'rgb(10, 10, 14)',    'rgb(213, 213, 213)'],
  ['tunnel_motorway_inner',         'line-color', 'rgb(12, 12, 16)',    'rgb(234, 234, 234)'],
  ['highway_path',                  'line-color', 'rgb(12, 12, 16)',    'rgb(234, 234, 234)'],
  ['highway_minor',                 'line-color', 'rgb(10, 10, 14)',    'hsl(0, 0%, 88%)'],
  ['highway_major_casing',          'line-color', 'rgb(10, 10, 14)',    'rgb(213, 213, 213)'],
  ['highway_major_inner',           'line-color', 'rgb(12, 12, 16)',    '#ffffff'],
  ['highway_major_subtle',          'line-color', 'rgba(10,10,14,0.69)', 'hsla(0,0%,85%,0.69)'],
  ['highway_motorway_casing',       'line-color', 'rgb(10, 10, 14)',    'rgb(213, 213, 213)'],
  ['highway_motorway_inner',        'line-color', 'rgb(12, 12, 16)',    '#ffffff'],
  ['highway_motorway_subtle',       'line-color', 'rgba(10,10,14,0.53)', 'hsla(0,0%,85%,0.53)'],
  ['highway_motorway_bridge_casing','line-color', 'rgb(10, 10, 14)',    'rgb(213, 213, 213)'],
  ['highway_motorway_bridge_inner', 'line-color', 'rgb(12, 12, 16)',    '#ffffff'],
  ['road_area_pier',                'fill-color', 'rgb(8, 8, 12)',      'rgb(242, 243, 240)'],
  ['road_pier',                     'line-color', 'rgb(8, 8, 12)',      'rgb(242, 243, 240)'],
  ['railway',                       'line-color', 'rgb(10, 10, 14)',    '#dddddd'],
  ['railway_dashline',              'line-color', 'rgb(12, 12, 16)',    '#fafafa'],
  ['railway_transit',               'line-color', 'rgb(10, 10, 14)',    '#dddddd'],
  ['railway_transit_dashline',      'line-color', 'rgb(12, 12, 16)',    '#fafafa'],
  ['railway_service',               'line-color', 'rgb(10, 10, 14)',    '#dddddd'],
  ['railway_service_dashline',      'line-color', 'rgb(12, 12, 16)',    '#fafafa'],
  ['label_country_1',     'text-color',       'rgb(35, 35, 45)',    '#000000'],
  ['label_country_1',     'text-halo-color',  'rgb(2, 2, 4)',       '#ffffff'],
  ['label_country_2',     'text-color',       'rgb(35, 35, 45)',    '#000000'],
  ['label_country_2',     'text-halo-color',  'rgb(2, 2, 4)',       '#ffffff'],
  ['label_country_3',     'text-color',       'rgb(35, 35, 45)',    '#000000'],
  ['label_country_3',     'text-halo-color',  'rgb(2, 2, 4)',       '#ffffff'],
  ['label_city',          'text-color',       'rgb(35, 35, 45)',    '#000000'],
  ['label_city',          'text-halo-color',  'rgb(2, 2, 4)',       '#ffffff'],
  ['label_city_capital',  'text-color',       'rgb(35, 35, 45)',    '#000000'],
  ['label_city_capital',  'text-halo-color',  'rgb(2, 2, 4)',       '#ffffff'],
  ['label_town',          'text-color',       'rgb(35, 35, 45)',    '#000000'],
  ['label_town',          'text-halo-color',  'rgb(2, 2, 4)',       '#ffffff'],
  ['label_state',         'text-color',       'rgb(35, 35, 45)',    '#333333'],
  ['label_state',         'text-halo-color',  'rgb(2, 2, 4)',       '#ffffff'],
  ['waterway_line_label',   'text-halo-color', 'rgba(2, 2, 4, 0.7)',      'rgba(255, 255, 255, 0.7)'],
  ['waterway_line_label',   'text-color',      'rgb(20, 25, 40)',         'hsl(0, 0%, 66%)'],
  ['water_name_point_label','text-halo-color', 'rgba(2, 2, 4, 0.7)',      'rgba(255, 255, 255, 0.7)'],
  ['water_name_point_label','text-color',      'rgb(15, 20, 45)',         '#495e91'],
  ['water_name_line_label', 'text-halo-color', 'rgba(2, 2, 4, 0.7)',      'rgba(255, 255, 255, 0.7)'],
  ['water_name_line_label', 'text-color',      'rgb(15, 20, 45)',         '#495e91'],
];

export const mapStyles = {
  default: {
    name: 'OpenStreetMap (Raster)',
    style: {
      version: 8,
      sources: {
        'osm-raster': {
          type: 'raster',
          tiles: ['https://tile.openstreetmap.org/{z}/{x}/{y}.png'],
          tileSize: 256,
          attribution: '© OpenStreetMap contributors',
        },
      },
      layers: [
        {
          id: 'osm-raster-layer',
          type: 'raster',
          source: 'osm-raster',
        },
      ],
    } as StyleSpecification,
  },
  positron: {
    name: 'Positron',
    style: '../static/style/mapstyle.json' as string,
  },
};

export type MapStyleKey = keyof typeof mapStyles;

export const getMapStyle = (styleKey: MapStyleKey = 'default') => {
  return mapStyles[styleKey].style;
};


/**
 * Registers a tiled layer with the map, including its source.
 * Supports both raster and vector tile sources with opacity fade control.
 * @param map The MapLibre map instance
 * @param options Configuration for the layer registration
 */
export interface RegisterStyleOptions {
  id: string;
  tiles: string[];
  type: 'raster' | 'vector';
  tileSize?: number;
  attribution?: string;
  fadeZoomStart?: number;
  fadeZoomEnd?: number;
}

export function registerStyle(map: MaplibreGL.Map, options: RegisterStyleOptions): void {
  const {
    id,
    tiles,
    type,
    tileSize = 256,
    attribution = '',
    fadeZoomStart = 6,
    fadeZoomEnd = 10,
  } = options;

  const sourceId = `${id}-source`;
  const layerId = `${id}-layer`;

  if (!map.getSource(sourceId)) {
    map.addSource(sourceId, {
      type: type as any,
      tiles,
      ...(type === 'raster' && { tileSize }),
      ...(attribution && { attribution }),
    } as any);
  }

  if (!map.getLayer(layerId)) {
    const layerConfig: MaplibreGL.LayerSpecification = {
      id: layerId,
      type,
      source: sourceId,
      ...(type === 'raster' && {
        paint: {
          'raster-opacity': [
            'interpolate',
            ['linear'],
            ['zoom'],
            fadeZoomStart, 0,
            fadeZoomEnd, 1,
          ],
        },
      }),
      layout: {
        visibility: 'none',
      },
    } as any;

    map.addLayer(layerConfig);
  }
}