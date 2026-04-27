import { Map } from 'maplibre-gl';
import { ExclusionZoneType } from './enum.js';

declare var MapboxDraw: any;

export function initializeExclusionDraw(map: Map) {
    const draw = new MapboxDraw({
        displayControlsDefault: false,
        controls: {
            polygon: true,
            trash: true
        },
        defaultMode: 'draw_polygon'
    });

    const controls = document.getElementById('exclusion-draw-controls');
    const typeSelect = document.getElementById('exclusion-type-select') as HTMLSelectElement;
    const startBtn = document.getElementById('draw-start-btn');
    const saveBtn = document.getElementById('draw-save-btn');
    const cancelBtn = document.getElementById('draw-cancel-btn');

    if (!typeSelect || !startBtn || !saveBtn || !cancelBtn) return;

    // Populate dropdown
    Object.entries(ExclusionZoneType).forEach(([name, value]) => {
        if (isNaN(Number(name))) { // Filter out numeric keys from enum
            const option = document.createElement('option');
            option.value = value.toString();
            option.textContent = name;
            typeSelect.appendChild(option);
        }
    });

    let isDrawing = false;

    const startDrawing = () => {
        if (isDrawing) return;
        map.addControl(draw);
        draw.changeMode('draw_polygon');
        isDrawing = true;
        startBtn.style.display = 'none';
        saveBtn.style.display = 'block';
    };

    const stopDrawing = (clear = true) => {
        if (!isDrawing) return;
        if (clear) {
            draw.deleteAll();
        }
        map.removeControl(draw);
        isDrawing = false;
        startBtn.style.display = 'block';
        saveBtn.style.display = 'none';
    };

    startBtn.addEventListener('click', startDrawing);

    cancelBtn.addEventListener('click', () => {
        stopDrawing();
    });

    saveBtn.addEventListener('click', async () => {
        const data = draw.getAll();
        if (data.features.length > 0) {
            const feature = data.features[0];
            const wkt = featureToWKT(feature);
            const type = parseInt(typeSelect.value);

            try {
                const response = await fetch('/api/exclusion-zones', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({ wkt, type })
                });

                if (response.ok) {
                    alert('Område lagret!');
                    stopDrawing();
                    // Optionally refresh exclusion zones layer if it exists
                    // @ts-ignore
                    if (window.refreshExclusionZones) window.refreshExclusionZones();
                } else {
                    const err = await response.json();
                    alert('Feil ved lagring: ' + (err.error || response.statusText));
                }
            } catch (error) {
                console.error('Save failed:', error);
                alert('Feil ved lagring.');
            }
        } else {
            alert('Tegn et område først!');
        }
    });

    // @ts-ignore
    window.cancelDrawing = stopDrawing;
}

function featureToWKT(feature: any): string {
    if (feature.geometry.type === 'Polygon') {
        const rings = feature.geometry.coordinates.map((ring: any[]) => 
            '(' + ring.map(coord => `${coord[0]} ${coord[1]}`).join(', ') + ')'
        ).join(', ');
        return `POLYGON(${rings})`;
    }
    return '';
}
