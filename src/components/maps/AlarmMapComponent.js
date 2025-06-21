import React, { useState, useEffect, useRef } from 'react';
import { MapPin, AlertTriangle, CheckCircle, Download, X } from 'lucide-react';

const AlarmMapComponent = ({ alarms, onAlarmSelect, onResolveAlarm }) => {
  const mapRef = useRef(null);
  const [mapLoaded, setMapLoaded] = useState(false);
  const [selectedAlarm, setSelectedAlarm] = useState(null);
  const [mapCenter, setMapCenter] = useState({ lat: 28.6139, lng: 77.2090 }); // Delhi default
  const [mapZoom, setMapZoom] = useState(10);

  // Filter alarms with valid coordinates
  const validAlarms = alarms.filter(alarm => 
    alarm.latitude && 
    alarm.longitude && 
    !isNaN(alarm.latitude) && 
    !isNaN(alarm.longitude)
  );

  // Calculate map bounds to fit all alarms
  const calculateMapBounds = () => {
    if (validAlarms.length === 0) return null;

    const lats = validAlarms.map(alarm => alarm.latitude);
    const lngs = validAlarms.map(alarm => alarm.longitude);
    
    return {
      north: Math.max(...lats),
      south: Math.min(...lats),
      east: Math.max(...lngs),
      west: Math.min(...lngs)
    };
  };

  // Get marker color based on severity
  const getMarkerColor = (severity, resolved) => {
    if (resolved) return '#10B981'; // Green for resolved
    
    switch (severity?.toLowerCase()) {
      case 'critical':
        return '#EF4444'; // Red
      case 'high':
        return '#F97316'; // Orange
      case 'medium':
        return '#F59E0B'; // Yellow
      case 'low':
        return '#3B82F6'; // Blue
      default:
        return '#6B7280'; // Gray
    }
  };

  // Initialize map with OpenStreetMap
  useEffect(() => {
    if (!mapRef.current) return;

    // Create a simple map display using canvas
    const canvas = document.createElement('canvas');
    canvas.width = mapRef.current.clientWidth;
    canvas.height = mapRef.current.clientHeight;
    canvas.style.width = '100%';
    canvas.style.height = '100%';
    canvas.style.cursor = 'pointer';
    
    mapRef.current.innerHTML = '';
    mapRef.current.appendChild(canvas);
    
    const ctx = canvas.getContext('2d');
    
    // Simple map rendering function
    const renderMap = () => {
      // Clear canvas
      ctx.fillStyle = '#E5E7EB';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      
      // Draw grid
      ctx.strokeStyle = '#D1D5DB';
      ctx.lineWidth = 1;
      
      for (let i = 0; i < canvas.width; i += 50) {
        ctx.beginPath();
        ctx.moveTo(i, 0);
        ctx.lineTo(i, canvas.height);
        ctx.stroke();
      }
      
      for (let i = 0; i < canvas.height; i += 50) {
        ctx.beginPath();
        ctx.moveTo(0, i);
        ctx.lineTo(canvas.width, i);
        ctx.stroke();
      }
      
      // Calculate bounds
      const bounds = calculateMapBounds();
      if (!bounds) return;
      
      const latRange = bounds.north - bounds.south;
      const lngRange = bounds.east - bounds.west;
      
      // Add padding
      const padding = 0.1;
      const paddedLatRange = latRange * (1 + padding);
      const paddedLngRange = lngRange * (1 + padding);
      
      // Draw alarm markers
      validAlarms.forEach((alarm, index) => {
        // Convert lat/lng to canvas coordinates
        const x = ((alarm.longitude - bounds.west + (paddedLngRange - lngRange) / 2) / paddedLngRange) * canvas.width;
        const y = canvas.height - ((alarm.latitude - bounds.south + (paddedLatRange - latRange) / 2) / paddedLatRange) * canvas.height;
        
        // Draw marker
        const radius = alarm.severity === 'critical' ? 12 : 8;
        const color = getMarkerColor(alarm.severity, alarm.resolved);
        
        // Marker shadow
        ctx.fillStyle = 'rgba(0, 0, 0, 0.2)';
        ctx.beginPath();
        ctx.arc(x + 2, y + 2, radius, 0, 2 * Math.PI);
        ctx.fill();
        
        // Marker
        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.arc(x, y, radius, 0, 2 * Math.PI);
        ctx.fill();
        
        // Marker border
        ctx.strokeStyle = '#FFFFFF';
        ctx.lineWidth = 2;
        ctx.stroke();
        
        // Critical alarm pulse effect
        if (alarm.severity === 'critical' && !alarm.resolved) {
          ctx.strokeStyle = color;
          ctx.lineWidth = 3;
          ctx.globalAlpha = 0.5;
          ctx.beginPath();
          ctx.arc(x, y, radius + 5, 0, 2 * Math.PI);
          ctx.stroke();
          ctx.globalAlpha = 1;
        }
        
        // Store coordinates for click detection
        alarm._mapCoords = { x, y, radius };
      });
      
      // Draw legend
      drawLegend(ctx, canvas);
    };
    
    // Draw legend
    const drawLegend = (ctx, canvas) => {
      const legendItems = [
        { color: '#EF4444', label: 'Critical', count: validAlarms.filter(a => a.severity === 'critical' && !a.resolved).length },
        { color: '#F97316', label: 'High', count: validAlarms.filter(a => a.severity === 'high' && !a.resolved).length },
        { color: '#F59E0B', label: 'Medium', count: validAlarms.filter(a => a.severity === 'medium' && !a.resolved).length },
        { color: '#3B82F6', label: 'Low', count: validAlarms.filter(a => a.severity === 'low' && !a.resolved).length },
        { color: '#10B981', label: 'Resolved', count: validAlarms.filter(a => a.resolved).length }
      ];
      
      const legendX = canvas.width - 150;
      const legendY = 20;
      
      // Legend background
      ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
      ctx.fillRect(legendX - 10, legendY - 10, 140, legendItems.length * 25 + 20);
      ctx.strokeStyle = '#D1D5DB';
      ctx.lineWidth = 1;
      ctx.strokeRect(legendX - 10, legendY - 10, 140, legendItems.length * 25 + 20);
      
      // Legend items
      legendItems.forEach((item, index) => {
        const y = legendY + index * 25;
        
        // Color circle
        ctx.fillStyle = item.color;
        ctx.beginPath();
        ctx.arc(legendX, y, 6, 0, 2 * Math.PI);
        ctx.fill();
        
        // Label
        ctx.fillStyle = '#374151';
        ctx.font = '12px Arial';
        ctx.fillText(`${item.label} (${item.count})`, legendX + 15, y + 4);
      });
    };
    
    // Handle clicks
    const handleClick = (event) => {
      const rect = canvas.getBoundingClientRect();
      const clickX = event.clientX - rect.left;
      const clickY = event.clientY - rect.top;
      
      // Check if click is on any alarm marker
      const clickedAlarm = validAlarms.find(alarm => {
        if (!alarm._mapCoords) return false;
        const distance = Math.sqrt(
          Math.pow(clickX - alarm._mapCoords.x, 2) + 
          Math.pow(clickY - alarm._mapCoords.y, 2)
        );
        return distance <= alarm._mapCoords.radius + 5;
      });
      
      if (clickedAlarm) {
        setSelectedAlarm(clickedAlarm);
        onAlarmSelect && onAlarmSelect(clickedAlarm);
      } else {
        setSelectedAlarm(null);
      }
    };
    
    canvas.addEventListener('click', handleClick);
    
    // Initial render
    renderMap();
    setMapLoaded(true);
    
    // Cleanup
    return () => {
      canvas.removeEventListener('click', handleClick);
    };
  }, [validAlarms]);

  // Download map as image
  const downloadMapImage = () => {
    const canvas = mapRef.current?.querySelector('canvas');
    if (canvas) {
      const link = document.createElement('a');
      link.download = `alarm_map_${new Date().toISOString().split('T')[0]}.png`;
      link.href = canvas.toDataURL();
      link.click();
    }
  };

  return (
    <div className="overflow-hidden bg-white rounded-lg shadow-lg">
      {/* Map Header */}
      <div className="px-6 py-4 border-b border-gray-200 bg-gray-50">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <MapPin className="w-6 h-6 text-blue-600" />
            <div>
              <h3 className="text-lg font-semibold text-gray-900">Alarm Location Map</h3>
              <p className="text-sm text-gray-600">
                Showing {validAlarms.length} alarms with location data
              </p>
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            <button
              onClick={downloadMapImage}
              className="flex items-center gap-2 px-3 py-2 text-sm text-white bg-blue-600 rounded-lg hover:bg-blue-700"
            >
              <Download className="w-4 h-4" />
              Download Map
            </button>
          </div>
        </div>
      </div>

      {/* Map Container */}
      <div className="relative">
        <div 
          ref={mapRef}
          className="relative w-full overflow-hidden bg-gray-100 h-96"
          style={{ minHeight: '400px' }}
        >
          {!mapLoaded && (
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="text-center">
                <div className="w-8 h-8 mx-auto mb-3 border-b-2 border-blue-600 rounded-full animate-spin"></div>
                <p className="text-gray-600">Loading map...</p>
              </div>
            </div>
          )}
        </div>

        {/* Selected Alarm Details Popup */}
        {selectedAlarm && (
          <div className="absolute z-10 max-w-sm p-4 bg-white border border-gray-200 rounded-lg shadow-xl top-4 left-4">
            <div className="flex items-start justify-between mb-3">
              <div className="flex items-center gap-2">
                <div 
                  className="w-3 h-3 rounded-full" 
                  style={{ backgroundColor: getMarkerColor(selectedAlarm.severity, selectedAlarm.resolved) }}
                ></div>
                <h4 className="font-semibold text-gray-900">
                  {selectedAlarm.alarmType || 'Unknown Type'}
                </h4>
              </div>
              <button
                onClick={() => setSelectedAlarm(null)}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            
            <div className="space-y-2 text-sm">
              <div>
                <span className="font-medium text-gray-700">Device ID:</span>
                <span className="ml-2 text-gray-600">{selectedAlarm.device_id}</span>
              </div>
              
              <div>
                <span className="font-medium text-gray-700">Severity:</span>
                <span className={`ml-2 px-2 py-1 text-xs rounded-full ${
                  selectedAlarm.severity === 'critical' ? 'bg-red-100 text-red-800' :
                  selectedAlarm.severity === 'high' ? 'bg-orange-100 text-orange-800' :
                  selectedAlarm.severity === 'medium' ? 'bg-yellow-100 text-yellow-800' :
                  'bg-blue-100 text-blue-800'
                }`}>
                  {selectedAlarm.severity || 'medium'}
                </span>
              </div>
              
              <div>
                <span className="font-medium text-gray-700">Status:</span>
                <span className={`ml-2 px-2 py-1 text-xs rounded-full ${
                  selectedAlarm.resolved ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                }`}>
                  {selectedAlarm.resolved ? 'Resolved' : 'Active'}
                </span>
              </div>
              
              <div>
                <span className="font-medium text-gray-700">Message:</span>
                <p className="mt-1 text-gray-600">{selectedAlarm.message || 'No message available'}</p>
              </div>
              
              <div>
                <span className="font-medium text-gray-700">Time:</span>
                <span className="ml-2 text-gray-600">
                  {new Date(selectedAlarm.timestamp).toLocaleString()}
                </span>
              </div>
              
              <div>
                <span className="font-medium text-gray-700">Location:</span>
                <span className="ml-2 text-gray-600">
                  {selectedAlarm.latitude.toFixed(4)}, {selectedAlarm.longitude.toFixed(4)}
                </span>
              </div>
              
              {selectedAlarm.imageUrl && (
                <div>
                  <span className="font-medium text-gray-700">Image:</span>
                  <button
                    onClick={() => window.open(selectedAlarm.imageUrl, '_blank')}
                    className="ml-2 text-xs text-blue-600 underline hover:text-blue-800"
                  >
                    View Image
                  </button>
                </div>
              )}
            </div>
            
            {!selectedAlarm.resolved && onResolveAlarm && (
              <div className="pt-3 mt-4 border-t border-gray-200">
                <button
                  onClick={() => {
                    onResolveAlarm(selectedAlarm.id);
                    setSelectedAlarm(null);
                  }}
                  className="flex items-center justify-center w-full gap-2 px-3 py-2 text-sm text-white bg-green-600 rounded-lg hover:bg-green-700"
                >
                  <CheckCircle className="w-4 h-4" />
                  Resolve Alarm
                </button>
              </div>
            )}
          </div>
        )}

        {/* No Location Data Message */}
        {validAlarms.length === 0 && (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="text-center">
              <MapPin className="w-12 h-12 mx-auto mb-3 text-gray-300" />
              <p className="font-medium text-gray-600">No alarms with location data</p>
              <p className="mt-1 text-sm text-gray-500">
                Alarms need latitude and longitude coordinates to appear on the map
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Map Stats */}
      <div className="px-6 py-3 border-t border-gray-200 bg-gray-50">
        <div className="grid grid-cols-2 gap-4 text-center md:grid-cols-5">
          <div>
            <p className="text-lg font-bold text-red-600">
              {validAlarms.filter(a => a.severity === 'critical' && !a.resolved).length}
            </p>
            <p className="text-xs text-gray-600">Critical</p>
          </div>
          <div>
            <p className="text-lg font-bold text-orange-600">
              {validAlarms.filter(a => a.severity === 'high' && !a.resolved).length}
            </p>
            <p className="text-xs text-gray-600">High</p>
          </div>
          <div>
            <p className="text-lg font-bold text-yellow-600">
              {validAlarms.filter(a => a.severity === 'medium' && !a.resolved).length}
            </p>
            <p className="text-xs text-gray-600">Medium</p>
          </div>
          <div>
            <p className="text-lg font-bold text-blue-600">
              {validAlarms.filter(a => a.severity === 'low' && !a.resolved).length}
            </p>
            <p className="text-xs text-gray-600">Low</p>
          </div>
          <div>
            <p className="text-lg font-bold text-green-600">
              {validAlarms.filter(a => a.resolved).length}
            </p>
            <p className="text-xs text-gray-600">Resolved</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AlarmMapComponent;