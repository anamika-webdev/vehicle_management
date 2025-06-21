import React, { useState, useEffect } from 'react';
import { AlertTriangle, RefreshCw, CheckCircle, XCircle, Info } from 'lucide-react';

const ErrorDiagnostic = () => {
  const [errors, setErrors] = useState([]);
  const [consoleErrors, setConsoleErrors] = useState([]);
  const [componentStatus, setComponentStatus] = useState({});

  useEffect(() => {
    // Capture console errors
    const originalError = console.error;
    console.error = (...args) => {
      setConsoleErrors(prev => [...prev, {
        timestamp: new Date().toISOString(),
        message: args.join(' '),
        stack: new Error().stack
      }]);
      originalError.apply(console, args);
    };

    // Capture unhandled errors
    const handleError = (event) => {
      setErrors(prev => [...prev, {
        timestamp: new Date().toISOString(),
        message: event.error?.message || event.message || 'Unknown error',
        filename: event.filename,
        lineno: event.lineno,
        colno: event.colno,
        stack: event.error?.stack
      }]);
    };

    // Capture unhandled promise rejections
    const handleRejection = (event) => {
      setErrors(prev => [...prev, {
        timestamp: new Date().toISOString(),
        message: `Unhandled Promise Rejection: ${event.reason}`,
        type: 'promise_rejection'
      }]);
    };

    window.addEventListener('error', handleError);
    window.addEventListener('unhandledrejection', handleRejection);

    return () => {
      console.error = originalError;
      window.removeEventListener('error', handleError);
      window.removeEventListener('unhandledrejection', handleRejection);
    };
  }, []);

  // Test various component imports
  useEffect(() => {
    const testComponents = async () => {
      const tests = [
        {
          name: 'React',
          test: () => typeof React !== 'undefined'
        },
        {
          name: 'DataContext',
          test: async () => {
            try {
              const { useData } = await import('../../contexts/DataContext');
              return typeof useData === 'function';
            } catch (error) {
              throw new Error(`DataContext import failed: ${error.message}`);
            }
          }
        },
        {
          name: 'API Service',
          test: async () => {
            try {
              const apiService = await import('../../services/api');
              return typeof apiService.default === 'object';
            } catch (error) {
              throw new Error(`API Service import failed: ${error.message}`);
            }
          }
        },
        {
          name: 'Enhanced Route Tracking',
          test: async () => {
            try {
              const service = await import('../../services/enhancedRouteTrackingService');
              return typeof service.default === 'object';
            } catch (error) {
              throw new Error(`Enhanced Route Tracking import failed: ${error.message}`);
            }
          }
        },
        {
          name: 'Route Tracking Service',
          test: async () => {
            try {
              const service = await import('../../services/enhancedRouteTrackingService');
              return typeof service.default === 'object';
            } catch (error) {
              throw new Error(`Route Tracking Service import failed: ${error.message}`);
            }
          }
        },
        {
          name: 'Notifications',
          test: async () => {
            try {
              const { useNotification } = await import('../../contexts/NotificationContext.js.backup');
              return typeof useNotification === 'function';
            } catch (error) {
              throw new Error(`NotificationContext import failed: ${error.message}`);
            }
          }
        }
      ];

      const results = {};
      
      for (const test of tests) {
        try {
          const result = await test.test();
          results[test.name] = {
            status: result ? 'success' : 'failed',
            message: result ? 'OK' : 'Test returned false'
          };
        } catch (error) {
          results[test.name] = {
            status: 'error',
            message: error.message
          };
        }
      }

      setComponentStatus(results);
    };

    testComponents();
  }, []);

  const clearErrors = () => {
    setErrors([]);
    setConsoleErrors([]);
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case 'success': return <CheckCircle className="w-4 h-4 text-green-500" />;
      case 'error': return <XCircle className="w-4 h-4 text-red-500" />;
      case 'failed': return <AlertTriangle className="w-4 h-4 text-yellow-500" />;
      default: return <Info className="w-4 h-4 text-gray-500" />;
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'success': return 'border-green-200 bg-green-50';
      case 'error': return 'border-red-200 bg-red-50';
      case 'failed': return 'border-yellow-200 bg-yellow-50';
      default: return 'border-gray-200 bg-gray-50';
    }
  };

  return (
    <div className="max-w-6xl p-6 mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Error Diagnostic Tool</h1>
          <p className="text-gray-600">Diagnose script errors and component issues</p>
        </div>
        <button
          onClick={clearErrors}
          className="flex items-center gap-2 px-4 py-2 text-white bg-blue-600 rounded-lg hover:bg-blue-700"
        >
          <RefreshCw className="w-4 h-4" />
          Clear Errors
        </button>
      </div>

      {/* Component Status */}
      <div className="bg-white rounded-lg shadow">
        <div className="p-4 border-b">
          <h2 className="text-lg font-medium text-gray-900">Component Import Status</h2>
        </div>
        <div className="p-4">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
            {Object.entries(componentStatus).map(([name, status]) => (
              <div key={name} className={`p-3 rounded-lg border ${getStatusColor(status.status)}`}>
                <div className="flex items-center gap-2 mb-1">
                  {getStatusIcon(status.status)}
                  <span className="font-medium">{name}</span>
                </div>
                <p className="text-sm text-gray-600">{status.message}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* JavaScript Errors */}
      <div className="bg-white rounded-lg shadow">
        <div className="p-4 border-b">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-medium text-gray-900">JavaScript Errors</h2>
            <span className="px-2 py-1 text-sm text-red-800 bg-red-100 rounded">
              {errors.length} errors
            </span>
          </div>
        </div>
        <div className="overflow-y-auto max-h-96">
          {errors.length === 0 ? (
            <div className="p-8 text-center text-gray-500">
              <CheckCircle className="w-12 h-12 mx-auto mb-3 text-green-300" />
              <p>No JavaScript errors detected</p>
            </div>
          ) : (
            <div className="divide-y">
              {errors.map((error, index) => (
                <div key={index} className="p-4 hover:bg-gray-50">
                  <div className="flex items-start gap-2">
                    <XCircle className="w-5 h-5 text-red-500 mt-0.5 flex-shrink-0" />
                    <div className="flex-1">
                      <div className="font-medium text-red-900">{error.message}</div>
                      <div className="mt-1 text-sm text-gray-600">
                        <span className="font-mono">{new Date(error.timestamp).toLocaleTimeString()}</span>
                        {error.filename && (
                          <span className="ml-2">
                            {error.filename}:{error.lineno}:{error.colno}
                          </span>
                        )}
                      </div>
                      {error.stack && (
                        <details className="mt-2">
                          <summary className="text-sm text-blue-600 cursor-pointer hover:text-blue-800">
                            View Stack Trace
                          </summary>
                          <pre className="p-2 mt-2 overflow-x-auto text-xs bg-gray-100 rounded">
                            {error.stack}
                          </pre>
                        </details>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Console Errors */}
      <div className="bg-white rounded-lg shadow">
        <div className="p-4 border-b">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-medium text-gray-900">Console Errors</h2>
            <span className="px-2 py-1 text-sm text-orange-800 bg-orange-100 rounded">
              {consoleErrors.length} console errors
            </span>
          </div>
        </div>
        <div className="overflow-y-auto max-h-96">
          {consoleErrors.length === 0 ? (
            <div className="p-8 text-center text-gray-500">
              <CheckCircle className="w-12 h-12 mx-auto mb-3 text-green-300" />
              <p>No console errors detected</p>
            </div>
          ) : (
            <div className="divide-y">
              {consoleErrors.slice(-20).map((error, index) => (
                <div key={index} className="p-4 hover:bg-gray-50">
                  <div className="flex items-start gap-2">
                    <AlertTriangle className="w-5 h-5 text-orange-500 mt-0.5 flex-shrink-0" />
                    <div className="flex-1">
                      <div className="font-medium text-orange-900">{error.message}</div>
                      <div className="mt-1 text-sm text-gray-600">
                        <span className="font-mono">{new Date(error.timestamp).toLocaleTimeString()}</span>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Browser Information */}
      <div className="bg-white rounded-lg shadow">
        <div className="p-4 border-b">
          <h2 className="text-lg font-medium text-gray-900">Browser Information</h2>
        </div>
        <div className="p-4">
          <div className="grid grid-cols-1 gap-4 text-sm md:grid-cols-2">
            <div>
              <span className="font-medium text-gray-600">User Agent:</span>
              <div className="p-2 mt-1 font-mono text-xs bg-gray-100 rounded">
                {navigator.userAgent}
              </div>
            </div>
            <div>
              <span className="font-medium text-gray-600">URL:</span>
              <div className="p-2 mt-1 font-mono text-xs bg-gray-100 rounded">
                {window.location.href}
              </div>
            </div>
            <div>
              <span className="font-medium text-gray-600">React Version:</span>
              <div className="mt-1">{React.version}</div>
            </div>
            <div>
              <span className="font-medium text-gray-600">Environment:</span>
              <div className="mt-1">{process.env.NODE_ENV}</div>
            </div>
          </div>
        </div>
      </div>

      {/* Local Storage Information */}
      <div className="bg-white rounded-lg shadow">
        <div className="p-4 border-b">
          <h2 className="text-lg font-medium text-gray-900">Local Storage</h2>
        </div>
        <div className="p-4">
          <div className="space-y-2 text-sm">
            {Object.keys(localStorage).map(key => (
              <div key={key} className="flex items-center justify-between py-1 border-b">
                <span className="font-medium">{key}</span>
                <span className="font-mono text-xs text-gray-600">
                  {localStorage.getItem(key)?.length || 0} chars
                </span>
              </div>
            ))}
            {Object.keys(localStorage).length === 0 && (
              <p className="italic text-gray-500">No items in localStorage</p>
            )}
          </div>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="p-4 border border-blue-200 rounded-lg bg-blue-50">
        <h3 className="mb-2 font-medium text-blue-900">Quick Actions</h3>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => window.location.reload()}
            className="px-3 py-1 text-sm text-white bg-blue-600 rounded hover:bg-blue-700"
          >
            Reload Page
          </button>
          <button
            onClick={() => localStorage.clear()}
            className="px-3 py-1 text-sm text-white bg-yellow-600 rounded hover:bg-yellow-700"
          >
            Clear Local Storage
          </button>
          <button
            onClick={() => {
              const diagnosticData = {
                errors,
                consoleErrors,
                componentStatus,
                userAgent: navigator.userAgent,
                url: window.location.href,
                timestamp: new Date().toISOString()
              };
              navigator.clipboard.writeText(JSON.stringify(diagnosticData, null, 2));
              alert('Diagnostic data copied to clipboard');
            }}
            className="px-3 py-1 text-sm text-white bg-green-600 rounded hover:bg-green-700"
          >
            Copy Diagnostic Data
          </button>
        </div>
      </div>
    </div>
  );
};

export default ErrorDiagnostic;