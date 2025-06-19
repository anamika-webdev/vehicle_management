// Updated DevicesPage.js with improved telemetry display and debugging
// src/components/devices/DevicesPage.js

import React, { useState, useEffect } from 'react';
import { 
  Shield, Plus, Search, Filter, Eye, 
  AlertTriangle, CheckCircle, 
  RefreshCw, Bug
} from 'lucide-react';
import { useData } from '../../contexts/DataContext';
import { useNotification } from '../../contexts/NotificationContext';
import apiService from '../../services/api';

const DevicesPage = ({ onViewDevice }) => {
  const { data, loading, simulateDeviceData, fetchData } = useData();
  const { showSuccess, showError, showWarning } = useNotification();
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  const [refreshing, setRefreshing] = useState(false);
  const [lastUpdate, setLastUpdate] = useState(new Date());
  const [showDebugInfo, setShowDebugInfo] = useState(process.env.NODE_ENV === 'development');

  // Auto-refresh devices data
  useEffect(() => {
    const interval = setInterval(() => {
      console.log('🔄 Auto-refreshing devices data...');
      fetchData(true); // Silent refresh
      setLastUpdate(new Date());
    }, 30000); // Every 30 seconds

    return () => clearInterval(interval);
  }, [fetchData]);

  // Debug logging for telemetry data
  useEffect(() => {
    if (showDebugInfo) {
      console.log('🔍 DevicesPage - Current devices:', data.devices);
      console.log('🔍 DevicesPage - Devices with telemetry:', 
        data.devices.filter(d => d.last_updated).length
      );
      
      // Log each device's telemetry status
      data.devices.forEach(device => {
        console.log(`Device ${device.device_id}:`, {
          status: device.status,
          last_updated: device.last_updated,
          has_location: !!(device.latitude && device.longitude),
          has_acceleration: !!device.acceleration,
          telemetry_count: device.telemetry_count || 0,
          drowsiness_level: device.drowsiness_level,
          rash_driving: device.rash_driving,
          collision_detected: device.collision_detected
        });
      });
    }
  }, [data.devices, showDebugInfo]);

  const handleManualRefresh = async () => {
    setRefreshing(true);
    try {
      console.log('🔄 Manual devices refresh triggered');
      await fetchData();
      setLastUpdate(new Date());
      showSuccess('Refreshed', 'Device data updated successfully');
    } catch (error) {
      console.error('❌ Manual refresh failed:', error);
      showError('Refresh Failed', `Failed to refresh data: ${error.message}`);
    } finally {
      setRefreshing(false);
    }
  };

  const handleDeviceSimulation = async (deviceId, scenario) => {
    try {
      console.log('🎭 Device simulation triggered:', { deviceId, scenario });
      await simulateDeviceData(deviceId, scenario);
      
      // Refresh data after simulation
      setTimeout(() => {
        fetchData(true);
        setLastUpdate(new Date());
      }, 2000);
      
    } catch (error) {
      console.error('❌ Device simulation failed:', error);
    }
  };

  const handleTestTelemetryFetch = async (deviceId) => {
    try {
      console.log(`🧪 Testing telemetry fetch for device ${deviceId}...`);
      const response = await apiService.getDeviceTelemetry(deviceId, 0, 5);
      console.log(`📊 Telemetry test result for device ${deviceId}:`, response);
      
      if (response.success && response.data.length > 0) {
        showSuccess('Test Successful', `Found ${response.data.length} telemetry records for device ${deviceId}`);
      } else {
        showWarning('No Data', `No telemetry data found for device ${deviceId}`);
      }
    } catch (error) {
      console.error(`❌ Telemetry test failed for device ${deviceId}:`, error);
      showError('Test Failed', `Telemetry test failed: ${error.message}`);
    }
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

  const hasDeviceAlerts = (device) => {
    return device.collision_detected || device.rash_driving || device.drowsiness_level > 30;
  };

  // Filter devices based on search and filter criteria
  const filteredDevices = data.devices.filter(device => {
    const matchesSearch = !searchTerm || 
      device.device_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      device.device_id?.toString().includes(searchTerm) ||
      device.device_type?.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesFilter = filterStatus === 'all' || 
      (filterStatus === 'active' && device.status === 'Active') ||
      (filterStatus === 'inactive' && device.status !== 'Active') ||
      (filterStatus === 'alerts' && hasDeviceAlerts(device)) ||
      (filterStatus === 'unassigned' && !device.vehicle_id);

    return matchesSearch && matchesFilter;
  });

  // Device Card Component with enhanced telemetry info
  const DeviceCard = ({ device }) => {
    const vehicle = data.vehicles.find(v => v.vehicle_id === device.vehicle_id);
    
    return (
      <div className={`p-4 border rounded-lg hover:shadow-md transition-shadow ${
        hasDeviceAlerts(device) ? 'border-red-200 bg-red-50' : 'border-gray-200 bg-white'
      }`}>
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-3">
            <div className={`w-3 h-3 rounded-full ${
              device.status === 'Active' ? 'bg-green-500' : 'bg-gray-400'
            }`}></div>
            <div>
              <h4 className="font-medium">{device.device_name || `Device ${device.device_id}`}</h4>
              <p className="text-sm text-gray-600">{device.device_type}</p>
            </div>
          </div>
          <div className="flex gap-1">
            <button
              onClick={() => onViewDevice && onViewDevice(device.device_id)}
              className="p-1 text-gray-400 hover:text-gray-600"
              title="View Details"
            >
              <Eye className="w-4 h-4" />
            </button>
            {showDebugInfo && (
              <button
                onClick={() => handleTestTelemetryFetch(device.device_id)}
                className="p-1 text-blue-400 hover:text-blue-600"
                title="Test Telemetry"
              >
                <Bug className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>

        {/* Device Status */}
        <div className="mb-3">
          <span className={`px-2 py-1 text-xs rounded-full ${getDeviceStatusColor(device)}`}>
            {getDeviceStatusText(device)}
          </span>
        </div>

        {/* Vehicle Assignment */}
        <div className="mb-3 text-sm">
          <span className="text-gray-600">Vehicle: </span>
          <span className="font-medium">
            {vehicle ? vehicle.vehicle_number : 'Unassigned'}
          </span>
        </div>

        {/* Telemetry Info */}
        <div className="mb-3 space-y-1 text-xs text-gray-600">
          <div className="flex justify-between">
            <span>Location:</span>
            <span>
              {device.latitude && device.longitude 
                ? `${device.latitude.toFixed(4)}, ${device.longitude.toFixed(4)}`
                : 'No data'}
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
          {showDebugInfo && (
            <div className="flex justify-between">
              <span>Telemetry Records:</span>
              <span>{device.telemetry_count || 0}</span>
            </div>
          )}
        </div>

        {/* Safety Indicators */}
        {hasDeviceAlerts(device) && (
          <div className="p-2 mb-3 text-xs bg-red-100 border border-red-200 rounded">
            <div className="flex items-center gap-1 text-red-800">
              <AlertTriangle className="w-3 h-3" />
              <span className="font-medium">Active Alerts</span>
            </div>
            <div className="mt-1 space-y-1">
              {device.collision_detected && (
                <div className="text-red-700">🚨 Collision Detected</div>
              )}
              {device.rash_driving && (
                <div className="text-orange-700">⚠️ Rash Driving</div>
              )}
              {device.drowsiness_level > 30 && (
                <div className="text-yellow-700">😴 Drowsiness ({device.drowsiness_level}%)</div>
              )}
            </div>
          </div>
        )}

        {/* Simulation Controls */}
        {device.status === 'Active' && (
          <div className="space-y-2">
            <div className="text-xs font-medium text-gray-600">Test Scenarios:</div>
            <div className="flex flex-wrap gap-1">
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
                className="px-2 py-1 text-xs text-orange-700 bg-orange-100 rounded hover:bg-orange-200"
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
        )}
      </div>
    );
  };

  // Data Table Component for devices
  const DeviceDataTable = () => {
    const tableRows = filteredDevices.map(device => {
      const vehicle = data.vehicles.find(v => v.vehicle_id === device.vehicle_id);
      return {
        device_id: device.device_id,
        device_name: device.device_name,
        device_type: device.device_type,
        status: getDeviceStatusText(device),
        vehicle_assignment: vehicle ? vehicle.vehicle_number : 'Unassigned',
        last_updated: device.last_updated ? formatTime(device.last_updated) : 'No data',
        has_telemetry: !!(device.latitude && device.longitude),
        telemetry_count: device.telemetry_count || 0
      };
    });

    return (
      <div className="bg-white rounded-lg shadow-md">
        <div className="p-6 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold text-gray-900">Device Management</h3>
            <div className="flex gap-2">
              {showDebugInfo && (
                <button
                  onClick={() => setShowDebugInfo(!showDebugInfo)}
                  className="flex items-center gap-2 px-3 py-1 text-xs text-blue-600 border border-blue-300 rounded hover:bg-blue-50"
                >
                  <Bug className="w-3 h-3" />
                  Debug: {showDebugInfo ? 'ON' : 'OFF'}
                </button>
              )}
              <button
                onClick={handleManualRefresh}
                disabled={refreshing}
                className="flex items-center gap-2 px-3 py-1 text-sm text-blue-600 border border-blue-300 rounded hover:bg-blue-50 disabled:opacity-50"
              >
                <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
                Refresh
              </button>
              <button
                disabled
                className="flex items-center gap-2 px-4 py-2 text-gray-400 bg-gray-100 rounded-lg cursor-not-allowed"
                title="Add new device functionality coming soon"
              >
                <Plus className="w-4 h-4" />
                Add Device
              </button>
            </div>
          </div>
          
          {/* Last Update Info */}
          <div className="mt-2 text-xs text-gray-500">
            Last updated: {lastUpdate.toLocaleTimeString()} | 
            Total devices: {data.devices.length} | 
            Filtered: {filteredDevices.length}
          </div>
        </div>
        
        {/* Debug Info Panel */}
        {showDebugInfo && (
          <div className="p-4 border-b border-gray-200 bg-gray-50">
            <h4 className="mb-2 text-sm font-medium text-gray-800">Debug Information</h4>
            <div className="grid grid-cols-2 gap-4 text-xs md:grid-cols-4">
              <div>
                <span className="font-medium">Total Devices:</span>
                <div>{data.devices.length}</div>
              </div>
              <div>
                <span className="font-medium">With Telemetry:</span>
                <div>{data.devices.filter(d => d.last_updated).length}</div>
              </div>
              <div>
                <span className="font-medium">With Location:</span>
                <div>{data.devices.filter(d => d.latitude && d.longitude).length}</div>
              </div>
              <div>
                <span className="font-medium">Active Alerts:</span>
                <div>{data.devices.filter(hasDeviceAlerts).length}</div>
              </div>
            </div>
          </div>
        )}
        
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                {['Device ID', 'Name', 'Type', 'Status', 'Vehicle', 'Last Update', 'Telemetry', 'Actions'].map((header, index) => (
                  <th key={index} className="px-6 py-3 text-xs font-medium tracking-wider text-left text-gray-500 uppercase">
                    {header}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {tableRows.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-6 py-8 text-center text-gray-500">
                    {loading ? 'Loading devices...' : 'No devices found matching the current filters.'}
                  </td>
                </tr>
              ) : (
                tableRows.map((row) => (
                  <tr key={row.device_id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 font-mono text-sm">{row.device_id}</td>
                    <td className="px-6 py-4 text-sm font-medium text-gray-900">
                      {row.device_name || `Device ${row.device_id}`}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-500">{row.device_type}</td>
                    <td className="px-6 py-4">
                      <span className={`px-2 py-1 text-xs rounded-full ${
                        getDeviceStatusColor(data.devices.find(d => d.device_id === row.device_id))
                      }`}>
                        {row.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-500">{row.vehicle_assignment}</td>
                    <td className="px-6 py-4 text-sm text-gray-500">{row.last_updated}</td>
                    <td className="px-6 py-4 text-sm">
                      <div className="flex items-center gap-2">
                        {row.has_telemetry ? (
                          <>
                            <CheckCircle className="w-4 h-4 text-green-600" />
                            <span className="text-green-600">Available</span>
                          </>
                        ) : (
                          <>
                            <AlertTriangle className="w-4 h-4 text-yellow-600" />
                            <span className="text-yellow-600">No Data</span>
                          </>
                        )}
                        {showDebugInfo && (
                          <span className="text-xs text-gray-500">({row.telemetry_count})</span>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4 text-sm">
                      <div className="flex gap-2">
                        <button
                          onClick={() => onViewDevice && onViewDevice(row.device_id)}
                          className="text-blue-600 hover:text-blue-800"
                          title="View Details"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                        {showDebugInfo && (
                          <button
                            onClick={() => handleTestTelemetryFetch(row.device_id)}
                            className="text-green-600 hover:text-green-800"
                            title="Test Telemetry"
                          >
                            <Bug className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    );
  };

  return (
    <div className="p-6 mx-auto space-y-6 max-w-7xl">
      {/* Header with Stats */}
      <div className="grid grid-cols-1 gap-6 md:grid-cols-4">
        <div className="p-4 bg-white rounded-lg shadow-md">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Total Devices</p>
              <p className="text-2xl font-bold text-blue-600">{data.devices.length}</p>
            </div>
            <Shield className="w-8 h-8 text-blue-600" />
          </div>
        </div>
        
        <div className="p-4 bg-white rounded-lg shadow-md">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Active</p>
              <p className="text-2xl font-bold text-green-600">
                {data.devices.filter(d => d.status === 'Active').length}
              </p>
            </div>
            <CheckCircle className="w-8 h-8 text-green-600" />
          </div>
        </div>
        
        <div className="p-4 bg-white rounded-lg shadow-md">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">With Alerts</p>
              <p className="text-2xl font-bold text-red-600">
                {data.devices.filter(hasDeviceAlerts).length}
              </p>
            </div>
            <AlertTriangle className="w-8 h-8 text-red-600" />
          </div>
        </div>
        
        <div className="p-4 bg-white rounded-lg shadow-md">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Unassigned</p>
              <p className="text-2xl font-bold text-yellow-600">
                {data.devices.filter(d => !d.vehicle_id).length}
              </p>
            </div>
            <Shield className="w-8 h-8 text-yellow-600" />
          </div>
        </div>
      </div>

      {/* Search and Filter Controls */}
      <div className="p-4 bg-white rounded-lg shadow-md">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div className="flex gap-4">
            <div className="relative">
              <Search className="absolute w-4 h-4 text-gray-400 left-3 top-3" />
              <input
                type="text"
                placeholder="Search devices..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="py-2 pl-10 pr-4 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
            
            <div className="relative">
              <Filter className="absolute w-4 h-4 text-gray-400 left-3 top-3" />
              <select
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value)}
                className="py-2 pl-10 pr-8 bg-white border border-gray-300 rounded-lg appearance-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="all">All Devices</option>
                <option value="active">Active Only</option>
                <option value="inactive">Inactive Only</option>
                <option value="alerts">With Alerts</option>
                <option value="unassigned">Unassigned</option>
              </select>
            </div>
          </div>
          
          <div className="text-sm text-gray-500">
            Showing {filteredDevices.length} of {data.devices.length} devices
          </div>
        </div>
      </div>

      {/* Device Data Table */}
      <DeviceDataTable />
      
      {/* Device Cards Grid for Real-time Monitoring */}
      <div className="p-6 bg-white rounded-lg shadow-md">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h3 className="text-lg font-semibold">Device Real-time Status</h3>
            <p className="text-sm text-gray-600">Monitor your devices with live data updates</p>
          </div>
          <div className="flex items-center gap-4">
            <span className="text-sm text-gray-500">
              {data.devices.filter(d => d.status === 'Active').length} of {data.devices.length} devices online
            </span>
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
              <span className="text-sm text-green-600">Live Updates</span>
            </div>
          </div>
        </div>
        
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {filteredDevices.map((device) => (
            <DeviceCard key={device.device_id} device={device} />
          ))}
        </div>
        
        {filteredDevices.length === 0 && (
          <div className="py-12 text-center text-gray-500">
            <Shield className="w-16 h-16 mx-auto mb-4 text-gray-300" />
            <h3 className="mb-2 text-lg font-medium text-gray-900">No Devices Found</h3>
            <p className="text-gray-600">
              {data.devices.length === 0 
                ? 'Devices will appear here once they\'re detected by the system'
                : 'No devices match the current search and filter criteria'}
            </p>
            {searchTerm || filterStatus !== 'all' ? (
              <button
                onClick={() => {
                  setSearchTerm('');
                  setFilterStatus('all');
                }}
                className="px-4 py-2 mt-4 text-sm text-white bg-blue-600 rounded hover:bg-blue-700"
              >
                Clear Filters
              </button>
            ) : null}
          </div>
        )}
      </div>
    </div>
  );
};

export default DevicesPage;