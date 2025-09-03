import React, { useState, useCallback, useMemo, useEffect } from 'react';
import { 
  Shield, Activity, AlertTriangle, RefreshCw, Search,
  MapPin, Navigation, Eye, Clock, Map
} from 'lucide-react';
import { useData } from '../../contexts/DataContext';
import { useNotification } from '../../components/notifications/RealTimeNotificationSystem';
import { timeAgo } from '../../utils/helpers';
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
  const [deviceDetails, setDeviceDetails] = useState({});
  
  // Route Modal State with Enhanced Tracking
  const [showRouteModal, setShowRouteModal] = useState(false);
  const [selectedDeviceForRoute, setSelectedDeviceForRoute] = useState(null);
  const [realtimeTracking, setRealtimeTracking] = useState(false);
  const [trackingInterval, setTrackingInterval] = useState(null);
  const [telemetryHistory, setTelemetryHistory] = useState([]);

  // Get devices from data context
  const devices = data?.devices || [];
  const vehicles = data?.vehicles || [];
  
  // Memoize localDevices to prevent unnecessary re-renders
  const localDevices = useMemo(() => {
    return Array.isArray(devices) ? devices : [];
  }, [devices]);
  
  const hasDevices = localDevices.length > 0;

  // Fetch detailed device information including status
  useEffect(() => {
    const fetchDeviceDetails = async () => {
      if (localDevices.length === 0) return;
      
      console.log('🔍 Fetching detailed device information for all devices...', localDevices.map(d => d.device_id));
      
      const deviceDetailsPromises = localDevices.map(async (device) => {
        const currentDeviceId = device.device_id || device.deviceId || device.id;
        
        if (!currentDeviceId) {
          console.warn(`❌ No valid device ID for device:`, device);
          return { deviceId: currentDeviceId || 'unknown', success: false, reason: 'No valid device ID' };
        }
        
        try {
          console.log(`📱 Fetching details for device: ${currentDeviceId}`);
          
          // Use your specific device API endpoint
          const deviceEndpoint = `/device/v1/${currentDeviceId}`;
          
          console.log(`🔍 Using device endpoint: ${deviceEndpoint}`);
          const response = await apiService.request(deviceEndpoint);
          
          if (response && response.success && response.data) {
            const deviceDetail = response.data;
            console.log(`✅ Device details found for ${currentDeviceId}:`, deviceDetail);
            
            return {
              deviceId: currentDeviceId,
              success: true,
              endpoint: deviceEndpoint,
              details: {
                device_id: deviceDetail.deviceId || deviceDetail.device_id || currentDeviceId,
                device_name: deviceDetail.deviceName || deviceDetail.device_name || deviceDetail.name,
                device_type: deviceDetail.deviceType || deviceDetail.device_type || deviceDetail.type,
                status: deviceDetail.status || 'Unknown',
                vehicle_id: deviceDetail.vehicleId || deviceDetail.vehicle_id,
                last_updated: deviceDetail.lastUpdated || deviceDetail.last_updated || deviceDetail.updatedAt,
                created_at: deviceDetail.createdAt || deviceDetail.created_at,
                updated_at: deviceDetail.updatedAt || deviceDetail.updated_at,
                latitude: deviceDetail.latitude ? parseFloat(deviceDetail.latitude) : null,
                longitude: deviceDetail.longitude ? parseFloat(deviceDetail.longitude) : null,
                speed: deviceDetail.speed ? parseFloat(deviceDetail.speed) : null,
                acceleration: deviceDetail.acceleration ? parseFloat(deviceDetail.acceleration) : null,
                drowsiness: Boolean(deviceDetail.drowsiness),
                rash_driving: Boolean(deviceDetail.rashDriving || deviceDetail.rash_driving),
                collision: Boolean(deviceDetail.collision),
                raw_data: deviceDetail
              }
            };
          } else {
            console.error(`❌ No device details found for ${currentDeviceId} from ${deviceEndpoint}:`, response);
            return { deviceId: currentDeviceId, success: false, reason: 'No device details found in API response' };
          }
        } catch (error) {
          console.error(`❌ Failed to fetch device details for ${currentDeviceId}:`, error);
          return { deviceId: currentDeviceId, success: false, reason: error.message };
        }
      });

      try {
        const results = await Promise.all(deviceDetailsPromises);
        const detailsMap = {};
        
        console.log('📊 Device details fetch results:', results);
        
        results.forEach(result => {
          if (result.success) {
            detailsMap[result.deviceId] = result.details;
            console.log(`✅ Device details stored for ${result.deviceId}`);
          } else {
            console.error(`❌ Device details fetch failed for ${result.deviceId}:`, result.reason);
            detailsMap[result.deviceId] = null;
          }
        });
        
        setDeviceDetails(detailsMap);
        console.log(`📋 Final device details map:`, detailsMap);
        console.log(`✅ Device details fetched for ${Object.keys(detailsMap).filter(id => detailsMap[id]).length}/${localDevices.length} devices`);
      } catch (error) {
        console.error('❌ Error in device details batch processing:', error);
      }
    };

    fetchDeviceDetails();
  }, [localDevices]);

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
          // Use your specific telemetry API endpoint
          console.log(`🔍 Fetching telemetry for device ${currentDeviceId} using correct API endpoint`);
          
          const telemetryEndpoint = `/device/v1/data/${currentDeviceId}?page=0&size=1&sortBy=telemetryId&direction=desc`;
          
          try {
            const response = await apiService.request(telemetryEndpoint);
            
            let telemetryData = null;
            if (response.success && response.data && Array.isArray(response.data) && response.data.length > 0) {
              telemetryData = response.data[0];
              console.log(`✅ Telemetry data found for device ${currentDeviceId}:`, telemetryData);
            } else if (response.data && !Array.isArray(response.data)) {
              telemetryData = response.data;
              console.log(`✅ Telemetry object data found for device ${currentDeviceId}:`, telemetryData);
            } else {
              console.warn(`⚠️ No telemetry data returned for device ${currentDeviceId}:`, response);
              return { deviceId: currentDeviceId, success: false, reason: 'No telemetry data in response' };
            }
            
            // Check if telemetry data has required fields
            if (!telemetryData || !telemetryData.latitude || !telemetryData.longitude) {
              console.warn(`⚠️ Invalid GPS data for device ${currentDeviceId}:`, { 
                hasData: !!telemetryData, 
                hasLat: !!telemetryData?.latitude,
                hasLng: !!telemetryData?.longitude,
                data: telemetryData
              });
              return { deviceId: currentDeviceId, success: false, reason: 'Invalid GPS coordinates' };
            }
            
            // Check timestamp (logTime or timestamp)
            const timestamp = telemetryData.logTime || telemetryData.timestamp;
            if (!timestamp) {
              console.warn(`⚠️ No timestamp/logTime for device ${currentDeviceId}:`, telemetryData);
              return { deviceId: currentDeviceId, success: false, reason: 'No timestamp in telemetry data' };
            }
            
            const parsedTimestamp = new Date(timestamp);
            if (isNaN(parsedTimestamp.getTime())) {
              console.warn(`⚠️ Invalid timestamp for device ${currentDeviceId}:`, timestamp);
              return { deviceId: currentDeviceId, success: false, reason: 'Invalid timestamp format' };
            }
            
            console.log(`✅ Valid telemetry found for device ${currentDeviceId}`);
            
            return {
              deviceId: currentDeviceId,
              success: true,
              telemetry: {
                latitude: parseFloat(telemetryData.latitude),
                longitude: parseFloat(telemetryData.longitude),
                speed: telemetryData.speed ? parseFloat(telemetryData.speed) : 0,
                acceleration: telemetryData.acceleration ? parseFloat(telemetryData.acceleration) : 0,
                heading: telemetryData.heading ? parseFloat(telemetryData.heading) : 0,
                timestamp: timestamp,
                logTime: telemetryData.logTime,
                telemetry_id: telemetryData.telemetryId || telemetryData.id || Date.now(),
                drowsiness: Boolean(telemetryData.drowsiness),
                rash_driving: Boolean(telemetryData.rash_driving || telemetryData.rashDriving),
                collision: Boolean(telemetryData.collision),
                raw_data: telemetryData
              }
            };
          } catch (endpointError) {
            console.error(`❌ Telemetry API failed for device ${currentDeviceId}:`, endpointError.message);
            return { deviceId: currentDeviceId, success: false, reason: `API Error: ${endpointError.message}` };
          }
        } catch (error) {
          console.warn(`Failed to fetch telemetry for device ${currentDeviceId}:`, error.message);
          return { deviceId: currentDeviceId, success: false, reason: error.message };
        }
      });

      try {
        const results = await Promise.all(telemetryPromises);
        const telemetryMap = {};
        
        console.log('📊 Telemetry fetch results for all devices:', results);
        
        results.forEach(result => {
          if (result.success) {
            telemetryMap[result.deviceId] = result.telemetry;
            console.log(`✅ Telemetry stored for device ${result.deviceId}:`, result.telemetry);
          } else {
            console.error(`❌ Telemetry fetch failed for device ${result.deviceId}:`, result.reason);
            telemetryMap[result.deviceId] = null;
          }
        });
        
        setDeviceTelemetryData(telemetryMap);
        console.log(`📋 Final telemetry map:`, telemetryMap);
        console.log(`✅ Telemetry data fetched for ${Object.keys(telemetryMap).filter(id => telemetryMap[id]).length}/${localDevices.length} devices`);
      } catch (error) {
        console.error('❌ Error in telemetry batch processing:', error);
      }
    };

    fetchDeviceTelemetryData();
  }, [localDevices]);

  // Get device status based on API device status AND recent telemetry data
  const getDeviceStatus = useCallback((device) => {
    const currentDeviceId = device.device_id || device.deviceId || device.id;
    const telemetry = deviceTelemetryData[currentDeviceId] || null;
    const deviceDetail = deviceDetails[currentDeviceId] || null;
    const now = new Date();
    
    // First check if device is deactivated from API
    const apiStatus = deviceDetail?.status || device.status || 'unknown';
    const isDeviceActive = apiStatus && (apiStatus.toLowerCase() === 'active' || apiStatus.toLowerCase() === 'online');
    
    // Check if we have valid recent telemetry data
    const hasTelemetry = telemetry && 
                        telemetry.latitude && 
                        telemetry.longitude && 
                        (telemetry.logTime || telemetry.timestamp) &&
                        !isNaN(parseFloat(telemetry.latitude)) && 
                        !isNaN(parseFloat(telemetry.longitude));
    
    const timestamp = telemetry?.logTime || telemetry?.timestamp;
    const parsedTimestamp = timestamp ? new Date(timestamp) : null;
    const isTimestampValid = parsedTimestamp && !isNaN(parsedTimestamp.getTime());
    
    // Check if telemetry is recent (within last 10 minutes)
    const TELEMETRY_FRESHNESS_MINUTES = 10;
    const isTelemetryRecent = isTimestampValid 
      ? (now - parsedTimestamp) / (1000 * 60) <= TELEMETRY_FRESHNESS_MINUTES 
      : false;
    
    // Debug logging with more detail
    console.log('🔍 Device status debug for device:', currentDeviceId, {
      device_data: device,
      device_detail: deviceDetail,
      telemetry_data: telemetry,
      apiStatus,
      isDeviceActive,
      hasTelemetry,
      isTelemetryRecent,
      timestamp, 
      parsedTimestamp: isTimestampValid ? parsedTimestamp.toISOString() : 'Invalid',
      minutesOld: isTimestampValid ? ((now - parsedTimestamp) / (1000 * 60)).toFixed(2) : 'N/A'
    });

    // Device is Active only if:
    // 1. API status shows device as active AND
    // 2. Has valid recent telemetry data
    if (isDeviceActive && hasTelemetry && isTelemetryRecent && isTimestampValid) {
      return { 
        color: 'green', 
        text: 'Active', 
        icon: '📍',
        tooltip: `Device is active and sending recent telemetry data. Last update: ${parsedTimestamp.toLocaleString()}`,
        lastUpdate: parsedTimestamp
      };
    } 
    // Device has telemetry but it's old or device is deactivated
    else if (!isDeviceActive) {
      return { 
        color: 'red', 
        text: 'Deactivated', 
        icon: '🔴',
        tooltip: `Device has been deactivated. API Status: ${apiStatus}`,
        lastUpdate: parsedTimestamp
      };
    }
    // Device is active but no recent telemetry
    else if (isDeviceActive && (!hasTelemetry || !isTelemetryRecent)) {
      const reason = !hasTelemetry ? 'No telemetry data' : 'Telemetry data is old';
      return { 
        color: 'orange', 
        text: 'No Signal', 
        icon: '📶',
        tooltip: `Device is active but ${reason.toLowerCase()}. ${isTimestampValid ? `Last telemetry: ${parsedTimestamp.toLocaleString()}` : 'No valid timestamp'}`,
        lastUpdate: parsedTimestamp
      };
    }
    // Default inactive state
    else {
      return { 
        color: 'gray', 
        text: 'Inactive', 
        icon: '⚠️',
        tooltip: `Device status unknown. API Status: ${apiStatus}`,
        lastUpdate: parsedTimestamp
      };
    }
  }, [deviceTelemetryData, deviceDetails]);

  // Enhanced route icon click handler
  const handleRouteClick = async (device) => {
    console.log('🗺️ Route icon clicked for device:', device.device_id);
    
    try {
      const associatedVehicle = vehicles.find(v => v.vehicle_id === device.vehicle_id);
      const currentDeviceId = device.device_id || device.deviceId || device.id;
      
      // Use your specific telemetry API endpoint for route data
      const telemetryEndpoint = `/device/v1/data/${currentDeviceId}?page=0&size=50&sortBy=telemetryId&direction=desc`;
      
      let telemetryResponse = null;
      try {
        console.log(`🔍 Fetching route telemetry from: ${telemetryEndpoint}`);
        const response = await apiService.request(telemetryEndpoint);
        
        if (response.success && response.data && Array.isArray(response.data) && response.data.length > 0) {
          telemetryResponse = response;
          console.log(`✅ Route telemetry data found for device ${currentDeviceId}:`, response.data.length, 'points');
        } else {
          console.warn(`⚠️ No route telemetry data for device ${currentDeviceId}:`, response);
        }
      } catch (endpointError) {
        console.error(`❌ Route telemetry API failed for device ${currentDeviceId}:`, endpointError.message);
      }
      
      if (!telemetryResponse || !telemetryResponse.success || !telemetryResponse.data || telemetryResponse.data.length === 0) {
        showError('No Telemetry Data', `No GPS telemetry data available for device ${device.device_name || currentDeviceId}.`);
        return;
      }

      const latestTelemetry = telemetryResponse.data[0];
      
      if (!latestTelemetry.latitude || !latestTelemetry.longitude || !latestTelemetry.logTime) {
        showError('Invalid Location', `Device ${device.device_name || currentDeviceId} does not have valid GPS or logTime.`);
        return;
      }

      const parsedTimestamp = new Date(latestTelemetry.logTime);
      if (isNaN(parsedTimestamp.getTime())) {
        showError('Invalid Timestamp', `Device ${device.device_name || currentDeviceId} has an invalid logTime.`);
        return;
      }

      const sortedTelemetry = telemetryResponse.data
        .filter(point => point.latitude && point.longitude && point.logTime && !isNaN(parseFloat(point.latitude)) && !isNaN(parseFloat(point.longitude)))
        .map(point => ({
          latitude: parseFloat(point.latitude),
          longitude: parseFloat(point.longitude),
          timestamp: point.logTime,
          logTime: point.logTime,
          speed: parseFloat(point.speed || 0),
          heading: parseFloat(point.heading || 0),
          drowsiness: Boolean(point.drowsiness),
          rash_driving: Boolean(point.rash_driving || point.rashDriving),
          collision: Boolean(point.collision)
        }))
        .sort((a, b) => new Date(a.logTime) - new Date(b.logTime));

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
        telemetry_timestamp: latestTelemetry.logTime,
        logTime: latestTelemetry.logTime,
        telemetry_id: latestTelemetry.telemetryId || latestTelemetry.id || Date.now(),
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
        
        // Use your specific telemetry API endpoint for real-time tracking
        const telemetryEndpoint = `/device/v1/data/${currentDeviceId}?page=0&size=1&sortBy=telemetryId&direction=desc`;
        
        let latestTelemetry = null;
        try {
          const response = await apiService.request(telemetryEndpoint);
          if (response.success && response.data && Array.isArray(response.data) && response.data.length > 0) {
            latestTelemetry = response.data[0];
            console.log(`✅ Real-time telemetry updated for device ${currentDeviceId}:`, latestTelemetry);
          } else if (response.data && !Array.isArray(response.data) && response.data.latitude) {
            latestTelemetry = response.data;
            console.log(`✅ Real-time telemetry object for device ${currentDeviceId}:`, latestTelemetry);
          } else {
            console.warn(`⚠️ No real-time telemetry for device ${currentDeviceId}:`, response);
          }
        } catch (endpointError) {
          console.error(`❌ Real-time telemetry API failed for device ${currentDeviceId}:`, endpointError.message);
        }
        
        if (latestTelemetry && latestTelemetry.latitude && latestTelemetry.longitude && latestTelemetry.logTime) {
          const parsedTimestamp = new Date(latestTelemetry.logTime);
          if (isNaN(parsedTimestamp.getTime())) {
            console.warn(`Invalid tracking logTime for device ${currentDeviceId}:`, latestTelemetry.logTime);
            return;
          }
          
          const currentTelemetryId = latestTelemetry.telemetryId || latestTelemetry.id || latestTelemetry.logTime;
          const previousTelemetryId = device.telemetry_id;
          
          if (currentTelemetryId !== previousTelemetryId) {
            const updatedDevice = {
              ...device,
              latitude: parseFloat(latestTelemetry.latitude),
              longitude: parseFloat(latestTelemetry.longitude),
              speed: parseFloat(latestTelemetry.speed || 0),
              heading: parseFloat(latestTelemetry.heading || 0),
              acceleration: parseFloat(latestTelemetry.acceleration || 0),
              telemetry_timestamp: latestTelemetry.logTime,
              logTime: latestTelemetry.logTime,
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
              logTime: latestTelemetry.logTime
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

  // Check if device has GPS data for route icon
  const hasGPSData = (device) => {
    const currentDeviceId = device.device_id || device.deviceId || device.id;
    const telemetry = deviceTelemetryData[currentDeviceId];
    return telemetry && telemetry.latitude && telemetry.longitude && 
           !isNaN(telemetry.latitude) && !isNaN(telemetry.longitude) && 
           (telemetry.logTime || telemetry.timestamp) && 
           !isNaN(new Date(telemetry.logTime || telemetry.timestamp).getTime());
  };

  // Filter devices based on search and status
  const filteredDevices = useMemo(() => {
    return localDevices.filter(device => {
      const matchesSearch = !searchTerm || 
        (device.device_name && device.device_name.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (device.device_id && device.device_id.toString().includes(searchTerm));
      
      // Updated status filtering based on actual device status
      const deviceStatus = getDeviceStatus(device);
      const matchesStatus = statusFilter === 'all' || 
        deviceStatus.text.toLowerCase() === statusFilter.toLowerCase();
      
      return matchesSearch && matchesStatus;
    });
  }, [localDevices, searchTerm, statusFilter, getDeviceStatus]);

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  // Calculate total pages and paginated devices
  const totalPages = Math.ceil(filteredDevices.length / itemsPerPage);
  const paginatedDevices = filteredDevices.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  // Manual refresh handler with complete cache clearing
  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      // Clear all cached data
      setDeviceTelemetryData({});
      setDeviceDetails({});
      
      // Force refresh from data context
      await forceRefresh(true);
      
      showSuccess('Data refreshed successfully');
      
      // Re-fetch fresh data after a short delay
      setTimeout(() => {
        window.location.reload();
      }, 1000);
      
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

      {/* Status Summary */}
      {hasDevices && (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <div className="p-4 bg-white border border-gray-200 rounded-lg">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Total Devices</p>
                <p className="text-2xl font-bold text-gray-900">{localDevices.length}</p>
              </div>
              <Shield className="w-8 h-8 text-blue-600" />
            </div>
          </div>
          
          <div className="p-4 bg-white border border-green-200 rounded-lg">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-green-600">Active Devices</p>
                <p className="text-2xl font-bold text-green-900">
                  {localDevices.filter(device => getDeviceStatus(device).text === 'Active').length}
                </p>
                <p className="text-xs text-green-600">Active with recent telemetry</p>
              </div>
              <div className="flex items-center justify-center w-8 h-8 bg-green-100 rounded-lg">
                <div className="w-3 h-3 bg-green-500 rounded-full animate-pulse"></div>
              </div>
            </div>
          </div>
          
          <div className="p-4 bg-white border border-red-200 rounded-lg">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-red-600">Deactivated/Issues</p>
                <p className="text-2xl font-bold text-red-900">
                  {localDevices.filter(device => {
                    const status = getDeviceStatus(device).text;
                    return status === 'Deactivated' || status === 'No Signal' || status === 'Inactive';
                  }).length}
                </p>
                <p className="text-xs text-red-600">Deactivated or no signal</p>
              </div>
              <AlertTriangle className="w-8 h-8 text-red-600" />
            </div>
          </div>
        </div>
      )}

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
          <option value="active">Active (Recent Telemetry)</option>
          <option value="deactivated">Deactivated</option>
          <option value="no signal">No Signal</option>
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
                  
                  // Get the most accurate timestamp - prioritize telemetry logTime over device last_updated
                  const telemetryTimestamp = telemetry?.logTime || telemetry?.timestamp;
                  const deviceTimestamp = device.last_updated;
                  const mostRecentTimestamp = telemetryTimestamp || deviceTimestamp;
                  
                  let lastUpdated = 'N/A';
                  let fullTimestamp = '';
                  
                  if (mostRecentTimestamp) {
                    const parsedTime = new Date(mostRecentTimestamp);
                    if (!isNaN(parsedTime.getTime())) {
                      lastUpdated = timeAgo(mostRecentTimestamp);
                      fullTimestamp = parsedTime.toLocaleString();
                    }
                  }
                  
                  console.log('Device timestamp data:', { 
                    device_id: device.device_id, 
                    telemetryLogTime: telemetry?.logTime,
                    telemetryTimestamp: telemetry?.timestamp,
                    deviceTimestamp,
                    mostRecentTimestamp,
                    lastUpdated,
                    fullTimestamp
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
                        <div className="text-sm">
                          <div>{lastUpdated}</div>
                          {fullTimestamp && (
                            <div className="text-xs text-gray-500" title="Exact timestamp from API">
                              📅 {fullTimestamp}
                            </div>
                          )}
                          {telemetryTimestamp && (
                            <div className="text-xs text-blue-600" title="Telemetry logTime from database">
                              📡 {new Date(telemetryTimestamp).toLocaleString()}
                            </div>
                          )}
                          {!telemetryTimestamp && deviceTimestamp && (
                            <div className="text-xs text-gray-400" title="Device last updated">
                              🔄 {new Date(deviceTimestamp).toLocaleString()}
                            </div>
                          )}
                        </div>
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
                      <div><strong>Last Update:</strong> {selectedDeviceForRoute.logTime ? new Date(selectedDeviceForRoute.logTime).toLocaleString() : 'N/A'}</div>
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
                            {telemetry.logTime ? new Date(telemetry.logTime).toLocaleString() : 
                             (telemetry.timestamp ? new Date(telemetry.timestamp).toLocaleString() : 'N/A')}
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