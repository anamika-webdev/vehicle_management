// Telemetry Diagnostic Component
// src/components/debug/TelemetryDiagnostic.js

import React, { useState, useEffect } from 'react';
import { 
  Activity, RefreshCw, CheckCircle, XCircle, AlertTriangle, 
  Play, Database, Wifi, Search
} from 'lucide-react';
import { useData } from '../../contexts/DataContext';
import apiService from '../../services/api';

const TelemetryDiagnostic = () => {
  const { data } = useData();
  const [testing, setTesting] = useState(false);
  const [results, setResults] = useState({});
  const [selectedDevice, setSelectedDevice] = useState('');
  const [endpointTest, setEndpointTest] = useState(null);

  // Get available devices
  const availableDevices = data.devices || [];

  const getStatusIcon = (status) => {
    switch (status) {
      case 'success':
        return <CheckCircle className="w-5 h-5 text-green-600" />;
      case 'error':
        return <XCircle className="w-5 h-5 text-red-600" />;
      case 'warning':
        return <AlertTriangle className="w-5 h-5 text-yellow-600" />;
      default:
        return <Database className="w-5 h-5 text-gray-400" />;
    }
  };

  const testTelemetryForDevice = async (deviceId) => {
    try {
      console.log(`🧪 Testing telemetry for device: ${deviceId}`);
      
      const startTime = Date.now();
      
      // Test 1: Basic telemetry fetch
      const telemetryResult = await apiService.getDeviceTelemetry(deviceId, 0, 5);
      const fetchTime = Date.now() - startTime;
      
      // Test 2: Endpoint availability test
      const endpointResult = await apiService.testTelemetryEndpoint(deviceId);
      
      return {
        deviceId,
        status: 'success',
        telemetryData: telemetryResult,
        endpointTest: endpointResult,
        fetchTime,
        recordCount: telemetryResult.data ? telemetryResult.data.length : 0,
        message: `Successfully fetched ${telemetryResult.data ? telemetryResult.data.length : 0} records in ${fetchTime}ms`
      };
      
    } catch (error) {
      console.error(`❌ Telemetry test failed for device ${deviceId}:`, error);
      
      return {
        deviceId,
        status: 'error',
        error: error.message,
        message: `Failed: ${error.message}`
      };
    }
  };

  const runTelemetryDiagnostic = async () => {
    if (!selectedDevice) {
      alert('Please select a device to test');
      return;
    }

    setTesting(true);
    setResults({});

    try {
      console.log('🔍 Running telemetry diagnostic...');
      
      const result = await testTelemetryForDevice(selectedDevice);
      setResults({ [selectedDevice]: result });
      
      // Also test endpoint variations
      if (result.status === 'error') {
        console.log('🔍 Testing endpoint variations...');
        const endpointTest = await apiService.testTelemetryEndpoint(selectedDevice);
        setEndpointTest(endpointTest);
      }
      
    } catch (error) {
      console.error('❌ Diagnostic failed:', error);
      setResults({
        [selectedDevice]: {
          deviceId: selectedDevice,
          status: 'error',
          error: error.message,
          message: `Diagnostic failed: ${error.message}`
        }
      });
    } finally {
      setTesting(false);
    }
  };

  const testAllDevices = async () => {
    if (availableDevices.length === 0) {
      alert('No devices available to test');
      return;
    }

    setTesting(true);
    setResults({});

    try {
      console.log(`🔍 Testing telemetry for ${availableDevices.length} devices...`);
      
      // Test up to 5 devices to avoid overwhelming the API
      const devicesToTest = availableDevices.slice(0, 5);
      const testPromises = devicesToTest.map(device => 
        testTelemetryForDevice(device.device_id)
      );
      
      const testResults = await Promise.all(testPromises);
      
      const resultsMap = {};
      testResults.forEach(result => {
        resultsMap[result.deviceId] = result;
      });
      
      setResults(resultsMap);
      
    } catch (error) {
      console.error('❌ Bulk diagnostic failed:', error);
    } finally {
      setTesting(false);
    }
  };

  const createSampleTelemetry = async () => {
    if (!selectedDevice) {
      alert('Please select a device first');
      return;
    }

    try {
      console.log('📊 Creating sample telemetry data...');
      
      const sampleData = {
        device_id: selectedDevice,
        latitude: 28.6139 + (Math.random() - 0.5) * 0.001,
        longitude: 77.2090 + (Math.random() - 0.5) * 0.001,
        acceleration: Math.random() * 5,
        drowsiness: Math.random() > 0.8,
        rash_driving: Math.random() > 0.9,
        collision: false
      };
      
      const response = await apiService.createDeviceTelemetry(sampleData);
      
      if (response.success) {
        alert('Sample telemetry data created successfully!');
        // Re-test the device to see if it now has data
        await runTelemetryDiagnostic();
      } else {
        alert('Failed to create sample telemetry data');
      }
      
    } catch (error) {
      console.error('❌ Failed to create sample telemetry:', error);
      alert(`Failed to create sample telemetry: ${error.message}`);
    }
  };

  return (
    <div className="max-w-4xl p-6 mx-auto space-y-6">
      {/* Header */}
      <div className="p-6 bg-white rounded-lg shadow-md">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Telemetry Diagnostic Tool</h1>
            <p className="text-gray-600">Test and debug telemetry data fetching issues</p>
          </div>
          <Activity className="w-8 h-8 text-blue-600" />
        </div>

        {/* Device Selection */}
        <div className="mb-6">
          <label className="block mb-2 text-sm font-medium text-gray-700">
            Select Device to Test
          </label>
          <select
            value={selectedDevice}
            onChange={(e) => setSelectedDevice(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">-- Select a device --</option>
            {availableDevices.map(device => (
              <option key={device.device_id} value={device.device_id}>
                {device.device_name || `Device ${device.device_id}`} (ID: {device.device_id})
              </option>
            ))}
          </select>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-wrap gap-3">
          <button
            onClick={runTelemetryDiagnostic}
            disabled={testing || !selectedDevice}
            className="flex items-center gap-2 px-4 py-2 text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${testing ? 'animate-spin' : ''}`} />
            Test Selected Device
          </button>

          <button
            onClick={testAllDevices}
            disabled={testing || availableDevices.length === 0}
            className="flex items-center gap-2 px-4 py-2 text-white bg-green-600 rounded-lg hover:bg-green-700 disabled:opacity-50"
          >
            <Search className="w-4 h-4" />
            Test All Devices
          </button>

          <button
            onClick={createSampleTelemetry}
            disabled={testing || !selectedDevice}
            className="flex items-center gap-2 px-4 py-2 text-white bg-purple-600 rounded-lg hover:bg-purple-700 disabled:opacity-50"
          >
            <Play className="w-4 h-4" />
            Create Sample Data
          </button>
        </div>
      </div>

      {/* Device Information */}
      {availableDevices.length > 0 && (
        <div className="p-6 bg-white rounded-lg shadow-md">
          <h2 className="mb-4 text-xl font-semibold text-gray-900">Available Devices</h2>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
            {availableDevices.map(device => (
              <div 
                key={device.device_id} 
                className={`p-3 border rounded-lg ${selectedDevice === device.device_id ? 'border-blue-500 bg-blue-50' : 'border-gray-200'}`}
              >
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-medium">{device.device_name || `Device ${device.device_id}`}</h3>
                    <p className="text-sm text-gray-600">ID: {device.device_id}</p>
                    <p className="text-sm text-gray-600">Status: {device.status}</p>
                  </div>
                  <div className={`w-3 h-3 rounded-full ${device.status === 'Active' ? 'bg-green-500' : 'bg-gray-400'}`}></div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Test Results */}
      {Object.keys(results).length > 0 && (
        <div className="p-6 bg-white rounded-lg shadow-md">
          <h2 className="mb-4 text-xl font-semibold text-gray-900">Test Results</h2>
          
          <div className="space-y-4">
            {Object.values(results).map((result, index) => (
              <div 
                key={index} 
                className={`p-4 rounded-lg border ${
                  result.status === 'success' ? 'border-green-200 bg-green-50' :
                  result.status === 'error' ? 'border-red-200 bg-red-50' :
                  'border-yellow-200 bg-yellow-50'
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-3">
                    {getStatusIcon(result.status)}
                    <h3 className="font-medium">Device {result.deviceId}</h3>
                  </div>
                  {result.fetchTime && (
                    <span className="text-xs text-gray-500">{result.fetchTime}ms</span>
                  )}
                </div>
                
                <p className="mb-2 text-sm">{result.message}</p>
                
                {result.recordCount !== undefined && (
                  <p className="text-xs text-gray-600">Records found: {result.recordCount}</p>
                )}
                
                {result.error && (
                  <div className="p-2 mt-2 text-xs text-red-800 bg-red-100 rounded">
                    Error: {result.error}
                  </div>
                )}
                
                {result.telemetryData && result.telemetryData.data && (
                  <details className="mt-2">
                    <summary className="text-xs text-gray-600 cursor-pointer">Show sample data</summary>
                    <pre className="p-2 mt-1 overflow-x-auto text-xs bg-gray-100 rounded">
                      {JSON.stringify(result.telemetryData.data.slice(0, 2), null, 2)}
                    </pre>
                  </details>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Endpoint Test Results */}
      {endpointTest && (
        <div className="p-6 bg-white rounded-lg shadow-md">
          <h2 className="mb-4 text-xl font-semibold text-gray-900">Endpoint Test Results</h2>
          
          <div className={`p-4 rounded-lg border ${
            endpointTest.success ? 'border-green-200 bg-green-50' : 'border-red-200 bg-red-50'
          }`}>
            <div className="flex items-center gap-3 mb-2">
              {getStatusIcon(endpointTest.success ? 'success' : 'error')}
              <h3 className="font-medium">Endpoint Availability Test</h3>
            </div>
            
            <p className="mb-2 text-sm">{endpointTest.message}</p>
            
            {endpointTest.endpoint && (
              <p className="text-xs text-green-800">Working endpoint: {endpointTest.endpoint}</p>
            )}
            
            {endpointTest.testedEndpoints && (
              <details className="mt-2">
                <summary className="text-xs text-gray-600 cursor-pointer">Show tested endpoints</summary>
                <ul className="mt-1 text-xs text-gray-600 list-disc list-inside">
                  {endpointTest.testedEndpoints.map((endpoint, index) => (
                    <li key={index}>{endpoint}</li>
                  ))}
                </ul>
              </details>
            )}
          </div>
        </div>
      )}

      {/* Troubleshooting Guide */}
      <div className="p-6 bg-white rounded-lg shadow-md">
        <h2 className="mb-4 text-xl font-semibold text-gray-900">Troubleshooting Guide</h2>
        
        <div className="space-y-4">
          <div className="p-4 rounded-lg bg-red-50">
            <h3 className="mb-2 font-medium text-red-900">🔴 If Telemetry Fetch Fails:</h3>
            <ul className="space-y-1 text-sm text-red-800">
              <li>• Device may not have any telemetry data recorded</li>
              <li>• Telemetry endpoint might not exist or be disabled</li>
              <li>• Device ID might be invalid or device doesn't exist</li>
              <li>• Authentication token might not have telemetry permissions</li>
            </ul>
          </div>

          <div className="p-4 rounded-lg bg-yellow-50">
            <h3 className="mb-2 font-medium text-yellow-900">🟡 Common Solutions:</h3>
            <ul className="space-y-1 text-sm text-yellow-800">
              <li>• Use "Create Sample Data" to generate test telemetry</li>
              <li>• Check if the device is actively sending data</li>
              <li>• Verify device is assigned to a vehicle and is active</li>
              <li>• Contact API administrator to verify telemetry endpoints</li>
            </ul>
          </div>

          <div className="p-4 rounded-lg bg-blue-50">
            <h3 className="mb-2 font-medium text-blue-900">🔵 Expected API Endpoint:</h3>
            <p className="text-sm text-blue-800">
              <code>GET /device/v1/data/&#123;deviceId&#125;?page=0&size=20&sortBy=telemetryId&direction=desc</code>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default TelemetryDiagnostic;