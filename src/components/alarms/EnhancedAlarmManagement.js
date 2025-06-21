import React, { useState, useEffect, useCallback } from 'react';
import { AlertTriangle, Download, MapPin, Bell, CheckCircle, X, Filter, Search, Map } from 'lucide-react';

const EnhancedAlarmManagement = () => {
  const [alarms, setAlarms] = useState([]);
  const [devices, setDevices] = useState([]);
  const [loading, setLoading] = useState(false);
  const [criticalAlarmPopup, setCriticalAlarmPopup] = useState(null);
  const [filterType, setFilterType] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedAlarms, setSelectedAlarms] = useState([]);
  const [showMap, setShowMap] = useState(false);

  // API Configuration
  const API_BASE_URL = 'http://164.52.194.198:9090';

  // Fetch devices to get all device IDs
  const fetchDevices = useCallback(async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/device/v1/all`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      console.log('Devices fetched:', data);
      
      if (Array.isArray(data)) {
        setDevices(data);
        return data;
      } else if (data.data && Array.isArray(data.data)) {
        setDevices(data.data);
        return data.data;
      }
      return [];
    } catch (error) {
      console.error('Failed to fetch devices:', error);
      return [];
    }
  }, []);

  // Fetch alarms for a specific device
  const fetchDeviceAlarms = useCallback(async (deviceId) => {
    try {
      const response = await fetch(
        `${API_BASE_URL}/alarm/v1/device/${deviceId}?page=0&size=20&sortBy=deviceId&direction=asc`,
        {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json',
          },
        }
      );

      if (!response.ok) {
        console.warn(`Failed to fetch alarms for device ${deviceId}: ${response.status}`);
        return [];
      }

      const data = await response.json();
      console.log(`Alarms for device ${deviceId}:`, data);
      
      if (Array.isArray(data)) {
        return data.map(alarm => ({
          ...alarm,
          device_id: deviceId,
          id: alarm.alarmId || alarm.id || `${deviceId}_${Date.now()}`,
          severity: alarm.severity || 'medium',
          status: alarm.status || 'active',
          timestamp: alarm.timestamp || alarm.createdAt || new Date().toISOString(),
          latitude: alarm.latitude ? parseFloat(alarm.latitude) : null,
          longitude: alarm.longitude ? parseFloat(alarm.longitude) : null,
          imageUrl: alarm.imageUrl || alarm.image_url,
          resolved: alarm.resolved || false
        }));
      } else if (data.data && Array.isArray(data.data)) {
        return data.data.map(alarm => ({
          ...alarm,
          device_id: deviceId,
          id: alarm.alarmId || alarm.id || `${deviceId}_${Date.now()}`,
          severity: alarm.severity || 'medium',
          status: alarm.status || 'active',
          timestamp: alarm.timestamp || alarm.createdAt || new Date().toISOString(),
          latitude: alarm.latitude ? parseFloat(alarm.latitude) : null,
          longitude: alarm.longitude ? parseFloat(alarm.longitude) : null,
          imageUrl: alarm.imageUrl || alarm.image_url,
          resolved: alarm.resolved || false
        }));
      }
      return [];
    } catch (error) {
      console.error(`Failed to fetch alarms for device ${deviceId}:`, error);
      return [];
    }
  }, []);

  // Fetch all alarms from all devices
  const fetchAllAlarms = useCallback(async () => {
    setLoading(true);
    try {
      console.log('Starting to fetch all alarms...');
      const deviceList = await fetchDevices();
      
      if (deviceList.length === 0) {
        console.warn('No devices found');
        setAlarms([]);
        return;
      }

      console.log(`Fetching alarms for ${deviceList.length} devices...`);
      
      // Fetch alarms for all devices concurrently
      const alarmPromises = deviceList.map(device => {
        const deviceId = device.deviceId || device.device_id || device.id;
        return fetchDeviceAlarms(deviceId);
      });

      const alarmResults = await Promise.all(alarmPromises);
      
      // Flatten all alarms into single array
      const allAlarms = alarmResults.flat().filter(alarm => alarm);
      
      console.log(`Total alarms fetched: ${allAlarms.length}`);
      setAlarms(allAlarms);

      // Check for critical alarms and show popup
      const criticalAlarms = allAlarms.filter(alarm => 
        alarm.severity === 'critical' && !alarm.resolved
      );
      
      if (criticalAlarms.length > 0) {
        setCriticalAlarmPopup(criticalAlarms[0]); // Show first critical alarm
      }

    } catch (error) {
      console.error('Failed to fetch all alarms:', error);
      setAlarms([]);
    } finally {
      setLoading(false);
    }
  }, [fetchDevices, fetchDeviceAlarms]);

  // Resolve alarm
  const resolveAlarm = useCallback(async (alarmId) => {
    try {
      // Update local state immediately for better UX
      setAlarms(prev => prev.map(alarm => 
        alarm.id === alarmId ? { ...alarm, resolved: true, status: 'resolved' } : alarm
      ));

      // Close popup if this alarm was being shown
      if (criticalAlarmPopup?.id === alarmId) {
        setCriticalAlarmPopup(null);
      }

      console.log(`Alarm ${alarmId} resolved successfully`);
    } catch (error) {
      console.error('Failed to resolve alarm:', error);
      // Revert local state on error
      setAlarms(prev => prev.map(alarm => 
        alarm.id === alarmId ? { ...alarm, resolved: false, status: 'active' } : alarm
      ));
    }
  }, [criticalAlarmPopup]);

  // Download alarm data
  const downloadAlarmData = useCallback((selectedAlarmsData = null) => {
    const alarmsToDownload = selectedAlarmsData || alarms;
    
    if (alarmsToDownload.length === 0) {
      alert('No alarms to download');
      return;
    }

    // Prepare CSV data
    const csvHeaders = [
      'Alarm ID',
      'Device ID', 
      'Type',
      'Severity',
      'Message',
      'Timestamp',
      'Status',
      'Latitude',
      'Longitude',
      'Image URL',
      'Resolved'
    ];

    const csvRows = alarmsToDownload.map(alarm => [
      alarm.id || '',
      alarm.device_id || '',
      alarm.alarmType || alarm.type || '',
      alarm.severity || '',
      (alarm.message || alarm.description || '').replace(/,/g, ';'),
      alarm.timestamp || '',
      alarm.status || '',
      alarm.latitude || '',
      alarm.longitude || '',
      alarm.imageUrl || '',
      alarm.resolved ? 'Yes' : 'No'
    ]);

    const csvContent = [csvHeaders, ...csvRows]
      .map(row => row.map(cell => `"${cell}"`).join(','))
      .join('\n');

    // Create and download file
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `alarms_${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }, [alarms]);

  // Filter alarms
  const filteredAlarms = alarms.filter(alarm => {
    const matchesFilter = filterType === 'all' || 
      (filterType === 'critical' && alarm.severity === 'critical') ||
      (filterType === 'active' && !alarm.resolved) ||
      (filterType === 'resolved' && alarm.resolved);
    
    const matchesSearch = !searchTerm || 
      (alarm.message && alarm.message.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (alarm.alarmType && alarm.alarmType.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (alarm.device_id && alarm.device_id.toString().includes(searchTerm));
    
    return matchesFilter && matchesSearch;
  });

  // Get severity color
  const getSeverityColor = (severity) => {
    switch (severity?.toLowerCase()) {
      case 'critical':
        return 'bg-red-100 text-red-800 border-red-200';
      case 'high':
        return 'bg-orange-100 text-orange-800 border-orange-200';
      case 'medium':
        return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'low':
        return 'bg-blue-100 text-blue-800 border-blue-200';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  // Initial load
  useEffect(() => {
    fetchAllAlarms();
  }, [fetchAllAlarms]);

  // Auto-refresh every 30 seconds
  useEffect(() => {
    const interval = setInterval(fetchAllAlarms, 30000);
    return () => clearInterval(interval);
  }, [fetchAllAlarms]);

  return (
    <div className="min-h-screen p-6 bg-gray-50">
      {/* Critical Alarm Popup */}
      {criticalAlarmPopup && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
          <div className="w-full max-w-md p-6 mx-4 bg-white border-2 border-red-500 rounded-lg shadow-xl">
            <div className="flex items-center gap-3 mb-4">
              <AlertTriangle className="w-8 h-8 text-red-600" />
              <h2 className="text-xl font-bold text-red-800">CRITICAL ALARM</h2>
              <button
                onClick={() => setCriticalAlarmPopup(null)}
                className="ml-auto text-gray-500 hover:text-gray-700"
              >
                <X className="w-6 h-6" />
              </button>
            </div>
            
            <div className="space-y-3">
              <div>
                <p className="font-semibold text-gray-900">Device ID: {criticalAlarmPopup.device_id}</p>
                <p className="text-gray-700">Type: {criticalAlarmPopup.alarmType || criticalAlarmPopup.type}</p>
                <p className="text-gray-700">Message: {criticalAlarmPopup.message || criticalAlarmPopup.description}</p>
                <p className="text-sm text-gray-500">
                  Time: {new Date(criticalAlarmPopup.timestamp).toLocaleString()}
                </p>
              </div>
              
              {criticalAlarmPopup.imageUrl && (
                <img 
                  src={criticalAlarmPopup.imageUrl} 
                  alt="Alarm"
                  className="object-cover w-full h-32 border rounded"
                  onError={(e) => e.target.style.display = 'none'}
                />
              )}
              
              {(criticalAlarmPopup.latitude && criticalAlarmPopup.longitude) && (
                <p className="flex items-center gap-1 text-sm text-gray-600">
                  <MapPin className="w-4 h-4" />
                  Location: {criticalAlarmPopup.latitude.toFixed(4)}, {criticalAlarmPopup.longitude.toFixed(4)}
                </p>
              )}
            </div>
            
            <div className="flex gap-3 mt-6">
              <button
                onClick={() => resolveAlarm(criticalAlarmPopup.id)}
                className="flex items-center justify-center flex-1 gap-2 px-4 py-2 text-white bg-green-600 rounded-lg hover:bg-green-700"
              >
                <CheckCircle className="w-4 h-4" />
                Resolve
              </button>
              <button
                onClick={() => setCriticalAlarmPopup(null)}
                className="flex-1 px-4 py-2 text-white bg-gray-600 rounded-lg hover:bg-gray-700"
              >
                Dismiss
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Alarm Management System</h1>
          <p className="text-gray-600">Monitor and manage alarms from all devices</p>
        </div>
        
        <div className="flex items-center gap-3">
          <button
            onClick={() => setShowMap(!showMap)}
            className="flex items-center gap-2 px-4 py-2 text-white bg-blue-600 rounded-lg hover:bg-blue-700"
          >
            <Map className="w-4 h-4" />
            {showMap ? 'Hide Map' : 'Show Map'}
          </button>
          
          <button
            onClick={() => downloadAlarmData(selectedAlarms.length > 0 ? selectedAlarms : null)}
            className="flex items-center gap-2 px-4 py-2 text-white bg-green-600 rounded-lg hover:bg-green-700"
          >
            <Download className="w-4 h-4" />
            Download ({selectedAlarms.length > 0 ? selectedAlarms.length : 'All'})
          </button>
          
          <button
            onClick={fetchAllAlarms}
            disabled={loading}
            className="flex items-center gap-2 px-4 py-2 text-white bg-purple-600 rounded-lg hover:bg-purple-700 disabled:opacity-50"
          >
            <Bell className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>
      </div>

      {/* Statistics */}
      <div className="grid grid-cols-1 gap-6 mb-6 md:grid-cols-4">
        <div className="p-6 bg-white rounded-lg shadow">
          <div className="flex items-center">
            <div className="flex-1">
              <p className="text-sm font-medium text-gray-600">Total Alarms</p>
              <p className="text-2xl font-bold text-gray-900">{alarms.length}</p>
            </div>
            <AlertTriangle className="w-8 h-8 text-gray-400" />
          </div>
        </div>
        
        <div className="p-6 bg-white rounded-lg shadow">
          <div className="flex items-center">
            <div className="flex-1">
              <p className="text-sm font-medium text-gray-600">Critical Alarms</p>
              <p className="text-2xl font-bold text-red-600">
                {alarms.filter(a => a.severity === 'critical' && !a.resolved).length}
              </p>
            </div>
            <AlertTriangle className="w-8 h-8 text-red-400" />
          </div>
        </div>
        
        <div className="p-6 bg-white rounded-lg shadow">
          <div className="flex items-center">
            <div className="flex-1">
              <p className="text-sm font-medium text-gray-600">Active Alarms</p>
              <p className="text-2xl font-bold text-orange-600">
                {alarms.filter(a => !a.resolved).length}
              </p>
            </div>
            <Bell className="w-8 h-8 text-orange-400" />
          </div>
        </div>
        
        <div className="p-6 bg-white rounded-lg shadow">
          <div className="flex items-center">
            <div className="flex-1">
              <p className="text-sm font-medium text-gray-600">Resolved Alarms</p>
              <p className="text-2xl font-bold text-green-600">
                {alarms.filter(a => a.resolved).length}
              </p>
            </div>
            <CheckCircle className="w-8 h-8 text-green-400" />
          </div>
        </div>
      </div>

      {/* Map View */}
      {showMap && (
        <div className="p-6 mb-6 bg-white rounded-lg shadow">
          <h2 className="mb-4 text-xl font-bold text-gray-900">Alarm Locations</h2>
          <div className="flex items-center justify-center bg-gray-100 border-2 border-gray-300 border-dashed rounded-lg h-96">
            <div className="text-center">
              <MapPin className="w-12 h-12 mx-auto mb-2 text-gray-400" />
              <p className="text-gray-600">Interactive map showing alarm locations</p>
              <p className="mt-2 text-sm text-gray-500">
                {alarms.filter(a => a.latitude && a.longitude).length} alarms with location data
              </p>
              <div className="mt-4 space-y-2">
                {alarms.filter(a => a.latitude && a.longitude).slice(0, 5).map((alarm, index) => (
                  <div key={index} className="flex items-center justify-center gap-2 text-xs text-gray-600">
                    <div className={`w-2 h-2 rounded-full ${
                      alarm.severity === 'critical' ? 'bg-red-500' :
                      alarm.severity === 'high' ? 'bg-orange-500' :
                      alarm.severity === 'medium' ? 'bg-yellow-500' : 'bg-blue-500'
                    }`}></div>
                    Device {alarm.device_id}: {alarm.latitude.toFixed(4)}, {alarm.longitude.toFixed(4)}
                  </div>
                ))}
                {alarms.filter(a => a.latitude && a.longitude).length > 5 && (
                  <p className="text-xs text-gray-500">
                    + {alarms.filter(a => a.latitude && a.longitude).length - 5} more locations...
                  </p>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Filters and Search */}
      <div className="p-6 mb-6 bg-white rounded-lg shadow">
        <div className="flex flex-col items-center gap-4 sm:flex-row">
          <div className="flex items-center gap-2">
            <Filter className="w-5 h-5 text-gray-500" />
            <select
              value={filterType}
              onChange={(e) => setFilterType(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="all">All Alarms</option>
              <option value="critical">Critical Only</option>
              <option value="active">Active Only</option>
              <option value="resolved">Resolved Only</option>
            </select>
          </div>
          
          <div className="flex items-center flex-1 max-w-md gap-2">
            <Search className="w-5 h-5 text-gray-500" />
            <input
              type="text"
              placeholder="Search alarms..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>
          
          <div className="text-sm text-gray-600">
            Showing {filteredAlarms.length} of {alarms.length} alarms
          </div>
        </div>
      </div>

      {/* Alarms Table */}
      <div className="overflow-hidden bg-white rounded-lg shadow">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-xs font-medium tracking-wider text-left text-gray-500 uppercase">
                  <input
                    type="checkbox"
                    onChange={(e) => {
                      if (e.target.checked) {
                        setSelectedAlarms(filteredAlarms);
                      } else {
                        setSelectedAlarms([]);
                      }
                    }}
                    checked={selectedAlarms.length === filteredAlarms.length && filteredAlarms.length > 0}
                  />
                </th>
                <th className="px-6 py-3 text-xs font-medium tracking-wider text-left text-gray-500 uppercase">
                  Device ID
                </th>
                <th className="px-6 py-3 text-xs font-medium tracking-wider text-left text-gray-500 uppercase">
                  Type
                </th>
                <th className="px-6 py-3 text-xs font-medium tracking-wider text-left text-gray-500 uppercase">
                  Severity
                </th>
                <th className="px-6 py-3 text-xs font-medium tracking-wider text-left text-gray-500 uppercase">
                  Message
                </th>
                <th className="px-6 py-3 text-xs font-medium tracking-wider text-left text-gray-500 uppercase">
                  Timestamp
                </th>
                <th className="px-6 py-3 text-xs font-medium tracking-wider text-left text-gray-500 uppercase">
                  Location
                </th>
                <th className="px-6 py-3 text-xs font-medium tracking-wider text-left text-gray-500 uppercase">
                  Image
                </th>
                <th className="px-6 py-3 text-xs font-medium tracking-wider text-left text-gray-500 uppercase">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {loading ? (
                <tr>
                  <td colSpan="9" className="px-6 py-12 text-center">
                    <div className="flex items-center justify-center">
                      <div className="w-8 h-8 border-b-2 border-blue-600 rounded-full animate-spin"></div>
                      <span className="ml-3 text-gray-600">Loading alarms...</span>
                    </div>
                  </td>
                </tr>
              ) : filteredAlarms.length === 0 ? (
                <tr>
                  <td colSpan="9" className="px-6 py-12 text-center text-gray-500">
                    No alarms found
                  </td>
                </tr>
              ) : (
                filteredAlarms.map((alarm) => (
                  <tr key={alarm.id} className={`hover:bg-gray-50 ${alarm.resolved ? 'opacity-60' : ''}`}>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <input
                        type="checkbox"
                        checked={selectedAlarms.includes(alarm)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setSelectedAlarms([...selectedAlarms, alarm]);
                          } else {
                            setSelectedAlarms(selectedAlarms.filter(a => a.id !== alarm.id));
                          }
                        }}
                      />
                    </td>
                    <td className="px-6 py-4 text-sm font-medium text-gray-900 whitespace-nowrap">
                      {alarm.device_id}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-900 whitespace-nowrap">
                      {alarm.alarmType || alarm.type || 'Unknown'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full border ${getSeverityColor(alarm.severity)}`}>
                        {alarm.severity || 'medium'}
                      </span>
                    </td>
                    <td className="max-w-xs px-6 py-4 text-sm text-gray-900 truncate">
                      {alarm.message || alarm.description || 'No description'}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-500 whitespace-nowrap">
                      {new Date(alarm.timestamp).toLocaleString()}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-500 whitespace-nowrap">
                      {(alarm.latitude && alarm.longitude) ? (
                        <div className="flex items-center gap-1">
                          <MapPin className="w-4 h-4" />
                          <span className="text-xs">
                            {alarm.latitude.toFixed(4)}, {alarm.longitude.toFixed(4)}
                          </span>
                        </div>
                      ) : (
                        'N/A'
                      )}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-500 whitespace-nowrap">
                      {alarm.imageUrl ? (
                        <button
                          onClick={() => window.open(alarm.imageUrl, '_blank')}
                          className="text-blue-600 underline hover:text-blue-800"
                        >
                          View Image
                        </button>
                      ) : (
                        'No Image'
                      )}
                    </td>
                    <td className="px-6 py-4 text-sm font-medium whitespace-nowrap">
                      {!alarm.resolved ? (
                        <button
                          onClick={() => resolveAlarm(alarm.id)}
                          className="flex items-center gap-1 px-3 py-1 text-xs text-white bg-green-600 rounded hover:bg-green-700"
                        >
                          <CheckCircle className="w-3 h-3" />
                          Resolve
                        </button>
                      ) : (
                        <span className="flex items-center gap-1 text-xs text-green-600">
                          <CheckCircle className="w-3 h-3" />
                          Resolved
                        </span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default EnhancedAlarmManagement;