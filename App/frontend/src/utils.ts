export function calculateBounds(coordinates: [number, number][]): { minLng: number; maxLng: number; minLat: number; maxLat: number } {
  let minLng = coordinates[0][0];
  let maxLng = coordinates[0][0];
  let minLat = coordinates[0][1];
  let maxLat = coordinates[0][1];

  for (const [lng, lat] of coordinates) {
    minLng = Math.min(minLng, lng);
    maxLng = Math.max(maxLng, lng);
    minLat = Math.min(minLat, lat);
    maxLat = Math.max(maxLat, lat);
  }

  return { minLng, maxLng, minLat, maxLat };
}

export function calculateBoundsForPolygon(coords: number[][][]): [number, number, number, number] {
  let minLng = Infinity, maxLng = -Infinity, minLat = Infinity, maxLat = -Infinity;

  for (const ring of coords) {
    for (const [lng, lat] of ring) {
      minLng = Math.min(minLng, lng);
      maxLng = Math.max(maxLng, lng);
      minLat = Math.min(minLat, lat);
      maxLat = Math.max(maxLat, lat);
    }
  }

  return [minLng, minLat, maxLng, maxLat];
}

/**
 * Builds a MapLibre match expression array from an enum.
 * Maps enum numeric values to their string representations for use in layer rendering.
 * Works with any numeric enum.
 * @param enumType The enum to convert
 * @param defaultValue The default value to return if no match is found (default: 'Unknown')
 * @returns A match expression array for use in MapLibre layer properties
 */
export function buildEnumMapping(enumType: any, defaultValue: string = 'Unknown'): any[] {
  const mapping: any[] = ['match', ['get', 'type']];

  for (const [key, value] of Object.entries(enumType)) {
    if (!isNaN(Number(key))) continue; // Skip numeric keys
    mapping.push(Number(enumType[key as keyof typeof enumType]));
    mapping.push(key);
  }

  mapping.push(defaultValue);
  return mapping;
}
