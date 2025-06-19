import React, { useState } from 'react';
import { useData } from '../../contexts/DataContext';
import SimpleLeafletMap from './SimpleLeafletMap';
import { 
  Car, MapPin, Activity, AlertTriangle, 
  Wifi, WifiOff, CheckCircle, ExternalLink, Navigation 
} from 'lucide-react';

const LeafletLiveMapPage = ({ onEnhancedTracking }) => { // Added prop for enhanced tracking
  const { data } = useData();
  const [selectedVehicleId, setSelectedVehicleId] = useState(null);

  // Get vehicle stats
  const vehicleStats = {
    total: data.vehicles.length,
    withGPS: data.devices.filter(d => d.latitude && d.longitude).length,
    withAlerts: data.devices.filter(d => d.collision || d.rash_driving || d.drowsiness).length,
    online: data.devices.filter(d => d.status === 'Active' && d.last_updated).length
  };

  const handleVehicleSelect = (vehicle) => {
    setSelectedVehicleId(vehicle.vehicle_id);
    console.log('Selected vehicle:', vehicle);
  };

  // Enhanced tracking function
  const handleEnhancedTracking = (vehicle) => {
    if (onEnhancedTracking && typeof onEnhancedTracking === 'function') {
      // Call the parent function to open the enhanced modal
      onEnhancedTracking(vehicle);
    } else {
      // Fallback: You can either open the modal here or navigate to the route tracker
      setSelectedVehicleId(vehicle.vehicle_id);
      console.log('Enhanced tracking requested for vehicle:', vehicle);
      // You could also navigate to route tracker page here
      // Example: window.location.href = '/route-tracker';
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Live Vehicle Map</h1>
          <p className="text-gray-600">Real-time vehicle tracking using OpenStreetMap</p>
        </div>
      </div>

      {/* OpenStreetMap Info Banner */}
      <div className="p-4 border border-green-200 rounded-lg bg-green-50">
        <div className="flex items-start gap-3">
          <CheckCircle className="w-5 h-5 text-green-600 mt-0.5" />
          <div className="flex-1">
            <h3 className="font-medium text-green-900">Using OpenStreetMap (Free)</h3>
            <p className="mt-1 text-sm text-green-800">
              This map uses OpenStreetMap with Leaflet - completely free with no API keys required. 
              Perfect for vehicle tracking applications.
            </p>
          </div>
          <a
            href="https://www.openstreetmap.org/"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1 text-sm text-green-600 hover:text-green-800"
          >
            Learn more
            <ExternalLink className="w-3 h-3" />
          </a>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
        <div className="p-4 bg-white border rounded-lg shadow">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-100 rounded-lg">
              <Car className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <p className="text-sm text-gray-600">Total Vehicles</p>
              <p className="text-2xl font-bold text-gray-900">{vehicleStats.total}</p>
            </div>
          </div>
        </div>

        <div className="p-4 bg-white border rounded-lg shadow">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-green-100 rounded-lg">
              <MapPin className="w-5 h-5 text-green-600" />
            </div>
            <div>
              <p className="text-sm text-gray-600">With GPS Data</p>
              <p className="text-2xl font-bold text-gray-900">{vehicleStats.withGPS}</p>
            </div>
          </div>
        </div>

        <div className="p-4 bg-white border rounded-lg shadow">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-orange-100 rounded-lg">
              <Activity className="w-5 h-5 text-orange-600" />
            </div>
            <div>
              <p className="text-sm text-gray-600">Online Now</p>
              <p className="text-2xl font-bold text-gray-900">{vehicleStats.online}</p>
            </div>
          </div>
        </div>

        <div className="p-4 bg-white border rounded-lg shadow">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-red-100 rounded-lg">
              <AlertTriangle className="w-5 h-5 text-red-600" />
            </div>
            <div>
              <p className="text-sm text-gray-600">With Alerts</p>
              <p className="text-2xl font-bold text-gray-900">{vehicleStats.withAlerts}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Main Map */}
      <div className="p-6 bg-white border rounded-lg shadow">
        <SimpleLeafletMap
          selectedVehicleId={selectedVehicleId}
          onVehicleSelect={handleVehicleSelect}
          height="600px"
          className="w-full"
        />
      </div>

      {/* Vehicle List */}
      {data.vehicles.length > 0 && (
        <div className="bg-white border rounded-lg shadow">
          <div className="p-6 border-b border-gray-200">
            <h3 className="text-lg font-semibold text-gray-900">Vehicle Status Overview</h3>
          </div>
          <div className="p-6">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
              {data.vehicles.map(vehicle => {
                const device = data.devices.find(d => d.vehicle_id === vehicle.vehicle_id);
                const hasLocation = device?.latitude && device?.longitude;
                const hasAlert = device?.collision || device?.rash_driving || device?.drowsiness;
                
                return (
                  <div 
                    key={vehicle.vehicle_id}
                    className={`p-4 border rounded-lg transition-all ${
                      selectedVehicleId === vehicle.vehicle_id 
                        ? 'border-blue-500 bg-blue-50 shadow-md' 
                        : hasLocation 
                          ? 'border-gray-200 hover:border-gray-300 hover:shadow-sm'
                          : 'border-gray-200 bg-gray-50'
                    }`}
                  >
                    {/* Vehicle Header with Action Buttons */}
                    <div className="flex items-center justify-between mb-2">
                      <h4 className="font-medium text-gray-900">{vehicle.vehicle_number}</h4>
                      <div className="flex items-center gap-2">
                        {/* Enhanced tracking button */}
                        {hasLocation && (
                          <button
                            onClick={() => handleEnhancedTracking(vehicle)}
                            className="p-1 text-blue-600 transition-colors rounded hover:text-blue-800 hover:bg-blue-100"
                            title="Enhanced Route Tracking"
                          >
                            <Navigation  className="w-4 h-4" />
                          </button>
                        )}
                        
                        {/* Map selection button */}
                        <button
                          onClick={() => hasLocation && handleVehicleSelect(vehicle)}
                          className={`p-1 rounded transition-colors ${
                            hasLocation 
                              ? 'text-gray-600 hover:text-gray-800 hover:bg-gray-100 cursor-pointer' 
                              : 'text-gray-400 cursor-not-allowed'
                          }`}
                          title={hasLocation ? "View on Map" : "No GPS data available"}
                          disabled={!hasLocation}
                        >
                          <MapPin className="w-4 h-4" />
                        </button>

                        {/* Status indicators */}
                        {hasLocation ? (
                          <Wifi className="w-4 h-4 text-green-500" title="GPS Active" />
                        ) : (
                          <WifiOff className="w-4 h-4 text-gray-400" title="No GPS" />
                        )}
                        {hasAlert && (
                          <AlertTriangle className="w-4 h-4 text-red-500" title="Alert Active" />
                        )}
                      </div>
                    </div>
                    
                    <div className="space-y-1 text-sm text-gray-600">
                      <p className="font-medium">{vehicle.manufacturer} {vehicle.model}</p>
                      <p>Type: {vehicle.vehicle_type}</p>
                      
                      {device && (
                        <>
                          <p>Device: {device.device_id}</p>
                          <p>Status: <span className={`font-medium ${
                            device.status === 'Active' ? 'text-green-600' : 'text-gray-600'
                          }`}>{device.status}</span></p>
                          
                          {hasLocation ? (
                            <div className="flex items-center gap-1 text-green-600">
                              <MapPin className="w-3 h-3" />
                              <span className="font-mono text-xs">
                                {device.latitude.toFixed(4)}, {device.longitude.toFixed(4)}
                              </span>
                            </div>
                          ) : (
                            <p className="flex items-center gap-1 text-gray-500">
                              <WifiOff className="w-3 h-3" />
                              No GPS data
                            </p>
                          )}
                          
                          {device.last_updated && (
                            <p className="text-xs text-gray-500">
                              Updated: {new Date(device.last_updated).toLocaleString()}
                            </p>
                          )}
                          
                          {/* Alert badges */}
                          {hasAlert && (
                            <div className="flex flex-wrap gap-1 mt-2">
                              {device.collision && (
                                <span className="px-2 py-1 text-xs text-red-800 bg-red-100 rounded-full">
                                  🚨 Collision
                                </span>
                              )}
                              {device.rash_driving && (
                                <span className="px-2 py-1 text-xs text-orange-800 bg-orange-100 rounded-full">
                                  ⚠️ Rash Driving
                                </span>
                              )}
                              {device.drowsiness && (
                                <span className="px-2 py-1 text-xs text-yellow-800 bg-yellow-100 rounded-full">
                                  😴 Drowsiness
                                </span>
                              )}
                            </div>
                          )}

                          {/* Action buttons row for vehicles with GPS */}
                          {hasLocation && (
                            <div className="flex gap-2 pt-2 mt-3 border-t border-gray-200">
                              <button
                                onClick={() => handleVehicleSelect(vehicle)}
                                className="flex items-center gap-1 px-3 py-1 text-xs text-blue-600 transition-colors border border-blue-300 rounded hover:bg-blue-50"
                              >
                                <MapPin className="w-3 h-3" />
                                View on Map
                              </button>
                              <button
                                onClick={() => handleEnhancedTracking(vehicle)}
                                className="flex items-center gap-1 px-3 py-1 text-xs text-white transition-colors bg-blue-600 rounded hover:bg-blue-700"
                              >
                                <Navigation  className="w-3 h-3" />
                                Track Route
                              </button>
                            </div>
                          )}
                        </>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Map Information */}
      <div className="p-6 border border-blue-200 rounded-lg bg-blue-50">
        <div className="flex items-start gap-3">
          <MapPin className="w-5 h-5 text-blue-600 mt-0.5" />
          <div>
            <h3 className="mb-2 font-medium text-blue-900">About This Map</h3>
            <div className="space-y-2 text-sm text-blue-800">
              <p>
                <strong>Map Provider:</strong> OpenStreetMap - A free, editable map of the world built by volunteers.
              </p>
              <p>
                <strong>Library:</strong> Leaflet - The leading open-source JavaScript library for mobile-friendly interactive maps.
              </p>
              <p>
                <strong>Benefits:</strong> No API keys required, no usage limits, completely free, works offline, and supports multiple tile layers.
              </p>
              <p>
                <strong>Data Source:</strong> Vehicle locations are fetched from your Driver Tracking API in real-time.
              </p>
              <p>
                <strong>Enhanced Tracking:</strong> Click the Route icon on any vehicle with GPS data to start advanced journey tracking with route visualization.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default LeafletLiveMapPage;