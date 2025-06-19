import React, { useState, useEffect } from 'react';
import { Car, MapPin, Activity, Clock, Navigation, Zap, AlertTriangle, X } from 'lucide-react';
import { useData } from '../../contexts/DataContext';
import { useWebSocket } from '../../contexts/WebSocketContext';
import { formatTime, getDeviceAlertLevel, hasDeviceAlerts } from '../../utils/helpers';

const VehicleTrackingModal = ({ isOpen, onClose, vehicle }) => {
  const { data } = useData();
  const { isConnected } = useWebSocket();
  const [zoom, setZoom] = useState(14);
  const [showTraffic, setShowTraffic] = useState(false);

  // Get device assigned to this vehicle
  const assignedDevice = data.devices.find(d => d.vehicle_id === vehicle?.vehicle_id);
  
  // Get real-time data (in a real app, this would come from WebSocket)
  const [liveData, setLiveData] = useState({
    latitude: vehicle?.current_latitude || 28.6139,
    longitude: vehicle?.current_longitude || 77.2090,
    speed: vehicle?.current_speed || 0,
    heading: 0,
    lastUpdate: new Date().toISOString()
  });

  // Simulate live updates (in real app, this would be WebSocket data)
  useEffect(() => {
    if (!isOpen || !vehicle) return;

    const interval = setInterval(() => {
      setLiveData(prev => ({
        ...prev,
        speed: Math.max(0, prev.speed + (Math.random() - 0.5) * 10),
        heading: (prev.heading + (Math.random() - 0.5) * 20) % 360,
        lastUpdate: new Date().toISOString()
      }));
    }, 3000);

    return () => clearInterval(interval);
  }, [isOpen, vehicle]);

  if (!isOpen || !vehicle) return null;

  const MapView = () => (
    <div className="relative w-full overflow-hidden bg-gray-100 border rounded-lg h-80">
      {/* Map Controls */}
      <div className="absolute z-10 p-2 space-y-2 bg-white rounded-lg shadow-md top-4 right-4">
        <button 
          onClick={() => setZoom(Math.min(18, zoom + 1))}
          className="block w-8 h-8 text-sm font-bold text-center bg-gray-100 rounded hover:bg-gray-200"
        >
          +
        </button>
        <button 
          onClick={() => setZoom(Math.max(8, zoom - 1))}
          className="block w-8 h-8 text-sm font-bold text-center bg-gray-100 rounded hover:bg-gray-200"
        >
          -
        </button>
      </div>

      {/* Connection Status */}
      <div className="absolute z-10 p-2 bg-white rounded-lg shadow-md top-4 left-4">
        <div className="flex items-center space-x-2 text-sm">
          <div className={`w-2 h-2 rounded-full ${isConnected ? 'bg-green-500 animate-pulse' : 'bg-red-500'}`}></div>
          <span>{isConnected ? 'Live' : 'Offline'}</span>
        </div>
      </div>

      {/* Traffic Toggle */}
      <div className="absolute z-10 p-2 bg-white rounded-lg shadow-md bottom-4 left-4">
        <label className="flex items-center space-x-2 text-sm">
          <input 
            type="checkbox" 
            checked={showTraffic}
            onChange={(e) => setShowTraffic(e.target.checked)}
          />
          <span>Traffic</span>
        </label>
      </div>

      {/* Mock Map Background */}
      <div 
        className="relative w-full h-full bg-gradient-to-br from-green-100 to-blue-100"
        style={{ 
          backgroundImage: showTraffic ? 'repeating-linear-gradient(45deg, rgba(255,0,0,0.1) 0px, rgba(255,0,0,0.1) 10px, transparent 10px, transparent 20px)' : 'none'
        }}
      >
        {/* Roads simulation */}
        <div className="absolute inset-0">
          <div className="absolute left-0 right-0 h-2 transform -translate-y-1/2 bg-gray-400 top-1/2"></div>
          <div className="absolute top-0 bottom-0 w-2 transform -translate-x-1/2 bg-gray-400 left-1/2"></div>
          <div className="absolute w-1 transform rotate-45 bg-gray-300 h-1/2 top-1/4 left-1/4"></div>
          <div className="absolute w-1 transform -rotate-45 bg-gray-300 h-1/2 top-1/4 right-1/4"></div>
        </div>

        {/* Vehicle marker */}
        <div
          className="absolute z-10 transform -translate-x-1/2 -translate-y-1/2"
          style={{
            left: '50%',
            top: '50%',
            transform: `translate(-50%, -50%) rotate(${liveData.heading}deg)`
          }}
        >
          <div className={`w-8 h-8 rounded-full flex items-center justify-center text-white text-sm font-bold shadow-lg ${
            liveData.speed > 5 ? 'bg-green-500 animate-pulse' : 'bg-red-500'
          }`}>
            <Car className="w-4 h-4" />
          </div>
          <div className="absolute px-2 py-1 text-xs text-white transform -translate-x-1/2 bg-black rounded -bottom-8 left-1/2 whitespace-nowrap">
            {vehicle.vehicle_number}
          </div>
        </div>

        {/* Speed indicator */}
        <div className="absolute p-2 text-xs text-white bg-black rounded bottom-4 right-4">
          {Math.round(liveData.speed)} km/h
        </div>
      </div>
    </div>
  );

  const getStatusColor = () => {
    if (!assignedDevice) return 'bg-gray-100 text-gray-800';
    if (hasDeviceAlerts(assignedDevice)) return 'bg-red-100 text-red-800';
    if (liveData.speed > 5) return 'bg-green-100 text-green-800';
    return 'bg-yellow-100 text-yellow-800';
  };

  const getStatusText = () => {
    if (!assignedDevice) return 'No Device';
    if (hasDeviceAlerts(assignedDevice)) return 'Alert';
    if (liveData.speed > 5) return 'Moving';
    return 'Parked';
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
      <div className="w-full max-w-4xl max-h-screen p-6 overflow-y-auto bg-white rounded-lg shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center space-x-3">
            <Car className="w-6 h-6 text-blue-600" />
            <div>
              <h2 className="text-xl font-bold text-gray-900">
                {vehicle.vehicle_number} - Live Tracking
              </h2>
              <p className="text-sm text-gray-600">
                {vehicle.manufacturer} {vehicle.model} ({vehicle.vehicle_type})
              </p>
            </div>
          </div>
          <div className="flex items-center space-x-3">
            <span className={`px-3 py-1 rounded-full text-sm font-medium ${getStatusColor()}`}>
              {getStatusText()}
            </span>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600"
            >
              <X className="w-6 h-6" />
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          {/* Map Section */}
          <div className="lg:col-span-2">
            <div className="mb-4">
              <h3 className="mb-2 text-lg font-semibold text-gray-900">Live Location</h3>
              <MapView />
            </div>
          </div>

          {/* Vehicle Info and Stats */}
          <div className="space-y-6">
            {/* Current Status */}
            <div className="p-4 rounded-lg bg-gray-50">
              <h4 className="mb-3 font-semibold text-gray-900">Current Status</h4>
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <Activity className="w-4 h-4 text-gray-500" />
                    <span className="text-sm text-gray-600">Speed</span>
                  </div>
                  <span className="font-medium">{Math.round(liveData.speed)} km/h</span>
                </div>
                
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <Navigation className="w-4 h-4 text-gray-500" />
                    <span className="text-sm text-gray-600">Heading</span>
                  </div>
                  <span className="font-medium">{Math.round(liveData.heading)}°</span>
                </div>
                
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <MapPin className="w-4 h-4 text-gray-500" />
                    <span className="text-sm text-gray-600">Location</span>
                  </div>
                  <span className="text-xs font-medium">
                    {liveData.latitude.toFixed(4)}, {liveData.longitude.toFixed(4)}
                  </span>
                </div>
                
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <Clock className="w-4 h-4 text-gray-500" />
                    <span className="text-sm text-gray-600">Last Update</span>
                  </div>
                  <span className="text-xs font-medium">{formatTime(liveData.lastUpdate)}</span>
                </div>
              </div>
            </div>

            {/* Device Information */}
            {assignedDevice && (
              <div className="p-4 rounded-lg bg-gray-50">
                <h4 className="mb-3 font-semibold text-gray-900">Device Information</h4>
                <div className="space-y-3">
                  <div>
                    <span className="text-sm text-gray-600">Device Name:</span>
                    <p className="font-medium">{assignedDevice.device_name}</p>
                  </div>
                  <div>
                    <span className="text-sm text-gray-600">Device Type:</span>
                    <p className="font-medium">{assignedDevice.device_type}</p>
                  </div>
                  <div>
                    <span className="text-sm text-gray-600">Status:</span>
                    <span className={`ml-2 px-2 py-1 rounded-full text-xs ${
                      assignedDevice.status === 'Active' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                    }`}>
                      {assignedDevice.status}
                    </span>
                  </div>
                  
                  {/* Device Metrics */}
                  <div className="pt-2 border-t">
                    <div className="grid grid-cols-2 gap-3 text-sm">
                      <div>
                        <span className="text-gray-600">Acceleration:</span>
                        <p className="font-medium">{assignedDevice.acceleration || 0} m/s²</p>
                      </div>
                      <div>
                        <span className="text-gray-600">Drowsiness:</span>
                        <p className={`font-medium ${
                          assignedDevice.drowsiness_level > 30 ? 'text-red-600' :
                          assignedDevice.drowsiness_level > 20 ? 'text-orange-600' : 'text-green-600'
                        }`}>
                          {assignedDevice.drowsiness_level || 0}%
                        </p>
                      </div>
                    </div>
                    
                    {/* Alerts */}
                    {hasDeviceAlerts(assignedDevice) && (
                      <div className="p-2 mt-3 border border-red-200 rounded bg-red-50">
                        <div className="flex items-center gap-2 text-red-800">
                          <AlertTriangle className="w-4 h-4" />
                          <span className="text-sm font-medium">Active Alerts</span>
                        </div>
                        <div className="mt-1 space-y-1">
                          {assignedDevice.collision_detected && (
                            <span className="block text-xs text-red-700">• Collision Detected</span>
                          )}
                          {assignedDevice.rash_driving && (
                            <span className="block text-xs text-red-700">• Rash Driving</span>
                          )}
                          {assignedDevice.drowsiness_level > 30 && (
                            <span className="block text-xs text-red-700">• High Drowsiness</span>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {!assignedDevice && (
              <div className="p-4 border border-yellow-200 rounded-lg bg-yellow-50">
                <div className="flex items-center gap-2 text-yellow-800">
                  <AlertTriangle className="w-4 h-4" />
                  <span className="text-sm font-medium">No Device Assigned</span>
                </div>
                <p className="mt-1 text-xs text-yellow-700">
                  Assign a device to this vehicle to enable live tracking and monitoring.
                </p>
              </div>
            )}

            {/* Quick Actions */}
            <div className="p-4 rounded-lg bg-gray-50">
              <h4 className="mb-3 font-semibold text-gray-900">Quick Actions</h4>
              <div className="space-y-2">
                <button className="w-full px-3 py-2 text-sm text-left text-blue-600 rounded bg-blue-50 hover:bg-blue-100">
                  View Trip History
                </button>
                <button className="w-full px-3 py-2 text-sm text-left text-green-600 rounded bg-green-50 hover:bg-green-100">
                  Set Geofence
                </button>
                <button className="w-full px-3 py-2 text-sm text-left text-orange-600 rounded bg-orange-50 hover:bg-orange-100">
                  Generate Report
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex justify-end pt-4 mt-6 border-t">
          <button
            onClick={onClose}
            className="px-4 py-2 text-gray-700 bg-gray-200 rounded-lg hover:bg-gray-300"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

export default VehicleTrackingModal;