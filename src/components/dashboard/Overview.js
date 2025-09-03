import React, { useState } from 'react';
import { 
  Car, Shield, Activity, AlertTriangle, 
  MapPin, Users, BarChart3, TrendingUp,
  Clock, Zap, CheckCircle, Eye
} from 'lucide-react';
import { useData } from '../../contexts/DataContext';
import { calculateStats } from '../../utils/helpers';
import SimpleLeafletMap from '../tracking/SimpleLeafletMap';

const Overview = ({ onViewVehicle }) => {
  const { data, loading } = useData();
  const [selectedVehicleId, setSelectedVehicleId] = useState(null);

  // Calculate dashboard statistics
  const stats = calculateStats(data.vehicles, data.devices, data.alerts);

  // Get recent alarms (last 24 hours)
  const recentAlarms = data.alerts
    .filter(alert => {
      const alertTime = new Date(alert.alarm_time || alert.timestamp);
      const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000);
      return alertTime > yesterday && !alert.resolved;
    })
    .slice(0, 5);

  // Get vehicles with GPS data for map
  const vehiclesWithGPS = data.vehicles.filter(vehicle => {
    const device = data.devices.find(d => d.vehicle_id === vehicle.vehicle_id);
    return device && device.latitude && device.longitude;
  });

  // Handle vehicle selection on map
  const handleVehicleSelect = (vehicleId) => {
    setSelectedVehicleId(vehicleId);
  };

  // Handle view vehicle details
  const handleViewVehicleDetails = (vehicleId) => {
    if (onViewVehicle) {
      onViewVehicle(vehicleId);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-96">
        <div className="text-center">
          <div className="w-8 h-8 mx-auto mb-3 border-b-2 border-blue-600 rounded-full animate-spin"></div>
          <p className="text-gray-600">Loading dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-1">
      {/* Header */}
      <div className="p-6 bg-white border border-gray-200 rounded-lg shadow-sm">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Fleet Management Dashboard</h1>
            <p className="text-gray-600">Real-time monitoring and management of your vehicle fleet</p>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 bg-green-500 rounded-full animate-pulse"></div>
            <span className="text-sm text-gray-600">Live Data</span>
          </div>
        </div>
      </div>

 {/* Fleet Status Grid */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Vehicle Status Summary */}
        <div className="bg-white border border-gray-200 rounded-lg shadow-sm">
          <div className="p-4 border-b bg-gray-50">
            <div className="flex items-center gap-2">
              <Car className="w-5 h-5 text-blue-600" />
              <h3 className="text-lg font-semibold text-gray-900">Vehicle Status</h3>
            </div>
          </div>
          <div className="p-4">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 bg-green-500 rounded-full"></div>
                  <span className="text-sm text-gray-700">Active</span>
                </div>
                <span className="text-sm font-medium text-gray-900">{stats.activeVehicles}</span>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 bg-gray-400 rounded-full"></div>
                  <span className="text-sm text-gray-700">Inactive</span>
                </div>
                <span className="text-sm font-medium text-gray-900">{stats.totalVehicles - stats.activeVehicles}</span>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 bg-blue-500 rounded-full"></div>
                  <span className="text-sm text-gray-700">With GPS</span>
                </div>
                <span className="text-sm font-medium text-gray-900">{vehiclesWithGPS.length}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Device Status Summary */}
        <div className="bg-white border border-gray-200 rounded-lg shadow-sm">
          <div className="p-4 border-b bg-gray-50">
            <div className="flex items-center gap-2">
              <Shield className="w-5 h-5 text-green-600" />
              <h3 className="text-lg font-semibold text-gray-900">Device Status</h3>
            </div>
          </div>
          <div className="p-4">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 bg-green-500 rounded-full"></div>
                  <span className="text-sm text-gray-700">Online</span>
                </div>
                <span className="text-sm font-medium text-gray-900">{stats.activeDevices}</span>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 bg-red-500 rounded-full"></div>
                  <span className="text-sm text-gray-700">Offline</span>
                </div>
                <span className="text-sm font-medium text-gray-900">{stats.totalDevices - stats.activeDevices}</span>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 bg-blue-500 rounded-full"></div>
                  <span className="text-sm text-gray-700">Utilization</span>
                </div>
                <span className="text-sm font-medium text-gray-900">{stats.deviceUtilization}%</span>
              </div>
            </div>
          </div>
        </div>

        {/* Alert Summary */}
        <div className="bg-white border border-gray-200 rounded-lg shadow-sm">
          <div className="p-4 border-b bg-gray-50">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-yellow-600" />
              <h3 className="text-lg font-semibold text-gray-900">Alert Summary</h3>
            </div>
          </div>
          <div className="p-4">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 bg-red-500 rounded-full"></div>
                  <span className="text-sm text-gray-700">Critical</span>
                </div>
                <span className="text-sm font-medium text-gray-900">{stats.criticalAlerts}</span>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 bg-yellow-500 rounded-full"></div>
                  <span className="text-sm text-gray-700">Active</span>
                </div>
                <span className="text-sm font-medium text-gray-900">{stats.activeAlerts}</span>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 bg-green-500 rounded-full"></div>
                  <span className="text-sm text-gray-700">Resolved</span>
                </div>
                <span className="text-sm font-medium text-gray-900">{stats.totalAlerts - stats.activeAlerts}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      
        {/* Live Fleet Map */}
        <div className="bg-white border border-gray-200 rounded-lg shadow-sm">
          <div className="p-4 border-b bg-gray-50">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <MapPin className="w-5 h-5 text-blue-600" />
                <h3 className="text-lg font-semibold text-gray-900">Live Fleet Map</h3>
              </div>
              <div className="flex items-center gap-2 text-sm text-gray-600">
                <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                <span>{vehiclesWithGPS.length} vehicles with GPS</span>
              </div>
            </div>
            <p className="mt-1 text-sm text-gray-600">Real-time vehicle locations and status</p>
          </div>
          
          <div className="p-4">
            <SimpleLeafletMap
              selectedVehicleId={selectedVehicleId}
              onVehicleSelect={handleVehicleSelect}
              height="400px"
              autoRefresh={true}
              refreshInterval={15000}
              className="rounded-lg"
            />
          </div>

          {/* Map Legend */}
         {/* <div className="p-4 border-t bg-gray-50">
            <div className="flex items-center justify-between text-xs text-gray-600">
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-1">
                  <div className="w-3 h-3 bg-green-500 rounded-full"></div>
                  <span>Active Vehicle</span>
                </div>
                <div className="flex items-center gap-1">
                  <div className="w-3 h-3 bg-blue-500 rounded-full"></div>
                  <span>Selected</span>
                </div>
                <div className="flex items-center gap-1">
                  <div className="w-3 h-3 bg-red-500 rounded-full"></div>
                  <span>Alert</span>
                </div>
              </div>
              <span>Auto-refresh: 15s</span>
            </div>
          </div>*/}
        </div>

        {/* Recent Alerts Panel */}
       {/* <div className="bg-white border border-gray-200 rounded-lg shadow-sm">
          <div className="p-4 border-b bg-gray-50">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <AlertTriangle className="w-5 h-5 text-yellow-600" />
                <h3 className="text-lg font-semibold text-gray-900">Recent Alerts</h3>
              </div>
              <span className="text-sm text-gray-600">Last 24 hours</span>
            </div>
            <p className="mt-1 text-sm text-gray-600">Active alerts requiring attention</p>
          </div>
          
          <div className="p-4">
            {recentAlarms.length === 0 ? (
              <div className="py-8 text-center">
                <CheckCircle className="w-12 h-12 mx-auto mb-3 text-green-400" />
                <h4 className="mb-2 text-lg font-medium text-gray-900">All Clear!</h4>
                <p className="text-gray-600">No active alerts in the last 24 hours</p>
              </div>
            ) : (
              <div className="space-y-3">
                {recentAlarms.map((alert, index) => (
                  <div key={alert.alarm_id || alert.id || index} className="flex items-start gap-3 p-3 border border-gray-200 rounded-lg">
                    <div className={`w-2 h-2 rounded-full mt-2 ${
                      alert.alarm_type === 'collision' ? 'bg-red-500' :
                      alert.alarm_type === 'rash_driving' ? 'bg-orange-500' :
                      alert.alarm_type === 'drowsiness' ? 'bg-yellow-500' : 'bg-blue-500'
                    }`}></div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <p className="text-sm font-medium text-gray-900">
                          {alert.alarm_type || 'Unknown Alert'}
                        </p>
                        <span className="text-xs text-gray-500">
                          {new Date(alert.alarm_time || alert.timestamp).toLocaleTimeString()}
                        </span>
                      </div>
                      <p className="text-sm text-gray-600">{alert.description || 'No description available'}</p>
                      <p className="text-xs text-gray-500">Device: {alert.device_id}</p>
                    </div>
                  </div>
                ))}
                {recentAlarms.length >= 5 && (
                  <div className="pt-2 text-center">
                    <button className="text-sm text-blue-600 hover:text-blue-800">
                      View all alerts →
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>*/}
      

     

      

      {/* Selected Vehicle Details */}
      {selectedVehicleId && (
        <div className="bg-white border border-blue-200 rounded-lg shadow-sm bg-blue-50">
          <div className="p-4 bg-blue-100 border-b">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Car className="w-5 h-5 text-blue-600" />
                <h3 className="text-lg font-semibold text-blue-900">Selected Vehicle</h3>
              </div>
              <button 
                onClick={() => setSelectedVehicleId(null)}
                className="text-blue-600 hover:text-blue-800"
              >
                ×
              </button>
            </div>
          </div>
          <div className="p-4">
            {(() => {
              const vehicle = data.vehicles.find(v => v.vehicle_id === selectedVehicleId);
              const device = data.devices.find(d => d.vehicle_id === selectedVehicleId);
              
              if (!vehicle) return <p className="text-gray-600">Vehicle not found</p>;
              
              return (
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="font-semibold text-blue-900">{vehicle.vehicle_number}</h4>
                    <p className="text-sm text-blue-700">{vehicle.manufacturer} {vehicle.model}</p>
                    {device && (
                      <p className="text-xs text-blue-600">
                        GPS: {device.latitude?.toFixed(4)}, {device.longitude?.toFixed(4)}
                      </p>
                    )}
                  </div>
                  <button
                    onClick={() => handleViewVehicleDetails(selectedVehicleId)}
                    className="flex items-center gap-2 px-4 py-2 text-white bg-blue-600 rounded-lg hover:bg-blue-700"
                  >
                    <Eye className="w-4 h-4" />
                    View Details
                  </button>
                </div>
              );
            })()}
          </div>
        </div>
      )}

      {/* System Status Footer */}
     {/* <div className="p-4 border border-gray-200 rounded-lg bg-gray-50">
        <div className="flex items-center justify-between text-sm text-gray-600">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 bg-green-500 rounded-full"></div>
              <span>System Operational</span>
            </div>
            <div className="flex items-center gap-2">
              <Clock className="w-4 h-4" />
              <span>Last updated: {new Date().toLocaleTimeString()}</span>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <span>{data.vehicles.length} Vehicles</span>
            <span>{data.devices.length} Devices</span>
            <span>{data.alerts.length} Total Alerts</span>
          </div>
        </div>
      </div>*/}
    </div>
  );
};

export default Overview;