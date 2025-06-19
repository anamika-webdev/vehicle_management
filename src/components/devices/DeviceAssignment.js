import React from 'react';
import { Shield, Car, Link, Settings } from 'lucide-react';
import { useData } from '../../contexts/DataContext';
import { useNotification } from '../../contexts/NotificationContext';
import StatCard from '../dashboard/StatCard';

const DeviceAssignment = () => {
  const { data, assignDevice, loading } = useData();
  const { showSuccess, showError } = useNotification();

  const handleDeviceAssignment = async (deviceId, vehicleId) => {
    try {
      await assignDevice(deviceId, vehicleId);
      showSuccess(
        'Success', 
        vehicleId === 'unassign' || !vehicleId 
          ? 'Device unassigned successfully' 
          : 'Device assigned successfully'
      );
    } catch (error) {
      showError('Error', `Failed to update device assignment: ${error.message}`);
    }
  };

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-lg shadow-md">
        <div className="p-6 border-b border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900">Device Assignment</h3>
          <p className="mt-1 text-sm text-gray-600">Assign devices to your vehicles</p>
        </div>
        
        <div className="p-6">
          <div className="grid grid-cols-1 gap-8 lg:grid-cols-2">
            {/* Unassigned Devices */}
            <div>
              <h4 className="flex items-center gap-2 mb-4 font-semibold text-gray-900 text-md">
                <Shield className="w-5 h-5" />
                Available Devices
              </h4>
              <div className="space-y-3 overflow-y-auto max-h-96">
                {data.devices.filter(device => !device.vehicle_id).map((device) => (
                  <div key={device.device_id} className="p-4 border rounded-lg bg-gray-50">
                    <div className="flex items-start justify-between mb-3">
                      <div>
                        <h5 className="font-medium text-gray-900">{device.device_name}</h5>
                        <p className="text-sm text-gray-600">{device.device_type}</p>
                        <span className="inline-block px-2 py-1 mt-1 text-xs text-yellow-800 bg-yellow-100 rounded-full">
                          {device.status}
                        </span>
                      </div>
                    </div>
                    
                    <div className="flex gap-2">
                      <select
                        onChange={(e) => {
                          if (e.target.value) {
                            handleDeviceAssignment(device.device_id, e.target.value);
                          }
                        }}
                        className="flex-1 p-2 text-sm border border-gray-300 rounded"
                        defaultValue=""
                        disabled={loading}
                      >
                        <option value="">Select Vehicle</option>
                        {data.vehicles.map((vehicle) => (
                          <option key={vehicle.vehicle_id} value={vehicle.vehicle_id}>
                            {vehicle.vehicle_number} - {vehicle.manufacturer} {vehicle.model}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                ))}
                {data.devices.filter(device => !device.vehicle_id).length === 0 && (
                  <p className="py-8 text-center text-gray-500">
                    {loading ? 'Loading...' : 'No unassigned devices available'}
                  </p>
                )}
              </div>
            </div>

            {/* Assigned Devices */}
            <div>
              <h4 className="flex items-center gap-2 mb-4 font-semibold text-gray-900 text-md">
                <Car className="w-5 h-5" />
                Vehicle-Device Assignments
              </h4>
              <div className="space-y-3 overflow-y-auto max-h-96">
                {data.vehicles.map((vehicle) => {
                  const assignedDevices = data.devices.filter(device => device.vehicle_id === vehicle.vehicle_id);
                  return (
                    <div key={vehicle.vehicle_id} className="p-4 border rounded-lg">
                      <div className="mb-3">
                        <h5 className="font-medium text-gray-900">
                          {vehicle.vehicle_number} - {vehicle.manufacturer} {vehicle.model}
                        </h5>
                        <p className="text-sm text-gray-600">{vehicle.vehicle_type}</p>
                      </div>
                      
                      {assignedDevices.length > 0 ? (
                        <div className="space-y-2">
                          {assignedDevices.map((device) => (
                            <div key={device.device_id} className="flex items-center justify-between p-2 rounded bg-green-50">
                              <div>
                                <span className="text-sm font-medium text-green-900">{device.device_name}</span>
                                <span className="ml-2 text-xs text-green-700">({device.device_type})</span>
                              </div>
                              <button
                                onClick={() => handleDeviceAssignment(device.device_id, 'unassign')}
                                className="text-sm text-red-600 hover:text-red-800 disabled:opacity-50"
                                disabled={loading}
                              >
                                Unassign
                              </button>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="text-sm text-gray-400">No devices assigned</p>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Assignment Summary */}
      <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
        <StatCard 
          title="Total Devices" 
          value={data.devices.length} 
          icon={Shield} 
          color="#3B82F6" 
        />
        <StatCard 
          title="Assigned Devices" 
          value={data.devices.filter(d => d.vehicle_id !== null).length} 
          icon={Link} 
          color="#10B981" 
        />
        <StatCard 
          title="Unassigned Devices" 
          value={data.devices.filter(d => d.vehicle_id === null).length} 
          icon={Settings} 
          color="#F59E0B" 
        />
      </div>
    </div>
  );
};

export default DeviceAssignment;