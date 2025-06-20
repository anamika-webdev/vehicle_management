// FIXED API SERVICE - Complete implementation with proper exports
// src/services/api.js

import { config } from '../config/apiConfig';

class ApiService {
  constructor() {
    this.baseURL = config.API_BASE_URL;
    this.token = localStorage.getItem('authToken') || null;
    this.lastSuccessfulEndpoint = null;
  }

  // ===========================================
  // AUTHENTICATION METHODS
  // ===========================================

  setToken(token) {
    this.token = token;
    if (token) {
      localStorage.setItem('authToken', token);
    } else {
      localStorage.removeItem('authToken');
    }
  }

  getToken() {
    return this.token || localStorage.getItem('authToken');
  }

  // ===========================================
  // HTTP REQUEST WRAPPER
  // ===========================================

  async request(endpoint, options = {}) {
    const url = `${this.baseURL}${endpoint}`;
    const token = this.getToken();

    const defaultOptions = {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        ...(token && { Authorization: `Bearer ${token}` })
      }
    };

    const finalOptions = {
      ...defaultOptions,
      ...options,
      headers: {
        ...defaultOptions.headers,
        ...options.headers
      }
    };

    try {
      console.log(`🌐 API Request: ${finalOptions.method} ${url}`);
      
      const response = await fetch(url, finalOptions);
      
      console.log(`📡 Response: ${response.status} ${response.statusText}`);

      if (!response.ok) {
        const errorText = await response.text();
        console.error(`❌ API Error: ${response.status} - ${errorText}`);
        throw new Error(`API Error: ${response.status} - ${response.statusText}`);
      }

      const data = await response.json();
      console.log(`✅ Response Data:`, data);

      this.lastSuccessfulEndpoint = endpoint;
      return data;

    } catch (error) {
      console.error(`❌ Request failed for ${url}:`, error);
      throw error;
    }
  }

  // ===========================================
  // HEALTH CHECK
  // ===========================================

  async healthCheck() {
    try {
      console.log('🏥 Performing health check...');
      
      // Try the main health endpoint first
      const response = await this.request('/health');
      
      return {
        status: response ? 'healthy' : 'degraded',
        message: 'API is responsive via health endpoint',
        timestamp: new Date().toISOString(),
        endpoint: this.baseURL
      };
    } catch (error) {
      console.warn('⚠️ Health check failed:', error.message);
      
      // Try basic connectivity test with vehicles endpoint
      try {
        const basicResponse = await fetch(`${this.baseURL}/vehicle/v1/all?page=0&size=1`, {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
            ...(this.token && { Authorization: `Bearer ${this.token}` })
          }
        });
        
        if (basicResponse.ok) {
          return {
            status: 'degraded',
            message: 'Server reachable but may have authentication issues',
            timestamp: new Date().toISOString(),
            endpoint: this.baseURL
          };
        }
      } catch (e) {
        // Ignore basic test failure
      }
      
      return {
        status: 'unhealthy',
        message: error.message || 'API is not responding',
        timestamp: new Date().toISOString(),
        endpoint: this.baseURL
      };
    }
  }

  // ===========================================
  // VEHICLE ENDPOINTS - FIXED
  // ===========================================

  async getVehicles(page = 0, size = 20, sortBy = 'vehicleId', direction = 'asc') {
    try {
      console.log('🚗 Fetching vehicles from API...');
      const endpoint = `/vehicle/v1/all?page=${page}&size=${size}&sortBy=${sortBy}&direction=${direction}`;
      const response = await this.request(endpoint);
      
      if (response && response.data && Array.isArray(response.data)) {
        const transformedData = response.data.map(vehicle => ({
          vehicle_id: vehicle.vehicleId || vehicle.vehicle_id || vehicle.id,
          vehicle_name: vehicle.vehicleName || vehicle.vehicle_name || vehicle.name,
          vehicle_number: vehicle.vehicleNumber || vehicle.vehicle_number || vehicle.license_plate,
          vehicle_type: vehicle.vehicleType || vehicle.vehicle_type || vehicle.type,
          vehicle_model: vehicle.vehicleModel || vehicle.vehicle_model || vehicle.model,
          status: vehicle.status || 'Active',
          current_latitude: vehicle.currentLatitude || vehicle.current_latitude || vehicle.latitude,
          current_longitude: vehicle.currentLongitude || vehicle.current_longitude || vehicle.longitude,
          current_speed: vehicle.currentSpeed || vehicle.current_speed || vehicle.speed || 0,
          last_updated: vehicle.lastUpdated || vehicle.last_updated || vehicle.updatedAt,
          created_at: vehicle.createdAt || vehicle.created_at,
          updated_at: vehicle.updatedAt || vehicle.updated_at
        }));
        
        console.log(`✅ Successfully fetched ${transformedData.length} vehicles`);
        
        return {
          success: true,
          data: transformedData,
          totalElements: response.totalElements || transformedData.length,
          totalPages: response.totalPages || 1,
          currentPage: response.number || 0
        };
      }
      
      console.log('📝 No vehicles found in response');
      return {
        success: true,
        data: [],
        message: 'No vehicles found'
      };
      
    } catch (error) {
      console.error('❌ Failed to fetch vehicles:', error);
      return {
        success: false,
        data: [],
        error: error.message,
        message: `Could not fetch vehicles: ${error.message}`
      };
    }
  }

  async getVehicleById(vehicleId) {
    try {
      console.log(`🚗 Fetching vehicle by ID: ${vehicleId}`);
      const endpoint = `/vehicle/v1/${vehicleId}`;
      const response = await this.request(endpoint);
      
      return {
        success: true,
        data: Array.isArray(response.data) ? response.data : [response.data]
      };
    } catch (error) {
      console.error(`❌ Failed to fetch vehicle ${vehicleId}:`, error);
      return {
        success: false,
        data: [],
        error: error.message
      };
    }
  }

  async createVehicle(vehicleData) {
    try {
      console.log('📝 Creating new vehicle...');
      const response = await this.request('/vehicle/v1/register', {
        method: 'POST',
        body: JSON.stringify(vehicleData)
      });
      return {
        success: true,
        data: response.data
      };
    } catch (error) {
      console.error('❌ Vehicle creation failed:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  async updateVehicle(vehicleId, updateData) {
    try {
      console.log(`🚗 Updating vehicle ${vehicleId}...`);
      const response = await this.request(`/vehicle/v1/update/${vehicleId}`, {
        method: 'PUT',
        body: JSON.stringify(updateData)
      });
      return {
        success: true,
        data: response.data
      };
    } catch (error) {
      console.error(`❌ Vehicle update failed:`, error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  async deleteVehicle(vehicleId) {
    try {
      console.log(`🚗 Deleting vehicle ${vehicleId}...`);
      const response = await this.request(`/vehicle/v1/delete/${vehicleId}`, {
        method: 'DELETE'
      });
      return {
        success: true,
        data: response.data
      };
    } catch (error) {
      console.error(`❌ Vehicle deletion failed:`, error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  // ===========================================
  // DEVICE ENDPOINTS - FIXED
  // ===========================================

  async getDevices(page = 0, size = 20) {
    try {
      console.log('📱 Fetching devices from API...');
      const endpoint = `/device/v1/all?page=${page}&size=${size}`;
      const response = await this.request(endpoint);
      
      if (response && response.data && Array.isArray(response.data)) {
        const transformedData = response.data.map(device => ({
          device_id: device.deviceId || device.device_id || device.id,
          device_name: device.deviceName || device.device_name || device.name,
          device_type: device.deviceType || device.device_type || device.type,
          status: device.status || 'Active',
          vehicle_id: device.vehicleId || device.vehicle_id,
          latitude: device.latitude ? parseFloat(device.latitude) : null,
          longitude: device.longitude ? parseFloat(device.longitude) : null,
          last_updated: device.lastUpdated || device.last_updated || device.updatedAt,
          created_at: device.createdAt || device.created_at,
          updated_at: device.updatedAt || device.updated_at,
          // Telemetry data
          speed: device.speed ? parseFloat(device.speed) : null,
          acceleration: device.acceleration ? parseFloat(device.acceleration) : null,
          drowsiness: Boolean(device.drowsiness),
          rash_driving: Boolean(device.rashDriving || device.rash_driving),
          collision: Boolean(device.collision)
        }));
        
        console.log(`✅ Successfully fetched ${transformedData.length} devices`);
        
        return {
          success: true,
          data: transformedData,
          totalElements: response.totalElements || transformedData.length
        };
      }
      
      return {
        success: true,
        data: [],
        message: 'No devices found'
      };
      
    } catch (error) {
      console.error('❌ Failed to fetch devices:', error);
      return {
        success: false,
        data: [],
        error: error.message,
        message: `Could not fetch devices: ${error.message}`
      };
    }
  }

  async createDevice(deviceData) {
    try {
      console.log('📱 Creating new device...');
      const response = await this.request('/device/v1/register', {
        method: 'POST',
        body: JSON.stringify(deviceData)
      });
      return {
        success: true,
        data: response.data
      };
    } catch (error) {
      console.error('❌ Device creation failed:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  async updateDevice(deviceId, updateData) {
    try {
      console.log(`📱 Updating device ${deviceId}...`);
      const response = await this.request(`/device/v1/update/${deviceId}`, {
        method: 'PUT',
        body: JSON.stringify(updateData)
      });
      return {
        success: true,
        data: response.data
      };
    } catch (error) {
      console.error(`❌ Device update failed:`, error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  async deleteDevice(deviceId) {
    try {
      console.log(`📱 Deleting device ${deviceId}...`);
      const response = await this.request(`/device/v1/delete/${deviceId}`, {
        method: 'DELETE'
      });
      return {
        success: true,
        data: response.data
      };
    } catch (error) {
      console.error(`❌ Device deletion failed:`, error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  // ===========================================
  // TELEMETRY ENDPOINTS
  // ===========================================

  async getDeviceTelemetry(deviceId, page = 0, size = 10) {
    const endpoints = [
      `/device/v1/data/${deviceId}?direction=desc&page=${page}&size=${size}`,
      `/device/v1/data/${deviceId}?direction=desc`,
      `/deviceTelemetry/v1/device/${deviceId}?page=${page}&size=${size}`,
      `/telemetry/v1/device/${deviceId}`
    ];
    
    try {
      console.log(`📊 Fetching telemetry for device ${deviceId}...`);
      
      for (const endpoint of endpoints) {
        try {
          console.log(`🔄 Trying endpoint: ${endpoint}`);
          const response = await this.request(endpoint);
          
          if (response && response.data && Array.isArray(response.data) && response.data.length > 0) {
            const transformedData = response.data.map(item => ({
              device_id: deviceId,
              speed: item.speed ? parseFloat(item.speed) : null,
              latitude: item.latitude ? parseFloat(item.latitude) : null,
              longitude: item.longitude ? parseFloat(item.longitude) : null,
              acceleration: item.acceleration ? parseFloat(item.acceleration) : null,
              drowsiness: Boolean(item.drowsiness),
              rash_driving: Boolean(item.rashDriving || item.rash_driving),
              collision: Boolean(item.collision),
              timestamp: item.timestamp || item.createdAt || new Date().toISOString()
            }));
            
            return {
              success: true,
              data: transformedData,
              endpoint_used: endpoint,
              message: `Found ${transformedData.length} telemetry records`
            };
          }
        } catch (endpointError) {
          console.warn(`⚠️ Endpoint ${endpoint} failed:`, endpointError.message);
          continue;
        }
      }
      
      return {
        success: false,
        data: [],
        attempted_endpoints: endpoints,
        message: `No telemetry data found for device ${deviceId}`
      };
      
    } catch (error) {
      console.error(`❌ Failed to fetch telemetry for device ${deviceId}:`, error);
      return {
        success: false,
        data: [],
        error: error.message,
        message: `Could not fetch telemetry for device ${deviceId}: ${error.message}`
      };
    }
  }

  // ===========================================
  // ALARM/ALERT ENDPOINTS
  // ===========================================

  async getManagerAlarms(page = 0, size = 50) {
    try {
      console.log('🚨 Fetching manager alarms...');
      const endpoint = `/alarm/v1/manager/all?page=${page}&size=${size}`;
      const response = await this.request(endpoint);
      
      if (response && response.data && Array.isArray(response.data)) {
        const transformedData = response.data.map(alarm => ({
          alert_id: alarm.alarmId || alarm.alert_id || alarm.id,
          device_id: alarm.deviceId || alarm.device_id,
          vehicle_id: alarm.vehicleId || alarm.vehicle_id,
          alert_type: alarm.alarmType || alarm.alert_type || alarm.type,
          severity: alarm.severity || 'medium',
          message: alarm.message || alarm.description,
          timestamp: alarm.timestamp || alarm.createdAt || new Date().toISOString(),
          status: alarm.status || 'active',
          latitude: alarm.latitude ? parseFloat(alarm.latitude) : null,
          longitude: alarm.longitude ? parseFloat(alarm.longitude) : null
        }));
        
        console.log(`✅ Successfully fetched ${transformedData.length} alarms`);
        
        return {
          success: true,
          data: transformedData
        };
      }
      
      return {
        success: true,
        data: [],
        message: 'No alarms found'
      };
      
    } catch (error) {
      console.error('❌ Failed to fetch alarms:', error);
      return {
        success: false,
        data: [],
        error: error.message,
        message: `Could not fetch alarms: ${error.message}`
      };
    }
  }

  async getDeviceAlarms(deviceId, page = 0, size = 10) {
    try {
      console.log(`🚨 Fetching alarms for device ${deviceId}...`);
      const endpoint = `/alarm/v1/device/${deviceId}?page=${page}&size=${size}`;
      const response = await this.request(endpoint);
      
      return {
        success: true,
        data: Array.isArray(response.data) ? response.data : []
      };
    } catch (error) {
      console.error(`❌ Failed to fetch alarms for device ${deviceId}:`, error);
      return {
        success: false,
        data: [],
        error: error.message
      };
    }
  }

  // ===========================================
  // AUTH ENDPOINTS
  // ===========================================

  async login(email, password) {
    try {
      console.log('🔐 Attempting login...');
      const response = await this.request('/auth/v1/login', {
        method: 'POST',
        body: JSON.stringify({ email, password })
      });
      
      if (response && response.data && response.data.token) {
        this.setToken(response.data.token);
        return {
          success: true,
          data: response.data,
          user: response.data.user,
          token: response.data.token
        };
      }
      
      return {
        success: false,
        message: 'Invalid login response'
      };
    } catch (error) {
      console.error('❌ Login failed:', error);
      return {
        success: false,
        error: error.message,
        message: `Login failed: ${error.message}`
      };
    }
  }

  async logout() {
    try {
      console.log('🔓 Logging out...');
      this.setToken(null);
      return {
        success: true,
        message: 'Logged out successfully'
      };
    } catch (error) {
      console.error('❌ Logout failed:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }
}

// Create and export single instance - CRITICAL FIX
const apiService = new ApiService();

// Make sure all methods are bound to the instance
Object.getOwnPropertyNames(ApiService.prototype).forEach(method => {
  if (method !== 'constructor' && typeof apiService[method] === 'function') {
    apiService[method] = apiService[method].bind(apiService);
  }
});

export default apiService;