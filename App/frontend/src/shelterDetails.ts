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
    keys: ['water'],
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
            <span class="detail-value">${value ?? 'N/A'}${amenityButton}</span>
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
          const buildingKeysStr = (button as HTMLElement).getAttribute('data-building-keys');
          const lat = parseFloat((button as HTMLElement).getAttribute('data-shelter-lat') || '0');
          const lng = parseFloat((button as HTMLElement).getAttribute('data-shelter-lng') || '0');

          if (!isNaN(lat) && !isNaN(lng) && buildingKeysStr) {
            const { calculateAndDisplayPathToBuilding, clearPath } = await import('./shortestPath.js');
            clearPath(map);

            // Pass comma-separated keys directly - the backend will return k results for each key
            await calculateAndDisplayPathToBuilding(map, lat, lng, buildingKeysStr);
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
