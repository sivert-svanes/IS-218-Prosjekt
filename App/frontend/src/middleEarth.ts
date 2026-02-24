/**
 * Middle-earth Mode for Maplibre GL JS
 * Konami Code: gandalf
 */
import type * as MaplibreGL from 'maplibre-gl';

const ME_SOURCE = 'middle-earth-source';
const ME_LAYER  = 'middle-earth-layer';
const ME_BG     = 'middle-earth-bg';

// ESRI Middle-earth tile service – note ESRI uses {z}/{y}/{x} row/col order
const ME_TILE_URL =
  'https://tiles.arcgis.com/tiles/CBiB2HwHGXUi8D4Y/arcgis/rest/services/Middle_Earth_Overlay_Map/MapServer/tile/{z}/{y}/{x}';

let isActive = false;
let savedCenter: [number, number] | null = null;
let savedZoom: number | null = null;
let savedLayerVisibility: Map<string, string> = new Map();
let banner: HTMLElement | null = null;

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

// Remove the banner if still visible
function hideBanner(): void {
  banner?.remove();
  banner = null;
}

export function isMiddleEarthActive(): boolean {
  return isActive;
}

export async function activateMiddleEarth(map: MaplibreGL.Map): Promise<void> {
  if (isActive) return;
  isActive = true;

  const center = map.getCenter();
  savedCenter = [center.lng, center.lat];
  savedZoom   = map.getZoom();

  showBanner();

  // Hide all existing layers, saving their visibility
  savedLayerVisibility.clear();
  for (const layer of map.getStyle().layers) {
    const vis = (map.getLayoutProperty(layer.id, 'visibility') as string) ?? 'visible';
    savedLayerVisibility.set(layer.id, vis);
    map.setLayoutProperty(layer.id, 'visibility', 'none');
  }

  if (!map.getLayer(ME_BG)) {
    map.addLayer({ id: ME_BG, type: 'background', paint: { 'background-color': '#1a1008' } } as any);
  }

  if (!map.getSource(ME_SOURCE)) {
    map.addSource(ME_SOURCE, {
      type: 'raster',
      tiles: [ME_TILE_URL],
      tileSize: 256,
      attribution: '© Esri, Middle-earth',
    });
  }
  if (!map.getLayer(ME_LAYER)) {
    map.addLayer({ id: ME_LAYER, type: 'raster', source: ME_SOURCE } as any);
  }

  map.setProjection({ type: 'mercator' } as any);

  map.setMinZoom(2);
  map.setMaxZoom(8);

  map.flyTo({ center: [45, 52], zoom: 2.25});
  window.addEventListener('keydown', onEscape);
}

export async function deactivateMiddleEarth(map: MaplibreGL.Map): Promise<void> {
  if (!isActive) return;
  isActive = false;
  hideBanner();
  window.removeEventListener('keydown', onEscape);

  if (map.getLayer(ME_LAYER)) map.removeLayer(ME_LAYER);
  if (map.getLayer(ME_BG))    map.removeLayer(ME_BG);
  if (map.getSource(ME_SOURCE)) map.removeSource(ME_SOURCE);

  // Restore globe projection and remove ME constraints
  map.setProjection({ type: 'globe' } as any);
  map.setMinZoom(0);
  map.setMaxZoom(22);

  // Restore all layer visibility
  for (const [id, vis] of savedLayerVisibility) {
    if (map.getLayer(id)) map.setLayoutProperty(id, 'visibility', vis);
  }
  savedLayerVisibility.clear();

  map.flyTo({
    center: savedCenter ?? [10, 60],
    zoom:   savedZoom   ?? 6,
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
  'g', 'a', 'n', 'd', 'a', 'l', 'f',
];

let konamiIndex = 0;

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
      konamiIndex = e.key === KONAMI[0] ? 1 : 0;
    }
  });
}
