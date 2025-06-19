import React, { useState, useEffect, useRef } from 'react';
import { Car, MapPin, Play, Square, Download, Clock, Gauge, Navigation, AlertTriangle, RefreshCw } from 'lucide-react';
import { useData } from '../../contexts/DataContext';
import { useNotification } from '../../contexts/NotificationContext';
import apiService from '../../services/api';

const ApiOnlyRouteTracker = () => {
  const { data, loading } = useData();
  const { showSuccess, showError } = useNotification();
  
  // State for tracking
  const [selectedVehicle, setSelectedVehicle] = useState(null);
  const [isTracking, setIsTracking] = useState(false);
  const [activeJourney, setActiveJourney] = useState(null);
  const [routeHistory, setRouteHistory] = useState([]);
  const [trackingStartTime, setTrackingStartTime] = useState(null);
  
  // Map and route state
  const [mapInstance, setMapInstance] = useState(null);
  const [liveMarker, setLiveMarker] = useState(null);
  const [routePolyline, setRoutePolyline] = useState(null);
  const mapRef = useRef(null);
  const trackingIntervalRef = useRef(null);
  const routePointsRef = useRef([]);

  // Load route history from localStorage
  useEffect(() => {
    try {
      const saved = localStorage.getItem('api_route_history');
      if (saved) {
        setRouteHistory(JSON.parse(saved));
      }
    } catch (error) {
      console.error('Error loading route history:', error);
    }
  }, []);

  // Save route history to localStorage
  const saveRouteHistory = (history) => {
    try {
      localStorage.setItem('api_route_history', JSON.stringify(history));
    } catch (error) {
      console.error('Error saving route history:', error);
    }
  };

  // Initialize map
  useEffect(() => {
    if (!mapRef.current || mapInstance) return;

    const initMap = async () => {
      if (!window.L) {
        const leafletScript = document.createElement('script');
        leafletScript.src = 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.js';
        leafletScript.onload = () => createMap();
        document.head.appendChild(leafletScript);

        const leafletCSS = document.createElement('link');
        leafletCSS.rel = 'stylesheet';
        leafletCSS.href = 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.css';
        document.head.appendChild(leafletCSS);
      } else {
        createMap();
      }
    };

    const createMap = () => {
      const map = window.L.map(mapRef.current).setView([28.6139, 77.2090], 10);
      
      window.L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap contributors'
      }).addTo(map);

      setMapInstance(map);
    };

    initMap();

    return () => {
      if (trackingIntervalRef.current) {
        clearInterval(trackingIntervalRef.current);
      }
    };
  }, []);

  // Get real vehicle position from API only
  const getVehiclePositionFromAPI = async (vehicle) => {
    try {
      console.log(`🔍 Getting real position for vehicle ${vehicle.vehicle_id} from API...`);
      
      // Get devices assigned to this vehicle
      const devices = data.devices.filter(d => d.vehicle_id === vehicle.vehicle_id);
      
      if (devices.length === 0) {
        throw new Error(`No device assigned to vehicle ${vehicle.vehicle_number}`);
      }

      const device = devices[0];
      console.log(`📱 Found device ${device.device_id} for vehicle ${vehicle.vehicle_number}`);

      // Get latest telemetry data from API
      const telemetryResponse = await apiService.getLatestDeviceTelemetry(device.device_id);
      
      if (!telemetryResponse || !telemetryResponse.length || telemetryResponse.length === 0) {
        throw new Error(`No telemetry data available for device ${device.device_id}`);
      }

      const latestTelemetry = telemetryResponse[0];
      console.log(`📊 Latest telemetry for device ${device.device_id}:`, latestTelemetry);

      // Validate required data
      if (!latestTelemetry.latitude || !latestTelemetry.longitude) {
        throw new Error(`Invalid GPS coordinates in telemetry data: lat=${latestTelemetry.latitude}, lng=${latestTelemetry.longitude}`);
      }

      const position = {
        latitude: parseFloat(latestTelemetry.latitude),
        longitude: parseFloat(latestTelemetry.longitude),
        speed: parseFloat(latestTelemetry.speed || 0),
        heading: parseFloat(latestTelemetry.heading || 0),
        timestamp: latestTelemetry.timestamp || new Date().toISOString(),
        source: 'api_telemetry',
        device_id: device.device_id,
        telemetry_id: latestTelemetry.id || latestTelemetry.telemetry_id
      };

      console.log(`✅ Real position from API:`, position);
      return position;

    } catch (error) {
      console.error(`❌ Error getting vehicle position from API:`, error);
      throw error;
    }
  };

  // Start journey tracking with API data only
  const startJourneyTracking = async (vehicle) => {
    if (isTracking) {
      showError('Error', 'Stop current tracking first.');
      return;
    }

    if (!mapInstance) {
      showError('Error', 'Map not ready. Please wait a moment and try again.');
      return;
    }

    try {
      console.log(`🚀 Starting API-only journey tracking for ${vehicle.vehicle_number}`);
      
      setSelectedVehicle(vehicle);
      setIsTracking(true);
      setTrackingStartTime(new Date());
      routePointsRef.current = [];
      
      // Clear existing route
      if (routePolyline && mapInstance) {
        mapInstance.removeLayer(routePolyline);
      }

      // Get initial position from API
      const initialPosition = await getVehiclePositionFromAPI(vehicle);

      // Create journey object with API data
      const journey = {
        journey_id: `API_J_${Date.now()}`,
        vehicle_id: vehicle.vehicle_id,
        vehicle_number: vehicle.vehicle_number,
        start_time: new Date().toISOString(),
        start_location: {
          lat: initialPosition.latitude,
          lng: initialPosition.longitude,
          timestamp: initialPosition.timestamp,
          source: initialPosition.source,
          device_id: initialPosition.device_id,
          telemetry_id: initialPosition.telemetry_id
        },
        route_points: [{
          lat: initialPosition.latitude,
          lng: initialPosition.longitude,
          timestamp: initialPosition.timestamp,
          speed: initialPosition.speed,
          heading: initialPosition.heading,
          source: initialPosition.source,
          device_id: initialPosition.device_id,
          telemetry_id: initialPosition.telemetry_id
        }],
        status: 'ongoing',
        total_distance: 0,
        max_speed: initialPosition.speed,
        avg_speed: initialPosition.speed,
        data_source: 'api_only'
      };

      setActiveJourney(journey);
      routePointsRef.current = journey.route_points;

      // Add starting point marker
      if (mapInstance && window.L) {
        const startMarker = window.L.marker([initialPosition.latitude, initialPosition.longitude])
          .addTo(mapInstance)
          .bindPopup(`
            <strong>Journey Started</strong><br>
            Vehicle: ${vehicle.vehicle_number}<br>
            Time: ${new Date().toLocaleTimeString()}<br>
            Source: API Telemetry<br>
            Device: ${initialPosition.device_id}<br>
            Speed: ${initialPosition.speed.toFixed(1)} km/h
          `);

        // Center map on vehicle
        mapInstance.setView([initialPosition.latitude, initialPosition.longitude], 14);
      }

      // Start live tracking with API calls only
      trackingIntervalRef.current = setInterval(() => {
        trackLivePositionFromAPI(vehicle);
      }, 15000); // Update every 15 seconds to not overwhelm API

      showSuccess('Success', `API-only tracking started for ${vehicle.vehicle_number}`);
      console.log(`✅ Journey tracking started with API data:`, journey);

    } catch (error) {
      console.error('Error starting journey tracking:', error);
      showError('Error', `Failed to start tracking: ${error.message}`);
      setIsTracking(false);
      setSelectedVehicle(null);
    }
  };

  // Track live position using API calls only
  const trackLivePositionFromAPI = async (vehicle) => {
    if (!mapInstance || !window.L) return;

    try {
      console.log(`🔄 Fetching live position from API for ${vehicle.vehicle_number}...`);
      
      // Get new position from API
      const newPosition = await getVehiclePositionFromAPI(vehicle);
      
      const newPoint = {
        lat: newPosition.latitude,
        lng: newPosition.longitude,
        timestamp: newPosition.timestamp,
        speed: newPosition.speed,
        heading: newPosition.heading,
        source: newPosition.source,
        device_id: newPosition.device_id,
        telemetry_id: newPosition.telemetry_id
      };

      // Calculate distance from last point
      const lastPoint = routePointsRef.current[routePointsRef.current.length - 1];
      const distance = lastPoint ? calculateDistance(
        lastPoint.lat, lastPoint.lng,
        newPoint.lat, newPoint.lng
      ) : 0;

      // Only add point if there's significant movement (> 5 meters) OR if it's been more than 5 minutes
      const timeDiff = lastPoint ? Date.now() - new Date(lastPoint.timestamp).getTime() : 0;
      const shouldAddPoint = distance > 0.005 || timeDiff > 300000; // 5 meters or 5 minutes

      if (shouldAddPoint) {
        // Add distance to point
        newPoint.distance_from_previous = distance;

        // Add point to route
        routePointsRef.current.push(newPoint);

        // Update live marker
        if (liveMarker) {
          mapInstance.removeLayer(liveMarker);
        }

        const vehicleIcon = window.L.divIcon({
          html: `<div style="background: #3b82f6; color: white; width: 30px; height: 30px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 12px; border: 2px solid white; box-shadow: 0 2px 4px rgba(0,0,0,0.3); transform: rotate(${newPoint.heading}deg);">🚗</div>`,
          className: 'custom-div-icon',
          iconSize: [30, 30],
          iconAnchor: [15, 15]
        });

        const newLiveMarker = window.L.marker([newPoint.lat, newPoint.lng], {
          icon: vehicleIcon
        }).addTo(mapInstance);

        newLiveMarker.bindPopup(`
          <strong>${vehicle.vehicle_number}</strong><br>
          Speed: ${newPoint.speed.toFixed(1)} km/h<br>
          Time: ${new Date(newPoint.timestamp).toLocaleTimeString()}<br>
          Source: ${newPoint.source}<br>
          Device: ${newPoint.device_id}<br>
          Telemetry ID: ${newPoint.telemetry_id}<br>
          Distance: ${distance.toFixed(3)} km from last point
        `);

        setLiveMarker(newLiveMarker);

        // Update route polyline
        if (routePointsRef.current.length >= 2) {
          if (routePolyline) {
            mapInstance.removeLayer(routePolyline);
          }

          const coordinates = routePointsRef.current.map(point => [point.lat, point.lng]);
          const newPolyline = window.L.polyline(coordinates, {
            color: '#3b82f6',
            weight: 4,
            opacity: 0.8
          }).addTo(mapInstance);

          setRoutePolyline(newPolyline);
        }

        // Update journey data
        if (activeJourney) {
          const totalDistance = calculateTotalDistance(routePointsRef.current);
          const maxSpeed = Math.max(...routePointsRef.current.map(p => p.speed));
          const avgSpeed = routePointsRef.current.reduce((sum, p) => sum + p.speed, 0) / routePointsRef.current.length;

          setActiveJourney(prev => ({
            ...prev,
            route_points: routePointsRef.current,
            current_location: { lat: newPoint.lat, lng: newPoint.lng },
            total_distance: totalDistance,
            max_speed: maxSpeed,
            avg_speed: avgSpeed,
            last_updated: new Date().toISOString(),
            last_telemetry_id: newPoint.telemetry_id
          }));
        }

        console.log(`📍 API position updated: ${newPosition.latitude.toFixed(6)}, ${newPosition.longitude.toFixed(6)}, Speed: ${newPosition.speed} km/h, Source: ${newPosition.source}`);
      } else {
        console.log(`⏭️ Skipping point - insufficient movement (${distance.toFixed(3)} km) and time (${(timeDiff/1000/60).toFixed(1)} min)`);
      }

    } catch (error) {
      console.error('Error tracking live position from API:', error);
      // Don't show error to user for individual API calls, just log it
    }
  };

  // Stop journey tracking
  const stopJourneyTracking = async () => {
    if (!isTracking || !activeJourney) {
      showError('Error', 'No active journey to stop.');
      return;
    }

    try {
      if (trackingIntervalRef.current) {
        clearInterval(trackingIntervalRef.current);
      }

      // Get final position from API
      const finalPosition = await getVehiclePositionFromAPI(selectedVehicle);

      // Finalize journey
      const finalJourney = {
        ...activeJourney,
        end_time: new Date().toISOString(),
        end_location: {
          lat: finalPosition.latitude,
          lng: finalPosition.longitude,
          timestamp: finalPosition.timestamp,
          source: finalPosition.source,
          device_id: finalPosition.device_id,
          telemetry_id: finalPosition.telemetry_id
        },
        status: 'completed',
        duration: Date.now() - new Date(activeJourney.start_time).getTime(),
        total_distance: calculateTotalDistance(routePointsRef.current),
        summary: {
          total_points: routePointsRef.current.length,
          data_source: 'api_only',
          api_points: routePointsRef.current.length,
          devices_used: [...new Set(routePointsRef.current.map(p => p.device_id))],
          telemetry_ids: routePointsRef.current.map(p => p.telemetry_id).filter(Boolean)
        }
      };

      // Add end marker
      if (mapInstance && window.L) {
        window.L.marker([finalPosition.latitude, finalPosition.longitude])
          .addTo(mapInstance)
          .bindPopup(`
            <strong>Journey Ended</strong><br>
            Vehicle: ${selectedVehicle.vehicle_number}<br>
            Time: ${new Date().toLocaleTimeString()}<br>
            Final Speed: ${finalPosition.speed.toFixed(1)} km/h<br>
            Source: API Telemetry<br>
            Device: ${finalPosition.device_id}
          `);
      }

      // Save to history
      const newHistory = [finalJourney, ...routeHistory];
      setRouteHistory(newHistory);
      saveRouteHistory(newHistory);

      // Reset state
      setIsTracking(false);
      setActiveJourney(null);
      setSelectedVehicle(null);
      setTrackingStartTime(null);
      routePointsRef.current = [];

      showSuccess('Success', `API journey completed for ${finalJourney.vehicle_number}! Distance: ${finalJourney.total_distance.toFixed(2)} km, Points: ${finalJourney.summary.total_points}`);
      console.log(`✅ API-only journey completed:`, finalJourney);

    } catch (error) {
      console.error('Error stopping journey tracking:', error);
      showError('Error', `Failed to stop tracking: ${error.message}`);
    }
  };

  // Calculate distance between two points (Haversine formula)
  const calculateDistance = (lat1, lng1, lat2, lng2) => {
    const R = 6371; // Earth's radius in km
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLng = (lng2 - lng1) * Math.PI / 180;
    const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
              Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
              Math.sin(dLng/2) * Math.sin(dLng/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c;
  };

  // Calculate total distance of route
  const calculateTotalDistance = (points) => {
    if (points.length < 2) return 0;
    return points.reduce((total, point, index) => {
      if (index === 0) return 0;
      return total + calculateDistance(
        points[index-1].lat, points[index-1].lng,
        point.lat, point.lng
      );
    }, 0);
  };

  // Export journey data
  const exportJourney = (journey) => {
    try {
      const dataStr = JSON.stringify(journey, null, 2);
      const dataBlob = new Blob([dataStr], { type: 'application/json' });
      const url = URL.createObjectURL(dataBlob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `api_journey_${journey.vehicle_number}_${new Date(journey.start_time).toISOString().slice(0, 10)}.json`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      
      showSuccess('Success', 'API journey data exported successfully');
    } catch (error) {
      showError('Error', 'Failed to export journey data');
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-96">
        <div className="text-center">
          <div className="w-8 h-8 mx-auto mb-4 border-4 border-blue-600 rounded-full border-t-transparent animate-spin"></div>
          <p className="text-gray-600">Loading vehicles from API...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto space-y-6 max-w-7xl">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">API-Only Route Tracker</h1>
          <p className="text-gray-600">Track vehicle journeys using real API telemetry data only</p>
        </div>
        {isTracking && (
          <div className="flex items-center gap-2 px-3 py-2 bg-green-100 rounded-lg">
            <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
            <span className="text-sm font-medium text-green-800">API Tracking Active</span>
          </div>
        )}
      </div>

      {/* API Data Source Warning */}
      <div className="p-4 border border-blue-200 rounded-lg bg-blue-50">
        <div className="flex items-start gap-2">
          <AlertTriangle className="w-5 h-5 text-blue-600 mt-0.5" />
          <div>
            <h4 className="font-medium text-blue-900">API-Only Data Source</h4>
            <p className="mt-1 text-sm text-blue-800">
              This tracker uses <strong>ONLY real API data</strong> from your telemetry endpoints. 
              No mock values, simulations, or GPS fallbacks are used. All coordinates, speed, and movement 
              data comes directly from <code>GET /device/v1/data/[deviceId]</code>
            </p>
          </div>
        </div>
      </div>

      {/* Vehicle Selection */}
      {!isTracking && (
        <div className="p-4 bg-white rounded-lg shadow">
          <h3 className="mb-4 text-lg font-medium text-gray-900">Select Vehicle with API Data</h3>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
            {data.vehicles.map((vehicle) => {
              const assignedDevice = data.devices.find(d => d.vehicle_id === vehicle.vehicle_id);
              const hasApiData = assignedDevice && assignedDevice.latitude && assignedDevice.longitude;
              
              return (
                <div key={vehicle.vehicle_id} className={`p-4 border rounded-lg transition-colors ${
                  hasApiData ? 'hover:border-blue-300 cursor-pointer' : 'border-gray-200 opacity-50'
                }`}>
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <Car className="w-5 h-5 text-blue-600" />
                      <span className="font-medium">{vehicle.vehicle_number}</span>
                    </div>
                    {hasApiData ? (
                      <div className="flex items-center gap-1 text-green-600">
                        <MapPin className="w-4 h-4" />
                        <span className="text-xs">API Data</span>
                      </div>
                    ) : (
                      <div className="flex items-center gap-1 text-red-600">
                        <AlertTriangle className="w-4 h-4" />
                        <span className="text-xs">No API Data</span>
                      </div>
                    )}
                  </div>
                  <div className="mb-3 text-sm text-gray-600">
                    <p>{vehicle.make} {vehicle.model}</p>
                    {assignedDevice ? (
                      <div className="space-y-1">
                        <p>Device: {assignedDevice.device_id}</p>
                        <p>API Coordinates: {hasApiData ? `${assignedDevice.latitude}, ${assignedDevice.longitude}` : 'Not available'}</p>
                        <p>API Speed: {assignedDevice.speed || 0} km/h</p>
                      </div>
                    ) : (
                      <p className="text-red-600">No device assigned</p>
                    )}
                  </div>
                  <button
                    onClick={() => hasApiData && startJourneyTracking(vehicle)}
                    disabled={!hasApiData}
                    className={`w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg font-medium ${
                      hasApiData 
                        ? 'bg-blue-600 text-white hover:bg-blue-700' 
                        : 'bg-gray-300 text-gray-500 cursor-not-allowed'
                    }`}
                  >
                    <Play className="w-4 h-4" />
                    {hasApiData ? 'Start API Tracking' : 'No API Data Available'}
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Active Journey Status */}
      {isTracking && activeJourney && (
        <div className="p-4 bg-white rounded-lg shadow">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-medium text-gray-900">Active API Journey</h3>
            <button
              onClick={stopJourneyTracking}
              className="flex items-center gap-2 px-4 py-2 text-white bg-red-600 rounded-lg hover:bg-red-700"
            >
              <Square className="w-4 h-4" />
              Stop API Tracking
            </button>
          </div>
          
          <div className="grid grid-cols-1 gap-4 mb-4 md:grid-cols-4">
            <div className="p-3 rounded-lg bg-blue-50">
              <div className="flex items-center gap-2 mb-1">
                <Car className="w-4 h-4 text-blue-600" />
                <span className="text-sm font-medium text-blue-600">Vehicle</span>
              </div>
              <div className="text-lg font-bold text-blue-900">{activeJourney.vehicle_number}</div>
            </div>
            
            <div className="p-3 rounded-lg bg-green-50">
              <div className="flex items-center gap-2 mb-1">
                <Clock className="w-4 h-4 text-green-600" />
                <span className="text-sm font-medium text-green-600">Duration</span>
              </div>
              <div className="text-lg font-bold text-green-900">
                {trackingStartTime && Math.floor((Date.now() - trackingStartTime.getTime()) / 60000)} min
              </div>
            </div>
            
            <div className="p-3 rounded-lg bg-purple-50">
              <div className="flex items-center gap-2 mb-1">
                <Navigation className="w-4 h-4 text-purple-600" />
                <span className="text-sm font-medium text-purple-600">Distance</span>
              </div>
              <div className="text-lg font-bold text-purple-900">
                {activeJourney.total_distance?.toFixed(3) || 0} km
              </div>
            </div>
            
            <div className="p-3 rounded-lg bg-orange-50">
              <div className="flex items-center gap-2 mb-1">
                <Gauge className="w-4 h-4 text-orange-600" />
                <span className="text-sm font-medium text-orange-600">Current Speed</span>
              </div>
              <div className="text-lg font-bold text-orange-900">
                {activeJourney.route_points?.length > 0 ? 
                  activeJourney.route_points[activeJourney.route_points.length - 1].speed.toFixed(1) : 0} km/h
              </div>
            </div>
          </div>

          {/* API Data Info */}
          <div className="p-3 rounded-lg bg-gray-50">
            <h4 className="mb-2 text-sm font-medium text-gray-700">API Data Status</h4>
            <div className="grid grid-cols-2 gap-2 text-xs md:grid-cols-4">
              <span>Points: {activeJourney.route_points?.length || 0}</span>
              <span>Source: {activeJourney.data_source}</span>
              <span>Last Update: {activeJourney.last_updated ? new Date(activeJourney.last_updated).toLocaleTimeString() : 'Never'}</span>
              <span>Telemetry ID: {activeJourney.last_telemetry_id || 'N/A'}</span>
            </div>
          </div>
        </div>
      )}

      {/* Map */}
      <div className="overflow-hidden bg-white rounded-lg shadow">
        <div className="p-4 border-b">
          <h3 className="text-lg font-medium text-gray-900">Live Route Map (API Data Only)</h3>
        </div>
        <div className="relative">
          <div ref={mapRef} style={{ height: '500px', width: '100%' }}></div>
          {!mapInstance && (
            <div className="absolute inset-0 flex items-center justify-center bg-gray-100">
              <div className="text-center">
                <div className="w-8 h-8 mx-auto mb-2 border-4 border-blue-600 rounded-full border-t-transparent animate-spin"></div>
                <p className="text-sm text-gray-600">Loading map...</p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Journey History */}
      <div className="bg-white rounded-lg shadow">
        <div className="p-4 border-b">
          <h3 className="text-lg font-medium text-gray-900">API Journey History</h3>
        </div>
        <div className="divide-y">
          {routeHistory.length === 0 ? (
            <div className="p-8 text-center text-gray-500">
              <Navigation className="w-12 h-12 mx-auto mb-3 text-gray-300" />
              <p>No API journeys recorded yet</p>
              <p className="text-sm">Start tracking a vehicle to see journey history</p>
            </div>
          ) : (
            routeHistory.slice(0, 10).map((journey) => (
              <div key={journey.journey_id} className="p-4 hover:bg-gray-50">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <Car className="w-4 h-4 text-gray-600" />
                      <span className="font-medium">{journey.vehicle_number}</span>
                      <span className="px-2 py-1 text-xs text-blue-800 bg-blue-100 rounded">
                        API Only
                      </span>
                      <span className="px-2 py-1 text-xs text-green-800 bg-green-100 rounded">
                        {journey.status}
                      </span>
                    </div>
                    <div className="text-sm text-gray-600">
                      <p>Distance: {journey.total_distance?.toFixed(3) || 0} km | Points: {journey.summary?.total_points || 0} | Duration: {journey.duration ? Math.floor(journey.duration / 60000) : 0} min</p>
                      <p>Started: {new Date(journey.start_time).toLocaleString()}</p>
                      <p>API Source: Telemetry endpoint | Devices: {journey.summary?.devices_used?.join(', ') || 'Unknown'}</p>
                    </div>
                  </div>
                  <button
                    onClick={() => exportJourney(journey)}
                    className="flex items-center gap-2 px-3 py-2 text-blue-600 rounded-lg hover:bg-blue-50"
                  >
                    <Download className="w-4 h-4" />
                    Export API Data
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};

export default ApiOnlyRouteTracker;