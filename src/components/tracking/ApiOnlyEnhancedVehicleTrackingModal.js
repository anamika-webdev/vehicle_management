// src/components/tracking/ApiOnlyEnhancedVehicleTrackingModal.js - Fixed with Working Map
import React, { useState, useEffect, useRef } from 'react';
import { 
  X, Car, MapPin, Play, Square, Download, 
  Clock, Gauge, Navigation, AlertTriangle, 
  RefreshCw, Database, Maximize2, ZoomIn, ZoomOut 
} from 'lucide-react';
import { useData } from '../../contexts/DataContext';
import { useNotification } from '../../contexts/NotificationContext';
import apiService from '../../services/api';

const ApiOnlyEnhancedVehicleTrackingModal = ({ isOpen, onClose, vehicle }) => {
  const { data } = useData();
  const { showSuccess, showError } = useNotification();
  
  // Modal and tracking state
  const [activeTab, setActiveTab] = useState('live');
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

  // Map state
  const [mapLoaded, setMapLoaded] = useState(false);
  const [leafletLoaded, setLeafletLoaded] = useState(false);
  const mapRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const liveMarkerRef = useRef(null);
  const routePolylineRef = useRef(null);
  const markersRef = useRef([]);

  // Get assigned device for this vehicle
  const assignedDevice = data.devices.find(d => d.vehicle_id === vehicle?.vehicle_id);
  const hasApiData = assignedDevice && assignedDevice.latitude && assignedDevice.longitude;

  // Format duration helper
  const formatDuration = (ms) => {
    const minutes = Math.floor(ms / 60000);
    const seconds = Math.floor((ms % 60000) / 1000);
    return `${minutes}m ${seconds}s`;
  };

  // Calculate distance between two points
  const calculateDistance = (lat1, lon1, lat2, lon2) => {
    const R = 6371; // Earth's radius in km
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
              Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
              Math.sin(dLon/2) * Math.sin(dLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c;
  };

  // Load Leaflet library
  useEffect(() => {
    if (!isOpen) return;

    const loadLeaflet = async () => {
      if (window.L) {
        setLeafletLoaded(true);
        return;
      }

      try {
        console.log('📦 Loading Leaflet library...');
        
        // Load CSS
        const cssLink = document.createElement('link');
        cssLink.rel = 'stylesheet';
        cssLink.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
        cssLink.integrity = 'sha256-p4NxAoJBhIIN+hmNHrzRCf9tD/miZyoHS5obTRR9BMY=';
        cssLink.crossOrigin = '';
        document.head.appendChild(cssLink);

        // Load JS
        await new Promise((resolve, reject) => {
          const script = document.createElement('script');
          script.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';
          script.integrity = 'sha256-20nQCchB9co0qIjJZRGuk2/Z9VM+kNiyxNV1lvTlZBo=';
          script.crossOrigin = '';
          script.onload = () => {
            console.log('✅ Leaflet JS loaded');
            
            // Fix default markers
            if (window.L && window.L.Icon && window.L.Icon.Default) {
              window.L.Icon.Default.mergeOptions({
                iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
                iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
                shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
              });
            }
            
            setLeafletLoaded(true);
            resolve();
          };
          script.onerror = () => {
            console.error('❌ Failed to load Leaflet');
            reject(new Error('Failed to load Leaflet'));
          };
          document.head.appendChild(script);
        });
        
        console.log('✅ Leaflet loaded successfully');
      } catch (error) {
        console.error('❌ Error loading Leaflet:', error);
        showError('Map Loading Failed', 'Could not load map library');
      }
    };

    loadLeaflet();
  }, [isOpen, showError]);

  // Initialize map
  useEffect(() => {
    if (!isOpen || !mapRef.current || mapInstanceRef.current || !leafletLoaded || !hasApiData) return;

    try {
      console.log('🗺️ Initializing map...');
      
      const map = window.L.map(mapRef.current, {
        center: [parseFloat(assignedDevice.latitude), parseFloat(assignedDevice.longitude)],
        zoom: 15,
        zoomControl: false
      });

      // Add OpenStreetMap tiles
      window.L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
        maxZoom: 19
      }).addTo(map);

      mapInstanceRef.current = map;
      setMapLoaded(true);

      // Add initial vehicle marker
      if (assignedDevice.latitude && assignedDevice.longitude) {
        const marker = window.L.marker([
          parseFloat(assignedDevice.latitude), 
          parseFloat(assignedDevice.longitude)
        ]).addTo(map);
        
        marker.bindPopup(`
          <div style="text-align: center;">
            <strong>${vehicle.vehicle_number || vehicle.vehicle_name}</strong><br>
            <small>Device: ${assignedDevice.device_id}</small><br>
            <small>Speed: ${assignedDevice.speed || 0} km/h</small><br>
            <small>Status: Ready for tracking</small>
          </div>
        `);
        
        liveMarkerRef.current = marker;
        markersRef.current.push(marker);
      }

      console.log('✅ Map initialized successfully');
    } catch (error) {
      console.error('❌ Error initializing map:', error);
      showError('Map Initialization Failed', error.message);
    }
  }, [isOpen, leafletLoaded, hasApiData, vehicle, assignedDevice, showError]);

  // Get API telemetry data
  const getApiTelemetryData = async () => {
    if (!assignedDevice) {
      throw new Error('No device assigned to vehicle');
    }

    const deviceId = assignedDevice.device_id;
    console.log(`📡 Fetching telemetry for device ${deviceId}...`);

    try {
      const response = await apiService.getDeviceTelemetry(deviceId, 0, 5);
      
      if (!response.success || !response.data || response.data.length === 0) {
        throw new Error('No telemetry data available');
      }

      const latestTelemetry = response.data[0];
      console.log(`✅ Latest telemetry:`, latestTelemetry);

      if (!latestTelemetry.latitude || !latestTelemetry.longitude) {
        throw new Error('Invalid coordinates in telemetry data');
      }

      return {
        latitude: parseFloat(latestTelemetry.latitude),
        longitude: parseFloat(latestTelemetry.longitude),
        speed: parseFloat(latestTelemetry.speed || 0),
        heading: parseFloat(latestTelemetry.heading || 0),
        timestamp: latestTelemetry.timestamp || new Date().toISOString(),
        telemetry_id: latestTelemetry.id || 'api_data',
        device_id: deviceId,
        source: 'api_telemetry'
      };
    } catch (error) {
      console.error(`❌ Error getting telemetry:`, error);
      
      // Fallback to device coordinates
      if (assignedDevice.latitude && assignedDevice.longitude) {
        console.log(`🔄 Using device coordinates as fallback...`);
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

  // Start API tracking
  const startApiTracking = async () => {
    if (!hasApiData) {
      showError('Cannot Start Tracking', 'No GPS data available for this vehicle');
      return;
    }

    try {
      console.log('🚀 Starting API tracking...');
      
      const initialData = await getApiTelemetryData();
      
      setIsTracking(true);
      setTrackingData({
        startTime: new Date().toISOString(),
        duration: 0,
        distance: 0,
        avgSpeed: initialData.speed,
        currentSpeed: initialData.speed,
        routePoints: [initialData],
        telemetryIds: [initialData.telemetry_id],
        deviceId: initialData.device_id
      });

      // Update map center to initial position
      if (mapInstanceRef.current) {
        mapInstanceRef.current.setView([initialData.latitude, initialData.longitude], 16);
        
        // Update marker position
        if (liveMarkerRef.current) {
          liveMarkerRef.current.setLatLng([initialData.latitude, initialData.longitude]);
          liveMarkerRef.current.setPopupContent(`
            <div style="text-align: center;">
              <strong>🔴 LIVE TRACKING</strong><br>
              <strong>${vehicle.vehicle_number}</strong><br>
              <small>Speed: ${initialData.speed.toFixed(1)} km/h</small><br>
              <small>Source: ${initialData.source}</small>
            </div>
          `);
        }
      }

      showSuccess('Tracking Started', 'API-based route tracking is now active');
      console.log('✅ API tracking started successfully');
      
    } catch (error) {
      console.error('❌ Failed to start tracking:', error);
      showError('Tracking Failed', error.message);
    }
  };

  // Stop API tracking
  const stopApiTracking = () => {
    console.log('🛑 Stopping API tracking...');
    setIsTracking(false);
    
    if (trackingData.routePoints.length > 0) {
      showSuccess('Tracking Stopped', `Route saved with ${trackingData.routePoints.length} points`);
    }
  };

  // Cleanup on close
  const handleClose = () => {
    console.log('🔄 Closing modal and cleaning up...');
    
    // Stop tracking
    if (isTracking) {
      stopApiTracking();
    }
    
    // Clean up map
    if (mapInstanceRef.current) {
      try {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
        setMapLoaded(false);
      } catch (error) {
        console.warn('Error cleaning up map:', error);
      }
    }
    
    // Reset state
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
    
    if (onClose) {
      onClose();
    }
  };

  // Map control functions
  const handleZoomIn = () => {
    if (mapInstanceRef.current) {
      mapInstanceRef.current.zoomIn();
    }
  };

  const handleZoomOut = () => {
    if (mapInstanceRef.current) {
      mapInstanceRef.current.zoomOut();
    }
  };

  const handleCenterMap = () => {
    if (mapInstanceRef.current && hasApiData) {
      mapInstanceRef.current.setView([
        parseFloat(assignedDevice.latitude), 
        parseFloat(assignedDevice.longitude)
      ], 15);
    }
  };

  if (!isOpen || !vehicle) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
      <div className="w-full max-w-6xl max-h-[90vh] bg-white rounded-lg shadow-xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b">
          <div className="flex items-center space-x-3">
            <Car className="w-6 h-6 text-blue-600" />
            <div>
              <h2 className="text-xl font-bold text-gray-900">
                Enhanced Route Tracking - {vehicle.vehicle_number || vehicle.vehicle_name}
              </h2>
              <p className="text-sm text-gray-600">
                Real-time API-based vehicle tracking with OpenStreetMap
              </p>
            </div>
          </div>
          <button
            onClick={handleClose}
            className="p-2 text-gray-400 rounded-full hover:text-gray-600 hover:bg-gray-100"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Content */}
        <div className="flex h-[600px]">
          {/* Map Section */}
          <div className="relative flex-1">
            {/* Map Container */}
            <div className="relative w-full h-full">
              {leafletLoaded ? (
                <div ref={mapRef} className="w-full h-full" />
              ) : (
                <div className="flex items-center justify-center w-full h-full bg-gray-100">
                  <div className="text-center">
                    <MapPin className="w-12 h-12 mx-auto mb-4 text-gray-400" />
                    <p className="text-gray-600">Loading map...</p>
                  </div>
                </div>
              )}
              
              {/* Map Controls */}
              <div className="absolute flex flex-col space-y-2 top-4 right-4">
                <button
                  onClick={handleZoomIn}
                  className="p-2 bg-white border border-gray-300 rounded shadow hover:bg-gray-50"
                  title="Zoom In"
                >
                  <ZoomIn className="w-4 h-4" />
                </button>
                <button
                  onClick={handleZoomOut}
                  className="p-2 bg-white border border-gray-300 rounded shadow hover:bg-gray-50"
                  title="Zoom Out"
                >
                  <ZoomOut className="w-4 h-4" />
                </button>
                <button
                  onClick={handleCenterMap}
                  className="p-2 bg-white border border-gray-300 rounded shadow hover:bg-gray-50"
                  title="Center on Vehicle"
                >
                  <Navigation className="w-4 h-4" />
                </button>
              </div>

              {/* Map Status */}
              <div className="absolute px-3 py-2 bg-white rounded shadow bottom-4 left-4">
                <div className="flex items-center space-x-2 text-sm">
                  <div className={`w-2 h-2 rounded-full ${mapLoaded ? 'bg-green-500' : 'bg-orange-500'}`}></div>
                  <span>{mapLoaded ? 'Map Ready' : 'Loading...'}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Control Panel */}
          <div className="p-6 overflow-y-auto border-l w-80 bg-gray-50">
            {/* Vehicle Info */}
            <div className="mb-6">
              <h3 className="mb-3 font-semibold text-gray-900">Vehicle Information</h3>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-600">Vehicle:</span>
                  <span className="font-medium">{vehicle.vehicle_number}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Type:</span>
                  <span className="font-medium">{vehicle.vehicle_type || 'N/A'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Device:</span>
                  <span className="font-medium">{assignedDevice?.device_id || 'None'}</span>
                </div>
              </div>
            </div>

            {/* API Data Status */}
            <div className={`p-4 rounded-lg border mb-6 ${
              hasApiData ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'
            }`}>
              <h4 className={`font-medium mb-2 ${hasApiData ? 'text-green-900' : 'text-red-900'}`}>
                API Data Status
              </h4>
              <div className={`text-sm ${hasApiData ? 'text-green-800' : 'text-red-800'}`}>
                {hasApiData ? (
                  <div className="space-y-1">
                    <div>✅ Device: {assignedDevice.device_id}</div>
                    <div>✅ GPS: {assignedDevice.latitude}, {assignedDevice.longitude}</div>
                    <div>✅ Speed: {assignedDevice.speed || 0} km/h</div>
                  </div>
                ) : (
                  <div>❌ No GPS data available for tracking</div>
                )}
              </div>
            </div>

            {/* Tracking Controls */}
            <div className="mb-6">
              <h4 className="mb-3 font-medium text-gray-900">Tracking Controls</h4>
              
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
                  <Play className="w-4 h-4" />
                  {hasApiData ? 'Start API Tracking' : 'No GPS Data'}
                </button>
              ) : (
                <button
                  onClick={stopApiTracking}
                  className="flex items-center justify-center w-full gap-2 px-4 py-3 font-medium text-white bg-red-600 rounded-lg hover:bg-red-700"
                >
                  <Square className="w-4 h-4" />
                  Stop Tracking
                </button>
              )}
            </div>

            {/* Live Stats */}
            {isTracking && (
              <div className="space-y-4">
                <h4 className="font-medium text-gray-900">Live Statistics</h4>
                
                <div className="grid grid-cols-2 gap-3">
                  <div className="p-3 rounded-lg bg-blue-50">
                    <div className="flex items-center justify-between">
                      <Gauge className="w-4 h-4 text-blue-600" />
                      <span className="text-xs font-medium text-blue-600">SPEED</span>
                    </div>
                    <div className="text-2xl font-bold text-blue-900">
                      {trackingData.currentSpeed.toFixed(0)}
                    </div>
                    <div className="text-xs text-blue-700">km/h</div>
                  </div>

                  <div className="p-3 rounded-lg bg-green-50">
                    <div className="flex items-center justify-between">
                      <MapPin className="w-4 h-4 text-green-600" />
                      <span className="text-xs font-medium text-green-600">POINTS</span>
                    </div>
                    <div className="text-2xl font-bold text-green-900">
                      {trackingData.routePoints.length}
                    </div>
                    <div className="text-xs text-green-700">recorded</div>
                  </div>
                </div>

                <div className="p-3 bg-white border rounded-lg">
                  <div className="space-y-2 text-sm">
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
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default ApiOnlyEnhancedVehicleTrackingModal;