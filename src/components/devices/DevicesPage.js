import React, { useState, useEffect } from 'react';
import { 
  Shield, Plus, Search, Filter, Eye, 
  AlertTriangle, CheckCircle, 
  RefreshCw, Bug, Database, Wifi, Navigation
} from 'lucide-react';
import { useData } from '../../contexts/DataContext';

const DevicesPage = ({ onViewDevice }) => {
  const { 
    data, 
    loading, 
    error,
    refreshData, 
    fetchAllData,
    connectionStatus,
    stats 
  } = useData();
  
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  const [refreshing, setRefreshing] = useState(false);
  const [lastUpdate, setLastUpdate] = useState(new Date());
  const [showDebugInfo, setShowDebugInfo] = useState(true);
  const [localDevices, setLocalDevices] = useState([]);
  const [localLoading, setLocalLoading] = useState(false);
  const [selectedDevice, setSelectedDevice] = useState(null);
  const [showRouteDialog, setShowRouteDialog] = useState(false);

  useEffect(() => {
    console.log('🔍 DevicesPage - Full Debug Info:', {
      contextExists: !!useData,
      dataExists: !!data,
      dataDevices: data?.devices,
      devicesLength: data?.devices?.length || 0,
      devicesWithTelemetry: data?.devices?.filter(d => d.has_telemetry)?.length || 0,
      loading,
      error,
      connectionStatus,
      stats
    });
    
    if (data?.devices?.length > 0) {
      console.log('🔍 Individual devices:');
      data.devices.forEach((device, index) => {
        console.log(`  Device ${index + 1}:`, {
          device_id: device.device_id,
          name: device.device_name,
          has_telemetry: device.has_telemetry,
          telemetry_status: device.telemetry_status,
          status: device.status
        });
      });
    } else {
      console.log('🔍 No devices found in data.devices');
      console.log('🔍 Raw data object:', data);
    }
  }, [data, loading, error, connectionStatus, stats]);

  useEffect(() => {
    console.log('🔍 DevicesPage mounted, forcing data fetch...');
    if (fetchAllData) {
      fetchAllData(false);
    }
  }, [fetchAllData]);

  useEffect(() => {
    const fetchDirectly = async () => {
      if (localLoading) return;
      
      try {
        setLocalLoading(true);
        console.log('🔄 Direct API fetch as backup...');
        
        const token = localStorage.getItem('authToken');
        const response = await fetch('http://164.52.194.198:9090/device/v1/all?page=0&size=100', {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        });
        
        if (response.ok) {
          const apiData = await response.json();
          console.log('✅ Direct API response:', apiData);
          
          if (apiData.success && apiData.data) {
            const normalizedDevices = apiData.data.map(device => {
              const deviceId = device.device_id || device.deviceId || device.id;
              return {
                ...device,
                device_id: deviceId,
                device_name: device.device_name || device.deviceName || device.name || `Device ${deviceId}`,
                device_type: device.device_type || device.deviceType || device.type || 'Unknown',
                status: device.status || 'Unknown',
                has_telemetry: false,
                telemetry_status: 'pending'
              };
            });
            
            setLocalDevices(normalizedDevices);
            console.log('✅ Local devices set:', normalizedDevices);
          }
        } else {
          console.error('❌ Direct API failed with status:', response.status);
        }
      } catch (error) {
        console.error('❌ Direct API error:', error);
      } finally {
        setLocalLoading(false);
      }
    };
    
    const timeout = setTimeout(() => {
      if (!data?.devices?.length && !loading) {
        console.log('⚠️ Context data empty after 3s, trying direct API...');
        fetchDirectly();
      }
    }, 3000);
    
    return () => clearTimeout(timeout);
  }, [data?.devices?.length, loading, localLoading]);

  useEffect(() => {
    const interval = setInterval(() => {
      console.log('🔄 Auto-refreshing devices data...');
      if (fetchAllData) {
        fetchAllData(true);
        setLastUpdate(new Date());
      }
    }, 30000);

    return () => clearInterval(interval);
  }, [fetchAllData]);

  const handleManualRefresh = async () => {
    setRefreshing(true);
    try {
      console.log('🔄 Manual refresh triggered from DevicesPage');
      if (refreshData) {
        await refreshData();
        setLastUpdate(new Date());
        console.log('✅ Manual refresh completed');
      }
    } catch (error) {
      console.error('❌ Manual refresh failed:', error);
    } finally {
      setRefreshing(false);
    }
  };

  const devices = data?.devices?.length > 0 ? data.devices : localDevices;
  const hasDevices = devices.length > 0;
  const isLoading = loading || localLoading;

  console.log('🔍 Final render decision:', {
    contextDevices: data?.devices?.length || 0,
    localDevices: localDevices.length,
    finalDevices: devices.length,
    isLoading,
    hasDevices
  });

  const filteredDevices = devices.filter(device => {
    const matchesSearch = !searchTerm || 
      (device.device_name && device.device_name.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (device.device_id && device.device_id.toString().includes(searchTerm)) ||
      (device.device_type && device.device_type.toLowerCase().includes(searchTerm.toLowerCase()));
    
    const matchesStatus = filterStatus === 'all' || 
      (filterStatus === 'active' && device.status === 'Active') ||
      (filterStatus === 'inactive' && device.status !== 'Active') ||
      (filterStatus === 'with_telemetry' && device.has_telemetry) ||
      (filterStatus === 'without_telemetry' && !device.has_telemetry);
    
    return matchesSearch && matchesStatus;
  });

  const getDeviceStatus = (device) => {
    if (!device.device_id || device.device_id === 'unknown') {
      return { text: 'Invalid ID', color: 'text-red-600 bg-red-100' };
    }
    
    if (device.has_telemetry) {
      return { text: 'Active with Data', color: 'text-green-600 bg-green-100' };
    }
    
    if (device.status === 'Active') {
      return { text: 'Active (No Data)', color: 'text-yellow-600 bg-yellow-100' };
    }
    
    return { text: device.status || 'Unknown', color: 'text-gray-600 bg-gray-100' };
  };

  const getTelemetryIcon = (device) => {
    if (device.has_telemetry) {
      return <CheckCircle className="w-4 h-4 text-green-500" />;
    }
    
    if (device.telemetry_status === 'fetch_error') {
      return <AlertTriangle className="w-4 h-4 text-red-500" />;
    }
    
    return <Shield className="w-4 h-4 text-gray-400" />;
  };

  const formatLastUpdate = (timestamp) => {
    if (!timestamp) return 'Never';
    
    try {
      const date = new Date(timestamp);
      return date.toLocaleString();
    } catch (error) {
      return 'Invalid date';
    }
  };

  if (isLoading && !hasDevices) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <RefreshCw className="w-8 h-8 mx-auto mb-4 text-blue-600 animate-spin" />
          <p className="text-gray-600">Loading devices...</p>
          <p className="mt-2 text-sm text-gray-500">
            Connection Status: {connectionStatus || 'Unknown'}
          </p>
          <p className="mt-1 text-xs text-gray-400">
            Context: {data?.devices?.length || 0} devices, Local: {localDevices.length} devices
          </p>
        </div>
      </div>
    );
  }

  if (error && !hasDevices) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <AlertTriangle className="w-8 h-8 mx-auto mb-4 text-red-600" />
          <p className="font-medium text-gray-900">Error loading devices</p>
          <p className="mt-1 text-sm text-red-600">{error}</p>
          <button 
            onClick={handleManualRefresh}
            disabled={refreshing}
            className="px-4 py-2 mt-4 text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50"
          >
            {refreshing ? 'Retrying...' : 'Retry'}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Device Management</h1>
          <p className="text-gray-600">
            Manage and monitor your IoT devices ({filteredDevices.length} of {devices.length} devices)
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 md:grid-cols-4">
        <div className="p-6 bg-white rounded-lg shadow">
          <div className="flex items-center">
            <Shield className="w-8 h-8 text-blue-600" />
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Total Devices</p>
              <p className="text-2xl font-semibold text-gray-900">{devices.length}</p>
            </div>
          </div>
        </div>

        <div className="p-6 bg-white rounded-lg shadow">
          <div className="flex items-center">
            <CheckCircle className="w-8 h-8 text-green-600" />
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">With Location</p>
              <p className="text-2xl font-semibold text-gray-900">
                {devices.filter(d => d.has_telemetry).length}
              </p>
            </div>
          </div>
        </div>

        <div className="p-6 bg-white rounded-lg shadow">
          <div className="flex items-center">
            <AlertTriangle className="w-8 h-8 text-yellow-600" />
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Issues</p>
              <p className="text-2xl font-semibold text-gray-900">
                {devices.filter(d => !d.device_id || d.device_id === 'unknown' || d.telemetry_status === 'fetch_error').length}
              </p>
            </div>
          </div>
        </div>

        <div className="p-6 bg-white rounded-lg shadow">
          <div className="flex items-center">
            <Eye className="w-8 h-8 text-purple-600" />
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Active</p>
              <p className="text-2xl font-semibold text-gray-900">
                {devices.filter(d => d.status === 'Active').length}
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="flex flex-col gap-4 p-6 bg-white rounded-lg shadow md:flex-row md:items-center md:justify-between">
        <div className="flex flex-1 gap-4">
          <div className="relative flex-1">
            <Search className="absolute w-4 h-4 text-gray-400 transform -translate-y-1/2 left-3 top-1/2" />
            <input
              type="text"
              placeholder="Search devices by name, ID, or type..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full py-2 pl-10 pr-4 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          
          <div className="relative">
            <Filter className="absolute w-4 h-4 text-gray-400 transform -translate-y-1/2 left-3 top-1/2" />
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="py-2 pl-10 pr-8 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="all">All Status</option>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
              <option value="with_telemetry">With Location</option>
              <option value="without_telemetry">No Location</option>
            </select>
          </div>
        </div>
      </div>

      {!hasDevices ? (
        <div className="p-12 text-center bg-white rounded-lg shadow">
          <Shield className="w-16 h-16 mx-auto mb-4 text-gray-300" />
          <h3 className="mb-2 text-lg font-medium text-gray-900">No Devices Found</h3>
          <p className="mb-4 text-gray-600">
            {isLoading ? 'Loading devices...' : 'No devices are currently available in the system.'}
          </p>
          <div className="space-y-2">
            <button
              onClick={handleManualRefresh}
              disabled={refreshing}
              className="px-4 py-2 text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50"
            >
              {refreshing ? 'Loading...' : 'Refresh Data'}
            </button>
            <p className="text-xs text-gray-500">
              Tried: Context API ({data?.devices?.length || 0}) + Direct API ({localDevices.length})
            </p>
          </div>
        </div>
      ) : (
        <div className="overflow-hidden bg-white rounded-lg shadow">
          <div className="px-6 py-4 border-b border-gray-200">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-medium text-gray-900">
                Device List ({devices.length} total)
              </h3>
            </div>
          </div>
          
          {filteredDevices.length === 0 ? (
            <div className="p-12 text-center">
              <Search className="w-12 h-12 mx-auto mb-4 text-gray-300" />
              <h3 className="mb-2 text-lg font-medium text-gray-900">No devices match your search</h3>
              <p className="text-gray-600">Try adjusting your search or filter criteria</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-xs font-medium tracking-wider text-left text-gray-500 uppercase">
                      Device
                    </th>
                    <th className="px-6 py-3 text-xs font-medium tracking-wider text-left text-gray-500 uppercase">
                      Status
                    </th>
                    <th className="px-6 py-3 text-xs font-medium tracking-wider text-left text-gray-500 uppercase">
                      Location
                    </th>
                    <th className="px-6 py-3 text-xs font-medium tracking-wider text-left text-gray-500 uppercase">
                      Last Update
                    </th>
                    <th className="px-6 py-3 text-xs font-medium tracking-wider text-left text-gray-500 uppercase">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {filteredDevices.map((device) => {
                    const deviceId = device.device_id || device.deviceId || device.id || 'unknown';
                    const status = getDeviceStatus(device);
                    
                    return (
                      <tr key={deviceId} className="hover:bg-gray-50">
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex items-center">
                            {getTelemetryIcon(device)}
                            <div className="ml-4">
                              <div className="text-sm font-medium text-gray-900">
                                {device.device_name || `Device ${deviceId}`}
                              </div>
                              <div className="text-sm text-gray-500">
                                ID: {deviceId} • Type: {device.device_type || 'Unknown'}
                              </div>
                            </div>
                          </div>
                        </td>
                        
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${status.color}`}>
                            {status.text}
                          </span>
                        </td>
                        
                        <td className="px-6 py-4 text-sm text-gray-900 whitespace-nowrap">
                          {device.has_telemetry ? (
                            <div>
                              <div className="font-medium text-green-600">
                                {device.telemetry_count || 0} records
                              </div>
                              {device.has_location && (
                                <div className="text-xs text-gray-500">GPS available</div>
                              )}
                            </div>
                          ) : (
                            <div className="text-gray-500">
                              <div>No data</div>
                              {device.telemetry_status && (
                                <div className="text-xs">Status: {device.telemetry_status}</div>
                              )}
                            </div>
                          )}
                        </td>
                        
                        <td className="px-6 py-4 text-sm text-gray-500 whitespace-nowrap">
                          {formatLastUpdate(device.last_updated)}
                        </td>
                        
                        <td className="px-6 py-4 text-sm font-medium whitespace-nowrap">
                          <button
                            onClick={() => onViewDevice && onViewDevice(deviceId)}
                            className="mr-4 text-blue-600 hover:text-blue-900"
                          >
                            <Eye className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => {
                              setSelectedDevice(device);
                              setShowRouteDialog(true);
                            }}
                            className="text-green-600 hover:text-green-900"
                            disabled={!device.has_telemetry}
                          >
                            <Navigation className="w-4 h-4" />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {showRouteDialog && selectedDevice && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
          <div className="w-full max-w-2xl p-6 bg-white rounded-lg shadow-lg">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold">Route for {selectedDevice.device_name || `Device ${selectedDevice.device_id}`}</h2>
              <button
                onClick={() => setShowRouteDialog(false)}
                className="text-gray-500 hover:text-gray-700"
              >
                ✕
              </button>
            </div>

            <div className="mb-4">
              <p><strong>ID:</strong> {selectedDevice.device_id}</p>
              <p><strong>Type:</strong> {selectedDevice.device_type || 'Unknown'}</p>
              <p><strong>Status:</strong> {getDeviceStatus(selectedDevice).text}</p>
              <p><strong>Last Update:</strong> {formatLastUpdate(selectedDevice.last_updated)}</p>
              {selectedDevice.has_telemetry && (
                <p><strong>Location:</strong> {selectedDevice.current_latitude}, {selectedDevice.current_longitude}</p>
              )}
            </div>

            <div className="h-64 mb-4 border rounded" id={`map-${selectedDevice.device_id}`}>
              {/* Placeholder for Leaflet Map - Add Leaflet.js CDN and script if needed */}
              <p className="text-center text-gray-500">Map Placeholder (Add Leaflet.js for real map)</p>
            </div>

            <button
              onClick={() => setShowRouteDialog(false)}
              className="px-4 py-2 text-white bg-blue-600 rounded-lg hover:bg-blue-700"
            >
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default DevicesPage;