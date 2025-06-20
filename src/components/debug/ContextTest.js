// src/components/debug/ContextTest.js - Simple version without hooks violations

import React, { useEffect, useState } from 'react';
import { CheckCircle, XCircle, AlertTriangle, RefreshCw } from 'lucide-react';
import { useData } from '../../contexts/DataContext';

const ContextTest = () => {
  const [testResults, setTestResults] = useState({});
  const [testing, setTesting] = useState(false);
  
  // ✅ FIXED: Always call the hook at the top level (no conditional calls)
  const contextData = useData();
  
  const runTests = async () => {
    setTesting(true);
    const results = {};
    
    // Test 1: Context Provider (check if we got data)
    results.contextProvider = {
      passed: !!contextData,
      message: contextData ? 'Context hook working' : 'Context hook failed',
      data: contextData ? 'Present' : 'Missing'
    };
    
    // Test 2: Data Structure
    results.dataStructure = {
      passed: !!(contextData?.data),
      message: contextData?.data ? 'Data object exists' : 'Data object missing',
      data: contextData?.data ? Object.keys(contextData.data) : []
    };
    
    // Test 3: Devices Array
    results.devicesArray = {
      passed: !!(contextData?.data?.devices && Array.isArray(contextData.data.devices)),
      message: `Devices: ${contextData?.data?.devices?.length || 0} items`,
      data: contextData?.data?.devices?.length || 0
    };
    
    // Test 4: Functions Available
    const availableFunctions = [];
    if (contextData?.fetchAllData) availableFunctions.push('fetchAllData');
    if (contextData?.refreshData) availableFunctions.push('refreshData');
    if (contextData?.getDeviceById) availableFunctions.push('getDeviceById');
    
    results.functions = {
      passed: availableFunctions.length > 0,
      message: `${availableFunctions.length} functions available`,
      data: availableFunctions
    };
    
    // Test 5: Manual API Call
    try {
      const token = localStorage.getItem('authToken');
      const response = await fetch('http://164.52.194.198:9090/device/v1/all?page=0&size=5', {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
      
      if (response.ok) {
        const apiData = await response.json();
        results.directAPI = {
          passed: true,
          message: `API returned ${apiData.data?.length || 0} devices`,
          data: apiData.data?.length || 0
        };
      } else {
        results.directAPI = {
          passed: false,
          message: `API failed: ${response.status}`,
          data: response.status
        };
      }
    } catch (apiError) {
      results.directAPI = {
        passed: false,
        message: `API error: ${apiError.message}`,
        data: null
      };
    }
    
    setTestResults(results);
    setTesting(false);
  };
  
  useEffect(() => {
    runTests();
  }, []);
  
  const getStatusIcon = (passed) => {
    if (passed === undefined) return <AlertTriangle className="w-4 h-4 text-yellow-500" />;
    return passed ? <CheckCircle className="w-4 h-4 text-green-500" /> : <XCircle className="w-4 h-4 text-red-500" />;
  };
  
  const getStatusColor = (passed) => {
    if (passed === undefined) return 'bg-yellow-50 border-yellow-200';
    return passed ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200';
  };
  
  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="p-4 bg-white rounded-lg shadow">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-900">Context Diagnostic</h2>
          <button
            onClick={runTests}
            disabled={testing}
            className="flex items-center gap-2 px-3 py-1 text-sm text-white bg-blue-600 rounded hover:bg-blue-700 disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${testing ? 'animate-spin' : ''}`} />
            {testing ? 'Testing...' : 'Run Tests'}
          </button>
        </div>
      </div>

      {/* Quick Status */}
      <div className="p-4 bg-white rounded-lg shadow">
        <h3 className="mb-3 font-medium text-gray-900">Quick Status</h3>
        <div className="grid grid-cols-2 gap-4 text-sm md:grid-cols-4">
          <div>
            <span className="font-medium">Context:</span>
            <span className={`ml-2 ${contextData ? 'text-green-600' : 'text-red-600'}`}>
              {contextData ? '✅ Working' : '❌ Failed'}
            </span>
          </div>
          <div>
            <span className="font-medium">Data:</span>
            <span className={`ml-2 ${contextData?.data ? 'text-green-600' : 'text-red-600'}`}>
              {contextData?.data ? '✅ Present' : '❌ Missing'}
            </span>
          </div>
          <div>
            <span className="font-medium">Devices:</span>
            <span className={`ml-2 ${contextData?.data?.devices?.length > 0 ? 'text-green-600' : 'text-red-600'}`}>
              {contextData?.data?.devices?.length || 0}
            </span>
          </div>
          <div>
            <span className="font-medium">Loading:</span>
            <span className={`ml-2 ${contextData?.loading ? 'text-yellow-600' : 'text-green-600'}`}>
              {contextData?.loading ? 'Yes' : 'No'}
            </span>
          </div>
        </div>
      </div>

      {/* Test Results */}
      {Object.keys(testResults).length > 0 && (
        <div className="space-y-3">
          {Object.entries(testResults).map(([testName, result]) => (
            <div key={testName} className={`border rounded-lg p-4 ${getStatusColor(result.passed)}`}>
              <div className="flex items-center gap-3 mb-2">
                {getStatusIcon(result.passed)}
                <h3 className="font-medium capitalize">{testName.replace(/([A-Z])/g, ' $1')}</h3>
              </div>
              
              <p className="mb-2 text-sm">{result.message}</p>
              
              {result.data && (
                <div className="text-xs">
                  <strong>Data:</strong> {JSON.stringify(result.data)}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Context Details */}
      {contextData && (
        <div className="p-4 bg-white rounded-lg shadow">
          <h3 className="mb-3 font-medium text-gray-900">Context Data Preview</h3>
          
          <div className="space-y-2 text-sm">
            <div>
              <strong>Loading:</strong> {contextData.loading ? 'Yes' : 'No'}
            </div>
            <div>
              <strong>Connection Status:</strong> {contextData.connectionStatus || 'Unknown'}
            </div>
            <div>
              <strong>Error:</strong> {contextData.error || 'None'}
            </div>
            <div>
              <strong>Last Update:</strong> {contextData.lastUpdate ? contextData.lastUpdate.toLocaleString() : 'Never'}
            </div>
            <div>
              <strong>Devices Count:</strong> {contextData.data?.devices?.length || 0}
            </div>
            <div>
              <strong>Vehicles Count:</strong> {contextData.data?.vehicles?.length || 0}
            </div>
          </div>

          {contextData.data?.devices?.length > 0 && (
            <details className="mt-3">
              <summary className="text-sm text-blue-600 cursor-pointer">Show Device Details</summary>
              <div className="p-3 mt-2 text-xs bg-gray-100 rounded">
                {contextData.data.devices.map((device, index) => (
                  <div key={index} className="p-2 mb-2 bg-white rounded">
                    <div><strong>Device {index + 1}:</strong></div>
                    <div>ID: {device.device_id}</div>
                    <div>Name: {device.device_name}</div>
                    <div>Status: {device.status}</div>
                    <div>Has Telemetry: {device.has_telemetry ? 'Yes' : 'No'}</div>
                  </div>
                ))}
              </div>
            </details>
          )}

          <details className="mt-3">
            <summary className="text-sm text-blue-600 cursor-pointer">Show Full Context Data</summary>
            <pre className="p-3 mt-2 overflow-auto text-xs bg-gray-100 rounded max-h-60">
              {JSON.stringify(contextData, null, 2)}
            </pre>
          </details>
        </div>
      )}

      {/* Recommendations */}
      <div className="p-4 bg-white rounded-lg shadow">
        <h3 className="mb-3 font-medium text-gray-900">Recommendations</h3>
        
        <div className="space-y-2 text-sm">
          {!contextData && (
            <div className="p-3 border border-red-200 rounded bg-red-50">
              <strong>❌ No Context Data:</strong> useData() hook is not returning data. Check if this component is wrapped in &lt;DataProvider&gt;
            </div>
          )}
          
          {contextData && !contextData.data && (
            <div className="p-3 border border-yellow-200 rounded bg-yellow-50">
              <strong>⚠️ No Data Object:</strong> Context exists but data property is missing. Check DataContext implementation.
            </div>
          )}
          
          {contextData?.data && !contextData.data.devices?.length && (
            <div className="p-3 border border-yellow-200 rounded bg-yellow-50">
              <strong>⚠️ No Devices:</strong> Context works but no device data. Check API connectivity and fetchAllData function.
            </div>
          )}
          
          {contextData?.data?.devices?.length > 0 && (
            <div className="p-3 border border-green-200 rounded bg-green-50">
              <strong>✅ Working Perfect:</strong> Context has {contextData.data.devices.length} devices. The issue is likely in DevicesPage component rendering.
            </div>
          )}

          {contextData?.loading && (
            <div className="p-3 border border-blue-200 rounded bg-blue-50">
              <strong>🔄 Still Loading:</strong> Data is being fetched. Wait a moment or check if fetchAllData is stuck.
            </div>
          )}
        </div>
      </div>

      {/* Debug Actions */}
      <div className="p-4 bg-white rounded-lg shadow">
        <h3 className="mb-3 font-medium text-gray-900">Debug Actions</h3>
        
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => {
              console.log('🔍 Full Context Data:', contextData);
            }}
            className="px-3 py-1 text-sm text-white bg-gray-600 rounded hover:bg-gray-700"
          >
            Log Context to Console
          </button>
          
          <button
            onClick={() => {
              if (contextData?.fetchAllData) {
                contextData.fetchAllData(false);
                console.log('🔄 Triggered fetchAllData');
              } else {
                console.log('❌ fetchAllData not available');
              }
            }}
            className="px-3 py-1 text-sm text-white bg-blue-600 rounded hover:bg-blue-700"
          >
            Trigger Fetch
          </button>
          
          <button
            onClick={() => {
              if (contextData?.refreshData) {
                contextData.refreshData();
                console.log('🔄 Triggered refreshData');
              } else {
                console.log('❌ refreshData not available');
              }
            }}
            className="px-3 py-1 text-sm text-white bg-green-600 rounded hover:bg-green-700"
          >
            Trigger Refresh
          </button>
        </div>
      </div>
    </div>
  );
};

export default ContextTest;