import React, { useState, useCallback, useMemo, useEffect } from 'react';
import { 
  Shield, Activity, AlertTriangle, RefreshCw, Search,
  MapPin, Navigation, Eye, Clock, Map
} from 'lucide-react';
import { useData } from '../../contexts/DataContext';
import { useNotification } from '../../components/notifications/RealTimeNotificationSystem';
import { formatDateTime, timeAgo } from '../../utils/helpers';
import apiService from '../../services/api';
import Modal from '../common/Modal';
import EnhancedDeviceMap from '../tracking/EnhancedDeviceMap';

const DevicesPage = ({ onViewDevice }) => {
  const { data, loading, error, forceRefresh } = useData();
  const { showSuccess, showError } = useNotification();
  
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [refreshing, setRefreshing] = useState(false);
  const [deviceTelemetryData, setDeviceTelemetryData] = useState({});
  
  // Route Modal State with Enhanced Tracking
  const [showRouteModal, setShowRouteModal] = useState(false);
  const [selectedDeviceForRoute, setSelectedDeviceForRoute] = useState(null);
  const [realtimeTracking, setRealtimeTracking] = useState(false);
  const [trackingInterval, setTrackingInterval] = useState(null);
  const [telemetryHistory, setTelemetryHistory] = useState([]);

  // Get devices from data context
  const devices = data?.devices || [];
  const vehicles = data?.vehicles || [];
  const localDevices = Array.isArray(devices) ? devices : [];
  const hasDevices = localDevices.length > 0;

  // Enhanced telemetry data fetching with strict validation
  useEffect(() => {
    const fetchDeviceTelemetryData = async () => {
      if (localDevices.length === 0) return;
      
      console.log('🔍 Fetching telemetry data for all devices...');
      
      const telemetryPromises = localDevices.map(async (device) => {
        const currentDeviceId = device.device_id || device.deviceId || device.id;
        
        if (!currentDeviceId) {
          console.warn(`No valid device ID for device:`, device);
          return { deviceId: currentDeviceId || 'unknown', success: false, reason: 'No valid device ID' };
        }
        
        try {
          const endpoints = [
            () => apiService.getDeviceTelemetry(currentDeviceId, 0, 1),
            () => apiService.getLatestDeviceTelemetry(currentDeviceId),
            () => apiService.request(`/device/v1/data/${currentDeviceId}?direction=desc&size=1`),
            () => apiService.request(`/deviceTelemetry/v1/device/${currentDeviceId}?page=0&size=1`)
          ];
          
          for (const endpointFn of endpoints) {
            try {
              const response = await endpointFn();
              
              let telemetryData = null;
              if (response.success && response.data && Array.isArray(response.data) && response.data.length > 0) {
                telemetryData = response.data[0];
              } else if (response.data && !Array.isArray(response.data)) {
                telemetryData = response.data;
              }
              
              if (!telemetryData || !telemetryData.latitude || !telemetryData.longitude || !telemetryData.timestamp) {
                console.warn(`Invalid telemetry for device ${currentDeviceId}:`, { 
                  hasData: !!telemetryData, 
                  hasGPS: !!(telemetryData?.latitude && telemetryData?.longitude), 
                  hasTimestamp: !!telemetryData?.timestamp 
                });
                continue;
              }
              
              const parsedTimestamp = new Date(telemetryData.timestamp);
              if (isNaN(parsedTimestamp.getTime())) {
                console.warn(`Invalid timestamp for device ${currentDeviceId}:`, telemetryData.timestamp);
                continue;
              }
              
              return {
                deviceId: currentDeviceId,
                success: true,
                telemetry: {
                  latitude: parseFloat(telemetryData.latitude),
                  longitude: parseFloat(telemetryData.longitude),
                  speed: telemetryData.speed ? parseFloat(telemetryData.speed) : 0,
                  acceleration: telemetryData.acceleration ? parseFloat(telemetryData.acceleration) : 0,
                  heading: telemetryData.heading ? parseFloat(telemetryData.heading) : 0,
                  timestamp: telemetryData.timestamp,
                  telemetry_id: telemetryData.id || telemetryData.telemetry_id || Date.now(),
                  drowsiness: Boolean(telemetryData.drowsiness),
                  rash_driving: Boolean(telemetryData.rash_driving || telemetryData.rashDriving),
                  collision: Boolean(telemetryData.collision)
                }
              };
            } catch (endpointError) {
              console.warn(`Endpoint failed for device ${currentDeviceId}:`, endpointError.message);
              continue;
            }
          }
          console.warn(`No valid telemetry data for device ${currentDeviceId} from any endpoint`);
          return { deviceId: currentDeviceId, success: false, reason: 'No valid telemetry data' };
        } catch (error) {
          console.warn(`Failed to fetch telemetry for device ${currentDeviceId}:`, error.message);
          return { deviceId: currentDeviceId, success: false, reason: error.message };
        }
      });

      try {
        const results = await Promise.all(telemetryPromises);
        const telemetryMap = {};
        
        results.forEach(result => {
          if (result.success) {
            telemetryMap[result.deviceId] = result.telemetry;
          } else {
            console.warn(`Telemetry fetch failed for device ${result.deviceId}:`, result.reason);
            telemetryMap[result.deviceId] = null; // Explicitly mark as no telemetry
          }
        });
        
        setDeviceTelemetryData(telemetryMap);
        console.log(`✅ Telemetry data fetched for ${Object.keys(telemetryMap).filter(id => telemetryMap[id]).length} devices`, telemetryMap);
      } catch (error) {
        console.error('❌ Error fetching telemetry data:', error);
      }
    };

    fetchDeviceTelemetryData();
  }, [localDevices]);

  // Enhanced route icon click handler
  const handleRouteClick = async (device) => {
    console.log('🗺️ Route icon clicked for device:', device.device_id);
    
    try {
      const associatedVehicle = vehicles.find(v => v.vehicle_id === device.vehicle_id);
      const currentDeviceId = device.device_id || device.deviceId || device.id;
      
      let telemetryResponse = null;
      const endpoints = [
        () => apiService.getDeviceTelemetry(currentDeviceId, 0, 50),
        () => apiService.request(`/device/v1/data/${currentDeviceId}?direction=desc&size=50`),
        () => apiService.request(`/deviceTelemetry/v1/device/${currentDeviceId}?page=0&size=50`)
      ];
      
      for (const endpointFn of endpoints) {
        try {
          const response = await endpointFn();
          if (response.success && response.data && Array.isArray(response.data) && response.data.length > 0) {
            telemetryResponse = response;
            break;
          } else if (response.data && !Array.isArray(response.data) && response.data.latitude) {
            telemetryResponse = { success: true, data: [response.data] };
            break;
          }
        } catch (endpointError) {
          console.warn(`Telemetry endpoint failed:`, endpointError.message);
          continue;
        }
      }
      
      if (!telemetryResponse || !telemetryResponse.success || !telemetryResponse.data || telemetryResponse.data.length === 0) {
        showError('No Telemetry Data', `No GPS telemetry data available for device ${device.device_name || currentDeviceId}.`);
        return;
      }

      const latestTelemetry = telemetryResponse.data[0];
      
      if (!latestTelemetry.latitude || !latestTelemetry.longitude || !latestTelemetry.timestamp) {
        showError('Invalid Location', `Device ${device.device_name || currentDeviceId} does not have valid GPS or timestamp.`);
        return;
      }

      const parsedTimestamp = new Date(latestTelemetry.timestamp);
      if (isNaN(parsedTimestamp.getTime())) {
        showError('Invalid Timestamp', `Device ${device.device_name || currentDeviceId} has an invalid timestamp.`);
        return;
      }

      const sortedTelemetry = telemetryResponse.data
        .filter(point => point.latitude && point.longitude && point.timestamp && !isNaN(parseFloat(point.latitude)) && !isNaN(parseFloat(point.longitude)))
        .map(point => ({
          latitude: parseFloat(point.latitude),
          longitude: parseFloat(point.longitude),
          timestamp: point.timestamp,
          speed: parseFloat(point.speed || 0),
          heading: parseFloat(point.heading || 0),
          drowsiness: Boolean(point.drowsiness),
          rash_driving: Boolean(point.rash_driving || point.rashDriving),
          collision: Boolean(point.collision)
        }))
        .sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));

      if (sortedTelemetry.length === 0) {
        showError('No Valid Route Data', `No valid GPS points available for device ${device.device_name || currentDeviceId}.`);
        return;
      }

      console.log('🔍 Valid route points fetched:', sortedTelemetry.length);

      const enhancedDevice = {
        ...device,
        latitude: parseFloat(latestTelemetry.latitude),
        longitude: parseFloat(latestTelemetry.longitude),
        speed: parseFloat(latestTelemetry.speed || 0),
        heading: parseFloat(latestTelemetry.heading || 0),
        acceleration: parseFloat(latestTelemetry.acceleration || 0),
        telemetry_timestamp: latestTelemetry.timestamp,
        telemetry_id: latestTelemetry.id || latestTelemetry.telemetry_id || Date.now(),
        drowsiness: Boolean(latestTelemetry.drowsiness),
        rash_driving: Boolean(latestTelemetry.rash_driving || latestTelemetry.rashDriving),
        collision: Boolean(latestTelemetry.collision),
        associatedVehicle: associatedVehicle,
        routePoints: sortedTelemetry
      };

      setTelemetryHistory(telemetryResponse.data);
      setSelectedDeviceForRoute(enhancedDevice);
      setShowRouteModal(true);
      
      setTimeout(() => {
        startAutomaticTracking(enhancedDevice);
      }, 1000);
      
      console.log('✅ Route modal opened with enhanced device data:', enhancedDevice);
      
    } catch (error) {
      console.error('❌ Error getting device route data:', error);
      showError('Error', `Failed to get route data: ${error.message}`);
    }
  };

  // Start automatic tracking
  const startAutomaticTracking = useCallback((device) => {
    if (realtimeTracking) return;
    
    console.log('🔄 Starting automatic tracking for device:', device.device_id);
    setRealtimeTracking(true);
    
    const interval = setInterval(async () => {
      try {
        const currentDeviceId = device.device_id;
        
        let latestTelemetry = null;
        const endpoints = [
          () => apiService.getDeviceTelemetry(currentDeviceId, 0, 1),
          () => apiService.getLatestDeviceTelemetry(currentDeviceId),
          () => apiService.request(`/device/v1/data/${currentDeviceId}?direction=desc&size=1`)
        ];
        
        for (const endpointFn of endpoints) {
          try {
            const response = await endpointFn();
            if (response.success && response.data && Array.isArray(response.data) && response.data.length > 0) {
              latestTelemetry = response.data[0];
              break;
            } else if (response.data && !Array.isArray(response.data) && response.data.latitude) {
              latestTelemetry = response.data;
              break;
            }
          } catch (endpointError) {
            console.warn(`Automatic tracking endpoint failed for device ${currentDeviceId}:`, endpointError.message);
            continue;
          }
        }
        
        if (latestTelemetry && latestTelemetry.latitude && latestTelemetry.longitude && latestTelemetry.timestamp) {
          const parsedTimestamp = new Date(latestTelemetry.timestamp);
          if (isNaN(parsedTimestamp.getTime())) {
            console.warn(`Invalid tracking timestamp for device ${currentDeviceId}:`, latestTelemetry.timestamp);
            return;
          }
          
          const currentTelemetryId = latestTelemetry.id || latestTelemetry.telemetry_id || latestTelemetry.timestamp;
          const previousTelemetryId = device.telemetry_id;
          
          if (currentTelemetryId !== previousTelemetryId) {
            const updatedDevice = {
              ...device,
              latitude: parseFloat(latestTelemetry.latitude),
              longitude: parseFloat(latestTelemetry.longitude),
              speed: parseFloat(latestTelemetry.speed || 0),
              heading: parseFloat(latestTelemetry.heading || 0),
              acceleration: parseFloat(latestTelemetry.acceleration || 0),
              telemetry_timestamp: latestTelemetry.timestamp,
              telemetry_id: currentTelemetryId,
              drowsiness: Boolean(latestTelemetry.drowsiness),
              rash_driving: Boolean(latestTelemetry.rash_driving || latestTelemetry.rashDriving),
              collision: Boolean(latestTelemetry.collision)
            };
            
            setSelectedDeviceForRoute(updatedDevice);
            setTelemetryHistory(prev => [latestTelemetry, ...prev.slice(0, 9)]);
            
            console.log('📍 Updated device location:', {
              lat: latestTelemetry.latitude,
              lng: latestTelemetry.longitude,
              speed: latestTelemetry.speed,
              timestamp: latestTelemetry.timestamp
            });
          }
        } else {
          console.warn(`No valid telemetry during tracking for device ${currentDeviceId}:`, latestTelemetry);
        }
      } catch (error) {
        console.error('❌ Automatic tracking error:', error);
      }
    }, 5000);
    
    setTrackingInterval(interval);
  }, [realtimeTracking]);

  // Stop real-time tracking
  const stopRealtimeTracking = () => {
    if (trackingInterval) {
      clearInterval(trackingInterval);
      setTrackingInterval(null);
    }
    setRealtimeTracking(false);
    console.log('⏹️ Stopped real-time tracking');
  };

  // Close modal handler
  const handleCloseRouteModal = () => {
    stopRealtimeTracking();
    setShowRouteModal(false);
    setSelectedDeviceForRoute(null);
    setTelemetryHistory([]);
  };

  // Get device status with strict telemetry-based logic
  const getDeviceStatus = (device) => {
    const telemetry = deviceTelemetryData[device.device_id] || null;
    const rawStatus = device.status || 'unknown';
    const now = new Date();
    
    // Try parsing telemetry timestamp, fallback to device.last_updated
    const timestamp = telemetry?.timestamp || device.last_updated;
    const parsedTimestamp = timestamp ? new Date(timestamp) : null;
    const isTimestampValid = parsedTimestamp && !isNaN(parsedTimestamp.getTime());
    
    // Check recency (within 5 minutes)
    const TELEMETRY_THRESHOLD_MINUTES = 5;
    const isTelemetryRecent = isTimestampValid 
      ? (now - parsedTimestamp) / (1000 * 60) <= TELEMETRY_THRESHOLD_MINUTES 
      : false;
    const hasGPS = telemetry && telemetry.latitude && telemetry.longitude && 
                   !isNaN(telemetry.latitude) && !isNaN(telemetry.longitude);
    
    // Debug logging
    console.log('Device status debug:', { 
      device_id: device.device_id, 
      rawStatus, 
      timestamp, 
      parsedTimestamp: isTimestampValid ? parsedTimestamp.toISOString() : 'Invalid',
      isTelemetryRecent,
      hasGPS,
      timeDiffMinutes: isTimestampValid ? ((now - parsedTimestamp) / (1000 * 60)).toFixed(2) : 'N/A',
      last_updated: device.last_updated
    });

    // Strict logic: Active only if recent telemetry with valid GPS
    if (!hasGPS || !isTimestampValid || !isTelemetryRecent) {
      let reason = !hasGPS ? 'No GPS data' : 
                   !isTimestampValid ? 'Invalid or missing timestamp' : 
                   'Telemetry older than 5 minutes';
      return { 
        color: 'orange', 
        text: `Inactive (${reason})`, 
        icon: '⚠️',
        tooltip: `Device not active. Reason: ${reason}. Last update: ${isTimestampValid ? parsedTimestamp.toLocaleString() : 'N/A'}`
      };
    }

    // Only mark as Active if telemetry is recent and valid
    return { 
      color: 'green', 
      text: 'Active', 
      icon: '📍',
      tooltip: `Device actively sending data. Last update: ${parsedTimestamp.toLocaleString()}`
    };
  };

  // Check if device has GPS data for route icon
  const hasGPSData = (device) => {
    const currentDeviceId = device.device_id || device.deviceId || device.id;
    const telemetry = deviceTelemetryData[currentDeviceId];
    return telemetry && telemetry.latitude && telemetry.longitude && 
           !isNaN(telemetry.latitude) && !isNaN(telemetry.longitude) && 
           telemetry.timestamp && !isNaN(new Date(telemetry.timestamp).getTime());
  };

  // Filter devices based on search and status
  const filteredDevices = useMemo(() => {
    return localDevices.filter(device => {
      const matchesSearch = !searchTerm || 
        (device.device_name && device.device_name.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (device.device_id && device.device_id.toString().includes(searchTerm));
      
      const matchesStatus = statusFilter === 'all' || 
        (device.status && device.status.toLowerCase() === statusFilter.toLowerCase());
      
      return matchesSearch && matchesStatus;
    });
  }, [localDevices, searchTerm, statusFilter]);

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  // Calculate total pages and paginated devices
  const totalPages = Math.ceil(filteredDevices.length / itemsPerPage);
  const paginatedDevices = filteredDevices.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  // Manual refresh handler with cache bypass
  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      await forceRefresh(true); // Pass true to force cache bypass
      setDeviceTelemetryData({}); // Clear telemetry cache
      showSuccess('Data refreshed successfully');
    } catch (error) {
      console.error('❌ Refresh error:', error);
      showError('Refresh failed', error.message);
    } finally {
      setRefreshing(false);
    }
  };

  // Show loading state
  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="flex items-center space-x-2">
          <RefreshCw className="w-6 h-6 text-blue-600 animate-spin" />
          <span className="text-gray-600">Loading devices...</span>
        </div>
      </div>
    );
  }

  // Show error state
  if (error) {
    return (
      <div className="p-6 border border-red-200 rounded-lg bg-red-50">
        <div className="flex items-center mb-4 space-x-2">
          <AlertTriangle className="w-6 h-6 text-red-600" />
          <h3 className="text-lg font-semibold text-red-800">Error Loading Devices</h3>
        </div>
        <p className="mb-4 text-red-700">{error}</p>
        <button
          onClick={handleRefresh}
          className="px-4 py-2 text-white bg-red-600 rounded hover:bg-red-700"
        >
          <RefreshCw className="inline w-4 h-4 mr-2" />
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Device Management</h2>
          <p className="text-gray-600">
            Manage and monitor your fleet devices with real-time GPS tracking
          </p>
        </div>
        <button
          onClick={handleRefresh}
          disabled={refreshing}
          className="flex items-center px-4 py-2 space-x-2 text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50"
        >
          <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
          <span>Refresh</span>
        </button>
      </div>

      {/* Search and Filters */}
      <div className="flex flex-col gap-4 sm:flex-row">
        <div className="flex-1">
          <div className="relative">
            <Search className="absolute w-4 h-4 text-gray-400 transform -translate-y-1/2 left-3 top-1/2" />
            <input
              type="text"
              placeholder="Search devices by name or ID..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full py-2 pl-10 pr-4 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
        </div>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
        >
          <option value="all">All Status</option>
          <option value="active">Active</option>
          <option value="inactive">Inactive</option>
        </select>
      </div>

      {/* Devices Table */}
      {!hasDevices ? (
        <div className="py-12 text-center">
          <Shield className="w-16 h-16 mx-auto mb-4 text-gray-400" />
          <h3 className="mb-2 text-xl font-medium text-gray-900">No Devices Found</h3>
          <p className="text-gray-600">
            No devices are currently registered in the system.
          </p>
        </div>
      ) : filteredDevices.length === 0 ? (
        <div className="py-12 text-center">
          <Search className="w-16 h-16 mx-auto mb-4 text-gray-400" />
          <h3 className="mb-2 text-xl font-medium text-gray-900">No Matching Devices</h3>
          <p className="text-gray-600">
            No devices match your current search and filter criteria.
          </p>
        </div>
      ) : (
        <div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm border-collapse">
              <thead className="bg-gray-100">
                <tr>
                  <th className="px-4 py-2 text-left text-gray-600">Device Name/ID</th>
                  <th className="px-4 py-2 text-left text-gray-600">Type</th>
                  <th className="px-4 py-2 text-left text-gray-600">Vehicle</th>
                  <th className="px-4 py-2 text-left text-gray-600">Status</th>
                  <th className="px-4 py-2 text-left text-gray-600">Last Updated</th>
                  <th className="px-4 py-2 text-left text-gray-600">Actions</th>
                </tr>
              </thead>
              <tbody>
                {paginatedDevices.map((device) => {
                  const status = getDeviceStatus(device);
                  const telemetry = deviceTelemetryData[device.device_id];
                  const associatedVehicle = vehicles.find(v => v.vehicle_id === device.vehicle_id);
                  const lastUpdated = telemetry?.timestamp ? timeAgo(telemetry.timestamp) : 
                                     (device.last_updated ? timeAgo(device.last_updated) : 'N/A');
                  
                  console.log('Device data for debugging:', { 
                    device_id: device.device_id, 
                    last_updated: device.last_updated, 
                    telemetry,
                    status: status.text
                  });

                  return (
                    <tr key={device.device_id} className="border-t hover:bg-gray-50">
                      <td className="px-4 py-2">
                        <div className="flex items-center space-x-3">
                          <div className="p-2 bg-blue-100 rounded-lg">
                            <Shield className="w-5 h-5 text-blue-600" />
                          </div>
                          <div>
                            <h3 className="font-semibold text-gray-900">
                              {device.device_name || `Device ${device.device_id}`}
                            </h3>
                            <p className="text-xs text-gray-600">ID: {device.device_id}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-2 text-gray-600">{device.device_type || 'N/A'}</td>
                      <td className="px-4 py-2 text-gray-600">
                        {associatedVehicle ? associatedVehicle.vehicle_number : 'N/A'}
                      </td>
                      <td className="px-4 py-2">
                        <div className="flex items-center space-x-2" title={status.tooltip}>
                          <div className={`w-2 h-2 rounded-full bg-${status.color}-500`}></div>
                          <span className="text-sm text-gray-700">{status.text}</span>
                          <span className="text-xs">{status.icon}</span>
                        </div>
                      </td>
                      <td className="px-4 py-2 text-gray-600">
                        {lastUpdated} {(telemetry?.timestamp || device.last_updated) && 
                          `(${new Date(telemetry?.timestamp || device.last_updated).toLocaleString()})`}
                      </td>
                      <td className="px-4 py-2">
                        <div className="flex items-center space-x-2">
                          <button
                            onClick={() => handleRouteClick(device)}
                            disabled={!hasGPSData(device)}
                            className={`p-2 rounded-lg transition-colors ${
                              hasGPSData(device)
                                ? 'bg-blue-100 text-blue-600 hover:bg-blue-200 cursor-pointer'
                                : 'bg-gray-100 text-gray-400 cursor-not-allowed'
                            }`}
                            title={hasGPSData(device) ? 'View live location and tracking' : 'No GPS data available'}
                          >
                            <MapPin className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => onViewDevice && onViewDevice(device.device_id)}
                            className="p-2 text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200"
                            title="View device details"
                          >
                            <Eye className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          <div className="flex items-center justify-between mt-4">
            <div className="text-sm text-gray-600">
              Showing {(currentPage - 1) * itemsPerPage + 1} to{' '}
              {Math.min(currentPage * itemsPerPage, filteredDevices.length)} of{' '}
              {filteredDevices.length} devices
            </div>
            <div className="flex space-x-2">
              <button
                onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                disabled={currentPage === 1}
                className="px-3 py-1 text-sm text-white bg-blue-600 rounded disabled:bg-gray-400 hover:bg-blue-700"
              >
                Previous
              </button>
              <span className="px-3 py-1 text-sm text-gray-600">
                Page {currentPage} of {totalPages}
              </span>
              <button
                onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                disabled={currentPage === totalPages}
                className="px-3 py-1 text-sm text-white bg-blue-600 rounded disabled:bg-gray-400 hover:bg-blue-700"
              >
                Next
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Enhanced Route Tracking Modal */}
      {showRouteModal && selectedDeviceForRoute && (
        <Modal
          isOpen={showRouteModal}
          onClose={handleCloseRouteModal}
          title={
            selectedDeviceForRoute.associatedVehicle 
              ? `${selectedDeviceForRoute.associatedVehicle.vehicle_number} - Enhanced Device Tracking` 
              : `${selectedDeviceForRoute.device_name || selectedDeviceForRoute.device_id} - Enhanced Tracking`
          }
          size="6xl"
        >
          <div className="space-y-4">
            {/* Device Information Panel */}
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
              <div className="p-4 rounded-lg bg-gray-50">
                <h4 className="flex items-center gap-2 mb-3 font-medium text-gray-900">
                  <Shield className="w-5 h-5 text-blue-600" />
                  Device Information
                </h4>
                <div className="space-y-2 text-sm text-gray-600">
                  <p><strong>ID:</strong> {selectedDeviceForRoute.device_id}</p>
                  <p><strong>Name:</strong> {selectedDeviceForRoute.device_name || 'N/A'}</p>
                  <p><strong>Type:</strong> {selectedDeviceForRoute.device_type || 'N/A'}</p>
                  <p><strong>Status:</strong> {getDeviceStatus(selectedDeviceForRoute).text}</p>
                </div>
              </div>
              
              <div className="p-4 rounded-lg bg-blue-50">
                <h4 className="flex items-center gap-2 mb-3 font-medium text-blue-900">
                  <MapPin className="w-5 h-5 text-blue-600" />
                  Vehicle Information & Live Location
                </h4>
                <div className="space-y-3">
                  {selectedDeviceForRoute.associatedVehicle && (
                    <div className="space-y-2 text-sm text-blue-800">
                      <p><strong>Number:</strong> {selectedDeviceForRoute.associatedVehicle.vehicle_number}</p>
                      <p><strong>Type:</strong> {selectedDeviceForRoute.associatedVehicle.vehicle_type}</p>
                      <p><strong>Manufacturer:</strong> {selectedDeviceForRoute.associatedVehicle.manufacturer}</p>
                      <p><strong>Model:</strong> {selectedDeviceForRoute.associatedVehicle.model}</p>
                    </div>
                  )}
                  <div className="pt-3 border-t border-blue-200">
                    <h5 className="mb-2 text-sm font-medium text-blue-900">Current Location</h5>
                    <div className="grid grid-cols-2 gap-2 text-xs text-blue-700">
                      <div><strong>Latitude:</strong> {selectedDeviceForRoute.latitude?.toFixed(6) || 'N/A'}</div>
                      <div><strong>Longitude:</strong> {selectedDeviceForRoute.longitude?.toFixed(6) || 'N/A'}</div>
                      <div><strong>Speed:</strong> {selectedDeviceForRoute.speed?.toFixed(1) || 'N/A'} km/h</div>
                      <div><strong>Heading:</strong> {selectedDeviceForRoute.heading?.toFixed(0) || 'N/A'}°</div>
                      <div><strong>Acceleration:</strong> {selectedDeviceForRoute.acceleration?.toFixed(2) || 'N/A'} m/s²</div>
                      <div><strong>Last Update:</strong> {selectedDeviceForRoute.telemetry_timestamp ? new Date(selectedDeviceForRoute.telemetry_timestamp).toLocaleString() : 'N/A'}</div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Route Information Panel */}
            {selectedDeviceForRoute.routePoints && selectedDeviceForRoute.routePoints.length > 1 && (
              <div className="p-4 border border-indigo-200 rounded-lg bg-gradient-to-r from-indigo-50 to-purple-50">
                <h4 className="flex items-center gap-2 mb-3 font-medium text-indigo-900">
                  <Map className="w-5 h-5 text-indigo-600" />
                  Journey Route Analysis
                </h4>
                <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
                  <div className="text-center">
                    <div className="text-2xl font-bold text-blue-600">
                      {selectedDeviceForRoute.routePoints.length}
                    </div>
                    <div className="text-sm text-gray-600">GPS Points</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-green-600">
                      {selectedDeviceForRoute.routePoints.filter(p => parseFloat(p.speed || 0) === 0).length}
                    </div>
                    <div className="text-sm text-gray-600">Stops Detected</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-orange-600">
                      {Math.max(...selectedDeviceForRoute.routePoints.map(p => parseFloat(p.speed || 0))).toFixed(0)}
                    </div>
                    <div className="text-sm text-gray-600">Max Speed (km/h)</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-purple-600">
                      {selectedDeviceForRoute.routePoints[0]?.timestamp && 
                       selectedDeviceForRoute.routePoints[selectedDeviceForRoute.routePoints.length - 1]?.timestamp
                        ? Math.round((new Date(selectedDeviceForRoute.routePoints[selectedDeviceForRoute.routePoints.length - 1].timestamp) - 
                           new Date(selectedDeviceForRoute.routePoints[0].timestamp)) / (1000 * 60))
                        : 0
                      }
                    </div>
                    <div className="text-sm text-gray-600">Journey Time (min)</div>
                  </div>
                </div>
                <div className="pt-3 mt-3 border-t border-indigo-200">
                  <div className="flex items-center justify-between text-sm">
                    <div className="flex items-center space-x-4">
                      <span className="flex items-center">
                        <div className="w-3 h-3 mr-2 bg-green-500 rounded-full"></div>
                        Journey Start
                      </span>
                      <span className="flex items-center">
                        <div className="w-3 h-3 mr-2 bg-orange-500 rounded-full"></div>
                        Stops
                      </span>
                      <span className="flex items-center">
                        <div className="w-3 h-3 mr-2 bg-red-500 rounded-full"></div>
                        Current Position
                      </span>
                    </div>
                    <div className="font-medium text-indigo-600">
                      🛣️ Complete route plotted on map
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Real-time Tracking Controls */}
            <div className="p-4 border border-green-200 rounded-lg bg-green-50">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <div className={`w-3 h-3 rounded-full ${realtimeTracking ? 'bg-green-500 animate-pulse' : 'bg-gray-300'}`}></div>
                  <span className="text-sm text-green-800">
                    {realtimeTracking ? 'Auto tracking active - updating every 5 seconds' : 'Starting automatic tracking...'}
                  </span>
                </div>
                <div className="text-xs text-green-700">
                  Live API telemetry data
                </div>
              </div>
            </div>

            {/* Map Container */}
            <div className="border border-gray-200 rounded-lg">
              <div className="p-3 border-b border-gray-200 bg-gray-50">
                <h4 className="flex items-center gap-2 font-medium text-gray-900">
                  <Navigation className="w-5 h-5 text-blue-600" />
                  Live Location Map (OpenStreetMap)
                </h4>
              </div>
              <div className="p-3">
                <EnhancedDeviceMap
                  device={selectedDeviceForRoute}
                  vehicle={selectedDeviceForRoute.associatedVehicle}
                  center={[
                    selectedDeviceForRoute.latitude || 0,
                    selectedDeviceForRoute.longitude || 0
                  ]}
                  zoom={15}
                  enableTracking={realtimeTracking}
                  height="400px"
                  routePoints={selectedDeviceForRoute.routePoints}
                />
              </div>
            </div>

            {/* Telemetry History */}
            {telemetryHistory.length > 0 && (
              <div className="p-3 border border-gray-200 rounded-lg">
                <h4 className="flex items-center gap-2 mb-3 font-medium text-gray-900">
                  <Clock className="w-5 h-5 text-purple-600" />
                  Recent Telemetry History
                </h4>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-2 py-1 text-left text-gray-500">Timestamp</th>
                        <th className="px-2 py-1 text-left text-gray-500">Latitude</th>
                        <th className="px-2 py-1 text-left text-gray-500">Longitude</th>
                        <th className="px-2 py-1 text-left text-gray-500">Speed</th>
                        <th className="px-2 py-1 text-left text-gray-500">Heading</th>
                        <th className="px-2 py-1 text-left text-gray-500">Alerts</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200">
                      {telemetryHistory.slice(0, 5).map((telemetry, index) => (
                        <tr key={telemetry.id || index} className={index === 0 ? 'bg-blue-50' : 'bg-white'}>
                          <td className="px-2 py-1 text-xs text-gray-900">
                            {telemetry.timestamp ? new Date(telemetry.timestamp).toLocaleString() : 'N/A'}
                          </td>
                          <td className="px-2 py-1 text-xs text-gray-900">
                            {telemetry.latitude ? parseFloat(telemetry.latitude).toFixed(6) : 'N/A'}
                          </td>
                          <td className="px-2 py-1 text-xs text-gray-900">
                            {telemetry.longitude ? parseFloat(telemetry.longitude).toFixed(6) : 'N/A'}
                          </td>
                          <td className="px-2 py-1 text-xs text-gray-900">
                            {telemetry.speed ? `${parseFloat(telemetry.speed).toFixed(1)} km/h` : 'N/A'}
                          </td>
                          <td className="px-2 py-1 text-xs text-gray-900">
                            {telemetry.heading ? `${parseFloat(telemetry.heading).toFixed(0)}°` : 'N/A'}
                          </td>
                          <td className="px-2 py-1 text-xs">
                            <div className="flex space-x-1">
                              {telemetry.drowsiness && <span className="text-orange-600" title="Drowsiness">😴</span>}
                              {telemetry.rash_driving && <span className="text-red-600" title="Rash Driving">⚡</span>}
                              {telemetry.collision && <span className="text-red-600" title="Collision">💥</span>}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Enhanced Actions Panel */}
            <div className="p-3 rounded-lg bg-gray-50">
              <h4 className="mb-2 font-semibold text-gray-900">Enhanced Tracking Actions</h4>
              <div className="grid grid-cols-2 gap-2 lg:grid-cols-4">
                <button 
                  onClick={() => window.open(`https://www.google.com/maps?q=${selectedDeviceForRoute.latitude},${selectedDeviceForRoute.longitude}`, '_blank')}
                  className="flex items-center gap-2 px-3 py-2 text-sm text-blue-600 bg-blue-100 rounded hover:bg-blue-200"
                >
                  <MapPin className="w-4 h-4" />
                  Google Maps
                </button>
                <button className="flex items-center gap-2 px-3 py-2 text-sm text-green-600 bg-green-100 rounded hover:bg-green-200">
                  <Navigation className="w-4 h-4" />
                  Set Geofence
                </button>
                <button className="flex items-center gap-2 px-3 py-2 text-sm text-orange-600 bg-orange-100 rounded hover:bg-orange-200">
                  <Activity className="w-4 h-4" />
                  Generate Report
                </button>
                <button className="flex items-center gap-2 px-3 py-2 text-sm text-purple-600 bg-purple-100 rounded hover:bg-purple-200">
                  <Clock className="w-4 h-4" />
                  Trip History
                </button>
              </div>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
};

export default DevicesPage;