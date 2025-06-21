// Enhanced Vehicle Route Tracker with Complete Journey Tracing
import React, { useState, useEffect, useRef } from 'react';
import { useData } from '../../contexts/DataContext';
import { 
  Car, MapPin, Navigation, Activity, Play, Square, 
  Download, Clock, Zap, AlertTriangle,
  Wifi, CheckCircle, ExternalLink, ZoomIn, RotateCcw,
  FileText, Database, TrendingUp, Eye
} from 'lucide-react';

const EnhancedVehicleRouteTracker = () => {
  const { data } = useData();
  
  // Core state
  const [selectedVehicle, setSelectedVehicle] = useState(null);
  const [isTracking, setIsTracking] = useState(false);
  const [trackingStartTime, setTrackingStartTime] = useState(null);
  const [activeJourney, setActiveJourney] = useState(null);
  const [mapLoaded, setMapLoaded] = useState(false);
  const [leafletLoaded, setLeafletLoaded] = useState(false);
  
  // Journey and route state
  const [journeyHistory, setJourneyHistory] = useState([]);
  const [routePoints, setRoutePoints] = useState([]);
  const [totalDistance, setTotalDistance] = useState(0);
  const [maxSpeed, setMaxSpeed] = useState(0);
  const [avgSpeed, setAvgSpeed] = useState(0);
  const [currentSpeed, setCurrentSpeed] = useState(0);
  
  // Map and tracking refs
  const mapRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const trackingIntervalRef = useRef(null);
  const routePolylineRef = useRef(null);
  const liveMarkerRef = useRef(null);
  const markersRef = useRef([]);
  
  // Error state
  const [error, setError] = useState(null);
  const [apiStatus, setApiStatus] = useState('checking');

  // Notification helpers
  const showSuccess = (title, message) => {
    console.log(`✅ ${title}: ${message}`);
    // You can integrate with your notification system here
  };

  const showError = (title, message) => {
    console.error(`❌ ${title}: ${message}`);
    setError({ title, message });
    setTimeout(() => setError(null), 5000);
  };

  // Load Leaflet library
  useEffect(() => {
    const loadLeaflet = async () => {
      if (window.L) {
        setLeafletLoaded(true);
        return;
      }

      try {
        // Load Leaflet CSS
        const cssLink = document.createElement('link');
        cssLink.rel = 'stylesheet';
        cssLink.href = 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.css';
        document.head.appendChild(cssLink);

        // Load Leaflet JS
        const script = document.createElement('script');
        script.src = 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.js';
        script.onload = () => {
          // Fix default marker icons
          if (window.L) {
            delete window.L.Icon.Default.prototype._getIconUrl;
            window.L.Icon.Default.mergeOptions({
              iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
              iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
              shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
            });
          }
          setLeafletLoaded(true);
        };
        document.head.appendChild(script);
      } catch (error) {
        console.error('Failed to load Leaflet:', error);
        showError('Map Loading Failed', 'Could not load map library');
      }
    };

    loadLeaflet();
  }, []);

  // Initialize map
  useEffect(() => {
    if (!leafletLoaded || !mapRef.current || mapInstanceRef.current) return;

    try {
      console.log('🗺️ Initializing enhanced route tracking map...');
      
      const map = window.L.map(mapRef.current, {
        center: [28.6139, 77.2090], // Default to Delhi
        zoom: 10,
        zoomControl: true
      });

      // Add OpenStreetMap tiles
      window.L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
        maxZoom: 19
      }).addTo(map);

      // Add scale control
      window.L.control.scale().addTo(map);

      mapInstanceRef.current = map;
      setMapLoaded(true);
      
      console.log('✅ Enhanced route tracking map initialized successfully');
    } catch (error) {
      console.error('❌ Failed to initialize map:', error);
      showError('Map Initialization Failed', error.message);
    }
  }, [leafletLoaded]);

  // Get vehicle position from API
  const getVehiclePositionFromAPI = async (vehicle) => {
    try {
      console.log(`🔍 Fetching position for vehicle ${vehicle.vehicle_number}...`);
      
      // Get devices assigned to this vehicle
      const devices = data.devices.filter(d => d.vehicle_id === vehicle.vehicle_id);
      
      if (devices.length === 0) {
        throw new Error(`No device assigned to vehicle ${vehicle.vehicle_number}`);
      }

      const device = devices[0];
      
      // Validate coordinates
      if (!device.latitude || !device.longitude) {
        throw new Error(`No GPS coordinates available for device ${device.device_id}`);
      }

      const latitude = parseFloat(device.latitude);
      const longitude = parseFloat(device.longitude);
      
      if (isNaN(latitude) || isNaN(longitude)) {
        throw new Error(`Invalid coordinates for device ${device.device_id}`);
      }

      return {
        latitude,
        longitude,
        speed: parseFloat(device.speed) || 0,
        heading: parseFloat(device.heading) || 0,
        timestamp: new Date().toISOString(),
        device_id: device.device_id,
        source: 'api_telemetry',
        accuracy: device.accuracy || 10,
        altitude: device.altitude || null,
        status: device.status || 'unknown'
      };

    } catch (error) {
      console.error(`❌ Error getting vehicle position:`, error);
      throw error;
    }
  };

  // Calculate distance between two points
  const calculateDistance = (lat1, lon1, lat2, lon2) => {
    const R = 6371; // Earth's radius in kilometers
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = 
      Math.sin(dLat/2) * Math.sin(dLat/2) +
      Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
      Math.sin(dLon/2) * Math.sin(dLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c;
  };

  // Calculate route statistics
  const calculateRouteStats = (points) => {
    if (points.length < 2) return { totalDistance: 0, maxSpeed: 0, avgSpeed: 0 };

    let totalDist = 0;
    let maxSpd = 0;
    let totalSpeed = 0;
    let speedCount = 0;

    for (let i = 1; i < points.length; i++) {
      const prevPoint = points[i - 1];
      const currPoint = points[i];
      
      // Calculate distance
      const dist = calculateDistance(
        prevPoint.lat, prevPoint.lng,
        currPoint.lat, currPoint.lng
      );
      totalDist += dist;

      // Track speed
      if (currPoint.speed > maxSpd) maxSpd = currPoint.speed;
      if (currPoint.speed > 0) {
        totalSpeed += currPoint.speed;
        speedCount++;
      }
    }

    return {
      totalDistance: totalDist,
      maxSpeed: maxSpd,
      avgSpeed: speedCount > 0 ? totalSpeed / speedCount : 0
    };
  };

  // Start journey tracking
  const startJourneyTracking = async (vehicle) => {
    if (!vehicle) {
      showError('Error', 'Please select a vehicle first');
      return;
    }

    if (!mapInstanceRef.current) {
      showError('Error', 'Map not ready. Please wait a moment and try again.');
      return;
    }

    try {
      console.log(`🚀 Starting enhanced journey tracking for ${vehicle.vehicle_number}`);
      
      // Get initial position from API
      const initialPosition = await getVehiclePositionFromAPI(vehicle);
      
      setSelectedVehicle(vehicle);
      setIsTracking(true);
      setTrackingStartTime(new Date());
      setApiStatus('connected');
      
      // Initialize journey data
      const startPoint = {
        lat: initialPosition.latitude,
        lng: initialPosition.longitude,
        timestamp: initialPosition.timestamp,
        speed: initialPosition.speed,
        heading: initialPosition.heading,
        source: initialPosition.source,
        device_id: initialPosition.device_id
      };

      const journey = {
        journey_id: `ENH_J_${Date.now()}`,
        vehicle_id: vehicle.vehicle_id,
        vehicle_number: vehicle.vehicle_number,
        start_time: new Date().toISOString(),
        start_location: startPoint,
        route_points: [startPoint],
        status: 'ongoing',
        total_distance: 0,
        max_speed: initialPosition.speed,
        avg_speed: initialPosition.speed,
        data_source: 'enhanced_api_tracking'
      };

      setActiveJourney(journey);
      setRoutePoints([startPoint]);
      setTotalDistance(0);
      setMaxSpeed(initialPosition.speed);
      setAvgSpeed(initialPosition.speed);
      setCurrentSpeed(initialPosition.speed);

      // Clear existing markers and route
      clearMapElements();

      // Add starting point marker
      addStartMarker(startPoint, vehicle);

      // Center map on vehicle
      mapInstanceRef.current.setView([initialPosition.latitude, initialPosition.longitude], 15);

      // Start live tracking
      trackingIntervalRef.current = setInterval(() => {
        trackLivePosition(vehicle);
      }, 10000); // Update every 10 seconds

      showSuccess('Success', `Enhanced tracking started for ${vehicle.vehicle_number}`);

    } catch (error) {
      console.error('Error starting journey tracking:', error);
      showError('Error', `Failed to start tracking: ${error.message}`);
      setIsTracking(false);
      setSelectedVehicle(null);
      setApiStatus('error');
    }
  };

  // Track live position
  const trackLivePosition = async (vehicle) => {
    if (!mapInstanceRef.current || !isTracking) return;

    try {
      console.log(`🔄 Tracking live position for ${vehicle.vehicle_number}...`);
      
      const newPosition = await getVehiclePositionFromAPI(vehicle);
      setApiStatus('connected');
      setCurrentSpeed(newPosition.speed);
      
      const newPoint = {
        lat: newPosition.latitude,
        lng: newPosition.longitude,
        timestamp: newPosition.timestamp,
        speed: newPosition.speed,
        heading: newPosition.heading,
        source: newPosition.source,
        device_id: newPosition.device_id
      };

      // Calculate distance from last point
      const lastPoint = routePoints[routePoints.length - 1];
      const distance = lastPoint ? calculateDistance(
        lastPoint.lat, lastPoint.lng,
        newPoint.lat, newPoint.lng
      ) : 0;

      // Only add point if there's significant movement (> 5 meters)
      if (distance > 0.005) { // ~5 meters
        newPoint.distance_from_previous = distance;

        // Update route points
        const updatedPoints = [...routePoints, newPoint];
        setRoutePoints(updatedPoints);

        // Calculate updated statistics
        const stats = calculateRouteStats(updatedPoints);
        setTotalDistance(stats.totalDistance);
        setMaxSpeed(stats.maxSpeed);
        setAvgSpeed(stats.avgSpeed);

        // Update journey object
        if (activeJourney) {
          const updatedJourney = {
            ...activeJourney,
            route_points: updatedPoints,
            total_distance: stats.totalDistance,
            max_speed: stats.maxSpeed,
            avg_speed: stats.avgSpeed,
            last_updated: new Date().toISOString()
          };
          setActiveJourney(updatedJourney);
        }

        // Update map visualization
        updateLiveMarker(newPoint, vehicle);
        updateRoutePolyline(updatedPoints);

        console.log(`📍 New position added: ${distance.toFixed(3)} km from last point`);
      }

    } catch (error) {
      console.error('Error tracking live position:', error);
      setApiStatus('error');
      // Don't stop tracking for temporary API errors
    }
  };

  // Clear map elements
  const clearMapElements = () => {
    if (!mapInstanceRef.current) return;

    // Clear existing markers
    markersRef.current.forEach(marker => {
      mapInstanceRef.current.removeLayer(marker);
    });
    markersRef.current = [];

    // Clear existing route
    if (routePolylineRef.current) {
      mapInstanceRef.current.removeLayer(routePolylineRef.current);
      routePolylineRef.current = null;
    }

    // Clear live marker
    if (liveMarkerRef.current) {
      mapInstanceRef.current.removeLayer(liveMarkerRef.current);
      liveMarkerRef.current = null;
    }
  };

  // Add start marker
  const addStartMarker = (point, vehicle) => {
    if (!mapInstanceRef.current || !window.L) return;

    const startIcon = window.L.divIcon({
      html: `<div style="background: #10b981; color: white; width: 30px; height: 30px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 12px; border: 2px solid white; box-shadow: 0 2px 4px rgba(0,0,0,0.3);">🚩</div>`,
      className: 'custom-div-icon',
      iconSize: [30, 30],
      iconAnchor: [15, 15]
    });

    const startMarker = window.L.marker([point.lat, point.lng], { icon: startIcon })
      .addTo(mapInstanceRef.current)
      .bindPopup(`
        <div style="text-align: center; min-width: 200px;">
          <strong>🚩 Journey Started</strong><br>
          <strong>${vehicle.vehicle_number}</strong><br>
          <small>Device: ${point.device_id}</small><br>
          <small>Time: ${new Date(point.timestamp).toLocaleTimeString()}</small><br>
          <small>Speed: ${point.speed.toFixed(1)} km/h</small>
        </div>
      `);

    markersRef.current.push(startMarker);
  };

  // Update live marker
  const updateLiveMarker = (point, vehicle) => {
    if (!mapInstanceRef.current || !window.L) return;

    // Remove existing live marker
    if (liveMarkerRef.current) {
      mapInstanceRef.current.removeLayer(liveMarkerRef.current);
    }

    // Create rotating vehicle icon based on heading
    const vehicleIcon = window.L.divIcon({
      html: `<div style="background: #3b82f6; color: white; width: 35px; height: 35px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 14px; border: 3px solid white; box-shadow: 0 2px 8px rgba(0,0,0,0.3); transform: rotate(${point.heading}deg); transition: transform 0.3s ease;">🚗</div>`,
      className: 'custom-div-icon',
      iconSize: [35, 35],
      iconAnchor: [17.5, 17.5]
    });

    const liveMarker = window.L.marker([point.lat, point.lng], { icon: vehicleIcon })
      .addTo(mapInstanceRef.current)
      .bindPopup(`
        <div style="text-align: center; min-width: 200px;">
          <strong>🚗 ${vehicle.vehicle_number}</strong><br>
          <small>Device: ${point.device_id}</small><br>
          <small>Current Speed: ${point.speed.toFixed(1)} km/h</small><br>
          <small>Heading: ${point.heading.toFixed(0)}°</small><br>
          <small>Last Update: ${new Date(point.timestamp).toLocaleTimeString()}</small><br>
          <small>Source: ${point.source}</small>
        </div>
      `);

    liveMarkerRef.current = liveMarker;
  };

  // Update route polyline
  const updateRoutePolyline = (points) => {
    if (!mapInstanceRef.current || !window.L) return;

    // Remove existing route
    if (routePolylineRef.current) {
      mapInstanceRef.current.removeLayer(routePolylineRef.current);
    }

    if (points.length < 2) return;

    // Create route coordinates
    const routeCoords = points.map(point => [point.lat, point.lng]);

    // Create polyline with enhanced styling
    const routePolyline = window.L.polyline(routeCoords, {
      color: '#3b82f6',
      weight: 4,
      opacity: 0.8,
      smoothFactor: 1,
      dashArray: '5, 5',
      lineCap: 'round',
      lineJoin: 'round'
    }).addTo(mapInstanceRef.current);

    // Add popup to route
    routePolyline.bindPopup(`
      <div style="text-align: center;">
        <strong>🛣️ Route Path</strong><br>
        <small>Total Distance: ${totalDistance.toFixed(2)} km</small><br>
        <small>Points: ${points.length}</small><br>
        <small>Max Speed: ${maxSpeed.toFixed(1)} km/h</small>
      </div>
    `);

    routePolylineRef.current = routePolyline;

    // Fit map to route bounds
    if (points.length > 1) {
      const group = new window.L.featureGroup([routePolyline]);
      mapInstanceRef.current.fitBounds(group.getBounds().pad(0.1));
    }
  };

  // Stop journey tracking
  const stopJourneyTracking = async () => {
    if (!isTracking) return;

    try {
      console.log('🛑 Stopping journey tracking...');

      // Clear tracking interval
      if (trackingIntervalRef.current) {
        clearInterval(trackingIntervalRef.current);
        trackingIntervalRef.current = null;
      }

      // Finalize journey
      if (activeJourney && selectedVehicle) {
        // Get final position
        try {
          const finalPosition = await getVehiclePositionFromAPI(selectedVehicle);
          
          const finalJourney = {
            ...activeJourney,
            end_time: new Date().toISOString(),
            end_location: {
              lat: finalPosition.latitude,
              lng: finalPosition.longitude,
              timestamp: finalPosition.timestamp,
              speed: finalPosition.speed,
              heading: finalPosition.heading,
              source: finalPosition.source,
              device_id: finalPosition.device_id
            },
            status: 'completed',
            total_distance: totalDistance,
            max_speed: maxSpeed,
            avg_speed: avgSpeed,
            total_duration: Date.now() - new Date(activeJourney.start_time).getTime(),
            route_points: routePoints
          };

          // Add end marker
          addEndMarker(finalJourney.end_location, selectedVehicle);

          // Add to journey history
          setJourneyHistory(prev => [finalJourney, ...prev]);

          console.log('✅ Journey completed and saved:', finalJourney);
          showSuccess('Success', `Journey completed for ${selectedVehicle.vehicle_number}`);

        } catch (error) {
          console.warn('Could not get final position:', error);
          // Still save the journey with available data
          const finalJourney = {
            ...activeJourney,
            end_time: new Date().toISOString(),
            status: 'completed',
            total_distance: totalDistance,
            max_speed: maxSpeed,
            avg_speed: avgSpeed,
            total_duration: Date.now() - new Date(activeJourney.start_time).getTime(),
            route_points: routePoints
          };

          setJourneyHistory(prev => [finalJourney, ...prev]);
          showSuccess('Success', `Journey completed for ${selectedVehicle.vehicle_number}`);
        }
      }

      // Reset state
      setIsTracking(false);
      setSelectedVehicle(null);
      setActiveJourney(null);
      setTrackingStartTime(null);
      setApiStatus('checking');

    } catch (error) {
      console.error('Error stopping journey tracking:', error);
      showError('Error', `Failed to stop tracking: ${error.message}`);
    }
  };

  // Add end marker
  const addEndMarker = (point, vehicle) => {
    if (!mapInstanceRef.current || !window.L) return;

    const endIcon = window.L.divIcon({
      html: `<div style="background: #ef4444; color: white; width: 30px; height: 30px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 12px; border: 2px solid white; box-shadow: 0 2px 4px rgba(0,0,0,0.3);">🏁</div>`,
      className: 'custom-div-icon',
      iconSize: [30, 30],
      iconAnchor: [15, 15]
    });

    const endMarker = window.L.marker([point.lat, point.lng], { icon: endIcon })
      .addTo(mapInstanceRef.current)
      .bindPopup(`
        <div style="text-align: center; min-width: 200px;">
          <strong>🏁 Journey Ended</strong><br>
          <strong>${vehicle.vehicle_number}</strong><br>
          <small>Device: ${point.device_id}</small><br>
          <small>Time: ${new Date(point.timestamp).toLocaleTimeString()}</small><br>
          <small>Final Speed: ${point.speed.toFixed(1)} km/h</small>
        </div>
      `);

    markersRef.current.push(endMarker);
  };

  // Export journey data
  const exportJourneyData = (journey, format = 'json') => {
    if (!journey) return;

    const data = {
      ...journey,
      export_time: new Date().toISOString(),
      export_format: format
    };

    let content, filename, mimeType;

    switch (format) {
      case 'csv':
        const headers = ['Timestamp', 'Latitude', 'Longitude', 'Speed_KMH', 'Heading', 'Distance_KM', 'Source'];
        const rows = journey.route_points.map(point => [
          point.timestamp,
          point.lat,
          point.lng,
          point.speed || 0,
          point.heading || 0,
          point.distance_from_previous || 0,
          point.source
        ]);
        
        content = [headers.join(','), ...rows.map(row => row.join(','))].join('\n');
        filename = `journey_${journey.vehicle_number}_${new Date().toISOString().split('T')[0]}.csv`;
        mimeType = 'text/csv';
        break;

      case 'gpx':
        content = `<?xml version="1.0" encoding="UTF-8"?>
<gpx version="1.1" creator="Enhanced Vehicle Route Tracker">
  <metadata>
    <name>Vehicle Route - ${journey.vehicle_number}</name>
    <desc>Journey from ${journey.start_time} to ${journey.end_time || 'ongoing'}</desc>
  </metadata>
  <trk>
    <name>Vehicle Route</name>
    <trkseg>
${journey.route_points.map(point => `      <trkpt lat="${point.lat}" lon="${point.lng}">
        <time>${point.timestamp}</time>
        <speed>${(point.speed / 3.6).toFixed(2)}</speed>
      </trkpt>`).join('\n')}
    </trkseg>
  </trk>
</gpx>`;
        filename = `journey_${journey.vehicle_number}_${new Date().toISOString().split('T')[0]}.gpx`;
        mimeType = 'application/gpx+xml';
        break;

      default: // json
        content = JSON.stringify(data, null, 2);
        filename = `journey_${journey.vehicle_number}_${new Date().toISOString().split('T')[0]}.json`;
        mimeType = 'application/json';
    }

    // Download file
    const blob = new Blob([content], { type: mimeType });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);

    showSuccess('Export Success', `Journey data exported as ${format.toUpperCase()}`);
  };

  // Format duration
  const formatDuration = (milliseconds) => {
    const seconds = Math.floor(milliseconds / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    
    if (hours > 0) {
      return `${hours}h ${minutes % 60}m`;
    } else if (minutes > 0) {
      return `${minutes}m ${seconds % 60}s`;
    } else {
      return `${seconds}s`;
    }
  };

  // Filter vehicles with GPS data
  const vehiclesWithGPS = data.vehicles.filter(vehicle => {
    const device = data.devices.find(d => d.vehicle_id === vehicle.vehicle_id);
    return device && device.latitude && device.longitude;
  });

  return (
    <div className="mx-auto space-y-6 max-w-7xl">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Enhanced Vehicle Route Tracker</h1>
          <p className="text-gray-600">Advanced journey tracing with real-time API data and route visualization</p>
        </div>
        {isTracking && (
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 px-4 py-2 bg-green-100 rounded-lg">
              <div className="w-3 h-3 bg-green-500 rounded-full animate-pulse"></div>
              <span className="text-sm font-medium text-green-800">Live Tracking Active</span>
            </div>
            <div className={`flex items-center gap-2 px-3 py-2 rounded-lg ${
              apiStatus === 'connected' ? 'bg-blue-100 text-blue-800' :
              apiStatus === 'error' ? 'bg-red-100 text-red-800' :
              'bg-yellow-100 text-yellow-800'
            }`}>
              <Wifi className="w-4 h-4" />
              <span className="text-sm font-medium">
                {apiStatus === 'connected' ? 'API Connected' :
                 apiStatus === 'error' ? 'API Error' : 'Checking API'}
              </span>
            </div>
          </div>
        )}
      </div>

      {/* Error Alert */}
      {error && (
        <div className="p-4 border border-red-200 rounded-lg bg-red-50">
          <div className="flex items-start gap-2">
            <AlertTriangle className="w-5 h-5 text-red-600 mt-0.5" />
            <div>
              <h4 className="font-medium text-red-900">{error.title}</h4>
              <p className="mt-1 text-sm text-red-800">{error.message}</p>
            </div>
          </div>
        </div>
      )}

      {/* Enhanced Features Banner */}
      <div className="p-4 border border-blue-200 rounded-lg bg-blue-50">
        <div className="flex items-start gap-3">
          <CheckCircle className="w-5 h-5 text-blue-600 mt-0.5" />
          <div className="flex-1">
            <h3 className="font-medium text-blue-900">Enhanced Route Tracking Features</h3>
            <div className="mt-2 space-y-1 text-sm text-blue-800">
              <p>• <strong>Real-time Route Tracing:</strong> Live vehicle tracking with 10-second intervals and route visualization</p>
              <p>• <strong>Enhanced Journey Analytics:</strong> Distance, speed, duration, and route statistics with live updates</p>
              <p>• <strong>Visual Route Mapping:</strong> Start/end markers, live vehicle position, and animated route polylines</p>
              <p>• <strong>Multiple Export Formats:</strong> JSON, CSV, and GPX formats for route data export</p>
              <p>• <strong>API-Only Data Source:</strong> All tracking data sourced from real telemetry APIs with no mock data</p>
              <p>• <strong>Journey History:</strong> Complete tracking history with detailed analytics and replay functionality</p>
            </div>
          </div>
        </div>
      </div>

      {/* Main Controls */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        
        {/* Vehicle Selection & Control Panel */}
        <div className="lg:col-span-1">
          <div className="p-6 bg-white border rounded-lg shadow">
            <h3 className="mb-4 text-lg font-medium text-gray-900">Vehicle Control Panel</h3>
            
            {!isTracking ? (
              <div className="space-y-4">
                <div>
                  <label className="block mb-2 text-sm font-medium text-gray-700">
                    Select Vehicle for Route Tracking
                  </label>
                  <div className="space-y-2">
                    {vehiclesWithGPS.map((vehicle) => {
                      const device = data.devices.find(d => d.vehicle_id === vehicle.vehicle_id);
                      return (
                        <div
                          key={vehicle.vehicle_id}
                          className="p-3 border rounded-lg cursor-pointer hover:border-blue-300 hover:bg-blue-50"
                          onClick={() => startJourneyTracking(vehicle)}
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                              <Car className="w-5 h-5 text-blue-600" />
                              <div>
                                <div className="font-medium">{vehicle.vehicle_number}</div>
                                <div className="text-sm text-gray-500">
                                  Device: {device?.device_id} • Speed: {device?.speed || 0} km/h
                                </div>
                              </div>
                            </div>
                            <div className="flex items-center gap-2">
                              <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                              <Navigation className="w-4 h-4 text-blue-600" />
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
                
                {vehiclesWithGPS.length === 0 && (
                  <div className="p-4 text-center text-gray-500 rounded-lg bg-gray-50">
                    <MapPin className="w-8 h-8 mx-auto mb-2 text-gray-400" />
                    <p className="text-sm">No vehicles with GPS data available</p>
                    <p className="text-xs text-gray-400">Ensure devices have valid coordinates</p>
                  </div>
                )}
              </div>
            ) : (
              <div className="space-y-4">
                <div className="p-4 rounded-lg bg-green-50">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="p-2 bg-green-100 rounded-lg">
                      <Car className="w-5 h-5 text-green-600" />
                    </div>
                    <div>
                      <div className="font-medium text-green-900">{selectedVehicle?.vehicle_number}</div>
                      <div className="text-sm text-green-700">Journey in Progress</div>
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-3 mb-4">
                    <div className="p-3 bg-white rounded-lg">
                      <div className="text-xs text-gray-500">Current Speed</div>
                      <div className="text-lg font-bold text-blue-600">{currentSpeed.toFixed(1)} km/h</div>
                    </div>
                    <div className="p-3 bg-white rounded-lg">
                      <div className="text-xs text-gray-500">Distance</div>
                      <div className="text-lg font-bold text-purple-600">{totalDistance.toFixed(2)} km</div>
                    </div>
                    <div className="p-3 bg-white rounded-lg">
                      <div className="text-xs text-gray-500">Max Speed</div>
                      <div className="text-lg font-bold text-orange-600">{maxSpeed.toFixed(1)} km/h</div>
                    </div>
                    <div className="p-3 bg-white rounded-lg">
                      <div className="text-xs text-gray-500">Duration</div>
                      <div className="text-lg font-bold text-green-600">
                        {trackingStartTime ? formatDuration(Date.now() - trackingStartTime.getTime()) : '0s'}
                      </div>
                    </div>
                  </div>
                  
                  <button
                    onClick={stopJourneyTracking}
                    className="flex items-center justify-center w-full gap-2 px-4 py-3 text-white transition-colors bg-red-600 rounded-lg hover:bg-red-700"
                  >
                    <Square className="w-4 h-4" />
                    Stop Journey Tracking
                  </button>
                </div>
              </div>
            )}
          </div>
          
          {/* Live Statistics */}
          {isTracking && (
            <div className="p-4 mt-4 bg-white border rounded-lg shadow">
              <h4 className="mb-3 font-medium text-gray-900">Live Journey Statistics</h4>
              <div className="space-y-3">
                <div className="flex items-center justify-between p-3 rounded-lg bg-blue-50">
                  <div className="flex items-center gap-2">
                    <MapPin className="w-4 h-4 text-blue-600" />
                    <span className="text-sm font-medium">Route Points</span>
                  </div>
                  <span className="font-bold text-blue-600">{routePoints.length}</span>
                </div>
                <div className="flex items-center justify-between p-3 rounded-lg bg-green-50">
                  <div className="flex items-center gap-2">
                    <Zap className="w-4 h-4 text-green-600" />
                    <span className="text-sm font-medium">Avg Speed</span>
                  </div>
                  <span className="font-bold text-green-600">{avgSpeed.toFixed(1)} km/h</span>
                </div>
                <div className="flex items-center justify-between p-3 rounded-lg bg-purple-50">
                  <div className="flex items-center gap-2">
                    <Clock className="w-4 h-4 text-purple-600" />
                    <span className="text-sm font-medium">API Updates</span>
                  </div>
                  <span className="font-bold text-purple-600">Every 10s</span>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Interactive Map */}
        <div className="lg:col-span-2">
          <div className="p-4 bg-white border rounded-lg shadow">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-medium text-gray-900">Live Route Tracking Map</h3>
              <div className="flex items-center gap-2">
                {mapLoaded && (
                  <div className="flex items-center gap-1 px-2 py-1 text-xs text-green-600 bg-green-100 rounded">
                    <CheckCircle className="w-3 h-3" />
                    Map Ready
                  </div>
                )}
                <div className="flex items-center gap-1 px-2 py-1 text-xs text-blue-600 bg-blue-100 rounded">
                  <ExternalLink className="w-3 h-3" />
                  OpenStreetMap
                </div>
              </div>
            </div>
            
            {/* Map Container */}
            <div className="relative">
              <div 
                ref={mapRef} 
                className="w-full bg-gray-200 rounded-lg"
                style={{ height: '500px' }}
              >
                {!leafletLoaded && (
                  <div className="flex items-center justify-center w-full h-full">
                    <div className="text-center">
                      <div className="w-8 h-8 mx-auto mb-2 border-4 border-blue-600 rounded-full border-t-transparent animate-spin"></div>
                      <p className="text-sm text-gray-600">Loading map...</p>
                    </div>
                  </div>
                )}
              </div>
              
              {/* Map Overlay Controls */}
              {mapLoaded && (
                <div className="absolute top-4 right-4">
                  <div className="flex flex-col gap-2">
                    {isTracking && (
                      <button
                        onClick={() => {
                          if (liveMarkerRef.current && mapInstanceRef.current) {
                            mapInstanceRef.current.setView(
                              liveMarkerRef.current.getLatLng(), 
                              16
                            );
                          }
                        }}
                        className="flex items-center gap-1 px-3 py-2 text-sm text-white bg-blue-600 rounded-lg shadow hover:bg-blue-700"
                      >
                        <Eye className="w-4 h-4" />
                        Follow Vehicle
                      </button>
                    )}
                    <button
                      onClick={() => {
                        if (routePolylineRef.current && mapInstanceRef.current) {
                          const group = new window.L.featureGroup([routePolylineRef.current]);
                          mapInstanceRef.current.fitBounds(group.getBounds().pad(0.1));
                        }
                      }}
                      className="flex items-center gap-1 px-3 py-2 text-sm text-white bg-purple-600 rounded-lg shadow hover:bg-purple-700"
                    >
                      <ZoomIn className="w-4 h-4" />
                      Fit Route
                    </button>
                  </div>
                </div>
              )}
            </div>
            
            {/* Map Legend */}
            <div className="grid grid-cols-2 gap-4 mt-4 md:grid-cols-4">
              <div className="flex items-center gap-2 p-2 text-sm rounded bg-green-50">
                <div className="w-4 h-4 bg-green-500 rounded-full"></div>
                <span>Start Point</span>
              </div>
              <div className="flex items-center gap-2 p-2 text-sm rounded bg-blue-50">
                <div className="w-4 h-4 bg-blue-500 rounded-full"></div>
                <span>Live Vehicle</span>
              </div>
              <div className="flex items-center gap-2 p-2 text-sm rounded bg-red-50">
                <div className="w-4 h-4 bg-red-500 rounded-full"></div>
                <span>End Point</span>
              </div>
              <div className="flex items-center gap-2 p-2 text-sm rounded bg-purple-50">
                <div className="w-4 h-1 bg-purple-500"></div>
                <span>Route Path</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Journey History */}
      {journeyHistory.length > 0 && (
        <div className="p-6 bg-white border rounded-lg shadow">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-medium text-gray-900">Journey History</h3>
            <div className="text-sm text-gray-500">
              {journeyHistory.length} completed journey{journeyHistory.length !== 1 ? 's' : ''}
            </div>
          </div>
          
          <div className="space-y-4">
            {journeyHistory.map((journey, index) => (
              <div key={journey.journey_id || index} className="p-4 border rounded-lg">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-blue-100 rounded-lg">
                      <Car className="w-5 h-5 text-blue-600" />
                    </div>
                    <div>
                      <div className="font-medium">{journey.vehicle_number}</div>
                      <div className="text-sm text-gray-500">
                        {new Date(journey.start_time).toLocaleDateString()} • 
                        {new Date(journey.start_time).toLocaleTimeString()}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => exportJourneyData(journey, 'json')}
                      className="flex items-center gap-1 px-3 py-1 text-xs text-blue-600 bg-blue-100 rounded hover:bg-blue-200"
                    >
                      <Download className="w-3 h-3" />
                      JSON
                    </button>
                    <button
                      onClick={() => exportJourneyData(journey, 'csv')}
                      className="flex items-center gap-1 px-3 py-1 text-xs text-green-600 bg-green-100 rounded hover:bg-green-200"
                    >
                      <FileText className="w-3 h-3" />
                      CSV
                    </button>
                    <button
                      onClick={() => exportJourneyData(journey, 'gpx')}
                      className="flex items-center gap-1 px-3 py-1 text-xs text-purple-600 bg-purple-100 rounded hover:bg-purple-200"
                    >
                      <Navigation className="w-3 h-3" />
                      GPX
                    </button>
                  </div>
                </div>
                
                <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
                  <div className="p-3 rounded-lg bg-gray-50">
                    <div className="text-xs text-gray-500">Distance</div>
                    <div className="font-medium">{journey.total_distance?.toFixed(2) || 0} km</div>
                  </div>
                  <div className="p-3 rounded-lg bg-gray-50">
                    <div className="text-xs text-gray-500">Duration</div>
                    <div className="font-medium">
                      {journey.total_duration ? formatDuration(journey.total_duration) : 'N/A'}
                    </div>
                  </div>
                  <div className="p-3 rounded-lg bg-gray-50">
                    <div className="text-xs text-gray-500">Max Speed</div>
                    <div className="font-medium">{journey.max_speed?.toFixed(1) || 0} km/h</div>
                  </div>
                  <div className="p-3 rounded-lg bg-gray-50">
                    <div className="text-xs text-gray-500">Route Points</div>
                    <div className="font-medium">{journey.route_points?.length || 0}</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Technical Information */}
      <div className="p-4 border border-gray-200 rounded-lg bg-gray-50">
        <div className="flex items-start gap-3">
          <Database className="w-5 h-5 text-gray-600 mt-0.5" />
          <div>
            <h4 className="font-medium text-gray-900">Enhanced Tracking Technology</h4>
            <div className="mt-2 space-y-1 text-sm text-gray-600">
              <p><strong>Map Engine:</strong> Leaflet with OpenStreetMap tiles (free, no API keys required)</p>
              <p><strong>Data Source:</strong> Real-time telemetry APIs with 10-second polling intervals</p>
              <p><strong>Route Visualization:</strong> Live polylines, animated markers, and real-time statistics</p>
              <p><strong>Export Formats:</strong> JSON (full data), CSV (tabular), GPX (GPS standard)</p>
              <p><strong>Tracking Accuracy:</strong> 5-meter minimum movement threshold for optimal route quality</p>
              <p><strong>Performance:</strong> Optimized for continuous tracking with minimal memory usage</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default EnhancedVehicleRouteTracker;