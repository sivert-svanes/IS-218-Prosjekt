// Use the global provided by the CDN instead of importing a node-style package
const maplibregl = (window as any).maplibregl;

// Wait for DOM to ensure #map exists
document.addEventListener('DOMContentLoaded', () => {
  const mapEl = document.getElementById('map');
  if (!mapEl) {
    console.warn('Map element #map not found');
    return;
  }

  // Initialize MapLibre map (same options as original inline script)
  const map = new (maplibregl as any).Map({
    container: 'map',
    style: 'https://tiles.openfreemap.org/styles/positron',
    center: [0, 0],
    zoom: 2
  });

  // Expose for debugging
  (window as any).map = map;
});
