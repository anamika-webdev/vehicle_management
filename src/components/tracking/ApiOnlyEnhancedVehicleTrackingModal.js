import React, { useState, useEffect, useRef } from 'react';
import { Car, MapPin, Activity, Clock, Navigation, Gauge, X, Square, RefreshCw, Database, AlertTriangle } from 'lucide-react';
import { useData } from '../../contexts/DataContext';
import { useNotification } from '../../contexts/NotificationContext';
import apiService from '../../services/api';

const SafeApiOnlyEnhancedVehicleTrackingModal = ({ isOpen, onClose, vehicle }) => {
  const { data } = useData();
  const { showSuccess, showError } = useNotification();
  
  const [activeTab, setActiveTab] = useState('route');
  const [isTracking, setIsTracking] = useState(false);
  const [trackingData, setTrackingData] = useState({
    startTime: null,
    duration: 0,
    distance: 0,
    avgSpeed: 0,
    currentSpeed: 0,
    routePoints: [],
    telemetryIds: [],
    deviceId: null
  });

  // Map refs
  const mapRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const routePolylineRef = useRef(null);
  const liveMarkerRef = useRef(null);
  const trackingIntervalRef = useRef(null);
  const markersRef = useRef([]);

  // Get device assigned to vehicle
  const assignedDevice = data.devices.find(d => d.vehicle_id === vehicle?.vehicle_id);

  // Safe cleanup function
  const safeCleanup = () => {
    console.log('🧹 Starting safe cleanup...');

    // 1. Stop tracking interval first
    if (trackingIntervalRef.current) {
      clearInterval(trackingIntervalRef.current);
      trackingIntervalRef.current = null;
      console.log('✅ Cleared tracking interval');
    }

    // 2. Clean up map markers and layers before removing map
    if (mapInstanceRef.current && window.L) {
      try {
        // Remove all markers
        markersRef.current.forEach(marker => {
          try {
            if (mapInstanceRef.current.hasLayer(marker)) {
              mapInstanceRef.current.removeLayer(marker);
            }
          } catch (error) {
            console.warn('Error removing marker:', error);
          }
        });
        markersRef.current = [];

        // Remove polyline
        if (routePolylineRef.current && mapInstanceRef.current.hasLayer(routePolylineRef.current)) {
          mapInstanceRef.current.removeLayer(routePolylineRef.current);
          routePolylineRef.current = null;
        }

        // Remove live marker
        if (liveMarkerRef.current && mapInstanceRef.current.hasLayer(liveMarkerRef.current)) {
          mapInstanceRef.current.removeLayer(liveMarkerRef.current);
          liveMarkerRef.current = null;
        }

        console.log('✅ Cleaned up map layers');
      } catch (error) {
        console.warn('Error cleaning up map layers:', error);
      }

      // 3. Remove map instance
      try {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
        console.log('✅ Removed map instance');
      } catch (error) {
        console.warn('Error removing map:', error);
      }
    }

    // 4. Reset state
    setIsTracking(false);
    setTrackingData({
      startTime: null,
      duration: 0,
      distance: 0,
      avgSpeed: 0,
      currentSpeed: 0,
      routePoints: [],
      telemetryIds: [],
      deviceId: null
    });

    console.log('✅ Cleanup completed');
  };

  // Handle close with safe cleanup
  const handleClose = () => {
    console.log('🔄 Closing modal...');
    safeCleanup();
    
    // Call parent close function
    if (onClose && typeof onClose === 'function') {
      onClose();
    }
  };

  // Load Leaflet
  useEffect(() => {
    if (!isOpen) return;

    const loadLeaflet = async () => {
      if (window.L) return;

      try {
        // Load CSS
        const cssLink = document.createElement('link');
        cssLink.rel = 'stylesheet';
        cssLink.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
        document.head.appendChild(cssLink);

        // Load JS
        await new Promise((resolve, reject) => {
          const script = document.createElement('script');
          script.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';
          script.onload = () => {
            if (window.L.Icon.Default) {
              window.L.Icon.Default.mergeOptions({
                iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
                iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
                shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
              });
            }
            resolve();
          };
          script.onerror = reject;
          document.head.appendChild(script);
        });
        
        console.log('✅ Leaflet loaded successfully');
      } catch (error) {
        console.error('❌ Error loading Leaflet:', error);
      }
    };

    loadLeaflet();
  }, [isOpen]);

  // Initialize map
  useEffect(() => {
    if (!isOpen || !mapRef.current || mapInstanceRef.current || !window.L || !assignedDevice) return;

    try {
      console.log('🗺️ Initializing map...');
      
      const map = window.L.map(mapRef.current, {
        center: [parseFloat(assignedDevice.latitude) || 28.6139, parseFloat(assignedDevice.longitude) || 77.2090],
        zoom: 15,
        zoomControl: false
      });

      window.L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap contributors'
      }).addTo(map);

      mapInstanceRef.current = map;

      // Add initial vehicle marker from API data
      if (assignedDevice.latitude && assignedDevice.longitude) {
        const marker = window.L.marker([parseFloat(assignedDevice.latitude), parseFloat(assignedDevice.longitude)])
          .addTo(map)
          .bindPopup(`
            <strong>${vehicle.vehicle_number}</strong><br>
            Device: ${assignedDevice.device_id}<br>
            API Speed: ${assignedDevice.speed || 0} km/h<br>
            Status: Ready for API tracking
          `);
        
        liveMarkerRef.current = marker;
        markersRef.current.push(marker);
      }

      console.log('✅ Map initialized successfully');

    } catch (error) {
      console.error('❌ Error initializing map:', error);
    }
  }, [isOpen, vehicle, assignedDevice]);

  // Enhanced API telemetry data fetching
  const getApiTelemetryData = async () => {
    if (!assignedDevice) {
      throw new Error('No device assigned to vehicle');
    }

    const deviceId = assignedDevice.device_id;
    console.log(`📡 Fetching API telemetry for device ${deviceId}...`);

    try {
      // Try the working endpoint: /device/v1/data/{deviceId}?direction=desc
      console.log(`🔄 Trying working endpoint: /device/v1/data/${deviceId}?direction=desc`);
      
      const response = await fetch(`${apiService.baseURL}/device/v1/data/${deviceId}?direction=desc`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('authToken')}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error(`API request failed: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      console.log(`📊 Raw API response:`, data);

      if (!data.success || !data.data || !Array.isArray(data.data) || data.data.length === 0) {
        throw new Error(`No telemetry data in API response`);
      }

      const latestTelemetry = data.data[0];
      console.log(`✅ Latest telemetry record:`, latestTelemetry);

      if (!latestTelemetry.latitude || !latestTelemetry.longitude) {
        throw new Error(`Invalid coordinates in telemetry: lat=${latestTelemetry.latitude}, lng=${latestTelemetry.longitude}`);
      }

      const apiData = {
        latitude: parseFloat(latestTelemetry.latitude),
        longitude: parseFloat(latestTelemetry.longitude),
        speed: parseFloat(latestTelemetry.speed || 0),
        heading: parseFloat(latestTelemetry.heading || 0),
        timestamp: latestTelemetry.timestamp || new Date().toISOString(),
        telemetry_id: latestTelemetry.id || latestTelemetry.telemetry_id,
        device_id: deviceId,
        source: 'api_telemetry'
      };

      console.log(`✅ Processed API data:`, apiData);
      return apiData;

    } catch (error) {
      console.error(`❌ Error getting API telemetry for device ${deviceId}:`, error);
      
      // Try fallback: use device coordinates if available
      if (assignedDevice.latitude && assignedDevice.longitude) {
        console.log(`🔄 Falling back to device coordinates...`);
        return {
          latitude: parseFloat(assignedDevice.latitude),
          longitude: parseFloat(assignedDevice.longitude),
          speed: parseFloat(assignedDevice.speed || 0),
          heading: 0,
          timestamp: new Date().toISOString(),
          telemetry_id: 'device_fallback',
          device_id: deviceId,
          source: 'device_coordinates'
        };
      }
      
      throw error;
    }
  };

  // Update tracking data from API
  const updateTrackingDataFromApi = async () => {
    try {
      const apiData = await getApiTelemetryData();
      
      const now = Date.now();
      const duration = trackingData.startTime ? now - new Date(trackingData.startTime).getTime() : 0;
      
      // Calculate distance if we have previous points
      let newDistance = trackingData.distance;
      if (trackingData.routePoints.length > 0) {
        const lastPoint = trackingData.routePoints[trackingData.routePoints.length - 1];
        const pointDistance = calculateDistance(
          lastPoint.latitude, lastPoint.longitude,
          apiData.latitude, apiData.longitude
        );
        newDistance += pointDistance;
      }

      // Add new point to route
      const newRoutePoints = [...trackingData.routePoints, {
        latitude: apiData.latitude,
        longitude: apiData.longitude,
        speed: apiData.speed,
        heading: apiData.heading,
        timestamp: apiData.timestamp,
        telemetry_id: apiData.telemetry_id,
        source: apiData.source
      }];

      // Calculate speeds
      const speeds = newRoutePoints.map(p => p.speed).filter(s => s > 0);
      const maxSpeed = speeds.length > 0 ? Math.max(...speeds) : 0;
      const avgSpeed = speeds.length > 0 ? speeds.reduce((a, b) => a + b, 0) / speeds.length : 0;

      setTrackingData({
        startTime: trackingData.startTime,
        duration: duration,
        distance: newDistance,
        avgSpeed: avgSpeed,
        currentSpeed: apiData.speed,
        routePoints: newRoutePoints,
        telemetryIds: [...trackingData.telemetryIds, apiData.telemetry_id].filter(Boolean),
        deviceId: apiData.device_id
      });

      // Update map safely
      updateMapFromApiData(newRoutePoints);

      console.log(`📊 API tracking data updated - Points: ${newRoutePoints.length}, Distance: ${newDistance.toFixed(3)}km, Speed: ${apiData.speed}km/h`);

    } catch (error) {
      console.error('❌ Error updating tracking data from API:', error);
      showError('API Error', `Failed to get telemetry data: ${error.message}`);
    }
  };

  // Safe map update function
  const updateMapFromApiData = (routePoints) => {
    if (!mapInstanceRef.current || !window.L || !routePoints || routePoints.length === 0) return;

    try {
      // Remove existing route safely
      if (routePolylineRef.current) {
        try {
          if (mapInstanceRef.current.hasLayer(routePolylineRef.current)) {
            mapInstanceRef.current.removeLayer(routePolylineRef.current);
          }
        } catch (error) {
          console.warn('Error removing polyline:', error);
        }
        routePolylineRef.current = null;
      }

      // Remove existing live marker safely
      if (liveMarkerRef.current) {
        try {
          if (mapInstanceRef.current.hasLayer(liveMarkerRef.current)) {
            mapInstanceRef.current.removeLayer(liveMarkerRef.current);
          }
        } catch (error) {
          console.warn('Error removing live marker:', error);
        }
        liveMarkerRef.current = null;
      }

      // Add route polyline
      if (routePoints.length >= 2) {
        const coordinates = routePoints.map(point => [point.latitude, point.longitude]);
        
        const polyline = window.L.polyline(coordinates, {
          color: '#3b82f6',
          weight: 4,
          opacity: 0.8,
          dashArray: '5, 5'
        }).addTo(mapInstanceRef.current);

        routePolylineRef.current = polyline;

        // Add start marker
        const startPoint = routePoints[0];
        const startMarker = window.L.marker([startPoint.latitude, startPoint.longitude], {
          icon: window.L.divIcon({
            html: '<div style="background: #10b981; color: white; width: 20px; height: 20px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 10px; border: 2px solid white;">S</div>',
            className: 'custom-start-marker',
            iconSize: [20, 20],
            iconAnchor: [10, 10]
          })
        }).addTo(mapInstanceRef.current);

        markersRef.current.push(startMarker);
      }

      // Add current position marker
      const currentPoint = routePoints[routePoints.length - 1];
      const vehicleMarker = window.L.marker([currentPoint.latitude, currentPoint.longitude], {
        icon: window.L.divIcon({
          html: `<div style="background: #3b82f6; color: white; width: 30px; height: 30px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 12px; border: 2px solid white; box-shadow: 0 2px 4px rgba(0,0,0,0.3);">🚗</div>`,
          className: 'custom-vehicle-marker',
          iconSize: [30, 30],
          iconAnchor: [15, 15]
        })
      }).addTo(mapInstanceRef.current);

      vehicleMarker.bindPopup(`
        <strong>${vehicle?.vehicle_number}</strong><br>
        API Speed: ${currentPoint.speed?.toFixed(1) || 0} km/h<br>
        Time: ${new Date(currentPoint.timestamp).toLocaleTimeString()}<br>
        Source: ${currentPoint.source}<br>
        Device: ${currentPoint.device_id || assignedDevice?.device_id}<br>
        Telemetry ID: ${currentPoint.telemetry_id}
      `);

      liveMarkerRef.current = vehicleMarker;
      markersRef.current.push(vehicleMarker);

      // Auto-center map on current position
      mapInstanceRef.current.setView([currentPoint.latitude, currentPoint.longitude], 16);

    } catch (error) {
      console.error('Error updating map from API data:', error);
    }
  };

  // Start API tracking
  const startApiTracking = async () => {
    if (!assignedDevice) {
      showError('Error', 'No device assigned to this vehicle');
      return;
    }

    try {
      console.log(`🚀 Starting API-only tracking for ${vehicle.vehicle_number}...`);

      // Get initial API data
      const initialData = await getApiTelemetryData();

      setIsTracking(true);
      setTrackingData({
        startTime: new Date().toISOString(),
        duration: 0,
        distance: 0,
        avgSpeed: initialData.speed,
        currentSpeed: initialData.speed,
        routePoints: [{
          latitude: initialData.latitude,
          longitude: initialData.longitude,
          speed: initialData.speed,
          heading: initialData.heading,
          timestamp: initialData.timestamp,
          telemetry_id: initialData.telemetry_id,
          source: initialData.source
        }],
        telemetryIds: [initialData.telemetry_id],
        deviceId: initialData.device_id
      });

      // Start API polling interval
      trackingIntervalRef.current = setInterval(updateTrackingDataFromApi, 15000);

      showSuccess('Success', `API tracking started for ${vehicle.vehicle_number}`);

    } catch (error) {
      console.error('Error starting API tracking:', error);
      showError('Error', `Failed to start API tracking: ${error.message}`);
    }
  };

  // Stop tracking safely
  const stopApiTracking = () => {
    console.log('🛑 Stopping API tracking...');
    
    setIsTracking(false);
    
    if (trackingIntervalRef.current) {
      clearInterval(trackingIntervalRef.current);
      trackingIntervalRef.current = null;
    }

    // Safely add end marker only if map still exists
    if (trackingData.routePoints.length > 0 && mapInstanceRef.current && window.L) {
      try {
        const endPoint = trackingData.routePoints[trackingData.routePoints.length - 1];
        const endMarker = window.L.marker([endPoint.latitude, endPoint.longitude], {
          icon: window.L.divIcon({
            html: '<div style="background: #ef4444; color: white; width: 20px; height: 20px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 10px; border: 2px solid white;">E</div>',
            className: 'custom-end-marker',
            iconSize: [20, 20],
            iconAnchor: [10, 10]
          })
        }).addTo(mapInstanceRef.current);

        markersRef.current.push(endMarker);
        
        showSuccess('Success', `API journey completed! Distance: ${trackingData.distance.toFixed(3)} km, Points: ${trackingData.routePoints.length}`);
      } catch (error) {
        console.warn('Error adding end marker:', error);
        showSuccess('Success', `API journey completed! Distance: ${trackingData.distance.toFixed(3)} km, Points: ${trackingData.routePoints.length}`);
      }
    }
  };

  // Calculate distance
  const calculateDistance = (lat1, lng1, lat2, lng2) => {
    const R = 6371;
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLng = (lng2 - lng1) * Math.PI / 180;
    const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
              Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
              Math.sin(dLng/2) * Math.sin(dLng/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c;
  };

  // Format duration
  const formatDuration = (milliseconds) => {
    const seconds = Math.floor(milliseconds / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    
    if (hours > 0) {
      return `${hours}:${(minutes % 60).toString().padStart(2, '0')}:${(seconds % 60).toString().padStart(2, '0')}`;
    }
    return `${minutes}:${(seconds % 60).toString().padStart(2, '0')}`;
  };

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      console.log('🧹 Component unmounting, cleaning up...');
      safeCleanup();
    };
  }, []);

  // Handle ESC key
  useEffect(() => {
    const handleEsc = (event) => {
      if (event.keyCode === 27) {
        handleClose();
      }
    };

    if (isOpen) {
      document.addEventListener('keydown', handleEsc);
    }

    return () => {
      document.removeEventListener('keydown', handleEsc);
    };
  }, [isOpen]);

  // Cleanup when modal closes
  useEffect(() => {
    if (!isOpen) {
      safeCleanup();
    }
  }, [isOpen]);

  if (!isOpen || !vehicle) return null;

  const hasApiData = assignedDevice && assignedDevice.latitude && assignedDevice.longitude;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
      <div className="w-full max-w-6xl h-[90vh] bg-white rounded-lg shadow-xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b bg-gray-50">
          <div className="flex items-center gap-3">
            <Car className="w-6 h-6 text-blue-600" />
            <div>
              <h2 className="text-lg font-semibold text-gray-900">
                {vehicle.vehicle_number} - API-Only Tracking
              </h2>
              <p className="text-sm text-gray-600">{vehicle.make} {vehicle.model}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {isTracking && (
              <div className="flex items-center gap-2 px-3 py-1 bg-green-100 rounded-full">
                <Database className="w-3 h-3 text-green-600" />
                <span className="text-sm font-medium text-green-800">API Tracking</span>
              </div>
            )}
            <button
              onClick={handleClose}
              className="p-2 text-gray-400 transition-colors rounded-lg hover:text-gray-600 hover:bg-gray-100"
              title="Close modal (ESC)"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        <div className="flex h-full">
          {/* Sidebar */}
          <div className="overflow-y-auto border-r w-80 bg-gray-50">
            {/* Tab Navigation */}
            <div className="flex border-b">
              <button
                onClick={() => setActiveTab('live')}
                className={`flex-1 px-4 py-3 text-sm font-medium ${
                  activeTab === 'live' 
                    ? 'text-blue-600 border-b-2 border-blue-600 bg-white' 
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                <Activity className="inline w-4 h-4 mr-1" />
                API Data
              </button>
              <button
                onClick={() => setActiveTab('route')}
                className={`flex-1 px-4 py-3 text-sm font-medium ${
                  activeTab === 'route' 
                    ? 'text-blue-600 border-b-2 border-blue-600 bg-white' 
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                <Navigation className="inline w-4 h-4 mr-1" />
                Route
              </button>
            </div>

            {/* Tab Content */}
            <div className="p-4">
              {activeTab === 'live' && (
                <div className="space-y-4">
                  {/* API Data Status */}
                  <div className={`p-3 rounded-lg border ${hasApiData ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'}`}>
                    <h5 className={`font-medium mb-2 ${hasApiData ? 'text-green-900' : 'text-red-900'}`}>
                      API Data Status
                    </h5>
                    <div className={`text-sm ${hasApiData ? 'text-green-800' : 'text-red-800'}`}>
                      {hasApiData ? (
                        <div className="space-y-1">
                          <div>✅ Device: {assignedDevice.device_id}</div>
                          <div>✅ Coordinates: {assignedDevice.latitude}, {assignedDevice.longitude}</div>
                          <div>✅ Speed: {assignedDevice.speed || 0} km/h</div>
                          <div>✅ Last Update: {assignedDevice.last_updated || 'Unknown'}</div>
                        </div>
                      ) : (
                        <div className="space-y-1">
                          <div>❌ No API data available</div>
                          {!assignedDevice && <div>❌ No device assigned</div>}
                          {assignedDevice && !assignedDevice.latitude && <div>❌ No coordinates</div>}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Live Metrics */}
                  {hasApiData && (
                    <div className="grid grid-cols-2 gap-3">
                      <div className="p-3 rounded-lg bg-blue-50">
                        <div className="flex items-center justify-between">
                          <Gauge className="w-5 h-5 text-blue-600" />
                          <span className="text-xs font-medium text-blue-600">API SPEED</span>
                        </div>
                        <div className="mt-1 text-2xl font-bold text-blue-900">
                          {trackingData.currentSpeed.toFixed(0)}
                        </div>
                        <div className="text-xs text-blue-700">km/h</div>
                      </div>

                      <div className="p-3 rounded-lg bg-green-50">
                        <div className="flex items-center justify-between">
                          <MapPin className="w-5 h-5 text-green-600" />
                          <span className="text-xs font-medium text-green-600">API GPS</span>
                        </div>
                        <div className="mt-1 text-sm font-bold text-green-900">
                          {trackingData.routePoints.length > 0 ? 'Active' : 'Ready'}
                        </div>
                        <div className="text-xs text-green-700">Location</div>
                      </div>
                    </div>
                  )}

                  {/* Journey Controls */}
                  <div className="space-y-3">
                    <h4 className="font-medium text-gray-900">API Journey Control</h4>
                    
                    {!isTracking ? (
                      <button
                        onClick={startApiTracking}
                        disabled={!hasApiData}
                        className={`w-full flex items-center justify-center gap-2 px-4 py-3 rounded-lg font-medium ${
                          hasApiData 
                            ? 'bg-green-600 text-white hover:bg-green-700' 
                            : 'bg-gray-300 text-gray-500 cursor-not-allowed'
                        }`}
                      >
                        <Database className="w-4 h-4" />
                        {hasApiData ? 'Start API Tracking' : 'No API Data'}
                      </button>
                    ) : (
                      <button
                        onClick={stopApiTracking}
                        className="flex items-center justify-center w-full gap-2 px-4 py-3 font-medium text-white bg-red-600 rounded-lg hover:bg-red-700"
                      >
                        <Square className="w-4 h-4" />
                        Stop API Tracking
                      </button>
                    )}
                  </div>

                  {/* API Journey Stats */}
                  {isTracking && (
                    <div className="p-3 bg-white border rounded-lg">
                      <h5 className="mb-3 font-medium text-gray-900">Active API Journey</h5>
                      <div className="space-y-2 text-sm">
                        <div className="flex justify-between">
                          <span className="text-gray-600">Started:</span>
                          <span className="font-medium">
                            {trackingData.startTime ? new Date(trackingData.startTime).toLocaleTimeString() : '-'}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-600">Duration:</span>
                          <span className="font-medium">{formatDuration(trackingData.duration)}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-600">Distance:</span>
                          <span className="font-medium">{trackingData.distance.toFixed(3)} km</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-600">Avg Speed:</span>
                          <span className="font-medium">{trackingData.avgSpeed.toFixed(0)} km/h</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-600">API Points:</span>
                          <span className="font-medium">{trackingData.routePoints.length}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-600">Device:</span>
                          <span className="font-medium">{trackingData.deviceId}</span>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {activeTab === 'route' && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h4 className="font-medium text-gray-900">API Route Visualization</h4>
                  </div>

                  {/* Map Controls */}
                  <div className="space-y-2">
                    <h5 className="font-medium text-gray-900">Map Controls</h5>
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        onClick={() => mapInstanceRef.current?.zoomIn()}
                        className="flex items-center justify-center gap-2 px-3 py-2 text-gray-700 bg-white border rounded hover:bg-gray-50"
                      >
                        Zoom In
                      </button>
                      <button
                        onClick={() => mapInstanceRef.current?.zoomOut()}
                        className="flex items-center justify-center gap-2 px-3 py-2 text-gray-700 bg-white border rounded hover:bg-gray-50"
                      >
                        Zoom Out
                      </button>
                    </div>
                  </div>

                  {/* API Route Stats */}
                  {trackingData.routePoints.length > 0 && (
                    <div className="p-3 bg-white border rounded-lg">
                      <h5 className="mb-2 font-medium text-gray-900">API Route Statistics</h5>
                      <div className="space-y-1 text-sm">
                        <div>API Points: {trackingData.routePoints.length}</div>
                        <div>Distance: {trackingData.distance.toFixed(3)} km</div>
                        <div>Duration: {formatDuration(trackingData.duration)}</div>
                        <div>Telemetry IDs: {trackingData.telemetryIds.length}</div>
                        {trackingData.routePoints.length > 0 && (
                          <div>Last Update: {new Date(trackingData.routePoints[trackingData.routePoints.length - 1]?.timestamp).toLocaleTimeString()}</div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Close Button in Route Tab */}
                  <div className="p-3 border rounded-lg bg-gray-50">
                    <button
                      onClick={handleClose}
                      className="flex items-center justify-center w-full gap-2 px-4 py-2 text-white bg-gray-600 rounded-lg hover:bg-gray-700"
                    >
                      <X className="w-4 h-4" />
                      Close Modal
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Map Container */}
          <div className="relative flex-1">
            <div ref={mapRef} className="w-full h-full">
              {/* Loading placeholder */}
              <div className="flex items-center justify-center w-full h-full bg-gray-100">
                <div className="text-center">
                  <Database className="w-16 h-16 mx-auto mb-4 text-gray-400" />
                  <h3 className="mb-2 text-lg font-medium text-gray-900">
                    API-Only Map Visualization
                  </h3>
                  <p className="text-gray-600">
                    {hasApiData 
                      ? 'Loading map with real API telemetry data'
                      : 'No API data available for this vehicle'
                    }
                  </p>
                  {hasApiData && (
                    <div className="mt-4">
                      <RefreshCw className="w-6 h-6 mx-auto text-blue-600 animate-spin" />
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Map overlay info */}
            {isTracking && (
              <div className="absolute p-3 bg-white border rounded-lg shadow-lg top-4 left-4">
                <div className="flex items-center gap-2 text-sm">
                  <Database className="w-4 h-4 text-blue-600" />
                  <span className="font-medium">API Tracking Active</span>
                </div>
                <div className="mt-1 text-xs text-gray-600">
                  Real-time API telemetry data visualization
                </div>
                <div className="mt-1 text-xs text-gray-500">
                  Device: {trackingData.deviceId}
                </div>
              </div>
            )}

            {/* Close button overlay (secondary) */}
            <div className="absolute top-4 right-4">
              <button
                onClick={handleClose}
                className="p-2 transition-colors bg-white border rounded-full shadow-lg hover:bg-gray-50"
                title="Close modal"
              >
                <X className="w-4 h-4 text-gray-600" />
              </button>
            </div>

            {/* API Data Source Info */}
            <div className="absolute max-w-sm p-3 border border-blue-200 rounded-lg bottom-4 left-4 bg-blue-50">
              <div className="flex items-start gap-2">
                <Database className="w-4 h-4 text-blue-600 mt-0.5" />
                <div>
                  <h4 className="text-sm font-medium text-blue-900">API Data Source</h4>
                  <div className="mt-1 space-y-1 text-xs text-blue-800">
                    <div>• Endpoint: GET /device/v1/data/{assignedDevice?.device_id || 'N/A'}</div>
                    <div>• Source: Real telemetry API</div>
                    <div>• No mock/simulated data</div>
                    <div>• Update interval: 15 seconds</div>
                  </div>
                </div>
              </div>
            </div>

            {/* Error overlay */}
            {!hasApiData && (
              <div className="absolute flex items-center justify-center border-2 border-red-200 rounded-lg inset-4 bg-red-50">
                <div className="p-4 text-center">
                  <AlertTriangle className="w-12 h-12 mx-auto mb-3 text-red-500" />
                  <h3 className="mb-2 text-lg font-medium text-red-900">No API Data Available</h3>
                  <div className="space-y-1 text-sm text-red-800">
                    {!assignedDevice && <div>• No device assigned to this vehicle</div>}
                    {assignedDevice && !assignedDevice.latitude && <div>• No coordinates in device data</div>}
                    {assignedDevice && !assignedDevice.longitude && <div>• Missing longitude data</div>}
                  </div>
                  <button
                    onClick={handleClose}
                    className="px-4 py-2 mt-4 text-white bg-red-600 rounded-lg hover:bg-red-700"
                  >
                    Close Modal
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default SafeApiOnlyEnhancedVehicleTrackingModal;