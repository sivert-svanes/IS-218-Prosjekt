// @ts-ignore
import type * as MaplibreGL from 'maplibre-gl';

declare module 'maplibre-gl' {
  export interface Map {
    setProjection(projection: { type: string }): void;
  }
}
