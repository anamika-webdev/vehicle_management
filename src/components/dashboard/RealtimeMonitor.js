import React from 'react';
import { AlertTriangle } from 'lucide-react';
import { useData } from '../../contexts/DataContext';
import { useNotification } from '../../contexts/NotificationContext';
import { hasDeviceAlerts } from '../../utils/helpers';
import DeviceStatusCard from '../devices/DeviceStatusCard';

const RealtimeMonitor = () => {
  const { data, simulateDeviceData, loading } = useData();
  const { showInfo } = useNotification();

  const handleDeviceSimulation = (deviceId, scenario) => {
    simulateDeviceData(deviceId, scenario);
    
    if (scenario !== 'normal') {
      showInfo(
        'Device Simulation',
        `Simulated ${scenario} scenario for device ${deviceId}`
      );
    }
  };

  const activeDevices = data.devices.filter(d => d.vehicle_id && d.status === 'Active');

  return (
    <div className="space-y-4">
      {/* Critical Alerts Summary */}
      {activeDevices.some(d => hasDeviceAlerts(d)) && (
        <div className="p-3 border border-red-200 rounded-lg bg-red-50">
          <div className="flex items-center gap-2 mb-2">
            <AlertTriangle className="w-4 h-4 text-red-600" />
            <span className="text-sm font-medium text-red-800">Critical Alerts Active</span>
          </div>
          <div className="grid grid-cols-1 gap-2">
            {activeDevices.filter(d => hasDeviceAlerts(d)).map(device => {
              const vehicle = data.vehicles.find(v => v.vehicle_id === device.vehicle_id);
              return (
                <div key={device.device_id} className="text-xs text-red-700">
                  {vehicle?.vehicle_number}: {device.device_name}
                  {device.collision_detected && ' • COLLISION'}
                  {device.rash_driving && ' • RASH DRIVING'}
                  {device.drowsiness_level > 30 && ` • DROWSINESS (${device.drowsiness_level}%)`}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Device Status Cards */}
      <div className="grid grid-cols-1 gap-3">
        {activeDevices.slice(0, 5).map((device) => (
          <DeviceStatusCard 
            key={device.device_id} 
            device={device}
            onSimulate={handleDeviceSimulation}
            showSimulation={true}
          />
        ))}
      </div>

      {/* Simulation Controls */}
      <div className="p-4 border rounded-lg bg-gray-50">
        <h4 className="mb-3 text-sm font-medium text-gray-700">Device Testing</h4>
        <div className="grid grid-cols-2 gap-2">
          {activeDevices.slice(0, 2).map(device => (
            <div key={device.device_id} className="space-y-2">
              <p className="text-xs text-gray-600">Device {device.device_id}</p>
              <div className="flex gap-1">
                <button
                  onClick={() => handleDeviceSimulation(device.device_id, 'collision')}
                  className="px-2 py-1 text-xs text-red-700 bg-red-100 rounded hover:bg-red-200"
                  disabled={loading}
                >
                  Collision
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
          ))}
        </div>
      </div>

      {activeDevices.length === 0 && (
        <div className="py-8 text-center text-gray-500">
          <AlertTriangle className="w-8 h-8 mx-auto mb-2 opacity-50" />
          <p>No active devices to monitor</p>
        </div>
      )}
    </div>
  );
};

export default RealtimeMonitor;