// FIXED DataContext.js - Eliminates infinite re-rendering and continuous loading
// src/contexts/DataContext.js

import React, { createContext, useContext, useState, useEffect, useRef, useCallback } from 'react';
import { useAuth } from './AuthContext';
import { useNotification } from './NotificationContext';
import apiService from '../services/api';

const DataContext = createContext();

export const useData = () => {
  const context = useContext(DataContext);
  if (!context) {
    throw new Error('useData must be used within a DataProvider');
  }
  return context;
};

export const DataProvider = ({ children }) => {
  const { isLoggedIn, currentUser } = useAuth();
  const { showSuccess, showError } = useNotification();
  
  const [data, setData] = useState({
    vehicles: [],
    devices: [],
    alerts: [],
    alarms: [], // Keep for compatibility
    locations: []
  });
  
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [lastUpdate, setLastUpdate] = useState(null);
  const [connectionStatus, setConnectionStatus] = useState('disconnected');
  
  // Use refs to prevent infinite loops - CRITICAL FIX
  const refreshIntervalRef = useRef(null);
  const isInitializedRef = useRef(false);
  const isFetchingRef = useRef(false);
  const mountedRef = useRef(true); // Track if component is mounted

  // ===========================================
  // STABLE DATA FETCHING - FIXED DEPENDENCIES
  // ===========================================

  const fetchData = useCallback(async (silent = false) => {
    // Prevent concurrent fetches - CRITICAL FIX
    if (isFetchingRef.current) {
      console.log('📊 Fetch already in progress, skipping...');
      return { success: false, reason: 'fetch_in_progress' };
    }

    // Check if component is still mounted
    if (!mountedRef.current) {
      console.log('📊 Component unmounted, skipping fetch...');
      return { success: false, reason: 'component_unmounted' };
    }

    isFetchingRef.current = true;

    if (!silent) {
      setLoading(true);
      console.log('🔄 Starting data fetch...');
    }
    
    setError(null);

    try {
      console.log('🔄 Fetching all data from API...');
      
      // Test API connection first (only if not silent)
      if (!silent) {
        const healthCheck = await apiService.healthCheck();
        console.log('🏥 Health check result:', healthCheck);
        
        if (healthCheck.status === 'unhealthy') {
          throw new Error('API server is not responding');
        }
      }

      // Fetch data in parallel for better performance
      const [vehiclesResponse, devicesResponse, alarmsResponse] = await Promise.allSettled([
        apiService.getVehicles(0, 100),
        apiService.getDevices(0, 100),
        apiService.getManagerAlarms(0, 50)
      ]);

      // Check if component is still mounted before updating state
      if (!mountedRef.current) {
        console.log('📊 Component unmounted during fetch, aborting...');
        return { success: false, reason: 'component_unmounted_during_fetch' };
      }

      // Process results
      const vehicles = vehiclesResponse.status === 'fulfilled' && vehiclesResponse.value.success ? 
        vehiclesResponse.value.data : [];
      const devices = devicesResponse.status === 'fulfilled' && devicesResponse.value.success ? 
        devicesResponse.value.data : [];
      const alerts = alarmsResponse.status === 'fulfilled' && alarmsResponse.value.success ?
        alarmsResponse.value.data : [];

      // Count devices with telemetry data for success message
      const devicesWithTelemetry = devices.filter(device => 
        device.last_updated && 
        device.latitude !== null && 
        device.longitude !== null
      );

      // Update state atomically - CRITICAL FIX
      setData(prevData => ({
        vehicles: vehicles,
        devices: devices,
        alerts: alerts,
        alarms: alerts, // Keep compatibility
        locations: devices.filter(d => d.latitude && d.longitude).map(d => ({
          device_id: d.device_id,
          vehicle_id: d.vehicle_id,
          latitude: d.latitude,
          longitude: d.longitude,
          timestamp: d.last_updated
        }))
      }));

      setConnectionStatus('connected');
      setLastUpdate(new Date().toISOString());

      console.log('✅ Data fetch completed:', {
        vehicles: vehicles.length,
        devices: devices.length,
        devicesWithTelemetry: devicesWithTelemetry.length,
        alerts: alerts.length,
        timestamp: new Date().toISOString()
      });

      // Show success message only on initial load
      if (!silent && !isInitializedRef.current) {
        showSuccess('Connected', `Successfully loaded: ${vehicles.length} vehicles, ${devicesWithTelemetry.length} devices, ${alerts.length} alerts`);
        isInitializedRef.current = true;
      }

      return { success: true, data: { vehicles, devices, alerts } };

    } catch (error) {
      console.error('❌ Failed to fetch data:', error);
      
      // Only update state if component is still mounted
      if (mountedRef.current) {
        setError(error.message);
        setConnectionStatus('disconnected');
        
        if (!silent) {
          showError('Data Fetch Failed', `Could not load data: ${error.message}`);
        }
      }

      return { success: false, error: error.message };
    } finally {
      // Only update loading state if component is still mounted
      if (mountedRef.current) {
        setLoading(false);
      }
      isFetchingRef.current = false;
    }
  }, [showSuccess, showError]); // FIXED: Only include stable dependencies

  // ===========================================
  // MANUAL REFRESH FUNCTION - STABLE
  // ===========================================

  const forceRefresh = useCallback(async () => {
    console.log('🔄 Manual refresh triggered');
    return await fetchData(false); // Not silent, show loading
  }, [fetchData]);

  // ===========================================
  // INITIALIZATION EFFECT - FIXED
  // ===========================================

  useEffect(() => {
    console.log('🔄 DataContext mount effect:', { isLoggedIn, hasCurrentUser: !!currentUser });

    if (isLoggedIn && currentUser) {
      console.log('✅ User is logged in, initializing data...');
      
      // Clear any existing interval - CRITICAL FIX
      if (refreshIntervalRef.current) {
        console.log('🧹 Clearing existing interval...');
        clearInterval(refreshIntervalRef.current);
        refreshIntervalRef.current = null;
      }

      // Initial data fetch
      fetchData(false);

      // Set up 30-second refresh interval - CRITICAL FIX
      refreshIntervalRef.current = setInterval(() => {
        console.log('🔄 30-second scheduled refresh...');
        fetchData(true); // Silent refresh
      }, 30000); // Exactly 30 seconds

      console.log('⏰ 30-second refresh interval started with ID:', refreshIntervalRef.current);

    } else if (!isLoggedIn) {
      console.log('🔒 User logged out, clearing data and intervals...');
      
      // Clear intervals
      if (refreshIntervalRef.current) {
        clearInterval(refreshIntervalRef.current);
        refreshIntervalRef.current = null;
      }

      // Reset all state
      setData({
        vehicles: [],
        devices: [],
        alerts: [],
        alarms: [],
        locations: []
      });
      setError(null);
      setLastUpdate(null);
      setConnectionStatus('disconnected');
      isInitializedRef.current = false;
      isFetchingRef.current = false;
    }

    // Cleanup function - CRITICAL FIX
    return () => {
      if (refreshIntervalRef.current) {
        console.log('🧹 Cleaning up interval on effect cleanup...');
        clearInterval(refreshIntervalRef.current);
        refreshIntervalRef.current = null;
      }
    };
  }, [isLoggedIn, currentUser, fetchData]); // FIXED: Add fetchData to dependencies

  // ===========================================
  // COMPONENT CLEANUP ON UNMOUNT - NEW
  // ===========================================

  useEffect(() => {
    mountedRef.current = true;
    
    return () => {
      console.log('🧹 DataContext unmounting, cleaning up...');
      mountedRef.current = false;
      
      if (refreshIntervalRef.current) {
        clearInterval(refreshIntervalRef.current);
        refreshIntervalRef.current = null;
      }
    };
  }, []);

  // ===========================================
  // UTILITY FUNCTIONS - STABLE
  // ===========================================

  const getDevicesByVehicle = useCallback((vehicleId) => {
    return data.devices.filter(device => device.vehicle_id === vehicleId);
  }, [data.devices]);

  const getActiveDevices = useCallback(() => {
    return data.devices.filter(device => device.status === 'Active');
  }, [data.devices]);

  const getDevicesWithTelemetry = useCallback(() => {
    return data.devices.filter(device => 
      device.last_updated && 
      device.latitude !== null && 
      device.longitude !== null
    );
  }, [data.devices]);

  const getDevicesWithLocation = useCallback(() => {
    return data.devices.filter(device => device.latitude && device.longitude);
  }, [data.devices]);

  const getRecentAlerts = useCallback((hours = 24) => {
    const cutoff = new Date(Date.now() - (hours * 60 * 60 * 1000));
    return data.alerts.filter(alert => new Date(alert.timestamp) > cutoff);
  }, [data.alerts]);

  // ===========================================
  // VEHICLE OPERATIONS - STABLE
  // ===========================================

  const createVehicle = useCallback(async (vehicleData) => {
    try {
      setLoading(true);
      console.log('🚗 Creating vehicle via API:', vehicleData);
      
      const response = await apiService.createVehicle(vehicleData);
      
      if (response.success) {
        // Refresh data after creation
        await fetchData(true);
        console.log('✅ Vehicle created successfully');
        showSuccess('Vehicle Created', 'Vehicle has been created successfully');
        return response;
      }
      
      throw new Error('Failed to create vehicle');
    } catch (error) {
      console.error('❌ Failed to create vehicle:', error);
      showError('Creation Failed', error.message);
      throw error;
    } finally {
      setLoading(false);
    }
  }, [fetchData, showSuccess, showError]);

  const updateVehicle = useCallback(async (vehicleId, updates) => {
    try {
      setLoading(true);
      console.log('🚗 Updating vehicle:', vehicleId, updates);
      
      const response = await apiService.updateVehicle(vehicleId, updates);
      
      if (response.success) {
        // Update local state immediately for better UX
        setData(prev => ({
          ...prev,
          vehicles: prev.vehicles.map(v => 
            v.vehicle_id === vehicleId ? { ...v, ...updates } : v
          )
        }));
        
        // Refresh data from API
        await fetchData(true);
        showSuccess('Vehicle Updated', 'Vehicle has been updated successfully');
        return response;
      }
      
      throw new Error('Failed to update vehicle');
    } catch (error) {
      console.error('❌ Failed to update vehicle:', error);
      showError('Update Failed', error.message);
      throw error;
    } finally {
      setLoading(false);
    }
  }, [fetchData, showSuccess, showError]);

  const deleteVehicle = useCallback(async (vehicleId) => {
    try {
      setLoading(true);
      console.log('🚗 Deleting vehicle:', vehicleId);
      
      const response = await apiService.deleteVehicle(vehicleId);
      
      if (response.success) {
        // Remove from local state immediately
        setData(prev => ({
          ...prev,
          vehicles: prev.vehicles.filter(v => v.vehicle_id !== vehicleId)
        }));
        
        showSuccess('Vehicle Deleted', 'Vehicle has been deleted successfully');
        return response;
      }
      
      throw new Error('Failed to delete vehicle');
    } catch (error) {
      console.error('❌ Failed to delete vehicle:', error);
      showError('Deletion Failed', error.message);
      throw error;
    } finally {
      setLoading(false);
    }
  }, [showSuccess, showError]);

  // ===========================================
  // DEVICE OPERATIONS - STABLE
  // ===========================================

  const createDevice = useCallback(async (deviceData) => {
    try {
      setLoading(true);
      console.log('📱 Creating device via API:', deviceData);
      
      const response = await apiService.createDevice(deviceData);
      
      if (response.success) {
        await fetchData(true);
        showSuccess('Device Created', 'Device has been created successfully');
        return response;
      }
      
      throw new Error('Failed to create device');
    } catch (error) {
      console.error('❌ Failed to create device:', error);
      showError('Creation Failed', error.message);
      throw error;
    } finally {
      setLoading(false);
    }
  }, [fetchData, showSuccess, showError]);

  const updateDevice = useCallback(async (deviceId, updates) => {
    try {
      setLoading(true);
      console.log('📱 Updating device:', deviceId, updates);
      
      const response = await apiService.updateDevice(deviceId, updates);
      
      if (response.success) {
        setData(prev => ({
          ...prev,
          devices: prev.devices.map(d => 
            d.device_id === deviceId ? { ...d, ...updates } : d
          )
        }));
        
        await fetchData(true);
        showSuccess('Device Updated', 'Device has been updated successfully');
        return response;
      }
      
      throw new Error('Failed to update device');
    } catch (error) {
      console.error('❌ Failed to update device:', error);
      showError('Update Failed', error.message);
      throw error;
    } finally {
      setLoading(false);
    }
  }, [fetchData, showSuccess, showError]);

  const deleteDevice = useCallback(async (deviceId) => {
    try {
      setLoading(true);
      console.log('📱 Deleting device:', deviceId);
      
      const response = await apiService.deleteDevice(deviceId);
      
      if (response.success) {
        setData(prev => ({
          ...prev,
          devices: prev.devices.filter(d => d.device_id !== deviceId)
        }));
        
        showSuccess('Device Deleted', 'Device has been deleted successfully');
        return response;
      }
      
      throw new Error('Failed to delete device');
    } catch (error) {
      console.error('❌ Failed to delete device:', error);
      showError('Deletion Failed', error.message);
      throw error;
    } finally {
      setLoading(false);
    }
  }, [showSuccess, showError]);

  // ===========================================
  // STATS GETTER - STABLE
  // ===========================================

  const getStats = useCallback(() => {
    const activeDevices = getActiveDevices();
    const devicesWithLocation = getDevicesWithLocation();
    const devicesWithTelemetry = getDevicesWithTelemetry();
    const recentAlerts = getRecentAlerts();

    return {
      totalVehicles: data.vehicles.length,
      totalDevices: data.devices.length,
      activeDevices: activeDevices.length,
      devicesWithGPS: devicesWithLocation.length,
      devicesWithTelemetry: devicesWithTelemetry.length,
      recentAlerts: recentAlerts.length,
      criticalAlerts: recentAlerts.filter(a => a.severity === 'critical').length,
      lastUpdate: lastUpdate,
      connectionStatus: connectionStatus,
      refreshInterval: 30 // seconds
    };
  }, [data, lastUpdate, connectionStatus, getActiveDevices, getDevicesWithTelemetry, getDevicesWithLocation, getRecentAlerts]);

  // ===========================================
  // CONTEXT VALUE - STABLE
  // ===========================================

  const contextValue = {
    // State
    data,
    loading,
    error,
    lastUpdate,
    connectionStatus,
    
    // Main operations
    fetchData,
    forceRefresh,
    
    // Vehicle operations
    createVehicle,
    updateVehicle,
    deleteVehicle,
    
    // Device operations
    createDevice,
    updateDevice,
    deleteDevice,
    
    // Utility methods
    getDevicesByVehicle,
    getActiveDevices,
    getDevicesWithTelemetry,
    getDevicesWithLocation,
    getRecentAlerts,
    getStats
  };

  return (
    <DataContext.Provider value={contextValue}>
      {children}
    </DataContext.Provider>
  );
};