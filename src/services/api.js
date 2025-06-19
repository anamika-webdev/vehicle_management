// src/services/api.js - Fixed to use environment configuration

import { config } from '../config/apiConfig';

class ApiService {
  constructor() {
    // Use environment configuration instead of hardcoded URL
    this.baseURL = config.API_BASE_URL;
    this.token = null;
    this.refreshToken = null;
    this.lastSuccessfulEndpoint = null;
    this.connectionStartTime = Date.now();
    
    console.log('🔧 API Service initialized with backend:', this.baseURL);
    console.log('🔧 Environment:', process.env.NODE_ENV);
    console.log('🔧 Using proxy:', process.env.REACT_APP_USE_PROXY);
  }

  // Initialize token from localStorage
  initializeToken() {
    try {
      const token = localStorage.getItem('authToken');
      const refreshToken = localStorage.getItem('refreshToken');
      
      if (token) {
        this.token = token;
        console.log('🔑 Token restored from localStorage');
      }
      
      if (refreshToken) {
        this.refreshToken = refreshToken;
        console.log('🔄 Refresh token restored from localStorage');
      }
    } catch (error) {
      console.warn('⚠️ Error initializing tokens:', error);
    }
  }

  // ===========================================
  // CORE REQUEST HANDLER - ENHANCED
  // ===========================================

  async request(endpoint, options = {}) {
    const url = `${this.baseURL}${endpoint}`;
    const config = {
      headers: {
        'Content-Type': 'application/json',
        ...(this.token && { Authorization: `Bearer ${this.token}` }),
        ...options.headers,
      },
      ...options,
    };

    try {
      console.log(`📡 API Request: ${options.method || 'GET'} ${endpoint}`);
      console.log(`📡 Full URL: ${url}`);
      
      const response = await fetch(url, config);
      console.log(`📡 Response: ${response.status} ${response.statusText}`);
      
      if (!response.ok) {
        let errorMessage;
        let errorData = null;
        
        try {
          const responseText = await response.text();
          
          if (responseText) {
            try {
              errorData = JSON.parse(responseText);
              console.log('📄 Error response data:', errorData);
              
              // Extract meaningful error message
              if (errorData.message) {
                errorMessage = errorData.message;
              } else if (errorData.error) {
                if (typeof errorData.error === 'string') {
                  errorMessage = errorData.error;
                } else if (typeof errorData.error === 'object' && errorData.error.message) {
                  errorMessage = errorData.error.message;
                } else if (typeof errorData.error === 'object') {
                  errorMessage = JSON.stringify(errorData.error);
                } else {
                  errorMessage = 'Unknown error format';
                }
              } else if (errorData.detail) {
                errorMessage = errorData.detail;
              } else {
                errorMessage = `HTTP ${response.status} - ${response.statusText}`;
              }
            } catch (parseError) {
              console.warn('Could not parse error response as JSON:', parseError);
              errorMessage = responseText || `HTTP ${response.status} - ${response.statusText}`;
            }
          } else {
            errorMessage = `HTTP ${response.status} - ${response.statusText}`;
          }
        } catch (readError) {
          console.warn('Could not read error response:', readError);
          errorMessage = `HTTP ${response.status} - ${response.statusText}`;
        }
        
        // Handle specific status codes
        if (response.status === 401) {
          this.handleAuthError();
          throw new Error('Session expired. Please login again.');
        } else if (response.status === 500) {
          console.error('🚨 Server Error 500:', errorMessage);
          throw new Error(`Server error: ${errorMessage}`);
        } else if (response.status === 404) {
          throw new Error(`Not found: ${errorMessage}`);
        } else if (response.status === 403) {
          throw new Error(`Access denied: ${errorMessage}`);
        }
        
        throw new Error(errorMessage);
      }
      
      const data = await response.json();
      console.log(`✅ Success response from ${endpoint}:`, data);
      
      // Update last successful endpoint
      this.lastSuccessfulEndpoint = endpoint;
      
      return data;
      
    } catch (error) {
      console.error(`❌ Request failed for ${endpoint}:`, error.message);
      
      // Handle network errors specifically
      if (error.name === 'TypeError' && error.message.includes('Failed to fetch')) {
        throw new Error('Network error: Cannot connect to server. Please check your internet connection and try again.');
      }
      
      throw error;
    }
  }

  // Handle authentication errors
  handleAuthError() {
    console.warn('🔐 Authentication error - clearing tokens');
    this.token = null;
    this.refreshToken = null;
    localStorage.removeItem('authToken');
    localStorage.removeItem('refreshToken');
    localStorage.removeItem('userData');
  }

  // ===========================================
  // AUTHENTICATION ENDPOINTS
  // ===========================================

  async login(email, password) {
    try {
      console.log('🔐 Attempting login via API...');
      const response = await this.request('/auth/v1/login', {
        method: 'POST',
        body: JSON.stringify({ email, password })
      });

      if (response.token) {
        this.token = response.token;
        if (response.refreshToken) {
          this.refreshToken = response.refreshToken;
        }
        console.log('✅ Login successful, token stored');
      }

      return response;
    } catch (error) {
      console.error('❌ Login failed:', error);
      throw error;
    }
  }

  async register(userData) {
    try {
      console.log('📝 Attempting registration via API...');
      const response = await this.request('/auth/v1/register', {
        method: 'POST',
        body: JSON.stringify(userData)
      });
      return response;
    } catch (error) {
      console.error('❌ Registration failed:', error);
      throw error;
    }
  }

  async logout() {
    try {
      await this.request('/auth/v1/logout', { method: 'POST' });
    } catch (error) {
      console.warn('⚠️ Logout API call failed (endpoint may not exist):', error.message);
    } finally {
      this.handleAuthError();
    }
  }

  // ===========================================
  // HEALTH CHECK
  // ===========================================

  async healthCheck() {
    try {
      console.log('🏥 Performing health check using vehicles endpoint...');
      // Use vehicles endpoint instead of /health since it's working
      const response = await this.request('/vehicle/v1/all?page=0&size=1');
      
      return {
        status: response && response.success ? 'healthy' : 'degraded',
        message: 'API is responsive via vehicles endpoint',
        timestamp: new Date().toISOString(),
        endpoint: this.baseURL
      };
    } catch (error) {
      console.warn('⚠️ Health check failed:', error.message);
      
      // Try basic connectivity test
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
  // VEHICLE ENDPOINTS
  // ===========================================

  async getVehicles(page = 0, size = 20, sortBy = 'vehicleId', direction = 'asc') {
    try {
      console.log('🚗 Fetching vehicles from API...');
      const endpoint = `/vehicle/v1/all?page=${page}&size=${size}&sortBy=${sortBy}&direction=${direction}`;
      const response = await this.request(endpoint);
      
      if (response.data && Array.isArray(response.data)) {
        const transformedData = response.data.map(vehicle => ({
          ...vehicle,
          id: vehicle.vehicleId || vehicle.id,
          name: vehicle.vehicleName || vehicle.name,
          type: vehicle.vehicleType || vehicle.type,
          model: vehicle.vehicleModel || vehicle.model,
          status: vehicle.status || 'Active'
        }));
        
        return {
          success: true,
          data: transformedData,
          totalElements: response.totalElements || transformedData.length,
          totalPages: response.totalPages || 1,
          currentPage: response.number || 0
        };
      }
      
      return {
        success: false,
        data: [],
        message: 'No vehicles found'
      };
      
    } catch (error) {
      console.error('❌ Failed to fetch vehicles:', error);
      throw error;
    }
  }

  async registerVehicle(vehicleData) {
    try {
      console.log('📝 Registering new vehicle...');
      const response = await this.request('/vehicle/v1/register', {
        method: 'POST',
        body: JSON.stringify(vehicleData)
      });
      return response;
    } catch (error) {
      console.error('❌ Vehicle registration failed:', error);
      throw error;
    }
  }

  // ===========================================
  // DEVICE ENDPOINTS
  // ===========================================

  async getDevices(page = 0, size = 20) {
    try {
      console.log('📱 Fetching devices from API...');
      const endpoint = `/device/v1/all?page=${page}&size=${size}`;
      const response = await this.request(endpoint);
      
      if (response.data && Array.isArray(response.data)) {
        return {
          success: true,
          data: response.data,
          totalElements: response.totalElements || response.data.length,
          totalPages: response.totalPages || 1,
          currentPage: response.number || 0
        };
      }
      
      return {
        success: false,
        data: [],
        message: 'No devices found'
      };
      
    } catch (error) {
      console.error('❌ Failed to fetch devices:', error);
      throw error;
    }
  }

  // ===========================================
  // ALARM ENDPOINTS
  // ===========================================

  async getManagerAlarms(page = 0, size = 20, sortBy = 'alarmId', direction = 'desc') {
    try {
      console.log('🚨 Fetching manager alarms from API...');
      const endpoint = `/alarm/v1/manager/all?page=${page}&size=${size}&sortBy=${sortBy}&direction=${direction}`;
      const response = await this.request(endpoint);
      
      if (response.data && Array.isArray(response.data)) {
        const transformedData = response.data.map(alarm => ({
          alarm_id: alarm.alarmId || alarm.alarm_id,
          device_id: alarm.deviceId || alarm.device_id,
          alarm_type: alarm.alarmType || alarm.alarm_type || 'System Alert',
          description: alarm.description || 'Alert detected',
          latitude: alarm.latitude ? parseFloat(alarm.latitude) : null,
          longitude: alarm.longitude ? parseFloat(alarm.longitude) : null,
          acceleration: alarm.acceleration ? parseFloat(alarm.acceleration) : null,
          drowsiness: Boolean(alarm.drowsiness),
          rash_driving: Boolean(alarm.rashDriving || alarm.rash_driving),
          collision: Boolean(alarm.collision),
          severity: alarm.severity || 'medium',
          status: alarm.status || 'active',
          created_at: alarm.createdAt || alarm.created_at || new Date().toISOString()
        }));
        
        console.log(`✅ Found ${transformedData.length} alarms`);
        
        return {
          success: true,
          data: transformedData,
          totalElements: response.totalElements || transformedData.length,
          message: `Found ${transformedData.length} alarms`
        };
      }
      
      return { success: true, data: [], message: 'No alarms found' };
    } catch (error) {
      console.error('❌ Failed to fetch manager alarms:', error);
      return { success: false, data: [], error: error.message };
    }
  }

  async getDeviceAlarms(deviceId, page = 0, size = 20, sortBy = 'deviceId', direction = 'desc') {
    try {
      console.log(`🚨 Fetching alarms for device ${deviceId} from API...`);
      const endpoint = `/alarm/v1/device/${deviceId}?page=${page}&size=${size}&sortBy=${sortBy}&direction=${direction}`;
      const response = await this.request(endpoint);
      
      if (response.data && Array.isArray(response.data)) {
        const transformedData = response.data.map(alarm => ({
          alarm_id: alarm.alarmId || alarm.alarm_id,
          device_id: alarm.deviceId || alarm.device_id,
          alarm_type: alarm.alarmType || alarm.alarm_type || 'Device Alert',
          description: alarm.description || 'Device alert detected',
          latitude: alarm.latitude ? parseFloat(alarm.latitude) : null,
          longitude: alarm.longitude ? parseFloat(alarm.longitude) : null,
          severity: alarm.severity || 'medium',
          status: alarm.status || 'active',
          created_at: alarm.createdAt || alarm.created_at || new Date().toISOString()
        }));
        
        return {
          success: true,
          data: transformedData,
          message: `Found ${transformedData.length} device alarms`
        };
      }
      
      return { success: true, data: [], message: 'No device alarms found' };
    } catch (error) {
      console.error(`❌ Failed to fetch alarms for device ${deviceId}:`, error);
      return { 
        success: false, 
        data: [], 
        error: error.message,
        message: `Could not fetch alarms for device ${deviceId}: ${error.message}`
      };
    }
  }

  async createAlarm(alarmData) {
    try {
      console.log('🚨 Creating alarm via API...');
      const response = await this.request('/alarm/v1/create', {
        method: 'POST',
        body: JSON.stringify({
          deviceId: alarmData.device_id || alarmData.deviceId,
          acceleration: alarmData.acceleration,
          latitude: alarmData.latitude,
          longitude: alarmData.longitude,
          drowsiness: alarmData.drowsiness,
          rashDriving: alarmData.rash_driving || alarmData.rashDriving,
          collision: alarmData.collision,
          alarmType: alarmData.alarm_type || alarmData.alarmType,
          description: alarmData.description
        })
      });
      return response;
    } catch (error) {
      console.error('❌ Failed to create alarm:', error);
      throw error;
    }
  }

  // ===========================================
  // TELEMETRY ENDPOINTS
  // ===========================================

  async getDeviceTelemetry(deviceId, page = 0, size = 20) {
    try {
      console.log(`📊 Fetching telemetry for device ${deviceId}...`);
      
      // Try multiple endpoints to find working telemetry data
      const endpoints = [
        `/device/v1/data/${deviceId}?direction=desc&size=${size}`,
        `/device/v1/data/${deviceId}?page=${page}&size=${size}`,
        `/deviceTelemetry/v1/device/${deviceId}?page=${page}&size=${size}`
      ];
      
      for (const endpoint of endpoints) {
        try {
          const response = await this.request(endpoint);
          
          if (response.data && Array.isArray(response.data) && response.data.length > 0) {
            const transformedData = response.data.map(item => ({
              id: item.id || `temp_${Date.now()}_${Math.random()}`,
              device_id: item.device_id || item.deviceId,
              vehicle_id: item.vehicle_id || item.vehicleId,
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
}

// Create and export single instance
const apiService = new ApiService();
export default apiService;