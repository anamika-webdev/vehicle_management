// hooks/useRouteTracking.js
import { useState } from 'react';

export const useRouteTracking = () => {
  const [activeJourneys, setActiveJourneys] = useState([]);
  const [journeyHistory, setJourneyHistory] = useState([]);
  const [isTracking, setIsTracking] = useState(false);
  const [trackingErrors, setTrackingErrors] = useState({});

  const startTracking = async (vehicleId) => {
    console.log('Starting tracking for vehicle:', vehicleId);
    setIsTracking(true);
  };

  const stopTracking = async (vehicleId) => {
    console.log('Stopping tracking for vehicle:', vehicleId);
    setIsTracking(false);
  };

  const getActiveJourney = (vehicleId) => {
    return activeJourneys.find(j => j.vehicle_id === vehicleId);
  };

  const isVehicleTracked = (vehicleId) => {
    return activeJourneys.some(j => j.vehicle_id === vehicleId);
  };

  const getVehicleHistory = (vehicleId, limit = 10) => {
    return journeyHistory.filter(j => j.vehicle_id === vehicleId).slice(0, limit);
  };

  const getJourneyStats = () => ({
    active_journeys: activeJourneys.length,
    total_journeys: journeyHistory.length,
    total_distance: 0,
    total_duration: 0
  });

  // Export route/journey data as JSON file
  const exportRoute = (journey) => {
    try {
      // Validate journey data
      if (!journey) {
        console.error('No journey data provided for export');
        return false;
      }

      // Prepare the data for export
      const exportData = {
        ...journey,
        exported_at: new Date().toISOString(),
        export_version: '1.0'
      };

      // Convert to JSON with pretty formatting
      const data = JSON.stringify(exportData, null, 2);
      
      // Create blob and download
      const blob = new Blob([data], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      
      // Generate filename with vehicle number and timestamp
      const vehicleNumber = journey.vehicle_number || journey.vehicleNumber || 'unknown';
      const timestamp = Date.now();
      a.download = `route_${vehicleNumber}_${timestamp}.json`;
      
      // Trigger download
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      
      // Clean up the object URL
      URL.revokeObjectURL(url);
      
      console.log('Route exported successfully:', a.download);
      return true;
    } catch (error) {
      console.error('Failed to export route:', error);
      return false;
    }
  };

  // Export multiple journeys
  const exportMultipleRoutes = (journeys) => {
    try {
      if (!journeys || journeys.length === 0) {
        console.error('No journeys provided for export');
        return false;
      }

      const exportData = {
        journeys: journeys,
        total_count: journeys.length,
        exported_at: new Date().toISOString(),
        export_version: '1.0'
      };

      const data = JSON.stringify(exportData, null, 2);
      const blob = new Blob([data], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `routes_batch_${Date.now()}.json`;
      
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      
      console.log('Multiple routes exported successfully');
      return true;
    } catch (error) {
      console.error('Failed to export multiple routes:', error);
      return false;
    }
  };

  // Export journey history for a specific vehicle
  const exportVehicleHistory = (vehicleId) => {
    const vehicleJourneys = getVehicleHistory(vehicleId, 1000); // Get up to 1000 records
    if (vehicleJourneys.length > 0) {
      const vehicleNumber = vehicleJourneys[0]?.vehicle_number || vehicleId;
      const exportData = {
        vehicle_id: vehicleId,
        vehicle_number: vehicleNumber,
        journeys: vehicleJourneys,
        total_count: vehicleJourneys.length,
        exported_at: new Date().toISOString(),
        export_version: '1.0'
      };

      const data = JSON.stringify(exportData, null, 2);
      const blob = new Blob([data], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `vehicle_${vehicleNumber}_history_${Date.now()}.json`;
      
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      
      return true;
    }
    return false;
  };

  return {
    activeJourneys,
    journeyHistory,
    isTracking,
    trackingErrors,
    startTracking,
    stopTracking,
    getActiveJourney,
    isVehicleTracked,
    getVehicleHistory,
    getJourneyStats,
    exportRoute,
    exportMultipleRoutes,
    exportVehicleHistory
  };
};

export const useRouteTrackingMap = (mapInstance) => {
  const routeTracking = useRouteTracking();

  const showHistoricalRoute = (journey) => {
    console.log('Showing historical route:', journey);
  };

  const clearMapRoutes = () => {
    console.log('Clearing map routes');
  };

  const updateJourneyOnMap = (journey) => {
    console.log('Updating journey on map:', journey);
  };

  // Export route and show on map
  const exportAndShowRoute = (journey) => {
    const exported = routeTracking.exportRoute(journey);
    if (exported) {
      showHistoricalRoute(journey);
    }
    return exported;
  };

  return {
    ...routeTracking,
    showHistoricalRoute,
    clearMapRoutes,
    updateJourneyOnMap,
    exportAndShowRoute
  };
};

export default useRouteTracking;