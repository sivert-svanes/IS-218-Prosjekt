// @ts-ignore
import type * as MaplibreGL from 'maplibre-gl';

declare module 'maplibre-gl' {
  export interface Map {
    setProjection(projection: { type: string }): void;
    transform: MapTransform;
  }

  export interface MapTransform {
    modelViewProjectionMatrix: Float64Array;
    inverseProjectionMatrix: Float64Array;
    worldSize: number;
    center: { lng: number; lat: number };
    pitch: number;
    bearing: number;
    pitchInRadians?: number;
    bearingInRadians?: number;
    rollInRadians?: number;
    getProjectionData(options: {
      overscaledTileID: null;
      applyGlobeMatrix: boolean;
      applyTerrainMatrix: boolean;
    }): { projectionTransition: number };
  }
}
