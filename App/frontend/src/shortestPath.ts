import type * as MaplibreGL from "maplibre-gl";

let roadNetworkCache: any = null;
const WGS84_CONSTANT = 20037508.34;

async function ensureRoadNetworkLoaded(map: MaplibreGL.Map): Promise<void> {
  if (roadNetworkCache) return;

  const bounds = map.getBounds();
  const toMercator = (deg: number, isSin: boolean) => {
    const rad = (deg + 90) / 360 * Math.PI;
    return (isSin ? Math.log(Math.tan(rad)) : deg / 180) * WGS84_CONSTANT;
  };

  const response = await fetch(
    `/api/nvdb/roads?min_x=${toMercator(bounds.getWest(), false)}&min_y=${toMercator(bounds.getSouth(), true)}&max_x=${toMercator(bounds.getEast(), false)}&max_y=${toMercator(bounds.getNorth(), true)}&road_types=Enkel%20bilveg,Bilferje,Rampe,Rundkj%C3%B8ring,Kanalisert%20veg`
  );

  if (response.ok) roadNetworkCache = await response.json();
}

function findNearestShelter(lat: number, lng: number, shelters: any): {lat: number, lng: number} | null {
  let nearest = null;
  let minDistance = Infinity;

  shelters.features?.forEach((f: any) => {
    if (f.geometry.type !== 'Point') return;
    const [sLng, sLat] = f.geometry.coordinates;
    const dist = Math.hypot(sLng - lng, sLat - lat);
    if (dist < minDistance) {
      minDistance = dist;
      nearest = { lat: sLat, lng: sLng };
    }
  });

  return nearest;
}

export async function calculateAndDisplayPath(map: MaplibreGL.Map, lat: number, lng: number): Promise<void> {
  try {
    await ensureRoadNetworkLoaded(map);
    if (!roadNetworkCache?.features) return;

    // Collect all shelters
    const allShelters = { type: 'FeatureCollection' as const, features: [] as any[] };
    for (let i = 1; i <= 15; i++) {
      const source = map.getSource(`shelters-fylke-${i}`);
      if (!source || !('_data' in source)) continue;
      let data = (source as any)._data;
      if (data?.geojson) data = data.geojson;
      if (data?.features) allShelters.features.push(...data.features);
    }

    if (allShelters.features.length === 0) return;

    const shelter = findNearestShelter(lat, lng, allShelters);
    if (!shelter) return;

    const sourceId = 'shortest-path-source';
    const layerId = 'shortest-path-layer';

    if (map.getLayer(layerId)) map.removeLayer(layerId);
    if (map.getSource(sourceId)) map.removeSource(sourceId);

    map.addSource(sourceId, {
      type: 'geojson',
      data: {
        type: 'FeatureCollection',
        features: [{
          type: 'Feature',
          geometry: {
            type: 'LineString',
            coordinates: [[lng, lat], [shelter.lng, shelter.lat]]
          },
          properties: {}
        }]
      }
    });

    map.addLayer({
      id: layerId,
      type: 'line',
      source: sourceId,
      paint: { 'line-color': '#00FF00', 'line-width': 4, 'line-opacity': 0.9 },
      layout: { 'line-join': 'round', 'line-cap': 'round' }
    });

    // Show the clear button
    const clearBtn = document.getElementById('clear-path-btn');
    if (clearBtn) clearBtn.style.display = 'flex';
  } catch (err) {
    console.error('Shortest path error:', err);
  }
}

export function clearPath(map: MaplibreGL.Map): void {
  const layerId = 'shortest-path-layer';
  const sourceId = 'shortest-path-source';

  if (map.getLayer(layerId)) map.removeLayer(layerId);
  if (map.getSource(sourceId)) map.removeSource(sourceId);

  // Hide the clear button
  const clearBtn = document.getElementById('clear-path-btn');
  if (clearBtn) clearBtn.style.display = 'none';
}


