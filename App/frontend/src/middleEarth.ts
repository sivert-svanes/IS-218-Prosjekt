/**
 * 🧙 Middle-earth Easter Egg
 *
 * Activated via the Konami Code: ↑ ↑ ↓ ↓ ← → ← → B A
 *
 * Uses the publicly available ESRI Middle-earth vector tile service
 * rendered via MapLibre GL JS.
 */
import type * as MaplibreGL from 'maplibre-gl';

/** Middle-earth style using ESRI's public Middle-earth map tiles */
const MIDDLE_EARTH_STYLE: string =
  'https://raw.githubusercontent.com/jjrom/lotr-map/main/lotr_mapstyle.json';

/** Fallback: a hand-crafted raster-based style pointing at ESRI's Middle-earth tile service */
function buildMiddleEarthRasterStyle(): object {
  return {
    version: 8,
    name: 'Middle-earth',
    sources: {
      'middle-earth': {
        type: 'raster',
        tiles: [
          'https://tiles.arcgis.com/tiles/P3ePLMYs2RVChkJx/arcgis/rest/services/Middle_earth_Imagery/MapServer/tile/{z}/{y}/{x}',
        ],
        tileSize: 256,
        attribution: '© Esri, Middle-earth',
        minzoom: 0,
        maxzoom: 10,
      },
    },
    layers: [
      {
        id: 'middle-earth-tiles',
        type: 'raster',
        source: 'middle-earth',
        minzoom: 0,
        maxzoom: 22,
      },
    ],
  };
}

let isActive = false;
let savedStyle: string | object | null = null;
let savedCenter: [number, number] | null = null;
let savedZoom: number | null = null;
let savedProjection: string | null = null;
let banner: HTMLElement | null = null;

/** Create and show the "You have found the One Map" banner */
function showBanner(): void {
  if (banner) return;
  banner = document.createElement('div');
  banner.id = 'me-banner';
  banner.innerHTML = `
    <div class="me-inner">
      <div class="me-rune">💍</div>
      <div class="me-title">ONE MAP TO RULE THEM ALL</div>
      <div class="me-subtitle">Middle-earth mode activated — press <kbd>Esc</kbd> to return</div>
    </div>`;
  document.body.appendChild(banner);

  // Auto-hide after 4 s
  setTimeout(() => {
    banner?.classList.add('me-fade-out');
    setTimeout(() => { banner?.remove(); banner = null; }, 600);
  }, 4000);
}

/** Remove the banner if still visible */
function hideBanner(): void {
  banner?.remove();
  banner = null;
}

export function isMiddleEarthActive(): boolean {
  return isActive;
}

/**
 * Activate Middle-earth mode.
 * Saves the current map state, then swaps in the ME style + flies to Middle-earth.
 */
export async function activateMiddleEarth(map: MaplibreGL.Map): Promise<void> {
  if (isActive) return;
  isActive = true;

  // Save current state
  const center = map.getCenter();
  savedCenter = [center.lng, center.lat];
  savedZoom = map.getZoom();
  savedProjection = 'globe'; // default projection used by this app
  savedStyle = map.getStyle();

  showBanner();

  // Swap style – try the community GeoJSON-based style first, fall back to ESRI raster
  try {
    await new Promise<void>((resolve, reject) => {
      // Listen for style.load ONCE
      const onLoaded = () => { map.off('style.load', onLoaded); resolve(); };
      const onError = (e: any) => { map.off('error', onError); reject(e); };
      map.once('style.load', onLoaded);
      map.once('error', onError);
      map.setStyle(MIDDLE_EARTH_STYLE);
    });
  } catch {
    console.warn('[ME] Community style failed, falling back to ESRI raster tiles.');
    await new Promise<void>((resolve) => {
      map.once('style.load', () => resolve());
      map.setStyle(buildMiddleEarthRasterStyle() as any);
    });
  }

  // Turn off globe projection – Middle-earth is flat (like Tolkien intended)
  try {
    map.setProjection({ type: 'mercator' } as any);
  } catch { /* projection API may not be available */ }

  // Fly to the centre of Middle-earth (Rohan/Gondor region in the image)
  map.flyTo({
    center: [0, 0],    // The tile service is centred on 0,0 by design
    zoom: 3,
    duration: 2500,
    easing: (t) => t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t,
  });

  // Listen for Escape key to deactivate
  window.addEventListener('keydown', onEscape);
}

/**
 * Deactivate Middle-earth mode and restore the previous map state.
 */
export async function deactivateMiddleEarth(map: MaplibreGL.Map): Promise<void> {
  if (!isActive) return;
  isActive = false;
  hideBanner();
  window.removeEventListener('keydown', onEscape);

  if (!savedStyle) return;

  await new Promise<void>((resolve) => {
    map.once('style.load', () => resolve());
    map.setStyle(savedStyle as any);
  });

  if (savedProjection) {
    try { map.setProjection({ type: savedProjection } as any); } catch { /* ignore */ }
  }

  map.flyTo({
    center: savedCenter ?? [10, 60],
    zoom: savedZoom ?? 6,
    duration: 2000,
  });
}

let _mapRef: MaplibreGL.Map | null = null;

function onEscape(e: KeyboardEvent): void {
  if (e.key === 'Escape' && _mapRef) {
    deactivateMiddleEarth(_mapRef);
  }
}

/** The Konami Code sequence */
const KONAMI = [
  'ArrowUp', 'ArrowUp',
  'ArrowDown', 'ArrowDown'
];

let konamiIndex = 0;

/**
 * Register the Konami Code listener on the document.
 * Pass the map instance so it can be toggled when the code is entered.
 */
export function registerKonamiCode(map: MaplibreGL.Map): void {
  _mapRef = map;
  document.addEventListener('keydown', (e: KeyboardEvent) => {
    const expected = KONAMI[konamiIndex];
    if (e.key === expected) {
      konamiIndex++;
      if (konamiIndex === KONAMI.length) {
        konamiIndex = 0;
        if (isActive) {
          deactivateMiddleEarth(map);
        } else {
          activateMiddleEarth(map);
        }
      }
    } else {
      // Partial reset – if first key matches, keep it
      konamiIndex = e.key === KONAMI[0] ? 1 : 0;
    }
  });
}
