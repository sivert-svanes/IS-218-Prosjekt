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

/**
 * Builds a MapLibre match expression for color mapping.
 * Maps enum numeric values to their corresponding colors from a color enum.
 * @param enumType The numeric enum to convert
 * @param colorEnum The enum containing color hex values
 * @param defaultColor The default color to use if no match is found (default: '#cccccc')
 * @returns A match expression array for use in MapLibre paint properties
 */
export function buildColorMapping(enumType: any, colorEnum: any, defaultColor: string = '#cccccc'): any[] {
  const mapping: any[] = ['match', ['get', 'type']];

  for (const [key, value] of Object.entries(enumType)) {
    if (!isNaN(Number(key))) continue; // Skip numeric keys
    const numericValue = Number(value);
    const color = (colorEnum as any)[key] || defaultColor;
    mapping.push(numericValue);
    mapping.push(color);
  }

  mapping.push(defaultColor);
  return mapping;
}

export function decodePolyline6(encoded: string): [number, number][] {
  const coords: [number, number][] = [];
  let index = 0;
  let lat = 0;
  let lng = 0;

  const decodeValue = () => {
    let result = 0;
    let shift = 0;
    let byte: number;
    do {
      byte = encoded.charCodeAt(index++) - 63;
      result |= (byte & 0x1f) << shift;
      shift += 5;
      if (byte < 0x20) break;
    } while (true);
    return result & 1 ? ~(result >> 1) : result >> 1;
  };

  while (index < encoded.length) {
    lat += decodeValue();
    lng += decodeValue();
    coords.push([lng / 1e6, lat / 1e6]);
  }

  return coords;
}

/**
 * Builds a pattern configuration object from a pattern enum.
 * Maps zone type names to their pattern styles.
 * @param patternEnum The pattern enum to convert
 * @returns A pattern configuration object for use in buildPatternMapping
 */
export function buildPatternConfig(patternEnum: any): { [key: string]: string } {
  const config: { [key: string]: string } = {};

  for (const [key, value] of Object.entries(patternEnum)) {
    if (!isNaN(Number(key))) continue; // Skip numeric keys
    config[key] = value as string;
  }

  return config;
}
