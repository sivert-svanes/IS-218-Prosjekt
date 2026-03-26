import type * as MaplibreGL from "maplibre-gl";

let roadNetworkCache: any = null;
const WGS84_CONSTANT = 20037508.34;
const ROAD_TYPES = 'Enkel%20bilveg,Bilferje,Rampe,Rundkj%C3%B8ring,Kanalisert%20veg';

interface GraphNode {
  id: string;
  neighbors: Array<{ nodeId: string; segment: any }>;
  lat: number;
  lng: number;
}

interface RoadSegment {
  coordinates: [number, number][];
  distance: number;
  start: any;
  end: any;
}

const haversineDistance = (lat1: number, lng1: number, lat2: number, lng2: number): number => {
  const R = 6371, dLat = (lat2 - lat1) * Math.PI / 180, dLng = (lng2 - lng1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
};



async function ensureRoadNetworkLoaded(map: MaplibreGL.Map, userLat: number, userLng: number, shelterLat: number, shelterLng: number): Promise<void> {
  // Calculate haversine distance to shelter
  const distToShelter = haversineDistance(userLat, userLng, shelterLat, shelterLng);

  // Use distance + 20% buffer to get the radius for road loading
  const radius = distToShelter * 1.2;

  // Convert radius (km) to degrees (rough approximation: 1 degree ≈ 111 km)
  const radiusDegrees = radius / 111;

  // Create bounding box around the line between user and shelter
  const minLat = Math.min(userLat, shelterLat) - radiusDegrees;
  const maxLat = Math.max(userLat, shelterLat) + radiusDegrees;
  const minLng = Math.min(userLng, shelterLng) - radiusDegrees;
  const maxLng = Math.max(userLng, shelterLng) + radiusDegrees;

  const toMercator = (deg: number, isSin: boolean) => {
    const rad = (deg + 90) / 360 * Math.PI;
    return (isSin ? Math.log(Math.tan(rad)) : deg / 180) * WGS84_CONSTANT;
  };

  const response = await fetch(
    `/api/nvdb/roads?min_x=${toMercator(minLng, false)}&min_y=${toMercator(minLat, true)}&max_x=${toMercator(maxLng, false)}&max_y=${toMercator(maxLat, true)}&road_types=${ROAD_TYPES}`
  );

  if (response.ok) {
    roadNetworkCache = await response.json();
  }
}

function buildRoadGraph(features: any[]): Map<string, GraphNode> {
  const graph = new Map<string, GraphNode>();
  const nodeMap = new Map<string, any>();
  let nodeId = 0;

  features.forEach((feature) => {
    if (feature.geometry.type !== 'LineString') return;
    const coords = feature.geometry.coordinates as [number, number][];
    if (coords.length < 2) return;

    const getNode = (coord: [number, number]) => {
      const key = `${coord[0]},${coord[1]}`;
      if (!nodeMap.has(key)) {
        const id = `node-${nodeId++}`;
        nodeMap.set(key, { id, lng: coord[0], lat: coord[1] });
        graph.set(id, { id, neighbors: [], lng: coord[0], lat: coord[1] });
      }
      return nodeMap.get(key)!;
    };

    const start = getNode(coords[0]);
    const end = getNode(coords[coords.length - 1]);
    const dist = haversineDistance(start.lat, start.lng, end.lat, end.lng);
    const segment: RoadSegment = { coordinates: coords, distance: dist, start, end };

    graph.get(start.id)!.neighbors.push({ nodeId: end.id, segment });
    graph.get(end.id)!.neighbors.push({ nodeId: start.id, segment: { ...segment, start: end, end: start } });
  });

  return graph;
}

function findNearestInGraph(lat: number, lng: number, graph: Map<string, GraphNode>): string | null {
  let nearest: string | null = null;
  let minDist = Infinity;

  graph.forEach((node) => {
    if (node.neighbors.length === 0) return;
    const dist = haversineDistance(lat, lng, node.lat, node.lng);
    if (dist < minDist) { minDist = dist; nearest = node.id; }
  });

  return nearest;
}

function collectAllShelters(map: MaplibreGL.Map): any[] {
  const shelters: any[] = [];
  for (let i = 1; i <= 15; i++) {
    const source = map.getSource(`shelters-fylke-${i}`) as any;
    if (!source?._data) continue;
    const data = source._data.geojson || source._data;
    if (data?.features) shelters.push(...data.features);
  }
  return shelters;
}

function findNearestShelter(lat: number, lng: number, shelters: any[]): { lat: number; lng: number } | null {
  let nearest = null;
  let minDist = Infinity;

  shelters.forEach((f) => {
    if (f.geometry.type !== 'Point') return;
    const [sLng, sLat] = f.geometry.coordinates;
    const dist = Math.hypot(sLng - lng, sLat - lat);
    if (dist < minDist) { minDist = dist; nearest = { lat: sLat, lng: sLng }; }
  });

  return nearest;
}

function aStar(graph: Map<string, GraphNode>, startId: string, endId: string, endLat: number, endLng: number): string[] {
  const openSet = new Set([startId]);
  const cameFrom = new Map<string, string>();
  const gScore = new Map<string, number>();
  const fScore = new Map<string, number>();

  graph.forEach((_, id) => {
    gScore.set(id, Infinity);
    fScore.set(id, Infinity);
  });

  gScore.set(startId, 0);
  const startNode = graph.get(startId)!;
  fScore.set(startId, haversineDistance(startNode.lat, startNode.lng, endLat, endLng));

  while (openSet.size > 0) {
    let current: string | null = null;
    let lowestF = Infinity;

    openSet.forEach(nodeId => {
      const f = fScore.get(nodeId) ?? Infinity;
      if (f < lowestF) { lowestF = f; current = nodeId; }
    });

    if (!current || current === endId) {
      const path: string[] = [];
      let curr: string | undefined = endId;
      while (curr !== undefined) {
        path.unshift(curr);
        curr = cameFrom.get(curr);
      }
      return path;
    }

    openSet.delete(current);
    const currentNode = graph.get(current)!;

    currentNode.neighbors.forEach(({ nodeId: neighbor, segment }) => {
      const tentativeGScore = (gScore.get(current!) ?? 0) + segment.distance;
      if (tentativeGScore < (gScore.get(neighbor) ?? Infinity)) {
        cameFrom.set(neighbor, current!);
        gScore.set(neighbor, tentativeGScore);

        const neighborNode = graph.get(neighbor)!;
        fScore.set(neighbor, tentativeGScore + haversineDistance(neighborNode.lat, neighborNode.lng, endLat, endLng));
        openSet.add(neighbor);
      }
    });
  }

  return [];
}

function buildPathCoordinates(path: string[], graph: Map<string, GraphNode>, endPoint: [number, number]): [number, number][] {
  const coords: [number, number][] = [];

  for (let i = 0; i < path.length - 1; i++) {
    const neighbor = graph.get(path[i])!.neighbors.find(n => n.nodeId === path[i + 1]);
    if (!neighbor) continue;

    let segCoords = neighbor.segment.coordinates;
    const currentPos: [number, number] = [graph.get(path[i])!.lng, graph.get(path[i])!.lat];
    const start = segCoords[0], end = segCoords[segCoords.length - 1];

    if (Math.hypot(end[0] - currentPos[0], end[1] - currentPos[1]) < Math.hypot(start[0] - currentPos[0], start[1] - currentPos[1])) {
      segCoords = [...segCoords].reverse();
    }

    coords.push(...(i === 0 ? segCoords : segCoords.slice(1)));
  }

  coords.push(endPoint);
  return coords;
}

function updateLayerOnMap(map: MaplibreGL.Map, coords: [number, number][]): void {
  const sourceId = 'shortest-path-source';
  const layerId = 'shortest-path-layer';

  if (map.getLayer(layerId)) map.removeLayer(layerId);
  if (map.getSource(sourceId)) map.removeSource(sourceId);

  map.addSource(sourceId, {
    type: 'geojson',
    data: { type: 'FeatureCollection', features: [{ type: 'Feature', geometry: { type: 'LineString', coordinates: coords }, properties: {} }] }
  });

  map.addLayer({
    id: layerId,
    type: 'line',
    source: sourceId,
    paint: { 'line-color': '#00FF00', 'line-width': 4, 'line-opacity': 0.9 },
    layout: { 'line-join': 'round', 'line-cap': 'round' }
  });

  const btn = document.getElementById('clear-path-btn');
  if (btn) btn.style.display = 'flex';
}

export async function calculateAndDisplayPath(map: MaplibreGL.Map, lat: number, lng: number): Promise<void> {
  try {
    const shelters = collectAllShelters(map);
    if (shelters.length === 0) return;

    const shelter = findNearestShelter(lat, lng, shelters);
    if (!shelter) return;

    // Attempt 1: Try with cached road graph if it exists
    if (roadNetworkCache?.features) {
      const graph = buildRoadGraph(roadNetworkCache.features);
      const startId = findNearestInGraph(lat, lng, graph);
      const endId = findNearestInGraph(shelter.lat, shelter.lng, graph);

      if (startId && endId) {
        const path = aStar(graph, startId, endId, shelter.lat, shelter.lng);
        if (path.length > 0) {
          let pathCoords = buildPathCoordinates(path, graph, [shelter.lng, shelter.lat]);
          pathCoords.unshift([lng, lat]);
          if (pathCoords.length >= 2) {
            updateLayerOnMap(map, pathCoords);
            return;
          }
        }
      }
    }

    // Attempt 2: Fetch new road graph and retry
    await ensureRoadNetworkLoaded(map, lat, lng, shelter.lat, shelter.lng);
    if (!roadNetworkCache?.features) return;

    const graph = buildRoadGraph(roadNetworkCache.features);
    const startId = findNearestInGraph(lat, lng, graph);
    const endId = findNearestInGraph(shelter.lat, shelter.lng, graph);

    if (!startId || !endId) return;

    const path = aStar(graph, startId, endId, shelter.lat, shelter.lng);
    if (path.length === 0) return;

    let pathCoords = buildPathCoordinates(path, graph, [shelter.lng, shelter.lat]);
    pathCoords.unshift([lng, lat]);

    if (pathCoords.length >= 2) {
      updateLayerOnMap(map, pathCoords);
    }
  } catch (err) {
    console.error('Shortest path error:', err);
  }
}

export function clearPath(map: MaplibreGL.Map): void {
  const layerId = 'shortest-path-layer';
  const sourceId = 'shortest-path-source';

  if (map.getLayer(layerId)) map.removeLayer(layerId);
  if (map.getSource(sourceId)) map.removeSource(sourceId);

  const btn = document.getElementById('clear-path-btn');
  if (btn) btn.style.display = 'none';
}




