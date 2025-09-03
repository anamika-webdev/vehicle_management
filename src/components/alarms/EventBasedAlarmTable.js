import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { 
  AlertTriangle, 
  CheckCircle, 
  Eye, 
  ExternalLink, 
  FileDown, 
  RefreshCw, 
  Search, 
  Filter, 
  Download, 
  X,
  Zap,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  MapPin
} from 'lucide-react';
import JSZip from 'jszip';
import apiService from '../../services/api';
import DeviceInfoModal from '../devices/DeviceInfoModal';

const EventBasedAlarmTable = ({ 
  globalLiveAlarms = [], 
  globalStreamActive = false,
  persistentAlarms = [],
  onAlarmAcknowledge,
  onAlarmResolve,
  tableRefreshTrigger = 0,
  refreshTrigger = 0,
  className = "" 
}) => {
  // State management
  const [alarms, setAlarms] = useState([]);
  const [filteredAlarms, setFilteredAlarms] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [typeFilter, setTypeFilter] = useState('all');
  const [severityFilter, setSeverityFilter] = useState('all');
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(25);
  const [totalItems, setTotalItems] = useState(0);
  const [selectedAlarms, setSelectedAlarms] = useState(new Set());
  const [selectAll, setSelectAll] = useState(false);
  const [resolvedAlarms, setResolvedAlarms] = useState(new Set());
  const [showViewModal, setShowViewModal] = useState(false);
  const [selectedAlarmForView, setSelectedAlarmForView] = useState(null);
  const [showExportModal, setShowExportModal] = useState(false);
  const [exportFormat, setExportFormat] = useState('csv');
  const [exportLoading, setExportLoading] = useState(false);
  const [deviceModalOpen, setDeviceModalOpen] = useState(false);
  const [selectedDeviceForModal, setSelectedDeviceForModal] = useState(null);
  const [lastUpdate, setLastUpdate] = useState(Date.now());
  const audioRef = useRef(null);

  // Helper function to get auth token
  const getAuthToken = () => {
    return localStorage.getItem('authToken') || '';
  };

  // Helper function to validate URLs
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

  // ENHANCED: Fixed normalize alarm data format with proper drowsiness detection
  const normalizeAlarm = (alarm, isFromGlobal = false) => {
    const normalized = {
      alarmId: alarm.alarmId || alarm.id || alarm.alert_id || alarm.alarm_id || `alarm_${Date.now()}_${Math.random()}`,
      deviceId: alarm.deviceId || alarm.device_id,
      speed: alarm.hasOwnProperty('speed') ? parseFloat(alarm.speed) : null,
      acceleration: alarm.hasOwnProperty('acceleration') ? parseFloat(alarm.acceleration) : null,
      
      // FIXED: Handle drowsiness exactly like rashDriving and collision
      drowsiness: (() => {
        // Check for drowsiness field - could be boolean, number, or string
        if (alarm.drowsiness !== undefined && alarm.drowsiness !== null) {
          // If it's already a number, return it
          if (typeof alarm.drowsiness === 'number') {
            return alarm.drowsiness;
          }
          // If it's a string, try to parse as number
          const parsed = parseFloat(alarm.drowsiness);
          if (!isNaN(parsed)) {
            return parsed;
          }
          // If it's a boolean or string boolean, convert to number (like rashDriving/collision)
          if (alarm.drowsiness === true || alarm.drowsiness === 'true' || alarm.drowsiness === '1') {
            return 100; // High drowsiness
          }
          if (alarm.drowsiness === false || alarm.drowsiness === 'false' || alarm.drowsiness === '0') {
            return 0; // No drowsiness
          }
        }
        
        // Check for alternative field names (same pattern as rashDriving)
        if (alarm.drowsiness_level !== undefined && alarm.drowsiness_level !== null) {
          const parsed = parseFloat(alarm.drowsiness_level);
          if (!isNaN(parsed)) {
            return parsed;
          }
        }
        
        // Check nested telemetry (same pattern as rashDriving)
        if (alarm.telemetry && alarm.telemetry.drowsiness !== undefined) {
          const parsed = parseFloat(alarm.telemetry.drowsiness);
          if (!isNaN(parsed)) {
            return parsed;
          }
        }
        
        return null;
      })(),
      
      // Proper handling of rash driving boolean values
      rashDriving: (() => {
        if (alarm.rashDriving !== undefined && alarm.rashDriving !== null) {
          return alarm.rashDriving === true || alarm.rashDriving === 'true' || alarm.rashDriving === 1 || alarm.rashDriving === '1';
        }
        if (alarm.rash_driving !== undefined && alarm.rash_driving !== null) {
          return alarm.rash_driving === true || alarm.rash_driving === 'true' || alarm.rash_driving === 1 || alarm.rash_driving === '1';
        }
        return null;
      })(),
      
      // Proper handling of collision boolean values
      collision: (() => {
        if (alarm.collision !== undefined && alarm.collision !== null) {
          return alarm.collision === true || alarm.collision === 'true' || alarm.collision === 1 || alarm.collision === '1';
        }
        if (alarm.collision_detected !== undefined && alarm.collision_detected !== null) {
          return alarm.collision_detected === true || alarm.collision_detected === 'true' || alarm.collision_detected === 1 || alarm.collision_detected === '1';
        }
        return null;
      })(),
      
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
      source: isFromGlobal ? 'global_stream' : (alarm.source || 'historical'),
      resolved: alarm.resolved || false,
      _priority: isFromGlobal ? 1 : 2,
      _lastUpdate: new Date().toISOString()
    };

    // Debug logging for metrics
    console.log('🔍 Normalized alarm metrics for', normalized.alarmId, ':', {
      drowsiness: normalized.drowsiness,
      rashDriving: normalized.rashDriving,
      collision: normalized.collision
    });

    return normalized;
  };

  // View alarm details
  const viewAlarmDetails = (alarm) => {
    setSelectedAlarmForView(alarm);
    setShowViewModal(true);
  };

  // Resolve alarm function
  const resolveAlarm = async (alarmId) => {
    if (!alarmId) {
      console.error('❌ No alarm ID provided for resolve');
      return;
    }

    try {
      console.log(`🔧 Resolving alarm: ${alarmId}`);
      
      // Call the resolve API endpoint
      const response = await fetch(`http://164.52.194.198:9090/alarm/v1/resolve`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${getAuthToken()}`
        },
        body: JSON.stringify({
          alarmID: alarmId,
          isResolved: true
        })
      });

      console.log(`📡 Resolve API response status: ${response.status}`);

      if (response.ok) {
        const result = await response.text();
        console.log('✅ Resolve API response:', result);

        // Update local state immediately for better UX
        setResolvedAlarms(prev => new Set([...prev, alarmId]));
        
        // Call parent handler if provided
        if (onAlarmResolve && typeof onAlarmResolve === 'function') {
          try {
            await onAlarmResolve(alarmId);
          } catch (parentError) {
            console.warn('⚠️ Parent resolve handler failed:', parentError);
          }
        }
        
        console.log(`✅ Alarm ${alarmId} resolved successfully`);
        
      } else {
        const errorText = await response.text();
        console.error(`❌ Resolve API failed: ${response.status} - ${errorText}`);
      }
      
    } catch (error) {
      console.error('❌ Resolve alarm error:', error);
    }
  };

  // Bulk resolve alarms
  const bulkResolveAlarms = async () => {
    if (selectedAlarms.size === 0) return;
    
    try {
      const alarmIds = Array.from(selectedAlarms);
      console.log(`🔧 Bulk resolving ${alarmIds.length} alarms:`, alarmIds);
      
      const promises = alarmIds.map(alarmId => resolveAlarm(alarmId));
      await Promise.allSettled(promises);
      
      setSelectedAlarms(new Set());
      setSelectAll(false);
      
      console.log(`✅ Bulk resolved ${alarmIds.length} alarms`);
      
    } catch (error) {
      console.error('❌ Bulk resolve error:', error);
    }
  };

  // Enhanced refresh mechanism
  const forceTableUpdate = useCallback(() => {
    console.log('🔄 Force updating alarm table...');
    setLastUpdate(new Date().toISOString());
    
    // Trigger a brief loading state to show refresh
    setLoading(true);
    setTimeout(() => setLoading(false), 300);
  }, []);

  // Download alarm bundle
  const downloadAlarmBundle = async (alarm) => {
    try {
      console.log(`📥 Downloading alarm bundle for ${alarm.alarmId}...`);
      const zip = new JSZip();

      const alarmDetails = {
        alarmId: alarm.alarmId,
        deviceId: alarm.deviceId,
        alarmType: alarm.alarmType,
        description: alarm.description,
        severity: alarm.severity,
        status: getAlarmStatus(alarm),
        timestamp: alarm.alarmTime,
        location: alarm.latitude && alarm.longitude ? 
          `${parseFloat(alarm.latitude).toFixed(6)}, ${parseFloat(alarm.longitude).toFixed(6)}` : 'N/A',
        speed: alarm.speed !== undefined && alarm.speed !== null ? alarm.speed : 'N/A',
        acceleration: alarm.acceleration !== undefined && alarm.acceleration !== null ? alarm.acceleration : 'N/A',
        drowsiness: alarm.drowsiness !== null && alarm.drowsiness !== undefined ? `${alarm.drowsiness}%` : 'N/A'
      };

      zip.file(`alarm-${alarm.alarmId}-details.json`, JSON.stringify(alarmDetails, null, 2));

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
      }

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

  // Export alarms
  const exportAlarms = async () => {
    try {
      setExportLoading(true);
      console.log(`📤 Exporting ${filteredAlarms.length} alarms as ${exportFormat}`);

      const exportData = filteredAlarms.map(alarm => ({
        alarmId: alarm.alarmId,
        deviceId: alarm.deviceId,
        type: alarm.alarmType,
        severity: alarm.severity,
        status: getAlarmStatus(alarm),
        description: alarm.description,
        timestamp: alarm.alarmTime,
        speed: alarm.speed,
        acceleration: alarm.acceleration,
        drowsiness: alarm.drowsiness,
        rashDriving: alarm.rashDriving,
        collision: alarm.collision,
        location: alarm.latitude && alarm.longitude ? 
          `${alarm.latitude.toFixed(6)}, ${alarm.longitude.toFixed(6)}` : 'N/A',
        source: alarm.source
      }));

      if (exportFormat === 'csv') {
        const headers = Object.keys(exportData[0]).join(',');
        const csvContent = [
          headers,
          ...exportData.map(row => Object.values(row).map(val => 
            typeof val === 'string' && val.includes(',') ? `"${val}"` : val
          ).join(','))
        ].join('\n');

        const blob = new Blob([csvContent], { type: 'text/csv' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `alarms-export-${new Date().toISOString().split('T')[0]}.csv`;
        a.click();
        URL.revokeObjectURL(url);
      } else {
        const jsonContent = JSON.stringify(exportData, null, 2);
        const blob = new Blob([jsonContent], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `alarms-export-${new Date().toISOString().split('T')[0]}.json`;
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

  // Initialize alarm table with historical data
  const initializeAlarms = useCallback(async () => {
    try {
      setLoading(true);
      console.log('🔄 Loading historical alarms...');

      const response = await apiService.getManagerAlarms(0, 500);
      console.log('📊 Historical alarms response:', response);

      if (response.success && response.data) {
        const normalizedAlarms = response.data.map(alarm => normalizeAlarm(alarm, false));
        setAlarms(normalizedAlarms);
        setTotalItems(response.total || normalizedAlarms.length);
        console.log(`✅ Loaded ${normalizedAlarms.length} historical alarms`);
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

  // Listen for external refresh events
  useEffect(() => {
    const handleAlarmTableRefresh = (event) => {
      console.log('🔄 Received external refresh event:', event.detail);
      forceTableUpdate();
    };

    window.addEventListener('alarmTableRefresh', handleAlarmTableRefresh);
    
    return () => {
      window.removeEventListener('alarmTableRefresh', handleAlarmTableRefresh);
    };
  }, [forceTableUpdate]);

  // Watch for tableRefreshTrigger prop changes
  useEffect(() => {
    if (tableRefreshTrigger > 0) {
      console.log('🔄 Table refresh triggered by prop:', tableRefreshTrigger);
      forceTableUpdate();
    }
  }, [tableRefreshTrigger, forceTableUpdate]);

  // Update alarms when global live alarms or filters change
  useEffect(() => {
    console.log('🔄 Updating alarm table...');
    
    // Merge live and historical alarms
    const mergedAlarms = [
      ...globalLiveAlarms.map(alarm => normalizeAlarm(alarm, true)),
      ...alarms
    ];

    // Apply filters
    const filtered = mergedAlarms.filter(alarm => {
      // Search filter
      if (searchTerm) {
        const search = searchTerm.toLowerCase();
        const matches = [
          alarm.alarmId,
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

    // Sort by priority and time (newest first)
    filtered.sort((a, b) => {
      // First by priority (global alarms first)
      if (a._priority !== b._priority) {
        return a._priority - b._priority;
      }
      // Then by time (newest first)
      return new Date(b.alarmTime || b.timestamp) - new Date(a.alarmTime || a.timestamp);
    });

    // Update state
    setFilteredAlarms(filtered);
    setTotalItems(filtered.length);
    
    console.log(`📊 Table updated: ${filtered.length} filtered alarms from ${mergedAlarms.length} total (${globalLiveAlarms.length} live + ${alarms.length} historical)`);
    
    // Reset to page 1 if current page is beyond available pages
    const maxPage = Math.ceil(filtered.length / itemsPerPage);
    if (currentPage > maxPage && maxPage > 0) {
      setCurrentPage(1);
    }
    
  }, [globalLiveAlarms, alarms, searchTerm, statusFilter, typeFilter, severityFilter, resolvedAlarms, currentPage, itemsPerPage, lastUpdate]);

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

  // Get paginated data
  const { paginatedAlarms, totalPages } = calculatePagination();

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
    if (selectAll) {
      setSelectedAlarms(new Set());
    } else {
      const allIds = paginatedAlarms.map(alarm => alarm.alarmId);
      setSelectedAlarms(new Set(allIds));
    }
    setSelectAll(!selectAll);
  };

  // Request notification permission
  const requestNotificationPermission = () => {
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission();
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
  }, [initializeAlarms]);

  // Reset page when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, statusFilter, typeFilter, severityFilter]);

  // Get unique alarm types for filters
  const uniqueTypes = useMemo(() => {
    const types = new Set(filteredAlarms.map(alarm => alarm.alarmType).filter(Boolean));
    return Array.from(types).sort();
  }, [filteredAlarms]);

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

  const openDeviceMapModal = (device) => {
    setSelectedDeviceForModal(device);
    setDeviceModalOpen(true);
  };

  return (
    <div className={`w-full space-y-6 ${className}`}>
      {/* Header with Controls */}
      <div className="p-6 bg-white border border-gray-200 rounded-lg shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">Alarm Management</h2>
            <p className="text-gray-600">Real-time Alarm Monitoring & Management System</p>
            <p className="text-sm text-gray-500">Last updated: {new Date(lastUpdate).toLocaleTimeString()}</p>
          </div>
          <div className="flex items-center space-x-4">
            {/* Global Stream Status */}
            <div className="flex items-center">
              <div className={`w-3 h-3 rounded-full mr-2 ${globalStreamActive ? 'bg-green-500 animate-pulse' : 'bg-red-500'}`} />
              <span className="text-sm text-gray-600">
                Stream: {globalStreamActive ? 'Active' : 'Inactive'}
              </span>
            </div>

            {/* Manual Refresh */}
            <button
              onClick={forceTableUpdate}
              className="p-2 text-gray-600 border border-gray-200 rounded-lg hover:text-gray-900 hover:bg-gray-100"
              title="Force refresh table"
            >
              <RefreshCw className="w-5 h-5" />
            </button>

            {/* Export Button */}
            <button
              onClick={() => setShowExportModal(true)}
              className="flex items-center px-4 py-2 text-white bg-blue-600 rounded-lg hover:bg-blue-700"
            >
              <Download className="w-4 h-4 mr-2" />
              Export
            </button>
          </div>
        </div>

        {/* Enhanced Statistics Cards */}
        <div className="grid grid-cols-5 gap-4 mb-6">
          <div className="p-4 border border-blue-200 rounded-lg bg-blue-50">
            <div className="text-2xl font-bold text-blue-600">{filteredAlarms.length}</div>
            <div className="text-sm font-medium text-blue-800">Total Displayed</div>
          </div>
          <div className="p-4 border border-green-200 rounded-lg bg-green-50">
            <div className="text-2xl font-bold text-green-600">{globalLiveAlarms.length}</div>
            <div className="text-sm font-medium text-green-800">Live Alarms</div>
          </div>
          <div className="p-4 border border-red-200 rounded-lg bg-red-50">
            <div className="text-2xl font-bold text-red-600">
              {filteredAlarms.filter(a => getAlarmStatus(a) === 'active').length}
            </div>
            <div className="text-sm font-medium text-red-800">Active</div>
          </div>
          <div className="p-4 border border-yellow-200 rounded-lg bg-yellow-50">
            <div className="text-2xl font-bold text-yellow-600">
              {filteredAlarms.filter(a => a.severity === 'high' || a.severity === 'critical').length}
            </div>
            <div className="text-sm font-medium text-yellow-800">High Priority</div>
          </div>
          <div className="p-4 border border-purple-200 rounded-lg bg-purple-50">
            <div className="text-2xl font-bold text-purple-600">
              {filteredAlarms.filter(a => a.latitude && a.longitude).length}
            </div>
            <div className="text-sm font-medium text-purple-800">With Location</div>
          </div>
        </div>

        {/* Enhanced Filter Controls */}
        <div className="grid grid-cols-1 gap-4 md:grid-cols-5">
          {/* Search */}
          <div className="relative">
            <Search className="absolute w-4 h-4 text-gray-400 transform -translate-y-1/2 left-3 top-1/2" />
            <input
              type="text"
              placeholder="Search alarms..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full py-2 pl-10 pr-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* Status Filter */}
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
          >
            <option value="all">All Status</option>
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
            {uniqueTypes.map(type => (
              <option key={type} value={type}>{type}</option>
            ))}
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
              <span className="text-gray-600">Refreshing alarms...</span>
            </div>
          ) : paginatedAlarms.length === 0 ? (
            <div className="py-12 text-center">
              <Zap className="w-12 h-12 mx-auto mb-4 text-yellow-400" />
              <h3 className="mb-2 text-lg font-medium text-gray-900">No Alarms Found</h3>
              <p className="text-gray-600">
                {searchTerm || statusFilter !== 'all' || typeFilter !== 'all' || severityFilter !== 'all'
                  ? 'No alarms match your current filters.'
                  : 'No alarms received yet. System is ready for real-time events.'}
              </p>
            </div>
          ) : (
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left">
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
                    Driver Metrics
                  </th>
                  <th className="px-4 py-3 text-xs font-medium tracking-wider text-left text-gray-500 uppercase">
                    Speed
                  </th>
                  <th className="px-4 py-3 text-xs font-medium tracking-wider text-left text-gray-500 uppercase">
                    Acceleration
                  </th>
                  <th className="px-6 py-3 text-xs font-medium tracking-wider text-left text-gray-500 uppercase">
                    Status
                  </th>
                  <th className="px-6 py-3 text-xs font-medium tracking-wider text-left text-gray-500 uppercase">
                    Timestamp
                  </th>
                  <th className="px-6 py-3 text-xs font-medium tracking-wider text-left text-gray-500 uppercase">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {paginatedAlarms.map((alarm) => {
                  const isSelected = selectedAlarms.has(alarm.alarmId);
                  const status = getAlarmStatus(alarm);
                  const isResolved = status === 'resolved';
                  const hasImage = Boolean(alarm.downloadUrl || alarm.previewUrl || alarm.imageUrl);
                  const isPreviewValid = hasImage && isValidUrl(alarm.previewUrl || alarm.downloadUrl || alarm.imageUrl);
                  const isLiveAlarm = alarm.source === 'global_stream' || alarm.isLive;

                  return (
                    <tr key={alarm.alarmId} className={`hover:bg-gray-50 ${isSelected ? 'bg-blue-50' : ''} ${isLiveAlarm ? 'border-l-4 border-l-green-500' : ''}`}>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => handleSelectAlarm(alarm.alarmId)}
                          className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                        />
                      </td>

                      <td className="px-6 py-4">
                        <div className="space-y-2">
                          <div className="flex items-center gap-2">
                            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${getSeverityColor(alarm.severity)}`}>
                              {alarm.severity || 'medium'}
                            </span>
                            {isLiveAlarm && (
                              <span className="px-2 py-1 text-xs font-bold text-green-600 bg-green-100 rounded animate-pulse">
                                LIVE
                              </span>
                            )}
                            {alarm.source === 'global_stream' && (
                              <span className="px-2 py-1 text-xs text-blue-600 bg-blue-100 rounded">
                                GLOBAL
                              </span>
                            )}
                          </div>
                          <div>
                            <div className="font-semibold text-gray-900">{alarm.alarmType}</div>
                            <div className="text-sm text-gray-600">{alarm.description}</div>
                            <div className="text-xs text-gray-500">ID: {alarm.alarmId}</div>
                            {alarm.source && (
                              <div className="text-xs text-gray-400">Source: {alarm.source}</div>
                            )}
                          </div>
                        </div>
                      </td>

                      <td className="px-6 py-4">
                        <div className="space-y-1">
                          <div className="font-medium text-gray-900">{alarm.deviceId}</div>
                          {alarm.latitude && alarm.longitude ? (
                            <div className="flex items-center text-sm text-gray-600">
                              <MapPin className="w-3 h-3 mr-1" />
                              {parseFloat(alarm.latitude).toFixed(4)}, {parseFloat(alarm.longitude).toFixed(4)}
                            </div>
                          ) : (
                            <div className="text-sm text-gray-400">No location</div>
                          )}
                        </div>
                      </td>

                      {/* ENHANCED: Driver Metrics with better drowsiness display */}
                      <td className="px-6 py-4">
                        <div className="text-sm text-gray-700">
                          <div className="mb-1">
                            <span className="font-medium">Drowsiness:</span> 
                            <span className={`ml-1 px-2 py-1 text-xs rounded ${
                              alarm.drowsiness !== null && alarm.drowsiness !== undefined 
                                ? alarm.drowsiness > 70 
                                  ? 'bg-red-100 text-red-800' 
                                  : alarm.drowsiness > 40 
                                    ? 'bg-yellow-100 text-yellow-800' 
                                    : 'bg-green-100 text-green-800'
                                : 'bg-gray-100 text-gray-600'
                            }`}>
                              {alarm.drowsiness !== null && alarm.drowsiness !== undefined 
                                ? `${Number(alarm.drowsiness).toFixed(1)}%` 
                                : 'N/A'}
                            </span>
                          </div>
                          <div className="mb-1">
                            <span className="font-medium">Rash Driving:</span> 
                            {alarm.rashDriving !== null && alarm.rashDriving !== undefined ? 
                              (alarm.rashDriving ? 'Yes' : 'No') : 'N/A'}
                          </div>
                          <div>
                            <span className="font-medium">Collision:</span> 
                            {alarm.collision !== null && alarm.collision !== undefined ? 
                              (alarm.collision ? 'Yes' : 'No') : 'N/A'}
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
                            className="p-2 text-blue-600 rounded-lg hover:bg-blue-100 hover:text-blue-800"
                            title="View alarm details"
                          >
                            <Eye className="w-4 h-4" />
                          </button>

                          {status !== 'resolved' && (
                            <button
                              onClick={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                console.log(`🔧 Resolve button clicked for alarm: ${alarm.alarmId}`);
                                resolveAlarm(alarm.alarmId);
                              }}
                              className="p-2 text-green-600 transition-colors rounded-lg hover:bg-green-100 hover:text-green-800"
                              title="Resolve alarm"
                              disabled={isResolved}
                            >
                              <CheckCircle className="w-4 h-4" />
                            </button>
                          )}

                          {/* FIXED: Preview Button with proper onClick handler */}
                          <button
                            onClick={() => {
                              if (isPreviewValid) {
                                const previewUrl = alarm.previewUrl || alarm.downloadUrl || alarm.imageUrl;
                                if (previewUrl) {
                                  console.log(`🖼️ Opening preview: ${previewUrl}`);
                                  window.open(previewUrl, '_blank', 'noopener,noreferrer');
                                }
                              } else {
                                console.warn('⚠️ No valid preview URL');
                              }
                            }}
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
                            title={hasImage ? 'Download alarm bundle' : 'No data to download'}
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
          <div className="flex items-center justify-between px-6 py-3 border-t border-gray-200 bg-gray-50">
            <div className="flex items-center text-sm text-gray-700">
              Showing {((currentPage - 1) * itemsPerPage) + 1} to {Math.min(currentPage * itemsPerPage, totalItems)} of {totalItems} results
            </div>
            <div className="flex items-center space-x-2">
              <button
                onClick={() => setCurrentPage(1)}
                disabled={currentPage === 1}
                className="p-2 text-gray-400 hover:text-gray-600 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <ChevronsLeft className="w-4 h-4" />
              </button>
              <button
                onClick={() => setCurrentPage(currentPage - 1)}
                disabled={currentPage === 1}
                className="p-2 text-gray-400 hover:text-gray-600 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <span className="px-3 py-1 text-sm font-medium text-gray-700">
                Page {currentPage} of {totalPages}
              </span>
              <button
                onClick={() => setCurrentPage(currentPage + 1)}
                disabled={currentPage === totalPages}
                className="p-2 text-gray-400 hover:text-gray-600 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
              <button
                onClick={() => setCurrentPage(totalPages)}
                disabled={currentPage === totalPages}
                className="p-2 text-gray-400 hover:text-gray-600 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <ChevronsRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* ENHANCED: Complete View Modal with all details */}
      {showViewModal && selectedAlarmForView && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
          <div className="bg-white rounded-lg shadow-xl max-w-3xl w-full mx-4 max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-xl font-semibold text-gray-900">Alarm Details</h3>
                <button
                  onClick={() => setShowViewModal(false)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>
              
              <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
                {/* Left Column - Basic Info */}
                <div className="space-y-4">
                  <div className="p-4 rounded-lg bg-gray-50">
                    <h4 className="mb-3 font-semibold text-gray-900">Basic Information</h4>
                    <div className="space-y-2">
                      <div>
                        <span className="text-sm font-medium text-gray-500">Alarm ID:</span>
                        <p className="font-mono text-gray-900">{selectedAlarmForView.alarmId}</p>
                      </div>
                      <div>
                        <span className="text-sm font-medium text-gray-500">Device ID:</span>
                        <p className="text-gray-900">{selectedAlarmForView.deviceId}</p>
                      </div>
                      <div>
                        <span className="text-sm font-medium text-gray-500">Type:</span>
                        <p className="font-semibold text-gray-900">{selectedAlarmForView.alarmType}</p>
                      </div>
                      <div>
                        <span className="text-sm font-medium text-gray-500">Severity:</span>
                        <span className={`px-2 py-1 text-sm rounded-full ${getSeverityColor(selectedAlarmForView.severity)}`}>
                          {selectedAlarmForView.severity}
                        </span>
                      </div>
                      <div>
                        <span className="text-sm font-medium text-gray-500">Status:</span>
                        <span className={`px-2 py-1 text-sm rounded-full ${getStatusColor(getAlarmStatus(selectedAlarmForView))}`}>
                          {getAlarmStatus(selectedAlarmForView)}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="p-4 rounded-lg bg-gray-50">
                    <h4 className="mb-3 font-semibold text-gray-900">Driver Metrics</h4>
                    <div className="space-y-2">
                      <div>
                        <span className="text-sm font-medium text-gray-500">Speed:</span>
                        <p className="text-gray-900">
                          {selectedAlarmForView.speed !== null && selectedAlarmForView.speed !== undefined 
                            ? `${selectedAlarmForView.speed} km/h` 
                            : 'N/A'}
                        </p>
                      </div>
                      <div>
                        <span className="text-sm font-medium text-gray-500">Acceleration:</span>
                        <p className="text-gray-900">
                          {selectedAlarmForView.acceleration !== null && selectedAlarmForView.acceleration !== undefined 
                            ? `${selectedAlarmForView.acceleration} m/s²` 
                            : 'N/A'}
                        </p>
                      </div>
                      <div>
                        <span className="text-sm font-medium text-gray-500">Drowsiness Level:</span>
                        <span className={`px-3 py-1 text-sm rounded-full ${
                          selectedAlarmForView.drowsiness !== null && selectedAlarmForView.drowsiness !== undefined 
                            ? selectedAlarmForView.drowsiness > 70 
                              ? 'bg-red-100 text-red-800' 
                              : selectedAlarmForView.drowsiness > 40 
                                ? 'bg-yellow-100 text-yellow-800' 
                                : 'bg-green-100 text-green-800'
                            : 'bg-gray-100 text-gray-800'
                        }`}>
                          {selectedAlarmForView.drowsiness !== null && selectedAlarmForView.drowsiness !== undefined 
                            ? `${selectedAlarmForView.drowsiness}%` 
                            : 'N/A'}
                        </span>
                      </div>
                      <div>
                        <span className="text-sm font-medium text-gray-500">Rash Driving:</span>
                        <span className={`px-2 py-1 text-sm rounded-full ${
                          selectedAlarmForView.rashDriving === true ? 'bg-red-100 text-red-800' : 
                          selectedAlarmForView.rashDriving === false ? 'bg-green-100 text-green-800' : 
                          'bg-gray-100 text-gray-800'
                        }`}>
                          {selectedAlarmForView.rashDriving !== null && selectedAlarmForView.rashDriving !== undefined 
                            ? (selectedAlarmForView.rashDriving ? 'Detected' : 'Normal') 
                            : 'N/A'}
                        </span>
                      </div>
                      <div>
                        <span className="text-sm font-medium text-gray-500">Collision:</span>
                        <span className={`px-2 py-1 text-sm rounded-full ${
                          selectedAlarmForView.collision === true ? 'bg-red-100 text-red-800' : 
                          selectedAlarmForView.collision === false ? 'bg-green-100 text-green-800' : 
                          'bg-gray-100 text-gray-800'
                        }`}>
                          {selectedAlarmForView.collision !== null && selectedAlarmForView.collision !== undefined 
                            ? (selectedAlarmForView.collision ? 'Detected' : 'None') 
                            : 'N/A'}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Right Column - Location & Image */}
                <div className="space-y-4">
                  <div className="p-4 rounded-lg bg-gray-50">
                    <h4 className="mb-3 font-semibold text-gray-900">Location & Time</h4>
                    <div className="space-y-2">
                      <div>
                        <span className="text-sm font-medium text-gray-500">Timestamp:</span>
                        <p className="text-gray-900">{new Date(selectedAlarmForView.alarmTime).toLocaleString()}</p>
                        <p className="text-sm text-gray-500">{timeAgo(selectedAlarmForView.alarmTime)}</p>
                      </div>
                      <div>
                        <span className="text-sm font-medium text-gray-500">Location:</span>
                        {selectedAlarmForView.latitude && selectedAlarmForView.longitude ? (
                          <div>
                            <p className="font-mono text-sm text-gray-900">
                              {selectedAlarmForView.latitude.toFixed(6)}, {selectedAlarmForView.longitude.toFixed(6)}
                            </p>
                            <button
                              onClick={() => {
                                const url = `https://www.google.com/maps?q=${selectedAlarmForView.latitude},${selectedAlarmForView.longitude}`;
                                window.open(url, '_blank', 'noopener,noreferrer');
                              }}
                              className="mt-1 text-sm text-blue-600 hover:text-blue-800"
                            >
                              📍 View on Google Maps
                            </button>
                          </div>
                        ) : (
                          <p className="text-gray-500">Location not available</p>
                        )}
                      </div>
                      <div>
                        <span className="text-sm font-medium text-gray-500">Description:</span>
                        <p className="text-gray-900">{selectedAlarmForView.description}</p>
                      </div>
                    </div>
                  </div>

                  {/* Image Section */}
                  {(selectedAlarmForView.previewUrl || selectedAlarmForView.downloadUrl || selectedAlarmForView.imageUrl) && (
                    <div className="p-4 rounded-lg bg-gray-50">
                      <h4 className="mb-3 font-semibold text-gray-900">Alarm Image</h4>
                      <img 
                        src={selectedAlarmForView.previewUrl || selectedAlarmForView.downloadUrl || selectedAlarmForView.imageUrl} 
                        alt="Alarm" 
                        className="object-cover w-full h-48 border rounded-lg"
                        onError={(e) => {
                          e.target.style.display = 'none';
                          e.target.nextSibling.style.display = 'block';
                        }}
                      />
                      <div className="hidden p-4 text-center text-gray-500 border border-dashed rounded-lg">
                        <p>Image not available</p>
                      </div>
                      <div className="flex gap-2 mt-3">
                        <button
                          onClick={() => {
                            const imageUrl = selectedAlarmForView.previewUrl || selectedAlarmForView.downloadUrl || selectedAlarmForView.imageUrl;
                            if (imageUrl) {
                              window.open(imageUrl, '_blank', 'noopener,noreferrer');
                            }
                          }}
                          className="flex-1 px-3 py-2 text-sm text-blue-600 border border-blue-600 rounded hover:bg-blue-50"
                        >
                          Open Full Size
                        </button>
                        <button
                          onClick={() => downloadAlarmBundle(selectedAlarmForView)}
                          className="flex-1 px-3 py-2 text-sm text-white bg-blue-600 rounded hover:bg-blue-700"
                        >
                          Download Bundle
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Modal Actions */}
              <div className="flex justify-end gap-3 pt-4 mt-6 border-t">
                {getAlarmStatus(selectedAlarmForView) !== 'resolved' && (
                  <button
                    onClick={() => {
                      resolveAlarm(selectedAlarmForView.alarmId);
                      setShowViewModal(false);
                    }}
                    className="px-4 py-2 text-white bg-green-600 rounded-lg hover:bg-green-700"
                  >
                    Mark as Resolved
                  </button>
                )}
                <button
                  onClick={() => setShowViewModal(false)}
                  className="px-4 py-2 text-gray-700 bg-gray-200 rounded-lg hover:bg-gray-300"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Export Modal */}
      {showExportModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
          <div className="w-full max-w-md p-6 mx-4 bg-white rounded-lg shadow-xl">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900">Export Alarms</h3>
              <button
                onClick={() => setShowExportModal(false)}
                className="text-gray-400 hover:text-gray-600"
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
              
              <div className="p-3 border border-blue-200 rounded-lg bg-blue-50">
                <p className="text-sm text-blue-700">
                  This will export {filteredAlarms.length} alarm(s) matching your current filters.
                </p>
              </div>

              <div className="flex justify-end pt-4 space-x-3">
                <button
                  onClick={() => setShowExportModal(false)}
                  className="px-4 py-2 text-white transition-colors bg-gray-600 rounded-lg hover:bg-gray-700"
                >
                  Cancel
                </button>
                <button
                  onClick={exportAlarms}
                  disabled={exportLoading}
                  className="px-4 py-2 text-white transition-colors bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
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
      )}

      {/* Device Modal */}
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

export default EventBasedAlarmTable;