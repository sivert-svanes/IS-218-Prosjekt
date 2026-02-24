import type * as MaplibreGL from "maplibre-gl";
declare global {
  interface Window {
    // The global injected by the CDN; optional because it may not be present in some environments
    maplibregl?: typeof MaplibreGL;
    // Exposed for debugging
    map?: MaplibreGL.Map;
  }
}

const maplibregl = window.maplibregl;
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

function registerLayer(layerId: string, label: string, visible: boolean = true, map: MaplibreGL.Map) {
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

/**
 * Gets firestations from db api, and adds layer for each conty
 * @param map The map the layers are added to
 * @param fylkeIds The ids of the counties to request
 */
export async function AddFireStationLayerGeospatial(map: MaplibreGL.Map, fylkeIds: number[]):Promise<void> {
  for (const fylkeId of fylkeIds) {
    try {
      const res = await fetch(`/api/fylke/${fylkeId}`);
      const geojson = await res.json();

      const sourceId = `brannstasjoner-fylke-${fylkeId}`;
      const layerId = `brannstasjoner-circle-${fylkeId}`;
      const fylkeNavn = geojson.fylke_navn || `Fylke ${fylkeId}`;

      map.addSource(sourceId, { type: 'geojson', data: geojson });

      map.addLayer({
        id: layerId,
        type: 'circle',
        source: sourceId,
        paint: {
          'circle-radius': 6,
          'circle-color': '#e74c3c',
          'circle-stroke-width': 1,
          'circle-stroke-color': '#ffffff',
        },
      });

      registerLayer(layerId, `Brannstasjoner Fylke ${fylkeNavn}`, true, map);

      // Add event listeners (same as before)
      map.on('click', layerId, (e) => {
        if (!e.features || e.features.length === 0) return;
        const feature = e.features[0];
        const coords = (feature.geometry as GeoJSON.Point).coordinates.slice() as [number, number];
        const props = feature.properties || {} as Record<string, string>;

        const html = `
          <div style="font-family: sans-serif; max-width: 260px;">
            <h3 style="margin: 0 0 6px 0; font-size: 14px;">${props.brannstasjon || 'Ukjent stasjon'}</h3>
            ${props.brannvesen ? `<p style="margin: 2px 0;"><strong>Brannvesen:</strong> ${props.brannvesen}</p>` : ''}
            ${props.stasjonstype ? `<p style="margin: 2px 0;"><strong>Stasjonstype:</strong> ${props.stasjonstype}</p>` : ''}
            ${props.kasernert ? `<p style="margin: 2px 0;"><strong>Kasernert:</strong> ${props.kasernert}</p>` : ''}
            <p style="margin: 2px 0;"><strong>Koordinater:</strong> ${coords[1].toFixed(6)}, ${coords[0].toFixed(6)}</p>
          </div>`;

        while (Math.abs(e.lngLat.lng - coords[0]) > 180) {
          coords[0] += e.lngLat.lng > coords[0] ? 360 : -360;
        }

        if (maplibregl) {
          new maplibregl.Popup({ offset: 10 }).setLngLat(coords).setHTML(html).addTo(map);
        }
      });

      map.on('mouseenter', layerId, () => { map.getCanvas().style.cursor = 'pointer'; });
      map.on('mouseleave', layerId, () => { map.getCanvas().style.cursor = ''; });

      // Optional: add a small delay between requests
      await new Promise(resolve => setTimeout(resolve, 100));

    } catch (err) {
      console.error(`Failed to load brannstasjoner for fylke ${fylkeId}:`, err);
    }
  }
}