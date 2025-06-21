// FIXED API SERVICE - Complete implementation with proper exports and manufacturer/model mapping
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
  // VEHICLE ENDPOINTS - COMPLETELY FIXED WITH MANUFACTURER/MODEL MAPPING
  // ===========================================

  async getVehicles(page = 0, size = 20, sortBy = 'vehicleId', direction = 'asc') {
    try {
      console.log('🚗 Fetching vehicles from API...');
      const endpoint = `/vehicle/v1/all?page=${page}&size=${size}&sortBy=${sortBy}&direction=${direction}`;
      const response = await this.request(endpoint);
      
      if (response && response.data && Array.isArray(response.data)) {
        console.log('🔍 Raw API response for vehicles:', response.data);
        
        const transformedData = response.data.map(vehicle => {
          console.log('🔍 Processing vehicle:', vehicle);
          
          // CRITICAL FIX: Enhanced field mapping with multiple fallbacks
          const getFieldValue = (obj, primaryField, fallbackFields = [], defaultValue = null) => {
            // Check primary field first
            if (obj[primaryField] !== undefined && obj[primaryField] !== null && obj[primaryField] !== '') {
              return obj[primaryField];
            }
            
            // Check fallback fields
            for (const fallback of fallbackFields) {
              if (obj[fallback] !== undefined && obj[fallback] !== null && obj[fallback] !== '') {
                return obj[fallback];
              }
            }
            
            return defaultValue;
          };

          const transformed = {
            vehicle_id: getFieldValue(vehicle, 'vehicleId', ['vehicle_id', 'id']),
            vehicle_name: getFieldValue(vehicle, 'vehicleName', ['vehicle_name', 'name']),
            vehicle_number: getFieldValue(vehicle, 'vehicleNumber', ['vehicle_number', 'license_plate', 'plateNumber']),
            vehicle_type: getFieldValue(vehicle, 'vehicleType', ['vehicle_type', 'type', 'category']),
            
            // CRITICAL FIX: Proper manufacturer and model mapping
            manufacturer: getFieldValue(vehicle, 'vehicleManufacturer', ['manufacturer', 'make', 'brand'], 'Unknown'),
            model: getFieldValue(vehicle, 'vehicleModel', ['vehicle_model', 'model', 'vehicleName'], 'Unknown'),
            
            status: getFieldValue(vehicle, 'status', [], 'Active'),
            current_latitude: getFieldValue(vehicle, 'currentLatitude', ['current_latitude', 'latitude']),
            current_longitude: getFieldValue(vehicle, 'currentLongitude', ['current_longitude', 'longitude']),
            current_speed: getFieldValue(vehicle, 'currentSpeed', ['current_speed', 'speed'], 0),
            last_updated: getFieldValue(vehicle, 'lastUpdated', ['last_updated', 'updatedAt']),
            created_at: getFieldValue(vehicle, 'createdAt', ['created_at']),
            updated_at: getFieldValue(vehicle, 'updatedAt', ['updated_at'])
          };

          console.log('🔍 Transformed vehicle:', transformed);
          return transformed;
        });
        
        console.log(`✅ Successfully fetched ${transformedData.length} vehicles`);
        console.log('🔍 Sample transformed vehicle:', transformedData[0]);
        
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
      
      if (response && response.data) {
        const vehicleData = Array.isArray(response.data) ? response.data : [response.data];
        const transformedData = vehicleData.map(vehicle => {
          console.log('🔍 Raw single vehicle data:', vehicle);
          
          const getFieldValue = (obj, primaryField, fallbackFields = [], defaultValue = null) => {
            if (obj[primaryField] !== undefined && obj[primaryField] !== null && obj[primaryField] !== '') {
              return obj[primaryField];
            }
            for (const fallback of fallbackFields) {
              if (obj[fallback] !== undefined && obj[fallback] !== null && obj[fallback] !== '') {
                return obj[fallback];
              }
            }
            return defaultValue;
          };

          return {
            vehicle_id: getFieldValue(vehicle, 'vehicleId', ['vehicle_id', 'id']),
            vehicle_name: getFieldValue(vehicle, 'vehicleName', ['vehicle_name', 'name']),
            vehicle_number: getFieldValue(vehicle, 'vehicleNumber', ['vehicle_number', 'license_plate']),
            vehicle_type: getFieldValue(vehicle, 'vehicleType', ['vehicle_type', 'type']),
            manufacturer: getFieldValue(vehicle, 'vehicleManufacturer', ['manufacturer', 'make'], 'Unknown'),
            model: getFieldValue(vehicle, 'vehicleModel', ['vehicle_model', 'model'], 'Unknown'),
            status: getFieldValue(vehicle, 'status', [], 'Active'),
            current_latitude: getFieldValue(vehicle, 'currentLatitude', ['current_latitude', 'latitude']),
            current_longitude: getFieldValue(vehicle, 'currentLongitude', ['current_longitude', 'longitude']),
            current_speed: getFieldValue(vehicle, 'currentSpeed', ['current_speed', 'speed'], 0),
            last_updated: getFieldValue(vehicle, 'lastUpdated', ['last_updated', 'updatedAt']),
            created_at: getFieldValue(vehicle, 'createdAt', ['created_at']),
            updated_at: getFieldValue(vehicle, 'updatedAt', ['updated_at'])
          };
        });

        return {
          success: true,
          data: transformedData
        };
      }

      return {
        success: true,
        data: [],
        message: 'Vehicle not found'
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
      console.log('📝 Creating new vehicle...', vehicleData);
      
      // Transform frontend data to API format
      const apiPayload = {
        vehicleNumber: vehicleData.vehicle_number,
        vehicleManufacturer: vehicleData.manufacturer,
        vehicleModel: vehicleData.model,
        vehicleType: vehicleData.vehicle_type,
        status: vehicleData.status || 'Active'
      };

      console.log('📝 API payload:', apiPayload);
      
      const response = await this.request('/vehicle/v1/register', {
        method: 'POST',
        body: JSON.stringify(apiPayload)
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
      console.log(`🚗 Updating vehicle ${vehicleId}...`, updateData);
      
      // Transform frontend data to API format
      const apiPayload = {
        vehicleNumber: updateData.vehicle_number,
        vehicleManufacturer: updateData.manufacturer,
        vehicleModel: updateData.model,
        vehicleType: updateData.vehicle_type,
        status: updateData.status || 'Active'
      };

      console.log('🚗 API update payload:', apiPayload);
      
      const response = await this.request(`/vehicle/v1/update/${vehicleId}`, {
        method: 'PUT',
        body: JSON.stringify(apiPayload)
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
  // DEVICE ENDPOINTS - ENHANCED FOR COMPLETE DATA
  // ===========================================

  async getDevices(page = 0, size = 20) {
    try {
      console.log('📱 Fetching devices from API...');
      const endpoint = `/device/v1/all?page=${page}&size=${size}`;
      const response = await this.request(endpoint);
      
      if (response && response.data && Array.isArray(response.data)) {
        console.log('🔍 Raw API response for devices:', response.data);
        
        const transformedData = response.data.map(device => {
          console.log('🔍 Processing device:', device);
          
          const transformed = {
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
            // Enhanced telemetry data mapping
            speed: device.speed ? parseFloat(device.speed) : null,
            acceleration: device.acceleration ? parseFloat(device.acceleration) : null,
            drowsiness: Boolean(device.drowsiness),
            rash_driving: Boolean(device.rashDriving || device.rash_driving),
            collision: Boolean(device.collision),
            has_telemetry: !!(device.latitude && device.longitude)
          };
          
          console.log('🔍 Transformed device:', transformed);
          return transformed;
        });
        
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
      console.log('📱 Creating new device...', deviceData);
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
      console.log(`📱 Updating device ${deviceId}...`, updateData);
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

  // Device assignment endpoint
  async assignDevice(deviceId, vehicleId) {
    try {
      console.log(`🔗 Assigning device ${deviceId} to vehicle ${vehicleId}...`);
      
      if (vehicleId === 'unassign' || !vehicleId) {
        // Unassign device
        const response = await this.request(`/device/v1/unassign/${deviceId}`, {
          method: 'PUT'
        });
        return {
          success: true,
          data: response.data,
          message: 'Device unassigned successfully'
        };
      } else {
        // Assign device to vehicle
        const response = await this.request(`/device/v1/assign/${deviceId}/${vehicleId}`, {
          method: 'PUT'
        });
        return {
          success: true,
          data: response.data,
          message: 'Device assigned successfully'
        };
      }
    } catch (error) {
      console.error('❌ Device assignment failed:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  // ===========================================
  // TELEMETRY ENDPOINTS - COMPREHENSIVE DATA FETCHING
  // ===========================================

  async getDeviceTelemetry(deviceId, page = 0, size = 10) {
    const endpoints = [
      `/device/v1/data/${deviceId}?direction=desc&page=${page}&size=${size}`,
      `/device/v1/data/${deviceId}?direction=desc`,
      `/deviceTelemetry/v1/device/${deviceId}?page=${page}&size=${size}`,
      `/telemetry/v1/device/${deviceId}`,
      `/device/v1/telemetry/${deviceId}?page=${page}&size=${size}`
    ];
    
    try {
      console.log(`📊 Fetching telemetry for device ${deviceId}...`);
      
      for (const endpoint of endpoints) {
        try {
          console.log(`🔄 Trying telemetry endpoint: ${endpoint}`);
          const response = await this.request(endpoint);
          
          if (response && response.data && Array.isArray(response.data) && response.data.length > 0) {
            console.log('🔍 Raw telemetry data:', response.data);
            
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
            
            console.log('🔍 Transformed telemetry data:', transformedData);
            
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
  // ALARM/ALERT ENDPOINTS - COMPREHENSIVE DATA FETCHING
  // ===========================================

  async getManagerAlarms(page = 0, size = 50) {
    try {
      console.log('🚨 Fetching manager alarms...');
      const endpoint = `/alarm/v1/manager/all?page=${page}&size=${size}`;
      const response = await this.request(endpoint);
      
      if (response && response.data && Array.isArray(response.data)) {
        console.log('🔍 Raw alarm data:', response.data);
        
        const transformedData = response.data.map(alarm => {
          console.log('🔍 Processing alarm:', alarm);
          
          return {
            alert_id: alarm.alarmId || alarm.alert_id || alarm.id,
            device_id: alarm.deviceId || alarm.device_id,
            vehicle_id: alarm.vehicleId || alarm.vehicle_id,
            alert_type: alarm.alarmType || alarm.alert_type || alarm.type,
            severity: alarm.severity || 'medium',
            message: alarm.message || alarm.description,
            timestamp: alarm.timestamp || alarm.createdAt || new Date().toISOString(),
            status: alarm.status || 'active',
            resolved: alarm.resolved || false,
            latitude: alarm.latitude ? parseFloat(alarm.latitude) : null,
            longitude: alarm.longitude ? parseFloat(alarm.longitude) : null
          };
        });
        
        console.log(`✅ Successfully fetched ${transformedData.length} alarms`);
        console.log('🔍 Transformed alarm data:', transformedData);
        
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
      
      if (response && response.data) {
        const alarmData = Array.isArray(response.data) ? response.data : [response.data];
        console.log('🔍 Device alarm data:', alarmData);
        
        return {
          success: true,
          data: alarmData
        };
      }
      
      return {
        success: true,
        data: [],
        message: 'No alarms found for device'
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
  // AUTH ENDPOINTS - NO MOCK DATA
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
        console.log('✅ Login successful');
        
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

  // ===========================================
  // ADDITIONAL ENDPOINTS FOR COMPREHENSIVE DATA
  // ===========================================

  async getAllData(page = 0, size = 20) {
    try {
      console.log('🌍 Fetching all data from API...');
      
      const [vehiclesResult, devicesResult, alarmsResult] = await Promise.allSettled([
        this.getVehicles(page, size),
        this.getDevices(page, size),
        this.getManagerAlarms(page, size)
      ]);
      
      return {
        vehicles: vehiclesResult.status === 'fulfilled' ? vehiclesResult.value : { success: false, data: [] },
        devices: devicesResult.status === 'fulfilled' ? devicesResult.value : { success: false, data: [] },
        alarms: alarmsResult.status === 'fulfilled' ? alarmsResult.value : { success: false, data: [] }
      };
    } catch (error) {
      console.error('❌ Failed to fetch all data:', error);
      return {
        vehicles: { success: false, data: [] },
        devices: { success: false, data: [] },
        alarms: { success: false, data: [] }
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