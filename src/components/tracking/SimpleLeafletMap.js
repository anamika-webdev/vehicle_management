// src/components/tracking/SimpleLeafletMap.js - FIXED VERSION WITH LIVE TELEMETRY
import React, { useState, useEffect, useRef } from 'react';
import { 
  Car, MapPin, RefreshCw, Maximize2, Minimize2,
  Plus, Minus, Wifi, WifiOff, AlertTriangle, Clock
} from 'lucide-react';
import { useData } from '../../contexts/DataContext';
import { useNotification } from '../../components/notifications/RealTimeNotificationSystem';
import apiService from '../../services/api';

const SimpleLeafletMap = ({ 
  selectedVehicleId = null, 
  deviceLocation = null,
  centerLocation = null,
  showSingleLocation = false,
  onVehicleSelect = () => {},
  className = "",
  height = "600px",
  autoRefresh = true,
  refreshInterval = 10000 // 10 seconds
}) => {
  const { data } = useData();
  const { showSuccess, showError } = useNotification();
  
  // Map state
  const [mapLoaded, setMapLoaded] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [lastUpdate, setLastUpdate] = useState(new Date());
  const [leafletLoaded, setLeafletLoaded] = useState(false);
  const [liveVehicleData, setLiveVehicleData] = useState([]);
  
  // Refs
  const mapRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const markersRef = useRef([]);
  const refreshIntervalRef = useRef(null);

  console.log('🗺️ SimpleLeafletMap - Props:', { selectedVehicleId, showSingleLocation, autoRefresh });

  // Load Leaflet library
  useEffect(() => {
    const loadLeaflet = async () => {
      if (window.L) {
        setLeafletLoaded(true);
        return;
      }

      try {
        console.log('📚 Loading Leaflet library...');
        
        // Load CSS
        if (!document.querySelector('link[href*="leaflet.css"]')) {
          const cssLink = document.createElement('link');
          cssLink.rel = 'stylesheet';
          cssLink.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
          document.head.appendChild(cssLink);
        }

        // Load JS
        const script = document.createElement('script');
        script.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';
        script.onload = () => {
          console.log('✅ Leaflet loaded successfully');
          setLeafletLoaded(true);
        };
        script.onerror = () => {
          console.error('❌ Failed to load Leaflet');
        };
        document.head.appendChild(script);
        
      } catch (error) {
        console.error('❌ Error loading Leaflet:', error);
      }
    };

    loadLeaflet();
  }, []);

  // Initialize map
  useEffect(() => {
    if (!leafletLoaded || !mapRef.current || mapInstanceRef.current) return;

    const initializeMap = () => {
      try {
        console.log('🗺️ Initializing SimpleLeafletMap...');
        
        // Default center or custom center
        const defaultCenter = centerLocation || [28.6139, 77.2090]; // Delhi, India
        
        const map = window.L.map(mapRef.current, {
          center: defaultCenter,
          zoom: 12,
          zoomControl: true
        });

        // Add OpenStreetMap tiles
        window.L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
          attribution: '© OpenStreetMap contributors',
          maxZoom: 19
        }).addTo(map);

        mapInstanceRef.current = map;
        setMapLoaded(true);
        setLastUpdate(new Date());
        
        console.log('✅ Map initialized successfully');
        
        // Load initial markers after map is ready
        setTimeout(() => {
          loadVehicleLocations();
        }, 500);

      } catch (error) {
        console.error('❌ Failed to initialize map:', error);
        setMapLoaded(false);
      }
    };

    initializeMap();
  }, [leafletLoaded, centerLocation]);

  // Auto-refresh effect
  useEffect(() => {
    if (autoRefresh && mapLoaded) {
      console.log('🔄 Setting up auto-refresh with interval:', refreshInterval);
      
      refreshIntervalRef.current = setInterval(() => {
        console.log('🔄 Auto-refresh triggered');
        loadVehicleLocations();
      }, refreshInterval);

      return () => {
        if (refreshIntervalRef.current) {
          clearInterval(refreshIntervalRef.current);
          refreshIntervalRef.current = null;
        }
      };
    }
  }, [autoRefresh, mapLoaded, refreshInterval]);

  // Load vehicle locations from telemetry API
  const loadVehicleLocations = async () => {
    if (!mapInstanceRef.current || refreshing) return;

    setRefreshing(true);
    console.log('📡 Loading vehicle locations from telemetry API...');

    try {
      const vehicleLocations = [];
      
      // Get vehicles to check
      const vehiclesToCheck = selectedVehicleId 
        ? data.vehicles.filter(v => v.vehicle_id === selectedVehicleId)
        : data.vehicles;

      console.log(`🚗 Checking ${vehiclesToCheck.length} vehicles for telemetry data`);

      // Process each vehicle
      for (const vehicle of vehiclesToCheck) {
        const device = data.devices.find(d => d.vehicle_id === vehicle.vehicle_id);
        if (!device || !device.device_id) {
          console.log(`⚠️ No device found for vehicle ${vehicle.vehicle_number}`);
          continue;
        }

        try {
          console.log(`📱 Getting telemetry for device ${device.device_id}...`);
          
          // Get latest telemetry from API
          const telemetryResponse = await apiService.getDeviceTelemetry(device.device_id, 0, 1);
          
          if (telemetryResponse.success && telemetryResponse.data && telemetryResponse.data.length > 0) {
            const latestTelemetry = telemetryResponse.data[0];
            
            console.log(`📊 Latest telemetry for ${device.device_id}:`, latestTelemetry);

            // Validate coordinates
            if (latestTelemetry.latitude && latestTelemetry.longitude) {
              const lat = parseFloat(latestTelemetry.latitude);
              const lng = parseFloat(latestTelemetry.longitude);
              
              // Validate coordinate ranges
              if (Math.abs(lat) <= 90 && Math.abs(lng) <= 180) {
                const vehicleLocation = {
                  vehicle_id: vehicle.vehicle_id,
                  vehicle_number: vehicle.vehicle_number || vehicle.vehicle_name,
                  vehicle_type: vehicle.vehicle_type,
                  device_id: device.device_id,
                  device_name: device.device_name,
                  latitude: lat,
                  longitude: lng,
                  speed: parseFloat(latestTelemetry.speed || 0),
                  heading: parseFloat(latestTelemetry.heading || 0),
                  acceleration: latestTelemetry.acceleration,
                  timestamp: latestTelemetry.timestamp,
                  telemetry_id: latestTelemetry.id || latestTelemetry.telemetry_id,
                  source: 'live_telemetry'
                };

                vehicleLocations.push(vehicleLocation);
                console.log(`✅ Added location for ${vehicle.vehicle_number}: ${lat.toFixed(6)}, ${lng.toFixed(6)}`);
              } else {
                console.warn(`⚠️ Invalid coordinates for ${vehicle.vehicle_number}: ${lat}, ${lng}`);
              }
            } else {
              console.warn(`⚠️ No coordinates in telemetry for device ${device.device_id}`);
            }
          } else {
            console.warn(`⚠️ No telemetry data for device ${device.device_id}`);
            
            // Fallback to device coordinates from context if available
            if (device.latitude && device.longitude) {
              const lat = parseFloat(device.latitude);
              const lng = parseFloat(device.longitude);
              
              if (Math.abs(lat) <= 90 && Math.abs(lng) <= 180) {
                const vehicleLocation = {
                  vehicle_id: vehicle.vehicle_id,
                  vehicle_number: vehicle.vehicle_number || vehicle.vehicle_name,
                  vehicle_type: vehicle.vehicle_type,
                  device_id: device.device_id,
                  device_name: device.device_name,
                  latitude: lat,
                  longitude: lng,
                  speed: parseFloat(device.speed || 0),
                  heading: 0,
                  timestamp: device.last_updated || new Date().toISOString(),
                  source: 'device_fallback'
                };

                vehicleLocations.push(vehicleLocation);
                console.log(`✅ Used fallback location for ${vehicle.vehicle_number}: ${lat.toFixed(6)}, ${lng.toFixed(6)}`);
              }
            }
          }
        } catch (deviceError) {
          console.error(`❌ Error getting telemetry for device ${device.device_id}:`, deviceError);
        }
      }

      console.log(`📍 Found ${vehicleLocations.length} vehicle locations`);
      setLiveVehicleData(vehicleLocations);
      updateMapMarkers(vehicleLocations);

    } catch (error) {
      console.error('❌ Error loading vehicle locations:', error);
      showError('Map Error', `Failed to load vehicle locations: ${error.message}`);
    } finally {
      setRefreshing(false);
      setLastUpdate(new Date());
    }
  };

  // Update map markers with live data
  const updateMapMarkers = (vehicleLocations) => {
    if (!mapInstanceRef.current || !window.L) return;

    try {
      console.log(`🔄 Updating ${vehicleLocations.length} markers on map...`);

      // Clear existing markers
      markersRef.current.forEach(marker => {
        try {
          mapInstanceRef.current.removeLayer(marker);
        } catch (e) {
          console.warn('Error removing marker:', e);
        }
      });
      markersRef.current = [];

      if (vehicleLocations.length === 0) {
        console.log('📍 No vehicle locations to display');
        return;
      }

      // Add markers for each vehicle
      vehicleLocations.forEach((location, index) => {
        try {
          const isSelected = selectedVehicleId && location.vehicle_id === selectedVehicleId;
          
          // Create circle marker (more reliable than custom icons)
          const markerColor = location.source === 'live_telemetry' ? '#10b981' : '#3b82f6'; // Green for live, blue for fallback
          const selectedColor = '#dc2626'; // Red for selected
          const finalColor = isSelected ? selectedColor : markerColor;
          
          const marker = window.L.circleMarker([location.latitude, location.longitude], {
            radius: isSelected ? 14 : 10,
            fillColor: finalColor,
            color: '#ffffff',
            weight: 3,
            opacity: 1,
            fillOpacity: 0.8
          });

          // Create detailed popup
          const sourceIcon = location.source === 'live_telemetry' ? '🟢' : '🔵';
          const popupContent = `
            <div style="min-width: 250px; font-family: system-ui;">
              <div style="text-align: center; margin-bottom: 10px;">
                <h3 style="margin: 0; color: #1f2937; font-size: 16px; font-weight: bold;">
                  🚗 ${location.vehicle_number}
                </h3>
                <p style="margin: 4px 0; color: #6b7280; font-size: 12px;">
                  ${location.vehicle_type || 'Vehicle'}
                </p>
              </div>
              
              <div style="background: #f3f4f6; padding: 8px; border-radius: 6px; margin: 8px 0;">
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px; font-size: 12px;">
                  <div>
                    <strong style="color: #374151;">Device:</strong><br>
                    <span style="color: #6b7280;">${location.device_id}</span>
                  </div>
                  <div>
                    <strong style="color: #374151;">Speed:</strong><br>
                    <span style="color: #059669; font-weight: bold;">${location.speed.toFixed(1)} km/h</span>
                  </div>
                  <div>
                    <strong style="color: #374151;">Heading:</strong><br>
                    <span style="color: #6b7280;">${location.heading.toFixed(0)}°</span>
                  </div>
                  <div>
                    <strong style="color: #374151;">Source:</strong><br>
                    <span style="color: ${location.source === 'live_telemetry' ? '#10b981' : '#3b82f6'};">
                      ${sourceIcon} ${location.source === 'live_telemetry' ? 'Live API' : 'Device Data'}
                    </span>
                  </div>
                </div>
              </div>
              
              <div style="font-size: 11px; color: #6b7280; text-align: center; margin-top: 8px;">
                <div><strong>Coordinates:</strong> ${location.latitude.toFixed(6)}, ${location.longitude.toFixed(6)}</div>
                <div><strong>Updated:</strong> ${location.timestamp ? 
                  new Date(location.timestamp).toLocaleString() : 
                  'Just now'
                }</div>
                ${location.telemetry_id ? `<div><strong>Telemetry ID:</strong> ${location.telemetry_id}</div>` : ''}
              </div>
            </div>
          `;

          marker.bindPopup(popupContent);
          
          // Add click handler
          marker.on('click', () => {
            console.log('📍 Vehicle marker clicked:', location);
            onVehicleSelect(location);
          });

          // Add to map and store reference
          marker.addTo(mapInstanceRef.current);
          markersRef.current.push(marker);

          console.log(`✅ Added marker for ${location.vehicle_number} at ${location.latitude}, ${location.longitude}`);

        } catch (markerError) {
          console.error(`❌ Error creating marker for ${location.vehicle_number}:`, markerError);
        }
      });

      // Auto-fit map bounds
      if (vehicleLocations.length > 0) {
        try {
          if (vehicleLocations.length === 1) {
            // Center on single vehicle
            const location = vehicleLocations[0];
            mapInstanceRef.current.setView([location.latitude, location.longitude], 15);
          } else {
            // Fit bounds to show all vehicles
            const group = new window.L.featureGroup(markersRef.current);
            mapInstanceRef.current.fitBounds(group.getBounds().pad(0.1));
          }
        } catch (boundsError) {
          console.warn('Could not auto-fit bounds:', boundsError);
        }
      }

      console.log(`✅ Successfully updated ${markersRef.current.length} markers`);

    } catch (error) {
      console.error('❌ Error updating markers:', error);
    }
  };

  // Handle device location (for single device display)
  useEffect(() => {
    if (showSingleLocation && deviceLocation && mapLoaded) {
      console.log('📍 Showing single device location:', deviceLocation);
      updateMapMarkers([{
        vehicle_id: 'single_device',
        vehicle_number: deviceLocation.device_name || deviceLocation.device_id,
        vehicle_type: 'Device',
        device_id: deviceLocation.device_id,
        device_name: deviceLocation.device_name,
        latitude: parseFloat(deviceLocation.latitude),
        longitude: parseFloat(deviceLocation.longitude),
        speed: parseFloat(deviceLocation.speed || 0),
        heading: parseFloat(deviceLocation.heading || 0),
        timestamp: deviceLocation.timestamp || new Date().toISOString(),
        source: 'single_device'
      }]);
    }
  }, [showSingleLocation, deviceLocation, mapLoaded]);

  // Manual refresh
  const handleRefresh = () => {
    console.log('🔄 Manual refresh triggered');
    loadVehicleLocations();
  };

  // Toggle fullscreen
  const toggleFullscreen = () => {
    setIsFullscreen(!isFullscreen);
    setTimeout(() => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.invalidateSize();
      }
    }, 300);
  };

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (refreshIntervalRef.current) {
        clearInterval(refreshIntervalRef.current);
      }
    };
  }, []);

  // Loading component
  const MapLoadingComponent = () => (
    <div className="flex items-center justify-center h-full bg-gray-100">
      <div className="text-center">
        <RefreshCw className="w-8 h-8 mx-auto mb-4 text-blue-600 animate-spin" />
        <p className="text-gray-600">
          {leafletLoaded ? 'Initializing map...' : 'Loading map library...'}
        </p>
      </div>
    </div>
  );

  // No data component
  const MapInfoComponent = () => (
    <div className="p-6">
      <div className="text-center">
        <AlertTriangle className="w-12 h-12 mx-auto mb-4 text-yellow-600" />
        <h3 className="mb-2 text-lg font-medium text-gray-900">No Location Data Available</h3>
        <p className="mb-4 text-gray-600">
          {showSingleLocation 
            ? 'The selected device does not have GPS coordinates available.'
            : 'No vehicles with GPS tracking data found.'
          }
        </p>
        <div className="text-sm text-gray-500">
          <p className="mb-2">To see locations on the map, ensure:</p>
          <ul className="max-w-md mx-auto space-y-1 text-left">
            <li>• Devices are connected and sending telemetry data</li>
            <li>• GPS tracking is enabled on devices</li>
            <li>• Devices are properly assigned to vehicles</li>
            <li>• Telemetry API endpoints are responding</li>
          </ul>
        </div>
        <button
          onClick={handleRefresh}
          className="px-4 py-2 mt-4 text-white bg-blue-600 rounded hover:bg-blue-700"
        >
          Try Again
        </button>
      </div>
    </div>
  );

  const containerClasses = `
    ${className}
    ${isFullscreen ? 'fixed inset-0 z-50 bg-white p-4' : 'relative'}
  `;

  const hasLocationData = showSingleLocation ? deviceLocation : liveVehicleData.length > 0;

  return (
    <div className={containerClasses}>
      {/* Map Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <MapPin className="w-5 h-5 text-blue-600" />
          <div>
            <h2 className="text-lg font-semibold text-gray-900">
              {showSingleLocation ? 'Device Location' : 'Live Vehicle Tracking'}
            </h2>
            <p className="text-sm text-gray-600">
              {showSingleLocation 
                ? (deviceLocation ? `Showing ${deviceLocation.device_name || deviceLocation.device_id}` : 'No location data')
                : `${liveVehicleData.length} vehicle${liveVehicleData.length !== 1 ? 's' : ''} with GPS data`
              }
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Connection Status */}
          <div className="flex items-center gap-2 px-3 py-1 bg-gray-100 rounded-full">
            {mapLoaded && leafletLoaded ? 
              <Wifi className="w-4 h-4 text-green-600" /> : 
              <WifiOff className="w-4 h-4 text-red-600" />
            }
            <span className="text-sm">{mapLoaded ? 'Connected' : 'Loading...'}</span>
          </div>

          {/* Live indicator */}
          {autoRefresh && mapLoaded && (
            <div className="flex items-center gap-2 px-3 py-1 bg-green-100 rounded-full">
              <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
              <span className="text-sm text-green-800">Live</span>
            </div>
          )}

          {/* Manual refresh */}
          <button
            onClick={handleRefresh}
            disabled={refreshing}
            className="p-2 text-blue-600 border border-blue-300 rounded hover:bg-blue-50 disabled:opacity-50"
            title="Refresh"
          >
            <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
          </button>

          {/* Fullscreen toggle */}
          <button
            onClick={toggleFullscreen}
            className="p-2 text-gray-600 border border-gray-300 rounded hover:bg-gray-50"
            title={isFullscreen ? 'Exit Fullscreen' : 'Fullscreen'}
          >
            {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {/* Map Container */}
      <div 
        className="relative overflow-hidden border border-gray-200 rounded-lg"
        style={{ height }}
      >
        {/* Map */}
        {leafletLoaded ? (
          <div ref={mapRef} className="w-full h-full" />
        ) : (
          <MapLoadingComponent />
        )}

        {/* No data overlay */}
        {mapLoaded && !hasLocationData && !refreshing && (
          <div className="absolute inset-0 bg-white bg-opacity-95">
            <MapInfoComponent />
          </div>
        )}

        {/* Loading overlay */}
        {refreshing && (
          <div className="absolute flex items-center gap-2 px-3 py-2 bg-white rounded shadow top-4 left-4 bg-opacity-90">
            <RefreshCw className="w-4 h-4 text-blue-600 animate-spin" />
            <span className="text-sm text-blue-900">Updating locations...</span>
          </div>
        )}

        {/* Last update indicator */}
        {lastUpdate && mapLoaded && (
          <div className="absolute px-3 py-1 text-xs text-gray-600 bg-white rounded shadow bottom-4 right-4 bg-opacity-90">
            <div className="flex items-center gap-1">
              <Clock className="w-3 h-3" />
              <span>Updated: {lastUpdate.toLocaleTimeString()}</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default SimpleLeafletMap;