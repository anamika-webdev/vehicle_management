// Stable DataContext.js - Fixed infinite re-rendering with 30-second refresh only
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
  
  // Use refs to prevent infinite loops
  const refreshIntervalRef = useRef(null);
  const isInitializedRef = useRef(false);
  const isFetchingRef = useRef(false);

  // ===========================================
  // STABLE DATA FETCHING - MEMOIZED
  // ===========================================

  const fetchData = useCallback(async (silent = false) => {
    // Prevent concurrent fetches
    if (isFetchingRef.current) {
      console.log('📊 Fetch already in progress, skipping...');
      return;
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

      // Process results
      const vehicles = vehiclesResponse.status === 'fulfilled' && vehiclesResponse.value.success ? 
        vehiclesResponse.value.data : [];
      const devices = devicesResponse.status === 'fulfilled' && devicesResponse.value.success ? 
        devicesResponse.value.data : [];
      const alerts = alarmsResponse.status === 'fulfilled' && alarmsResponse.value.success ? 
        alarmsResponse.value.data : [];

      console.log('📊 Data fetch results:', {
        vehicles: vehicles.length,
        devices: devices.length,
        alerts: alerts.length,
        vehiclesSuccess: vehiclesResponse.status === 'fulfilled',
        devicesSuccess: devicesResponse.status === 'fulfilled',
        alarmsSuccess: alarmsResponse.status === 'fulfilled'
      });

      // For devices, try to get telemetry but don't let it fail the whole fetch
      let devicesWithTelemetry = devices;
      
      if (devices.length > 0) {
        console.log('📊 Fetching telemetry for devices...');
        
        try {
          devicesWithTelemetry = await Promise.all(
            devices.map(async (device) => {
              try {
                const telemetryResponse = await apiService.getLatestDeviceTelemetry(device.device_id);
                return apiService.mergeDeviceWithTelemetry(device, telemetryResponse);
              } catch (telemetryError) {
                console.warn(`⚠️ Telemetry failed for device ${device.device_id}:`, telemetryError.message);
                return {
                  ...device,
                  has_telemetry: false,
                  telemetry_status: 'fetch_error',
                  telemetry_error: telemetryError.message
                };
              }
            })
          );
          
          const devicesWithTelemetryCount = devicesWithTelemetry.filter(d => d.has_telemetry).length;
          console.log(`📊 Telemetry fetched for ${devicesWithTelemetryCount}/${devices.length} devices`);
        } catch (telemetryError) {
          console.warn('⚠️ Telemetry fetch failed, using devices without telemetry:', telemetryError.message);
          devicesWithTelemetry = devices.map(device => ({
            ...device,
            has_telemetry: false,
            telemetry_status: 'batch_error'
          }));
        }
      }

      // Update state ONCE
      const newData = {
        vehicles: vehicles,
        devices: devicesWithTelemetry,
        alerts: alerts,
        alarms: alerts, // Keep for compatibility
        locations: devicesWithTelemetry.filter(d => d.latitude && d.longitude)
      };

      setData(newData);
      setLastUpdate(new Date());
      setConnectionStatus('connected');
      
      console.log('✅ Data fetch completed successfully:', {
        totalVehicles: vehicles.length,
        totalDevices: devicesWithTelemetry.length,
        devicesWithTelemetry: devicesWithTelemetry.filter(d => d.has_telemetry).length,
        totalAlerts: alerts.length,
        timestamp: new Date().toISOString()
      });

      // Show success message only on initial load
      if (!silent && !isInitializedRef.current) {
        showSuccess('Connected', `Successfully loaded: ${vehicles.length} vehicles, ${devicesWithTelemetry.length} devices, ${alerts.length} alerts`);
        isInitializedRef.current = true;
      }

    } catch (error) {
      console.error('❌ Failed to fetch data:', error);
      setError(error.message);
      setConnectionStatus('disconnected');
      
      if (!silent) {
        showError('Data Fetch Failed', `Could not load data: ${error.message}`);
      }
    } finally {
      setLoading(false);
      isFetchingRef.current = false;
    }
  }, []); // STABLE: No dependencies that change

  // ===========================================
  // MANUAL REFRESH FUNCTION
  // ===========================================

  const forceRefresh = useCallback(async () => {
    console.log('🔄 Manual refresh triggered');
    await fetchData(false); // Not silent, show loading
  }, [fetchData]);

  // ===========================================
  // INITIALIZATION EFFECT - STABLE
  // ===========================================

  useEffect(() => {
    console.log('🔄 DataContext mount effect:', { isLoggedIn, hasCurrentUser: !!currentUser });

    if (isLoggedIn && currentUser) {
      console.log('✅ User is logged in, initializing data...');
      
      // Clear any existing interval
      if (refreshIntervalRef.current) {
        clearInterval(refreshIntervalRef.current);
        refreshIntervalRef.current = null;
      }

      // Initial data fetch
      fetchData(false);

      // Set up 30-second refresh interval
      refreshIntervalRef.current = setInterval(() => {
        console.log('🔄 30-second scheduled refresh...');
        fetchData(true); // Silent refresh
      }, 30000); // Exactly 30 seconds

      console.log('⏰ 30-second refresh interval started');

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

    // Cleanup function
    return () => {
      if (refreshIntervalRef.current) {
        clearInterval(refreshIntervalRef.current);
        refreshIntervalRef.current = null;
      }
    };
  }, [isLoggedIn, currentUser]); // ONLY depend on login state

  // ===========================================
  // CLEANUP ON UNMOUNT
  // ===========================================

  useEffect(() => {
    return () => {
      if (refreshIntervalRef.current) {
        clearInterval(refreshIntervalRef.current);
      }
    };
  }, []);

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
            v.vehicle_id === vehicleId ? { ...v, ...updates, updated_at: new Date().toISOString() } : v
          )
        }));
        
        console.log('✅ Vehicle updated successfully');
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
  }, [showSuccess, showError]);

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
        
        console.log('✅ Vehicle deleted successfully');
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
        console.log('✅ Device created successfully');
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
            d.device_id === deviceId ? { ...d, ...updates, updated_at: new Date().toISOString() } : d
          )
        }));
        
        console.log('✅ Device updated successfully');
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
  }, [showSuccess, showError]);

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
        
        console.log('✅ Device deleted successfully');
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
  // UTILITY METHODS - STABLE
  // ===========================================

  const getDevicesByVehicle = useCallback((vehicleId) => {
    return data.devices.filter(device => device.vehicle_id === vehicleId);
  }, [data.devices]);

  const getActiveDevices = useCallback(() => {
    return data.devices.filter(device => device.status === 'Active');
  }, [data.devices]);

  const getDevicesWithTelemetry = useCallback(() => {
    return data.devices.filter(device => device.has_telemetry);
  }, [data.devices]);

  const getDevicesWithLocation = useCallback(() => {
    return data.devices.filter(device => device.latitude && device.longitude);
  }, [data.devices]);

  const getRecentAlerts = useCallback((hours = 24) => {
    const cutoff = new Date(Date.now() - hours * 60 * 60 * 1000);
    return data.alerts.filter(alert => new Date(alert.created_at) > cutoff);
  }, [data.alerts]);

  // Get statistics for dashboard
  const getStats = useCallback(() => {
    const activeDevices = getActiveDevices();
    const devicesWithTelemetry = getDevicesWithTelemetry();
    const devicesWithLocation = getDevicesWithLocation();
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