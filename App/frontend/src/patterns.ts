import type * as MaplibreGL from "maplibre-gl";
import { PatternType } from './enum.js';

// Default pattern options
const DEFAULT_PATTERN_OPTIONS = {
  width: 10,
  height: 10,
  lineWidth: 2,
  lineColor: '#000000',
  lineOpacity: 0.1,
  backgroundColor: 'transparent',
  backgroundOpacity: 0.3,
  pixelRatio: 2,
};

/**
 * Draws a background on a canvas context
 * @param ctx The 2D canvas context
 * @param width The width of the canvas
 * @param height The height of the canvas
 * @param backgroundColor The background color ('transparent' for no background)
 * @param backgroundOpacity The opacity of the background (0-1)
 */
function drawBackground(ctx: CanvasRenderingContext2D, width: number, height: number, backgroundColor: string, backgroundOpacity: number = 1): void {
  if (backgroundColor !== 'transparent') {
    ctx.fillStyle = backgroundColor;
    ctx.globalAlpha = backgroundOpacity;
    ctx.fillRect(0, 0, width, height);
    ctx.globalAlpha = 1; // Reset alpha
  }
}

/**
 * Adds a solid color pattern to the map (background only, no pattern lines)
 * @param map The MapLibre map instance
 * @param patternName The name/id for the pattern (default: 'solid-pattern')
 * @param options Configuration options for the pattern
 */
export function addSolidPattern(
  map: MaplibreGL.Map,
  patternName: string = 'solid-pattern',
  options: {
    width?: number;
    height?: number;
    backgroundColor?: string;
    backgroundOpacity?: number;
    pixelRatio?: number;
  } = {}
): void {
  const {
    width = DEFAULT_PATTERN_OPTIONS.width,
    height = DEFAULT_PATTERN_OPTIONS.height,
    backgroundColor = DEFAULT_PATTERN_OPTIONS.backgroundColor,
    backgroundOpacity = DEFAULT_PATTERN_OPTIONS.backgroundOpacity,
    pixelRatio = DEFAULT_PATTERN_OPTIONS.pixelRatio,
  } = options;

  const canvas = document.createElement('canvas');
  // Render at higher resolution for anti-aliasing
  canvas.width = width * pixelRatio;
  canvas.height = height * pixelRatio;
  const ctx = canvas.getContext('2d')!;

  // Scale context for higher DPI rendering
  ctx.scale(pixelRatio, pixelRatio);

  // Draw background only (no pattern lines)
  drawBackground(ctx, width, height, backgroundColor, backgroundOpacity);

  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  map.addImage(patternName, imageData, { sdf: false, pixelRatio });
}

/**
 * Adds a chevron pattern to the map
 * @param map The MapLibre map instance
 * @param patternName The name/id for the pattern (default: 'chevron-pattern')
 * @param options Configuration options for the pattern
 */
export function addSawtoothPattern(
  map: MaplibreGL.Map,
  patternName: string = 'chevron-pattern',
  options: {
    width?: number;
    height?: number;
    lineWidth?: number;
    lineColor?: string;
    lineOpacity?: number;
    backgroundColor?: string;
    backgroundOpacity?: number;
    pixelRatio?: number;
  } = {}
): void {
  const {
    width = DEFAULT_PATTERN_OPTIONS.width,
    height = DEFAULT_PATTERN_OPTIONS.height,
    lineWidth = DEFAULT_PATTERN_OPTIONS.lineWidth,
    lineColor = DEFAULT_PATTERN_OPTIONS.lineColor,
    lineOpacity = DEFAULT_PATTERN_OPTIONS.lineOpacity,
    backgroundColor = DEFAULT_PATTERN_OPTIONS.backgroundColor,
    backgroundOpacity = DEFAULT_PATTERN_OPTIONS.backgroundOpacity,
    pixelRatio = DEFAULT_PATTERN_OPTIONS.pixelRatio,
  } = options;

  const canvas = document.createElement('canvas');
  // Render at higher resolution for anti-aliasing
  canvas.width = width * pixelRatio;
  canvas.height = height * pixelRatio;
  const ctx = canvas.getContext('2d')!;

  // Scale context for higher DPI rendering
  ctx.scale(pixelRatio, pixelRatio);

  // Draw background
  drawBackground(ctx, width, height, backgroundColor, backgroundOpacity);

  // Draw chevron pattern with opacity
  ctx.strokeStyle = lineColor;
  ctx.lineWidth = lineWidth;
  ctx.globalAlpha = lineOpacity;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  // Draw diagonal lines for chevron effect
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.lineTo(width / 2, height / 2);
  ctx.moveTo(width / 2, height / 2);
  ctx.lineTo(width, 0);
  ctx.stroke();

  ctx.globalAlpha = 1; // Reset alpha

  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  map.addImage(patternName, imageData, { sdf: false, pixelRatio });
}

/**
 * Adds a wavy pattern to the map
 * @param map The MapLibre map instance
 * @param patternName The name/id for the pattern (default: 'wavy-pattern')
 * @param options Configuration options for the pattern
 */
export function addWavyPattern(
  map: MaplibreGL.Map,
  patternName: string = 'wavy-pattern',
  options: {
    width?: number;
    height?: number;
    lineWidth?: number;
    lineColor?: string;
    lineOpacity?: number;
    backgroundColor?: string;
    backgroundOpacity?: number;
    amplitude?: number;
    frequency?: number;
    pixelRatio?: number;
  } = {}
): void {
  const {
    width = DEFAULT_PATTERN_OPTIONS.width,
    height = DEFAULT_PATTERN_OPTIONS.height,
    lineWidth = DEFAULT_PATTERN_OPTIONS.lineWidth,
    lineColor = DEFAULT_PATTERN_OPTIONS.lineColor,
    lineOpacity = DEFAULT_PATTERN_OPTIONS.lineOpacity,
    backgroundColor = DEFAULT_PATTERN_OPTIONS.backgroundColor,
    backgroundOpacity = DEFAULT_PATTERN_OPTIONS.backgroundOpacity,
    amplitude = height / 3,
    frequency = 0.5,
    pixelRatio = DEFAULT_PATTERN_OPTIONS.pixelRatio,
  } = options;

  const canvas = document.createElement('canvas');
  // Render at higher resolution for anti-aliasing
  canvas.width = width * pixelRatio;
  canvas.height = height * pixelRatio;
  const ctx = canvas.getContext('2d')!;

  // Scale context for higher DPI rendering
  ctx.scale(pixelRatio, pixelRatio);

  // Draw background
  drawBackground(ctx, width, height, backgroundColor, backgroundOpacity);

  // Draw wavy pattern with opacity
  ctx.strokeStyle = lineColor;
  ctx.lineWidth = lineWidth;
  ctx.globalAlpha = lineOpacity;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  // Draw horizontal wavy lines
  ctx.beginPath();
  const centerY = height / 2;
  ctx.moveTo(0, centerY);
  for (let x = 0; x <= width; x += 0.5) {
    const y = centerY + Math.sin((x / width) * Math.PI * 2 * frequency) * amplitude;
    ctx.lineTo(x, y);
  }
  ctx.stroke();

  ctx.globalAlpha = 1; // Reset alpha

  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  map.addImage(patternName, imageData, { sdf: false, pixelRatio });
}

/**
 * Adds a cross (X) pattern to the map
 * @param map The MapLibre map instance
 * @param patternName The name/id for the pattern (default: 'cross-pattern')
 * @param options Configuration options for the pattern
 */
export function addCrossPattern(
  map: MaplibreGL.Map,
  patternName: string = 'cross-pattern',
  options: {
    width?: number;
    height?: number;
    lineWidth?: number;
    lineColor?: string;
    lineOpacity?: number;
    backgroundColor?: string;
    backgroundOpacity?: number;
    pixelRatio?: number;
  } = {}
): void {
  const {
    width = DEFAULT_PATTERN_OPTIONS.width,
    height = DEFAULT_PATTERN_OPTIONS.height,
    lineWidth = DEFAULT_PATTERN_OPTIONS.lineWidth,
    lineColor = DEFAULT_PATTERN_OPTIONS.lineColor,
    lineOpacity = DEFAULT_PATTERN_OPTIONS.lineOpacity,
    backgroundColor = DEFAULT_PATTERN_OPTIONS.backgroundColor,
    backgroundOpacity = DEFAULT_PATTERN_OPTIONS.backgroundOpacity,
    pixelRatio = DEFAULT_PATTERN_OPTIONS.pixelRatio,
  } = options;

  const canvas = document.createElement('canvas');
  // Render at higher resolution for anti-aliasing
  canvas.width = width * pixelRatio;
  canvas.height = height * pixelRatio;
  const ctx = canvas.getContext('2d')!;

  // Scale context for higher DPI rendering
  ctx.scale(pixelRatio, pixelRatio);

  // Draw background
  drawBackground(ctx, width, height, backgroundColor, backgroundOpacity);

  // Draw cross (X) pattern with opacity
  ctx.strokeStyle = lineColor;
  ctx.lineWidth = lineWidth;
  ctx.globalAlpha = lineOpacity;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  // Draw X pattern (two diagonal lines)
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.lineTo(width, height);
  ctx.moveTo(width, 0);
  ctx.lineTo(0, height);
  ctx.stroke();

  ctx.globalAlpha = 1; // Reset alpha

  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  map.addImage(patternName, imageData, { sdf: false, pixelRatio });
}

/**
 * Adds an angled lines pattern to the map (vertical lines tilted 30 degrees to the right)
 * @param map The MapLibre map instance
 * @param patternName The name/id for the pattern (default: 'angled-lines-pattern')
 * @param options Configuration options for the pattern
 */
export function addAngledLinesPattern(
  map: MaplibreGL.Map,
  patternName: string = 'angled-lines-pattern',
  options: {
    width?: number;
    height?: number;
    lineWidth?: number;
    lineColor?: string;
    lineOpacity?: number;
    backgroundColor?: string;
    backgroundOpacity?: number;
    spacing?: number;
    pixelRatio?: number;
  } = {}
): void {
  const {
    width = 40,
    height = 40,
    lineWidth = DEFAULT_PATTERN_OPTIONS.lineWidth,
    lineColor = DEFAULT_PATTERN_OPTIONS.lineColor,
    lineOpacity = DEFAULT_PATTERN_OPTIONS.lineOpacity,
    backgroundColor = DEFAULT_PATTERN_OPTIONS.backgroundColor,
    backgroundOpacity = DEFAULT_PATTERN_OPTIONS.backgroundOpacity,
    spacing = 8,
    pixelRatio = DEFAULT_PATTERN_OPTIONS.pixelRatio,
  } = options;

  const canvas = document.createElement('canvas');
  // Render at higher resolution for anti-aliasing
  canvas.width = width * pixelRatio;
  canvas.height = height * pixelRatio;
  const ctx = canvas.getContext('2d')!;

  // Scale context for higher DPI rendering
  ctx.scale(pixelRatio, pixelRatio);

  // Draw background
  drawBackground(ctx, width, height, backgroundColor, backgroundOpacity);

  // Draw angled lines pattern with opacity
  ctx.strokeStyle = lineColor;
  ctx.lineWidth = lineWidth;
  ctx.globalAlpha = lineOpacity;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  // Draw vertical lines tilted 30 degrees to the right
  const angle = (31 * Math.PI) / 180;
  const lineSpacing = spacing;
  const horizontalShift = height * Math.tan(angle);

  // Draw lines that completely fill the tile and wrap seamlessly
  ctx.beginPath();

  // Start from far left to ensure complete coverage
  // Lines need to fill from left edge to right edge as they go from top to bottom
  const startOffset = -Math.ceil(horizontalShift);
  const endOffset = width + Math.ceil(horizontalShift);

  for (let x = startOffset; x < endOffset; x += lineSpacing) {
    const startX = x;
    const startY = 0;
    const endX = x - horizontalShift;
    const endY = height;

    ctx.moveTo(startX, startY);
    ctx.lineTo(endX, endY);
  }
  ctx.stroke();

  ctx.globalAlpha = 1; // Reset alpha

  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  map.addImage(patternName, imageData, { sdf: false, pixelRatio });
}

/**
 * Adds a vertical sine wave pattern to the map (represents air movement)
 * @param map The MapLibre map instance
 * @param patternName The name/id for the pattern (default: 'vertical-waves-pattern')
 * @param options Configuration options for the pattern
 */
export function addVerticalWavesPattern(
  map: MaplibreGL.Map,
  patternName: string = 'vertical-waves-pattern',
  options: {
    width?: number;
    height?: number;
    lineWidth?: number;
    lineColor?: string;
    lineOpacity?: number;
    backgroundColor?: string;
    backgroundOpacity?: number;
    amplitude?: number;
    frequency?: number;
    pixelRatio?: number;
  } = {}
): void {
  const {
    width = DEFAULT_PATTERN_OPTIONS.width,
    height = 80,
    lineWidth = DEFAULT_PATTERN_OPTIONS.lineWidth,
    lineColor = DEFAULT_PATTERN_OPTIONS.lineColor,
    lineOpacity = DEFAULT_PATTERN_OPTIONS.lineOpacity,
    backgroundColor = DEFAULT_PATTERN_OPTIONS.backgroundColor,
    backgroundOpacity = DEFAULT_PATTERN_OPTIONS.backgroundOpacity,
    amplitude = width / 6,
    frequency = 1,
    pixelRatio = DEFAULT_PATTERN_OPTIONS.pixelRatio,
  } = options;

  const canvas = document.createElement('canvas');
  // Render at higher resolution for anti-aliasing
  canvas.width = width * pixelRatio;
  canvas.height = height * pixelRatio;
  const ctx = canvas.getContext('2d')!;

  // Scale context for higher DPI rendering
  ctx.scale(pixelRatio, pixelRatio);

  // Draw background
  drawBackground(ctx, width, height, backgroundColor, backgroundOpacity);

  // Draw vertical sine wave pattern with opacity
  ctx.strokeStyle = lineColor;
  ctx.lineWidth = lineWidth;
  ctx.globalAlpha = lineOpacity;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  // Draw vertical wavy lines (sine waves oriented vertically)
  const centerX = width / 2;

  ctx.beginPath();
  ctx.moveTo(centerX, 0);
  for (let y = 0; y <= height; y += 0.5) {
    const x = centerX + Math.sin((y / height) * Math.PI * 2 * frequency) * amplitude;
    ctx.lineTo(x, y);
  }
  ctx.stroke();

  // Draw additional waves on the sides for a more continuous pattern
  for (let offset = -width / 2; offset < width; offset += width / 2) {
    const waveCenter = centerX + offset;
    ctx.beginPath();
    ctx.moveTo(waveCenter, 0);
    for (let y = 0; y <= height; y += 0.5) {
      const x = waveCenter + Math.sin((y / height) * Math.PI * 2 * frequency) * amplitude;
      ctx.lineTo(x, y);
    }
    ctx.stroke();
  }

  ctx.globalAlpha = 1; // Reset alpha

  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  map.addImage(patternName, imageData, { sdf: false, pixelRatio });
}

/**
 * Builds a pattern mapping for exclusion zones with support for different pattern types per zone
 * @param map The MapLibre map instance
 * @param zoneTypeEnum The exclusion zone type enum
 * @param colorEnum The color enum for each zone type
 * @param patternConfig Configuration for which pattern type each zone should use
 */
export function buildPatternMapping(
  map: MaplibreGL.Map,
  zoneTypeEnum: any,
  colorEnum: any,
  patternConfig: { [key: string]: string } = {}
): any[] {
  const patternMapping: any[] = ['match', ['get', 'type']];

  for (const [key, value] of Object.entries(zoneTypeEnum)) {
    if (!isNaN(Number(key))) continue; // Skip numeric keys

    const numericValue = Number(value);
    const color = (colorEnum as any)[key] || '#cccccc';
    const patternType = patternConfig[key] || PatternType.Solid; // Default to solid
    const patternName = `${patternType}-pattern-${numericValue}`;

    // Add the pattern to the map based on type
    if (patternType === PatternType.Wavy) {
      addWavyPattern(map, patternName, { backgroundColor: color, lineColor: color });
    } else if (patternType === PatternType.Sawtooth) {
      addSawtoothPattern(map, patternName, { backgroundColor: color, lineColor: color });
    } else if (patternType === PatternType.Cross) {
      addCrossPattern(map, patternName, { backgroundColor: color, lineColor: color });
    } else if (patternType === PatternType.AngledLines) {
      addAngledLinesPattern(map, patternName, { backgroundColor: color, lineColor: color });
    } else if (patternType === PatternType.VerticalWaves) {
      addVerticalWavesPattern(map, patternName, { backgroundColor: color, lineColor: color });
    } else {
      addSolidPattern(map, patternName, { backgroundColor: color });
    }

    patternMapping.push(numericValue);
    patternMapping.push(patternName);
  }

  patternMapping.push('solid-pattern-1'); // Default pattern
  return patternMapping;
}