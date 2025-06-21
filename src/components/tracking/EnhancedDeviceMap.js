// File: src/components/tracking/EnhancedDeviceMap.js
// Enhanced Device Map Component with Real-time Vehicle Location Display

import React, { useEffect, useRef, useState } from 'react';
import { MapPin, Navigation, ZoomIn, ZoomOut, RefreshCw } from 'lucide-react';

const EnhancedDeviceMap = ({
  device,
  vehicle,
  center,
  zoom = 15,
  enableTracking = false,
  height = '500px'
}) => {
  const mapRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const currentMarkerRef = useRef(null);
  const routeLayerRef = useRef(null);
  const routeMarkersRef = useRef([]);
  const [leafletLoaded, setLeafletLoaded] = useState(false);
  const [mapLoaded, setMapLoaded] = useState(false);
  const [loadingError, setLoadingError] = useState(null);
  const [currentZoom, setCurrentZoom] = useState(zoom); // Track current zoom level
  const mountedRef = useRef(true);

  // Cleanup on unmount
  useEffect(() => {
    mountedRef.current = true;

    return () => {
      mountedRef.current = false;
      if (mapInstanceRef.current) {
        try {
          console.log('🧹 Cleaning up map instance');
          if (routeLayerRef.current && mapInstanceRef.current) {
            mapInstanceRef.current.removeLayer(routeLayerRef.current);
          }
          routeMarkersRef.current.forEach(marker => {
            if (marker && mapInstanceRef.current) mapInstanceRef.current.removeLayer(marker);
          });
          if (currentMarkerRef.current && mapInstanceRef.current) {
            mapInstanceRef.current.removeLayer(currentMarkerRef.current);
          }
          mapInstanceRef.current.remove();
          mapInstanceRef.current = null;
        } catch (error) {
          console.warn('Warning during map cleanup:', error);
        }
      }
    };
  }, []);

  // Load Leaflet library
  useEffect(() => {
    const loadLeaflet = async () => {
      try {
        setLoadingError(null);

        if (window.L && typeof window.L.map === 'function') {
          if (mountedRef.current) {
            setLeafletLoaded(true);
          }
          return;
        }

        console.log('📚 Loading Leaflet library...');

        const existingScripts = document.querySelectorAll('script[src*="leaflet.js"]');
        const existingStyles = document.querySelectorAll('link[href*="leaflet.css"]');
        existingScripts.forEach(script => script.remove());
        existingStyles.forEach(style => style.remove());

        const cssLink = document.createElement('link');
        cssLink.rel = 'stylesheet';
        cssLink.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
        cssLink.integrity = 'sha256-p4NxAoJBhIIN+hmNHrzRCf9tD/miZyoHS5obTRR9BMY=';
        cssLink.crossOrigin = '';
        document.head.appendChild(cssLink);

        const script = document.createElement('script');
        script.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';
        script.integrity = 'sha256-20nQCchB9co0qIjJZRGuk2/Z9VM+kNiyxNV1lvTlZBo=';
        script.crossOrigin = '';

        script.onload = () => {
          console.log('✅ Leaflet library loaded successfully');
          if (mountedRef.current) {
            setLeafletLoaded(true);
          }
        };

        script.onerror = (error) => {
          console.error('❌ Failed to load Leaflet library:', error);
          if (mountedRef.current) {
            setLoadingError('Failed to load map library');
          }
        };

        document.head.appendChild(script);
      } catch (error) {
        console.error('❌ Error loading Leaflet:', error);
        if (mountedRef.current) {
          setLoadingError('Failed to initialize map library');
        }
      }
    };

    loadLeaflet();
  }, []);

  // Initialize map with currentZoom
  useEffect(() => {
    if (leafletLoaded && mapRef.current && center && center.length === 2 && !mapInstanceRef.current && window.L && mountedRef.current) {
      try {
        console.log('🗺️ Initializing map with center:', center, 'zoom:', currentZoom);

        const map = window.L.map(mapRef.current, {
          center: center,
          zoom: currentZoom,
          zoomControl: true,
          attributionControl: true
        });

        window.L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
          attribution: '© OpenStreetMap contributors',
          maxZoom: 19
        }).addTo(map);

        // Sync zoom changes
        map.on('zoomend', () => {
          if (mountedRef.current) {
            setCurrentZoom(map.getZoom());
          }
        });

        mapInstanceRef.current = map;

        setTimeout(() => {
          if (mountedRef.current && mapInstanceRef.current) {
            setMapLoaded(true);
            console.log('✅ Map initialized successfully');
          }
        }, 1000);
      } catch (error) {
        console.error('❌ Failed to initialize map:', error);
        if (mountedRef.current) {
          setLoadingError('Failed to initialize map');
        }
      }
    }
  }, [leafletLoaded, center, currentZoom]);

  // Add/update route path and markers
  useEffect(() => {
    if (!mapInstanceRef.current || !mapLoaded || !device || !device.routePoints || !Array.isArray(device.routePoints) || !window.L || !mountedRef.current) {
      console.log('🚫 Route plotting skipped:', {
        mapInstance: !!mapInstanceRef.current,
        mapLoaded,
        device: !!device,
        routePoints: device?.routePoints,
        length: device?.routePoints?.length,
        leaflet: !!window.L,
        mounted: mountedRef.current
      });
      return;
    }

    console.log('🛣️ Attempting to plot route with points:', device.routePoints.length, 'Sample point:', device.routePoints[0]);
    try {
      if (routeLayerRef.current && mapInstanceRef.current) {
        mapInstanceRef.current.removeLayer(routeLayerRef.current);
      }
      routeMarkersRef.current.forEach(marker => {
        if (marker && mapInstanceRef.current) mapInstanceRef.current.removeLayer(marker);
      });
      routeMarkersRef.current = [];

      // Original route coordinates with validation
      const routeCoordinates = device.routePoints
        .filter(point => point && point.latitude !== undefined && point.longitude !== undefined && !isNaN(parseFloat(point.latitude)) && !isNaN(parseFloat(point.longitude)))
        .map(point => [parseFloat(point.latitude), parseFloat(point.longitude)]);

      console.log('🗺️ Valid route coordinates:', routeCoordinates);

      // Use only the historical route up to the last point
      const journeyRouteCoordinates = [...routeCoordinates];
      if (journeyRouteCoordinates.length > 0) {
        // Remove the last point if it’s too close to the current location to avoid confusion
        const lastRoutePoint = journeyRouteCoordinates[journeyRouteCoordinates.length - 1];
        const currentLat = parseFloat(device.latitude);
        const currentLng = parseFloat(device.longitude);
        if (lastRoutePoint && !isNaN(currentLat) && !isNaN(currentLng)) {
          const distance = Math.sqrt(
            Math.pow(currentLat - lastRoutePoint[0], 2) + Math.pow(currentLng - lastRoutePoint[1], 2)
          );
          if (distance < 0.001) { // Approx 100 meters, adjust as needed
            journeyRouteCoordinates.pop();
          }
        }
      }

      // Plot only the journey route without connecting to current location
      if (journeyRouteCoordinates.length > 0) {
        const routePolyline = window.L.polyline(journeyRouteCoordinates, {
          color: '#2563eb',
          weight: 4,
          opacity: 0.8,
          smoothFactor: 1
        }).addTo(mapInstanceRef.current);

        routeLayerRef.current = routePolyline;

        // Add markers for all journey points
        journeyRouteCoordinates.forEach((point, index) => {
          const isStart = index === 0;
          const isEnd = index === journeyRouteCoordinates.length - 1;
          const marker = window.L.circleMarker(point, {
            radius: isStart || isEnd ? 8 : 4,
            fillColor: isStart ? '#10b981' : isEnd ? '#ef4444' : '#6b7280',
            color: '#ffffff',
            weight: 2,
            opacity: 1,
            fillOpacity: isStart || isEnd ? 0.9 : 0.6
          }).addTo(mapInstanceRef.current);

          let popupContent = '';
          const routePoint = device.routePoints[index] || {};
          if (isStart) {
            popupContent = `
              <div style="font-family: system-ui; min-width: 180px;">
                <div style="font-weight: bold; color: #10b981; margin-bottom: 4px;">🚀 Journey Start</div>
                <div style="font-size: 12px; color: #4b5563;">
                  <div><strong>Time:</strong> ${routePoint.timestamp ? new Date(routePoint.timestamp).toLocaleString() : 'N/A'}</div>
                  <div><strong>Location:</strong> ${point[0].toFixed(6)}, ${point[1].toFixed(6)}</div>
                  <div><strong>Speed:</strong> ${routePoint.speed ? parseFloat(routePoint.speed).toFixed(1) : '0'} km/h</div>
                </div>
              </div>
            `;
          } else if (isEnd) {
            popupContent = `
              <div style="font-family: system-ui; min-width: 180px;">
                <div style="font-weight: bold; color: #ef4444; margin-bottom: 4px;">🏁 Last Recorded Point</div>
                <div style="font-size: 12px; color: #4b5563;">
                  <div><strong>Time:</strong> ${routePoint.timestamp ? new Date(routePoint.timestamp).toLocaleString() : 'N/A'}</div>
                  <div><strong>Location:</strong> ${point[0].toFixed(6)}, ${point[1].toFixed(6)}</div>
                  <div><strong>Speed:</strong> ${routePoint.speed ? parseFloat(routePoint.speed).toFixed(1) : '0'} km/h</div>
                </div>
              </div>
            `;
          } else {
            popupContent = `
              <div style="font-family: system-ui; min-width: 150px;">
                <div style="font-weight: bold; color: #6b7280; margin-bottom: 4px;">📍 Point ${index}</div>
                <div style="font-size: 12px; color: #4b5563;">
                  <div><strong>Location:</strong> ${point[0].toFixed(6)}, ${point[1].toFixed(6)}</div>
                  <div><strong>Time:</strong> ${routePoint.timestamp ? new Date(routePoint.timestamp).toLocaleString() : 'N/A'}</div>
                  <div><strong>Speed:</strong> ${routePoint.speed ? parseFloat(routePoint.speed).toFixed(1) : '0'} km/h</div>
                </div>
              </div>
            `;
          }
          marker.bindPopup(popupContent);
          routeMarkersRef.current.push(marker);
        });
      }

      // Safely adjust map view based on journey route
      if (mapInstanceRef.current && routeLayerRef.current && routeLayerRef.current.getBounds) {
        const bounds = routeLayerRef.current.getBounds();
        mapInstanceRef.current.fitBounds(bounds, { padding: [20, 20], animate: true });
      }

      console.log(`✅ Route plotted successfully with ${journeyRouteCoordinates.length} points`);
    } catch (error) {
      console.error('❌ Failed to plot route:', error, 'Route data:', device.routePoints, 'Current location:', [device.latitude, device.longitude]);
      setLoadingError('Failed to plot route. Check console for details.');
    }
  }, [device, device?.routePoints, device?.latitude, device?.longitude, device?.telemetry_timestamp, device?.speed, mapLoaded]);

  // Update vehicle marker
  useEffect(() => {
    if (!mapInstanceRef.current || !mapLoaded || !device || !device.latitude || !device.longitude || !window.L || !mountedRef.current) {
      return;
    }

    try {
      const lat = parseFloat(device.latitude);
      const lng = parseFloat(device.longitude);

      if (isNaN(lat) || isNaN(lng)) {
        console.warn('Invalid coordinates:', device.latitude, device.longitude);
        return;
      }

      if (currentMarkerRef.current && mapInstanceRef.current) {
        mapInstanceRef.current.removeLayer(currentMarkerRef.current);
      }

      const heading = device.heading || 0;
      const speed = device.speed || 0;

      let markerColor = '#3b82f6';
      if (speed > 80) markerColor = '#ef4444';
      else if (speed > 50) markerColor = '#f59e0b';
      else if (speed > 0) markerColor = '#10b981';

      const vehicleIcon = window.L.divIcon({
        className: 'custom-vehicle-marker',
        html: `
          <div style="
            width: 24px; 
            height: 24px; 
            background-color: ${markerColor}; 
            border: 3px solid white; 
            border-radius: 50%; 
            transform: rotate(${heading}deg);
            box-shadow: 0 2px 8px rgba(0,0,0,0.3);
            position: relative;
          ">
            <div style="
              position: absolute;
              top: -6px;
              left: 50%;
              transform: translateX(-50%);
              width: 0;
              height: 0;
              border-left: 4px solid transparent;
              border-right: 4px solid transparent;
              border-bottom: 8px solid ${markerColor};
            "></div>
          </div>
        `,
        iconSize: [24, 24],
        iconAnchor: [12, 12]
      });

      const marker = window.L.marker([lat, lng], { icon: vehicleIcon }).addTo(mapInstanceRef.current);

      const popupContent = `
        <div style="min-width: 220px; font-family: system-ui; line-height: 1.4;">
          <div style="font-weight: bold; margin-bottom: 8px; color: #1f2937; border-bottom: 1px solid #e5e7eb; padding-bottom: 4px;">
            ${vehicle?.vehicle_number || device.device_name || `Device ${device.device_id}`}
          </div>
          <div style="font-size: 12px; color: #4b5563;">
            <div style="margin-bottom: 6px;">
              <strong>📍 Location:</strong><br>
              ${lat.toFixed(6)}, ${lng.toFixed(6)}
            </div>
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin-bottom: 6px;">
              <div><strong>🚗 Speed:</strong><br>${speed.toFixed(1)} km/h</div>
              <div><strong>🧭 Heading:</strong><br>${heading.toFixed(0)}°</div>
            </div>
            ${device.acceleration !== undefined ? 
              `<div style="margin-bottom: 6px;"><strong>⚡ Acceleration:</strong> ${device.acceleration.toFixed(2)} m/s²</div>` : ''
            }
            <div style="margin-bottom: 6px;">
              <strong>🕒 Last Update:</strong><br>
              ${device.telemetry_timestamp ? 
                new Date(device.telemetry_timestamp).toLocaleString() : 'Unknown'
              }
            </div>
            ${vehicle ? `
              <div style="margin-top: 8px; padding-top: 6px; border-top: 1px solid #e5e7eb; font-size: 11px;">
                <strong>Vehicle Info:</strong><br>
                ${vehicle.manufacturer} ${vehicle.model} (${vehicle.year || 'N/A'})
              </div>
            ` : ''}
            ${(device.drowsiness || device.rash_driving || device.collision) ? `
              <div style="margin-top: 6px; padding: 4px; background: #fef2f2; border: 1px solid #fecaca; border-radius: 4px;">
                <strong style="color: #dc2626;">⚠️ Alerts:</strong><br>
                ${device.drowsiness ? '😴 Drowsiness ' : ''}
                ${device.rash_driving ? '⚡ Rash Driving ' : ''}
                ${device.collision ? '💥 Collision ' : ''}
              </div>
            ` : ''}
          </div>
        </div>
      `;

      marker.bindPopup(popupContent, {
        maxWidth: 300,
        className: 'custom-popup'
      });

      currentMarkerRef.current = marker;

      if (enableTracking && mapInstanceRef.current) {
        mapInstanceRef.current.setView([lat, lng], currentZoom, { animate: true });
      }

      console.log(`📍 Updated vehicle marker at ${lat}, ${lng} (speed: ${speed} km/h, heading: ${heading}°)`);
    } catch (error) {
      console.error('❌ Failed to update marker:', error);
    }
  }, [device, vehicle, enableTracking, currentZoom, mapLoaded]);

  // Update map center
  useEffect(() => {
    if (!mapInstanceRef.current || !mapLoaded || !center || center.length !== 2) {
      return;
    }
    try {
      const [lat, lng] = center;
      if (!isNaN(lat) && !isNaN(lng) && mapInstanceRef.current) {
        mapInstanceRef.current.setView([lat, lng], currentZoom, { animate: true });
      }
    } catch (error) {
      console.error('❌ Failed to update map center:', error);
    }
  }, [center, currentZoom, mapLoaded]);

  // Zoom In function
  const zoomIn = () => {
    if (mapInstanceRef.current) {
      mapInstanceRef.current.zoomIn();
      setCurrentZoom(mapInstanceRef.current.getZoom()); // Update state after zooming
    }
  };

  // Zoom Out function
  const zoomOut = () => {
    if (mapInstanceRef.current) {
      mapInstanceRef.current.zoomOut();
      setCurrentZoom(mapInstanceRef.current.getZoom()); // Update state after zooming
    }
  };

  return (
    <div className="relative" style={{ height }}>
      <div ref={mapRef} style={{ width: '100%', height: '100%' }} className="border border-gray-300 rounded-lg">
        {(!leafletLoaded || !mapLoaded) && (
          <div className="absolute inset-0 flex items-center justify-center bg-gray-100 rounded-lg">
            <div className="text-center">
              <RefreshCw className="w-8 h-8 mx-auto mb-2 text-blue-600 animate-spin" />
              <p className="text-sm text-gray-600">Loading map...</p>
            </div>
          </div>
        )}

        {loadingError && (
          <div className="absolute inset-0 flex items-center justify-center rounded-lg bg-red-50">
            <div className="p-4 text-center">
              <MapPin className="w-8 h-8 mx-auto mb-2 text-red-500" />
              <p className="mb-2 text-sm text-red-600">{loadingError}</p>
              <button
                onClick={() => window.location.reload()}
                className="px-3 py-1 text-xs text-white bg-red-600 rounded hover:bg-red-700"
              >
                Reload Page
              </button>
            </div>
          </div>
        )}
      </div>

      {mapLoaded && (
        <>
          <div className="absolute p-2 bg-white border rounded-lg shadow-md top-2 right-2">
            <div className="flex items-center space-x-2">
              <div className={`w-2 h-2 rounded-full ${device && device.latitude ? 'bg-green-500' : 'bg-orange-500'}`}></div>
              <span className="text-xs text-gray-700">
                {device && device.latitude ? 'GPS Active' : 'No GPS'}
              </span>
            </div>
          </div>

          {enableTracking && device && device.latitude && (
            <div className="absolute px-2 py-1 bg-green-100 rounded shadow top-2 left-2">
              <div className="flex items-center space-x-2 text-xs">
                <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                <span className="font-medium text-green-800">Live Tracking</span>
              </div>
            </div>
          )}

          <div className="absolute flex flex-col space-y-2 bottom-4 right-4">
            <button
              onClick={zoomIn}
              className="p-2 bg-white border rounded-lg shadow-md hover:bg-gray-50"
              title="Zoom In"
            >
              <ZoomIn className="w-4 h-4 text-gray-600" />
            </button>
            <button
              onClick={zoomOut}
              className="p-2 bg-white border rounded-lg shadow-md hover:bg-gray-50"
              title="Zoom Out"
            >
              <ZoomOut className="w-4 h-4 text-gray-600" />
            </button>
            <button
              onClick={() => {
                if (mapInstanceRef.current && device && device.latitude && device.longitude) {
                  mapInstanceRef.current.setView([parseFloat(device.latitude), parseFloat(device.longitude)], currentZoom, { animate: true });
                }
              }}
              className="p-2 bg-white border rounded-lg shadow-md hover:bg-gray-50"
              title="Center on Vehicle"
            >
              <Navigation className="w-4 h-4 text-gray-600" />
            </button>
          </div>

          {device && device.speed !== undefined && (
            <div className="absolute p-3 bg-white border rounded-lg shadow-md bottom-4 left-4">
              <div className="text-center">
                <div className="mb-1 text-xs text-gray-500">Speed</div>
                <div className={`text-lg font-bold ${
                  device.speed > 80 ? 'text-red-600' :
                  device.speed > 50 ? 'text-orange-600' :
                  device.speed > 0 ? 'text-green-600' : 'text-gray-600'
                }`}>
                  {device.speed.toFixed(0)}
                </div>
                <div className="text-xs text-gray-500">km/h</div>
              </div>
            </div>
          )}
        </>
      )}

      {mapLoaded && (!device || !device.latitude || !device.longitude) && (
        <div className="absolute inset-0 flex items-center justify-center bg-white rounded-lg bg-opacity-90">
          <div className="p-6 text-center">
            <MapPin className="w-12 h-12 mx-auto mb-4 text-gray-400" />
            <h3 className="mb-2 text-lg font-medium text-gray-900">No GPS Data</h3>
            <p className="text-sm text-gray-600">
              This device doesn't have valid GPS coordinates.<br/>
              Check if the device is online and sending telemetry data.
            </p>
          </div>
        </div>
      )}

      <style jsx>{`
        .custom-vehicle-marker {
          transition: transform 0.3s ease;
        }
        .custom-popup .leaflet-popup-content-wrapper {
          border-radius: 8px;
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
        }
        .custom-popup .leaflet-popup-tip {
          background: white;
        }
      `}</style>
    </div>
  );
};

export default EnhancedDeviceMap;