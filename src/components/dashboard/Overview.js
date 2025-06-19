// Fixed Overview.js - Removed GoogleMapsLiveTracking import
// src/components/dashboard/Overview.js

import React from 'react';
import { Car, Shield, Bell, AlertTriangle } from 'lucide-react';
import { useData } from '../../contexts/DataContext';
import { useWebSocket } from '../../contexts/WebSocketContext';

// Safe helper function to calculate stats from API data only
const calculateStats = (data) => {
  try {
    const vehicles = data?.vehicles || [];
    const devices = data?.devices || [];
    const alarms = data?.alarms || data?.alerts || [];
    
    const totalVehicles = vehicles.length;
    const activeDevices = devices.filter(d => d && d.status === 'Active').length;
    const activeAlarms = alarms.filter(a => a && !a.resolved).length;
    const unassignedDevices = devices.filter(d => d && !d.vehicle_id).length;
    const vehiclesWithGPS = devices.filter(d => d && d.latitude && d.longitude && d.vehicle_id).length;

    return {
      totalVehicles,
      activeDevices,
      activeAlarms,
      unassignedDevices,
      vehiclesWithGPS
    };
  } catch (error) {
    console.warn('Error calculating stats from API data:', error);
    return {
      totalVehicles: 0,
      activeDevices: 0,
      activeAlarms: 0,
      unassignedDevices: 0,
      vehiclesWithGPS: 0
    };
  }
};

const Overview = ({ onViewVehicle }) => {
  const { data, loading, error } = useData();
  const { isConnected } = useWebSocket();
  
  const stats = calculateStats(data);

  const ConnectionStatus = () => (
    <div className="flex items-center space-x-2">
      <div className={`w-2 h-2 rounded-full ${isConnected ? 'bg-green-500' : 'bg-red-500'}`}></div>
      <span className="text-sm text-gray-600">
        {isConnected ? 'Connected' : 'Disconnected'}
      </span>
    </div>
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-96">
        <div className="text-center">
          <div className="w-8 h-8 mx-auto mb-4 border-4 border-blue-600 rounded-full border-t-transparent animate-spin"></div>
          <p className="text-gray-600">Loading dashboard data from API...</p>
          <p className="mt-2 text-sm text-gray-500">No mock data - API only</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6 border border-red-200 rounded-lg bg-red-50">
        <div className="flex items-center gap-3">
          <AlertTriangle className="w-6 h-6 text-red-600" />
          <div>
            <h3 className="font-medium text-red-900">API Connection Error</h3>
            <p className="text-sm text-red-800">{error}</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Dashboard Overview</h1>
          <p className="text-gray-600">Real-time vehicle management and monitoring</p>
        </div>
        <ConnectionStatus />
      </div>

      {/* API Data Source Indicator */}
      <div className="p-4 border border-blue-200 rounded-lg bg-blue-50">
        <div className="flex items-center gap-3">
          <Shield className="w-5 h-5 text-blue-600" />
          <div>
            <h3 className="font-medium text-blue-900">Data Source: API Only</h3>
            <p className="text-sm text-blue-800">
              All data is fetched directly from the API at http://164.52.194.198:9090. 
              No mock or placeholder data is used.
            </p>
          </div>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-4">
        <div className="p-6 bg-white rounded-lg shadow-md">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-blue-100 rounded-lg">
              <Car className="w-6 h-6 text-blue-600" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-gray-900">{stats.totalVehicles}</h3>
              <p className="text-sm text-gray-600">Total Vehicles</p>
            </div>
          </div>
        </div>

        <div className="p-6 bg-white rounded-lg shadow-md">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-green-100 rounded-lg">
              <Shield className="w-6 h-6 text-green-600" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-gray-900">{stats.activeDevices}</h3>
              <p className="text-sm text-gray-600">Active Devices</p>
            </div>
          </div>
        </div>

        <div className="p-6 bg-white rounded-lg shadow-md">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-red-100 rounded-lg">
              <Bell className="w-6 h-6 text-red-600" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-gray-900">{stats.activeAlarms}</h3>
              <p className="text-sm text-gray-600">Active Alarms</p>
            </div>
          </div>
        </div>

        <div className="p-6 bg-white rounded-lg shadow-md">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-purple-100 rounded-lg">
              <Car className="w-6 h-6 text-purple-600" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-gray-900">{stats.vehiclesWithGPS}</h3>
              <p className="text-sm text-gray-600">GPS Vehicles</p>
            </div>
          </div>
        </div>
      </div>

      {/* API Status Summary */}
      <div className="p-6 bg-white rounded-lg shadow-md">
        <h3 className="mb-4 text-lg font-semibold">API Integration Status</h3>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
          <div className="p-3 text-center rounded-lg bg-gray-50">
            <div className="text-lg font-bold text-gray-900">{data.vehicles.length}</div>
            <div className="text-sm text-gray-600">Vehicles from API</div>
          </div>
          <div className="p-3 text-center rounded-lg bg-gray-50">
            <div className="text-lg font-bold text-gray-900">{data.devices.length}</div>
            <div className="text-sm text-gray-600">Devices from API</div>
          </div>
          <div className="p-3 text-center rounded-lg bg-gray-50">
            <div className="text-lg font-bold text-gray-900">{data.alerts.length}</div>
            <div className="text-sm text-gray-600">Alerts from API</div>
          </div>
          <div className="p-3 text-center rounded-lg bg-gray-50">
            <div className="text-lg font-bold text-gray-900">{stats.vehiclesWithGPS}</div>
            <div className="text-sm text-gray-600">GPS Coordinates</div>
          </div>
        </div>
        
        <div className="mt-4 text-center">
          <p className="text-sm text-gray-600">
            API Endpoint: <span className="font-mono text-xs">http://164.52.194.198:9090</span>
          </p>
          <p className="mt-1 text-xs text-gray-500">
            Using Driver Tracking API for real-time data
          </p>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <div className="p-4 bg-white border rounded-lg shadow">
          <h4 className="mb-2 font-medium text-gray-900">Recent Vehicles</h4>
          {data.vehicles.slice(0, 3).map(vehicle => (
            <div key={vehicle.vehicle_id} className="flex items-center justify-between py-2 border-b last:border-b-0">
              <span className="text-sm text-gray-600">{vehicle.vehicle_number}</span>
              <button
                onClick={() => onViewVehicle(vehicle.vehicle_id)}
                className="text-xs text-blue-600 hover:text-blue-800"
              >
                View
              </button>
            </div>
          ))}
          {data.vehicles.length === 0 && (
            <p className="text-sm text-gray-500">No vehicles available</p>
          )}
        </div>

        <div className="p-4 bg-white border rounded-lg shadow">
          <h4 className="mb-2 font-medium text-gray-900">Active Devices</h4>
          {data.devices.filter(d => d.status === 'Active').slice(0, 3).map(device => (
            <div key={device.device_id} className="flex items-center justify-between py-2 border-b last:border-b-0">
              <span className="text-sm text-gray-600">Device {device.device_id}</span>
              <span className="text-xs text-green-600">Online</span>
            </div>
          ))}
          {data.devices.filter(d => d.status === 'Active').length === 0 && (
            <p className="text-sm text-gray-500">No active devices</p>
          )}
        </div>

        <div className="p-4 bg-white border rounded-lg shadow">
          <h4 className="mb-2 font-medium text-gray-900">Recent Alerts</h4>
          {data.alerts.slice(0, 3).map((alert, index) => (
            <div key={alert.alarm_id || index} className="flex items-center justify-between py-2 border-b last:border-b-0">
              <span className="text-sm text-gray-600">{alert.alarm_type || 'Alert'}</span>
              <span className="text-xs text-red-600">Active</span>
            </div>
          ))}
          {data.alerts.length === 0 && (
            <p className="text-sm text-gray-500">No recent alerts</p>
          )}
        </div>
      </div>
    </div>
  );
};

export default Overview;