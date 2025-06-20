// src/components/devices/DeviceDetailsPage.js - FRONTEND ONLY FIX
import React, { useState, useEffect, useCallback } from 'react';
import { 
  ArrowLeft, Activity, MapPin, AlertTriangle, 
  Clock, TrendingUp, Gauge, CheckCircle,
  RefreshCw, Shield, Eye, Settings,
  Wifi, Battery, Signal, Zap
} from 'lucide-react';
import { useData } from '../../contexts/DataContext';
import { useNotification } from '../../contexts/NotificationContext';
import { formatTime, formatDateTime, timeAgo } from '../../utils/helpers';
import apiService from '../../services/api';

const DeviceDetailsPage = ({ deviceId, onBack }) => {
  const { data, loading, simulateDeviceData } = useData();
  const { showSuccess, showError } = useNotification();
  const [activeTab, setActiveTab] = useState('overview');
  const [liveData, setLiveData] = useState({});
  const [refreshing, setRefreshing] = useState(false);
  const [telemetryData, setTelemetryData] = useState([]);
  const [deviceAlarms, setDeviceAlarms] = useState([]);
  const [isConnected, setIsConnected] = useState(true);
  const [telemetryLoading, setTelemetryLoading] = useState(false);
  const [deviceDetails, setDeviceDetails] = useState(null);
  const [deviceNotFound, setDeviceNotFound] = useState(false);

  // VALIDATION: Check if deviceId is valid
  const isValidDeviceId = useCallback(() => {
    return deviceId && 
           deviceId !== 'undefined' && 
           deviceId !== 'null' && 
           deviceId !== '' &&
           deviceId !== null &&
           deviceId !== undefined;
  }, [deviceId]);

  // Find the device from real API data with fallback
  const device = data.devices.find(d => d.device_id === deviceId) || deviceDetails;
  
  // Get vehicle assigned to this device
  const assignedVehicle = data.vehicles.find(v => v.vehicle_id === device?.vehicle_id);
  
  // Get alarms for this device from real API data
  const deviceAlarmsFiltered = data.alerts.filter(a => a.device_id === deviceId);

  // Fetch device details from API if not in context
  const fetchDeviceDetails = useCallback(async () => {
    if (!isValidDeviceId()) {
      console.warn('⚠️ Invalid device ID, cannot fetch details:', deviceId);
      setDeviceNotFound(true);
      showError('Invalid Device', `Device ID "${deviceId}" is not valid`);
      return;
    }

    try {
      console.log(`📱 Fetching device details for: ${deviceId}`);
      const response = await apiService.getDeviceById(deviceId);
      
      if (response.success && response.data) {
        setDeviceDetails(response.data);
        setDeviceNotFound(false);
      } else {
        console.warn('Device not found in API response');
        setDeviceNotFound(true);
      }
    } catch (error) {
      console.error('Failed to fetch device details:', error.message);
      setDeviceNotFound(true);
      
      // Only show error if it's not a validation error (which we already handled)
      if (!error.message.includes('Invalid device ID')) {
        showError('Device Error', `Failed to load device details: ${error.message}`);
      }
    }
  }, [deviceId, isValidDeviceId, showError]);

  // Fetch device alarms
  const fetchDeviceAlarms = useCallback(async () => {
    if (!isValidDeviceId()) {
      console.warn('⚠️ Invalid device ID, cannot fetch alarms:', deviceId);
      return;
    }

    try {
      console.log(`🚨 Fetching alarms for device: ${deviceId}`);
      const response = await apiService.getDeviceAlarms(deviceId, 0, 10);
      
      if (response.success && response.data) {
        setDeviceAlarms(response.data);
      } else {
        console.warn('No alarms found for device');
        setDeviceAlarms([]);
      }
    } catch (error) {
      console.error(`Failed to fetch device alarms:`, error.message);
      setDeviceAlarms([]);
      
      // Only show error if it's not a validation error
      if (!error.message.includes('Invalid device ID')) {
        showError('Alarms Error', `Failed to load device alarms: ${error.message}`);
      }
    }
  }, [deviceId, isValidDeviceId, showError]);

  // Fetch telemetry data with validation
  const fetchTelemetryData = useCallback(async () => {
    if (!isValidDeviceId()) {
      console.warn('⚠️ Invalid device ID, cannot fetch telemetry:', deviceId);
      setTelemetryData([]);
      return;
    }

    setTelemetryLoading(true);
    try {
      console.log(`🔄 Fetching telemetry for device: ${deviceId}`);
      const response = await apiService.getDeviceTelemetry(deviceId, 0, 20);
      console.log(`📊 Telemetry response:`, response);
      
      if (response.success && response.data) {
        const normalizedTelemetry = response.data.map(item => ({
          telemetry_id: item.telemetryId || item.telemetry_id || item.id,
          device_id: item.deviceId || item.device_id,
          latitude: parseFloat(item.latitude) || null,
          longitude: parseFloat(item.longitude) || null,
          acceleration: parseFloat(item.acceleration) || null,
          drowsiness: Boolean(item.drowsiness),
          rash_driving: Boolean(item.rashDriving || item.rash_driving),
          collision: Boolean(item.collision),
          timestamp: item.timestamp || item.createdAt || new Date().toISOString(),
          battery_voltage: parseFloat(item.batteryVoltage || item.battery_voltage) || null,
          signal_strength: parseInt(item.signalStrength || item.signal_strength) || null,
          speed: parseFloat(item.speed) || null
        }));
        
        setTelemetryData(normalizedTelemetry.sort((a, b) => 
          new Date(b.timestamp) - new Date(a.timestamp)
        ));
      } else {
        console.warn('No telemetry data found');
        setTelemetryData([]);
      }
      
    } catch (error) {
      console.error('❌ Error fetching telemetry data:', error);
      setTelemetryData([]);
      
      // Only show error if it's not a validation error
      if (!error.message.includes('Invalid device ID')) {
        showError('Telemetry Error', `Failed to fetch telemetry data: ${error.message}`);
      }
    } finally {
      setTelemetryLoading(false);
    }
  }, [deviceId, isValidDeviceId, showError]);

  // Fetch device data from API
  const fetchDeviceData = useCallback(async (silent = false) => {
    if (!isValidDeviceId()) {
      console.warn('⚠️ Invalid device ID, cannot fetch data:', deviceId);
      return;
    }

    if (!silent) setRefreshing(true);

    try {
      // Fetch device details if not available
      if (!device) {
        await fetchDeviceDetails();
      }
      
      // Fetch telemetry and alarms in parallel
      await Promise.all([
        fetchTelemetryData(),
        fetchDeviceAlarms()
      ]);
      
      console.log('✅ Device data refreshed successfully');
      if (!silent) {
        showSuccess('Data Refreshed', 'Device data has been updated');
      }
      
    } catch (error) {
      console.error('❌ Error refreshing device data:', error);
      if (!silent) {
        showError('Refresh Failed', `Failed to refresh device data: ${error.message}`);
      }
    } finally {
      if (!silent) setRefreshing(false);
    }
  }, [device, deviceId, isValidDeviceId, fetchDeviceDetails, fetchTelemetryData, fetchDeviceAlarms, showSuccess, showError]);

  // Device simulation handler
  const handleDeviceSimulation = useCallback(async (scenario) => {
    if (!isValidDeviceId()) {
      showError('Invalid Device', 'Cannot simulate data for invalid device ID');
      return;
    }

    try {
      console.log('🎭 Starting device simulation:', { deviceId, scenario });
      await simulateDeviceData(deviceId, scenario);
      
      // Refresh device data after simulation
      setTimeout(() => {
        fetchDeviceData(true);
      }, 2000);
      
      showSuccess('Simulation Started', `${scenario} scenario activated for device ${deviceId}`);
    } catch (error) {
      console.error('❌ Simulation failed:', error);
      showError('Simulation Failed', error.message);
    }
  }, [deviceId, isValidDeviceId, simulateDeviceData, fetchDeviceData, showSuccess, showError]);

  // Initial data fetch on component mount
  useEffect(() => {
    if (!isValidDeviceId()) {
      console.error('❌ DeviceDetailsPage mounted with invalid device ID:', deviceId);
      setDeviceNotFound(true);
      return;
    }

    console.log('🔄 DeviceDetailsPage mounted, fetching data for device:', deviceId);
    
    // Fetch data immediately
    fetchDeviceData(true);
    
    // Set up interval for live updates
    const interval = setInterval(() => {
      fetchTelemetryData();
    }, 30000); // Update every 30 seconds
    
    return () => clearInterval(interval);
  }, [deviceId, isValidDeviceId, fetchDeviceData, fetchTelemetryData]);

  // Show error state for invalid device ID
  if (!isValidDeviceId() || deviceNotFound) {
    return (
      <div className="min-h-screen p-6 bg-gray-50">
        <div className="mx-auto max-w-7xl">
          {/* Header */}
          <div className="flex items-center gap-4 mb-6">
            <button
              onClick={onBack}
              className="flex items-center gap-2 px-4 py-2 text-gray-600 transition-colors rounded-lg hover:bg-gray-100"
            >
              <ArrowLeft className="w-5 h-5" />
              Back to Devices
            </button>
          </div>

          {/* Error State */}
          <div className="p-8 text-center bg-white rounded-lg shadow-md">
            <AlertTriangle className="w-16 h-16 mx-auto mb-4 text-red-500" />
            <h2 className="mb-2 text-2xl font-bold text-gray-900">Device Not Found</h2>
            <p className="mb-4 text-gray-600">
              The device with ID "{deviceId}" could not be found or is invalid.
            </p>
            <div className="p-4 mb-4 rounded-lg bg-red-50">
              <p className="text-sm text-red-800">
                <strong>Possible issues:</strong>
              </p>
              <ul className="mt-2 text-sm text-red-700 list-disc list-inside">
                <li>Device ID is undefined or empty</li>
                <li>Device does not exist in the system</li>
                <li>API connection issue</li>
                <li>Device was recently deleted</li>
              </ul>
            </div>
            <button
              onClick={onBack}
              className="px-6 py-2 text-white bg-blue-600 rounded-lg hover:bg-blue-700"
            >
              Return to Device List
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Show loading state
  if (loading && !device) {
    return (
      <div className="min-h-screen p-6 bg-gray-50">
        <div className="mx-auto max-w-7xl">
          <div className="flex items-center justify-center h-64">
            <div className="flex items-center gap-3">
              <RefreshCw className="w-6 h-6 text-blue-600 animate-spin" />
              <span className="text-gray-600">Loading device details...</span>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Rest of your component remains the same...
  // (Include all your existing render logic here)
  
  return (
    <div className="min-h-screen p-6 bg-gray-50">
      <div className="mx-auto max-w-7xl">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-4">
            <button
              onClick={onBack}
              className="flex items-center gap-2 px-4 py-2 text-gray-600 transition-colors rounded-lg hover:bg-gray-100"
            >
              <ArrowLeft className="w-5 h-5" />
              Back to Devices
            </button>
            <div>
              <h1 className="text-3xl font-bold text-gray-900">
                Device {device?.device_id || 'Unknown'}
              </h1>
              <p className="text-gray-600">
                {device?.device_name || 'Device Details'}
                {assignedVehicle && ` • Assigned to ${assignedVehicle.vehicle_number}`}
              </p>
            </div>
          </div>
          
          <div className="flex gap-3">
            <button
              onClick={() => fetchDeviceData()}
              disabled={refreshing}
              className="flex items-center gap-2 px-4 py-2 text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50"
            >
              <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
              {refreshing ? 'Refreshing...' : 'Refresh'}
            </button>
          </div>
        </div>

        {/* Device Status */}
        <div className="grid grid-cols-1 gap-6 mb-6 md:grid-cols-4">
          <div className="p-6 bg-white rounded-lg shadow-md">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Status</p>
                <p className={`text-lg font-semibold ${
                  device?.status === 'Active' ? 'text-green-600' : 'text-red-600'
                }`}>
                  {device?.status || 'Unknown'}
                </p>
              </div>
              <div className={`p-3 rounded-full ${
                device?.status === 'Active' ? 'bg-green-100' : 'bg-red-100'
              }`}>
                {device?.status === 'Active' ? (
                  <CheckCircle className="w-6 h-6 text-green-600" />
                ) : (
                  <AlertTriangle className="w-6 h-6 text-red-600" />
                )}
              </div>
            </div>
          </div>

          <div className="p-6 bg-white rounded-lg shadow-md">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Connection</p>
                <p className={`text-lg font-semibold ${
                  isConnected ? 'text-green-600' : 'text-red-600'
                }`}>
                  {isConnected ? 'Online' : 'Offline'}
                </p>
              </div>
              <div className={`p-3 rounded-full ${
                isConnected ? 'bg-green-100' : 'bg-red-100'
              }`}>
                <Wifi className={`w-6 h-6 ${
                  isConnected ? 'text-green-600' : 'text-red-600'
                }`} />
              </div>
            </div>
          </div>

          <div className="p-6 bg-white rounded-lg shadow-md">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Telemetry Records</p>
                <p className="text-lg font-semibold text-blue-600">
                  {telemetryData.length}
                </p>
              </div>
              <div className="p-3 bg-blue-100 rounded-full">
                <Activity className="w-6 h-6 text-blue-600" />
              </div>
            </div>
          </div>

          <div className="p-6 bg-white rounded-lg shadow-md">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Active Alarms</p>
                <p className="text-lg font-semibold text-red-600">
                  {deviceAlarmsFiltered.length + deviceAlarms.length}
                </p>
              </div>
              <div className="p-3 bg-red-100 rounded-full">
                <AlertTriangle className="w-6 h-6 text-red-600" />
              </div>
            </div>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="mb-6 bg-white rounded-lg shadow-md">
          <div className="flex border-b border-gray-200">
            {['overview', 'telemetry', 'alarms', 'settings'].map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`px-6 py-4 font-medium capitalize ${
                  activeTab === tab
                    ? 'text-blue-600 border-b-2 border-blue-600'
                    : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                {tab}
              </button>
            ))}
          </div>
        </div>

        {/* Tab Content */}
        {activeTab === 'overview' && renderOverview()}
        {activeTab === 'telemetry' && renderTelemetry()}
        {activeTab === 'alarms' && renderAlarms()}
        {activeTab === 'settings' && renderSettings()}
      </div>
    </div>
  );

  // Render Overview Tab
  function renderOverview() {
    return (
      <div className="space-y-6">
        {/* Device Information */}
        <div className="p-6 bg-white rounded-lg shadow-md">
          <h3 className="mb-4 text-lg font-semibold text-gray-900">Device Information</h3>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
            <div>
              <label className="text-sm font-medium text-gray-500">Device ID</label>
              <p className="text-gray-900">{device?.device_id || 'N/A'}</p>
            </div>
            <div>
              <label className="text-sm font-medium text-gray-500">Device Name</label>
              <p className="text-gray-900">{device?.device_name || 'N/A'}</p>
            </div>
            <div>
              <label className="text-sm font-medium text-gray-500">Device Type</label>
              <p className="text-gray-900">{device?.device_type || 'N/A'}</p>
            </div>
            <div>
              <label className="text-sm font-medium text-gray-500">Status</label>
              <p className={`font-medium ${
                device?.status === 'Active' ? 'text-green-600' : 'text-red-600'
              }`}>
                {device?.status || 'Unknown'}
              </p>
            </div>
            <div>
              <label className="text-sm font-medium text-gray-500">Last Update</label>
              <p className="text-gray-900">
                {device?.updated_at ? timeAgo(device.updated_at) : 'N/A'}
              </p>
            </div>
            <div>
              <label className="text-sm font-medium text-gray-500">Vehicle Assignment</label>
              <p className="text-gray-900">
                {assignedVehicle ? assignedVehicle.vehicle_number : 'Not assigned'}
              </p>
            </div>
          </div>
        </div>

        {/* Latest Telemetry */}
        {telemetryData.length > 0 && (
          <div className="p-6 bg-white rounded-lg shadow-md">
            <h3 className="mb-4 text-lg font-semibold text-gray-900">Latest Telemetry</h3>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
              <div className="p-4 border border-gray-200 rounded-lg">
                <div className="flex items-center gap-3">
                  <MapPin className="w-5 h-5 text-blue-600" />
                  <div>
                    <p className="text-sm text-gray-500">Location</p>
                    <p className="font-medium">
                      {telemetryData[0].latitude && telemetryData[0].longitude
                        ? `${telemetryData[0].latitude.toFixed(4)}, ${telemetryData[0].longitude.toFixed(4)}`
                        : 'N/A'}
                    </p>
                  </div>
                </div>
              </div>
              
              <div className="p-4 border border-gray-200 rounded-lg">
                <div className="flex items-center gap-3">
                  <Gauge className="w-5 h-5 text-green-600" />
                  <div>
                    <p className="text-sm text-gray-500">Speed</p>
                    <p className="font-medium">
                      {telemetryData[0].speed ? `${telemetryData[0].speed} km/h` : 'N/A'}
                    </p>
                  </div>
                </div>
              </div>
              
              <div className="p-4 border border-gray-200 rounded-lg">
                <div className="flex items-center gap-3">
                  <Battery className="w-5 h-5 text-orange-600" />
                  <div>
                    <p className="text-sm text-gray-500">Battery</p>
                    <p className="font-medium">
                      {telemetryData[0].battery_voltage ? `${telemetryData[0].battery_voltage}V` : 'N/A'}
                    </p>
                  </div>
                </div>
              </div>
              
              <div className="p-4 border border-gray-200 rounded-lg">
                <div className="flex items-center gap-3">
                  <Signal className="w-5 h-5 text-purple-600" />
                  <div>
                    <p className="text-sm text-gray-500">Signal</p>
                    <p className="font-medium">
                      {telemetryData[0].signal_strength ? `${telemetryData[0].signal_strength}%` : 'N/A'}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Device Simulation */}
        <div className="p-6 bg-white rounded-lg shadow-md">
          <h3 className="mb-4 text-lg font-semibold text-gray-900">Device Simulation</h3>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <button
              onClick={() => handleDeviceSimulation('normal')}
              className="p-4 text-left border border-gray-200 rounded-lg hover:bg-gray-50"
            >
              <div className="flex items-center gap-3">
                <CheckCircle className="w-6 h-6 text-green-600" />
                <div>
                  <h4 className="font-medium">Normal Operation</h4>
                  <p className="text-sm text-gray-600">Simulate normal driving behavior</p>
                </div>
              </div>
            </button>
            
            <button
              onClick={() => handleDeviceSimulation('alert')}
              className="p-4 text-left border border-gray-200 rounded-lg hover:bg-gray-50"
            >
              <div className="flex items-center gap-3">
                <AlertTriangle className="w-6 h-6 text-yellow-600" />
                <div>
                  <h4 className="font-medium">Alert Scenario</h4>
                  <p className="text-sm text-gray-600">Simulate rash driving alerts</p>
                </div>
              </div>
            </button>
            
            <button
              onClick={() => handleDeviceSimulation('emergency')}
              className="p-4 text-left border border-gray-200 rounded-lg hover:bg-gray-50"
            >
              <div className="flex items-center gap-3">
                <Zap className="w-6 h-6 text-red-600" />
                <div>
                  <h4 className="font-medium">Emergency</h4>
                  <p className="text-sm text-gray-600">Simulate collision detection</p>
                </div>
              </div>
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Render Telemetry Tab
  function renderTelemetry() {
    return (
      <div className="space-y-6">
        <div className="p-6 bg-white rounded-lg shadow-md">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-900">Telemetry Data</h3>
            <button
              onClick={fetchTelemetryData}
              disabled={telemetryLoading}
              className="flex items-center gap-2 px-4 py-2 text-blue-600 border border-blue-600 rounded-lg hover:bg-blue-50 disabled:opacity-50"
            >
              <RefreshCw className={`w-4 h-4 ${telemetryLoading ? 'animate-spin' : ''}`} />
              {telemetryLoading ? 'Loading...' : 'Refresh'}
            </button>
          </div>
          
          {telemetryLoading ? (
            <div className="flex items-center justify-center h-32">
              <RefreshCw className="w-6 h-6 text-blue-600 animate-spin" />
            </div>
          ) : telemetryData.length === 0 ? (
            <div className="py-8 text-center text-gray-500">
              <Activity className="w-12 h-12 mx-auto mb-3 text-gray-300" />
              <p>No telemetry data available</p>
              <p className="text-sm">Device may not have sent any data yet</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full border border-collapse border-gray-200">
                <thead>
                  <tr className="bg-gray-50">
                    <th className="px-4 py-2 text-left border border-gray-200">Timestamp</th>
                    <th className="px-4 py-2 text-left border border-gray-200">Speed</th>
                    <th className="px-4 py-2 text-left border border-gray-200">Location</th>
                    <th className="px-4 py-2 text-left border border-gray-200">Acceleration</th>
                    <th className="px-4 py-2 text-left border border-gray-200">Battery</th>
                    <th className="px-4 py-2 text-left border border-gray-200">Signal</th>
                    <th className="px-4 py-2 text-left border border-gray-200">Alerts</th>
                  </tr>
                </thead>
                <tbody>
                  {telemetryData.map((telemetry, index) => (
                    <tr key={telemetry.telemetry_id || index} className="hover:bg-gray-50">
                      <td className="px-4 py-2 text-sm border border-gray-200">
                        {formatDateTime(telemetry.timestamp)}
                      </td>
                      <td className="px-4 py-2 text-sm border border-gray-200">
                        {telemetry.speed ? `${telemetry.speed} km/h` : 'N/A'}
                      </td>
                      <td className="px-4 py-2 text-sm border border-gray-200">
                        {telemetry.latitude && telemetry.longitude
                          ? `${telemetry.latitude.toFixed(4)}, ${telemetry.longitude.toFixed(4)}`
                          : 'N/A'}
                      </td>
                      <td className="px-4 py-2 text-sm border border-gray-200">
                        {telemetry.acceleration ? `${telemetry.acceleration.toFixed(2)} m/s²` : 'N/A'}
                      </td>
                      <td className="px-4 py-2 text-sm border border-gray-200">
                        {telemetry.battery_voltage ? `${telemetry.battery_voltage.toFixed(1)}V` : 'N/A'}
                      </td>
                      <td className="px-4 py-2 text-sm border border-gray-200">
                        {telemetry.signal_strength ? `${telemetry.signal_strength}%` : 'N/A'}
                      </td>
                      <td className="px-4 py-2 text-xs border border-gray-200">
                        <div className="flex gap-1">
                          {telemetry.collision && (
                            <span className="px-1 py-1 text-red-800 bg-red-100 rounded">Collision</span>
                          )}
                          {telemetry.rash_driving && (
                            <span className="px-1 py-1 text-orange-800 bg-orange-100 rounded">Rash Driving</span>
                          )}
                          {telemetry.drowsiness && (
                            <span className="px-1 py-1 text-yellow-800 bg-yellow-100 rounded">Drowsiness</span>
                          )}
                          {!telemetry.collision && !telemetry.rash_driving && !telemetry.drowsiness && (
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
  }

  // Render Alarms Tab
  function renderAlarms() {
    const allAlarms = [...deviceAlarmsFiltered, ...deviceAlarms];
    
    return (
      <div className="space-y-6">
        <div className="p-6 bg-white rounded-lg shadow-md">
          <h3 className="mb-4 text-lg font-semibold text-gray-900">Device Alarms</h3>
          {allAlarms.length === 0 ? (
            <div className="py-8 text-center text-gray-500">
              <AlertTriangle className="w-12 h-12 mx-auto mb-3 text-gray-300" />
              <p>No alarms for this device</p>
            </div>
          ) : (
            <div className="space-y-3">
              {allAlarms.map((alarm, index) => (
                <div key={alarm.alarm_id || alarm.alert_id || index} className="p-4 border border-gray-200 rounded-lg">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="font-medium text-gray-900">{alarm.alarm_type}</h4>
                      <p className="text-sm text-gray-600">{alarm.description}</p>
                      <p className="text-xs text-gray-500">
                        {alarm.created_at ? formatDateTime(alarm.created_at) : 'Unknown time'}
                      </p>
                    </div>
                    <span className={`px-2 py-1 text-xs rounded-full ${
                      alarm.severity === 'high' ? 'bg-red-100 text-red-800' :
                      alarm.severity === 'medium' ? 'bg-yellow-100 text-yellow-800' :
                      'bg-blue-100 text-blue-800'
                    }`}>
                      {alarm.severity || 'medium'}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    );
  }

  // Render Settings Tab
  function renderSettings() {
    return (
      <div className="space-y-6">
        <div className="p-6 bg-white rounded-lg shadow-md">
          <h3 className="mb-4 text-lg font-semibold text-gray-900">Device Settings</h3>
          <div className="space-y-4">
            <div className="flex items-center justify-between p-4 border border-gray-200 rounded-lg">
              <div>
                <h4 className="font-medium">Real-time Updates</h4>
                <p className="text-sm text-gray-600">Enable automatic data refresh</p>
              </div>
              <button className="px-4 py-2 text-blue-600 border border-blue-600 rounded-lg hover:bg-blue-50">
                Configure
              </button>
            </div>
            
            <div className="flex items-center justify-between p-4 border border-gray-200 rounded-lg">
              <div>
                <h4 className="font-medium">Alert Notifications</h4>
                <p className="text-sm text-gray-600">Manage device alert settings</p>
              </div>
              <button className="px-4 py-2 text-blue-600 border border-blue-600 rounded-lg hover:bg-blue-50">
                Configure
              </button>
            </div>
            
            <div className="flex items-center justify-between p-4 border border-gray-200 rounded-lg">
              <div>
                <h4 className="font-medium">Data Export</h4>
                <p className="text-sm text-gray-600">Export device telemetry data</p>
              </div>
              <button className="px-4 py-2 text-blue-600 border border-blue-600 rounded-lg hover:bg-blue-50">
                Export
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }
};

export default DeviceDetailsPage;