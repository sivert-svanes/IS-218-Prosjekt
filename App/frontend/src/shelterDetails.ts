import type * as MaplibreGL from "maplibre-gl";

export const amenityLabels: Record<string, string> = {
    'convenience': 'Convenience Store',
    'doctors': 'Doctors clinic',
    'drinking_water': 'Drinking Water',
    'hardware': 'Hardware Store',
    'supermarket': 'Supermarket',
    'trade': 'Trade Store',
    'hospital': 'Hospital',
    'chemist': 'Pharmacy',
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

      // Build details HTML
      const detailsHTML = Object.entries(data).map(([key, value]) => {
        return `
          <div class="detail-row">
            <span class="detail-key">${key.toUpperCase().replace(/_/g, ' ')}:</span>
            <span class="detail-value">${value ?? 'N/A'}</span>
          </div>
        `;
      }).join('');

      // Add a route-to-water button if we have coordinates
      const routeToWaterButton = shelterLat !== null && shelterLng !== null
        ? `
          <div class="detail-row detail-row-action">
            <button class="route-button" data-building-key="drinking_water" data-shelter-lat="${shelterLat}" data-shelter-lng="${shelterLng}" title="Finn rute til nærmeste vann">
              Route to water
            </button>
          </div>
        `
        : '';

      modalContent.innerHTML = `
        <div class="modal-content">
          <button class="modal-close" onclick="window.closeShelterDetailsModal()">&times;</button>
          <h2>${data.romnr || 'Tilfluktsrom'}</h2>
          <div class="modal-details">
            ${detailsHTML}${routeToWaterButton}
          </div>
        </div>
      `;

      document.body.appendChild(modalContent);

      // Add event listeners to route buttons
      modalContent.querySelectorAll('.route-button').forEach((button: Element) => {
        button.addEventListener('click', async (e: Event) => {
          e.preventDefault();
          const buildingKey = (button as HTMLElement).getAttribute('data-building-key');
          const lat = parseFloat((button as HTMLElement).getAttribute('data-shelter-lat') || '0');
          const lng = parseFloat((button as HTMLElement).getAttribute('data-shelter-lng') || '0');

          if (!isNaN(lat) && !isNaN(lng)) {
            const { calculateAndDisplayPathToBuilding, clearPath } = await import('./shortestPath.js');
            clearPath(map);
            await calculateAndDisplayPathToBuilding(map, lat, lng, buildingKey || '');
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
