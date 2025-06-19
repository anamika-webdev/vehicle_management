// Updated DeviceDetailsPage.js with ESLint fixes
// src/components/devices/DeviceDetailsPage.js

import React, { useState, useEffect, useCallback } from 'react';
import { 
  ArrowLeft, Activity, MapPin, AlertTriangle, 
  Clock, TrendingUp, Gauge, CheckCircle,
  RefreshCw, Shield, Eye, Settings,
  Wifi, Battery, Signal, Zap
} from 'lucide-react'; // Removed unused imports: WifiOff, Navigation, Car, Link
import { useData } from '../../contexts/DataContext';
import { useNotification } from '../../contexts/NotificationContext';
import { formatTime, formatDateTime, timeAgo } from '../../utils/helpers'; // Removed unused: getDeviceAlertLevel
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

  // Find the device from real API data
  const device = data.devices.find(d => d.device_id === deviceId);
  
  // Get vehicle assigned to this device
  const assignedVehicle = data.vehicles.find(v => v.vehicle_id === device?.vehicle_id);
  
  // Get alarms for this device from real API data
  const deviceAlarmsFiltered = data.alerts.filter(a => a.device_id === deviceId);

  // Fetch device data from API
  const fetchDeviceData = useCallback(async (silent = false) => {
    if (!device) return;

    if (!silent) setRefreshing(true);

    try {
      // Get latest device information
      try {
        const deviceResponse = await apiService.getDeviceById(deviceId);
        if (deviceResponse.success && deviceResponse.data.length > 0) {
          const latestDeviceData = deviceResponse.data[0];
          setLiveData(prev => ({
            ...prev,
            latitude: latestDeviceData.latitude || device.latitude,
            longitude: latestDeviceData.longitude || device.longitude,
            acceleration: latestDeviceData.acceleration || device.acceleration,
            battery_voltage: latestDeviceData.batteryVoltage || device.battery_voltage,
            signal_strength: latestDeviceData.signalStrength || device.signal_strength,
            last_update: latestDeviceData.updatedAt || new Date().toISOString()
          }));
        }
      } catch (error) {
        console.warn('Failed to fetch device details:', error.message);
      }

      // Fetch alarms for this device
      try {
        const alarmsResponse = await apiService.getDeviceAlarms(deviceId, 0, 10);
        if (alarmsResponse.success) {
          setDeviceAlarms(alarmsResponse.data || []);
        }
      } catch (error) {
        console.warn('Failed to fetch device alarms:', error.message);
      }

    } catch (error) {
      console.error('❌ Failed to fetch device data:', error);
      if (!silent) {
        showError('Data Fetch Failed', 'Failed to fetch latest device data from API');
      }
    } finally {
      setRefreshing(false);
    }
  }, [device, deviceId, showError]);

  // Fetch telemetry data for this device
  const fetchTelemetryData = useCallback(async () => {
    if (!device) {
      setTelemetryData([]);
      return;
    }

    setTelemetryLoading(true);
    try {
      console.log('🔄 Fetching telemetry for device:', deviceId);
      
      const response = await apiService.getDeviceTelemetry(deviceId, 0, 20);
      console.log(`📊 Telemetry response:`, response);
      
      if (response.success && response.data) {
        const normalizedTelemetry = response.data.map(item => ({
          telemetry_id: item.telemetryId || item.telemetry_id,
          device_id: item.deviceId || item.device_id,
          latitude: parseFloat(item.latitude) || null,
          longitude: parseFloat(item.longitude) || null,
          acceleration: parseFloat(item.acceleration) || null,
          drowsiness: Boolean(item.drowsiness),
          rash_driving: Boolean(item.rashDriving || item.rash_driving),
          collision: Boolean(item.collision),
          timestamp: item.timestamp || item.createdAt || new Date().toISOString(),
          battery_voltage: parseFloat(item.batteryVoltage) || null,
          signal_strength: parseInt(item.signalStrength) || null
        }));
        
        setTelemetryData(normalizedTelemetry.sort((a, b) => 
          new Date(b.timestamp) - new Date(a.timestamp)
        ));
      } else {
        setTelemetryData([]);
      }
      
    } catch (error) {
      console.error('❌ Error fetching telemetry data:', error);
      showError('Telemetry Error', `Failed to fetch telemetry data: ${error.message}`);
      setTelemetryData([]);
    } finally {
      setTelemetryLoading(false);
    }
  }, [device, deviceId, showError]);

  // Device simulation handler
  const handleDeviceSimulation = useCallback(async (scenario) => {
    try {
      console.log('🎭 Starting device simulation:', { deviceId, scenario });
      await simulateDeviceData(deviceId, scenario);
      
      // Refresh device data after simulation
      setTimeout(() => {
        fetchDeviceData(true);
        fetchTelemetryData();
      }, 2000);
      
      showSuccess('Simulation Started', `${scenario} scenario activated for device ${deviceId}`);
      
    } catch (error) {
      console.error('❌ Device simulation failed:', error);
      showError('Simulation Failed', error.message);
    }
  }, [deviceId, simulateDeviceData, fetchDeviceData, fetchTelemetryData, showSuccess, showError]);

  // Initialize component and fetch data
  useEffect(() => {
    if (!device) return;

    fetchDeviceData();
    fetchTelemetryData();
    
    // Set up real-time updates
    const interval = setInterval(() => {
      fetchDeviceData(true); // Silent refresh
    }, 30000); // Every 30 seconds

    return () => clearInterval(interval);
  }, [device, fetchDeviceData, fetchTelemetryData]);

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

    const interval = setInterval(checkConnection, 30000);
    checkConnection(); // Initial check

    return () => clearInterval(interval);
  }, []);

  if (!device) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <Shield className="w-16 h-16 mx-auto mb-4 text-gray-300" />
          <h3 className="mb-2 text-lg font-medium text-gray-900">Device Not Found</h3>
          <p className="mb-4 text-gray-600">The requested device could not be found.</p>
          <button
            onClick={onBack}
            className="inline-flex items-center gap-2 px-4 py-2 text-blue-600 hover:text-blue-800"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Devices
          </button>
        </div>
      </div>
    );
  }

  const hasAlerts = device.collision_detected || device.rash_driving || device.drowsiness_level > 30;

  const getStatusColor = (status) => {
    switch (status) {
      case 'Active': return 'text-green-600 bg-green-100';
      case 'Inactive': return 'text-red-600 bg-red-100';
      case 'Maintenance': return 'text-yellow-600 bg-yellow-100';
      default: return 'text-gray-600 bg-gray-100';
    }
  };

  const getBatteryColor = (voltage) => {
    if (voltage > 12.5) return 'text-green-600';
    if (voltage > 11.5) return 'text-yellow-600';
    return 'text-red-600';
  };

  const getSignalColor = (strength) => {
    if (strength > 75) return 'text-green-600';
    if (strength > 50) return 'text-yellow-600';
    return 'text-red-600';
  };

  const renderOverview = () => (
    <div className="space-y-6">
      {/* Device Info Header */}
      <div className="p-6 bg-white rounded-lg shadow-md">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-blue-100 rounded-lg">
              <Shield className="w-8 h-8 text-blue-600" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">
                {device.device_name || `Device ${device.device_id}`}
              </h1>
              <p className="text-gray-600">{device.device_type}</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <span className={`px-3 py-1 rounded-full text-sm font-medium ${getStatusColor(device.status)}`}>
              {device.status}
            </span>
            <button
              onClick={() => fetchDeviceData()}
              disabled={refreshing}
              className="flex items-center gap-2 px-4 py-2 text-blue-600 border border-blue-300 rounded-lg hover:bg-blue-50 disabled:opacity-50"
            >
              <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
              {refreshing ? 'Refreshing...' : 'Refresh'}
            </button>
          </div>
        </div>

        {/* Device Stats Grid */}
        <div className="grid grid-cols-1 gap-6 md:grid-cols-4">
          <div className="p-4 rounded-lg bg-blue-50">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-blue-600">Connection</p>
                <p className="text-2xl font-bold text-blue-900">
                  {isConnected ? 'Online' : 'Offline'}
                </p>
              </div>
              <Wifi className="w-8 h-8 text-blue-600" />
            </div>
          </div>

          <div className="p-4 rounded-lg bg-green-50">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-green-600">Battery</p>
                <p className={`text-2xl font-bold ${getBatteryColor(liveData.battery_voltage || device.battery_voltage || 12.0)}`}>
                  {(liveData.battery_voltage || device.battery_voltage || 12.0).toFixed(1)}V
                </p>
              </div>
              <Battery className="w-8 h-8 text-green-600" />
            </div>
          </div>

          <div className="p-4 rounded-lg bg-yellow-50">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-yellow-600">Signal</p>
                <p className={`text-2xl font-bold ${getSignalColor(liveData.signal_strength || device.signal_strength || 0)}`}>
                  {liveData.signal_strength || device.signal_strength || 0}%
                </p>
              </div>
              <Signal className="w-8 h-8 text-yellow-600" />
            </div>
          </div>

          <div className="p-4 rounded-lg bg-red-50">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-red-600">Alerts</p>
                <p className="text-2xl font-bold text-red-900">
                  {deviceAlarmsFiltered.filter(a => !a.resolved).length}
                </p>
              </div>
              <AlertTriangle className="w-8 h-8 text-red-600" />
            </div>
          </div>
        </div>

        {/* Safety Alerts */}
        {hasAlerts && (
          <div className="p-6 mt-6 border border-red-200 rounded-lg bg-red-50">
            <div className="flex items-center gap-3 mb-4">
              <AlertTriangle className="w-6 h-6 text-red-600" />
              <h3 className="text-xl font-semibold text-red-800">Active Safety Alerts</h3>
            </div>
            <div className="space-y-3">
              {device.collision_detected && (
                <div className="flex items-center gap-3 p-3 bg-white border border-red-200 rounded-lg">
                  <div className="w-3 h-3 bg-red-500 rounded-full"></div>
                  <div>
                    <div className="font-medium text-red-800">Collision Detected</div>
                    <div className="text-sm text-red-600">Immediate attention required</div>
                  </div>
                </div>
              )}
              {device.rash_driving && (
                <div className="flex items-center gap-3 p-3 bg-white border border-red-200 rounded-lg">
                  <div className="w-3 h-3 bg-red-500 rounded-full"></div>
                  <div>
                    <div className="font-medium text-red-800">Rash Driving Behavior</div>
                    <div className="text-sm text-red-600">Driver coaching recommended</div>
                  </div>
                </div>
              )}
              {device.drowsiness_level > 30 && (
                <div className="flex items-center gap-3 p-3 bg-white border border-red-200 rounded-lg">
                  <div className="w-3 h-3 bg-red-500 rounded-full"></div>
                  <div>
                    <div className="font-medium text-red-800">High Drowsiness Level ({device.drowsiness_level}%)</div>
                    <div className="text-sm text-red-600">Rest break suggested</div>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Device Information */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="p-6 bg-white rounded-lg shadow-md">
          <h3 className="mb-4 text-lg font-semibold text-gray-900">Device Information</h3>
          <div className="space-y-3">
            <div className="flex justify-between">
              <span className="text-gray-600">Device ID:</span>
              <span className="font-mono text-sm">{device.device_id}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Device Name:</span>
              <span className="font-medium">{device.device_name || 'Not set'}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Device Type:</span>
              <span className="font-medium">{device.device_type}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Status:</span>
              <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(device.status)}`}>
                {device.status}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Assigned Vehicle:</span>
              <span className="font-medium">
                {assignedVehicle ? assignedVehicle.vehicle_number : 'Not assigned'}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Created:</span>
              <span className="text-sm">{formatDateTime(device.created_at)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Last Updated:</span>
              <span className="text-sm">{formatDateTime(device.updated_at)}</span>
            </div>
          </div>
        </div>

        <div className="p-6 bg-white rounded-lg shadow-md">
          <h3 className="mb-4 text-lg font-semibold text-gray-900">Current Status</h3>
          <div className="space-y-3">
            <div className="flex justify-between">
              <span className="text-gray-600">Location:</span>
              <span className="font-mono text-sm">
                {liveData.latitude && liveData.longitude ? 
                  `${liveData.latitude.toFixed(4)}, ${liveData.longitude.toFixed(4)}` : 
                  (device.latitude && device.longitude ? 
                    `${device.latitude.toFixed(4)}, ${device.longitude.toFixed(4)}` : 'Unknown')}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Acceleration:</span>
              <span className="font-medium">
                {(liveData.acceleration || device.acceleration || 0).toFixed(2)} m/s²
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Battery Voltage:</span>
              <span className={`font-medium ${getBatteryColor(liveData.battery_voltage || device.battery_voltage || 12.0)}`}>
                {(liveData.battery_voltage || device.battery_voltage || 12.0).toFixed(2)}V
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Signal Strength:</span>
              <span className={`font-medium ${getSignalColor(liveData.signal_strength || device.signal_strength || 0)}`}>
                {liveData.signal_strength || device.signal_strength || 0}%
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Drowsiness Level:</span>
              <span className="font-medium">{device.drowsiness_level || 0}%</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Last Update:</span>
              <span className="text-sm">
                {liveData.last_update ? timeAgo(liveData.last_update) : 
                 (device.last_updated ? timeAgo(device.last_updated) : 'Never')}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Simulation Controls */}
      <div className="p-6 bg-white rounded-lg shadow-md">
        <h3 className="mb-4 text-lg font-semibold text-gray-900">Device Simulation</h3>
        <p className="mb-4 text-sm text-gray-600">
          Simulate different device scenarios for testing purposes
        </p>
        <div className="flex flex-wrap gap-3">
          <button
            onClick={() => handleDeviceSimulation('collision')}
            className="px-4 py-2 text-red-700 bg-red-100 rounded-lg hover:bg-red-200 disabled:opacity-50"
            disabled={loading}
          >
            <AlertTriangle className="inline w-4 h-4 mr-2" />
            Simulate Collision
          </button>
          <button
            onClick={() => handleDeviceSimulation('rash_driving')}
            className="px-4 py-2 text-orange-700 bg-orange-100 rounded-lg hover:bg-orange-200 disabled:opacity-50"
            disabled={loading}
          >
            <Zap className="inline w-4 h-4 mr-2" />
            Simulate Rash Driving
          </button>
          <button
            onClick={() => handleDeviceSimulation('drowsiness')}
            className="px-4 py-2 text-yellow-700 bg-yellow-100 rounded-lg hover:bg-yellow-200 disabled:opacity-50"
            disabled={loading}
          >
            <Clock className="inline w-4 h-4 mr-2" />
            Simulate Drowsiness
          </button>
          <button
            onClick={() => handleDeviceSimulation('normal')}
            className="px-4 py-2 text-green-700 bg-green-100 rounded-lg hover:bg-green-200 disabled:opacity-50"
            disabled={loading}
          >
            <CheckCircle className="inline w-4 h-4 mr-2" />
            Reset to Normal
          </button>
        </div>
      </div>
    </div>
  );

  const renderTelemetry = () => (
    <div className="space-y-6">
      <div className="p-6 bg-white rounded-lg shadow-md">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-900">
            Telemetry Data ({telemetryData.length} records)
          </h3>
          <button
            onClick={fetchTelemetryData}
            disabled={telemetryLoading}
            className="flex items-center gap-2 px-3 py-1 text-sm text-blue-600 border border-blue-300 rounded hover:bg-blue-50 disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${telemetryLoading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>
        
        {telemetryLoading ? (
          <div className="py-12 text-center text-gray-500">
            <RefreshCw className="w-8 h-8 mx-auto mb-2 text-blue-600 animate-spin" />
            <p>Loading telemetry data...</p>
          </div>
        ) : telemetryData.length === 0 ? (
          <div className="py-12 text-center text-gray-500">
            <TrendingUp className="w-16 h-16 mx-auto mb-4 text-gray-300" />
            <h3 className="mb-2 text-lg font-medium text-gray-900">No Telemetry Data</h3>
            <p className="text-gray-600">No telemetry data available for this device.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-2 text-xs font-medium text-left text-gray-500 uppercase">Timestamp</th>
                  <th className="px-4 py-2 text-xs font-medium text-left text-gray-500 uppercase">Location</th>
                  <th className="px-4 py-2 text-xs font-medium text-left text-gray-500 uppercase">Acceleration</th>
                  <th className="px-4 py-2 text-xs font-medium text-left text-gray-500 uppercase">Battery</th>
                  <th className="px-4 py-2 text-xs font-medium text-left text-gray-500 uppercase">Signal</th>
                  <th className="px-4 py-2 text-xs font-medium text-left text-gray-500 uppercase">Alerts</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {telemetryData.map((telemetry, index) => (
                  <tr key={telemetry.telemetry_id || index} className="hover:bg-gray-50">
                    <td className="px-4 py-2 text-sm">
                      {formatDateTime(telemetry.timestamp)}
                    </td>
                    <td className="px-4 py-2 font-mono text-xs">
                      {telemetry.latitude && telemetry.longitude ? 
                        `${telemetry.latitude.toFixed(4)}, ${telemetry.longitude.toFixed(4)}` : 'N/A'}
                    </td>
                    <td className="px-4 py-2 text-sm">
                      {telemetry.acceleration ? `${telemetry.acceleration.toFixed(2)} m/s²` : 'N/A'}
                    </td>
                    <td className="px-4 py-2 text-sm">
                      {telemetry.battery_voltage ? `${telemetry.battery_voltage.toFixed(1)}V` : 'N/A'}
                    </td>
                    <td className="px-4 py-2 text-sm">
                      {telemetry.signal_strength ? `${telemetry.signal_strength}%` : 'N/A'}
                    </td>
                    <td className="px-4 py-2 text-xs">
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

  const renderAlarms = () => (
    <div className="space-y-6">
      <div className="p-6 bg-white rounded-lg shadow-md">
        <h3 className="mb-4 text-lg font-semibold text-gray-900">Device Alarms</h3>
        {deviceAlarmsFiltered.length === 0 ? (
          <div className="py-8 text-center text-gray-500">
            <AlertTriangle className="w-12 h-12 mx-auto mb-3 text-gray-300" />
            <p>No alarms for this device</p>
          </div>
        ) : (
          <div className="space-y-3">
            {deviceAlarmsFiltered.map((alarm, index) => (
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
          Back to Devices
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
            { id: 'overview', label: 'Overview', icon: Shield },
            { id: 'telemetry', label: 'Telemetry', icon: Activity },
            { id: 'location', label: 'Location', icon: MapPin },
            { id: 'alarms', label: 'Alarms', icon: AlertTriangle },
            { id: 'settings', label: 'Settings', icon: Settings }
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
        {activeTab === 'location' && (
          <div className="p-6 bg-white rounded-lg shadow-md">
            <h3 className="mb-4 text-lg font-semibold text-gray-900">Device Location</h3>
            <div className="flex items-center justify-center bg-gray-100 rounded-lg h-96">
              <div className="text-center text-gray-500">
                <MapPin className="w-12 h-12 mx-auto mb-3 text-gray-300" />
                <p>Map integration coming soon</p>
                <p className="mt-2 text-sm">
                  Current location: {device.latitude && device.longitude ? 
                    `${device.latitude.toFixed(6)}, ${device.longitude.toFixed(6)}` : 'Unknown'}
                </p>
              </div>
            </div>
          </div>
        )}
        {activeTab === 'alarms' && renderAlarms()}
        {activeTab === 'settings' && (
          <div className="p-6 bg-white rounded-lg shadow-md">
            <h3 className="mb-4 text-lg font-semibold text-gray-900">Device Settings</h3>
            <div className="py-12 text-center text-gray-500">
              <Settings className="w-12 h-12 mx-auto mb-3 text-gray-300" />
              <p>Device configuration settings will be available here</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default DeviceDetailsPage;