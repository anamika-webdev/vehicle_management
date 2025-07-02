import React from 'react';
import Modal from '../common/Modal';
import EnhancedDeviceMap from '../tracking/EnhancedDeviceMap';
import { Shield, MapPin, Map, Navigation, Clock, Activity } from 'lucide-react';

const DeviceInfoModal = ({
  isOpen,
  onClose,
  device,
  telemetryHistory = [],
  realtimeTracking = false,
}) => {
  if (!device) return null;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={
        device.associatedVehicle
          ? `${device.associatedVehicle.vehicle_number} - Enhanced Device Tracking`
          : `${device.device_name || device.device_id} - Enhanced Tracking`
      }
      size="6xl"
    >
      <div className="space-y-4">
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <div className="p-4 rounded-lg bg-gray-50">
            <h4 className="flex items-center gap-2 mb-3 font-medium text-gray-900">
              <Shield className="w-5 h-5 text-blue-600" />
              Device Information
            </h4>
            <div className="space-y-2 text-sm text-gray-600">
              <p><strong>ID:</strong> {device.device_id}</p>
              <p><strong>Name:</strong> {device.device_name || 'N/A'}</p>
              <p><strong>Type:</strong> {device.device_type}</p>
              <p><strong>Status:</strong> {device.status}</p>
            </div>
          </div>

          <div className="p-4 rounded-lg bg-blue-50">
            <h4 className="flex items-center gap-2 mb-3 font-medium text-blue-900">
              <MapPin className="w-5 h-5 text-blue-600" />
              Vehicle Information & Live Location
            </h4>
            <div className="space-y-3">
              {device.associatedVehicle && (
                <div className="space-y-2 text-sm text-blue-800">
                  <p><strong>Number:</strong> {device.associatedVehicle.vehicle_number}</p>
                  <p><strong>Type:</strong> {device.associatedVehicle.vehicle_type}</p>
                  <p><strong>Manufacturer:</strong> {device.associatedVehicle.manufacturer}</p>
                  <p><strong>Model:</strong> {device.associatedVehicle.model}</p>
                </div>
              )}
              <div className="pt-3 border-t border-blue-200">
                <h5 className="mb-2 text-sm font-medium text-blue-900">Current Location</h5>
                <div className="grid grid-cols-2 gap-2 text-xs text-blue-700">
                  <div><strong>Latitude:</strong> {device.latitude?.toFixed(6) || 'N/A'}</div>
                  <div><strong>Longitude:</strong> {device.longitude?.toFixed(6) || 'N/A'}</div>
                  <div><strong>Speed:</strong> {device.speed?.toFixed(1) || 'N/A'} km/h</div>
                  <div><strong>Heading:</strong> {device.heading?.toFixed(0) || 'N/A'}°</div>
                  <div><strong>Acceleration:</strong> {device.acceleration?.toFixed(2) || 'N/A'} m/s²</div>
                  <div><strong>Last Update:</strong> {device.telemetry_timestamp ? new Date(device.telemetry_timestamp).toLocaleString() : 'N/A'}</div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {device.routePoints && device.routePoints.length > 1 && (
          <div className="p-4 border border-indigo-200 rounded-lg bg-gradient-to-r from-indigo-50 to-purple-50">
            <h4 className="flex items-center gap-2 mb-3 font-medium text-indigo-900">
              <Map className="w-5 h-5 text-indigo-600" />
              Journey Route Analysis
            </h4>
            <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
              <div className="text-center">
                <div className="text-2xl font-bold text-blue-600">{device.routePoints.length}</div>
                <div className="text-sm text-gray-600">GPS Points</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-green-600">
                  {device.routePoints.filter(p => parseFloat(p.speed || 0) === 0).length}
                </div>
                <div className="text-sm text-gray-600">Stops Detected</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-orange-600">
                  {Math.max(...device.routePoints.map(p => parseFloat(p.speed || 0))).toFixed(0)}
                </div>
                <div className="text-sm text-gray-600">Max Speed (km/h)</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-purple-600">
                  {device.routePoints[0]?.timestamp && device.routePoints[device.routePoints.length - 1]?.timestamp
                    ? Math.round((new Date(device.routePoints[device.routePoints.length - 1].timestamp) - new Date(device.routePoints[0].timestamp)) / (1000 * 60))
                    : 0}
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
                <div className="font-medium text-indigo-600">🛣️ Complete route plotted on map</div>
              </div>
            </div>
          </div>
        )}

        <div className="p-4 border border-green-200 rounded-lg bg-green-50">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className={`w-3 h-3 rounded-full ${realtimeTracking ? 'bg-green-500 animate-pulse' : 'bg-gray-300'}`}></div>
              <span className="text-sm text-green-800">
                {realtimeTracking ? 'Auto tracking active - updating every 10 seconds' : 'Starting automatic tracking...'}
              </span>
            </div>
            <div className="text-xs text-green-700">Live API telemetry data</div>
          </div>
        </div>

        <div className="border border-gray-200 rounded-lg">
          <div className="p-3 border-b border-gray-200 bg-gray-50">
            <h4 className="flex items-center gap-2 font-medium text-gray-900">
              <Navigation className="w-5 h-5 text-blue-600" />
              Live Location Map (OpenStreetMap)
            </h4>
          </div>
          <div className="p-3">
            <EnhancedDeviceMap
              device={device}
              vehicle={device.associatedVehicle}
              center={[device.latitude || 0, device.longitude || 0]}
              zoom={15}
              enableTracking={realtimeTracking}
              height="400px"
              routePoints={device.routePoints}
            />
          </div>
        </div>

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
                        {telemetry.timestamp ? new Date(telemetry.timestamp).toLocaleString() : 'N/A'}
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

        <div className="p-3 rounded-lg bg-gray-50">
          <h4 className="mb-2 font-semibold text-gray-900">Enhanced Tracking Actions</h4>
          <div className="grid grid-cols-2 gap-2 lg:grid-cols-4">
            <button
              onClick={() => window.open(`https://www.google.com/maps?q=${device.latitude},${device.longitude}`, '_blank')}
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
  );
};

export default DeviceInfoModal;
