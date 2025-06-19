import React, { useState, useEffect, useRef } from 'react';
import { 
  Car, MapPin, RefreshCw, Maximize2, Minimize2,
  Plus, Minus, Wifi, WifiOff, AlertTriangle, Clock
} from 'lucide-react';
import { useData } from '../../contexts/DataContext';

const SimpleLeafletMap = ({ 
  selectedVehicleId = null, 
  onVehicleSelect = () => {},
  className = "",
  height = "600px"
}) => {
  const { data } = useData();
  
  // Map state
  const [mapLoaded, setMapLoaded] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [lastUpdate, setLastUpdate] = useState(new Date());
  const [leafletLoaded, setLeafletLoaded] = useState(false);
  
  // Refs
  const mapRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const markersRef = useRef([]);

  // Get vehicles with real GPS coordinates from your telemetry data
  const vehiclesWithLocation = data.vehicles
    .map(vehicle => {
      const device = data.devices.find(d => d.vehicle_id === vehicle.vehicle_id);
      
      if (device && device.latitude && device.longitude) {
        return {
          ...vehicle,
          current_latitude: device.latitude,
          current_longitude: device.longitude,
          current_speed: device.acceleration ? Math.abs(device.acceleration * 3.6) : 0,
          device_status: device.status,
          last_updated: device.last_updated,
          drowsiness: device.drowsiness,
          rash_driving: device.rash_driving,
          collision: device.collision,
          device_id: device.device_id
        };
      }
      return null;
    })
    .filter(Boolean);

  // Load Leaflet safely
  useEffect(() => {
    const loadLeaflet = async () => {
      // Check if already loaded
      if (window.L && window.L.map) {
        setLeafletLoaded(true);
        return;
      }

      try {
        // Load CSS first
        if (!document.querySelector('link[href*="leaflet.css"]')) {
          const cssLink = document.createElement('link');
          cssLink.rel = 'stylesheet';
          cssLink.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
          document.head.appendChild(cssLink);
          
          // Wait for CSS to load
          await new Promise(resolve => {
            cssLink.onload = resolve;
            cssLink.onerror = resolve; // Continue even if CSS fails
          });
        }

        // Load JS
        if (!window.L) {
          await new Promise((resolve, reject) => {
            const script = document.createElement('script');
            script.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';
            script.onload = () => {
              // Fix default markers issue
              if (window.L && window.L.Icon && window.L.Icon.Default) {
                delete window.L.Icon.Default.prototype._getIconUrl;
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
        }

        setLeafletLoaded(true);
        console.log('✅ Leaflet loaded successfully');
      } catch (error) {
        console.error('❌ Failed to load Leaflet:', error);
        setLeafletLoaded(false);
      }
    };

    loadLeaflet();
  }, []);

  // Initialize map when Leaflet is loaded
  useEffect(() => {
    if (leafletLoaded && mapRef.current && !mapInstanceRef.current) {
      initializeMap();
    }
  }, [leafletLoaded, vehiclesWithLocation]);

  const initializeMap = () => {
    if (!window.L || !mapRef.current || mapInstanceRef.current) return;

    try {
      // Create map
      const map = window.L.map(mapRef.current, {
        center: [28.6139, 77.2090], // Delhi
        zoom: 12,
        zoomControl: false
      });

      // Add OpenStreetMap tiles
      window.L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap contributors',
        maxZoom: 19
      }).addTo(map);

      mapInstanceRef.current = map;

      // Add vehicle markers
      addVehicleMarkers(map);

      setMapLoaded(true);
      setLastUpdate(new Date());
      console.log('✅ Map initialized with', vehiclesWithLocation.length, 'vehicles');

    } catch (error) {
      console.error('❌ Failed to initialize map:', error);
      setMapLoaded(false);
    }
  };

  const addVehicleMarkers = (map) => {
    // Clear existing markers
    markersRef.current.forEach(marker => {
      try {
        marker.remove();
      } catch (e) {
        console.warn('Error removing marker:', e);
      }
    });
    markersRef.current = [];

    // Add new markers
    vehiclesWithLocation.forEach(vehicle => {
      try {
        // Determine marker color
        let markerColor = '#3B82F6'; // Blue
        if (vehicle.collision) markerColor = '#EF4444'; // Red
        else if (vehicle.rash_driving) markerColor = '#F59E0B'; // Orange
        else if (vehicle.drowsiness) markerColor = '#EAB308'; // Yellow
        else if (selectedVehicleId === vehicle.vehicle_id) markerColor = '#8B5CF6'; // Purple

        // Create custom HTML marker
        const markerHtml = `
          <div style="
            width: 30px; 
            height: 30px; 
            background-color: ${markerColor}; 
            border: 3px solid white; 
            border-radius: 50%; 
            display: flex; 
            align-items: center; 
            justify-content: center;
            box-shadow: 0 2px 8px rgba(0,0,0,0.3);
            font-size: 14px;
            color: white;
            cursor: pointer;
          ">🚗</div>
        `;

        const customIcon = window.L.divIcon({
          html: markerHtml,
          className: 'custom-vehicle-marker',
          iconSize: [30, 30],
          iconAnchor: [15, 15]
        });

        const marker = window.L.marker([vehicle.current_latitude, vehicle.current_longitude], {
          icon: customIcon
        }).addTo(map);

        // Add popup
        const popupContent = `
          <div style="min-width: 200px; font-family: system-ui;">
            <h3 style="margin: 0 0 8px 0; color: #1f2937;">${vehicle.vehicle_number}</h3>
            <p style="margin: 4px 0; color: #6b7280; font-size: 14px;"><strong>Vehicle:</strong> ${vehicle.manufacturer} ${vehicle.model}</p>
            <p style="margin: 4px 0; color: #6b7280; font-size: 14px;"><strong>Speed:</strong> ${vehicle.current_speed.toFixed(1)} km/h</p>
            <p style="margin: 4px 0; color: #6b7280; font-size: 14px;"><strong>Device:</strong> ${vehicle.device_id}</p>
            <p style="margin: 4px 0; color: #6b7280; font-size: 14px;"><strong>Updated:</strong> ${new Date(vehicle.last_updated || Date.now()).toLocaleString()}</p>
            ${vehicle.collision || vehicle.rash_driving || vehicle.drowsiness ? `
              <div style="margin-top: 8px; padding-top: 8px; border-top: 1px solid #e5e7eb;">
                ${vehicle.collision ? '<span style="display: inline-block; padding: 2px 6px; background: #fee; color: #991b1b; border-radius: 4px; font-size: 11px; margin-right: 4px;">🚨 Collision</span>' : ''}
                ${vehicle.rash_driving ? '<span style="display: inline-block; padding: 2px 6px; background: #fef3c7; color: #92400e; border-radius: 4px; font-size: 11px; margin-right: 4px;">⚠️ Rash Driving</span>' : ''}
                ${vehicle.drowsiness ? '<span style="display: inline-block; padding: 2px 6px; background: #fef3c7; color: #92400e; border-radius: 4px; font-size: 11px;">😴 Drowsiness</span>' : ''}
              </div>
            ` : ''}
          </div>
        `;

        marker.bindPopup(popupContent);

        // Add click handler
        marker.on('click', () => {
          onVehicleSelect(vehicle);
        });

        markersRef.current.push(marker);
      } catch (error) {
        console.warn('Error adding marker for vehicle:', vehicle.vehicle_id, error);
      }
    });

    // Fit bounds if multiple vehicles
    if (vehiclesWithLocation.length > 1 && markersRef.current.length > 0) {
      try {
        const group = new window.L.featureGroup(markersRef.current);
        map.fitBounds(group.getBounds().pad(0.1));
      } catch (error) {
        console.warn('Error fitting bounds:', error);
      }
    } else if (vehiclesWithLocation.length === 1) {
      map.setView([vehiclesWithLocation[0].current_latitude, vehiclesWithLocation[0].current_longitude], 15);
    }
  };

  // Update markers when data changes
  useEffect(() => {
    if (mapInstanceRef.current && leafletLoaded) {
      addVehicleMarkers(mapInstanceRef.current);
    }
  }, [vehiclesWithLocation, selectedVehicleId, leafletLoaded]);

  const handleRefresh = () => {
    setRefreshing(true);
    if (mapInstanceRef.current) {
      addVehicleMarkers(mapInstanceRef.current);
    }
    setTimeout(() => setRefreshing(false), 1000);
  };

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

  const toggleFullscreen = () => {
    setIsFullscreen(!isFullscreen);
  };

  // Fallback when Leaflet is not available
  const FallbackMap = () => (
    <div className="relative flex items-center justify-center w-full h-full overflow-hidden rounded-lg bg-gradient-to-br from-blue-50 to-green-50">
      <div className="text-center">
        <MapPin className="w-12 h-12 mx-auto mb-4 text-gray-400" />
        <h3 className="mb-2 text-lg font-medium text-gray-600">Map Loading...</h3>
        <p className="text-gray-500">Loading OpenStreetMap with Leaflet</p>
        {vehiclesWithLocation.length > 0 && (
          <p className="mt-2 text-sm text-gray-400">
            {vehiclesWithLocation.length} vehicle{vehiclesWithLocation.length !== 1 ? 's' : ''} ready to display
          </p>
        )}
      </div>
    </div>
  );

  const containerClasses = `
    ${className}
    ${isFullscreen ? 'fixed inset-0 z-50 bg-white p-4' : 'relative'}
  `;

  return (
    <div className={containerClasses}>
      {/* Map Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <MapPin className="w-5 h-5 text-blue-600" />
          <div>
            <h2 className="text-lg font-semibold text-gray-900">Live Vehicle Tracking</h2>
            <p className="text-sm text-gray-600">
              {vehiclesWithLocation.length} vehicle{vehiclesWithLocation.length !== 1 ? 's' : ''} with GPS data
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Connection Status */}
          <div className="flex items-center gap-2 px-3 py-1 bg-gray-100 rounded-full">
            {mapLoaded && leafletLoaded ? (
              <>
                <Wifi className="w-4 h-4 text-green-600" />
                <span className="text-xs text-green-600">Connected</span>
              </>
            ) : (
              <>
                <WifiOff className="w-4 h-4 text-orange-600" />
                <span className="text-xs text-orange-600">Loading...</span>
              </>
            )}
          </div>

          {/* Refresh Button */}
          <button
            onClick={handleRefresh}
            disabled={refreshing || !mapLoaded}
            className="p-2 transition-colors rounded-full hover:bg-gray-100"
            title="Refresh Map"
          >
            <RefreshCw className={`w-4 h-4 text-gray-600 ${refreshing ? 'animate-spin' : ''}`} />
          </button>

          {/* Fullscreen Toggle */}
          <button
            onClick={toggleFullscreen}
            className="p-2 transition-colors rounded-full hover:bg-gray-100"
            title={isFullscreen ? "Exit Fullscreen" : "Enter Fullscreen"}
          >
            {isFullscreen ? (
              <Minimize2 className="w-4 h-4 text-gray-600" />
            ) : (
              <Maximize2 className="w-4 h-4 text-gray-600" />
            )}
          </button>
        </div>
      </div>

      {/* Map Container */}
      <div className="relative">
        <div 
          className="w-full overflow-hidden border border-gray-200 rounded-lg shadow-sm"
          style={{ height: isFullscreen ? 'calc(100vh - 120px)' : height }}
        >
          {leafletLoaded ? (
            <div ref={mapRef} className="w-full h-full" />
          ) : (
            <FallbackMap />
          )}
        </div>

        {/* Map Controls Overlay */}
        {mapLoaded && (
          <div className="absolute top-4 right-4 flex flex-col gap-2 z-[1000]">
            {/* Zoom Controls */}
            <div className="overflow-hidden bg-white border rounded-lg shadow">
              <button
                onClick={handleZoomIn}
                className="block w-10 h-10 text-center transition-colors border-b border-gray-200 hover:bg-gray-50"
                title="Zoom In"
              >
                <Plus className="w-4 h-4 mx-auto" />
              </button>
              <button
                onClick={handleZoomOut}
                className="block w-10 h-10 text-center transition-colors hover:bg-gray-50"
                title="Zoom Out"
              >
                <Minus className="w-4 h-4 mx-auto" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Map Legend & Stats */}
      <div className="grid grid-cols-1 gap-4 mt-4 md:grid-cols-2">
        {/* Legend */}
        <div className="p-4 rounded-lg bg-gray-50">
          <h4 className="mb-3 text-sm font-medium text-gray-900">Vehicle Status Legend</h4>
          <div className="grid grid-cols-2 gap-3 text-xs">
            <div className="flex items-center gap-2">
              <div className="flex items-center justify-center w-4 h-4 text-xs text-white bg-blue-500 rounded-full">🚗</div>
              <span>Normal</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="flex items-center justify-center w-4 h-4 text-xs text-white bg-yellow-500 rounded-full">🚗</div>
              <span>Drowsiness</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="flex items-center justify-center w-4 h-4 text-xs text-white bg-orange-500 rounded-full">🚗</div>
              <span>Rash Driving</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="flex items-center justify-center w-4 h-4 text-xs text-white bg-red-500 rounded-full">🚗</div>
              <span>Collision Alert</span>
            </div>
          </div>
        </div>

        {/* Stats */}
        <div className="p-4 rounded-lg bg-gray-50">
          <h4 className="mb-3 text-sm font-medium text-gray-900">Map Statistics</h4>
          <div className="space-y-2 text-xs text-gray-600">
            <div className="flex justify-between">
              <span>Map Provider:</span>
              <span className="font-medium">OpenStreetMap</span>
            </div>
            <div className="flex justify-between">
              <span>Total Vehicles:</span>
              <span className="font-medium">{data.vehicles.length}</span>
            </div>
            <div className="flex justify-between">
              <span>With GPS Data:</span>
              <span className="font-medium text-green-600">{vehiclesWithLocation.length}</span>
            </div>
            <div className="flex justify-between">
              <span>Active Alerts:</span>
              <span className="font-medium text-red-600">
                {vehiclesWithLocation.filter(v => v.collision || v.rash_driving || v.drowsiness).length}
              </span>
            </div>
            {lastUpdate && (
              <div className="flex justify-between pt-2 border-t border-gray-200">
                <span className="flex items-center gap-1">
                  <Clock className="w-3 h-3" />
                  Last Updated:
                </span>
                <span className="font-medium">{lastUpdate.toLocaleTimeString()}</span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* No GPS Data Message */}
      {vehiclesWithLocation.length === 0 && leafletLoaded && (
        <div className="p-6 mt-4 text-center border border-yellow-200 rounded-lg bg-yellow-50">
          <AlertTriangle className="w-8 h-8 mx-auto mb-3 text-yellow-600" />
          <h3 className="mb-2 text-lg font-medium text-yellow-900">No GPS Data Available</h3>
          <p className="mb-4 text-yellow-800">
            No vehicles are currently transmitting GPS coordinates.
          </p>
          <ul className="max-w-md mx-auto space-y-1 text-sm text-yellow-800">
            <li>• Check that devices are connected and sending telemetry</li>
            <li>• Verify devices are assigned to vehicles</li>
            <li>• Ensure GPS tracking is enabled on devices</li>
          </ul>
        </div>
      )}
    </div>
  );
};

export default SimpleLeafletMap;