// Complete Updated App.js with Enhanced API Connection Handling
// src/App.js

import React, { useEffect, useState, useCallback } from 'react';
import { AuthProvider } from './contexts/AuthContext';
import { DataProvider } from './contexts/DataContext';
import { NotificationProvider } from './contexts/NotificationContext';
import { WebSocketProvider } from './contexts/WebSocketContext';
import Dashboard from './components/dashboard/Dashboard';
import './styles/globals.css';
import apiService from './services/api';
import { config } from './config/apiConfig';

// Enhanced Error Boundary component with better error handling
class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { 
      hasError: false, 
      error: null, 
      errorInfo: null,
      errorId: null
    };
  }

  static getDerivedStateFromError(error) {
    return { 
      hasError: true, 
      errorId: Date.now() // Unique error ID for tracking
    };
  }

  componentDidCatch(error, errorInfo) {
    console.error('🚨 Error Boundary caught an error:', error, errorInfo);
    
    this.setState({
      error: error,
      errorInfo: errorInfo
    });

    // Log error details for debugging
    const errorDetails = {
      message: error.message,
      stack: error.stack,
      componentStack: errorInfo.componentStack,
      timestamp: new Date().toISOString(),
      userAgent: navigator.userAgent,
      url: window.location.href
    };

    console.error('💥 Detailed error information:', errorDetails);

    // Send error to logging service if available
    if (config.FEATURES.DEBUG_MODE) {
      try {
        localStorage.setItem('lastError', JSON.stringify(errorDetails));
      } catch (e) {
        console.warn('Could not save error to localStorage:', e);
      }
    }
  }

  handleReload = () => {
    window.location.reload();
  };

  handleReset = () => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
      errorId: null
    });
  };

  copyErrorInfo = () => {
    const errorInfo = {
      error: this.state.error?.message,
      stack: this.state.error?.stack,
      componentStack: this.state.errorInfo?.componentStack,
      timestamp: new Date().toISOString()
    };
    
    navigator.clipboard.writeText(JSON.stringify(errorInfo, null, 2));
    alert('Error info copied to clipboard');
  };

  render() {
    if (this.state.hasError) {
      const isApiError = this.state.error?.message?.includes('API') || 
                        this.state.error?.message?.includes('fetch') || 
                        this.state.error?.message?.includes('Network');

      return (
        <div className="flex items-center justify-center min-h-screen bg-gray-50">
          <div className="max-w-lg p-8 text-center bg-white rounded-lg shadow-lg">
            <div className="mb-6">
              <div className="flex items-center justify-center w-16 h-16 mx-auto mb-4 bg-red-100 rounded-full">
                <svg className="w-8 h-8 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
                </svg>
              </div>
              <h2 className="mb-2 text-2xl font-bold text-gray-900">
                {isApiError ? 'Connection Error' : 'Something went wrong'}
              </h2>
              <p className="text-gray-600">
                {isApiError 
                  ? 'Unable to connect to the vehicle management system. Please check your internet connection.' 
                  : 'We encountered an unexpected error. This has been logged and will be investigated.'
                }
              </p>
            </div>
            
            <div className="space-y-3">
              <button
                onClick={this.handleReload}
                className="w-full px-4 py-3 text-white transition-colors bg-blue-600 rounded-lg hover:bg-blue-700"
              >
                <svg className="inline w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
                Reload Application
              </button>
              
              <button
                onClick={this.handleReset}
                className="w-full px-4 py-2 text-blue-600 transition-colors border border-blue-600 rounded-lg hover:bg-blue-50"
              >
                Try Again
              </button>

              {config.FEATURES.DEBUG_MODE && (
                <button
                  onClick={this.copyErrorInfo}
                  className="w-full px-4 py-2 text-gray-600 transition-colors border border-gray-300 rounded-lg hover:bg-gray-50"
                >
                  Copy Error Info
                </button>
              )}
            </div>
            
            {config.FEATURES.DEBUG_MODE && this.state.errorInfo && (
              <details className="mt-6 text-left">
                <summary className="text-sm text-gray-500 cursor-pointer hover:text-gray-700">
                  Technical Details (Debug Mode)
                </summary>
                <div className="p-3 mt-2 overflow-auto font-mono text-xs bg-gray-100 rounded max-h-40">
                  <div className="font-bold text-red-600">Error: {this.state.error?.message}</div>
                  <div className="mt-2 text-gray-700">
                    Component Stack: {this.state.errorInfo?.componentStack}
                  </div>
                </div>
              </details>
            )}
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

// Status indicator component
const StatusIndicator = ({ status }) => {
  const getStatusDisplay = () => {
    switch (status) {
      case 'healthy':
        return { color: 'text-green-600 bg-green-100', icon: '✓', text: 'Connected' };
      case 'degraded':
        return { color: 'text-yellow-600 bg-yellow-100', icon: '⚠', text: 'Degraded' };
      case 'error':
        return { color: 'text-red-600 bg-red-100', icon: '✗', text: 'Error' };
      case 'checking':
        return { color: 'text-blue-600 bg-blue-100', icon: '⟳', text: 'Checking...' };
      default:
        return { color: 'text-gray-600 bg-gray-100', icon: '○', text: 'Unknown' };
    }
  };

  const { color, icon, text } = getStatusDisplay();

  return (
    <div className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs ${color}`}>
      <span className={status === 'checking' ? 'animate-spin' : ''}>{icon}</span>
      <span>{text}</span>
    </div>
  );
};

// Debug panel component
const DebugPanel = ({ systemHealth, onHealthCheck, lastHealthCheck }) => (
  <div className="fixed max-w-xs p-3 text-xs text-white bg-black rounded-lg bottom-4 right-4 bg-opacity-90">
    <div className="flex items-center justify-between mb-2 font-bold">
      <span>Debug Panel</span>
      <button 
        onClick={onHealthCheck}
        className="p-1 ml-2 rounded hover:bg-white hover:bg-opacity-20"
        title="Refresh health check"
      >
        🔄
      </button>
    </div>
    <div className="space-y-1">
      <div className="flex items-center justify-between">
        <span>API:</span>
        <StatusIndicator status={systemHealth.api} />
      </div>
      <div className="flex items-center justify-between">
        <span>WebSocket:</span>
        <StatusIndicator status={systemHealth.websocket} />
      </div>
      <div className="flex items-center justify-between">
        <span>Auth:</span>
        <StatusIndicator status={systemHealth.auth} />
      </div>
      <div className="mt-2 text-xs text-gray-400">
        <div>Build: {process.env.NODE_ENV}</div>
        <div>Time: {new Date().toLocaleTimeString()}</div>
        {lastHealthCheck && (
          <div>Last Check: {lastHealthCheck.toLocaleTimeString()}</div>
        )}
      </div>
    </div>
  </div>
);

function App() {
  const [systemHealth, setSystemHealth] = useState({
    api: 'checking',
    websocket: 'unknown',
    auth: 'unknown'
  });
  const [isInitialized, setIsInitialized] = useState(false);
  const [initError, setInitError] = useState(null);
  const [lastHealthCheck, setLastHealthCheck] = useState(null);

  // Enhanced health check with multiple fallbacks
  const performHealthCheck = useCallback(async () => {
    try {
      console.log('🔍 Performing enhanced system health check...');
      
      setSystemHealth(prev => ({ ...prev, api: 'checking' }));
      setLastHealthCheck(new Date());
      
      // Enhanced API health check with multiple attempts
      let apiStatus = 'error';
      let apiMessage = 'Unable to connect';
      
      try {
        // Method 1: Try the enhanced health check
        const healthResponse = await apiService.healthCheck();
        
        if (healthResponse.status === 'healthy') {
          apiStatus = 'healthy';
          apiMessage = `Connected via ${healthResponse.endpoint}`;
          console.log('✅ API health check passed:', healthResponse);
        } else if (healthResponse.status === 'degraded') {
          apiStatus = 'degraded';
          apiMessage = healthResponse.message;
          console.log('⚠️ API in degraded state:', healthResponse);
        }
        
      } catch (healthError) {
        console.warn('Primary health check failed, trying connection test...', healthError.message);
        
        // Method 2: Try basic connection test
        try {
          const connectionResult = await apiService.testConnection();
          
          if (connectionResult.status === 'success') {
            apiStatus = 'degraded';
            apiMessage = `Connected but health endpoint unavailable (${connectionResult.method})`;
            console.log('⚠️ Connection test passed but health failed:', connectionResult);
          } else if (connectionResult.status === 'warning') {
            apiStatus = 'degraded';
            apiMessage = connectionResult.message;
            console.log('⚠️ Connection with warnings:', connectionResult);
          } else {
            apiStatus = 'error';
            apiMessage = connectionResult.message;
            console.error('❌ Connection test failed:', connectionResult);
          }
          
        } catch (connectionError) {
          console.error('❌ Both health check and connection test failed:', connectionError);
          
          // Method 3: Try simple ping
          try {
            const pingResult = await apiService.ping();
            
            if (pingResult.success) {
              apiStatus = 'degraded';
              apiMessage = `Basic connectivity OK (ping: ${pingResult.latency}ms)`;
              console.log('⚠️ Ping successful but other checks failed:', pingResult);
            } else {
              apiStatus = 'error';
              apiMessage = pingResult.error || 'All connection methods failed';
              console.error('❌ Ping also failed:', pingResult);
            }
            
          } catch (pingError) {
            apiStatus = 'error';
            apiMessage = 'Complete connectivity failure';
            console.error('❌ All connection methods failed:', pingError);
          }
        }
      }
      
      // Check authentication status
      let authStatus = 'unknown';
      try {
        const token = localStorage.getItem('authToken');
        if (token) {
          // Try to decode JWT token to check if it's valid
          try {
            const tokenParts = token.split('.');
            if (tokenParts.length === 3) {
              const payload = JSON.parse(atob(tokenParts[1]));
              const currentTime = Date.now() / 1000;
              
              if (payload.exp && payload.exp < currentTime) {
                authStatus = 'expired';
              } else {
                authStatus = 'valid';
              }
            } else {
              authStatus = 'invalid';
            }
          } catch (decodeError) {
            authStatus = 'invalid';
          }
        } else {
          authStatus = 'none';
        }
      } catch (authError) {
        authStatus = 'error';
      }
      
      // Update system health
      setSystemHealth(prev => ({ 
        ...prev, 
        api: apiStatus,
        auth: authStatus,
        websocket: prev.websocket // Preserve websocket status
      }));
      
      // Clear any initialization errors if we have some connectivity
      if (apiStatus !== 'error') {
        setInitError(null);
      } else {
        setInitError(`API Connection Failed: ${apiMessage}`);
      }
      
      console.log(`🏥 Health check completed. API Status: ${apiStatus} - ${apiMessage}`);
      
    } catch (error) {
      console.error('❌ Health check process failed:', error);
      
      setSystemHealth(prev => ({ 
        ...prev, 
        api: 'error',
        auth: 'unknown'
      }));
      
      setInitError(`Health Check Failed: ${error.message}`);
    }
  }, []);

  // Initialize the application
  const initializeApp = useCallback(async () => {
    try {
      console.log('🚀 Initializing Vehicle Management Dashboard...');
      console.log('🔧 API Base URL:', config.API_BASE_URL || apiService.baseURL);
      console.log('🌍 Environment:', process.env.NODE_ENV);
      console.log('⚙️ Features:', config.FEATURES);

      // Initialize API service token
      apiService.initializeToken();
      
      // Perform comprehensive health check
      await performHealthCheck();
      
      setIsInitialized(true);
      console.log('✅ Application initialized successfully');
      
    } catch (error) {
      console.error('❌ Application initialization failed:', error);
      setInitError(error.message);
      
      // Still allow app to load even if health check fails
      setIsInitialized(true);
    }
  }, [performHealthCheck]);

  // Retry connection with user feedback
  const retryConnection = useCallback(async () => {
    console.log('🔄 Retrying API connection...');
    setSystemHealth(prev => ({ ...prev, api: 'checking' }));
    
    await performHealthCheck();
    
    // If connection is restored, show success message
    if (systemHealth.api === 'healthy' || systemHealth.api === 'degraded') {
      console.log('🔄 Connection restored, reinitializing...');
    }
  }, [performHealthCheck, systemHealth.api]);

  // Initialize app on mount
  useEffect(() => {
    initializeApp();
  }, [initializeApp]);

  // Set up periodic health checks
  useEffect(() => {
    if (isInitialized) {
      // Check health every 2 minutes
      const healthCheckInterval = setInterval(performHealthCheck, 120000);
      
      return () => clearInterval(healthCheckInterval);
    }
  }, [isInitialized, performHealthCheck]);

  // Show loading screen during initialization
  if (!isInitialized) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-blue-900 to-blue-700">
        <div className="max-w-md p-8 text-center bg-white rounded-lg shadow-2xl">
          <div className="mb-6">
            <div className="w-16 h-16 mx-auto mb-4 border-4 border-blue-600 border-solid rounded-full border-t-transparent animate-spin"></div>
            <h2 className="text-2xl font-bold text-gray-900">Vehicle Management Dashboard</h2>
            <p className="mt-2 text-gray-600">Initializing system...</p>
          </div>
          
          <div className="space-y-2 text-sm">
            <div className="flex items-center justify-between p-2 rounded bg-gray-50">
              <span>API Connection</span>
              <StatusIndicator status={systemHealth.api} />
            </div>
            <div className="flex items-center justify-between p-2 rounded bg-gray-50">
              <span>Authentication</span>
              <StatusIndicator status={systemHealth.auth} />
            </div>
            <div className="flex items-center justify-between p-2 rounded bg-gray-50">
              <span>WebSocket Services</span>
              <StatusIndicator status={systemHealth.websocket} />
            </div>
          </div>
          
          {initError && (
            <div className="p-3 mt-4 text-sm text-red-700 bg-red-100 border border-red-300 rounded">
              <strong>Initialization Warning:</strong> {initError}
              <br />
              <small>The application will continue with limited functionality.</small>
            </div>
          )}
          
          <div className="mt-4 text-xs text-gray-500">
            Connecting to: {config.API_BASE_URL || apiService.baseURL}
          </div>
        </div>
      </div>
    );
  }

  // Show system status warning if API is not healthy
  const showSystemWarning = systemHealth.api === 'error' || systemHealth.api === 'degraded';

  return (
    <ErrorBoundary>
      <div className="min-h-screen bg-gray-100">
        {/* System Status Banner */}
        {showSystemWarning && (
          <div className="relative z-50 w-full p-2 text-center text-white bg-yellow-600">
            <div className="flex items-center justify-center space-x-2 text-sm">
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
              </svg>
              <span>
                {systemHealth.api === 'error' 
                  ? 'System operating in offline mode - Some features may be limited'
                  : 'System experiencing connectivity issues - Performance may be affected'
                }
              </span>
              <button 
                onClick={retryConnection}
                className="px-2 py-1 ml-2 text-xs bg-white rounded bg-opacity-20 hover:bg-opacity-30"
              >
                Retry Connection
              </button>
            </div>
          </div>
        )}

        {/* Main Application */}
        <AuthProvider>
          <NotificationProvider>
            <DataProvider>
              <WebSocketProvider>
                <Dashboard />
              </WebSocketProvider>
            </DataProvider>
          </NotificationProvider>
        </AuthProvider>

        {/* Development Tools */}
        {config.FEATURES.DEBUG_MODE && (
          <DebugPanel 
            systemHealth={systemHealth} 
            onHealthCheck={performHealthCheck}
            lastHealthCheck={lastHealthCheck}
          />
        )}
      </div>
    </ErrorBoundary>
    
  );
}

export default App;