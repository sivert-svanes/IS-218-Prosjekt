import type * as MaplibreGL from "maplibre-gl";

const layersToggle = document.getElementById('layers-toggle');
const layersMenu   = document.getElementById('layers-menu');
const stylesToggle = document.getElementById('styles-toggle');
const stylesMenu   = document.getElementById('styles-menu');
const overlay      = document.querySelector('.map-overlay') as HTMLElement | null;

//Tracks enabled layers
export const layerCheckboxes = new Map<string, HTMLInputElement>();

/**
 * Helper function to close both dropdowns
 */
export function closeAllDropdowns(): void {
  layersMenu?.classList.remove('open');
  stylesMenu?.classList.remove('open');
  overlay?.classList.remove('dropdown-open');
}

/**
 * Helper function to open a specific dropdown
 */
export function openDropdown(menu: HTMLElement | null, toggle: HTMLElement | null): void {
  if (!menu || !overlay) return;

  // Close the other menu
  if (menu === layersMenu) {
    stylesMenu?.classList.remove('open');
  } else {
    layersMenu?.classList.remove('open');
  }

  menu.classList.add('open');
  overlay.classList.add('dropdown-open');

  const overlayRect = overlay.getBoundingClientRect();
  menu.style.top = overlayRect.bottom + 'px';
  menu.style.left = overlayRect.left + 'px';
  menu.style.width = overlayRect.width + 'px';
}

/**
 * Initialize dropdown menu event listeners
 */
export function initializeDropdownMenus(): void {
  layersToggle?.addEventListener('click', (e) => {
    e.stopPropagation();
    const isOpen = layersMenu?.classList.contains('open');
    closeAllDropdowns();
    if (!isOpen) {
      openDropdown(layersMenu, layersToggle);
    }
  });

  stylesToggle?.addEventListener('click', (e) => {
    e.stopPropagation();
    const isOpen = stylesMenu?.classList.contains('open');
    closeAllDropdowns();
    if (!isOpen) {
      openDropdown(stylesMenu, stylesToggle);
    }
  });

  document.addEventListener('click', () => {
    closeAllDropdowns();
  });

  // Prevent clicks inside the menus from closing them
  layersMenu?.addEventListener('click', (e) => e.stopPropagation());
  stylesMenu?.addEventListener('click', (e) => e.stopPropagation());
}

/**
 * Register a map layer in the Layers dropdown so the user can toggle it.
 * @param layerId The MapLibre layer id to toggle visibility for.
 * @param label Human-readable label shown in the menu.
 * @param visible Whether the layer starts visible (default true).
 * @param map The map to add the layer to
 */
export function registerLayer(layerId: string, label: string, visible: boolean, map: MaplibreGL.Map): void {
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

  layerCheckboxes.set(layerId, cb);
}

/**
 * Register a style layer in the Styles dropdown menu so the user can toggle it.
 * @param styleId The style id (as used in registerStyle)
 * @param label Human-readable label shown in the menu
 * @param visible Whether the layer starts visible (default false)
 * @param map The map instance
 */
export function registerStyleInMenu(styleId: string, label: string, visible: boolean, map: MaplibreGL.Map): void {
  if (!stylesMenu) return;

  // Remove the "no styles" placeholder if present
  const empty = stylesMenu.querySelector('.dropdown-empty');
  if (empty) empty.remove();

  const layerId = `${styleId}-layer`;

  const item = document.createElement('label');
  item.className = 'dropdown-item prevent-select';

  const cb = document.createElement('input');
  cb.type = 'checkbox';
  cb.checked = visible;

  cb.addEventListener('change', () => {
    if (map.getLayer(layerId)) {
      map.setLayoutProperty(layerId, 'visibility', cb.checked ? 'visible' : 'none');
    }
  });

  const span = document.createElement('span');
  span.textContent = label;

  item.appendChild(cb);
  item.appendChild(span);
  stylesMenu.appendChild(item);
}