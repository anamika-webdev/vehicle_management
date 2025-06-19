// Complete API Connection Diagnostic Component
// src/components/debug/ApiConnectionDiagnostic.js

import React, { useState, useEffect } from 'react';
import { 
  CheckCircle, XCircle, AlertTriangle, RefreshCw, 
  Wifi, WifiOff, Server, Database, Shield, Clock,
  Copy, Eye, Play, Settings
} from 'lucide-react';
import apiService from '../../services/api';

const ApiConnectionDiagnostic = () => {
  const [diagnostics, setDiagnostics] = useState({
    connection: { status: 'pending', message: 'Not tested', latency: null },
    health: { status: 'pending', message: 'Not tested' },
    auth: { status: 'pending', message: 'Not tested' },
    endpoints: { status: 'pending', message: 'Not tested', details: {} },
    token: { status: 'pending', message: 'Not tested', valid: false }
  });
  
  const [testing, setTesting] = useState(false);
  const [selectedEndpoint, setSelectedEndpoint] = useState(null);
  const [showRawResponse, setShowRawResponse] = useState(false);
  const [testResults, setTestResults] = useState([]);

  // Test configuration
  const testEndpoints = [
    { name: 'Health Check', endpoint: '/health', method: 'GET', requiresAuth: false },
    { name: 'Status Check', endpoint: '/status', method: 'GET', requiresAuth: false },
    { name: 'Root Endpoint', endpoint: '/', method: 'GET', requiresAuth: false },
    { name: 'Login Endpoint', endpoint: '/auth/v1/login', method: 'POST', requiresAuth: false, 
      body: { email: 'test@test.com', password: 'test123' } },
    { name: 'Vehicles API', endpoint: '/vehicle/v1/all', method: 'GET', requiresAuth: true },
    { name: 'Devices API', endpoint: '/device/v1/all', method: 'GET', requiresAuth: true },
    { name: 'Alarms API', endpoint: '/alarm/v1/manager/all', method: 'GET', requiresAuth: true }
  ];

  const getStatusIcon = (status) => {
    switch (status) {
      case 'success':
        return <CheckCircle className="w-5 h-5 text-green-600" />;
      case 'warning':
        return <AlertTriangle className="w-5 h-5 text-yellow-600" />;
      case 'error':
        return <XCircle className="w-5 h-5 text-red-600" />;
      case 'pending':
        return <Clock className="w-5 h-5 text-gray-400" />;
      default:
        return <RefreshCw className="w-5 h-5 text-blue-400 animate-spin" />;
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'success':
        return 'text-green-800 bg-green-100 border-green-200';
      case 'warning':
        return 'text-yellow-800 bg-yellow-100 border-yellow-200';
      case 'error':
        return 'text-red-800 bg-red-100 border-red-200';
      default:
        return 'text-gray-800 bg-gray-100 border-gray-200';
    }
  };

  // Test basic network connectivity
  const testConnection = async () => {
    const startTime = Date.now();
    try {
      console.log('🔍 Testing basic network connectivity...');
      
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000);
      
      const response = await fetch('http://164.52.194.198:9090', {
        method: 'GET',
        mode: 'cors',
        signal: controller.signal,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Request-Method': 'GET',
          'Access-Control-Request-Headers': 'Content-Type'
        }
      });
      
      clearTimeout(timeoutId);
      const latency = Date.now() - startTime;
      
      console.log(`📡 Connection response: ${response.status} ${response.statusText}`);
      
      if (response.ok || response.status === 404 || response.status === 405) {
        return {
          status: 'success',
          message: `Server is reachable (${response.status})`,
          latency
        };
      } else {
        return {
          status: 'warning', 
          message: `Server responded with ${response.status}: ${response.statusText}`,
          latency
        };
      }
      
    } catch (error) {
      const latency = Date.now() - startTime;
      console.error('❌ Connection test failed:', error);
      
      if (error.name === 'AbortError') {
        return {
          status: 'error',
          message: 'Connection timeout (>10s) - Server unreachable',
          latency
        };
      } else if (error.message.includes('CORS')) {
        return {
          status: 'warning',
          message: 'CORS policy blocking request - Server may be reachable',
          latency
        };
      } else if (error.message.includes('Failed to fetch')) {
        return {
          status: 'error',
          message: 'Network error - Check firewall/DNS/connection',
          latency
        };
      } else {
        return {
          status: 'error',
          message: `Connection failed: ${error.message}`,
          latency
        };
      }
    }
  };

  // Test specific health endpoints
  const testHealthEndpoints = async () => {
    const healthEndpoints = ['/health', '/status', '/ping', '/api/health'];
    const results = {};
    
    for (const endpoint of healthEndpoints) {
      try {
        console.log(`🏥 Testing health endpoint: ${endpoint}`);
        
        const response = await fetch(`http://164.52.194.198:9090${endpoint}`, {
          method: 'GET',
          headers: { 'Content-Type': 'application/json' }
        });
        
        if (response.ok) {
          const data = await response.text();
          results[endpoint] = { status: 'success', data: data.substring(0, 100) };
          console.log(`✅ Health endpoint ${endpoint} working`);
          
          return {
            status: 'success',
            message: `Health endpoint found: ${endpoint}`,
            details: results
          };
        } else {
          results[endpoint] = { status: 'error', data: `HTTP ${response.status}` };
        }
      } catch (error) {
        results[endpoint] = { status: 'error', data: error.message };
        console.warn(`❌ Health endpoint ${endpoint} failed:`, error.message);
      }
    }
    
    return {
      status: 'error',
      message: 'No working health endpoints found',
      details: results
    };
  };

  // Test authentication status
  const testAuthenticationStatus = async () => {
    try {
      const token = localStorage.getItem('authToken');
      
      if (!token) {
        return {
          status: 'warning',
          message: 'No authentication token found',
          valid: false
        };
      }
      
      // Try to decode JWT token
      try {
        const tokenParts = token.split('.');
        if (tokenParts.length === 3) {
          const payload = JSON.parse(atob(tokenParts[1]));
          const currentTime = Date.now() / 1000;
          
          if (payload.exp && payload.exp < currentTime) {
            return {
              status: 'error',
              message: 'Authentication token has expired',
              valid: false
            };
          } else {
            return {
              status: 'success',
              message: `Token valid, expires: ${new Date(payload.exp * 1000).toLocaleString()}`,
              valid: true
            };
          }
        }
      } catch (decodeError) {
        console.warn('Could not decode JWT token:', decodeError);
      }
      
      return {
        status: 'success',
        message: 'Authentication token present',
        valid: true
      };
      
    } catch (error) {
      return {
        status: 'error',
        message: `Auth check failed: ${error.message}`,
        valid: false
      };
    }
  };

  // Test individual API endpoints
  const testApiEndpoints = async () => {
    const results = {};
    
    for (const test of testEndpoints) {
      try {
        console.log(`🧪 Testing ${test.name}: ${test.method} ${test.endpoint}`);
        
        const options = {
          method: test.method,
          headers: {
            'Content-Type': 'application/json',
            ...(test.requiresAuth && apiService.token && {
              'Authorization': `Bearer ${apiService.token}`
            })
          }
        };
        
        if (test.body) {
          options.body = JSON.stringify(test.body);
        }
        
        const response = await fetch(`http://164.52.194.198:9090${test.endpoint}`, options);
        
        let responseData = null;
        try {
          responseData = await response.text();
          if (responseData) {
            responseData = JSON.parse(responseData);
          }
        } catch (parseError) {
          // Response is not JSON, keep as text
        }
        
        results[test.name] = {
          status: response.ok ? 'success' : 'warning',
          code: response.status,
          message: response.statusText,
          data: responseData,
          requiresAuth: test.requiresAuth
        };
        
        console.log(`📊 ${test.name} result: ${response.status} ${response.statusText}`);
        
      } catch (error) {
        results[test.name] = {
          status: 'error',
          code: 0,
          message: error.message,
          data: null,
          requiresAuth: test.requiresAuth
        };
        console.error(`❌ ${test.name} failed:`, error);
      }
    }
    
    const successCount = Object.values(results).filter(r => r.status === 'success').length;
    const totalCount = Object.keys(results).length;
    
    return {
      status: successCount > 0 ? 'success' : 'error',
      message: `${successCount}/${totalCount} endpoints responding`,
      details: results
    };
  };

  // Run comprehensive diagnostics
  const runFullDiagnostic = async () => {
    setTesting(true);
    setTestResults([]);
    
    const results = [];
    
    try {
      // Test 1: Basic connectivity
      results.push({ name: 'Connection Test', ...await testConnection() });
      
      // Test 2: Health endpoints
      results.push({ name: 'Health Check', ...await testHealthEndpoints() });
      
      // Test 3: Authentication
      results.push({ name: 'Authentication', ...await testAuthenticationStatus() });
      
      // Test 4: API endpoints
      results.push({ name: 'API Endpoints', ...await testApiEndpoints() });
      
      setTestResults(results);
      
      // Update main diagnostics state
      setDiagnostics({
        connection: results[0],
        health: results[1],
        auth: results[2],
        endpoints: results[3],
        token: results[2]
      });
      
    } catch (error) {
      console.error('❌ Diagnostic failed:', error);
      results.push({
        name: 'Diagnostic Error',
        status: 'error',
        message: error.message
      });
      setTestResults(results);
    } finally {
      setTesting(false);
    }
  };

  // Copy diagnostic info to clipboard
  const copyDiagnosticInfo = () => {
    const info = {
      timestamp: new Date().toISOString(),
      apiUrl: 'http://164.52.194.198:9090',
      userAgent: navigator.userAgent,
      token: localStorage.getItem('authToken') ? 'Present' : 'Missing',
      results: testResults
    };
    
    navigator.clipboard.writeText(JSON.stringify(info, null, 2));
    alert('Diagnostic information copied to clipboard!');
  };

  // Auto-run diagnostics on component mount
  useEffect(() => {
    runFullDiagnostic();
  }, []);

  return (
    <div className="max-w-4xl p-6 mx-auto space-y-6">
      {/* Header */}
      <div className="p-6 bg-white rounded-lg shadow-md">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">API Connection Diagnostics</h1>
            <p className="text-gray-600">Testing connection to: http://164.52.194.198:9090</p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={runFullDiagnostic}
              disabled={testing}
              className="flex items-center gap-2 px-4 py-2 text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50"
            >
              <RefreshCw className={`w-4 h-4 ${testing ? 'animate-spin' : ''}`} />
              {testing ? 'Testing...' : 'Run Diagnostics'}
            </button>
            <button
              onClick={copyDiagnosticInfo}
              className="flex items-center gap-2 px-4 py-2 text-white bg-gray-600 rounded-lg hover:bg-gray-700"
            >
              <Copy className="w-4 h-4" />
              Copy Info
            </button>
          </div>
        </div>

        {/* Quick Status */}
        <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
          <div className={`p-3 rounded-lg border ${getStatusColor(diagnostics.connection.status)}`}>
            <div className="flex items-center gap-2">
              {getStatusIcon(diagnostics.connection.status)}
              <span className="font-medium">Connection</span>
            </div>
            <p className="mt-1 text-xs">{diagnostics.connection.message}</p>
            {diagnostics.connection.latency && (
              <p className="mt-1 text-xs">Latency: {diagnostics.connection.latency}ms</p>
            )}
          </div>

          <div className={`p-3 rounded-lg border ${getStatusColor(diagnostics.health.status)}`}>
            <div className="flex items-center gap-2">
              {getStatusIcon(diagnostics.health.status)}
              <span className="font-medium">Health</span>
            </div>
            <p className="mt-1 text-xs">{diagnostics.health.message}</p>
          </div>

          <div className={`p-3 rounded-lg border ${getStatusColor(diagnostics.auth.status)}`}>
            <div className="flex items-center gap-2">
              {getStatusIcon(diagnostics.auth.status)}
              <span className="font-medium">Auth</span>
            </div>
            <p className="mt-1 text-xs">{diagnostics.auth.message}</p>
          </div>

          <div className={`p-3 rounded-lg border ${getStatusColor(diagnostics.endpoints.status)}`}>
            <div className="flex items-center gap-2">
              {getStatusIcon(diagnostics.endpoints.status)}
              <span className="font-medium">Endpoints</span>
            </div>
            <p className="mt-1 text-xs">{diagnostics.endpoints.message}</p>
          </div>
        </div>
      </div>

      {/* Detailed Results */}
      {testResults.length > 0 && (
        <div className="p-6 bg-white rounded-lg shadow-md">
          <h2 className="mb-4 text-xl font-semibold text-gray-900">Detailed Test Results</h2>
          
          <div className="space-y-4">
            {testResults.map((result, index) => (
              <div key={index} className={`p-4 rounded-lg border ${getStatusColor(result.status)}`}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    {getStatusIcon(result.status)}
                    <div>
                      <h3 className="font-medium">{result.name}</h3>
                      <p className="text-sm">{result.message}</p>
                    </div>
                  </div>
                  
                  {result.details && (
                    <button
                      onClick={() => setSelectedEndpoint(selectedEndpoint === index ? null : index)}
                      className="flex items-center gap-1 px-3 py-1 text-sm bg-white bg-opacity-50 rounded hover:bg-opacity-70"
                    >
                      <Eye className="w-4 h-4" />
                      Details
                    </button>
                  )}
                </div>
                
                {selectedEndpoint === index && result.details && (
                  <div className="p-3 mt-4 bg-white bg-opacity-50 rounded">
                    <pre className="overflow-x-auto text-xs">
                      {JSON.stringify(result.details, null, 2)}
                    </pre>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Troubleshooting Guide */}
      <div className="p-6 bg-white rounded-lg shadow-md">
        <h2 className="mb-4 text-xl font-semibold text-gray-900">Troubleshooting Guide</h2>
        
        <div className="space-y-4">
          <div className="p-4 rounded-lg bg-red-50">
            <h3 className="mb-2 font-medium text-red-900">🔴 If Connection Fails:</h3>
            <ul className="space-y-1 text-sm text-red-800">
              <li>• Check if you're on a corporate network with firewall restrictions</li>
              <li>• Try using mobile hotspot or different network</li>
              <li>• Verify the server IP: 164.52.194.198:9090 is correct</li>
              <li>• Contact your network administrator</li>
            </ul>
          </div>

          <div className="p-4 rounded-lg bg-yellow-50">
            <h3 className="mb-2 font-medium text-yellow-900">🟡 If CORS Errors:</h3>
            <ul className="space-y-1 text-sm text-yellow-800">
              <li>• Add REACT_APP_USE_CORS_PROXY=true to .env file</li>
              <li>• Contact backend developer to enable CORS</li>
              <li>• Use browser with disabled web security (development only)</li>
            </ul>
          </div>

          <div className="p-4 rounded-lg bg-blue-50">
            <h3 className="mb-2 font-medium text-blue-900">🔵 If Auth Issues:</h3>
            <ul className="space-y-1 text-sm text-blue-800">
              <li>• Clear browser localStorage and login again</li>
              <li>• Check if your account exists on the server</li>
              <li>• Verify email and password are correct</li>
            </ul>
          </div>

          <div className="p-4 rounded-lg bg-green-50">
            <h3 className="mb-2 font-medium text-green-900">✅ If Some Endpoints Work:</h3>
            <ul className="space-y-1 text-sm text-green-800">
              <li>• Server is reachable but some endpoints may be down</li>
              <li>• Check if you have proper authentication for protected endpoints</li>
              <li>• Refresh your authentication token</li>
            </ul>
          </div>
        </div>
      </div>

      {/* Quick Fixes */}
      <div className="p-6 bg-white rounded-lg shadow-md">
        <h2 className="mb-4 text-xl font-semibold text-gray-900">Quick Fixes</h2>
        
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <button
            onClick={() => {
              localStorage.clear();
              window.location.reload();
            }}
            className="flex items-center gap-2 p-3 text-left border border-gray-300 rounded-lg hover:bg-gray-50"
          >
            <RefreshCw className="w-5 h-5 text-blue-600" />
            <div>
              <h3 className="font-medium">Clear Data & Reload</h3>
              <p className="text-sm text-gray-600">Clear all stored data and refresh</p>
            </div>
          </button>

          <button
            onClick={() => {
              const newWindow = window.open('http://164.52.194.198:9090/health', '_blank');
              if (newWindow) newWindow.focus();
            }}
            className="flex items-center gap-2 p-3 text-left border border-gray-300 rounded-lg hover:bg-gray-50"
          >
            <Server className="w-5 h-5 text-green-600" />
            <div>
              <h3 className="font-medium">Test Server Directly</h3>
              <p className="text-sm text-gray-600">Open API URL in new tab</p>
            </div>
          </button>
        </div>
      </div>
    </div>
  );
};

export default ApiConnectionDiagnostic;