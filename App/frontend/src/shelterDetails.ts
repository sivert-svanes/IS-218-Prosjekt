import type * as MaplibreGL from "maplibre-gl";

export const amenityLabels: Record<string, string> = {
    'convenience': 'Butikk',
    'doctors': 'Sykepleie',
    'drinking_water': 'Drikkevann',
    'hardware': 'Varebutikk',
    'supermarket': 'Matbutikk',
    'trade': 'Byggvarebutikk',
    'hospital': 'Sykehus',
    'chemist': 'Apotek',
  };

/**
 * Amenity button configurations with their field patterns and building keys
 */
export const amenityButtons: Record<string, { fields: string[], keys: string[], icon: string }> = {
  water: {
    fields: ['vann', 'water'],
    keys: ['drinking_water'],
    icon: 'Finn drikkevann'
  },
  food: {
    fields: ['mat', 'food', 'provisions'],
    keys: ['convenience', 'supermarket'],
    icon: 'Finn mat'
  },
  equipment: {
    fields: ['utstyr', 'equipment', 'tools'],
    keys: ['trade', 'hardware'],
    icon: 'Finn utstyr'
  },
  medicine: {
    fields: ['medisin', 'medicine', 'health'],
    keys: ['hospital', 'chemist', 'doctors'],
    icon: 'Finn medisin'
  }
};

/**
 * Initialize shelter details modal functionality
 * @param map The MapLibre map instance
 */
export function initShelterDetailsModal(map: MaplibreGL.Map): void {
  // Global function to open shelter details modal
  window.openShelterDetailsModal = async (fid: number, feature?: GeoJSON.Feature<GeoJSON.Point>) => {
    if ((window as any).currentMode !== 'logistics') return;
    try {
      const response = await fetch(`/api/shelter-details/${fid}`);
      if (!response.ok) throw new Error('Failed to fetch shelter details');

      const data = await response.json();

      // Remove existing modal if any
      const existingModal = document.querySelector('.shelter-details-modal');
      if (existingModal) existingModal.remove();

      // Create modal HTML
      const modalContent = document.createElement('div');
      modalContent.className = 'shelter-details-modal';

      // Extract coordinates directly from the feature's GeoJSON geometry
      let shelterLng: number | null = null;
      let shelterLat: number | null = null;

      if (feature?.geometry?.type === 'Point' && feature.geometry.coordinates) {
        [shelterLng, shelterLat] = feature.geometry.coordinates;
      }

      // Build details HTML with inline amenity buttons
      const detailsHTML = Object.entries(data).map(([key, value]) => {
        let amenityButton = '';
        let displayValue: string = 'N/A';

        // Format the value based on its type and key
        if (value !== null && value !== undefined && value !== '') {
          // Format coordinates objects to show lat/lng
          if (typeof value === 'object' && !Array.isArray(value)) {
            const obj = value as Record<string, any>;
            // Check for various coordinate property names
            const lat = obj.lat || obj.latitude || obj.wgs84_north || obj.north || obj.y;
            const lng = obj.lon || obj.longitude || obj.wgs84_east || obj.east || obj.x;

            if (lat !== undefined && lng !== undefined) {
              displayValue = `${parseFloat(lat).toFixed(6)}, ${parseFloat(lng).toFixed(6)}`;
            } else if (obj.coordinates && Array.isArray(obj.coordinates) && obj.coordinates.length >= 2) {
              // Handle GeoJSON-style coordinates [lng, lat]
              displayValue = `${parseFloat(obj.coordinates[1]).toFixed(6)}, ${parseFloat(obj.coordinates[0]).toFixed(6)}`;
            } else {
              displayValue = String(value);
            }
          }
          // Format percentages (multiply by 100)
          else if (typeof value === 'number' && value >= 0 && value <= 1 && (key.toLowerCase().includes('prosent') || key.toLowerCase().includes('percent') || key.toLowerCase().includes('ratio') || key.toLowerCase().includes('utilization'))) {
            displayValue = `${(value * 100).toFixed(1)}%`;
          }
          // Default formatting
          else {
            displayValue = String(value);
          }
        }

        // Check if this field matches any amenity button
        if (shelterLat !== null && shelterLng !== null) {
          const fieldLower = key.toLowerCase();

          for (const [amenityKey, amenityConfig] of Object.entries(amenityButtons)) {
            if (amenityConfig.fields.some(field => fieldLower.includes(field))) {
              // Create buttons for all keys in this amenity (comma-separated)
              amenityButton = `<button class="route-button" data-building-keys="${amenityConfig.keys.join(',')}" data-shelter-lat="${shelterLat}" data-shelter-lng="${shelterLng}" title="Finn nærmeste ${amenityKey}">${amenityConfig.icon}</button>`;
              break;
            }
          }
        }

        return `
          <div class="detail-row">
            <span class="detail-key">${key.toUpperCase().replace(/_/g, ' ')}:</span>
            <span class="detail-value">${displayValue}${amenityButton}</span>
          </div>
        `;
      }).join('');

      modalContent.innerHTML = `
        <div class="modal-content">
          <button class="modal-close" onclick="window.closeShelterDetailsModal()">&times;</button>
          <h2>${data.romnr || 'Tilfluktsrom'}</h2>
          <button class="hospital-button" data-building-keys="hospital" data-shelter-lat="${shelterLat}" data-shelter-lng="${shelterLng}" style="width: 100%; margin-bottom: 20px;">Finn sykehus</button>
          <div class="modal-details">
            ${detailsHTML}
          </div>
        </div>
      `;

      document.body.appendChild(modalContent);

      // Add event listeners to route buttons (including hospital button)
      modalContent.querySelectorAll('.route-button, .hospital-button').forEach((button: Element) => {
        button.addEventListener('click', async (e: Event) => {
          e.preventDefault();
          const btn = button as HTMLElement;
          if (btn.classList.contains('loading')) return;

          const buildingKeysStr = btn.getAttribute('data-building-keys');
          const lat = parseFloat(btn.getAttribute('data-shelter-lat') || '0');
          const lng = parseFloat(btn.getAttribute('data-shelter-lng') || '0');

          if (!isNaN(lat) && !isNaN(lng) && buildingKeysStr) {
            btn.classList.add('loading');
            try {
              const { calculateAndDisplayPathToBuilding, clearPath } = await import('./shortestPath.js');
              clearPath(map);

              // Pass comma-separated keys directly - the backend will return k results for each key
              await calculateAndDisplayPathToBuilding(map, lat, lng, buildingKeysStr);
            } catch (err) {
              console.error('Routing error:', err);
            } finally {
              btn.classList.remove('loading');
            }
          }
        });
      });
    } catch (error) {
      console.error('Error loading shelter details:', error);
      alert('Feil ved lasting av detaljer');
    }
  };

  // Global function to close modal
  window.closeShelterDetailsModal = () => {
    const modal = document.querySelector('.shelter-details-modal');
    if (modal) modal.remove();
  };
}

// Declare global functions for TypeScript
declare global {
  interface Window {
    openShelterDetailsModal: (fid: number, feature?: GeoJSON.Feature<GeoJSON.Point>) => Promise<void>;
    closeShelterDetailsModal: () => void;
  }
}
