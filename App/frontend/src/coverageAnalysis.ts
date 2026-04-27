import type * as MaplibreGL from 'maplibre-gl';
import { registerLayer, deregisterLayer, layerCheckboxes } from './layerControl.js';

// ─── Layer constants ──────────────────────────────────────────────────────────
const GRID_SOURCE    = 'coverage-grid-source';
const GRID_LAYER     = 'coverage-grid-layer';
const SHLT_SOURCE    = 'coverage-shelter-source';
const SHLT_LAYER     = 'coverage-shelter-layer';
const OUTLINE_SOURCE = 'coverage-outline-source';
const OUTLINE_LAYER  = 'coverage-outline-layer';

// ─── Types ────────────────────────────────────────────────────────────────────
type FylkeItem = {
  id: number;
  navn: string;
};

type CoverageSummary = {
  total_population: number;
  total_capacity: number;
  shelter_count: number;
  covered_population: number;
  uncovered_population: number;
  coverage_ratio: number;
};

type GeoJSONFC = { type: string; features: any[] };

type CoverageResponse = {
  summary: CoverageSummary;
  shelters?: GeoJSONFC;
  population_cells?: GeoJSONFC;
  fylke_name?: string | null;
};

// ─── Module state ─────────────────────────────────────────────────────────────
let _shelterClickHandler: ((e: any) => void) | null = null;

// ─── Map layer helpers ────────────────────────────────────────────────────────

function clearCoverageLayers(map: MaplibreGL.Map): void {
  if (_shelterClickHandler) {
    map.off('click', SHLT_LAYER, _shelterClickHandler);
    _shelterClickHandler = null;
  }
  if (map.getLayer(OUTLINE_LAYER))  { map.removeLayer(OUTLINE_LAYER); deregisterLayer(OUTLINE_LAYER); }
  if (map.getSource(OUTLINE_SOURCE))  map.removeSource(OUTLINE_SOURCE);
  if (map.getLayer(GRID_LAYER))     { map.removeLayer(GRID_LAYER);   deregisterLayer(GRID_LAYER); }
  if (map.getSource(GRID_SOURCE))     map.removeSource(GRID_SOURCE);
  if (map.getLayer(SHLT_LAYER))     { map.removeLayer(SHLT_LAYER);   deregisterLayer(SHLT_LAYER); }
  if (map.getSource(SHLT_SOURCE))     map.removeSource(SHLT_SOURCE);
}

async function addCountyOutline(map: MaplibreGL.Map, fylkeId: number): Promise<void> {
  try {
    const response = await fetch(`/api/fylke-outline/${fylkeId}`);
    if (!response.ok) return;
    const feature = await response.json();

    if (map.getLayer(OUTLINE_LAYER))  { map.removeLayer(OUTLINE_LAYER); deregisterLayer(OUTLINE_LAYER); }
    if (map.getSource(OUTLINE_SOURCE))  map.removeSource(OUTLINE_SOURCE);

    map.addSource(OUTLINE_SOURCE, {
      type: 'geojson',
      data: { type: 'FeatureCollection', features: [feature] } as any,
    });
    map.addLayer({
      id:     OUTLINE_LAYER,
      type:   'line',
      source: OUTLINE_SOURCE,
      paint:  {
        'line-color':     '#c8c8ff',
        'line-width':     2,
        'line-dasharray': [4, 3],
        'line-opacity':   0.85,
      },
    });
    if (!layerCheckboxes.has(OUTLINE_LAYER))
      registerLayer(OUTLINE_LAYER, 'Coverage: Fylkesgrense', true, map);
  } catch (err) {
    console.warn('Could not load county outline:', err);
  }
}

function addGridLayer(map: MaplibreGL.Map, geojson: GeoJSONFC): void {
  if (map.getLayer(GRID_LAYER))   map.removeLayer(GRID_LAYER);
  if (map.getSource(GRID_SOURCE))  map.removeSource(GRID_SOURCE);

  map.addSource(GRID_SOURCE, { type: 'geojson', data: geojson as any });
  map.addLayer({
    id:     GRID_LAYER,
    type:   'fill',
    source: GRID_SOURCE,
    filter: ['>', ['get', 'poptot'], 0],
    paint:  {
      'fill-color': [
        'interpolate', ['linear'], ['get', 'coverage_pct'],
        0,   '#d73027',
        0.5, '#fee090',
        1,   '#1a9850',
      ] as any,
      'fill-opacity': 0.6,
    },
  });

  if (!layerCheckboxes.has(GRID_LAYER))
    registerLayer(GRID_LAYER, 'Coverage: Rutenett', true, map);
}

function addShelterLayer(map: MaplibreGL.Map, geojson: GeoJSONFC): void {
  if (map.getLayer(SHLT_LAYER))   map.removeLayer(SHLT_LAYER);
  if (map.getSource(SHLT_SOURCE))  map.removeSource(SHLT_SOURCE);
  if (_shelterClickHandler) map.off('click', SHLT_LAYER, _shelterClickHandler);

  map.addSource(SHLT_SOURCE, { type: 'geojson', data: geojson as any });
  map.addLayer({
    id:     SHLT_LAYER,
    type:   'circle',
    source: SHLT_SOURCE,
    paint:  {
      'circle-radius': 6,
      'circle-color': [
        'interpolate', ['linear'], ['get', 'utilization'],
        0,   '#1a9850',
        0.5, '#fd8d3c',
        1,   '#d73027',
      ] as any,
      'circle-stroke-width': 1.5,
      'circle-stroke-color': '#fff',
    },
  });

  if (!layerCheckboxes.has(SHLT_LAYER))
    registerLayer(SHLT_LAYER, 'Coverage: Tilfluktsrom', true, map);

  const mgl = (window as any).maplibregl;
  if (mgl) {
    _shelterClickHandler = (e: any) => {
      if (!e.features?.length) return;
      const props  = e.features[0].properties as Record<string, any>;
      const coords = e.features[0].geometry.coordinates as [number, number];
      new mgl.Popup({ offset: 10 })
        .setLngLat(coords)
        .setHTML(`
          <div style="font-family:'Space Mono',monospace;font-size:12px;max-width:200px;">
            <b>Tilfluktsrom #${props['fid']}</b>
            <p style="margin:2px 0">Kapasitet: ${props['capacity']}</p>
            <p style="margin:2px 0">Tildelt: ${props['allocated']}</p>
            <p style="margin:2px 0">Ledig: ${props['remaining']}</p>
            <p style="margin:2px 0">Utnyttelse: ${Math.round(props['utilization'] * 100)}%</p>
            ${props['is_full'] ? '<p style="color:#d73027;font-weight:bold;margin:4px 0">FULLT</p>' : ''}
          </div>`)
        .addTo(map);
    };
    map.on('click', SHLT_LAYER, _shelterClickHandler);
    map.on('mouseenter', SHLT_LAYER, () => { map.getCanvas().style.cursor = 'pointer'; });
    map.on('mouseleave', SHLT_LAYER, () => { map.getCanvas().style.cursor = ''; });
  }
}

// ─── Formatting helpers ───────────────────────────────────────────────────────

function formatInt(value: number): string {
  return new Intl.NumberFormat('nb-NO', { maximumFractionDigits: 0 }).format(value);
}

function formatPercent(ratio: number): string {
  return `${(ratio * 100).toFixed(2)}%`;
}

// ─── API helpers ──────────────────────────────────────────────────────────────

async function fetchFylker(): Promise<FylkeItem[]> {
  const response = await fetch('/api/fylker');
  if (!response.ok) throw new Error('Kunne ikke hente fylker.');
  return (await response.json()) as FylkeItem[];
}

// ─── UI render ────────────────────────────────────────────────────────────────

function renderResult(
  resultBox: HTMLElement,
  summary: CoverageSummary,
  seconds: string,
  fylkeName?: string | null,
): void {
  const pct    = summary.coverage_ratio;
  const pctPct = (pct * 100).toFixed(2);
  const pctClass = pct >= 0.7 ? 'cv-ok-text' : 'cv-no-text';
  const barColor = pct >= 0.7 ? '#7dd3a8' : '#f08080';
  const regionHtml = fylkeName
    ? `<span class="coverage-result-region">${fylkeName}</span>`
    : '';

  resultBox.innerHTML = `
    <div class="coverage-result-title">Dekningsgrad analyse${regionHtml}</div>
    <div class="coverage-pct-bar-wrap">
      <div class="coverage-pct-bar-fill" style="width:${Math.min(pct * 100, 100)}%;background:${barColor};"></div>
    </div>
    <div class="coverage-pct-label ${pctClass}">${pctPct}% dekket</div>
    <div class="coverage-result-grid">
      <div>Total befolkning</div><div class="coverage-result-value">${formatInt(summary.total_population)}</div>
      <div>Total tilfluktsrom kapasitet</div><div class="coverage-result-value">${formatInt(summary.total_capacity)}</div>
      <div>Antall tilfluktsrom</div><div class="coverage-result-value">${formatInt(summary.shelter_count)}</div>
      <div>Personer som fikk plass</div><div class="coverage-result-value cv-ok-text">${formatInt(summary.covered_population)}</div>
      <div>Personer uten plass</div><div class="coverage-result-value cv-no-text">${formatInt(summary.uncovered_population)}</div>
      <div>Dekningsgrad</div><div class="coverage-result-value ${pctClass}">${formatPercent(summary.coverage_ratio)}</div>
      <div>Query time</div><div class="coverage-result-value">${seconds} sec</div>
    </div>
  `;
  resultBox.classList.add('is-visible');
}

function setStatus(statusEl: HTMLElement, message: string, isError: boolean): void {
  statusEl.textContent = message;
  statusEl.classList.toggle('error', isError);
}

// ─── Public API ───────────────────────────────────────────────────────────────

export function initializeCoverageAnalysis(map: MaplibreGL.Map): void {
  const overlay = document.querySelector('.map-overlay.container') as HTMLElement | null;
  if (!overlay) return;

  if (document.getElementById('coverage-analysis-btn')) return;

  const button = document.createElement('div');
  button.id = 'coverage-analysis-btn';
  button.className = 'box text prevent-select button';
  button.textContent = 'Dekningsgrad';
  overlay.appendChild(button);

  const panel = document.createElement('div');
  panel.id = 'coverage-analysis-panel';
  panel.className = 'coverage-panel';
  panel.innerHTML = `
    <div class="coverage-panel-title">Dekningsgrad analyse</div>
    <label class="coverage-panel-label" for="coverage-area-select">Velg område</label>
    <select id="coverage-area-select" class="coverage-select">
      <option value="norway">Hele Norge</option>
    </select>
    <div id="coverage-status" class="coverage-status"></div>
    <div class="coverage-panel-actions">
      <button id="coverage-close-btn" class="coverage-btn" type="button">Lukk</button>
      <button id="coverage-run-btn" class="coverage-btn" type="button">Kjør analyse</button>
    </div>
  `;
  document.body.appendChild(panel);

  const resultBox = document.createElement('div');
  resultBox.id = 'coverage-result-box';
  resultBox.className = 'coverage-result-box';
  document.body.appendChild(resultBox);

  const areaSelect = panel.querySelector('#coverage-area-select') as HTMLSelectElement;
  const statusEl   = panel.querySelector('#coverage-status')      as HTMLElement;
  const runBtn     = panel.querySelector('#coverage-run-btn')     as HTMLButtonElement;
  const closeBtn   = panel.querySelector('#coverage-close-btn')   as HTMLButtonElement;

  let loadedFylker = false;

  button.addEventListener('click', async () => {
    panel.classList.toggle('is-open');
    setStatus(statusEl, '', false);

    if (loadedFylker) return;

    try {
      const fylker = await fetchFylker();
      for (const fylke of fylker) {
        const option = document.createElement('option');
        option.value = String(fylke.id);
        option.textContent = fylke.navn;
        areaSelect.appendChild(option);
      }
      loadedFylker = true;
    } catch (error) {
      setStatus(statusEl, 'Kunne ikke hente fylker.', true);
      console.error('Coverage analysis fylker error:', error);
    }
  });

  closeBtn.addEventListener('click', () => {
    panel.classList.remove('is-open');
    resultBox.classList.remove('is-visible');
    clearCoverageLayers(map);
  });

  runBtn.addEventListener('click', async () => {
    const selected   = areaSelect.value;
    const isCounty   = selected !== 'norway';
    const url = isCounty
      ? `/api/coverage-analysis?fylke_id=${encodeURIComponent(selected)}`
      : '/api/coverage-analysis?scope=norway';

    runBtn.disabled = true;
    setStatus(statusEl, 'Running analysis...', false);
    clearCoverageLayers(map);

    try {
      const startTime = performance.now();
      const response  = await fetch(url);
      const endTime   = performance.now();
      const seconds   = ((endTime - startTime) / 1000).toFixed(2);

      const data = (await response.json()) as CoverageResponse | { error?: string };

      if (!response.ok || !('summary' in data)) {
        const message = 'error' in data && data.error ? data.error : 'Analysis failed.';
        throw new Error(message);
      }

      const coverageData = data as CoverageResponse;
      renderResult(resultBox, coverageData.summary, seconds, coverageData.fylke_name);
      setStatus(statusEl, 'Done.', false);
      panel.classList.remove('is-open');

      if (isCounty) {
        addCountyOutline(map, Number(selected));
      }
      if (coverageData.shelters) {
        addShelterLayer(map, coverageData.shelters);
      }
      if (coverageData.population_cells) {
        addGridLayer(map, coverageData.population_cells);
      }

    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      setStatus(statusEl, `Error: ${message}`, true);
      console.error('Coverage analysis run error:', error);
    } finally {
      runBtn.disabled = false;
    }
  });
}
