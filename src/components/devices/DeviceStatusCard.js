import React from 'react';
import { useData } from '../../contexts/DataContext';
import { getDeviceAlertLevel, formatTime } from '../../utils/helpers';

const DeviceStatusCard = ({ device, onSimulate, showSimulation = false }) => {
  const { data } = useData();
  const vehicle = data.vehicles.find(v => v.vehicle_id === device.vehicle_id);
  const alertLevel = getDeviceAlertLevel(device);
  
  return (
    <div className={`p-4 rounded-lg border-l-4 ${
      alertLevel === 'critical' ? 'border-red-500 bg-red-50' :
      alertLevel === 'high' ? 'border-orange-500 bg-orange-50' :
      alertLevel === 'medium' ? 'border-yellow-500 bg-yellow-50' :
      'border-green-500 bg-green-50'
    }`}>
      <div className="flex items-start justify-between">
        <div>
          <h4 className="font-medium text-gray-900">{device.device_name}</h4>
          <p className="text-sm text-gray-600">{device.device_type}</p>
          {vehicle && (
            <p className="text-xs text-gray-500">{vehicle.vehicle_number}</p>
          )}
        </div>
        <div className="text-right">
          <span className={`px-2 py-1 rounded-full text-xs ${
            device.status === 'Active' ? 'bg-green-100 text-green-800' :
            device.status === 'Unassigned' ? 'bg-yellow-100 text-yellow-800' :
            'bg-red-100 text-red-800'
          }`}>
            {device.status}
          </span>
        </div>
      </div>
      
      {device.vehicle_id && (
        <div className="grid grid-cols-2 gap-2 mt-3 text-xs">
          <div>
            <span className="text-gray-500">Acceleration:</span>
            <span className="ml-1 font-medium">{device.acceleration || 0} m/s²</span>
          </div>
          <div>
            <span className="text-gray-500">Drowsiness:</span>
            <span className={`ml-1 font-medium ${
              device.drowsiness_level > 30 ? 'text-red-600' :
              device.drowsiness_level > 20 ? 'text-orange-600' :
              'text-green-600'
            }`}>
              {device.drowsiness_level || 0}%
            </span>
          </div>
          
          {device.latitude && device.longitude && (
            <div className="col-span-2">
              <span className="text-gray-500">Location:</span>
              <span className="ml-1 font-medium">
                {device.latitude.toFixed(4)}, {device.longitude.toFixed(4)}
              </span>
            </div>
          )}
          
          {device.last_updated && (
            <div className="col-span-2">
              <span className="text-gray-500">Last Update:</span>
              <span className="ml-1 font-medium">{formatTime(device.last_updated)}</span>
            </div>
          )}
          
          <div className="flex col-span-2 gap-2 mt-2">
            {device.rash_driving && (
              <span className="px-2 py-1 text-xs text-red-800 bg-red-100 rounded">
                Rash Driving
              </span>
            )}
            {device.collision_detected && (
              <span className="px-2 py-1 text-xs text-red-800 bg-red-100 rounded">
                Collision
              </span>
            )}
          </div>
        </div>
      )}

      {showSimulation && onSimulate && (
        <div className="flex gap-1 mt-3">
          <button
            onClick={() => onSimulate(device.device_id, 'collision')}
            className="px-2 py-1 text-xs text-red-700 bg-red-100 rounded hover:bg-red-200"
          >
            Test Collision
          </button>
          <button
            onClick={() => onSimulate(device.device_id, 'drowsiness')}
            className="px-2 py-1 text-xs text-orange-700 bg-orange-100 rounded hover:bg-orange-200"
          >
            Test Drowsy
          </button>
          <button
            onClick={() => onSimulate(device.device_id, 'normal')}
            className="px-2 py-1 text-xs text-green-700 bg-green-100 rounded hover:bg-green-200"
          >
            Normal
          </button>
        </div>
      )}
    </div>
  );
};

export default DeviceStatusCard;