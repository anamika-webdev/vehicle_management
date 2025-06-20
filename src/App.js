// src/App.js - Temporary fix with inline WebSocket provider
import React, { useState, useCallback, useEffect, createContext, useContext } from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import { DataProvider } from './contexts/DataContext';
import { NotificationProvider } from './contexts/NotificationContext';

// Import components with CORRECT paths based on your project structure
import Dashboard from './components/dashboard/Dashboard';
import ApiOnlyEnhancedVehicleTrackingModal from './components/tracking/ApiOnlyEnhancedVehicleTrackingModal';
import { config } from './config/apiConfig';
import apiService from './services/api';

// TEMPORARY: Inline WebSocket Context to fix the import error
const WebSocketContext = createContext();

const SimpleWebSocketProvider = ({ children }) => {
  const [isConnected, setIsConnected] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState('disconnected');
  const [lastMessage, setLastMessage] = useState(null);

  // Mock WebSocket for development
  useEffect(() => {
    console.log('🔌 Initializing mock WebSocket...');
    setIsConnected(true);
    setConnectionStatus('connected');
    
    // Simulate periodic data
    const interval = setInterval(() => {
      setLastMessage({
        type: 'telemetry',
        timestamp: new Date().toISOString(),
        data: { status: 'active' }
      });
    }, 10000);

    return () => clearInterval(interval);
  }, []);

  const value = {
    isConnected,
    connectionStatus,
    lastMessage,
    connect: () => console.log('Mock connect'),
    disconnect: () => console.log('Mock disconnect'),
    sendMessage: (msg) => console.log('Mock send:', msg),
    subscribe: () => () => console.log('Mock unsubscribe')
  };

  return (
    <WebSocketContext.Provider value={value}>
      {children}
    </WebSocketContext.Provider>
  );
};

export const useWebSocket = () => {
  const context = useContext(WebSocketContext);
  if (!context) {
    throw new Error('useWebSocket must be used within a WebSocketProvider');
  }
  return context;
};

// Simple Error Boundary
class SimpleErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true };
  }

  componentDidCatch(error, errorInfo) {
    console.error('Error caught by boundary:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex items-center justify-center min-h-screen bg-gray-50">
          <div className="max-w-md p-8 text-center bg-white rounded-lg shadow-lg">
            <h2 className="mb-4 text-2xl font-bold text-gray-900">Something went wrong</h2>
            <p className="mb-6 text-gray-600">
              Please refresh the page and try again.
            </p>
            <button
              onClick={() => window.location.reload()}
              className="px-4 py-2 text-white bg-blue-600 rounded-lg hover:bg-blue-700"
            >
              Refresh Page
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

function App() {
  // Route tracking modal state - CRITICAL FOR TRACKING
  const [showApiTracking, setShowApiTracking] = useState(false);
  const [selectedTrackingVehicle, setSelectedTrackingVehicle] = useState(null);
  
  // System initialization state
  const [isInitialized, setIsInitialized] = useState(false);
  const [initError, setInitError] = useState(null);
  const [systemHealth, setSystemHealth] = useState({
    api: 'checking',
    auth: 'unknown'
  });

  // Enhanced tracking handler - MAIN TRACKING FUNCTION
  const handleEnhancedTracking = useCallback((vehicle) => {
    console.log('🚀 App: Enhanced tracking triggered for vehicle:', vehicle);
    console.log('🚗 Vehicle data:', vehicle);
    
    if (!vehicle) {
      console.error('❌ No vehicle provided for tracking');
      return;
    }

    setSelectedTrackingVehicle(vehicle);
    setShowApiTracking(true);
    
    console.log('✅ Tracking modal should now open');
  }, []);

  // Close tracking modal
  const handleCloseTracking = useCallback(() => {
    console.log('🔒 Closing tracking modal');
    setShowApiTracking(false);
    setSelectedTrackingVehicle(null);
  }, []);

  // Initialize application
  const initializeApp = useCallback(async () => {
    try {
      console.log('🚀 Initializing Vehicle Management Dashboard...');
      console.log('🔧 API Base URL:', apiService.baseURL);
      console.log('🌍 Environment:', process.env.NODE_ENV);

      // Initialize API service
      if (apiService.initializeToken) {
        apiService.initializeToken();
      }
      
      // Test API connection
      try {
        const healthCheck = await apiService.healthCheck();
        console.log('🏥 Health check result:', healthCheck);
        
        setSystemHealth({
          api: healthCheck.status,
          auth: apiService.getToken() ? 'authenticated' : 'unauthenticated'
        });
      } catch (healthError) {
        console.warn('⚠️ Health check failed:', healthError);
        setSystemHealth({
          api: 'error',
          auth: 'unknown'
        });
      }
      
      setIsInitialized(true);
      console.log('✅ Application initialized successfully');
      
    } catch (error) {
      console.error('❌ Application initialization failed:', error);
      setInitError(error.message);
      setIsInitialized(true); // Allow app to load anyway
    }
  }, []);

  // Initialize on mount
  useEffect(() => {
    initializeApp();
  }, [initializeApp]);

  // Show loading screen while initializing
  if (!isInitialized) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50">
        <div className="text-center">
          <div className="w-12 h-12 mx-auto mb-4 border-4 border-blue-600 rounded-full animate-spin border-t-transparent"></div>
          <h2 className="text-xl font-semibold text-gray-900">Initializing Dashboard...</h2>
          <p className="text-gray-600">Connecting to vehicle management system</p>
          {initError && (
            <p className="mt-2 text-sm text-red-600">Error: {initError}</p>
          )}
        </div>
      </div>
    );
  }

  return (
    <AuthProvider>
      <NotificationProvider>
        <DataProvider>
          <SimpleWebSocketProvider>
            <SimpleErrorBoundary>
              <Router>
                <div className="min-h-screen bg-gray-50">
                  <Routes>
                    <Route 
                      path="/*" 
                      element={
                        <Dashboard 
                          onEnhancedTracking={handleEnhancedTracking}
                          systemHealth={systemHealth}
                        />
                      } 
                    />
                  </Routes>
                  
                  {/* ROUTE TRACKING MODAL - CRITICAL COMPONENT */}
                  {showApiTracking && selectedTrackingVehicle && (
                    <ApiOnlyEnhancedVehicleTrackingModal
                      isOpen={showApiTracking}
                      onClose={handleCloseTracking}
                      vehicle={selectedTrackingVehicle}
                    />
                  )}
                </div>
              </Router>
            </SimpleErrorBoundary>
          </SimpleWebSocketProvider>
        </DataProvider>
      </NotificationProvider>
    </AuthProvider>
  );
}

export default App;