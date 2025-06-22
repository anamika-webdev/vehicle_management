import React, { useState, useEffect, useCallback, useRef } from 'react';
import { AlertTriangle, Download, MapPin, Bell, CheckCircle, X, Filter, Search, Map, RefreshCw, Eye, Clock, Camera, Zap } from 'lucide-react';
import apiService from '../../services/api';

const ComprehensiveAlarmSystem = () => {
  // State management
  const [allAlarms, setAllAlarms] = useState([]);
  const [deviceAlarms, setDeviceAlarms] = useState([]);
  const [liveAlarms, setLiveAlarms] = useState([]);
  const [devices, setDevices] = useState([]);
  
  // UI state
  const [loading, setLoading] = useState(false);
  const [criticalAlarmPopup, setCriticalAlarmPopup] = useState(null);
  const [filterType, setFilterType] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedAlarms, setSelectedAlarms] = useState([]);
  const [showMap, setShowMap] = useState(false);
  const [viewMode, setViewMode] = useState('table');
  const [selectedDevice, setSelectedDevice] = useState('all');
  const [alarmTimeFilter, setAlarmTimeFilter] = useState('all');
  const [currentPage, setCurrentPage] = useState(1); // Pagination state
  const alarmsPerPage = 20; // Number of alarms per page
  
  // Live polling
  const [streamActive, setStreamActive] = useState(false);
  const [lastStreamUpdate, setLastStreamUpdate] = useState(null);
  const pollingRef = useRef(null);
  const audioRef = useRef(null); // Reference for critical alarm sound
  const seenLiveAlarmIds = useRef(new Set()); // Track seen live alarms

  // Initialize audio for critical alarms
  useEffect(() => {
    audioRef.current = new Audio('https://www.soundjay.com/buttons/beep-01a.mp3');
    audioRef.current.preload = 'auto';
  }, []);

  // Play sound when critical alarm popup appears
  useEffect(() => {
    if (criticalAlarmPopup) {
      audioRef.current.play().catch(error => console.error('Failed to play critical alarm sound:', error));
    }
  }, [criticalAlarmPopup]);

  // Fetch devices
  const fetchDevices = useCallback(async () => {
    try {
      console.log('📱 Fetching devices using authenticated API...');
      const response = await apiService.getDevices();
      
      if (response.success && response.data) {
        console.log(`✅ Found ${response.data.length} devices via authenticated API`);
        setDevices(response.data);
        return response.data;
      }
      return [];
    } catch (error) {
      console.error('Failed to fetch devices:', error);
      return [];
    }
  }, []);

  // Fetch manager alarms
  const fetchManagerAlarms = useCallback(async () => {
    try {
      console.log('📊 Fetching all manager alarms using authenticated API...');
      const response = await apiService.getManagerAlarms(0, 100);
      
      if (response.success && response.data) {
        const transformedAlarms = response.data.map(alarm => ({
          id: alarm.alert_id || alarm.alarm_id || alarm.alarmId || `mgr_${Date.now()}`,
          device_id: alarm.device_id || alarm.deviceId,
          alarmType: alarm.alert_type || alarm.alarm_type || alarm.alarmType || 'Unknown',
          severity: alarm.severity || 'medium',
          status: alarm.status || (alarm.resolved ? 'resolved' : 'active'),
          message: alarm.message || alarm.description || 'No description',
          timestamp: alarm.timestamp || alarm.alarmTime || alarm.createdAt || new Date().toISOString(),
          resolved: Boolean(alarm.resolved),
          latitude: alarm.latitude ? parseFloat(alarm.latitude) : null,
          longitude: alarm.longitude ? parseFloat(alarm.longitude) : null,
          imageUrl: alarm.imageUrl || alarm.previewUrl || alarm.image_url,
          source: 'manager',
          isLive: false
        }));
        
        console.log(`✅ Fetched ${transformedAlarms.length} manager alarms`);
        setAllAlarms(transformedAlarms);
        return transformedAlarms;
      }
      return [];
    } catch (error) {
      console.error('Failed to fetch manager alarms:', error);
      return [];
    }
  }, []);

  // Fetch device-specific alarms for a single device
  const fetchDeviceAlarms = useCallback(async (deviceId) => {
    try {
      console.log(`🔍 Fetching alarms for device ${deviceId} using authenticated API...`);
      const response = await apiService.getDeviceAlarms(deviceId, 0, 50);
      
      if (response.success && response.data) {
        return response.data.map(alarm => ({
          id: alarm.alarmId || alarm.id || `dev_${deviceId}_${Date.now()}`,
          device_id: deviceId,
          alarmType: alarm.alarmType || alarm.type || 'Device Alert',
          severity: alarm.severity || 'medium',
          status: alarm.status || (alarm.resolved ? 'resolved' : 'active'),
          message: alarm.message || alarm.description || 'Device-specific alarm',
          timestamp: alarm.timestamp || alarm.createdAt || new Date().toISOString(),
          resolved: Boolean(alarm.resolved),
          latitude: alarm.latitude ? parseFloat(alarm.latitude) : null,
          longitude: alarm.longitude ? parseFloat(alarm.longitude) : null,
          imageUrl: alarm.imageUrl || alarm.image_url,
          source: 'device',
          isLive: false
        }));
      }
      return [];
    } catch (error) {
      console.error(`Failed to fetch device ${deviceId} alarms:`, error);
      return [];
    }
  }, []);

  // Fetch device alarms for ALL devices
  const fetchAllDeviceAlarms = useCallback(async () => {
    const deviceList = await fetchDevices();
    if (deviceList.length === 0) return [];

    console.log(`🔍 Fetching device alarms for ${deviceList.length} devices...`);
    const deviceAlarmPromises = deviceList.map(device => {
      const deviceId = device.device_id || device.deviceId || device.id;
      return fetchDeviceAlarms(deviceId);
    });

    const results = await Promise.allSettled(deviceAlarmPromises);
    const allDeviceAlarms = results
      .filter(result => result.status === 'fulfilled')
      .flatMap(result => result.value);

    console.log(`✅ Fetched ${allDeviceAlarms.length} device-specific alarms`);
    setDeviceAlarms(allDeviceAlarms);
    return allDeviceAlarms;
  }, [fetchDevices, fetchDeviceAlarms]);

  // Start live alarm polling (EventSource doesn't support auth headers)
  const startLiveStream = useCallback(() => {
    if (pollingRef.current) {
      clearInterval(pollingRef.current);
    }

    try {
      console.log('🔴 Starting authenticated live alarm polling...');
      setStreamActive(true);
      setLastStreamUpdate(new Date());
      
      // Use polling instead of EventSource since EventSource doesn't support Authorization headers
      const pollForLiveAlarms = async () => {
        try {
          console.log('🔍 Polling for new live alarms...');
          // Try to fetch recent alarms and check for new ones
          const response = await apiService.getManagerAlarms(0, 20);
          
          if (response.success && response.data) {
            const now = new Date();
            const tenMinutesAgo = new Date(now.getTime() - 10 * 60 * 1000);
            
            // Filter for very recent alarms (within last 10 minutes)
            const recentAlarms = response.data.filter(alarm => {
              const alarmTime = new Date(alarm.timestamp || alarm.alarmTime || alarm.createdAt);
              return alarmTime > tenMinutesAgo;
            });
            
            console.log(`📊 Found ${recentAlarms.length} recent alarms`);
            
            // Check for new alarms we haven't seen before
            recentAlarms.forEach(alarm => {
              const alarmId = alarm.alert_id || alarm.alarm_id || alarm.alarmId || alarm.id;
              
              // Check if we've already seen this alarm
              if (!seenLiveAlarmIds.current.has(alarmId)) {
                console.log('🚨 NEW LIVE ALARM DETECTED:', alarm);
                
                // Add to seen alarms immediately
                seenLiveAlarmIds.current.add(alarmId);
                
                const liveAlarm = {
                  id: alarmId,
                  device_id: alarm.device_id || alarm.deviceId,
                  alarmType: alarm.alert_type || alarm.alarm_type || alarm.alarmType || 'Live Alert',
                  severity: alarm.severity || 'high',
                  status: alarm.status || 'active',
                  message: alarm.message || alarm.description || 'Live alarm detected',
                  timestamp: alarm.timestamp || alarm.alarmTime || alarm.createdAt || new Date().toISOString(),
                  resolved: Boolean(alarm.resolved),
                  latitude: alarm.latitude ? parseFloat(alarm.latitude) : null,
                  longitude: alarm.longitude ? parseFloat(alarm.longitude) : null,
                  imageUrl: alarm.imageUrl || alarm.previewUrl || alarm.image_url,
                  isLive: true,
                  source: 'live'
                };

                // Add to live alarms immediately
                setLiveAlarms(prev => {
                  console.log('➕ Adding live alarm to state');
                  return [liveAlarm, ...prev];
                });
                
                setLastStreamUpdate(new Date());

                // ALWAYS show popup for live alarms with sound
                console.log('🚨 Triggering critical alarm popup for live alarm');
                setCriticalAlarmPopup(liveAlarm);
                
                // Play sound immediately
                if (audioRef.current) {
                  audioRef.current.play().catch(error => 
                    console.error('Failed to play alarm sound:', error)
                  );
                }
                
                // Dispatch custom event for Dashboard
                const criticalEvent = new CustomEvent('criticalAlarm', {
                  detail: liveAlarm
                });
                window.dispatchEvent(criticalEvent);
                
                // Show browser notification if supported
                if ('Notification' in window && Notification.permission === 'granted') {
                  new Notification('🚨 LIVE ALARM', {
                    body: `${liveAlarm.alarmType}: ${liveAlarm.message}`,
                    icon: '/favicon.ico'
                  });
                }
              }
            });
          }
        } catch (error) {
          console.error('❌ Live alarm polling error:', error);
          // Don't stop polling on individual errors
        }
      };
      
      // Poll every 15 seconds for new alarms
      pollingRef.current = setInterval(pollForLiveAlarms, 15000);
      
      // Initial poll
      pollForLiveAlarms();
      
      // Request notification permission
      if ('Notification' in window && Notification.permission === 'default') {
        Notification.requestPermission();
      }

    } catch (error) {
      console.error('Failed to start live alarm polling:', error);
      setStreamActive(false);
    }
  }, []);

  // Stop live alarm polling
  const stopLiveStream = useCallback(() => {
    if (pollingRef.current) {
      clearInterval(pollingRef.current);
      pollingRef.current = null;
    }
    setStreamActive(false);
    seenLiveAlarmIds.current.clear(); // Reset seen alarms when stopping
    console.log('🛑 Live alarm polling stopped');
  }, []);

  // Resolve alarm
  const resolveAlarm = useCallback(async (alarmId, source) => {
    try {
      if (source === 'manager') {
        setAllAlarms(prev => prev.map(alarm => 
          alarm.id === alarmId ? { ...alarm, resolved: true, status: 'resolved' } : alarm
        ));
      } else if (source === 'device') {
        setDeviceAlarms(prev => prev.map(alarm => 
          alarm.id === alarmId ? { ...alarm, resolved: true, status: 'resolved' } : alarm
        ));
      } else if (source === 'live') {
        setLiveAlarms(prev => prev.map(alarm => 
          alarm.id === alarmId ? { ...alarm, resolved: true, status: 'resolved' } : alarm
        ));
      }

      if (criticalAlarmPopup?.id === alarmId) {
        setCriticalAlarmPopup(null);
      }

      console.log(`✅ Alarm ${alarmId} resolved`);
    } catch (error) {
      console.error('Failed to resolve alarm:', error);
    }
  }, [criticalAlarmPopup]);

  // Download alarms
  const downloadAlarms = useCallback(() => {
    const combinedAlarms = [...allAlarms, ...deviceAlarms, ...liveAlarms];
    const filteredData = selectedAlarms.length > 0 ? selectedAlarms : combinedAlarms;
    
    if (filteredData.length === 0) {
      alert('No alarms to download');
      return;
    }

    const csvHeaders = [
      'Alarm ID', 'Device ID', 'Type', 'Severity', 'Source', 'Status', 'Message', 
      'Timestamp', 'Latitude', 'Longitude', 'Image URL', 'Live Alarm'
    ];

    const csvRows = filteredData.map(alarm => [
      alarm.id, alarm.device_id, alarm.alarmType, alarm.severity, alarm.source,
      alarm.status, (alarm.message || '').replace(/,/g, ';'), alarm.timestamp,
      alarm.latitude || '', alarm.longitude || '', alarm.imageUrl || '',
      alarm.isLive ? 'Yes' : 'No'
    ]);

    const csvContent = [csvHeaders, ...csvRows]
      .map(row => row.map(cell => `"${cell}"`).join(','))
      .join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `comprehensive_alarms_${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
    URL.revokeObjectURL(link.href);
  }, [allAlarms, deviceAlarms, liveAlarms, selectedAlarms]);

  // FIXED: Get combined and filtered alarms - Live alarms now properly included
  const getCombinedAlarms = useCallback(() => {
    let combined = [];
    
    // Always include manager and device alarms
    combined = [...allAlarms, ...deviceAlarms];
    
    // ALWAYS include live alarms regardless of filter type
    combined = [...combined, ...liveAlarms];

    // Remove duplicates by ID (prioritize live alarms)
    const uniqueAlarms = combined.filter((alarm, index, self) => {
      const firstIndex = self.findIndex(a => a.id === alarm.id);
      // If multiple alarms with same ID, prefer live alarms
      if (firstIndex !== index) {
        const firstAlarm = self[firstIndex];
        return alarm.isLive && !firstAlarm.isLive;
      }
      return true;
    });

    let filtered = uniqueAlarms;

    // Apply filters
    if (selectedDevice !== 'all') {
      filtered = filtered.filter(alarm => alarm.device_id?.toString() === selectedDevice);
    }

    // Source filters
    if (filterType === 'manager') {
      filtered = filtered.filter(alarm => alarm.source === 'manager');
    } else if (filterType === 'device') {
      filtered = filtered.filter(alarm => alarm.source === 'device');
    } else if (filterType === 'live') {
      filtered = filtered.filter(alarm => alarm.isLive);
    } else if (filterType === 'active') {
      filtered = filtered.filter(alarm => !alarm.resolved);
    } else if (filterType === 'resolved') {
      filtered = filtered.filter(alarm => alarm.resolved);
    } else if (filterType === 'critical') {
      filtered = filtered.filter(alarm => alarm.severity === 'critical');
    }

    // Time filters
    const now = new Date();
    if (alarmTimeFilter === 'today') {
      const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      filtered = filtered.filter(alarm => new Date(alarm.timestamp) >= today);
    } else if (alarmTimeFilter === 'week') {
      const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      filtered = filtered.filter(alarm => new Date(alarm.timestamp) >= weekAgo);
    } else if (alarmTimeFilter === 'month') {
      const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      filtered = filtered.filter(alarm => new Date(alarm.timestamp) >= monthAgo);
    }

    // Search filter
    if (searchTerm) {
      filtered = filtered.filter(alarm =>
        alarm.message?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        alarm.alarmType?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        alarm.device_id?.toString().includes(searchTerm)
      );
    }

    return filtered.sort((a, b) => {
      // Sort live alarms to the top, then by timestamp
      if (a.isLive && !b.isLive) return -1;
      if (!a.isLive && b.isLive) return 1;
      return new Date(b.timestamp) - new Date(a.timestamp);
    });
  }, [allAlarms, deviceAlarms, liveAlarms, filterType, selectedDevice, alarmTimeFilter, searchTerm]);

  // Refresh all data
  const refreshAllData = useCallback(async () => {
    setLoading(true);
    try {
      await Promise.all([
        fetchManagerAlarms(),
        fetchAllDeviceAlarms()
      ]);
    } catch (error) {
      console.error('Failed to refresh alarm data:', error);
    } finally {
      setLoading(false);
    }
  }, [fetchManagerAlarms, fetchAllDeviceAlarms]);

  // Get severity color
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

  // Initial load and setup
  useEffect(() => {
    const initializeAlarmSystem = async () => {
      setLoading(true);
      try {
        await Promise.all([
          fetchManagerAlarms(),
          fetchAllDeviceAlarms()
        ]);
        
        if (apiService.getToken()) {
          startLiveStream();
        }
      } catch (error) {
        console.error('Failed to initialize alarm system:', error);
      } finally {
        setLoading(false);
      }
    };

    initializeAlarmSystem();

    // Cleanup function - properly stop polling
    return () => {
      stopLiveStream();
    };
  }, []);

  const combinedAlarms = getCombinedAlarms();
  
  // Pagination calculations
  const indexOfLastAlarm = currentPage * alarmsPerPage;
  const indexOfFirstAlarm = indexOfLastAlarm - alarmsPerPage;
  const currentAlarms = combinedAlarms.slice(indexOfFirstAlarm, indexOfLastAlarm);
  const totalPages = Math.ceil(combinedAlarms.length / alarmsPerPage);

  // Pagination navigation
  const paginate = (pageNumber) => {
    setCurrentPage(pageNumber);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <div className="min-h-screen p-6 bg-gray-50">
      {/* Critical Alarm Popup - Enhanced */}
      {criticalAlarmPopup && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 animate-fadeIn">
          <div className="w-full max-w-md p-6 mx-4 bg-white border-2 border-red-500 rounded-lg shadow-2xl animate-pulse">
            <div className="flex items-center gap-3 mb-4">
              <AlertTriangle className="w-8 h-8 text-red-600 animate-bounce" />
              <h2 className="text-xl font-bold text-red-800">🚨 LIVE ALARM DETECTED</h2>
              <button onClick={() => setCriticalAlarmPopup(null)} className="ml-auto text-gray-500 hover:text-gray-700">
                <X className="w-6 h-6" />
              </button>
            </div>
            
            <div className="space-y-3">
              <div className="p-3 border border-red-200 rounded-lg bg-red-50">
                <p className="font-semibold text-gray-900">Device: {criticalAlarmPopup.device_id}</p>
                <p className="text-gray-700">Type: {criticalAlarmPopup.alarmType}</p>
                <p className="text-gray-700">Message: {criticalAlarmPopup.message}</p>
                <p className="text-sm text-gray-500">Time: {new Date(criticalAlarmPopup.timestamp).toLocaleString()}</p>
                <div className="flex items-center gap-2 mt-2">
                  <div className="w-3 h-3 bg-red-500 rounded-full animate-pulse"></div>
                  <p className="text-sm font-bold text-red-600">🔴 LIVE ALARM - IMMEDIATE ATTENTION REQUIRED</p>
                </div>
                <p className="mt-1 text-xs text-purple-600">Severity: {criticalAlarmPopup.severity?.toUpperCase()}</p>
              </div>
              
              {criticalAlarmPopup.imageUrl && (
                <img src={criticalAlarmPopup.imageUrl} alt="Critical Alarm" className="object-cover w-full h-32 border rounded" onError={(e) => e.target.style.display = 'none'} />
              )}
              
              {(criticalAlarmPopup.latitude && criticalAlarmPopup.longitude) && (
                <div className="flex items-center gap-2 p-2 rounded bg-blue-50">
                  <MapPin className="w-4 h-4 text-blue-600" />
                  <span className="text-sm text-blue-800">📍 {criticalAlarmPopup.latitude.toFixed(4)}, {criticalAlarmPopup.longitude.toFixed(4)}</span>
                </div>
              )}
            </div>
            
            <div className="flex gap-3 mt-6">
              <button onClick={() => resolveAlarm(criticalAlarmPopup.id, criticalAlarmPopup.source)} className="flex items-center justify-center flex-1 gap-2 px-4 py-2 font-semibold text-white bg-green-600 rounded-lg hover:bg-green-700">
                <CheckCircle className="w-4 h-4" />
                Resolve Now
              </button>
              <button 
                onClick={() => {
                  setCriticalAlarmPopup(null);
                  // Auto-navigate to alarms tab to see all live alarms
                }} 
                className="flex-1 px-4 py-2 text-white bg-blue-600 rounded-lg hover:bg-blue-700"
              >
                View All Alarms
              </button>
              <button onClick={() => setCriticalAlarmPopup(null)} className="flex-1 px-4 py-2 text-white bg-gray-600 rounded-lg hover:bg-gray-700">
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
            🚨Alarm Management
          </h1>
          <div className="flex items-center gap-4 mt-2 text-sm text-gray-500">
            <div className="flex items-center gap-1">
              <Clock className="w-4 h-4" />
              Last updated: {new Date().toLocaleTimeString()}
            </div>
            <div className="flex items-center gap-1">
              <div className={`w-2 h-2 rounded-full ${streamActive ? 'bg-green-500 animate-pulse' : 'bg-red-500'}`}></div>
              Live Polling {streamActive ? 'ACTIVE' : 'INACTIVE'} ({streamActive ? '15s intervals' : 'stopped'})
            </div>
            <div className="flex items-center gap-1">
              <div className="w-2 h-2 bg-green-500 rounded-full"></div>
              All {devices.length} devices monitored
            </div>
            {liveAlarms.length > 0 && (
              <div className="flex items-center gap-1">
                <div className="w-2 h-2 bg-purple-500 rounded-full animate-pulse"></div>
                <span className="font-semibold text-purple-600">{liveAlarms.length} Live Alarms IN TABLE</span>
              </div>
            )}
          </div>
        </div>
        
        <div className="flex flex-wrap items-center gap-3">
          <button onClick={streamActive ? stopLiveStream : startLiveStream} className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium ${streamActive ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'}`}>
            <Zap className="w-4 h-4" />
            {streamActive ? 'Stop Live Polling' : 'Start Live Polling'}
          </button>
          
          <button onClick={() => setViewMode(viewMode === 'table' ? 'cards' : 'table')} className="flex items-center gap-2 px-3 py-2 text-sm text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200">
            <Eye className="w-4 h-4" />
            {viewMode === 'table' ? 'Card View' : 'Table View'}
          </button>
          
          <button onClick={() => setShowMap(!showMap)} className="flex items-center gap-2 px-4 py-2 text-white bg-blue-600 rounded-lg hover:bg-blue-700">
            <Map className="w-4 h-4" />
            {showMap ? 'Hide Map' : 'Show Map'}
          </button>
          
          <button onClick={downloadAlarms} className="flex items-center gap-2 px-4 py-2 text-white bg-green-600 rounded-lg hover:bg-green-700">
            <Download className="w-4 h-4" />
            Download ({selectedAlarms.length > 0 ? selectedAlarms.length : combinedAlarms.length})
          </button>
          
          <button onClick={refreshAllData} disabled={loading} className="flex items-center gap-2 px-4 py-2 text-white bg-purple-600 rounded-lg hover:bg-purple-700 disabled:opacity-50">
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            Refresh All
          </button>
        </div>
      </div>

      {/* FIXED Statistics Cards - Now properly counting live alarms */}
      <div className="grid grid-cols-1 gap-4 mb-6 md:grid-cols-2 lg:grid-cols-6">
        {[
          { label: 'Live Alarms ✅', count: liveAlarms.length, color: 'text-purple-600', icon: Zap, source: 'live' },
          { label: 'Active', count: combinedAlarms.filter(a => !a.resolved).length, color: 'text-orange-600', icon: AlertTriangle },
          { label: 'Total Shown', count: combinedAlarms.length, color: 'text-green-600', icon: MapPin }
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

      {/* Filters */}
      <div className="p-6 mb-6 bg-white rounded-lg shadow">
        <div className="grid items-center grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-6">
          <div>
            <label className="block mb-1 text-sm font-medium text-gray-700">Source</label>
            <select value={filterType} onChange={(e) => setFilterType(e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500">
              <option value="all">All Sources</option>
              <option value="manager">Manager Alarms</option>
              <option value="live">Live Alarms ✅</option>
              <option value="active">Active Only</option>
              <option value="critical">Critical Only</option>
            </select>
          </div>
          
          <div>
            <label className="block mb-1 text-sm font-medium text-gray-700">Device</label>
            <select value={selectedDevice} onChange={(e) => setSelectedDevice(e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500">
              <option value="all">All Devices</option>
              {devices.map(device => (
                <option key={device.device_id || device.deviceId || device.id} value={device.device_id || device.deviceId || device.id}>
                  Device {device.device_id || device.deviceId || device.id} ({device.device_name || device.deviceName || device.name || 'Unnamed'})
                </option>
              ))}
            </select>
          </div>
          
          <div>
            <label className="block mb-1 text-sm font-medium text-gray-700">Time Period</label>
            <select value={alarmTimeFilter} onChange={(e) => setAlarmTimeFilter(e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500">
              <option value="all">All Time</option>
              <option value="today">Today</option>
              <option value="week">Last Week</option>
              <option value="month">Last Month</option>
            </select>
          </div>
          
          <div className="md:col-span-2">
            <label className="block mb-1 text-sm font-medium text-gray-700">Search</label>
            <div className="relative">
              <Search className="absolute w-4 h-4 text-gray-400 transform -translate-y-1/2 left-3 top-1/2" />
              <input type="text" placeholder="Search alarms..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="w-full py-2 pl-10 pr-4 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500" />
            </div>
          </div>
          
          <div className="flex items-end">
            <div className="text-sm text-gray-600">
              Showing {combinedAlarms.length} alarms
            </div>
          </div>
        </div>
      </div>

      {/* Map */}
      {showMap && (
        <div className="p-6 mb-6 bg-white rounded-lg shadow">
          <h2 className="mb-4 text-xl font-bold text-gray-900">Alarm Locations Map</h2>
          <div className="flex items-center justify-center border-2 border-blue-300 border-dashed rounded-lg h-96 bg-gradient-to-br from-blue-50 to-indigo-100">
            <div className="p-8 text-center">
              <MapPin className="w-16 h-16 mx-auto mb-4 text-blue-400" />
              <h3 className="mb-2 text-lg font-semibold text-gray-700">Comprehensive Alarm Location Map</h3>
              <p className="mb-4 text-gray-600">
                Showing {combinedAlarms.filter(a => a.latitude && a.longitude).length} alarms with location data
              </p>
              <div className="space-y-2">
                {combinedAlarms.filter(a => a.latitude && a.longitude).slice(0, 5).map((alarm, index) => (
                  <div key={index} className="flex items-center justify-center gap-2 text-xs text-gray-600">
                    <div className={`w-2 h-2 rounded-full ${alarm.isLive ? 'bg-purple-500 animate-pulse' : alarm.severity === 'critical' ? 'bg-red-500' : 'bg-blue-500'}`}></div>
                    {alarm.source.toUpperCase()} - Device {alarm.device_id}: {alarm.latitude.toFixed(4)}, {alarm.longitude.toFixed(4)}
                    {alarm.isLive && <span className="font-bold text-purple-600">LIVE</span>}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Alarms Table - FIXED: Live alarms now visible */}
      <div className="overflow-hidden bg-white rounded-lg shadow">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-xs font-medium tracking-wider text-left text-gray-500 uppercase">
                  <input
                    type="checkbox"
                    onChange={(e) => {
                      if (e.target.checked) {
                        setSelectedAlarms([...selectedAlarms, ...currentAlarms.filter(a => !selectedAlarms.some(s => s.id === a.id && s.source === a.source))]);
                      } else {
                        setSelectedAlarms(selectedAlarms.filter(a => !currentAlarms.some(c => c.id === a.id && c.source === a.source)));
                      }
                    }}
                    checked={currentAlarms.every(a => selectedAlarms.some(s => s.id === a.id && s.source === a.source)) && currentAlarms.length > 0}
                  />
                </th>
                <th className="px-6 py-3 text-xs font-medium tracking-wider text-left text-gray-500 uppercase">Source</th>
                <th className="px-6 py-3 text-xs font-medium tracking-wider text-left text-gray-500 uppercase">Device ID</th>
                <th className="px-6 py-3 text-xs font-medium tracking-wider text-left text-gray-500 uppercase">Type</th>
                <th className="px-6 py-3 text-xs font-medium tracking-wider text-left text-gray-500 uppercase">Severity</th>
                <th className="px-6 py-3 text-xs font-medium tracking-wider text-left text-gray-500 uppercase">Message</th>
                <th className="px-6 py-3 text-xs font-medium tracking-wider text-left text-gray-500 uppercase">Timestamp</th>
                <th className="px-6 py-3 text-xs font-medium tracking-wider text-left text-gray-500 uppercase">Location</th>
                <th className="px-6 py-3 text-xs font-medium tracking-wider text-left text-gray-500 uppercase">Image</th>
                <th className="px-6 py-3 text-xs font-medium tracking-wider text-left text-gray-500 uppercase">Actions</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {loading ? (
                <tr>
                  <td colSpan="10" className="px-6 py-12 text-center">
                    <div className="flex items-center justify-center">
                      <div className="w-8 h-8 border-b-2 border-blue-600 rounded-full animate-spin"></div>
                      <span className="ml-3 text-gray-600">Loading authenticated alarm data...</span>
                    </div>
                  </td>
                </tr>
              ) : currentAlarms.length === 0 ? (
                <tr>
                  <td colSpan="10" className="px-6 py-12 text-center">
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
                currentAlarms.map((alarm) => (
                  <tr 
                    key={`${alarm.source}-${alarm.id}`}
                    className={`hover:bg-gray-50 transition-colors ${
                      alarm.resolved ? 'opacity-60' : ''
                    } ${alarm.severity === 'critical' && !alarm.resolved ? 'bg-red-50 border-l-4 border-red-500' : ''
                    } ${alarm.isLive ? 'bg-purple-50 border-l-4 border-purple-500' : ''}`}
                  >
                    <td className="px-6 py-4 whitespace-nowrap">
                      <input
                        type="checkbox"
                        checked={selectedAlarms.some(a => a.id === alarm.id && a.source === alarm.source)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setSelectedAlarms([...selectedAlarms, alarm]);
                          } else {
                            setSelectedAlarms(selectedAlarms.filter(a => !(a.id === alarm.id && a.source === alarm.source)));
                          }
                        }}
                      />
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center gap-2">
                        <span className={`px-2 py-1 text-xs font-semibold rounded-full ${
                          alarm.source === 'live' ? 'bg-purple-100 text-purple-800' :
                          alarm.source === 'manager' ? 'bg-blue-100 text-blue-800' :
                          'bg-green-100 text-green-800'
                        }`}>
                          {alarm.source.toUpperCase()}
                        </span>
                        {alarm.isLive && (
                          <div className="flex items-center gap-1">
                            <div className="w-2 h-2 bg-purple-500 rounded-full animate-pulse" title="Live Alarm"></div>
                            <span className="text-xs font-bold text-purple-600">LIVE</span>
                          </div>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-gray-900">{alarm.device_id}</div>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-900 whitespace-nowrap">
                      <div className="flex items-center gap-1">
                        {alarm.isLive && <span className="text-purple-600">🔴</span>}
                        {alarm.alarmType}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full border ${getSeverityColor(alarm.severity, alarm.resolved, alarm.isLive)}`}>
                        {alarm.isLive ? 'LIVE' : alarm.resolved ? 'Resolved' : alarm.severity}
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
                          onClick={() => resolveAlarm(alarm.id, alarm.source)}
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

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between px-6 py-4 border-t border-gray-200">
            <div className="text-sm text-gray-700">
              Showing {indexOfFirstAlarm + 1} to {Math.min(indexOfLastAlarm, combinedAlarms.length)} of {combinedAlarms.length} alarms
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => paginate(currentPage - 1)}
                disabled={currentPage === 1}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50"
              >
                Previous
              </button>
              {Array.from({ length: totalPages }, (_, i) => i + 1)
                .slice(Math.max(0, currentPage - 3), Math.min(totalPages, currentPage + 2))
                .map(page => (
                  <button
                    key={page}
                    onClick={() => paginate(page)}
                    className={`px-4 py-2 text-sm font-medium rounded-md ${
                      currentPage === page
                        ? 'bg-blue-600 text-white'
                        : 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-50'
                    }`}
                  >
                    {page}
                  </button>
                ))}
              <button
                onClick={() => paginate(currentPage + 1)}
                disabled={currentPage === totalPages}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default ComprehensiveAlarmSystem;