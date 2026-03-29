/**
 * Map style configurations for the application
 */

import type { StyleSpecification } from 'maplibre-gl';

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

export const getMapStyleName = (styleKey: MapStyleKey = 'default') => {
  return mapStyles[styleKey].name;
};
