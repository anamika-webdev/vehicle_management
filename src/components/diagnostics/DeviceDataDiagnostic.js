// Device Data Diagnostic Component
// Add this to your dashboard to troubleshoot API connectivity and device data

import React, { useState, useEffect } from 'react';
import { 
  RefreshCw, 
  CheckCircle, 
  XCircle, 
  AlertTriangle, 
  Info,
  Server,
  Wifi,
  Database
} from 'lucide-react';
import { useData } from '../../contexts/DataContext';
import { useAuth } from '../../contexts/AuthContext';
import apiService from '../../services/api';

const DeviceDataDiagnostic = () => {
  const { data, loading, error, lastUpdate, fetchData } = useData();
  const { currentUser, isLoggedIn } = useAuth();
  
  const [diagnosticResults, setDiagnosticResults] = useState({});
  const [runningDiagnostic, setRunningDiagnostic] = useState(false);

  // Auto-run diagnostic on component mount
  useEffect(() => {
    runDiagnostic();
  }, []);

  const runDiagnostic = async () => {
    setRunningDiagnostic(true);
    const results = {};

    try {
      // Test 1: API Connection
      console.log('🔍 Testing API connection...');
      try {
        const healthCheck = await apiService.healthCheck();
        results.apiConnection = {
          status: healthCheck.status,
          message: healthCheck.message,
          success: healthCheck.status !== 'unhealthy'
        };
      } catch (error) {
        results.apiConnection = {
          status: 'error',
          message: error.message,
          success: false
        };
      }

      // Test 2: Authentication
      console.log('🔍 Testing authentication...');
      results.authentication = {
        status: isLoggedIn ? 'success' : 'failed',
        message: isLoggedIn ? `Logged in as ${currentUser?.name || currentUser?.email}` : 'Not authenticated',
        success: isLoggedIn,
        token: !!apiService.token
      };

      // Test 3: Vehicle Data
      console.log('🔍 Testing vehicle data...');
      try {
        const vehicleResponse = await apiService.getVehicles(0, 5);
        results.vehicleData = {
          status: vehicleResponse.success ? 'success' : 'failed',
          message: `Found ${vehicleResponse.data?.length || 0} vehicles`,
          success: vehicleResponse.success,
          count: vehicleResponse.data?.length || 0
        };
      } catch (error) {
        results.vehicleData = {
          status: 'error',
          message: error.message,
          success: false,
          count: 0
        };
      }

      // Test 4: Device Data
      console.log('🔍 Testing device data...');
      try {
        const deviceResponse = await apiService.getDevices(0, 5);
        results.deviceData = {
          status: deviceResponse.success ? 'success' : 'failed',
          message: `Found ${deviceResponse.data?.length || 0} devices`,
          success: deviceResponse.success,
          count: deviceResponse.data?.length || 0
        };
      } catch (error) {
        results.deviceData = {
          status: 'error',
          message: error.message,
          success: false,
          count: 0
        };
      }

      // Test 5: Telemetry Data (if devices exist)
      if (data.devices.length > 0) {
        console.log('🔍 Testing telemetry data...');
        try {
          const firstDevice = data.devices[0];
          const telemetryResponse = await apiService.getDeviceTelemetry(firstDevice.device_id, 0, 1);
          results.telemetryData = {
            status: telemetryResponse.success ? 'success' : 'failed',
            message: `Device ${firstDevice.device_id}: ${telemetryResponse.data?.length || 0} telemetry records`,
            success: telemetryResponse.success,
            count: telemetryResponse.data?.length || 0
          };
        } catch (error) {
          results.telemetryData = {
            status: 'error',
            message: error.message,
            success: false,
            count: 0
          };
        }
      } else {
        results.telemetryData = {
          status: 'warning',
          message: 'No devices available to test telemetry',
          success: false,
          count: 0
        };
      }

      // Test 6: Alarm Data
      console.log('🔍 Testing alarm data...');
      try {
        const alarmResponse = await apiService.getManagerAlarms(0, 5);
        results.alarmData = {
          status: alarmResponse.success ? 'success' : 'failed',
          message: `Found ${alarmResponse.data?.length || 0} alarms`,
          success: alarmResponse.success,
          count: alarmResponse.data?.length || 0
        };
      } catch (error) {
        results.alarmData = {
          status: 'error',
          message: error.message,
          success: false,
          count: 0
        };
      }

    } catch (error) {
      console.error('❌ Diagnostic failed:', error);
    }

    setDiagnosticResults(results);
    setRunningDiagnostic(false);
  };

  const getStatusIcon = (status, success) => {
    if (status === 'success' || success) {
      return <CheckCircle className="w-5 h-5 text-green-600" />;
    } else if (status === 'warning') {
      return <AlertTriangle className="w-5 h-5 text-yellow-600" />;
    } else {
      return <XCircle className="w-5 h-5 text-red-600" />;
    }
  };

  const getStatusColor = (status, success) => {
    if (status === 'success' || success) {
      return 'text-green-600 bg-green-100';
    } else if (status === 'warning') {
      return 'text-yellow-600 bg-yellow-100';
    } else {
      return 'text-red-600 bg-red-100';
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Device Data Diagnostic</h2>
          <p className="text-gray-600">Troubleshoot API connectivity and data fetching</p>
        </div>
        
        <div className="flex items-center gap-3">
          <button
            onClick={fetchData}
            disabled={loading}
            className="flex items-center gap-2 px-4 py-2 text-blue-600 border border-blue-600 rounded-lg hover:bg-blue-50"
          >
            <Database className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            Refresh Data
          </button>
          
          <button
            onClick={runDiagnostic}
            disabled={runningDiagnostic}
            className="flex items-center gap-2 px-4 py-2 text-white bg-blue-600 rounded-lg hover:bg-blue-700"
          >
            <RefreshCw className={`w-4 h-4 ${runningDiagnostic ? 'animate-spin' : ''}`} />
            Run Diagnostic
          </button>
        </div>
      </div>

      {/* Current Status Overview */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
        <div className="p-4 bg-white rounded-lg shadow">
          <div className="flex items-center gap-3">
            <Server className="w-8 h-8 text-blue-600" />
            <div>
              <h3 className="font-semibold text-gray-900">API Status</h3>
              <p className="text-sm text-gray-600">
                {error ? 'Error' : 'Connected'}
              </p>
            </div>
          </div>
        </div>

        <div className="p-4 bg-white rounded-lg shadow">
          <div className="flex items-center gap-3">
            <Database className="w-8 h-8 text-green-600" />
            <div>
              <h3 className="font-semibold text-gray-900">Data Status</h3>
              <p className="text-sm text-gray-600">
                {data.vehicles.length + data.devices.length + data.alerts.length} records
              </p>
            </div>
          </div>
        </div>

        <div className="p-4 bg-white rounded-lg shadow">
          <div className="flex items-center gap-3">
            <Wifi className="w-8 h-8 text-yellow-600" />
            <div>
              <h3 className="font-semibold text-gray-900">WebSocket</h3>
              <p className="text-sm text-gray-600">
                Manual Refresh Mode
              </p>
            </div>
          </div>
        </div>

        <div className="p-4 bg-white rounded-lg shadow">
          <div className="flex items-center gap-3">
            <Info className="w-8 h-8 text-purple-600" />
            <div>
              <h3 className="font-semibold text-gray-900">Last Update</h3>
              <p className="text-sm text-gray-600">
                {lastUpdate ? lastUpdate.toLocaleTimeString() : 'Never'}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Diagnostic Results */}
      {Object.keys(diagnosticResults).length > 0 && (
        <div className="p-6 bg-white rounded-lg shadow">
          <h3 className="mb-4 text-lg font-semibold text-gray-900">Diagnostic Results</h3>
          
          <div className="space-y-4">
            {Object.entries(diagnosticResults).map(([test, result]) => (
              <div key={test} className="flex items-center justify-between p-4 border border-gray-200 rounded-lg">
                <div className="flex items-center gap-3">
                  {getStatusIcon(result.status, result.success)}
                  <div>
                    <h4 className="font-medium text-gray-900 capitalize">
                      {test.replace(/([A-Z])/g, ' $1').trim()}
                    </h4>
                    <p className="text-sm text-gray-600">{result.message}</p>
                  </div>
                </div>
                
                <div className="text-right">
                  <span className={`px-3 py-1 text-xs rounded-full ${getStatusColor(result.status, result.success)}`}>
                    {result.status}
                  </span>
                  {result.count !== undefined && (
                    <p className="mt-1 text-xs text-gray-500">{result.count} items</p>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Current Data Summary */}
      <div className="p-6 bg-white rounded-lg shadow">
        <h3 className="mb-4 text-lg font-semibold text-gray-900">Current Data Summary</h3>
        
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <div className="p-4 border border-gray-200 rounded-lg">
            <h4 className="font-medium text-gray-900">Vehicles</h4>
            <p className="text-2xl font-bold text-blue-600">{data.vehicles.length}</p>
            <p className="text-sm text-gray-600">Total registered vehicles</p>
          </div>
          
          <div className="p-4 border border-gray-200 rounded-lg">
            <h4 className="font-medium text-gray-900">Devices</h4>
            <p className="text-2xl font-bold text-green-600">{data.devices.length}</p>
            <p className="text-sm text-gray-600">
              {data.devices.filter(d => d.last_updated).length} with telemetry
            </p>
          </div>
          
          <div className="p-4 border border-gray-200 rounded-lg">
            <h4 className="font-medium text-gray-900">Alerts</h4>
            <p className="text-2xl font-bold text-red-600">{data.alerts.length}</p>
            <p className="text-sm text-gray-600">Active system alerts</p>
          </div>
        </div>
      </div>

      {/* API Configuration */}
      <div className="p-6 bg-white rounded-lg shadow">
        <h3 className="mb-4 text-lg font-semibold text-gray-900">API Configuration</h3>
        
        <div className="space-y-2 text-sm">
          <div className="flex justify-between">
            <span className="text-gray-600">API Base URL:</span>
            <span className="font-mono text-blue-600">{apiService.baseURL}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-600">Authentication:</span>
            <span className={`font-medium ${apiService.token ? 'text-green-600' : 'text-red-600'}`}>
              {apiService.token ? 'Token Present' : 'No Token'}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-600">Last Successful Endpoint:</span>
            <span className="font-mono text-gray-800">
              {apiService.lastSuccessfulEndpoint || 'None'}
            </span>
          </div>
        </div>
      </div>

      {/* Troubleshooting Tips */}
      <div className="p-6 rounded-lg bg-yellow-50">
        <h3 className="mb-3 text-lg font-semibold text-yellow-800">Troubleshooting Tips</h3>
        
        <div className="space-y-2 text-sm text-yellow-700">
          <p><strong>WebSocket showing "Unknown":</strong> This is normal - the app uses API polling instead of WebSocket for real-time updates.</p>
          <p><strong>No device data:</strong> Check if devices are registered in the API and have telemetry data.</p>
          <p><strong>Authentication issues:</strong> Try logging out and logging back in to refresh your token.</p>
          <p><strong>API errors:</strong> Verify the API server at {apiService.baseURL} is running and accessible.</p>
        </div>
      </div>
    </div>
  );
};

export default DeviceDataDiagnostic;