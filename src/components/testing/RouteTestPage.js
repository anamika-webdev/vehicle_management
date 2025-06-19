// Route Testing Component to verify API integration
// src/components/testing/RouteTestPage.js

import React, { useState, useEffect } from 'react';
import { MapPin, Navigation, Play, RefreshCw } from 'lucide-react';
import apiService from '../../services/api';
import { config } from '../../config/apiConfig';

const RouteTestPage = () => {
  const [vehicles, setVehicles] = useState([]);
  const [liveData, setLiveData] = useState([]);
  const [trips, setTrips] = useState([]);
  const [selectedRoute, setSelectedRoute] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [currentUser, setCurrentUser] = useState(null);

  // Get current user from localStorage
  useEffect(() => {
    const user = JSON.parse(localStorage.getItem(config.USER_STORAGE_KEY) || '{}');
    setCurrentUser(user);
  }, []);

  // Test fetching vehicle data with locations
  const testVehicleData = async () => {
    if (!currentUser?.manager_id) {
      setError('No user logged in');
      return;
    }

    try {
      setLoading(true);
      setError(null);

      console.log('Testing vehicle data API...');
      
      // Test regular vehicle data
      const vehicleData = await apiService.getVehicles(currentUser.manager_id);
      console.log('Vehicle data:', vehicleData);
      setVehicles(vehicleData);

      // Test live vehicle data
      const liveVehicleData = await apiService.getLiveVehicleData(currentUser.manager_id);
      console.log('Live vehicle data:', liveVehicleData);
      setLiveData(liveVehicleData);

    } catch (err) {
      console.error('Error fetching vehicle data:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // Test fetching trip history
  const testTripHistory = async () => {
    if (!currentUser?.manager_id) {
      setError('No user logged in');
      return;
    }

    try {
      setLoading(true);
      setError(null);

      console.log('Testing trip history API...');
      
      const tripData = await apiService.getTripHistory(currentUser.manager_id, {
        limit: 10,
        offset: 0
      });
      
      console.log('Trip history:', tripData);
      setTrips(tripData.trips || tripData);

    } catch (err) {
      console.error('Error fetching trip history:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // Test fetching route for a specific trip
  const testTripRoute = async (tripId) => {
    try {
      setLoading(true);
      setError(null);

      console.log('Testing trip route API for trip:', tripId);
      
      const routeData = await apiService.getTripRoute(tripId);
      console.log('Route data:', routeData);
      setSelectedRoute(routeData);

    } catch (err) {
      console.error('Error fetching route:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // Test all APIs
  const testAllAPIs = async () => {
    await testVehicleData();
    await testTripHistory();
  };

  return (
    <div className="max-w-6xl p-6 mx-auto space-y-6">
      <div className="p-6 bg-white rounded-lg shadow-md">
        <h1 className="mb-4 text-2xl font-bold text-gray-900">
          Route & Location API Testing
        </h1>
        
        {currentUser?.manager_id ? (
          <div className="p-3 mb-4 border border-green-200 rounded-lg bg-green-50">
            <p className="text-green-800">
              ✅ Logged in as: {currentUser.name} (Manager ID: {currentUser.manager_id})
            </p>
          </div>
        ) : (
          <div className="p-3 mb-4 border border-red-200 rounded-lg bg-red-50">
            <p className="text-red-800">
              ❌ No user logged in. Please log in first.
            </p>
          </div>
        )}

        {error && (
          <div className="p-3 mb-4 border border-red-200 rounded-lg bg-red-50">
            <p className="text-red-800">❌ Error: {error}</p>
          </div>
        )}

        <div className="flex flex-wrap gap-3 mb-6">
          <button
            onClick={testVehicleData}
            disabled={loading || !currentUser?.manager_id}
            className="flex items-center gap-2 px-4 py-2 text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50"
          >
            <MapPin className="w-4 h-4" />
            Test Vehicle Data
          </button>
          
          <button
            onClick={testTripHistory}
            disabled={loading || !currentUser?.manager_id}
            className="flex items-center gap-2 px-4 py-2 text-white bg-green-600 rounded-lg hover:bg-green-700 disabled:opacity-50"
          >
            <Navigation className="w-4 h-4" />
            Test Trip History
          </button>
          
          <button
            onClick={testAllAPIs}
            disabled={loading || !currentUser?.manager_id}
            className="flex items-center gap-2 px-4 py-2 text-white bg-purple-600 rounded-lg hover:bg-purple-700 disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            Test All APIs
          </button>
        </div>
      </div>

      {/* Vehicle Data Results */}
      {vehicles.length > 0 && (
        <div className="p-6 bg-white rounded-lg shadow-md">
          <h2 className="mb-4 text-xl font-semibold text-gray-900">Vehicle Data</h2>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            {vehicles.map(vehicle => (
              <div key={vehicle.vehicle_id} className="p-4 border border-gray-200 rounded-lg">
                <h3 className="font-medium text-gray-900">{vehicle.vehicle_number}</h3>
                <p className="text-sm text-gray-600">{vehicle.manufacturer} {vehicle.model}</p>
                <div className="mt-2 space-y-1 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-500">Latitude:</span>
                    <span className="font-mono">{vehicle.current_latitude?.toFixed(6) || 'N/A'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">Longitude:</span>
                    <span className="font-mono">{vehicle.current_longitude?.toFixed(6) || 'N/A'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">Speed:</span>
                    <span className="font-mono">{Math.round(vehicle.current_speed || 0)} km/h</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Live Data Results */}
      {liveData.length > 0 && (
        <div className="p-6 bg-white rounded-lg shadow-md">
          <h2 className="mb-4 text-xl font-semibold text-gray-900">Live Vehicle Data</h2>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            {liveData.map(vehicle => (
              <div key={vehicle.vehicle_id} className="p-4 border border-gray-200 rounded-lg bg-green-50">
                <h3 className="font-medium text-gray-900">{vehicle.vehicle_number}</h3>
                <div className="mt-2 space-y-1 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-500">Live Latitude:</span>
                    <span className="font-mono text-green-700">{vehicle.current_latitude?.toFixed(6) || 'N/A'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">Live Longitude:</span>
                    <span className="font-mono text-green-700">{vehicle.current_longitude?.toFixed(6) || 'N/A'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">Live Speed:</span>
                    <span className="font-mono text-green-700">{Math.round(vehicle.current_speed || 0)} km/h</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">Heading:</span>
                    <span className="font-mono text-green-700">{Math.round(vehicle.current_heading || 0)}°</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">Status:</span>
                    <span className={`px-2 py-1 rounded-full text-xs ${
                      vehicle.status === 'driving' ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'
                    }`}>
                      {vehicle.status}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Trip History Results */}
      {trips.length > 0 && (
        <div className="p-6 bg-white rounded-lg shadow-md">
          <h2 className="mb-4 text-xl font-semibold text-gray-900">Trip History</h2>
          <div className="space-y-3">
            {trips.map(trip => (
              <div key={trip.trip_id} className="p-4 border border-gray-200 rounded-lg">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="font-medium text-gray-900">
                    Trip #{trip.trip_id} - {trip.vehicle_number}
                  </h3>
                  <button
                    onClick={() => testTripRoute(trip.trip_id)}
                    disabled={loading}
                    className="flex items-center gap-1 px-3 py-1 text-sm text-white bg-blue-600 rounded hover:bg-blue-700 disabled:opacity-50"
                  >
                    <Play className="w-3 h-3" />
                    Load Route
                  </button>
                </div>
                
                <div className="grid grid-cols-2 gap-4 text-sm md:grid-cols-4">
                  <div>
                    <span className="text-gray-500">Distance:</span>
                    <p className="font-medium">{trip.total_distance || 'N/A'} km</p>
                  </div>
                  <div>
                    <span className="text-gray-500">Duration:</span>
                    <p className="font-medium">{trip.total_duration || 'N/A'} min</p>
                  </div>
                  <div>
                    <span className="text-gray-500">Avg Speed:</span>
                    <p className="font-medium">{trip.avg_speed || 'N/A'} km/h</p>
                  </div>
                  <div>
                    <span className="text-gray-500">Status:</span>
                    <p className="font-medium">{trip.trip_status}</p>
                  </div>
                </div>
                
                <div className="mt-2 text-xs text-gray-500">
                  <p>Start: {trip.start_latitude?.toFixed(4)}, {trip.start_longitude?.toFixed(4)}</p>
                  <p>End: {trip.end_latitude?.toFixed(4)}, {trip.end_longitude?.toFixed(4)}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Route Data Results */}
      {selectedRoute && (
        <div className="p-6 bg-white rounded-lg shadow-md">
          <h2 className="mb-4 text-xl font-semibold text-gray-900">
            Route Data for Trip #{selectedRoute.trip?.trip_id}
          </h2>
          
          {selectedRoute.trip && (
            <div className="p-3 mb-4 border border-blue-200 rounded-lg bg-blue-50">
              <h3 className="font-medium text-blue-900">Trip Information</h3>
              <div className="grid grid-cols-2 gap-2 mt-2 text-sm md:grid-cols-4">
                <div>Vehicle: {selectedRoute.trip.vehicle_number}</div>
                <div>Distance: {selectedRoute.trip.total_distance || 'N/A'} km</div>
                <div>Duration: {selectedRoute.trip.total_duration || 'N/A'} min</div>
                <div>Status: {selectedRoute.trip.trip_status}</div>
              </div>
            </div>
          )}
          
          {selectedRoute.route_points && selectedRoute.route_points.length > 0 ? (
            <div>
              <h3 className="mb-3 font-medium text-gray-900">
                Route Points ({selectedRoute.route_points.length} points)
              </h3>
              <div className="overflow-y-auto border border-gray-200 rounded-lg max-h-64">
                <table className="w-full text-sm">
                  <thead className="sticky top-0 bg-gray-50">
                    <tr>
                      <th className="px-3 py-2 text-left">#</th>
                      <th className="px-3 py-2 text-left">Latitude</th>
                      <th className="px-3 py-2 text-left">Longitude</th>
                      <th className="px-3 py-2 text-left">Speed</th>
                      <th className="px-3 py-2 text-left">Heading</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {selectedRoute.route_points.map((point, index) => (
                      <tr key={point.point_id || index} className="hover:bg-gray-50">
                        <td className="px-3 py-2">{point.sequence_number || index + 1}</td>
                        <td className="px-3 py-2 font-mono">{point.latitude.toFixed(6)}</td>
                        <td className="px-3 py-2 font-mono">{point.longitude.toFixed(6)}</td>
                        <td className="px-3 py-2">{Math.round(point.speed || 0)} km/h</td>
                        <td className="px-3 py-2">{Math.round(point.heading || 0)}°</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ) : (
            <p className="text-gray-500">No route points available</p>
          )}
        </div>
      )}

      {/* API Endpoints Info */}
      <div className="p-6 rounded-lg bg-gray-50">
        <h2 className="mb-4 text-xl font-semibold text-gray-900">API Endpoints Being Tested</h2>
        <div className="space-y-2 font-mono text-sm">
          <div>🚗 GET /managers/v1/{currentUser?.manager_id || '{id}'}/vehicles</div>
          <div>📡 GET /managers/v1/{currentUser?.manager_id || '{id}'}/vehicles/live</div>
          <div>🛣️ GET /managers/v1/{currentUser?.manager_id || '{id}'}/trips/history</div>
          <div>📍 GET /trips/v1/{'{trip_id}'}/route</div>
        </div>
        
        <div className="p-3 mt-4 border border-blue-200 rounded-lg bg-blue-50">
          <p className="text-sm text-blue-800">
            💡 This component tests the latitude/longitude data flow from your API to the frontend.
            Check the browser console for detailed API responses.
          </p>
        </div>
      </div>
    </div>
  );
};

export default RouteTestPage;