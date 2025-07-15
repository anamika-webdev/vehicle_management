import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  AlertTriangle, Clock, MapPin, Eye, CheckCircle,
  Wifi, WifiOff, Play, Pause, RefreshCw, Download,
  Filter, Search, Bell, BellOff, Activity, ChevronLeft,
  ChevronRight, ChevronsLeft, ChevronsRight, Check,
  X, ExternalLink, FileDown, Zap
} from 'lucide-react';
import JSZip from 'jszip';
import apiService from '../../services/api';
import DeviceInfoModal from '../devices/DeviceInfoModal'; // adjust path
import enhancedAlarmService from '../../services/enhancedApiService';
import { toast } from 'react-toastify';

const EventBasedAlarmTable = ({
  globalLiveAlarms = [],
  globalStreamActive = false,
  onStartGlobalStream = () => {},
  onStopGlobalStream = () => {},
  
}) => {
  // Core alarm data state
  const [alarms, setAlarms] = useState([]);
  const [filteredAlarms, setFilteredAlarms] = useState([]);
  const [loading, setLoading] = useState(true);

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);
  const [totalItems, setTotalItems] = useState(0);

  // Selection state
  const [selectedAlarms, setSelectedAlarms] = useState(new Set());
  const [selectAll, setSelectAll] = useState(false);

  // Filter states
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [typeFilter, setTypeFilter] = useState('all');
  const [severityFilter, setSeverityFilter] = useState('all');

  // PURE EVENT-BASED: Connection and stream states
  const [isLocalStreamConnected, setIsLocalStreamConnected] = useState(false);
  const [localStreamEnabled, setLocalStreamEnabled] = useState(true);
  const [soundEnabled, setSoundEnabled] = useState(true);

  // Alarm management states
  const [resolvedAlarms, setResolvedAlarms] = useState(new Set());

  // Modal states
  const [showViewModal, setShowViewModal] = useState(false);
  const [selectedAlarmForView, setSelectedAlarmForView] = useState(null);
  const [showExportModal, setShowExportModal] = useState(false);
  const [deviceModalOpen, setDeviceModalOpen] = useState(false);
  const [selectedDeviceForModal, setSelectedDeviceForModal] = useState(null);

  // Export states
  const [exportLoading, setExportLoading] = useState(false);
  const [exportFormat, setExportFormat] = useState('csv');

  // PURE EVENT-BASED: Only SSE refs - NO POLLING REFS
  const localEventSourceRef = useRef(null);
  const audioRef = useRef(null);
  const seenLocalAlarmIds = useRef(new Set());

  // Get authentication token from localStorage
  const getAuthToken = () => localStorage.getItem('authToken');

  // Validate URL
  const isValidUrl = (url) => {
    if (!url || typeof url !== 'string') return false;
    return /^https?:\/\//.test(url);
  };

  // Get alarm status (resolved or active)
  const getAlarmStatus = (alarm) => {
    if (resolvedAlarms.has(alarm.alarmId || alarm.id)) return 'resolved';
    return alarm.status || 'active';
  };

  // Get severity color classes for badges
  const getSeverityColor = (severity) => {
    switch (severity) {
      case 'critical': return 'text-red-700 bg-red-100 border-red-200';
      case 'high': return 'text-orange-700 bg-orange-100 border-orange-200';
      case 'medium':
      case 'moderate': return 'text-yellow-700 bg-yellow-100 border-yellow-200';
      case 'low': return 'text-blue-700 bg-blue-100 border-blue-200';
      default: return 'text-gray-700 bg-gray-100 border-gray-200';
    }
  };

  // Get status color classes for status badges
  const getStatusColor = (status) => {
    switch (status) {
      case 'active': return 'text-red-700 bg-red-100';
      case 'resolved': return 'text-green-700 bg-green-100';
      default: return 'text-gray-700 bg-gray-100';
    }
  };

  // Normalize alarm data format
  const normalizeAlarm = (alarm, isFromGlobal = false) => {
    const normalized = {
      alarmId: alarm.alarmId || alarm.id || alarm.alert_id || alarm.alarm_id || `alarm_${Date.now()}_${Math.random()}`,
      deviceId: alarm.deviceId || alarm.device_id,
      //speed: alarm.speed !== undefined && alarm.speed !== null ? alarm.speed : 'N/A',
      //acceleration: alarm.acceleration !== undefined && alarm.acceleration !== null ? alarm.acceleration : 'N/A',
      //drowsiness: alarm.drowsiness !== undefined ? alarm.drowsiness : 'N/A',
      //rashDriving: alarm.rashDriving !== undefined ? alarm.rashDriving : 'N/A',
      //collision: alarm.collision !== undefined ? alarm.collision : 'N/A',
      speed: alarm.hasOwnProperty('speed') ? parseFloat(alarm.speed) : null,
acceleration: alarm.hasOwnProperty('acceleration') ? parseFloat(alarm.acceleration) : null,
drowsiness: alarm.hasOwnProperty('drowsiness') ? alarm.drowsiness : null,
rashDriving: alarm.hasOwnProperty('rashDriving') ? alarm.rashDriving : null,
collision: alarm.hasOwnProperty('collision') ? alarm.collision : null,

      latitude: alarm.latitude ? parseFloat(alarm.latitude) : null,
      longitude: alarm.longitude ? parseFloat(alarm.longitude) : null,
      alarmType: alarm.alarmType || alarm.alert_type || alarm.alarm_type || 'Unknown',
      description: alarm.message || alarm.description || 'No description',
      previewUrl: alarm.imageUrl || alarm.previewUrl || alarm.image_url,
      downloadUrl: alarm.downloadUrl,
      alarmTime: alarm.timestamp || alarm.alarmTime || alarm.createdAt || new Date().toISOString(),
      status: alarm.status || (isFromGlobal ? 'active' : 'historical'),
      severity: alarm.severity || (alarm.alarmType === 'Critical' ? 'critical' :
               alarm.alarmType === 'High' ? 'high' :
               alarm.alarmType === 'Medium' ? 'medium' : 'low'),
      isLive: isFromGlobal ? true : (alarm.isLive || false),
      timestamp: alarm.timestamp || alarm.alarmTime || alarm.createdAt || new Date().toISOString(),
      source: isFromGlobal ? 'global_sse' : (alarm.source || 'api')
    };
    console.log(`🔍 Normalized alarm ${normalized.alarmId}: raw data =`, alarm, 'normalized =', normalized);
    return normalized;
  };

  // Request browser notification permission
  const requestNotificationPermission = async () => {
    if ('Notification' in window && Notification.permission === 'default') {
      await Notification.requestPermission();
    }
  };

  // Resolve an alarm
  const resolveAlarm = async (alarmId) => {
  const result = await enhancedAlarmService.resolveAlarm(alarmId);
  if (result.success) {
    setResolvedAlarms(prev => new Set([...prev, alarmId]));
    toast.success(`✅ Alarm ${alarmId} resolved`);
  } else {
    toast.error(`❌ Failed to resolve alarm`);
  }

    // Remove from selected alarms if it was selected
    setSelectedAlarms(prev => {
      const newSet = new Set(prev);
      newSet.delete(alarmId);
      return newSet;
    });
  };

  // Bulk resolve selected alarms
  const bulkResolveAlarms = () => {
    const confirmResolve = window.confirm(`Are you sure you want to resolve ${selectedAlarms.size} selected alarm(s)?`);
    if (confirmResolve) {
      selectedAlarms.forEach(alarmId => {
        setResolvedAlarms(prev => new Set([...prev, alarmId]));
      });
      setSelectedAlarms(new Set());
      setSelectAll(false);
      console.log(`✅ Bulk resolved ${selectedAlarms.size} alarms`);
    }
  };

  // Play notification sound and show browser notification
  const triggerAlarmNotification = (alarm) => {
    // Play sound if enabled
    if (soundEnabled && audioRef.current) {
      audioRef.current.play().catch(err =>
        console.error('Failed to play alarm sound:', err)
      );
    }

    // Show browser notification if permission granted
    if ('Notification' in window && Notification.permission === 'granted') {
      new Notification('🚨 New Local Alarm', {
        body: `${alarm.alarmType}: ${alarm.description}`,
        icon: '/favicon.ico',
        requireInteraction: alarm.severity === 'critical',
        tag: `local-alarm-${alarm.alarmId}`
      });
    }
  };

  // View alarm details
  const viewAlarmDetails = (alarm) => {
    setSelectedAlarmForView(alarm);
    setShowViewModal(true);
  };

  // Download alarm bundle (details + image if available)
  const downloadAlarmBundle = async (alarm) => {
    try {
      const zip = new JSZip();
      const alarmDetails = {
        alarmId: alarm.alarmId,
        alarmType: alarm.alarmType,
        description: alarm.description,
        deviceId: alarm.deviceId || 'Unknown',
        status: getAlarmStatus(alarm),
        severity: alarm.severity,
        alarmTime: new Date(alarm.alarmTime).toLocaleString(),
        location: alarm.latitude && alarm.longitude ? `${parseFloat(alarm.latitude).toFixed(6)}, ${parseFloat(alarm.longitude).toFixed(6)}` : 'N/A',
       // speed: alarm.speed !== null ? `${parseFloat(alarm.speed).toFixed(2)} km/h` : 'N/A',
       // acceleration: alarm.acceleration !== null ? `${parseFloat(alarm.acceleration).toFixed(2)} m/s²` : 'N/A',
        speed: alarm.speed !== undefined && alarm.speed !== null ? alarm.speed : 'N/A',
      acceleration: alarm.acceleration !== undefined && alarm.acceleration !== null ? alarm.acceleration : 'N/A',

        drowsiness: alarm.drowsiness ? `${alarm.drowsiness}%` : 'N/A'
      };

      // Add alarm details as JSON
      zip.file(`alarm-${alarm.alarmId}-details.json`, JSON.stringify(alarmDetails, null, 2));

      // Fetch and add image if available
      const imageUrl = alarm.downloadUrl || alarm.previewUrl;
      if (imageUrl && isValidUrl(imageUrl)) {
        const response = await fetch(imageUrl, {
          headers: {
            'Authorization': `Bearer ${getAuthToken()}`
          }
        });
        if (!response.ok) throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        const imageBlob = await response.blob();
        zip.file(`alarm-${alarm.alarmId}-image.jpg`, imageBlob);
        console.log(`📥 Added image to bundle for alarm ${alarm.alarmId}`);
      } else {
        console.log(`⚠️ No valid image URL for alarm ${alarm.alarmId}`);
      }

      // Generate and download ZIP
      const zipBlob = await zip.generateAsync({ type: 'blob' });
      const zipUrl = URL.createObjectURL(zipBlob);
      const a = document.createElement('a');
      a.href = zipUrl;
      a.download = `alarm-${alarm.alarmId}-bundle.zip`;
      a.click();
      URL.revokeObjectURL(zipUrl);
      console.log(`📦 Alarm bundle downloaded for alarm ${alarm.alarmId}`);
    } catch (error) {
      console.error('❌ Failed to download alarm bundle:', error);
    }
  };

  // Initialize alarm table with historical data (called once on mount) - NO POLLING
  const initializeAlarms = useCallback(async () => {
    try {
      setLoading(true);
      console.log('🔄 Loading historical alarms via API (one-time load)...');

      const response = await apiService.getManagerAlarms(0, 500);
      console.log('📊 Raw API response:', response);

      if (response.success && response.data) {
        const normalizedAlarms = response.data.map(alarm => normalizeAlarm(alarm, false));
        setAlarms(normalizedAlarms);
        setTotalItems(response.total || normalizedAlarms.length);
        console.log(`✅ Fetched ${normalizedAlarms.length} historical alarms`);
      } else {
        console.warn('⚠️ No historical alarms found');
        setAlarms([]);
        setTotalItems(0);
      }
    } catch (error) {
      console.error('❌ Failed to load historical alarms:', error);
      setAlarms([]);
      setTotalItems(0);
    } finally {
      setLoading(false);
    }
  }, []);

  // Start local SSE stream for new alarms (pure event-based)

const startLocalSSEStream = useCallback(() => {
  const token = getAuthToken();
  if (!token) {
    console.error('❌ No token for local SSE');
    return;
  }

  let isActive = true;
  let controller = new AbortController();

  const connectLocal = async () => {
    try {
      console.log('🚀 Local secure SSE...');
      
      const response = await fetch('http://164.52.194.198:9090/alarm/v1/stream/1', {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Accept': 'text/event-stream'
        },
        signal: controller.signal
      });

      if (!response.ok) throw new Error(`HTTP ${response.status}`);

      console.log('✅ Local secure SSE connected');
      setIsLocalStreamConnected(true);

      localEventSourceRef.current = {
        close: () => {
          isActive = false;
          controller.abort();
          setIsLocalStreamConnected(false);
        }
      };

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (isActive) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const alarmData = JSON.parse(line.slice(6));
              const alarmId = alarmData.alarmId || `local_${Date.now()}`;

              if (!seenLocalAlarmIds.current.has(alarmId)) {
                seenLocalAlarmIds.current.add(alarmId);

                const newAlarm = normalizeAlarm(alarmData, false);
                newAlarm.source = 'local_sse';
                newAlarm.isLive = true;

                setAlarms(prevAlarms => {
                  const updated = [newAlarm, ...prevAlarms].slice(0, 500);
                  console.log(`🔔 Local alarm added: ${newAlarm.alarmId}`);
                  return updated;
                });

                triggerAlarmNotification(newAlarm);
              }
            } catch (parseError) {
              console.error('❌ Local parse error:', parseError);
            }
          }
        }
      }
    } catch (error) {
      if (!controller.signal.aborted) {
        console.error('❌ Local secure SSE failed:', error);
      }
    } finally {
      setIsLocalStreamConnected(false);
      if (isActive && localStreamEnabled) {
        setTimeout(() => {
          if (localStreamEnabled) {
            controller = new AbortController();
            connectLocal();
          }
        }, 5000);
      }
    }
  };

  connectLocal();
}, [localStreamEnabled]);


  // Stop local SSE stream
  const stopLocalSSEStream = useCallback(() => {
    if (localEventSourceRef.current) {
      console.log('🛑 Stopping local SSE stream');
      localEventSourceRef.current.close();
      localEventSourceRef.current = null;
      setIsLocalStreamConnected(false);
    }
  }, []);

  // Merge global live alarms with local alarms
  const mergeAlarms = useCallback(() => {
    const globalAlarmsNormalized = globalLiveAlarms.map(alarm => normalizeAlarm(alarm, true));
    const mergedAlarms = [...globalAlarmsNormalized, ...alarms];

    // Remove duplicates based on alarmId
    const uniqueAlarms = mergedAlarms.reduce((acc, alarm) => {
      const existingIndex = acc.findIndex(a => a.alarmId === alarm.alarmId);
      if (existingIndex === -1) {
        acc.push(alarm);
      } else if (alarm.isLive) {
        acc[existingIndex] = alarm;
      }
      return acc;
    }, []);

    return uniqueAlarms.sort((a, b) => new Date(b.alarmTime) - new Date(a.alarmTime)).slice(0, 500);
  }, [globalLiveAlarms, alarms]);

  // Apply filters and search
  const applyFiltersAndSearch = useCallback(() => {
    const mergedAlarms = mergeAlarms();

    let filtered = mergedAlarms.filter(alarm => {
      if (searchTerm) {
        const searchLower = searchTerm.toLowerCase();
        const matchesSearch =
          alarm.alarmType?.toLowerCase().includes(searchLower) ||
          alarm.description?.toLowerCase().includes(searchLower) ||
          alarm.deviceId?.toLowerCase().includes(searchLower);
        if (!matchesSearch) return false;
      }

      if (statusFilter !== 'all') {
        const status = getAlarmStatus(alarm);
        if (status !== statusFilter) return false;
      }

      if (typeFilter !== 'all') {
        if (alarm.alarmType !== typeFilter) return false;
      }

      if (severityFilter !== 'all') {
        if (alarm.severity !== severityFilter) return false;
      }

      return true;
    });

    setFilteredAlarms(filtered);
    setTotalItems(filtered.length);
  }, [mergeAlarms, searchTerm, statusFilter, typeFilter, severityFilter, getAlarmStatus]);

  useEffect(() => {
  console.log('🔄 Forcing table update due to globalLiveAlarms change:', globalLiveAlarms.length);
  
  // Create immediate merged view
  const globalNormalized = globalLiveAlarms.map(alarm => ({
    ...alarm,
    alarmId: alarm.id || alarm.alarmId,
    deviceId: alarm.device_id || alarm.deviceId,
    alarmTime: alarm.timestamp || alarm.alarmTime,
    description: alarm.message || alarm.description,
    source: 'global_stream'
  }));

  // Merge with local alarms
  const merged = [...globalNormalized, ...alarms];
  
  // Remove duplicates (prefer global version)
  const unique = merged.reduce((acc, alarm) => {
    const existing = acc.find(a => a.alarmId === alarm.alarmId);
    if (!existing) {
      acc.push(alarm);
    } else if (alarm.source === 'global_stream') {
      const index = acc.findIndex(a => a.alarmId === alarm.alarmId);
      acc[index] = alarm;
    }
    return acc;
  }, []);

  // Apply all filters
  const filtered = unique.filter(alarm => {
    // Search filter
    if (searchTerm) {
      const search = searchTerm.toLowerCase();
      const matches = [
        alarm.alarmType,
        alarm.description,
        alarm.deviceId
      ].some(field => field?.toLowerCase().includes(search));
      if (!matches) return false;
    }

    // Status filter
    if (statusFilter !== 'all') {
      const status = getAlarmStatus(alarm);
      if (status !== statusFilter) return false;
    }

    // Type filter
    if (typeFilter !== 'all' && alarm.alarmType !== typeFilter) return false;

    // Severity filter  
    if (severityFilter !== 'all' && alarm.severity !== severityFilter) return false;

    return true;
  });

  // Sort by time (newest first)
  filtered.sort((a, b) => new Date(b.alarmTime || b.timestamp) - new Date(a.alarmTime || a.timestamp));

  // Update state
  setFilteredAlarms(filtered);
  setTotalItems(filtered.length);
  
  console.log(`📊 Table updated: ${filtered.length} filtered alarms from ${unique.length} total`);
  
  // Reset to page 1 if current page is beyond available pages
  const maxPage = Math.ceil(filtered.length / itemsPerPage);
  if (currentPage > maxPage && maxPage > 0) {
    setCurrentPage(1);
  }
  
}, [globalLiveAlarms, alarms, searchTerm, statusFilter, typeFilter, severityFilter, resolvedAlarms, currentPage, itemsPerPage]);


  // Calculate pagination
  const calculatePagination = useCallback(() => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    const paginated = filteredAlarms.slice(startIndex, endIndex);

    return {
      paginatedAlarms: paginated,
      totalPages: Math.ceil(filteredAlarms.length / itemsPerPage)
    };
  }, [filteredAlarms, currentPage, itemsPerPage]);

  // Handle selection changes
  const handleSelectAlarm = (alarmId) => {
    setSelectedAlarms(prev => {
      const newSet = new Set(prev);
      if (newSet.has(alarmId)) {
        newSet.delete(alarmId);
      } else {
        newSet.add(alarmId);
      }
      return newSet;
    });
  };

  const handleSelectAllToggle = () => {
    const { paginatedAlarms } = calculatePagination();
    if (selectAll) {
      setSelectedAlarms(new Set());
    } else {
      const allIds = paginatedAlarms.map(alarm => alarm.alarmId);
      setSelectedAlarms(new Set(allIds));
    }
    setSelectAll(!selectAll);
  };

  // Export alarms to CSV/JSON
  const exportAlarms = async () => {
    try {
      setExportLoading(true);
      const mergedAlarms = mergeAlarms();

      if (exportFormat === 'csv') {
        const headers = ['ID', 'Type', 'Description', 'Device', 'Status', 'Severity', 'Time', 'Location', 'Speed', 'Acceleration'];
        const csvContent = [
          headers.join(','),
          ...mergedAlarms.map(alarm => [
            alarm.alarmId,
            alarm.alarmType,
            `"${alarm.description}"`,
            alarm.deviceId,
            getAlarmStatus(alarm),
            alarm.severity,
            alarm.alarmTime,
            alarm.latitude && alarm.longitude ? `${alarm.latitude},${alarm.longitude}` : 'N/A',
            alarm.speed !== null ? `${parseFloat(alarm.speed).toFixed(2)} km/h` : 'N/A',
            alarm.acceleration !== null ? `${parseFloat(alarm.acceleration).toFixed(2)} m/s²` : 'N/A'
          ].join(','))
        ].join('\n');

        const blob = new Blob([csvContent], { type: 'text/csv' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `alarms-${new Date().toISOString().split('T')[0]}.csv`;
        a.click();
        URL.revokeObjectURL(url);
      } else {
        const jsonContent = JSON.stringify(mergedAlarms, null, 2);
        const blob = new Blob([jsonContent], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `alarms-${new Date().toISOString().split('T')[0]}.json`;
        a.click();
        URL.revokeObjectURL(url);
      }

      setShowExportModal(false);
      console.log(`✅ Alarms exported as ${exportFormat.toUpperCase()}`);
    } catch (error) {
      console.error('❌ Export failed:', error);
    } finally {
      setExportLoading(false);
    }
  };

  // Initialize component
  useEffect(() => {
    console.log('🚀 EventBasedAlarmTable initializing...');
    initializeAlarms();
    requestNotificationPermission();

    // Initialize audio element
    audioRef.current = new Audio('/alarm-sound.mp3');
    audioRef.current.preload = 'auto';

    return () => {
      stopLocalSSEStream();
    };
  }, [initializeAlarms, stopLocalSSEStream]);

  // Start/stop local SSE based on enabled state
  useEffect(() => {
    if (localStreamEnabled) {
      startLocalSSEStream();
    } else {
      stopLocalSSEStream();
    }
  }, [localStreamEnabled, startLocalSSEStream, stopLocalSSEStream]);

  // Apply filters when dependencies change
  useEffect(() => {
    applyFiltersAndSearch();
  }, [applyFiltersAndSearch]);

  // Reset page when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, statusFilter, typeFilter, severityFilter]);

  // Calculate current page data
  const { paginatedAlarms, totalPages } = calculatePagination();

  const openDeviceMapModal = (device) => {
  setSelectedDeviceForModal(device);
  setDeviceModalOpen(true);
};

  return (
    <div className="w-full space-y-6">
      {/* Header with Controls */}
      <div className="p-6 bg-white border border-gray-200 rounded-lg shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">Alarm Management</h2>
            <p className="text-gray-600">Live Alarm Management System</p>
          </div>
          <div className="flex items-center space-x-4">
            {/* Global Stream Status */}
            <div className="flex items-center">
              <div className={`w-3 h-3 rounded-full mr-2 ${globalStreamActive ? 'bg-green-500 animate-pulse' : 'bg-gray-400'}`}></div>
              <span className="text-sm text-gray-600">
                Global: {globalStreamActive ? 'Connected' : 'Disconnected'}
              </span>
            </div>

            {/* Local Stream Status */}
            <div className="flex items-center">
              <div className={`w-3 h-3 rounded-full mr-2 ${isLocalStreamConnected ? 'bg-green-500 animate-pulse' : 'bg-gray-400'}`}></div>
              <span className="text-sm text-gray-600">
                Local: {isLocalStreamConnected ? 'Connected' : 'Disconnected'}
              </span>
            </div>

            {/* Sound Toggle */}
            <button
              onClick={() => setSoundEnabled(!soundEnabled)}
              className={`p-2 rounded-lg ${soundEnabled ? 'bg-blue-100 text-blue-600 hover:bg-blue-200' : 'bg-gray-100 text-gray-400 hover:bg-gray-200'} transition-colors`}
              title={soundEnabled ? 'Disable sound' : 'Enable sound'}
            >
              {soundEnabled ? <Bell className="w-4 h-4" /> : <BellOff className="w-4 h-4" />}
            </button>

            {/* Local Stream Toggle */}
            <button
              onClick={() => setLocalStreamEnabled(!localStreamEnabled)}
              className={`flex items-center px-3 py-2 rounded-lg text-sm font-medium ${
                localStreamEnabled
                  ? 'bg-green-100 text-green-700 hover:bg-green-200'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              } transition-colors`}
              title={localStreamEnabled ? 'Pause local stream' : 'Resume local stream'}
            >
              {localStreamEnabled ? <Wifi className="w-4 h-4 mr-1" /> : <WifiOff className="w-4 h-4 mr-1" />}
              Local Stream
            </button>

            {/* Export Button */}
            <button
              onClick={() => setShowExportModal(true)}
              className="flex items-center px-3 py-2 text-white transition-colors bg-blue-600 rounded-lg hover:bg-blue-700"
              title="Export alarms as CSV or JSON"
            >
              <Download className="w-4 h-4 mr-2" />
              Export
            </button>
          </div>
        </div>

        {/* Statistics Summary */}
        <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
          <div className="p-4 bg-white border border-gray-200 rounded-lg shadow-sm">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <Zap className="w-8 h-8 text-blue-500" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Total Alarms</p>
                <p className="text-2xl font-semibold text-gray-900">{totalItems}</p>
              </div>
            </div>
          </div>

          <div className="p-4 bg-white border border-gray-200 rounded-lg shadow-sm">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <AlertTriangle className="w-8 h-8 text-red-500" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Active Alarms</p>
                <p className="text-2xl font-semibold text-gray-900">
                  {filteredAlarms.filter(alarm => getAlarmStatus(alarm) === 'active').length}
                </p>
              </div>
            </div>
          </div>

          <div className="p-4 bg-white border border-gray-200 rounded-lg shadow-sm">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <CheckCircle className="w-8 h-8 text-green-500" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Resolved</p>
                <p className="text-2xl font-semibold text-gray-900">
                  {filteredAlarms.filter(alarm => getAlarmStatus(alarm) === 'resolved').length}
                </p>
              </div>
            </div>
          </div>

          <div className="p-4 bg-white border border-gray-200 rounded-lg shadow-sm">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <Zap className="w-8 h-8 text-teal-500" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Speed Violations</p>
                <p className="text-2xl font-semibold text-gray-900">
                  {filteredAlarms.filter(alarm => alarm.speed !== null && alarm.speed > 0).length}
                </p>
              </div>
            </div>
          </div>
        </div>
        <br></br>

        {/* Filters and Search */}
        <div className="grid grid-cols-1 gap-4 md:grid-cols-5">
          {/* Search */}
          <div className="relative">
            <Search className="absolute w-4 h-4 text-gray-400 transform -translate-y-1/2 left-3 top-1/2" />
            <input
              type="text"
              placeholder="Search alarms..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full py-2 pl-10 pr-4 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>

          {/* Status Filter */}
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
          >
            <option value="all">All Statuses</option>
            <option value="active">Active</option>
            <option value="resolved">Resolved</option>
          </select>

          {/* Type Filter */}
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
          >
            <option value="all">All Types</option>
            <option value="Speed">Speed Violation</option>
            <option value="Drowsiness">Drowsiness</option>
            <option value="Collision">Collision</option>
            <option value="RashDriving">Rash Driving</option>
          </select>

          {/* Severity Filter */}
          <select
            value={severityFilter}
            onChange={(e) => setSeverityFilter(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
          >
            <option value="all">All Severities</option>
            <option value="critical">Critical</option>
            <option value="high">High</option>
            <option value="medium">Medium</option>
            <option value="low">Low</option>
          </select>

          {/* Items Per Page */}
          <select
            value={itemsPerPage}
            onChange={(e) => setItemsPerPage(Number(e.target.value))}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
          >
            <option value="10">10 per page</option>
            <option value="25">25 per page</option>
            <option value="50">50 per page</option>
            <option value="100">100 per page</option>
          </select>
        </div>

        {/* Bulk Actions */}
        {selectedAlarms.size > 0 && (
          <div className="flex items-center justify-between p-3 mt-4 border border-blue-200 rounded-lg bg-blue-50">
            <span className="text-sm text-blue-700">
              {selectedAlarms.size} alarm(s) selected
            </span>
            <button
              onClick={bulkResolveAlarms}
              className="px-4 py-2 text-white transition-colors bg-blue-600 rounded-lg hover:bg-blue-700"
              title="Resolve all selected alarms"
            >
              Resolve Selected
            </button>
          </div>
        )}
      </div>

      {/* Main Alarm Table */}
      <div className="bg-white border border-gray-200 rounded-lg shadow-sm">
        <div className="overflow-x-auto">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <RefreshCw className="w-6 h-6 mr-3 text-blue-500 animate-spin" />
              <span className="text-gray-600">Loading historical alarms...</span>
            </div>
          ) : paginatedAlarms.length === 0 ? (
            <div className="py-12 text-center">
              <Zap className="w-12 h-12 mx-auto mb-4 text-yellow-400" />
              <h3 className="mb-2 text-lg font-medium text-gray-900">No Alarms Found</h3>
              <p className="text-gray-600">
                {searchTerm || statusFilter !== 'all' || typeFilter !== 'all' || severityFilter !== 'all'
                  ? 'No alarms match your current filters.'
                  : 'No alarms received yet. System is ready for real-time SSE events.'}
              </p>
            </div>
          ) : (
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-xs font-medium tracking-wider text-left text-gray-500 uppercase">
                    <input
                      type="checkbox"
                      checked={selectAll}
                      onChange={handleSelectAllToggle}
                      className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                    />
                  </th>
                  <th className="px-6 py-3 text-xs font-medium tracking-wider text-left text-gray-500 uppercase">
                    Alarm Details
                  </th>
                  <th className="px-6 py-3 text-xs font-medium tracking-wider text-left text-gray-500 uppercase">
                    Device & Location
                  </th>
                  <th className="px-6 py-3 text-xs font-medium tracking-wider text-left text-gray-500 uppercase">
                    Metrics
                  </th>
                  <th className="px-6 py-3 text-xs font-semibold text-left text-gray-500">Speed</th>
                  <th className="px-6 py-3 text-xs font-semibold text-left text-gray-500">Acceleration</th>
                  <th className="px-6 py-3 text-xs font-medium tracking-wider text-left text-gray-500 uppercase">
                    Status
                  </th>
                  <th className="px-6 py-3 text-xs font-medium tracking-wider text-left text-gray-500 uppercase">
                    Time
                  </th>
                  <th className="px-6 py-3 text-xs font-medium tracking-wider text-left text-gray-500 uppercase">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {paginatedAlarms.map((alarm) => {
                  const status = getAlarmStatus(alarm);
                  const isSelected = selectedAlarms.has(alarm.alarmId);
                  const isResolved = status === 'resolved';
                  const isGlobalSSE = alarm.source === 'global_sse';
                  const isLocalSSE = alarm.source === 'local_sse';
                  const hasImage = !!(alarm.previewUrl || alarm.downloadUrl);
                  const isPreviewValid = isValidUrl(alarm.previewUrl);
                  

                  return (
                    <tr
                      key={alarm.alarmId}
                      className={`hover:bg-gray-50 ${
                        alarm.isLive
                          ? isGlobalSSE
                            ? 'bg-red-50 border-l-4 border-red-500'
                            : 'bg-blue-50 border-l-4 border-blue-500'
                          : isResolved
                            ? 'opacity-60'
                            : ''
                      }`}
                    >
                      <td className="px-6 py-4 whitespace-nowrap">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => handleSelectAlarm(alarm.alarmId)}
                          disabled={isResolved}
                          className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                        />
                      </td>

                      <td className="px-6 py-4">
                        <div className="flex items-start space-x-3">
                          <div className="flex-shrink-0">
                            <AlertTriangle className={`w-6 h-6 ${
                              alarm.severity === 'critical' ? 'text-red-500' :
                              alarm.severity === 'high' ? 'text-orange-500' :
                              alarm.severity === 'medium' ? 'text-yellow-500' :
                              'text-blue-500'
                            }`} />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center mb-1 space-x-2">
                              <p className="text-sm font-medium text-gray-900 truncate">
                                {alarm.alarmType}
                              </p>
                              <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${getSeverityColor(alarm.severity)}`}>
                                {alarm.severity}
                              </span>
                              {alarm.isLive && (
                                <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                                  isGlobalSSE ? 'bg-red-100 text-red-800' : 'bg-blue-100 text-blue-800'
                                }`}>
                                  <div className="w-1.5 h-1.5 bg-current rounded-full mr-1 animate-pulse"></div>
                                  {isGlobalSSE ? 'Global Live' : 'Local Live'}
                                </span>
                              )}
                            </div>
                            <p className="text-sm text-gray-600 line-clamp-2">
                              {alarm.description}
                            </p>
                            <p className="mt-1 text-xs text-gray-500">
                              ID: {alarm.alarmId}
                            </p>
                          </div>
                        </div>
                      </td>

                      <td className="px-6 py-4">
                        <div className="text-sm">
                          <div className="flex items-center mb-1 text-gray-900">
                            <Activity className="w-4 h-4 mr-1" />
                            Device: {alarm.deviceId || 'Unknown'}
                          </div>
                          {alarm.latitude && alarm.longitude && (
                            <div className="flex items-center text-gray-600">
                              <MapPin className="w-4 h-4 mr-1" />
                              {parseFloat(alarm.latitude).toFixed(4)}, {parseFloat(alarm.longitude).toFixed(4)}
                            </div>
                          )}
                        </div>
                      </td>

                      <td className="px-6 py-4">
                        <div className="space-y-1 text-sm">
                          <div className="text-gray-900">
                           Drowsiness:{alarm.drowsiness != null ? (alarm.drowsiness ? 'Yes' : 'No') : 'N/A'}
                          </div>
                          <div className="text-gray-600">
                            Rash Driving:{alarm.rashDriving != null ? (alarm.rashDriving ? 'Yes' : 'No') : 'N/A'}
                          </div>
                          <div className="text-gray-600">
                          Collision:{alarm.collision != null ? (alarm.collision ? 'Yes' : 'No') : 'N/A'}
                          </div>
                        </div>
                      </td>
                        <td className="px-4 py-2 text-sm text-gray-700">
                       {alarm.speed != null ? `${alarm.speed} km/h` : 'N/A'}
                      </td>
                      <td className="px-4 py-2 text-sm text-gray-700">
                        {alarm.acceleration != null ? `${alarm.acceleration} m/s²` : 'N/A'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(status)}`}>
                          {status === 'active' && <AlertTriangle className="w-3 h-3 mr-1" />}
                          {status === 'resolved' && <CheckCircle className="w-3 h-3 mr-1" />}
                          {status.charAt(0).toUpperCase() + status.slice(1)}
                        </span>
                      </td>

                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm">
                          <div className="text-gray-900">
                            {new Date(alarm.alarmTime).toLocaleString()}
                          </div>
                          <div className="text-gray-500">
                            {timeAgo(alarm.alarmTime)}
                          </div>
                        </div>
                      </td>

                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center space-x-2">
                          <button
                            onClick={() => viewAlarmDetails(alarm)}
                            className={`p-2 rounded-lg text-blue-600 hover:bg-blue-100 hover:text-blue-800 transition-colors ${
                              isResolved ? 'opacity-50 cursor-not-allowed' : ''
                            }`}
                            title="View alarm details"
                            disabled={isResolved}
                          >
                            <Eye className="w-4 h-4" />
                          </button>

                          {status !== 'resolved' && (
                            <button
                              onClick={() => resolveAlarm(alarm.alarmId)}
                              className={`p-2 rounded-lg text-green-600 hover:bg-green-100 hover:text-green-800 transition-colors ${
                                isResolved ? 'opacity-50 cursor-not-allowed' : ''
                              }`}
                              title="Resolve alarm"
                              disabled={isResolved}
                            >
                              <CheckCircle className="w-4 h-4" />
                            </button>
                          )}

                          <button
                            onClick={() => isPreviewValid && window.open(alarm.previewUrl, '_blank')}
                            className={`p-2 rounded-lg text-purple-600 hover:bg-purple-100 hover:text-purple-800 transition-colors ${
                              !isPreviewValid ? 'opacity-50 cursor-not-allowed' : ''
                            }`}
                            title={isPreviewValid ? 'Preview alarm image' : 'No image available'}
                            disabled={!isPreviewValid}
                          >
                            <ExternalLink className="w-4 h-4" />
                          </button>

                          <button
                            onClick={() => downloadAlarmBundle(alarm)}
                            className={`p-2 rounded-lg text-indigo-600 hover:bg-indigo-100 hover:text-indigo-800 transition-colors ${
                              !hasImage ? 'opacity-50 cursor-not-allowed' : ''
                            }`}
                            title={hasImage ? 'Download alarm bundle' : 'No image available'}
                            disabled={!hasImage}
                          >
                            <FileDown className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="px-6 py-4 border-t border-gray-200">
            <div className="flex items-center justify-between">
              <div className="text-sm text-gray-600">
                Showing {((currentPage - 1) * itemsPerPage) + 1} to {Math.min(currentPage * itemsPerPage, totalItems)} of {totalItems} results
              </div>

              <div className="flex items-center space-x-2">
                <button
                  onClick={() => setCurrentPage(1)}
                  disabled={currentPage === 1}
                  className="p-2 border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                  title="Go to first page"
                >
                  <ChevronsLeft className="w-4 h-4" />
                </button>

                <button
                  onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                  disabled={currentPage === 1}
                  className="p-2 border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                  title="Previous page"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>

                <span className="px-3 py-2 text-sm text-gray-700">
                  Page {currentPage} of {totalPages}
                </span>

                <button
                  onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                  disabled={currentPage === totalPages}
                  className="p-2 border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                  title="Next page"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>

                <button
                  onClick={() => setCurrentPage(totalPages)}
                  disabled={currentPage === totalPages}
                  className="p-2 border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                  title="Go to last page"
                >
                  <ChevronsRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* View Alarm Modal */}
      {showViewModal && selectedAlarmForView && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
          <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-gray-900">Alarm Details</h3>
                <button
                  onClick={() => setShowViewModal(false)}
                  className="text-gray-400 hover:text-gray-600"
                  title="Close modal"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>

              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Alarm ID</label>
                    <p className="mt-1 text-sm text-gray-900">{selectedAlarmForView.alarmId}</p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Type</label>
                    <p className="mt-1 text-sm text-gray-900">{selectedAlarmForView.alarmType}</p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Severity</label>
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${getSeverityColor(selectedAlarmForView.severity)}`}>
                      {selectedAlarmForView.severity}
                    </span>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Status</label>
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(getAlarmStatus(selectedAlarmForView))}`}>
                      {getAlarmStatus(selectedAlarmForView)}
                    </span>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Device ID</label>
                    <p className="mt-1 text-sm text-gray-900">{selectedAlarmForView.deviceId || 'Unknown'}</p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Time</label>
                    <p className="mt-1 text-sm text-gray-900">
                      {new Date(selectedAlarmForView.alarmTime).toLocaleString()}
                    </p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Speed</label>
                    <p className="mt-1 text-sm text-gray-900">
                      {selectedAlarmForView.speed !== null ? `${parseFloat(selectedAlarmForView.speed).toFixed(2)} km/h` : 'N/A'}
                    </p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Acceleration</label>
                    <p className="mt-1 text-sm text-gray-900">
                      {selectedAlarmForView.acceleration !== null ? `${parseFloat(selectedAlarmForView.acceleration).toFixed(2)} m/s²` : 'N/A'}
                    </p>
                  </div>
                  <div><strong>Drowsiness:</strong> {selectedAlarmForView.drowsiness != null ? (selectedAlarmForView.drowsiness ? 'Yes' : 'No') : 'N/A'}</div>
                  <div><strong>Rash Driving:</strong> {selectedAlarmForView.rashDriving != null ? (selectedAlarmForView.rashDriving ? 'Yes' : 'No') : 'N/A'}</div>
                  <div><strong>Collision:</strong> {selectedAlarmForView.collision != null ? (selectedAlarmForView.collision ? 'Yes' : 'No') : 'N/A'}</div>
                 

                <div>
                  <label className="block text-sm font-medium text-gray-700">Description</label>
                  <p className="mt-1 text-sm text-gray-900">{selectedAlarmForView.description}</p>
                </div>

                {(selectedAlarmForView.latitude && selectedAlarmForView.longitude) && (
  <div className="col-span-2">
    <label className="block text-sm font-medium text-gray-700">Location</label>
    <p
      onClick={() =>
        openDeviceMapModal({
          vehicle_id: selectedAlarmForView.device_id,
          latitude: selectedAlarmForView.latitude,
          longitude: selectedAlarmForView.longitude
        })
      }
      className="mt-1 text-sm text-blue-600 underline cursor-pointer hover:text-blue-800"
    >
      {parseFloat(selectedAlarmForView.latitude).toFixed(6)}, {parseFloat(selectedAlarmForView.longitude).toFixed(6)}
    </p>
  </div>
)}
 </div>


                

                {selectedAlarmForView.previewUrl && isValidUrl(selectedAlarmForView.previewUrl) && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Preview Image</label>
                    <img
                      src={selectedAlarmForView.previewUrl}
                      alt="Alarm preview"
                      className="h-auto max-w-full mt-2 border border-gray-300 rounded-lg"
                      onError={(e) => {
                        e.target.style.display = 'none';
                        console.error('❌ Failed to load image in modal:', selectedAlarmForView.previewUrl);
                      }}
                    />
                  </div>
                )}

                <div className="flex justify-end pt-4 space-x-3">
                  {getAlarmStatus(selectedAlarmForView) !== 'resolved' && (
                    <button
                      onClick={() => {
                        resolveAlarm(selectedAlarmForView.alarmId);
                        setShowViewModal(false);
                      }}
                      className="px-4 py-2 text-white transition-colors bg-green-600 rounded-lg hover:bg-green-700"
                      title="Resolve alarm"
                    >
                      Resolve
                    </button>
                  )}

                  <button
                    onClick={() => setShowViewModal(false)}
                    className="px-4 py-2 text-white transition-colors bg-gray-600 rounded-lg hover:bg-gray-700"
                    title="Close modal"
                  >
                    Close
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Export Modal */}
      {showExportModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
          <div className="w-full max-w-md mx-4 bg-white rounded-lg shadow-xl">
            <div className="p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-gray-900">Export Alarms</h3>
                <button
                  onClick={() => setShowExportModal(false)}
                  className="text-gray-400 hover:text-gray-600"
                  title="Close modal"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block mb-2 text-sm font-medium text-gray-700">Export Format</label>
                  <select
                    value={exportFormat}
                    onChange={(e) => setExportFormat(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="csv">CSV</option>
                    <option value="json">JSON</option>
                  </select>
                </div>

                <div className="text-sm text-gray-600">
                  This will export {totalItems} alarm records in {exportFormat.toUpperCase()} format.
                </div>

                <div className="flex justify-end pt-4 space-x-3">
                  <button
                    onClick={() => setShowExportModal(false)}
                    className="px-4 py-2 text-white transition-colors bg-gray-600 rounded-lg hover:bg-gray-700"
                    title="Cancel export"
                  >
                    Cancel
                  </button>

                  <button
                    onClick={exportAlarms}
                    disabled={exportLoading}
                    className="px-4 py-2 text-white transition-colors bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                    title="Export alarms"
                  >
                    {exportLoading ? (
                      <>
                        <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                        Exporting...
                      </>
                    ) : (
                      <>
                        <Download className="w-4 h-4 mr-2" />
                        Export
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
        
      )}


      {deviceModalOpen && selectedDeviceForModal && (
  <DeviceInfoModal
    isOpen={deviceModalOpen}
    onClose={() => {
      setDeviceModalOpen(false);
      setSelectedDeviceForModal(null);
    }}
    device={selectedDeviceForModal}
  />
)}
    </div>
  );
};

// Helper function for time ago display
const timeAgo = (timestamp) => {
  const now = new Date();
  const time = new Date(timestamp);
  const diffInSeconds = Math.floor((now - time) / 1000);

  if (diffInSeconds < 60) return `${diffInSeconds}s ago`;
  if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)}m ago`;
  if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)}h ago`;
  return `${Math.floor(diffInSeconds / 86400)}d ago`;
};

export default EventBasedAlarmTable;