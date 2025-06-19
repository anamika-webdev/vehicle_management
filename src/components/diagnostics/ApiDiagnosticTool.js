import React, { useState, useEffect } from 'react';
import { AlertTriangle, CheckCircle, XCircle, RefreshCw, Wifi, WifiOff, Database } from 'lucide-react';

const ApiDiagnosticTool = () => {
  const [diagnostics, setDiagnostics] = useState({});
  const [isRunning, setIsRunning] = useState(false);
  const [lastRun, setLastRun] = useState(null);

  const API_BASE = 'http://164.52.194.198:9090';
  const WS_URL = 'ws://164.52.194.198:9091';

  const endpoints = [
    { name: 'Health Check', url: '/health', method: 'GET', critical: true },
    { name: 'Vehicles API', url: '/vehicle/v1/all?page=0&size=10', method: 'GET', critical: true },
    { name: 'Devices API', url: '/device/v1/all?page=0&size=10', method: 'GET', critical: true },
    { name: 'Alarms API', url: '/alarm/v1/manager/all?page=0&size=10', method: 'GET', critical: false },
    { name: 'Telemetry (Device 1)', url: '/device/v1/data/1?direction=desc&size=1', method: 'GET', critical: true },
    { name: 'Alternative Telemetry', url: '/device/v1/data/1', method: 'GET', critical: false },
    { name: 'Legacy Telemetry', url: '/deviceTelemetry/v1/device/1?page=0&size=1', method: 'GET', critical: false }
  ];

  const testEndpoint = async (endpoint) => {
    const startTime = Date.now();
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000); // 10s timeout

      const response = await fetch(`${API_BASE}${endpoint.url}`, {
        method: endpoint.method,
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json'
        },
        signal: controller.signal
      });

      clearTimeout(timeoutId);
      const endTime = Date.now();
      const responseTime = endTime - startTime;

      let data = null;
      let error = null;

      try {
        const text = await response.text();
        if (text) {
          data = JSON.parse(text);
        }
      } catch (parseError) {
        error = `JSON Parse Error: ${parseError.message}`;
      }

      return {
        status: response.status,
        ok: response.ok,
        statusText: response.statusText,
        responseTime,
        data,
        error,
        headers: Object.fromEntries(response.headers.entries())
      };
    } catch (error) {
      const endTime = Date.now();
      return {
        status: 0,
        ok: false,
        statusText: 'Network Error',
        responseTime: endTime - startTime,
        data: null,
        error: error.message,
        headers: {}
      };
    }
  };

  const testWebSocket = () => {
    return new Promise((resolve) => {
      const startTime = Date.now();
      try {
        const ws = new WebSocket(WS_URL);
        
        const timeout = setTimeout(() => {
          ws.close();
          resolve({
            status: 'timeout',
            error: 'Connection timeout after 5 seconds',
            responseTime: 5000
          });
        }, 5000);

        ws.onopen = () => {
          clearTimeout(timeout);
          const responseTime = Date.now() - startTime;
          ws.close();
          resolve({
            status: 'connected',
            error: null,
            responseTime
          });
        };

        ws.onerror = (error) => {
          clearTimeout(timeout);
          const responseTime = Date.now() - startTime;
          resolve({
            status: 'error',
            error: 'WebSocket connection failed',
            responseTime
          });
        };

        ws.onclose = (event) => {
          clearTimeout(timeout);
          const responseTime = Date.now() - startTime;
          if (event.code !== 1000) { // Normal closure
            resolve({
              status: 'closed',
              error: `Connection closed with code: ${event.code}`,
              responseTime
            });
          }
        };
      } catch (error) {
        resolve({
          status: 'error',
          error: error.message,
          responseTime: Date.now() - startTime
        });
      }
    });
  };

  const runDiagnostics = async () => {
    setIsRunning(true);
    const results = {};

    // Test WebSocket first
    console.log('Testing WebSocket connection...');
    results.websocket = await testWebSocket();

    // Test API endpoints
    for (const endpoint of endpoints) {
      console.log(`Testing ${endpoint.name}...`);
      results[endpoint.name] = await testEndpoint(endpoint);
      
      // Add small delay to avoid overwhelming the server
      await new Promise(resolve => setTimeout(resolve, 500));
    }

    setDiagnostics(results);
    setLastRun(new Date());
    setIsRunning(false);
  };

  const getStatusIcon = (result) => {
    if (!result) return <RefreshCw className="w-5 h-5 text-gray-400" />;
    
    if (result.ok || result.status === 'connected') {
      return <CheckCircle className="w-5 h-5 text-green-500" />;
    } else {
      return <XCircle className="w-5 h-5 text-red-500" />;
    }
  };

  const getStatusColor = (result) => {
    if (!result) return 'border-gray-200 bg-gray-50';
    
    if (result.ok || result.status === 'connected') {
      return 'border-green-200 bg-green-50';
    } else {
      return 'border-red-200 bg-red-50';
    }
  };

  const formatResponseTime = (ms) => {
    if (ms < 1000) return `${ms}ms`;
    return `${(ms / 1000).toFixed(1)}s`;
  };

  useEffect(() => {
    // Run initial diagnostics
    runDiagnostics();
  }, []);

  return (
    <div className="max-w-6xl p-6 mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">API Diagnostic Tool</h1>
          <p className="text-gray-600">Troubleshoot API connectivity and journey tracking issues</p>
        </div>
        <button
          onClick={runDiagnostics}
          disabled={isRunning}
          className="flex items-center gap-2 px-4 py-2 text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50"
        >
          <RefreshCw className={`w-4 h-4 ${isRunning ? 'animate-spin' : ''}`} />
          {isRunning ? 'Running...' : 'Run Diagnostics'}
        </button>
      </div>

      {lastRun && (
        <div className="text-sm text-gray-500">
          Last run: {lastRun.toLocaleString()}
        </div>
      )}

      {/* Summary Card */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
        {Object.entries(diagnostics).map(([key, result]) => {
          const isHealthy = result?.ok || result?.status === 'connected';
          return (
            <div key={key} className={`p-4 rounded-lg border ${getStatusColor(result)}`}>
              <div className="flex items-center gap-2">
                {getStatusIcon(result)}
                <span className="text-sm font-medium">{key}</span>
              </div>
              <div className="mt-2 text-xs text-gray-600">
                {result?.responseTime && `${formatResponseTime(result.responseTime)}`}
                {result?.status && key === 'websocket' && ` (${result.status})`}
                {result?.status && key !== 'websocket' && ` (${result.status})`}
              </div>
            </div>
          );
        })}
      </div>

      {/* Detailed Results */}
      <div className="space-y-4">
        <h2 className="text-xl font-semibold text-gray-900">Detailed Results</h2>

        {/* WebSocket Result */}
        {diagnostics.websocket && (
          <div className={`p-4 rounded-lg border ${getStatusColor(diagnostics.websocket)}`}>
            <div className="flex items-center gap-2 mb-2">
              <Wifi className="w-5 h-5" />
              <h3 className="font-medium">WebSocket Connection</h3>
              {getStatusIcon(diagnostics.websocket)}
            </div>
            <div className="grid grid-cols-1 gap-4 text-sm md:grid-cols-3">
              <div>
                <span className="text-gray-600">URL:</span>
                <div className="font-mono text-xs">{WS_URL}</div>
              </div>
              <div>
                <span className="text-gray-600">Status:</span>
                <div className="font-medium">{diagnostics.websocket.status}</div>
              </div>
              <div>
                <span className="text-gray-600">Response Time:</span>
                <div>{formatResponseTime(diagnostics.websocket.responseTime)}</div>
              </div>
            </div>
            {diagnostics.websocket.error && (
              <div className="p-2 mt-2 text-sm text-red-800 bg-red-100 rounded">
                <strong>Error:</strong> {diagnostics.websocket.error}
              </div>
            )}
          </div>
        )}

        {/* API Endpoints */}
        {endpoints.map((endpoint) => {
          const result = diagnostics[endpoint.name];
          if (!result) return null;

          return (
            <div key={endpoint.name} className={`p-4 rounded-lg border ${getStatusColor(result)}`}>
              <div className="flex items-center gap-2 mb-2">
                <Database className="w-5 h-5" />
                <h3 className="font-medium">{endpoint.name}</h3>
                {getStatusIcon(result)}
                {endpoint.critical && (
                  <span className="px-2 py-1 text-xs text-orange-800 bg-orange-100 rounded">
                    Critical
                  </span>
                )}
              </div>
              
              <div className="grid grid-cols-1 gap-4 text-sm md:grid-cols-4">
                <div>
                  <span className="text-gray-600">URL:</span>
                  <div className="font-mono text-xs">{API_BASE}{endpoint.url}</div>
                </div>
                <div>
                  <span className="text-gray-600">Status:</span>
                  <div className="font-medium">{result.status} {result.statusText}</div>
                </div>
                <div>
                  <span className="text-gray-600">Response Time:</span>
                  <div>{formatResponseTime(result.responseTime)}</div>
                </div>
                <div>
                  <span className="text-gray-600">Data Received:</span>
                  <div>{result.data ? 'Yes' : 'No'}</div>
                </div>
              </div>

              {result.error && (
                <div className="p-2 mt-2 text-sm text-red-800 bg-red-100 rounded">
                  <strong>Error:</strong> {result.error}
                </div>
              )}

              {result.data && (
                <div className="mt-2">
                  <details className="text-sm">
                    <summary className="text-gray-600 cursor-pointer hover:text-gray-800">
                      View Response Data
                    </summary>
                    <pre className="p-2 mt-2 overflow-x-auto text-xs bg-gray-100 rounded">
                      {JSON.stringify(result.data, null, 2)}
                    </pre>
                  </details>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Recommendations */}
      <div className="p-4 border border-blue-200 rounded-lg bg-blue-50">
        <h3 className="mb-2 font-medium text-blue-900">Troubleshooting Recommendations</h3>
        <div className="space-y-2 text-sm text-blue-800">
          {diagnostics.websocket?.status !== 'connected' && (
            <div className="flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 mt-0.5 text-orange-500" />
              <div>
                <strong>WebSocket Issue:</strong> Real-time updates won't work. Journey tracking will fall back to periodic polling.
              </div>
            </div>
          )}
          
          {Object.entries(diagnostics).some(([key, result]) => key !== 'websocket' && !result.ok) && (
            <div className="flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 mt-0.5 text-orange-500" />
              <div>
                <strong>API Issues:</strong> Some endpoints are failing. The system will use fallback mechanisms and cached data.
              </div>
            </div>
          )}

          {diagnostics['Telemetry (Device 1)']?.status === 500 && (
            <div className="flex items-start gap-2">
              <XCircle className="w-4 h-4 mt-0.5 text-red-500" />
              <div>
                <strong>Telemetry 500 Error:</strong> The primary telemetry endpoint is failing. Check server logs and try alternative endpoints.
              </div>
            </div>
          )}

          <div className="flex items-start gap-2">
            <CheckCircle className="w-4 h-4 mt-0.5 text-green-500" />
            <div>
              <strong>Enhanced Tracking:</strong> The new enhanced route tracking service includes fallback mechanisms to continue recording even when APIs fail.
            </div>
          </div>
        </div>
      </div>

      {/* Implementation Instructions */}
      <div className="p-4 border border-gray-200 rounded-lg bg-gray-50">
        <h3 className="mb-2 font-medium text-gray-900">Next Steps</h3>
        <div className="space-y-2 text-sm text-gray-700">
          <p><strong>1. Replace your existing route tracking service</strong> with the enhanced version above.</p>
          <p><strong>2. The enhanced service includes:</strong></p>
          <ul className="ml-6 space-y-1 list-disc">
            <li>Multiple data source fallbacks (telemetry → device → vehicle → geolocation → cached → default)</li>
            <li>Automatic retry logic with exponential backoff</li>
            <li>Health checking and fallback mode detection</li>
            <li>Enhanced journey data with reliability metrics</li>
            <li>Improved export formats with data source information</li>
          </ul>
          <p><strong>3. Import and use:</strong></p>
          <pre className="p-2 mt-2 text-xs bg-gray-100 rounded">
{`import enhancedRouteTrackingService from './services/enhancedRouteTrackingService';

// Start enhanced journey tracking
const journey = await enhancedRouteTrackingService.startJourneyTracking(vehicleId, managerId);

// Check system status
const status = enhancedRouteTrackingService.getSystemStatus();`}
          </pre>
        </div>
      </div>
    </div>
  );
};

export default ApiDiagnosticTool;