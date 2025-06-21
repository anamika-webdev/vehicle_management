import React, { useState, useEffect, useCallback, useRef } from 'react';
import { AlertTriangle, Download, MapPin, Bell, CheckCircle, X, Filter, Search, Map, RefreshCw, Eye, Calendar, Clock, Camera, Maximize2 } from 'lucide-react';

// Enhanced API Service with Live Stream
class LiveAlarmApiService {
  constructor() {
    this.baseURL = 'http://164.52.194.198:9090';
    this.eventSource = null;
    this.listeners = new Set();
  }

  // Start live alarm stream
  startLiveStream(onAlarmReceived) {
    try {
      if (this.eventSource) {
        this.eventSource.close();
      }

      console.log('🔴 Starting live alarm stream...');
      this.eventSource = new EventSource(`${this.baseURL}/alarm/v1/stream`);
      
      this.eventSource.onopen = () => {
        console.log('✅ Live alarm stream connected');
      };

      this.eventSource.onmessage = (event) => {
        try {
          const alarmData = JSON.parse(event.data);
          console.log('🚨 New live alarm received:', alarmData);
          
          // Transform the alarm data to match our format
          const transformedAlarm = {
            id: alarmData.alarmId || alarmData.id || `live_${Date.now()}`,
            device_id: alarmData.deviceId || alarmData.device_id,
            alarmType: alarmData.alarmType || alarmData.type || 'Live Alert',
            severity: alarmData.severity || 'medium',
            status: alarmData.status || 'active',
            message: alarmData.message || alarmData.description || 'Live alarm detected',
            timestamp: alarmData.timestamp || new Date().toISOString(),
            latitude: alarmData.latitude ? parseFloat(alarmData.latitude) : null,
            longitude: alarmData.longitude ? parseFloat(alarmData.longitude) : null,
            imageUrl: alarmData.imageUrl || alarmData.image_url,
            resolved: false,
            isLive: true
          };

          onAlarmReceived(transformedAlarm);
        } catch (error) {
          console.error('❌ Error parsing live alarm data:', error);
        }
      };

      this.eventSource.onerror = (error) => {
        console.error('❌ Live alarm stream error:', error);
        // Attempt to reconnect after 5 seconds
        setTimeout(() => {
          if (this.eventSource?.readyState === EventSource.CLOSED) {
            console.log('🔄 Attempting to reconnect live stream...');
            this.startLiveStream(onAlarmReceived);
          }
        }, 5000);
      };

    } catch (error) {
      console.error('❌ Failed to start live stream:', error);
    }
  }

  // Stop live stream
  stopLiveStream() {
    if (this.eventSource) {
      console.log('🛑 Stopping live alarm stream');
      this.eventSource.close();
      this.eventSource = null;
    }
  }

  async getAllDevices() {
    try {
      const response = await fetch(`${this.baseURL}/device/v1/all`, {
        headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' }
      });
      const data = await response.json();
      return Array.isArray(data) ? data : (data.data || []);
    } catch (error) {
      console.error('Failed to fetch devices:', error);
      return [];
    }
  }

  async getDeviceAlarms(deviceId, page = 0, size = 20) {
    try {
      const response = await fetch(
        `${this.baseURL}/alarm/v1/device/${deviceId}?page=${page}&size=${size}&sortBy=deviceId&direction=asc`,
        { headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' } }
      );
      if (!response.ok) return [];
      
      const data = await response.json();
      const alarms = Array.isArray(data) ? data : (data.data || []);
      
      return alarms.map(alarm => ({
        ...alarm,
        id: alarm.alarmId || alarm.id || `${deviceId}_${Date.now()}`,
        device_id: deviceId,
        severity: alarm.severity || 'medium',
        status: alarm.status || 'active',
        timestamp: alarm.timestamp || alarm.createdAt || new Date().toISOString(),
        latitude: alarm.latitude ? parseFloat(alarm.latitude) : null,
        longitude: alarm.longitude ? parseFloat(alarm.longitude) : null,
        imageUrl: alarm.imageUrl || alarm.image_url,
        resolved: alarm.resolved || false,
        alarmType: alarm.alarmType || alarm.type || 'Unknown',
        message: alarm.message || alarm.description || 'No description',
        isLive: false
      }));
    } catch (error) {
      console.error(`Failed to fetch alarms for device ${deviceId}:`, error);
      return [];
    }
  }

  async getAllAlarms() {
    const devices = await this.getAllDevices();
    if (devices.length === 0) return [];

    const alarmPromises = devices.map(device => {
      const deviceId = device.deviceId || device.device_id || device.id;
      return this.getDeviceAlarms(deviceId, 0, 50);
    });

    const results = await Promise.allSettled(alarmPromises);
    return results
      .filter(result => result.status === 'fulfilled')
      .flatMap(result => result.value)
      .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
  }
}

// Integrated Map Component
const IntegratedAlarmMap = ({ alarms, onAlarmSelect, onResolveAlarm, isVisible }) => {
  const mapRef = useRef(null);
  const [selectedAlarm, setSelectedAlarm] = useState(null);

  // Filter alarms with valid coordinates
  const validAlarms = alarms.filter(alarm => 
    alarm.latitude && 
    alarm.longitude && 
    !isNaN(alarm.latitude) && 
    !isNaN(alarm.longitude)
  );

  // Get marker color based on severity
  const getMarkerColor = (severity, resolved, isLive) => {
    if (resolved) return '#10B981'; // Green for resolved
    if (isLive) return '#8B5CF6'; // Purple for live alarms
    
    switch (severity?.toLowerCase()) {
      case 'critical': return '#EF4444'; // Red
      case 'high': return '#F97316'; // Orange
      case 'medium': return '#F59E0B'; // Yellow
      case 'low': return '#3B82F6'; // Blue
      default: return '#6B7280'; // Gray
    }
  };

  useEffect(() => {
    if (!mapRef.current || !isVisible) return;

    const canvas = document.createElement('canvas');
    canvas.width = mapRef.current.clientWidth;
    canvas.height = mapRef.current.clientHeight;
    canvas.style.width = '100%';
    canvas.style.height = '100%';
    canvas.style.cursor = 'pointer';
    
    mapRef.current.innerHTML = '';
    mapRef.current.appendChild(canvas);
    
    const ctx = canvas.getContext('2d');
    
    const renderMap = () => {
      // Clear canvas
      ctx.fillStyle = '#F3F4F6';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      
      // Draw grid
      ctx.strokeStyle = '#E5E7EB';
      ctx.lineWidth = 1;
      
      for (let i = 0; i < canvas.width; i += 40) {
        ctx.beginPath();
        ctx.moveTo(i, 0);
        ctx.lineTo(i, canvas.height);
        ctx.stroke();
      }
      
      for (let i = 0; i < canvas.height; i += 40) {
        ctx.beginPath();
        ctx.moveTo(0, i);
        ctx.lineTo(canvas.width, i);
        ctx.stroke();
      }
      
      if (validAlarms.length === 0) return;
      
      // Calculate bounds
      const lats = validAlarms.map(alarm => alarm.latitude);
      const lngs = validAlarms.map(alarm => alarm.longitude);
      const bounds = {
        north: Math.max(...lats),
        south: Math.min(...lats),
        east: Math.max(...lngs),
        west: Math.min(...lngs)
      };
      
      const latRange = bounds.north - bounds.south;
      const lngRange = bounds.east - bounds.west;
      const padding = 0.1;
      const paddedLatRange = latRange * (1 + padding);
      const paddedLngRange = lngRange * (1 + padding);
      
      // Draw alarm markers
      validAlarms.forEach((alarm, index) => {
        const x = ((alarm.longitude - bounds.west + (paddedLngRange - lngRange) / 2) / paddedLngRange) * canvas.width;
        const y = canvas.height - ((alarm.latitude - bounds.south + (paddedLatRange - latRange) / 2) / paddedLatRange) * canvas.height;
        
        const radius = alarm.severity === 'critical' ? 14 : alarm.isLive ? 12 : 10;
        const color = getMarkerColor(alarm.severity, alarm.resolved, alarm.isLive);
        
        // Marker shadow
        ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
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
        ctx.lineWidth = 3;
        ctx.stroke();
        
        // Live alarm pulse effect
        if (alarm.isLive && !alarm.resolved) {
          ctx.strokeStyle = color;
          ctx.lineWidth = 2;
          ctx.globalAlpha = 0.6;
          ctx.beginPath();
          ctx.arc(x, y, radius + 8 + (Date.now() % 2000) / 100, 0, 2 * Math.PI);
          ctx.stroke();
          ctx.globalAlpha = 1;
        }
        
        // Critical alarm pulse effect
        if (alarm.severity === 'critical' && !alarm.resolved) {
          ctx.strokeStyle = color;
          ctx.lineWidth = 2;
          ctx.globalAlpha = 0.4;
          ctx.beginPath();
          ctx.arc(x, y, radius + 6, 0, 2 * Math.PI);
          ctx.stroke();
          ctx.globalAlpha = 1;
        }
        
        // Store coordinates for click detection
        alarm._mapCoords = { x, y, radius };
      });
      
      // Draw legend
      const legendItems = [
        { color: '#8B5CF6', label: 'Live', count: validAlarms.filter(a => a.isLive && !a.resolved).length },
        { color: '#EF4444', label: 'Critical', count: validAlarms.filter(a => a.severity === 'critical' && !a.resolved).length },
        { color: '#F97316', label: 'High', count: validAlarms.filter(a => a.severity === 'high' && !a.resolved).length },
        { color: '#F59E0B', label: 'Medium', count: validAlarms.filter(a => a.severity === 'medium' && !a.resolved).length },
        { color: '#3B82F6', label: 'Low', count: validAlarms.filter(a => a.severity === 'low' && !a.resolved).length },
        { color: '#10B981', label: 'Resolved', count: validAlarms.filter(a => a.resolved).length }
      ];
      
      const legendX = canvas.width - 160;
      const legendY = 20;
      
      // Legend background
      ctx.fillStyle = 'rgba(255, 255, 255, 0.95)';
      ctx.fillRect(legendX - 10, legendY - 10, 150, legendItems.length * 25 + 20);
      ctx.strokeStyle = '#D1D5DB';
      ctx.lineWidth = 1;
      ctx.strokeRect(legendX - 10, legendY - 10, 150, legendItems.length * 25 + 20);
      
      legendItems.forEach((item, index) => {
        if (item.count === 0) return;
        const y = legendY + index * 25;
        
        ctx.fillStyle = item.color;
        ctx.beginPath();
        ctx.arc(legendX, y, 6, 0, 2 * Math.PI);
        ctx.fill();
        
        ctx.fillStyle = '#374151';
        ctx.font = '12px Arial';
        ctx.fillText(`${item.label} (${item.count})`, legendX + 15, y + 4);
      });
    };
    
    const handleClick = (event) => {
      const rect = canvas.getBoundingClientRect();
      const clickX = event.clientX - rect.left;
      const clickY = event.clientY - rect.top;
      
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
    
    const animationFrame = () => {
      renderMap();
      requestAnimationFrame(animationFrame);
    };
    animationFrame();
    
    return () => {
      canvas.removeEventListener('click', handleClick);
    };
  }, [validAlarms, isVisible]);

  if (!isVisible) return null;

  return (
    <div className="overflow-hidden bg-white rounded-lg shadow-lg">
      <div className="px-6 py-4 border-b border-gray-200 bg-gradient-to-r from-blue-50 to-indigo-50">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <MapPin className="w-6 h-6 text-blue-600" />
            <div>
              <h3 className="text-lg font-semibold text-gray-900">Live Alarm Location Map</h3>
              <p className="text-sm text-gray-600">
                Real-time view of {validAlarms.length} alarms with location data
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1 text-sm text-green-600">
              <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
              Live Updates
            </div>
          </div>
        </div>
      </div>

      <div className="relative">
        <div 
          ref={mapRef}
          className="relative w-full overflow-hidden bg-gray-100 h-96"
          style={{ minHeight: '400px' }}
        >
          {validAlarms.length === 0 && (
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="text-center">
                <MapPin className="w-12 h-12 mx-auto mb-3 text-gray-300" />
                <p className="font-medium text-gray-600">No alarms with location data</p>
                <p className="mt-1 text-sm text-gray-500">
                  Alarms will appear here when they include GPS coordinates
                </p>
              </div>
            </div>
          )}
        </div>

        {selectedAlarm && (
          <div className="absolute z-10 max-w-sm p-4 bg-white border border-gray-200 rounded-lg shadow-xl top-4 left-4">
            <div className="flex items-start justify-between mb-3">
              <div className="flex items-center gap-2">
                <div 
                  className={`w-3 h-3 rounded-full ${selectedAlarm.isLive ? 'animate-pulse' : ''}`}
                  style={{ backgroundColor: getMarkerColor(selectedAlarm.severity, selectedAlarm.resolved, selectedAlarm.isLive) }}
                ></div>
                <h4 className="font-semibold text-gray-900">
                  {selectedAlarm.isLive && '🔴 '}
                  {selectedAlarm.alarmType}
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
                <span className="font-medium text-gray-700">Device:</span>
                <span className="ml-2 text-gray-600">{selectedAlarm.device_id}</span>
              </div>
              
              <div>
                <span className="font-medium text-gray-700">Status:</span>
                <span className={`ml-2 px-2 py-1 text-xs rounded-full ${
                  selectedAlarm.isLive ? 'bg-purple-100 text-purple-800' :
                  selectedAlarm.resolved ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                }`}>
                  {selectedAlarm.isLive ? 'Live' : selectedAlarm.resolved ? 'Resolved' : 'Active'}
                </span>
              </div>
              
              <div>
                <span className="font-medium text-gray-700">Message:</span>
                <p className="mt-1 text-gray-600">{selectedAlarm.message}</p>
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
      </div>
    </div>
  );
};

// Main Enhanced Live Alarm Management Component
const EnhancedLiveAlarmManagement = () => {
  const [alarms, setAlarms] = useState([]);
  const [loading, setLoading] = useState(false);
  const [criticalAlarmPopup, setCriticalAlarmPopup] = useState(null);
  const [filterType, setFilterType] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedAlarms, setSelectedAlarms] = useState([]);
  const [showMap, setShowMap] = useState(false);
  const [lastRefresh, setLastRefresh] = useState(new Date());
  const [liveStreamActive, setLiveStreamActive] = useState(false);
  const [viewMode, setViewMode] = useState('table');

  const apiService = useRef(new LiveAlarmApiService()).current;

  // Handle new live alarm
  const handleLiveAlarm = useCallback((newAlarm) => {
    console.log('🚨 Processing live alarm:', newAlarm);
    
    setAlarms(prev => {
      // Check if alarm already exists
      const existingIndex = prev.findIndex(alarm => alarm.id === newAlarm.id);
      if (existingIndex !== -1) {
        // Update existing alarm
        const updated = [...prev];
        updated[existingIndex] = newAlarm;
        return updated;
      } else {
        // Add new alarm at the beginning
        return [newAlarm, ...prev];
      }
    });

    // Show critical alarm popup for live critical alarms
    if (newAlarm.severity === 'critical' && !newAlarm.resolved) {
      setCriticalAlarmPopup(newAlarm);
    }
  }, []);

  // Start/Stop live stream
  const toggleLiveStream = useCallback(() => {
    if (liveStreamActive) {
      apiService.stopLiveStream();
      setLiveStreamActive(false);
    } else {
      apiService.startLiveStream(handleLiveAlarm);
      setLiveStreamActive(true);
    }
  }, [liveStreamActive, apiService, handleLiveAlarm]);

  // Fetch historical alarms
  const fetchHistoricalAlarms = useCallback(async () => {
    setLoading(true);
    try {
      const historicalAlarms = await apiService.getAllAlarms();
      setAlarms(prev => {
        // Merge with live alarms, avoiding duplicates
        const liveAlarms = prev.filter(alarm => alarm.isLive);
        const allAlarms = [...liveAlarms, ...historicalAlarms];
        
        // Remove duplicates by ID
        const uniqueAlarms = allAlarms.filter((alarm, index, self) => 
          index === self.findIndex(a => a.id === alarm.id)
        );
        
        return uniqueAlarms.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
      });
      setLastRefresh(new Date());
    } catch (error) {
      console.error('Failed to fetch historical alarms:', error);
    } finally {
      setLoading(false);
    }
  }, [apiService]);

  // Resolve alarm
  const resolveAlarm = useCallback(async (alarmId) => {
    setAlarms(prev => prev.map(alarm => 
      alarm.id === alarmId ? { ...alarm, resolved: true, status: 'resolved' } : alarm
    ));

    if (criticalAlarmPopup?.id === alarmId) {
      setCriticalAlarmPopup(null);
    }
  }, [criticalAlarmPopup]);

  // Download alarm data
  const downloadAlarmData = useCallback((alarmsToDownload = null) => {
    const dataToDownload = alarmsToDownload || alarms;
    if (dataToDownload.length === 0) {
      alert('No alarms to download');
      return;
    }

    const csvHeaders = [
      'Alarm ID', 'Device ID', 'Type', 'Severity', 'Message', 'Timestamp',
      'Status', 'Latitude', 'Longitude', 'Image URL', 'Resolved', 'Live Alarm'
    ];

    const csvRows = dataToDownload.map(alarm => [
      alarm.id, alarm.device_id, alarm.alarmType, alarm.severity,
      (alarm.message || '').replace(/,/g, ';'), alarm.timestamp,
      alarm.status, alarm.latitude || '', alarm.longitude || '',
      alarm.imageUrl || '', alarm.resolved ? 'Yes' : 'No', alarm.isLive ? 'Yes' : 'No'
    ]);

    const csvContent = [csvHeaders, ...csvRows]
      .map(row => row.map(cell => `"${cell}"`).join(','))
      .join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `alarms_${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
    URL.revokeObjectURL(link.href);
  }, [alarms]);

  // Filter alarms
  const filteredAlarms = alarms.filter(alarm => {
    const matchesFilter = filterType === 'all' || 
      (filterType === 'critical' && alarm.severity === 'critical') ||
      (filterType === 'active' && !alarm.resolved) ||
      (filterType === 'resolved' && alarm.resolved) ||
      (filterType === 'live' && alarm.isLive);
    
    const matchesSearch = !searchTerm || 
      alarm.message?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      alarm.alarmType?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      alarm.device_id?.toString().includes(searchTerm);
    
    return matchesFilter && matchesSearch;
  });

  // Get severity styling
  const getSeverityColor = (severity, resolved = false, isLive = false) => {
    if (resolved) return 'bg-green-100 text-green-800 border-green-200';
    if (isLive) return 'bg-purple-100 text-purple-800 border-purple-200';
    
    switch (severity?.toLowerCase()) {
      case 'critical': return 'bg-red-100 text-red-800 border-red-200';
      case 'high': return 'bg-orange-100 text-orange-800 border-orange-200';
      case 'medium': return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'low': return 'bg-blue-100 text-blue-800 border-blue-200';
      default: return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  // Initialize
  useEffect(() => {
    fetchHistoricalAlarms();
    // Auto-start live stream
    toggleLiveStream();
    
    return () => {
      apiService.stopLiveStream();
    };
  }, []);

  return (
    <div className="min-h-screen p-6 bg-gray-50">
      {/* Critical Alarm Popup */}
      {criticalAlarmPopup && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
          <div className="w-full max-w-md p-6 mx-4 bg-white border-2 border-red-500 rounded-lg shadow-2xl">
            <div className="flex items-center gap-3 mb-4">
              <AlertTriangle className="w-8 h-8 text-red-600 animate-bounce" />
              <h2 className="text-xl font-bold text-red-800">
                🚨 {criticalAlarmPopup.isLive ? 'LIVE ' : ''}CRITICAL ALARM
              </h2>
              <button
                onClick={() => setCriticalAlarmPopup(null)}
                className="ml-auto text-gray-500 hover:text-gray-700"
              >
                <X className="w-6 h-6" />
              </button>
            </div>
            
            <div className="space-y-3">
              <div className="p-3 border border-red-200 rounded-lg bg-red-50">
                <p className="font-semibold text-gray-900">Device: {criticalAlarmPopup.device_id}</p>
                <p className="text-gray-700">Type: {criticalAlarmPopup.alarmType}</p>
                <p className="text-gray-700">Message: {criticalAlarmPopup.message}</p>
                <p className="text-sm text-gray-500">
                  Time: {new Date(criticalAlarmPopup.timestamp).toLocaleString()}
                </p>
              </div>
              
              {(criticalAlarmPopup.latitude && criticalAlarmPopup.longitude) && (
                <div className="flex items-center gap-2 p-2 rounded bg-blue-50">
                  <MapPin className="w-4 h-4 text-blue-600" />
                  <span className="text-sm text-blue-800">
                    📍 {criticalAlarmPopup.latitude.toFixed(4)}, {criticalAlarmPopup.longitude.toFixed(4)}
                  </span>
                </div>
              )}
            </div>
            
            <div className="flex gap-3 mt-6">
              <button
                onClick={() => resolveAlarm(criticalAlarmPopup.id)}
                className="flex items-center justify-center flex-1 gap-2 px-4 py-2 font-semibold text-white bg-green-600 rounded-lg hover:bg-green-700"
              >
                <CheckCircle className="w-4 h-4" />
                Resolve Now
              </button>
              <button
                onClick={() => setCriticalAlarmPopup(null)}
                className="flex-1 px-4 py-2 text-white bg-gray-600 rounded-lg hover:bg-gray-700"
              >
                Dismiss
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col justify-between gap-4 mb-6 lg:flex-row lg:items-center">
        <div>
          <h1 className="flex items-center gap-3 text-3xl font-bold text-gray-900">
            🚨 Alarm Management System
          </h1>
          <p className="mt-1 text-gray-600">
            Real-time monitoring and management of device alarms
          </p>
          <div className="flex items-center gap-4 mt-2 text-sm text-gray-500">
            <div className="flex items-center gap-1">
              <Clock className="w-4 h-4" />
              Last updated: {lastRefresh.toLocaleTimeString()}
            </div>
            <div className="flex items-center gap-1">
              <div className={`w-2 h-2 rounded-full ${liveStreamActive ? 'bg-green-500 animate-pulse' : 'bg-gray-300'}`}></div>
              Live Stream {liveStreamActive ? 'ACTIVE' : 'INACTIVE'}
            </div>
          </div>
        </div>
        
        <div className="flex flex-wrap items-center gap-3">
          <button
            onClick={toggleLiveStream}
            className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium ${
              liveStreamActive 
                ? 'bg-green-100 text-green-700 border border-green-300' 
                : 'bg-red-100 text-red-700 border border-red-300'
            }`}
          >
            <div className={`w-2 h-2 rounded-full ${liveStreamActive ? 'bg-green-500 animate-pulse' : 'bg-red-500'}`}></div>
            {liveStreamActive ? 'Live ON' : 'Live OFF'}
          </button>
          
          <button
            onClick={() => setViewMode(viewMode === 'table' ? 'cards' : 'table')}
            className="flex items-center gap-2 px-3 py-2 text-sm text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200"
          >
            <Eye className="w-4 h-4" />
            {viewMode === 'table' ? 'Card View' : 'Table View'}
          </button>
          
          <button
            onClick={() => setShowMap(!showMap)}
            className="flex items-center gap-2 px-4 py-2 text-white bg-blue-600 rounded-lg hover:bg-blue-700"
          >
            <Map className="w-4 h-4" />
            {showMap ? 'Hide Map' : 'Show Map'}
          </button>
          
          <button
            onClick={() => downloadAlarmData(selectedAlarms.length > 0 ? selectedAlarms : null)}
            className="flex items-center gap-2 px-4 py-2 text-white bg-green-600 rounded-lg hover:bg-green-700"
          >
            <Download className="w-4 h-4" />
            Download ({selectedAlarms.length > 0 ? selectedAlarms.length : 'All'})
          </button>
          
          <button
            onClick={fetchHistoricalAlarms}
            disabled={loading}
            className="flex items-center gap-2 px-4 py-2 text-white bg-purple-600 rounded-lg hover:bg-purple-700 disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>
      </div>

      {/* Statistics Cards */}
      <div className="grid grid-cols-1 gap-4 mb-6 md:grid-cols-2 lg:grid-cols-6">
        {[
          { label: 'Total Alarms', count: alarms.length, color: 'text-gray-600', icon: Bell },
          { label: 'Live Alarms', count: alarms.filter(a => a.isLive && !a.resolved).length, color: 'text-purple-600', icon: Bell },
          { label: 'Critical', count: alarms.filter(a => a.severity === 'critical' && !a.resolved).length, color: 'text-red-600', icon: AlertTriangle },
          { label: 'Active', count: alarms.filter(a => !a.resolved).length, color: 'text-orange-600', icon: AlertTriangle },
          { label: 'Resolved', count: alarms.filter(a => a.resolved).length, color: 'text-green-600', icon: CheckCircle },
          { label: 'With Location', count: alarms.filter(a => a.latitude && a.longitude).length, color: 'text-blue-600', icon: MapPin }
        ].map((stat, index) => (
          <div key={index} className="p-4 transition-shadow bg-white rounded-lg shadow hover:shadow-lg">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-gray-600">{stat.label}</p>
                <p className={`text-xl font-bold ${stat.color}`}>{stat.count}</p>
              </div>
              <stat.icon className={`w-6 h-6 ${stat.color.replace('text-', 'text-').replace('-600', '-400')}`} />
            </div>
          </div>
        ))}
      </div>

      {/* Integrated Map */}
      {showMap && (
        <div className="mb-6">
          <IntegratedAlarmMap
            alarms={alarms}
            onAlarmSelect={(alarm) => console.log('Selected alarm:', alarm)}
            onResolveAlarm={resolveAlarm}
            isVisible={showMap}
          />
        </div>
      )}

      {/* Filters */}
      <div className="p-6 mb-6 bg-white rounded-lg shadow">
        <div className="flex flex-col items-center gap-4 sm:flex-row">
          <div className="flex items-center gap-2">
            <Filter className="w-5 h-5 text-gray-500" />
            <select
              value={filterType}
              onChange={(e) => setFilterType(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="all">All Alarms</option>
              <option value="live">Live Alarms</option>
              <option value="critical">Critical Only</option>
              <option value="active">Active Only</option>
              <option value="resolved">Resolved Only</option>
            </select>
          </div>
          
          <div className="flex items-center flex-1 max-w-md gap-2">
            <Search className="w-5 h-5 text-gray-500" />
            <input
              type="text"
              placeholder="Search alarms by message, type, or device..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>
          
          <div className="text-sm text-gray-600 whitespace-nowrap">
            Showing {filteredAlarms.length} of {alarms.length} alarms
          </div>
        </div>
      </div>

      {/* Alarms Display */}
      <div className="overflow-hidden bg-white rounded-lg shadow">
        {viewMode === 'table' ? (
          /* Table View */
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-xs font-medium tracking-wider text-left text-gray-500 uppercase">
                    <input
                      type="checkbox"
                      onChange={(e) => {
                        if (e.target.checked) {
                          setSelectedAlarms(filteredAlarms);
                        } else {
                          setSelectedAlarms([]);
                        }
                      }}
                      checked={selectedAlarms.length === filteredAlarms.length && filteredAlarms.length > 0}
                    />
                  </th>
                  <th className="px-6 py-3 text-xs font-medium tracking-wider text-left text-gray-500 uppercase">
                    Device ID
                  </th>
                  <th className="px-6 py-3 text-xs font-medium tracking-wider text-left text-gray-500 uppercase">
                    Type
                  </th>
                  <th className="px-6 py-3 text-xs font-medium tracking-wider text-left text-gray-500 uppercase">
                    Severity
                  </th>
                  <th className="px-6 py-3 text-xs font-medium tracking-wider text-left text-gray-500 uppercase">
                    Message
                  </th>
                  <th className="px-6 py-3 text-xs font-medium tracking-wider text-left text-gray-500 uppercase">
                    Timestamp
                  </th>
                  <th className="px-6 py-3 text-xs font-medium tracking-wider text-left text-gray-500 uppercase">
                    Location
                  </th>
                  <th className="px-6 py-3 text-xs font-medium tracking-wider text-left text-gray-500 uppercase">
                    Image
                  </th>
                  <th className="px-6 py-3 text-xs font-medium tracking-wider text-left text-gray-500 uppercase">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {loading ? (
                  <tr>
                    <td colSpan="9" className="px-6 py-12 text-center">
                      <div className="flex items-center justify-center">
                        <div className="w-8 h-8 border-b-2 border-blue-600 rounded-full animate-spin"></div>
                        <span className="ml-3 text-gray-600">Loading alarms...</span>
                      </div>
                    </td>
                  </tr>
                ) : filteredAlarms.length === 0 ? (
                  <tr>
                    <td colSpan="9" className="px-6 py-12 text-center">
                      <div className="text-center">
                        <AlertTriangle className="w-12 h-12 mx-auto mb-3 text-gray-300" />
                        <p className="font-medium text-gray-500">No alarms found</p>
                        <p className="mt-1 text-sm text-gray-400">
                          {searchTerm || filterType !== 'all' 
                            ? 'Try adjusting your search or filters' 
                            : 'All systems are running normally'}
                        </p>
                      </div>
                    </td>
                  </tr>
                ) : (
                  filteredAlarms.map((alarm) => (
                    <tr 
                      key={alarm.id} 
                      className={`hover:bg-gray-50 transition-colors ${
                        alarm.resolved ? 'opacity-60' : ''
                      } ${alarm.severity === 'critical' && !alarm.resolved ? 'bg-red-50 border-l-4 border-red-500' : ''
                      } ${alarm.isLive ? 'bg-purple-50 border-l-4 border-purple-500' : ''}`}
                    >
                      <td className="px-6 py-4 whitespace-nowrap">
                        <input
                          type="checkbox"
                          checked={selectedAlarms.includes(alarm)}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setSelectedAlarms([...selectedAlarms, alarm]);
                            } else {
                              setSelectedAlarms(selectedAlarms.filter(a => a.id !== alarm.id));
                            }
                          }}
                        />
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center">
                          <div className="text-sm font-medium text-gray-900">{alarm.device_id}</div>
                          {alarm.isLive && (
                            <div className="w-2 h-2 ml-2 bg-purple-500 rounded-full animate-pulse" title="Live Alarm"></div>
                          )}
                          {alarm.severity === 'critical' && !alarm.resolved && (
                            <div className="w-2 h-2 ml-2 bg-red-500 rounded-full animate-pulse" title="Critical Alarm"></div>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-900 whitespace-nowrap">
                        <div className="flex items-center gap-1">
                          {alarm.isLive && <span className="text-purple-600">🔴</span>}
                          {alarm.alarmType}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full border ${getSeverityColor(alarm.severity, alarm.resolved, alarm.isLive)}`}>
                          {alarm.isLive ? 'Live' : alarm.resolved ? 'Resolved' : alarm.severity}
                        </span>
                      </td>
                      <td className="max-w-xs px-6 py-4 text-sm text-gray-900">
                        <div className="truncate" title={alarm.message}>
                          {alarm.message}
                        </div>
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-500 whitespace-nowrap">
                        <div className="flex flex-col">
                          <span>{new Date(alarm.timestamp).toLocaleDateString()}</span>
                          <span className="text-xs text-gray-400">
                            {new Date(alarm.timestamp).toLocaleTimeString()}
                          </span>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-500 whitespace-nowrap">
                        {(alarm.latitude && alarm.longitude) ? (
                          <div className="flex items-center gap-1">
                            <MapPin className="w-4 h-4 text-blue-500" />
                            <div className="text-xs">
                              <div>{alarm.latitude.toFixed(4)}</div>
                              <div>{alarm.longitude.toFixed(4)}</div>
                            </div>
                          </div>
                        ) : (
                          <span className="text-gray-400">No location</span>
                        )}
                      </td>
                      <td className="px-6 py-4 text-sm whitespace-nowrap">
                        {alarm.imageUrl ? (
                          <button
                            onClick={() => window.open(alarm.imageUrl, '_blank')}
                            className="flex items-center gap-1 text-blue-600 underline hover:text-blue-800"
                          >
                            <Camera className="w-4 h-4" />
                            View
                          </button>
                        ) : (
                          <span className="flex items-center gap-1 text-gray-400">
                            <Camera className="w-4 h-4" />
                            None
                          </span>
                        )}
                      </td>
                      <td className="px-6 py-4 text-sm font-medium whitespace-nowrap">
                        {!alarm.resolved ? (
                          <button
                            onClick={() => resolveAlarm(alarm.id)}
                            className="flex items-center gap-1 px-3 py-1 text-xs text-white transition-colors bg-green-600 rounded hover:bg-green-700"
                          >
                            <CheckCircle className="w-3 h-3" />
                            Resolve
                          </button>
                        ) : (
                          <span className="flex items-center gap-1 text-xs text-green-600">
                            <CheckCircle className="w-3 h-3" />
                            Resolved
                          </span>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        ) : (
          /* Card View */
          <div className="p-6">
            {loading ? (
              <div className="flex items-center justify-center py-12">
                <div className="w-8 h-8 border-b-2 border-blue-600 rounded-full animate-spin"></div>
                <span className="ml-3 text-gray-600">Loading alarms...</span>
              </div>
            ) : filteredAlarms.length === 0 ? (
              <div className="py-12 text-center">
                <AlertTriangle className="w-12 h-12 mx-auto mb-3 text-gray-300" />
                <p className="font-medium text-gray-500">No alarms found</p>
                <p className="mt-1 text-sm text-gray-400">
                  {searchTerm || filterType !== 'all' 
                    ? 'Try adjusting your search or filters' 
                    : 'All systems are running normally'}
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
                {filteredAlarms.map((alarm) => (
                  <div 
                    key={alarm.id} 
                    className={`border rounded-lg p-4 hover:shadow-lg transition-all ${
                      alarm.resolved ? 'opacity-60 bg-gray-50' : 'bg-white'
                    } ${alarm.severity === 'critical' && !alarm.resolved ? 'border-red-500 shadow-red-100' : 
                         alarm.isLive ? 'border-purple-500 shadow-purple-100' : 'border-gray-200'}`}
                  >
                    {/* Card Header */}
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          checked={selectedAlarms.includes(alarm)}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setSelectedAlarms([...selectedAlarms, alarm]);
                            } else {
                              setSelectedAlarms(selectedAlarms.filter(a => a.id !== alarm.id));
                            }
                          }}
                          className="rounded"
                        />
                        <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full border ${getSeverityColor(alarm.severity, alarm.resolved, alarm.isLive)}`}>
                          {alarm.isLive ? 'Live' : alarm.resolved ? 'Resolved' : alarm.severity}
                        </span>
                        {alarm.isLive && (
                          <div className="w-2 h-2 bg-purple-500 rounded-full animate-pulse"></div>
                        )}
                        {alarm.severity === 'critical' && !alarm.resolved && (
                          <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse"></div>
                        )}
                      </div>
                    </div>

                    {/* Card Content */}
                    <div className="space-y-3">
                      <div>
                        <h3 className="flex items-center gap-2 text-lg font-semibold text-gray-900">
                          {alarm.isLive && <span className="text-purple-600">🔴</span>}
                          {alarm.alarmType}
                        </h3>
                        <p className="mt-1 text-sm text-gray-600">{alarm.message}</p>
                      </div>

                      <div className="grid grid-cols-2 gap-2 text-sm">
                        <div>
                          <span className="font-medium text-gray-700">Device:</span>
                          <p className="text-gray-600">{alarm.device_id}</p>
                        </div>
                        <div>
                          <span className="font-medium text-gray-700">Status:</span>
                          <p className={`${
                            alarm.isLive ? 'text-purple-600' :
                            alarm.resolved ? 'text-green-600' : 'text-red-600'
                          }`}>
                            {alarm.isLive ? 'Live' : alarm.resolved ? 'Resolved' : 'Active'}
                          </p>
                        </div>
                      </div>

                      <div className="text-sm">
                        <span className="font-medium text-gray-700">Time:</span>
                        <p className="text-gray-600">
                          {new Date(alarm.timestamp).toLocaleString()}
                        </p>
                      </div>

                      {(alarm.latitude && alarm.longitude) && (
                        <div className="text-sm">
                          <span className="flex items-center gap-1 font-medium text-gray-700">
                            <MapPin className="w-4 h-4" />
                            Location:
                          </span>
                          <p className="text-gray-600">
                            {alarm.latitude.toFixed(4)}, {alarm.longitude.toFixed(4)}
                          </p>
                        </div>
                      )}

                      {alarm.imageUrl && (
                        <div>
                          <div className="relative">
                            <img 
                              src={alarm.imageUrl} 
                              alt="Alarm"
                              className="object-cover w-full h-32 border rounded cursor-pointer hover:opacity-90"
                              onClick={() => window.open(alarm.imageUrl, '_blank')}
                              onError={(e) => e.target.style.display = 'none'}
                            />
                            <div className="absolute p-1 bg-white rounded-full shadow top-2 right-2">
                              <Camera className="w-4 h-4 text-gray-600" />
                            </div>
                          </div>
                        </div>
                      )}

                      {/* Card Actions */}
                      <div className="pt-3 border-t border-gray-200">
                        {!alarm.resolved ? (
                          <button
                            onClick={() => resolveAlarm(alarm.id)}
                            className="flex items-center justify-center w-full gap-2 px-4 py-2 font-medium text-white transition-colors bg-green-600 rounded-lg hover:bg-green-700"
                          >
                            <CheckCircle className="w-4 h-4" />
                            Resolve Alarm
                          </button>
                        ) : (
                          <div className="flex items-center justify-center gap-2 py-2 font-medium text-center text-green-600">
                            <CheckCircle className="w-4 h-4" />
                            Resolved
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Footer Stats */}
      <div className="p-4 mt-6 bg-white rounded-lg shadow">
        <div className="flex flex-wrap items-center justify-between text-sm text-gray-600">
          <div className="flex items-center gap-4">
            <span>Total: {alarms.length} alarms</span>
            <span>•</span>
            <span>Live: {alarms.filter(a => a.isLive).length}</span>
            <span>•</span>
            <span>Filtered: {filteredAlarms.length} shown</span>
            <span>•</span>
            <span>Selected: {selectedAlarms.length}</span>
          </div>
          <div className="flex items-center gap-4">
            <span>Critical: {alarms.filter(a => a.severity === 'critical' && !a.resolved).length}</span>
            <span>•</span>
            <span>With Images: {alarms.filter(a => a.imageUrl).length}</span>
            <span>•</span>
            <span>With Location: {alarms.filter(a => a.latitude && a.longitude).length}</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default EnhancedLiveAlarmManagement;