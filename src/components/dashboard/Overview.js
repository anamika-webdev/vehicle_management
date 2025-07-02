// EMERGENCY BYPASS: Replace your Overview.js with this
// This bypasses the context issue and uses direct API calls

import React, { useState, useEffect } from 'react';
import { 
  Shield, Car, AlertTriangle, MapPin, 
  TrendingUp, Activity, CheckCircle, 
  RefreshCw, Gauge, Clock, Wifi
} from 'lucide-react';

const Overview = () => {
  const [data, setData] = useState({
    devices: [],
    vehicles: [],
    alerts: []
  });
  const [loading, setLoading] = useState(true);
  const [lastUpdate, setLastUpdate] = useState(new Date());

  // ✅ EMERGENCY: Direct API calls - bypasses context completely
  useEffect(() => {
    const loadAllData = async () => {
      try {
        console.log('🚨 EMERGENCY: Loading data directly...');
        
        const token = localStorage.getItem('authToken');
        const headers = {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        };

        // Load all data in parallel
        const [devicesRes, vehiclesRes, alarmsRes] = await Promise.all([
          fetch('http://164.52.194.198:9090/device/v1/all?page=0&size=100', { headers }),
          fetch('http://164.52.194.198:9090/vehicle/v1/all?page=0&size=100', { headers }),
          fetch('http://164.52.194.198:9090/alarm/v1/manager/all?page=0&size=20', { headers })
        ]);

        const devicesData = await devicesRes.json();
        const vehiclesData = await vehiclesRes.json();
        const alarmsData = await alarmsRes.json();

        console.log('✅ EMERGENCY: Raw API data loaded:', {
          devices: devicesData.data?.length || 0,
          vehicles: vehiclesData.data?.length || 0,
          alerts: alarmsData.data?.length || 0
        });

        // Process devices with telemetry
        let processedDevices = devicesData.data || [];
        
        if (processedDevices.length > 0) {
          console.log('🔄 EMERGENCY: Adding telemetry to devices...');
          
          // Add telemetry to each device
          const devicesWithTelemetry = await Promise.all(
            processedDevices.map(async (device) => {
              try {
                const deviceId = device.device_id || device.deviceId || device.id;
                
                if (!deviceId) {
                  return { ...device, has_telemetry: false };
                }

                // Get telemetry for this device
                const telemetryRes = await fetch(
                  `http://164.52.194.198:9090/device/v1/data/${deviceId}?direction=desc&size=1`,
                  { headers }
                );
                
                if (telemetryRes.ok) {
                  const telemetryData = await telemetryRes.json();
                  
                  if (telemetryData.success && telemetryData.data?.length > 0) {
                    const latestTelemetry = telemetryData.data[0];
                    return {
                      ...device,
                      device_id: deviceId,
                      has_telemetry: true,
                      telemetry_status: 'active',
                      telemetry_count: telemetryData.data.length,
                      has_location: !!(latestTelemetry.latitude && latestTelemetry.longitude),
                      latitude: latestTelemetry.latitude,
                      longitude: latestTelemetry.longitude,
                      last_updated: latestTelemetry.timestamp || latestTelemetry.createdAt,
                      latest_telemetry: latestTelemetry
                    };
                  }
                }
                
                return { 
                  ...device, 
                  device_id: deviceId,
                  has_telemetry: false, 
                  telemetry_status: 'no_data' 
                };
              } catch (error) {
                console.warn(`⚠️ Telemetry failed for device:`, error);
                return { ...device, has_telemetry: false, telemetry_status: 'error' };
              }
            })
          );

          processedDevices = devicesWithTelemetry;
          console.log('✅ EMERGENCY: Devices processed with telemetry:', {
            total: processedDevices.length,
            withTelemetry: processedDevices.filter(d => d.has_telemetry).length
          });
        }

        setData({
          devices: processedDevices,
          vehicles: vehiclesData.data || [],
          alerts: alarmsData.data || []
        });
        
        setLastUpdate(new Date());
        console.log('🎉 EMERGENCY: Data loaded successfully!');
        
      } catch (error) {
        console.error('❌ EMERGENCY: Data loading failed:', error);
      } finally {
        setLoading(false);
      }
    };

    loadAllData();
  }, []);

  // Calculate statistics
  const stats = {
    totalVehicles: data.vehicles.length,
    totalDevices: data.devices.length,
    activeDevices: data.devices.filter(d => (d.status || '').toLowerCase() === 'active').length,
    devicesWithTelemetry: data.devices.filter(d => d.has_telemetry).length,
    devicesWithLocation: data.devices.filter(d => d.latitude && d.longitude).length,
    activeAlerts: data.alerts.filter(a => a.status === 'active' || !a.status).length
  };

  console.log('🔍 EMERGENCY: Current stats:', stats);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <RefreshCw className="w-12 h-12 mx-auto mb-4 text-blue-600 animate-spin" />
          <h2 className="mb-2 text-xl font-semibold text-gray-900">🚨 Emergency Loading</h2>
          <p className="text-gray-600">Bypassing context, loading data directly...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* SUCCESS HEADER */}
      {/* Main Statistics Grid */}
      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
        {/* Total Vehicles */}
        <div className="overflow-hidden bg-white rounded-lg shadow">
          <div className="p-5">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <Car className="w-8 h-8 text-blue-600" />
              </div>
              <div className="flex-1 w-0 ml-5">
                <dl>
                  <dt className="text-sm font-medium text-gray-500 truncate">
                    Total Vehicles
                  </dt>
                  <dd className="text-2xl font-bold text-gray-900">
                    {stats.totalVehicles}
                  </dd>
                </dl>
              </div>
            </div>
          </div>
        </div>

        {/* Total Devices */}
        <div className="overflow-hidden bg-white rounded-lg shadow">
          <div className="p-5">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <Shield className="w-8 h-8 text-green-600" />
              </div>
              <div className="flex-1 w-0 ml-5">
                <dl>
                  <dt className="text-sm font-medium text-gray-500 truncate">
                    Total Devices
                  </dt>
                  <dd className="text-2xl font-bold text-gray-900">
                    {stats.totalDevices}
                  </dd>
                </dl>
              </div>
            </div>
          </div>
        </div>

        {/* Devices with Telemetry */}
        <div className="overflow-hidden bg-white rounded-lg shadow">
          <div className="p-5">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <Gauge className="w-8 h-8 text-purple-600" />
              </div>
              <div className="flex-1 w-0 ml-5">
                <dl>
                  <dt className="text-sm font-medium text-gray-500 truncate">
                    With Location
                  </dt>
                  <dd className="text-2xl font-bold text-green-600">
                    {stats.devicesWithTelemetry}
                  </dd>
                  <dd className="text-sm text-gray-500">
                    {stats.totalDevices > 0 
                      ? Math.round((stats.devicesWithTelemetry / stats.totalDevices) * 100)
                      : 0
                    }% coverage
                  </dd>
                </dl>
              </div>
            </div>
          </div>
        </div>

        {/* Active Alerts */}
        <div className="overflow-hidden bg-white rounded-lg shadow">
          <div className="p-5">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <AlertTriangle className="w-8 h-8 text-red-600" />
              </div>
              <div className="flex-1 w-0 ml-5">
                <dl>
                  <dt className="text-sm font-medium text-gray-500 truncate">
                    Active Alerts
                  </dt>
                  <dd className="text-2xl font-bold text-gray-900">
                    {stats.activeAlerts}
                  </dd>
                </dl>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Recent Devices */}
      <div className="overflow-hidden bg-white shadow sm:rounded-md">
        <div className="px-4 py-5 sm:px-6">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-medium leading-6 text-gray-900">
                Device Status & Location
              </h3>
              <p className="max-w-2xl mt-1 text-sm text-gray-500">
                Real-time device monitoring and Location data
              </p>
            </div>
            <Activity className="w-5 h-5 text-gray-400" />
          </div>
        </div>
        
        {data.devices.length === 0 ? (
          <div className="px-4 py-8 text-center text-gray-500">
            <Shield className="w-12 h-12 mx-auto mb-4 text-gray-300" />
            <h3 className="mb-2 text-lg font-medium text-gray-900">No Devices Found</h3>
            <p>No devices are currently registered in the system</p>
          </div>
        ) : (
          <ul className="divide-y divide-gray-200">
            {data.devices.map((device) => {
              const deviceId = device.device_id || device.deviceId || device.id;
              return (
                <li key={deviceId} className="px-4 py-6 sm:px-6">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center">
                      <div className="flex-shrink-0">
                        {device.has_telemetry ? (
                          <CheckCircle className="w-8 h-8 text-green-500" />
                        ) : (
                          <Shield className="w-8 h-8 text-gray-400" />
                        )}
                      </div>
                      <div className="ml-4">
                        <div className="text-lg font-medium text-gray-900">
                          {device.device_name || `Device ${deviceId}`}
                        </div>
                        <div className="text-sm text-gray-500">
                          ID: {deviceId} • Type: {device.device_type || 'Unknown'}
                        </div>
                        {device.has_telemetry && device.latest_telemetry && (
                          <div className="mt-1 text-sm text-green-600">
                            📍 GPS: {device.latitude?.toFixed(4)}, {device.longitude?.toFixed(4)} • 
                            🕒 Last: {new Date(device.last_updated).toLocaleString()}
                          </div>
                        )}
                      </div>
                    </div>
                    
                    <div className="flex items-center space-x-6">
                      <div className="text-center">
                        <div className="text-sm font-medium text-gray-900">Status</div>
                        <div className="mt-1">
                          {device.status === 'Active' ? (
                            <span className="inline-flex items-center px-3 py-1 text-sm font-medium text-green-800 bg-green-100 rounded-full">
                              ✅ Active
                            </span>
                          ) : (
                            <span className="inline-flex items-center px-3 py-1 text-sm font-medium text-gray-800 bg-gray-100 rounded-full">
                              ❌ {device.status || 'Inactive'}
                            </span>
                          )}
                        </div>
                      </div>
                      
                      <div className="text-center">
                        <div className="text-sm font-medium text-gray-900">Source</div>
                        <div className="mt-1">
                          {device.has_telemetry ? (
                            <div className="text-green-600">
                              <Wifi className="w-5 h-5 mx-auto mb-1" />
                              <div className="text-xs">Live Data</div>
                            </div>
                          ) : (
                            <div className="text-gray-400">
                              <Wifi className="w-5 h-5 mx-auto mb-1" />
                              <div className="text-xs">No Data</div>
                            </div>
                          )}
                        </div>
                      </div>

                      {device.has_telemetry && (
                        <div className="text-center">
                          <div className="text-sm font-medium text-gray-900">Location</div>
                          <div className="mt-1">
                            {device.has_location ? (
                              <div className="text-blue-600">
                                <MapPin className="w-5 h-5 mx-auto mb-1" />
                                <div className="text-xs">GPS Active</div>
                              </div>
                            ) : (
                              <div className="text-gray-400">
                                <MapPin className="w-5 h-5 mx-auto mb-1" />
                                <div className="text-xs">No GPS</div>
                              </div>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
};

export default Overview;