// src/components/tracking/LeafletLiveMapPage.js - FIXED VERSION
import React, { useState } from 'react';
import { useData } from '../../contexts/DataContext';
import SimpleLeafletMap from './SimpleLeafletMap'; // Using the fixed SimpleLeafletMap
import { 
  Car, MapPin, Activity, AlertTriangle, 
  Wifi, WifiOff, CheckCircle, ExternalLink, Navigation 
} from 'lucide-react';

const LeafletLiveMapPage = ({ onEnhancedTracking }) => {
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
        </div>
      </div>

      {/* Stats Overview */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
        <div className="p-4 bg-white border rounded-lg">
          <div className="flex items-center gap-3">
            <Car className="w-8 h-8 text-blue-600" />
            <div>
              <div className="text-2xl font-bold text-gray-900">{vehicleStats.total}</div>
              <div className="text-sm text-gray-600">Total Vehicles</div>
            </div>
          </div>
        </div>
        
        <div className="p-4 bg-white border rounded-lg">
          <div className="flex items-center gap-3">
            <MapPin className="w-8 h-8 text-green-600" />
            <div>
              <div className="text-2xl font-bold text-gray-900">{vehicleStats.withGPS}</div>
              <div className="text-sm text-gray-600">With GPS</div>
            </div>
          </div>
        </div>
        
        <div className="p-4 bg-white border rounded-lg">
          <div className="flex items-center gap-3">
            <Wifi className="w-8 h-8 text-blue-600" />
            <div>
              <div className="text-2xl font-bold text-gray-900">{vehicleStats.online}</div>
              <div className="text-sm text-gray-600">Online Devices</div>
            </div>
          </div>
        </div>
        
        <div className="p-4 bg-white border rounded-lg">
          <div className="flex items-center gap-3">
            <AlertTriangle className="w-8 h-8 text-orange-600" />
            <div>
              <div className="text-2xl font-bold text-gray-900">{vehicleStats.withAlerts}</div>
              <div className="text-sm text-gray-600">With Alerts</div>
            </div>
          </div>
        </div>
      </div>

      {/* Main Map Section */}
      <div className="bg-white border rounded-lg">
        <div className="p-4 border-b bg-gray-50">
          <div className="flex items-center justify-between">
            <h2 className="flex items-center gap-2 text-lg font-semibold text-gray-900">
              <MapPin className="w-5 h-5 text-blue-600" />
              Live Vehicle Tracking Map
            </h2>
            <div className="flex items-center gap-2 text-sm">
              <div className="flex items-center gap-1">
                <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                <span className="text-green-600">Auto-updating every 10 seconds</span>
              </div>
            </div>
          </div>
          <p className="mt-1 text-sm text-gray-600">
            Click on vehicle markers to see details. Green markers = Live telemetry, Blue markers = Device data
          </p>
        </div>
        
        <div className="p-4">
          {/* FIXED MAP COMPONENT - This will show live vehicle locations */}
          <SimpleLeafletMap
            selectedVehicleId={selectedVehicleId}
            onVehicleSelect={handleVehicleSelect}
            height="600px"
            autoRefresh={true}
            refreshInterval={10000} // 10 seconds
            className="rounded-lg"
          />
        </div>
      </div>

      {/* Vehicle List with Actions */}
      {data.vehicles.length > 0 && (
        <div className="bg-white border rounded-lg">
          <div className="p-4 border-b bg-gray-50">
            <h3 className="text-lg font-semibold text-gray-900">Fleet Overview</h3>
            <p className="text-sm text-gray-600">Quick actions for your vehicles</p>
          </div>
          
          <div className="p-4">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
              {data.vehicles.map((vehicle, index) => {
                const device = data.devices.find(d => d.vehicle_id === vehicle.vehicle_id);
                const hasGPS = device && device.latitude && device.longitude;
                const isSelected = selectedVehicleId === vehicle.vehicle_id;
                
                return (
                  <div 
                    key={vehicle.vehicle_id || index}
                    className={`p-4 border rounded-lg transition-colors ${
                      isSelected ? 'border-blue-500 bg-blue-50' : 'border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <Car className="w-4 h-4 text-blue-600" />
                          <h4 className="font-medium text-gray-900">
                            {vehicle.vehicle_number || vehicle.vehicle_name || `Vehicle ${index + 1}`}
                          </h4>
                          {hasGPS && (
                            <div className="flex items-center gap-1">
                              <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                              <span className="text-xs text-green-600">GPS</span>
                            </div>
                          )}
                        </div>
                        
                        <div className="space-y-1 text-sm text-gray-600">
                          <div>Type: {vehicle.vehicle_type || 'Unknown'}</div>
                          <div>Device: {device?.device_id || 'Not assigned'}</div>
                          {hasGPS && (
                            <>
                              <div>Speed: {device.speed || 0} km/h</div>
                              <div className="text-xs">
                                Location: {parseFloat(device.latitude).toFixed(4)}, {parseFloat(device.longitude).toFixed(4)}
                              </div>
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                    
                    <div className="flex gap-2 mt-3">
                      <button
                        onClick={() => handleVehicleSelect(vehicle)}
                        className={`flex items-center gap-1 px-3 py-1 text-xs rounded transition-colors ${
                          isSelected 
                            ? 'bg-blue-600 text-white' 
                            : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                        }`}
                      >
                        <MapPin className="w-3 h-3" />
                        {isSelected ? 'Selected' : 'View on Map'}
                      </button>
                      
                      {hasGPS && (
                        <button
                          onClick={() => handleEnhancedTracking(vehicle)}
                          className="flex items-center gap-1 px-3 py-1 text-xs text-white transition-colors bg-green-600 rounded hover:bg-green-700"
                        >
                          <Navigation className="w-3 h-3" />
                          Track Route
                        </button>
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
                <strong>Data Source:</strong> Vehicle locations are fetched from your telemetry API in real-time.
              </p>
              <p>
                <strong>Enhanced Tracking:</strong> Click the "Track Route" button on any vehicle with GPS data to start advanced journey tracking with route visualization.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default LeafletLiveMapPage;