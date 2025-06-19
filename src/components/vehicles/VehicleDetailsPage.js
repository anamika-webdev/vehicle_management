// Complete VehicleDetailsPage.js with ESLint fixes and Enhanced Tracking
// src/components/vehicles/VehicleDetailsPage.js

import React, { useState, useEffect, useCallback } from 'react';
import { 
  ArrowLeft, Car, Activity, MapPin, AlertTriangle, 
  Clock, TrendingUp, Gauge, CheckCircle,
  RefreshCw, Shield, Eye, Navigation, // Added Route import
  Wifi, WifiOff
} from 'lucide-react';
import { useData } from '../../contexts/DataContext';
import { useNotification } from '../../contexts/NotificationContext';
import apiService from '../../services/api';

const VehicleDetailsPage = ({ vehicleId, onBack, onEnhancedTracking }) => { // Added onEnhancedTracking prop
  const { data, loading, simulateDeviceData } = useData();
  const { showSuccess, showError } = useNotification();
  const [activeTab, setActiveTab] = useState('overview');
  const [liveData, setLiveData] = useState({});
  const [refreshing, setRefreshing] = useState(false);
  const [telemetryData, setTelemetryData] = useState([]);
  const [, setVehicleAlarms] = useState([]);
  const [isConnected, setIsConnected] = useState(true);
  const [telemetryLoading, setTelemetryLoading] = useState(false);
  const [lastTelemetryUpdate, setLastTelemetryUpdate] = useState(null);

  // Find the vehicle from real API data
  const vehicle = data.vehicles.find(v => v.vehicle_id === vehicleId);
  
  // Get devices assigned to this vehicle from real API data
  const assignedDevices = data.devices.filter(d => d.vehicle_id === vehicleId);
  const activeDevices = assignedDevices.filter(d => d.status === 'Active');

  // Get alarms for this vehicle's devices from real API data
  const vehicleAlarmsFiltered = data.alerts.filter(a => 
    assignedDevices.some(device => device.device_id === a.device_id)
  );

  // Enhanced tracking handler
  const handleEnhancedTracking = () => {
    if (onEnhancedTracking && typeof onEnhancedTracking === 'function') {
      onEnhancedTracking(vehicle);
    }
  };

  // Convert fetchVehicleData to useCallback to fix ESLint dependency issue
  const fetchVehicleData = useCallback(async (silent = false) => {
    if (!vehicle) return;

    if (!silent) setRefreshing(true);

    try {
      // Get latest vehicle information
      try {
        const vehicleResponse = await apiService.getVehicleById(vehicleId);
        if (vehicleResponse.success && vehicleResponse.data.length > 0) {
          const latestVehicleData = vehicleResponse.data[0];
          setLiveData(prev => ({
            ...prev,
            current_speed: latestVehicleData.currentSpeed || 0,
            current_latitude: latestVehicleData.currentLatitude || vehicle.current_latitude,
            current_longitude: latestVehicleData.currentLongitude || vehicle.current_longitude,
            last_update: latestVehicleData.updatedAt || new Date().toISOString()
          }));
        }
      } catch (error) {
        console.warn('Failed to fetch vehicle details:', error.message);
      }

      // Fetch alarms for this vehicle's devices
      try {
        const alarmsPromises = assignedDevices.map(device => 
          apiService.getDeviceAlarms(device.device_id, 0, 10)
            .catch(error => {
              console.warn(`Failed to get alarms for device ${device.device_id}:`, error.message);
              return { data: [] };
            })
        );
        
        const alarmsResults = await Promise.all(alarmsPromises);
        const allAlarms = alarmsResults.flatMap(result => result.data || []);
        setVehicleAlarms(allAlarms);
        
      } catch (error) {
        console.warn('Failed to fetch alarms:', error.message);
      }

    } catch (error) {
      console.error('❌ Failed to fetch vehicle data:', error);
      if (!silent) {
        showError('Data Fetch Failed', 'Failed to fetch latest vehicle data from API');
      }
    } finally {
      setRefreshing(false);
    }
  }, [vehicle, vehicleId, assignedDevices, showError]);

  // Fetch telemetry data for assigned devices
  const fetchTelemetryData = useCallback(async () => {
    if (assignedDevices.length === 0) {
      console.log('📊 No devices assigned to vehicle, clearing telemetry data');
      setTelemetryData([]);
      return;
    }

    setTelemetryLoading(true);
    try {
      console.log('🔄 Fetching telemetry for devices:', assignedDevices.map(d => d.device_id));
      
      const telemetryPromises = assignedDevices.map(async (device) => {
        try {
          const response = await apiService.getDeviceTelemetry(device.device_id, 0, 10);
          console.log(`📊 Telemetry for device ${device.device_id}:`, response);
          
          if (response.success && response.data && response.data.length > 0) {
            return response.data.map(item => ({
              // Normalize field names
              telemetry_id: item.telemetryId || item.telemetry_id,
              device_id: item.deviceId || item.device_id,
              latitude: parseFloat(item.latitude) || null,
              longitude: parseFloat(item.longitude) || null,
              acceleration: parseFloat(item.acceleration) || null,
              drowsiness: Boolean(item.drowsiness),
              rash_driving: Boolean(item.rashDriving || item.rash_driving),
              collision: Boolean(item.collision),
              timestamp: item.timestamp || item.createdAt || new Date().toISOString(),
              // Keep original fields for compatibility
              rashDriving: Boolean(item.rashDriving || item.rash_driving)
            }));
          }
          return [];
        } catch (error) {
          console.error(`❌ Failed to fetch telemetry for device ${device.device_id}:`, error);
          return [];
        }
      });

      const results = await Promise.all(telemetryPromises);
      const allTelemetry = results.flat().sort((a, b) => 
        new Date(b.timestamp || 0) - new Date(a.timestamp || 0)
      );
      
      console.log('📊 Combined telemetry data:', allTelemetry);
      setTelemetryData(allTelemetry);
      setLastTelemetryUpdate(new Date());
      
    } catch (error) {
      console.error('❌ Error fetching telemetry data:', error);
      showError('Telemetry Error', `Failed to fetch telemetry data: ${error.message}`);
      setTelemetryData([]);
    } finally {
      setTelemetryLoading(false);
    }
  }, [assignedDevices, showError]);

  // Manual refresh telemetry function
  const manualRefreshTelemetry = useCallback(async () => {
    console.log('🔄 Manual telemetry refresh triggered');
    setTelemetryData([]); // Clear current data
    setTelemetryLoading(true);
    
    // Trigger immediate refetch
    try {
      if (assignedDevices.length > 0) {
        const telemetryPromises = assignedDevices.map(async (device) => {
          const response = await apiService.getDeviceTelemetry(device.device_id, 0, 10);
          if (response.success && response.data) {
            return response.data.map(item => ({
              telemetry_id: item.telemetryId || item.telemetry_id,
              device_id: item.deviceId || item.device_id,
              latitude: parseFloat(item.latitude) || null,
              longitude: parseFloat(item.longitude) || null,
              acceleration: parseFloat(item.acceleration) || null,
              drowsiness: Boolean(item.drowsiness),
              rash_driving: Boolean(item.rashDriving || item.rash_driving),
              collision: Boolean(item.collision),
              timestamp: item.timestamp || item.createdAt,
              rashDriving: Boolean(item.rashDriving || item.rash_driving)
            }));
          }
          return [];
        });
        
        const results = await Promise.all(telemetryPromises);
        const allTelemetry = results.flat().sort((a, b) => 
          new Date(b.timestamp || 0) - new Date(a.timestamp || 0)
        );
        
        setTelemetryData(allTelemetry);
        setLastTelemetryUpdate(new Date());
        showSuccess('Refreshed', 'Telemetry data refreshed successfully');
      }
    } catch (error) {
      console.error('❌ Manual refresh failed:', error);
      showError('Refresh Failed', `Failed to refresh telemetry: ${error.message}`);
    } finally {
      setTelemetryLoading(false);
    }
  }, [assignedDevices, showSuccess, showError]);

  // Device simulation handler
  const handleDeviceSimulation = useCallback(async (deviceId, scenario) => {
    try {
      console.log('🎭 Starting device simulation:', { deviceId, scenario });
      await simulateDeviceData(deviceId, scenario);
      
      // Refresh telemetry data after simulation
      setTimeout(() => {
        fetchVehicleData(true);
      }, 2000);
      
    } catch (error) {
      console.error('❌ Device simulation failed:', error);
      showError('Simulation Failed', error.message);
    }
  }, [simulateDeviceData, fetchVehicleData, showError]);

  // Fetch telemetry data for assigned devices
  useEffect(() => {
    fetchTelemetryData();
    
    // Set up refresh interval for telemetry data
    const interval = setInterval(fetchTelemetryData, 10000); // Every 10 seconds
    return () => clearInterval(interval);
  }, [fetchTelemetryData]);

  // Initialize component and fetch real data
  useEffect(() => {
    if (!vehicle) return;

    fetchVehicleData();
    
    // Set up real-time updates from API
    const interval = setInterval(() => {
      fetchVehicleData(true); // Silent refresh
    }, 30000); // Every 30 seconds

    return () => clearInterval(interval);
  }, [vehicle, fetchVehicleData]);

  // Monitor connection status
  useEffect(() => {
    const checkConnection = async () => {
      try {
        await apiService.healthCheck();
        setIsConnected(true);
      } catch (error) {
        setIsConnected(false);
      }
    };

    // Check connection every 30 seconds
    const interval = setInterval(checkConnection, 30000);
    checkConnection(); // Initial check

    return () => clearInterval(interval);
  }, []);

  if (!vehicle) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <Car className="w-16 h-16 mx-auto mb-4 text-gray-300" />
          <h3 className="mb-2 text-lg font-medium text-gray-900">Vehicle Not Found</h3>
          <p className="mb-4 text-gray-600">The requested vehicle could not be found.</p>
          <button
            onClick={onBack}
            className="inline-flex items-center gap-2 px-4 py-2 text-blue-600 hover:text-blue-800"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Vehicles
          </button>
        </div>
      </div>
    );
  }

  const hasDeviceAlerts = (device) => {
    return device.collision_detected || device.rash_driving || device.drowsiness_level > 30;
  };

  const formatTime = (timestamp) => {
    return timestamp ? new Date(timestamp).toLocaleString() : 'Never';
  };

  const getDeviceStatusText = (device) => {
    if (device.collision_detected) return 'COLLISION ALERT';
    if (device.rash_driving) return 'RASH DRIVING';
    if (device.drowsiness_level > 50) return 'DROWSY';
    if (device.status === 'Active') return 'NORMAL';
    return device.status || 'OFFLINE';
  };

  const getDeviceStatusColor = (device) => {
    if (device.collision_detected) return 'text-red-600 bg-red-100';
    if (device.rash_driving) return 'text-orange-600 bg-orange-100';
    if (device.drowsiness_level > 50) return 'text-yellow-600 bg-yellow-100';
    if (device.status === 'Active') return 'text-green-600 bg-green-100';
    return 'text-gray-600 bg-gray-100';
  };

  const renderTelemetry = () => (
    <div className="space-y-6">
      <div className="p-6 bg-white rounded-lg shadow-md">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-900">
            Telemetry Data ({telemetryData.length} records)
          </h3>
          <div className="flex items-center gap-3">
            {lastTelemetryUpdate && (
              <span className="text-xs text-gray-500">
                Last updated: {lastTelemetryUpdate.toLocaleTimeString()}
              </span>
            )}
            <button
              onClick={manualRefreshTelemetry}
              disabled={telemetryLoading}
              className="flex items-center gap-1 px-3 py-1 text-sm text-blue-600 border border-blue-300 rounded hover:bg-blue-50 disabled:opacity-50"
            >
              <RefreshCw className={`w-4 h-4 ${telemetryLoading ? 'animate-spin' : ''}`} />
              Refresh
            </button>
          </div>
        </div>
        
        {/* Debug info in development */}
        {process.env.NODE_ENV === 'development' && (
          <div className="p-3 mb-4 text-xs bg-gray-100 rounded">
            <strong>Debug Info:</strong><br/>
            Assigned Devices: {assignedDevices.length}<br/>
            Device IDs: {assignedDevices.map(d => d.device_id).join(', ')}<br/>
            Telemetry Records: {telemetryData.length}<br/>
            Loading: {telemetryLoading ? 'Yes' : 'No'}<br/>
            Last Fetch: {lastTelemetryUpdate ? lastTelemetryUpdate.toLocaleTimeString() : 'Never'}
          </div>
        )}
        
        {telemetryLoading ? (
          <div className="py-12 text-center text-gray-500">
            <RefreshCw className="w-8 h-8 mx-auto mb-2 text-blue-600 animate-spin" />
            <p>Loading telemetry data...</p>
          </div>
        ) : telemetryData.length === 0 ? (
          <div className="py-12 text-center text-gray-500">
            <TrendingUp className="w-16 h-16 mx-auto mb-4 text-gray-300" />
            <h3 className="mb-2 text-lg font-medium text-gray-900">
              {assignedDevices.length === 0 ? 'No Devices Assigned' : 'No Telemetry Data'}
            </h3>
            <p className="text-gray-600">
              {assignedDevices.length === 0 
                ? 'This vehicle has no devices assigned to it.' 
                : 'No telemetry data available for this vehicle\'s devices.'}
            </p>
            {assignedDevices.length > 0 && (
              <div className="mt-4 space-y-2">
                <p className="text-sm text-gray-500">
                  Devices: {assignedDevices.map(d => d.device_name || `Device ${d.device_id}`).join(', ')}
                </p>
                <button
                  onClick={manualRefreshTelemetry}
                  className="inline-flex items-center gap-2 px-4 py-2 text-sm text-white bg-blue-600 rounded hover:bg-blue-700"
                >
                  <RefreshCw className="w-4 h-4" />
                  Try Refresh
                </button>
              </div>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-2 text-xs font-medium text-left text-gray-500 uppercase">Device ID</th>
                  <th className="px-4 py-2 text-xs font-medium text-left text-gray-500 uppercase">Timestamp</th>
                  <th className="px-4 py-2 text-xs font-medium text-left text-gray-500 uppercase">Location</th>
                  <th className="px-4 py-2 text-xs font-medium text-left text-gray-500 uppercase">Acceleration</th>
                  <th className="px-4 py-2 text-xs font-medium text-left text-gray-500 uppercase">Alerts</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {telemetryData.map((telemetry, index) => (
                  <tr key={telemetry.telemetry_id || telemetry.telemetryId || index} className="hover:bg-gray-50">
                    <td className="px-4 py-2 font-mono text-sm">
                      {telemetry.device_id || telemetry.deviceId || 'N/A'}
                    </td>
                    <td className="px-4 py-2 text-sm">
                      {telemetry.timestamp ? new Date(telemetry.timestamp).toLocaleString() : 'N/A'}
                    </td>
                    <td className="px-4 py-2 font-mono text-xs">
                      {telemetry.latitude && telemetry.longitude ? 
                        `${telemetry.latitude.toFixed(4)}, ${telemetry.longitude.toFixed(4)}` : 'N/A'}
                    </td>
                    <td className="px-4 py-2 text-sm">
                      {telemetry.acceleration ? `${telemetry.acceleration.toFixed(2)} m/s²` : 'N/A'}
                    </td>
                    <td className="px-4 py-2 text-xs">
                      <div className="flex gap-1">
                        {telemetry.collision && (
                          <span className="px-1 py-1 text-red-800 bg-red-100 rounded">Collision</span>
                        )}
                        {(telemetry.rash_driving || telemetry.rashDriving) && (
                          <span className="px-1 py-1 text-orange-800 bg-orange-100 rounded">Rash Driving</span>
                        )}
                        {telemetry.drowsiness && (
                          <span className="px-1 py-1 text-yellow-800 bg-yellow-100 rounded">Drowsiness</span>
                        )}
                        {!telemetry.collision && !telemetry.rash_driving && !telemetry.rashDriving && !telemetry.drowsiness && (
                          <span className="px-1 py-1 text-green-800 bg-green-100 rounded">Normal</span>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );

  const renderOverview = () => (
    <div className="space-y-6">
      {/* Vehicle Info Header */}
      <div className="p-6 bg-white rounded-lg shadow-md">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-blue-100 rounded-lg">
              <Car className="w-8 h-8 text-blue-600" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">{vehicle.vehicle_number}</h1>
              <p className="text-gray-600">{vehicle.manufacturer} {vehicle.model}</p>
            </div>
          </div>
          
          {/* Action buttons section */}
          <div className="flex items-center gap-3">
            <button
              onClick={() => fetchVehicleData()}
              disabled={refreshing}
              className="flex items-center gap-2 px-4 py-2 text-blue-600 border border-blue-300 rounded-lg hover:bg-blue-50 disabled:opacity-50"
            >
              <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
              {refreshing ? 'Refreshing...' : 'Refresh'}
            </button>
            
            {/* Enhanced tracking button */}
            {onEnhancedTracking && (
              <button
                onClick={handleEnhancedTracking}
                className="flex items-center px-4 py-2 space-x-2 text-white transition-colors bg-blue-600 rounded-lg hover:bg-blue-700"
                disabled={assignedDevices.length === 0}
                title={assignedDevices.length === 0 ? 'No devices assigned to track' : 'Enhanced Tracking'}
              >
                <Navigation  className="w-5 h-5" />
                <span>Enhanced Tracking</span>
              </button>
            )}
          </div>
        </div>

        {/* Vehicle Stats Grid */}
        <div className="grid grid-cols-1 gap-6 md:grid-cols-4">
          <div className="p-4 rounded-lg bg-blue-50">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-blue-600">Assigned Devices</p>
                <p className="text-2xl font-bold text-blue-900">{assignedDevices.length}</p>
              </div>
              <Shield className="w-8 h-8 text-blue-600" />
            </div>
          </div>

          <div className="p-4 rounded-lg bg-green-50">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-green-600">Active Devices</p>
                <p className="text-2xl font-bold text-green-900">{activeDevices.length}</p>
              </div>
              <CheckCircle className="w-8 h-8 text-green-600" />
            </div>
          </div>

          <div className="p-4 rounded-lg bg-red-50">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-red-600">Active Alarms</p>
                <p className="text-2xl font-bold text-red-900">
                  {vehicleAlarmsFiltered.filter(a => !a.resolved).length}
                </p>
              </div>
              <AlertTriangle className="w-8 h-8 text-red-600" />
            </div>
          </div>

          <div className="p-4 rounded-lg bg-gray-50">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Connection</p>
                <p className="text-sm font-bold text-gray-900">
                  {isConnected ? 'Online' : 'Offline'}
                </p>
              </div>
              {isConnected ? (
                <Wifi className="w-8 h-8 text-green-600" />
              ) : (
                <WifiOff className="w-8 h-8 text-red-600" />
              )}
            </div>
          </div>
        </div>

        {/* Safety Alerts */}
        {assignedDevices.some(hasDeviceAlerts) && (
          <div className="p-6 mt-6 border border-red-200 rounded-lg bg-red-50">
            <div className="flex items-center gap-3 mb-4">
              <AlertTriangle className="w-6 h-6 text-red-600" />
              <h3 className="text-xl font-semibold text-red-800">Active Safety Alerts</h3>
            </div>
            <div className="space-y-3">
              {assignedDevices.filter(hasDeviceAlerts).map(device => (
                <div key={device.device_id} className="flex items-center gap-3 p-3 bg-white border border-red-200 rounded-lg">
                  <div className="w-3 h-3 bg-red-500 rounded-full"></div>
                  <div>
                    <div className="font-medium text-red-800">
                      Device {device.device_id}: {getDeviceStatusText(device)}
                    </div>
                    <div className="text-sm text-red-600">
                      {device.collision_detected && 'Collision detected - '}
                      {device.rash_driving && 'Rash driving behavior - '}
                      {device.drowsiness_level > 30 && `Drowsiness level: ${device.drowsiness_level}% - `}
                      Immediate attention required
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Devices List */}
      <div className="p-6 bg-white rounded-lg shadow-md">
        <h3 className="mb-4 text-lg font-semibold text-gray-900">
          Assigned Devices ({assignedDevices.length})
        </h3>
        
        {assignedDevices.length === 0 ? (
          <div className="py-8 text-center text-gray-500">
            <Shield className="w-12 h-12 mx-auto mb-3 text-gray-300" />
            <p>No devices assigned to this vehicle</p>
          </div>
        ) : (
          <div className="space-y-3">
            {assignedDevices.map(device => (
              <div key={device.device_id} className="p-4 border border-gray-200 rounded-lg">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className={`w-3 h-3 rounded-full ${
                      device.status === 'Active' ? 'bg-green-500' : 'bg-gray-400'
                    }`}></div>
                    <div>
                      <h4 className="font-medium">{device.device_name || `Device ${device.device_id}`}</h4>
                      <p className="text-sm text-gray-600">{device.device_type}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`px-2 py-1 text-xs rounded-full ${getDeviceStatusColor(device)}`}>
                      {getDeviceStatusText(device)}
                    </span>
                    <div className="flex gap-1">
                      <button
                        onClick={() => handleDeviceSimulation(device.device_id, 'collision')}
                        className="px-2 py-1 text-xs text-red-700 bg-red-100 rounded hover:bg-red-200"
                        disabled={loading}
                      >
                        Collision
                      </button>
                      <button
                        onClick={() => handleDeviceSimulation(device.device_id, 'rash_driving')}
                        className="px-2 py-1 text-xs text-orange-700 bg-orange-100 rounded hover:bg-orange-200"
                        disabled={loading}
                      >
                        Rash
                      </button>
                      <button
                        onClick={() => handleDeviceSimulation(device.device_id, 'drowsiness')}
                        className="px-2 py-1 text-xs text-yellow-700 bg-yellow-100 rounded hover:bg-yellow-200"
                        disabled={loading}
                      >
                        Drowsy
                      </button>
                      <button
                        onClick={() => handleDeviceSimulation(device.device_id, 'normal')}
                        className="px-2 py-1 text-xs text-green-700 bg-green-100 rounded hover:bg-green-200"
                        disabled={loading}
                      >
                        Normal
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );

  const renderRealtimeData = () => (
    <div className="space-y-6">
      {/* Connection Status */}
      <div className="p-4 bg-white rounded-lg shadow-md">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            {isConnected ? (
              <>
                <Wifi className="w-5 h-5 text-green-600" />
                <span className="text-sm text-green-600">Live Connection Active</span>
                <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
              </>
            ) : (
              <>
                <WifiOff className="w-5 h-5 text-red-600" />
                <span className="text-sm text-red-600">Connection Lost</span>
                <div className="w-2 h-2 bg-red-500 rounded-full"></div>
              </>
            )}
          </div>
          <div className="text-xs text-gray-500">
            Last update: {liveData.last_update ? new Date(liveData.last_update).toLocaleTimeString() : 'N/A'}
          </div>
        </div>
      </div>

      {/* Live Vehicle Data */}
      <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-4">
        <div className="p-6 bg-white rounded-lg shadow-md">
          <div className="flex items-center justify-between mb-4">
            <Gauge className="w-8 h-8 text-blue-600" />
            <span className="px-2 py-1 text-xs text-green-600 bg-green-100 rounded-full animate-pulse">LIVE</span>
          </div>
          <div className="text-3xl font-bold text-blue-900">
            {liveData.current_speed !== undefined ? Math.round(liveData.current_speed) : 
             (vehicle.current_speed ? Math.round(vehicle.current_speed) : 0)} km/h
          </div>
          <div className="text-sm text-blue-600">Current Speed</div>
        </div>

        <div className="p-6 bg-white rounded-lg shadow-md">
          <div className="flex items-center justify-between mb-4">
            <MapPin className="w-8 h-8 text-green-600" />
            <span className="px-2 py-1 text-xs text-green-600 bg-green-100 rounded-full animate-pulse">LIVE</span>
          </div>
          <div className="text-lg font-bold text-green-900">
            {liveData.current_latitude || vehicle.current_latitude ? 
              `${(liveData.current_latitude || vehicle.current_latitude).toFixed(4)}` : 'N/A'}
          </div>
          <div className="text-sm text-green-600">Latitude</div>
        </div>

        <div className="p-6 bg-white rounded-lg shadow-md">
          <div className="flex items-center justify-between mb-4">
            <MapPin className="w-8 h-8 text-purple-600" />
            <span className="px-2 py-1 text-xs text-green-600 bg-green-100 rounded-full animate-pulse">LIVE</span>
          </div>
          <div className="text-lg font-bold text-purple-900">
            {liveData.current_longitude || vehicle.current_longitude ? 
              `${(liveData.current_longitude || vehicle.current_longitude).toFixed(4)}` : 'N/A'}
          </div>
          <div className="text-sm text-purple-600">Longitude</div>
        </div>

        <div className="p-6 bg-white rounded-lg shadow-md">
          <div className="flex items-center justify-between mb-4">
            <Clock className="w-8 h-8 text-orange-600" />
            <span className="px-2 py-1 text-xs text-green-600 bg-green-100 rounded-full animate-pulse">LIVE</span>
          </div>
          <div className="text-sm font-bold text-orange-900">
            {liveData.last_update || vehicle.updated_at ? 
              new Date(liveData.last_update || vehicle.updated_at).toLocaleTimeString() : 'N/A'}
          </div>
          <div className="text-sm text-orange-600">Last Update</div>
        </div>
      </div>

      {/* Device Status Cards */}
      <div className="p-6 bg-white rounded-lg shadow-md">
        <h3 className="mb-4 text-lg font-semibold text-gray-900">Device Status</h3>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {assignedDevices.map(device => (
            <div key={device.device_id} className="p-4 border border-gray-200 rounded-lg">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <div className={`w-3 h-3 rounded-full ${
                    device.status === 'Active' ? 'bg-green-500' : 'bg-gray-400'
                  }`}></div>
                  <span className="font-medium">{device.device_name || `Device ${device.device_id}`}</span>
                </div>
                <span className={`px-2 py-1 text-xs rounded-full ${getDeviceStatusColor(device)}`}>
                  {getDeviceStatusText(device)}
                </span>
              </div>
              
              <div className="space-y-2 text-sm text-gray-600">
                <div className="flex justify-between">
                  <span>Location:</span>
                  <span>
                    {device.latitude && device.longitude ? 
                      `${device.latitude.toFixed(4)}, ${device.longitude.toFixed(4)}` : 'No data'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>Acceleration:</span>
                  <span>
                    {device.acceleration ? `${device.acceleration.toFixed(2)} m/s²` : 'No data'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>Last Update:</span>
                  <span>{device.last_updated ? new Date(device.last_updated).toLocaleTimeString() : 'Never'}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
        
        {assignedDevices.length === 0 && (
          <div className="py-8 text-center text-gray-500">
            <Shield className="w-12 h-12 mx-auto mb-3 text-gray-300" />
            <p>No devices assigned to monitor</p>
          </div>
        )}
      </div>
    </div>
  );

  return (
    <div className="p-6 mx-auto space-y-6 max-w-7xl">
      {/* Header */}
      <div className="flex items-center justify-between">
        <button
          onClick={onBack}
          className="flex items-center gap-2 px-4 py-2 text-gray-600 hover:text-gray-800"
        >
          <ArrowLeft className="w-5 h-5" />
          Back to Vehicles
        </button>
        
        <div className="flex items-center gap-2">
          <div className={`w-2 h-2 rounded-full ${isConnected ? 'bg-green-500' : 'bg-red-500'}`}></div>
          <span className="text-sm text-gray-600">
            {isConnected ? 'Connected' : 'Disconnected'}
          </span>
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="border-b border-gray-200">
        <nav className="flex space-x-8">
          {[
            { id: 'overview', label: 'Overview', icon: Car },
            { id: 'telemetry', label: 'Telemetry', icon: Activity },
            { id: 'tracking', label: 'Live Tracking', icon: MapPin },
            { id: 'alarms', label: 'Alarms', icon: AlertTriangle }
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 py-4 px-1 border-b-2 font-medium text-sm ${
                activeTab === tab.id
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              <tab.icon className="w-4 h-4" />
              {tab.label}
            </button>
          ))}
        </nav>
      </div>

      {/* Tab Content */}
      <div className="min-h-96">
        {activeTab === 'overview' && renderOverview()}
        {activeTab === 'telemetry' && renderTelemetry()}
        {activeTab === 'tracking' && renderRealtimeData()}
        {activeTab === 'alarms' && (
          <div className="p-6 bg-white rounded-lg shadow-md">
            <h3 className="mb-4 text-lg font-semibold text-gray-900">Vehicle Alarms</h3>
            {vehicleAlarmsFiltered.length === 0 ? (
              <div className="py-8 text-center text-gray-500">
                <AlertTriangle className="w-12 h-12 mx-auto mb-3 text-gray-300" />
                <p>No alarms for this vehicle</p>
              </div>
            ) : (
              <div className="space-y-3">
                {vehicleAlarmsFiltered.map((alarm, index) => (
                  <div key={alarm.alarm_id || alarm.alert_id || index} className="p-4 border border-gray-200 rounded-lg">
                    <div className="flex items-center justify-between">
                      <div>
                        <h4 className="font-medium text-gray-900">{alarm.alarm_type}</h4>
                        <p className="text-sm text-gray-600">{alarm.description}</p>
                        <p className="text-xs text-gray-500">
                          {alarm.alarm_time ? formatTime(alarm.alarm_time) : 'No timestamp'}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className={`px-2 py-1 text-xs rounded-full ${
                          alarm.resolved ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                        }`}>
                          {alarm.resolved ? 'Resolved' : 'Active'}
                        </span>
                        <button className="p-1 text-gray-400 hover:text-gray-600">
                          <Eye className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default VehicleDetailsPage;