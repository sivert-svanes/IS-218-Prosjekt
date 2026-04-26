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

type CoverageResponse = {
  summary: CoverageSummary;
};

function formatInt(value: number): string {
  return new Intl.NumberFormat('nb-NO', { maximumFractionDigits: 0 }).format(value);
}

function formatPercent(ratio: number): string {
  return `${(ratio * 100).toFixed(2)}%`;
}

async function fetchFylker(): Promise<FylkeItem[]> {
  const response = await fetch('/api/fylker');
  if (!response.ok) {
    throw new Error('Kunne ikke hente fylker.');
  }
  return (await response.json()) as FylkeItem[];
}

function renderResult(resultBox: HTMLElement, summary: CoverageSummary): void {
  resultBox.innerHTML = `
    <div class="coverage-result-title">Coverage Analysis</div>
    <div class="coverage-result-grid">
      <div>Total befolkning</div><div class="coverage-result-value">${formatInt(summary.total_population)}</div>
      <div>Total shelterkapasitet</div><div class="coverage-result-value">${formatInt(summary.total_capacity)}</div>
      <div>Antall shelters</div><div class="coverage-result-value">${formatInt(summary.shelter_count)}</div>
      <div>Personer som fikk plass</div><div class="coverage-result-value">${formatInt(summary.covered_population)}</div>
      <div>Personer uten plass</div><div class="coverage-result-value">${formatInt(summary.uncovered_population)}</div>
      <div>Dekningsgrad</div><div class="coverage-result-value">${formatPercent(summary.coverage_ratio)}</div>
    </div>
  `;
  resultBox.classList.add('is-visible');
}

function setStatus(statusEl: HTMLElement, message: string, isError: boolean): void {
  statusEl.textContent = message;
  statusEl.classList.toggle('error', isError);
}

export function initializeCoverageAnalysis(): void {
  const overlay = document.querySelector('.map-overlay.container') as HTMLElement | null;
  if (!overlay) {
    return;
  }

  if (document.getElementById('coverage-analysis-btn')) {
    return;
  }

  const button = document.createElement('div');
  button.id = 'coverage-analysis-btn';
  button.className = 'box text prevent-select button';
  button.textContent = 'Coverage Analysis';
  overlay.appendChild(button);

  const panel = document.createElement('div');
  panel.id = 'coverage-analysis-panel';
  panel.className = 'coverage-panel';
  panel.innerHTML = `
    <div class="coverage-panel-title">Coverage Analysis</div>
    <label class="coverage-panel-label" for="coverage-area-select">Velg område</label>
    <select id="coverage-area-select" class="coverage-select">
      <option value="norway">Hele Norge</option>
    </select>
    <div id="coverage-status" class="coverage-status"></div>
    <div class="coverage-panel-actions">
      <button id="coverage-close-btn" class="coverage-btn" type="button">Close</button>
      <button id="coverage-run-btn" class="coverage-btn" type="button">Run analysis</button>
    </div>
  `;
  document.body.appendChild(panel);

  const resultBox = document.createElement('div');
  resultBox.id = 'coverage-result-box';
  resultBox.className = 'coverage-result-box';
  document.body.appendChild(resultBox);

  const areaSelect = panel.querySelector('#coverage-area-select') as HTMLSelectElement;
  const statusEl = panel.querySelector('#coverage-status') as HTMLElement;
  const runBtn = panel.querySelector('#coverage-run-btn') as HTMLButtonElement;
  const closeBtn = panel.querySelector('#coverage-close-btn') as HTMLButtonElement;

  let loadedFylker = false;

  button.addEventListener('click', async () => {
    panel.classList.toggle('is-open');
    setStatus(statusEl, '', false);

    if (loadedFylker) {
      return;
    }

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
  });

  runBtn.addEventListener('click', async () => {
    const selected = areaSelect.value;
    const url = selected === 'norway'
      ? '/api/coverage-analysis?scope=norway'
      : `/api/coverage-analysis?fylke_id=${encodeURIComponent(selected)}`;

    runBtn.disabled = true;
    setStatus(statusEl, 'Running analysis...', false);

    try {
      const response = await fetch(url);
      const data = (await response.json()) as CoverageResponse | { error?: string };

      if (!response.ok || !('summary' in data)) {
        const message = 'error' in data && data.error ? data.error : 'Analysis failed.';
        throw new Error(message);
      }

      renderResult(resultBox, data.summary);
      setStatus(statusEl, 'Done.', false);
      panel.classList.remove('is-open');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      setStatus(statusEl, `Error: ${message}`, true);
      console.error('Coverage analysis run error:', error);
    } finally {
      runBtn.disabled = false;
    }
  });
}

