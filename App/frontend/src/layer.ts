import type * as MaplibreGL from "maplibre-gl";

declare global {
  interface Window {
    // The global injected by the CDN; optional because it may not be present in some environments
    maplibregl?: typeof MaplibreGL;
    // Exposed for debugging
    map?: MaplibreGL.Map;
  }
}

const layersToggle = document.getElementById('layers-toggle');
const layersMenu   = document.getElementById('layers-menu');

// Open / close the dropdown when clicking the toggle button
const overlay = document.querySelector('.map-overlay') as HTMLElement | null;
layersToggle?.addEventListener('click', (e) => {
  e.stopPropagation();
  layersMenu?.classList.toggle('open');
  overlay?.classList.toggle('dropdown-open');
  // Align dropdown to span the full overlay width
  if (layersMenu?.classList.contains('open') && overlay) {
    const overlayRect = overlay.getBoundingClientRect();
    layersMenu.style.top = overlayRect.bottom + 'px';
    layersMenu.style.left = overlayRect.left + 'px';
    layersMenu.style.width = overlayRect.width + 'px';
  }
});
document.addEventListener('click', () => {
  layersMenu?.classList.remove('open');
  overlay?.classList.remove('dropdown-open');
});
// Prevent clicks inside the menu from closing it
layersMenu?.addEventListener('click', (e) => e.stopPropagation());

/**
 * Register a map layer in the Layers dropdown so the user can toggle it.
 *
 * @param layerId The MapLibre layer id to toggle visibility for.
 * @param label Human-readable label shown in the menu.
 * @param visible Whether the layer starts visible (default true).
 * @param map The map to add the layer to
 */
export function registerLayer(layerId: string, label: string, visible: boolean = true, map: MaplibreGL.Map) {
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

