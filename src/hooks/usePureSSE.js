// Simplified version of the usePureSSE hook
// Save this as: src/hooks/usePureSSE.js

import { useState, useEffect, useCallback, useRef } from 'react';
import pureSSEService from '../services/pureSSEService';

export const usePureSSE = (options = {}) => {
  const {
    autoConnect = true,
    apiBaseUrl = 'http://164.52.194.198:9090',
    onConnectionChange,
    onDeviceUpdate,
    onAlarm,
    onError
  } = options;

  // Connection state
  const [connectionState, setConnectionState] = useState({
    isConnected: false,
    state: 'disconnected',
    reconnectAttempts: 0,
    lastEventTime: null,
    connectionStartTime: null
  });

  // Data state
  const [deviceData, setDeviceData] = useState({});
  const [lastUpdate, setLastUpdate] = useState(null);
  const [error, setError] = useState(null);
  const [stats, setStats] = useState({});
  const [eventLog, setEventLog] = useState([]);
  
  const subscriptionsRef = useRef(new Set());

  // Connection state handler
  const handleConnectionState = useCallback((stateData) => {
    setConnectionState(stateData);
    setError(stateData.state === 'failed' || stateData.state === 'error' ? 
      stateData.error || `Connection ${stateData.state}` : null);

    // Update stats
    setStats(pureSSEService.getStats());

    // Notify parent component
    if (onConnectionChange) {
      onConnectionChange(stateData);
    }

    // Handle connection errors
    if (stateData.state === 'error' || stateData.state === 'failed') {
      if (onError) {
        onError(stateData.error || `Connection ${stateData.state}`);
      }
    }
  }, [onConnectionChange, onError]);

  // Connect to SSE
  const connect = useCallback(async () => {
    try {
      setError(null);
      await pureSSEService.connect(apiBaseUrl);
    } catch (err) {
      setError(err.message);
      console.error('❌ SSE connection failed:', err);
      if (onError) {
        onError(err.message);
      }
    }
  }, [apiBaseUrl, onError]);

  // Disconnect from SSE
  const disconnect = useCallback(() => {
    pureSSEService.disconnect();
  }, []);

  // Reconnect SSE
  const reconnect = useCallback(async () => {
    try {
      setError(null);
      await pureSSEService.reconnect();
    } catch (err) {
      setError(err.message);
      console.error('❌ SSE reconnection failed:', err);
      if (onError) {
        onError(err.message);
      }
    }
  }, [onError]);

  // Subscribe to specific device events
  const subscribeToDevice = useCallback((deviceId, callback) => {
    const unsubscribe = pureSSEService.subscribe('device-update', (data) => {
      if (data.deviceId === deviceId) {
        callback(data);
      }
    });
    
    subscriptionsRef.current.add(unsubscribe);
    return unsubscribe;
  }, []);

  // Subscribe to all alarms
  const subscribeToAlarms = useCallback((callback) => {
    const unsubscribe = pureSSEService.subscribe('device-alarm', callback);
    subscriptionsRef.current.add(unsubscribe);
    return unsubscribe;
  }, []);

  // Get device real-time status
  const getDeviceRealTimeStatus = useCallback((deviceId) => {
    const device = deviceData[deviceId];
    if (!device) return { status: 'unknown', isLive: false, source: 'none' };

    return {
      status: device.status || 'unknown',
      isLive: Boolean(device.isLive),
      hasRealtimeData: Boolean(device.hasRealtimeData),
      lastUpdate: device.lastUpdate,
      telemetry: device.telemetry,
      source: device.source || 'unknown'
    };
  }, [deviceData]);

  // Get connection diagnostics
  const getConnectionDiagnostics = useCallback(() => {
    return {
      ...connectionState,
      stats,
      deviceCount: Object.keys(deviceData).length,
      eventLogCount: eventLog.length,
      subscriberCount: subscriptionsRef.current.size
    };
  }, [connectionState, stats, deviceData, eventLog]);

  // Clear event log
  const clearEventLog = useCallback(() => {
    setEventLog([]);
  }, []);

  // Get filtered event log
  const getEventLog = useCallback((filter = {}) => {
    return eventLog;
  }, [eventLog]);

  // Setup effect
  useEffect(() => {
    // Add connection listener
    pureSSEService.addConnectionListener(handleConnectionState);

    // Auto-connect if enabled
    if (autoConnect) {
      connect();
    }

    // Update stats periodically
    const statsInterval = setInterval(() => {
      setStats(pureSSEService.getStats());
    }, 5000);

    // Cleanup function
    return () => {
      clearInterval(statsInterval);
      pureSSEService.removeConnectionListener(handleConnectionState);
      
      // Cleanup subscriptions
      subscriptionsRef.current.forEach(unsubscribe => {
        if (typeof unsubscribe === 'function') {
          unsubscribe();
        }
      });
      subscriptionsRef.current.clear();
    };
  }, [autoConnect, connect, handleConnectionState]);

  return {
    // Connection state
    connectionState,
    isConnected: connectionState.isConnected,
    error,
    stats,
    
    // Data
    deviceData,
    lastUpdate,
    eventLog,
    
    // Methods
    connect,
    disconnect,
    reconnect,
    subscribeToDevice,
    subscribeToAlarms,
    getDeviceRealTimeStatus,
    
    // Diagnostics & utilities
    getConnectionDiagnostics,
    clearEventLog,
    getEventLog,
    
    // Direct service access
    getConnectionStatus: () => pureSSEService.getConnectionStatus(),
    getAllDeviceStates: () => pureSSEService.getAllDeviceStates(),
    getDeviceState: (deviceId) => pureSSEService.getDeviceState(deviceId),
    
    // Flags
    isEventBased: true,
    usesPollïng: false,
    connectionType: 'SSE'
  };
};

export default usePureSSE;