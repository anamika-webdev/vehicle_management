// Complete Updated API Service for Driver Tracking API with Enhanced Error Handling
// src/services/api.js

const API_BASE = 'http://164.52.194.198:9090';

class ApiService {
  constructor() {
    this.baseURL = API_BASE;
    this.token = null;
    this.refreshToken = null;
    this.lastSuccessfulEndpoint = null;
    this.connectionStartTime = Date.now();
    console.log('🔧 API Service initialized with backend:', this.baseURL);
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
              
              // Extract meaningful error message - FIXED [object Object] issue
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
  // VEHICLE ENDPOINTS
  // ===========================================

  async getVehicles(page = 0, size = 20, sortBy = 'vehicleId', direction = 'asc') {
    try {
      console.log('🚗 Fetching vehicles from API...');
      const endpoint = `/vehicle/v1/all?page=${page}&size=${size}&sortBy=${sortBy}&direction=${direction}`;
      const response = await this.request(endpoint);
      
      if (response.data && Array.isArray(response.data)) {
        const transformedData = response.data.map(vehicle => ({
          vehicle_id: vehicle.vehicleId || vehicle.vehicle_id,
          manufacturer: vehicle.manufacturer,
          model: vehicle.model,
          vehicle_type: vehicle.vehicleType || vehicle.vehicle_type,
          vehicle_number: vehicle.vehicleNumber || vehicle.vehicle_number,
          status: vehicle.status || 'Active',
          created_at: vehicle.createdAt || vehicle.created_at,
          updated_at: vehicle.updatedAt || vehicle.updated_at
        }));
        
        return {
          success: true,
          data: transformedData,
          totalElements: response.totalElements || transformedData.length,
          message: `Found ${transformedData.length} vehicles`
        };
      }
      
      return { success: true, data: [], message: 'No vehicles found' };
    } catch (error) {
      console.error('❌ Failed to fetch vehicles:', error);
      return { success: false, data: [], error: error.message };
    }
  }

  async createVehicle(vehicleData) {
    try {
      console.log('🚗 Creating vehicle via API...');
      const response = await this.request('/vehicle/v1/register', {
        method: 'POST',
        body: JSON.stringify({
          manufacturer: vehicleData.manufacturer,
          vehicleType: vehicleData.vehicle_type || vehicleData.vehicleType,
          model: vehicleData.model,
          vehicleNumber: vehicleData.vehicle_number || vehicleData.vehicleNumber
        })
      });
      return response;
    } catch (error) {
      console.error('❌ Failed to register vehicle:', error);
      throw error;
    }
  }

  async updateVehicle(id, vehicleData) {
    try {
      console.log(`🚗 Updating vehicle ${id} via API...`);
      const response = await this.request(`/vehicle/v1/update/${id}`, {
        method: 'PATCH',
        body: JSON.stringify({
          vehicleId: id,
          manufacturer: vehicleData.manufacturer,
          model: vehicleData.model,
          vehicleType: vehicleData.vehicle_type || vehicleData.vehicleType,
          vehicleNumber: vehicleData.vehicle_number || vehicleData.vehicleNumber
        })
      });
      return response;
    } catch (error) {
      console.error(`❌ Failed to update vehicle ${id}:`, error);
      throw error;
    }
  }

  async deleteVehicle(id) {
    try {
      console.log(`🚗 Deleting vehicle ${id} via API...`);
      const response = await this.request(`/vehicle/v1/delete/${id}`, {
        method: 'DELETE'
      });
      return response;
    } catch (error) {
      console.error(`❌ Failed to delete vehicle ${id}:`, error);
      throw error;
    }
  }

  // ===========================================
  // DEVICE ENDPOINTS  
  // ===========================================

  async getDevices(page = 0, size = 20, sortBy = 'deviceId', direction = 'asc') {
    try {
      console.log('📱 Fetching devices from API...');
      const endpoint = `/device/v1/all?page=${page}&size=${size}&sortBy=${sortBy}&direction=${direction}`;
      const response = await this.request(endpoint);
      
      if (response.data && Array.isArray(response.data)) {
        const transformedData = response.data.map(device => ({
          device_id: device.deviceId || device.device_id,
          device_name: device.deviceName || device.device_name,
          device_type: device.deviceType || device.device_type,
          status: device.status || 'Active',
          vehicle_id: device.vehicleId || device.vehicle_id,
          installed_at: device.installedAt || device.installed_at,
          created_at: device.createdAt || device.created_at,
          updated_at: device.updatedAt || device.updated_at,
          // Initialize location data as null - will be populated by telemetry
          latitude: null,
          longitude: null,
          acceleration: null,
          drowsiness: false,
          rash_driving: false,
          collision: false,
          last_updated: null
        }));
        
        console.log(`✅ Transformed ${transformedData.length} devices`);
        
        return {
          success: true,
          data: transformedData,
          totalElements: response.totalElements || transformedData.length,
          message: `Found ${transformedData.length} devices`
        };
      }
      
      return { success: true, data: [], message: 'No devices found' };
    } catch (error) {
      console.error('❌ Failed to fetch devices:', error);
      return { success: false, data: [], error: error.message };
    }
  }

  async getDeviceById(id) {
    try {
      console.log(`📱 Fetching device ${id} from API...`);
      const response = await this.request(`/device/v1/${id}`);
      return response;
    } catch (error) {
      console.error(`❌ Failed to fetch device ${id}:`, error);
      throw error;
    }
  }

  async createDevice(deviceData) {
    try {
      console.log('📱 Creating device via API...');
      const response = await this.request('/device/v1/register', {
        method: 'POST',
        body: JSON.stringify({
          deviceName: deviceData.device_name || deviceData.deviceName,
          deviceType: deviceData.device_type || deviceData.deviceType,
          status: deviceData.status || 'Active',
          vehicleId: deviceData.vehicle_id || deviceData.vehicleId
        })
      });
      return response;
    } catch (error) {
      console.error('❌ Failed to register device:', error);
      throw error;
    }
  }

  async updateDevice(id, deviceData) {
    try {
      console.log(`📱 Updating device ${id} via API...`);
      const response = await this.request(`/device/v1/update/${id}`, {
        method: 'PATCH',
        body: JSON.stringify({
          deviceId: id,
          deviceName: deviceData.device_name || deviceData.deviceName,
          deviceType: deviceData.device_type || deviceData.deviceType,
          status: deviceData.status,
          installedAt: deviceData.installed_at || deviceData.installedAt,
          vehicleId: deviceData.vehicle_id || deviceData.vehicleId
        })
      });
      return response;
    } catch (error) {
      console.error(`❌ Failed to update device ${id}:`, error);
      throw error;
    }
  }

  async deleteDevice(id) {
    try {
      console.log(`📱 Deleting device ${id} via API...`);
      const response = await this.request(`/device/v1/delete/${id}`, {
        method: 'DELETE'
      });
      return response;
    } catch (error) {
      console.error(`❌ Failed to delete device ${id}:`, error);
      throw error;
    }
  }

  // ===========================================
  // DEVICE TELEMETRY ENDPOINTS - ENHANCED WITH FALLBACK
  // ===========================================

  async getDeviceTelemetry(deviceId, page = 0, size = 20, sortBy = 'id', direction = 'desc') {
    try {
      console.log(`📊 Fetching telemetry for device ${deviceId} from API...`);
      
      // List of alternative endpoints to try (in order of preference)
      const endpointsToTry = [
        // Primary endpoint (currently failing with 500)
        `/device/v1/data/${deviceId}?page=${page}&size=${size}&sortBy=${sortBy}&direction=${direction}`,
        
        // Alternative formats
        `/device/v1/data/${deviceId}?direction=${direction}`,
        `/device/v1/data/${deviceId}`,
        `/deviceTelemetry/v1/device/${deviceId}?page=${page}&size=${size}&direction=${direction}`,
        `/device/v1/${deviceId}/telemetry?page=${page}&size=${size}&direction=${direction}`,
        `/telemetry/v1/device/${deviceId}?direction=${direction}`,
        `/device/v1/${deviceId}/data`,
        `/device/v1/${deviceId}/history`,
        `/device/v1/${deviceId}/sensors`
      ];
      
      let lastError = null;
      
      // Try each endpoint until one works
      for (const endpoint of endpointsToTry) {
        try {
          console.log(`🔄 Trying telemetry endpoint: ${endpoint}`);
          const response = await this.request(endpoint);
          
          // If we get here, the request succeeded
          console.log(`✅ Telemetry endpoint worked: ${endpoint}`);
          
          // Handle different response formats
          let telemetryData = [];
          
          if (response.data && Array.isArray(response.data)) {
            telemetryData = response.data;
          } else if (Array.isArray(response)) {
            telemetryData = response;
          } else if (response.content && Array.isArray(response.content)) {
            telemetryData = response.content;
          } else if (response.success === false) {
            // API returned success: false, try next endpoint
            console.warn(`API returned success: false for ${endpoint}, trying next...`);
            continue;
          }
          
          // Transform telemetry data to expected format
          const transformedData = telemetryData.map(item => ({
            id: item.id || item.telemetryId || `temp_${Date.now()}_${Math.random()}`,
            telemetry_id: item.id || item.telemetryId,
            device_id: item.deviceId || item.device_id || deviceId,
            vehicle_id: item.vehicleId || item.vehicle_id,
            
            // Location data
            latitude: item.latitude ? parseFloat(item.latitude) : null,
            longitude: item.longitude ? parseFloat(item.longitude) : null,
            
            // Motion data
            speed: item.speed ? parseFloat(item.speed) : null,
            acceleration: item.acceleration ? parseFloat(item.acceleration) : null,
            
            // Safety indicators
            drowsiness: Boolean(item.drowsiness),
            rash_driving: Boolean(item.rashDriving || item.rash_driving),
            collision: Boolean(item.collision),
            
            // Device status
            battery_voltage: item.batteryVoltage || item.battery_voltage ? parseFloat(item.batteryVoltage || item.battery_voltage) : null,
            signal_strength: item.signalStrength || item.signal_strength ? parseFloat(item.signalStrength || item.signal_strength) : null,
            
            // Timestamps
            timestamp: item.timestamp || item.createdAt || item.created_at || new Date().toISOString()
          }));
          
          console.log(`✅ Found ${transformedData.length} telemetry records for device ${deviceId} via ${endpoint}`);
          
          return {
            success: true,
            data: transformedData,
            totalElements: response.totalElements || response.total || transformedData.length,
            totalPages: response.totalPages || Math.ceil((response.totalElements || transformedData.length) / size),
            currentPage: response.number || response.page || page,
            message: `Found ${transformedData.length} telemetry records`,
            endpoint_used: endpoint // Track which endpoint worked
          };
          
        } catch (endpointError) {
          console.warn(`❌ Telemetry endpoint failed: ${endpoint} - ${endpointError.message}`);
          lastError = endpointError;
          
          // If it's a 500 error, continue to next endpoint
          // If it's a 404, the endpoint doesn't exist, continue
          // If it's a 401, authentication issue, stop trying
          if (endpointError.message.includes('401') || endpointError.message.includes('Session expired')) {
            console.error('🚫 Authentication failed, stopping endpoint attempts');
            break; // Don't try other endpoints if auth fails
          }
          
          continue; // Try next endpoint
        }
      }
      
      // If all endpoints failed, return graceful fallback
      console.warn(`⚠️ All telemetry endpoints failed for device ${deviceId}, using fallback`);
      
      return {
        success: false,
        data: [],
        totalElements: 0,
        totalPages: 0,
        currentPage: 0,
        error: lastError?.message || 'All telemetry endpoints failed',
        message: `No telemetry data available for device ${deviceId}`,
        fallback_used: true,
        attempted_endpoints: endpointsToTry
      };
      
    } catch (error) {
      console.error(`❌ Critical telemetry fetch error for device ${deviceId}:`, error);
      
      return {
        success: false,
        data: [],
        totalElements: 0,
        totalPages: 0,
        currentPage: 0,
        error: error.message,
        message: `Failed to fetch telemetry: ${error.message}`,
        critical_error: true
      };
    }
  }

  // Enhanced getLatestDeviceTelemetry with fallback
  async getLatestDeviceTelemetry(deviceId) {
    try {
      console.log(`📊 Fetching latest telemetry for device ${deviceId}...`);
      const response = await this.getDeviceTelemetry(deviceId, 0, 1, 'id', 'desc');
      
      if (response.success && response.data.length > 0) {
        return {
          success: true,
          data: response.data[0],
          message: 'Latest telemetry data retrieved',
          endpoint_used: response.endpoint_used
        };
      }
      
      // If no telemetry data, return placeholder data structure
      return {
        success: false,
        data: null,
        message: 'No telemetry data found for device',
        fallback_used: response.fallback_used || false,
        error: response.error,
        attempted_endpoints: response.attempted_endpoints
      };
      
    } catch (error) {
      console.error(`❌ Failed to fetch latest telemetry for device ${deviceId}:`, error);
      
      return {
        success: false,
        data: null,
        error: error.message,
        message: 'Failed to fetch latest telemetry data'
      };
    }
  }

  async createDeviceTelemetry(telemetryData) {
    try {
      console.log('📊 Creating device telemetry via API...');
      
      const response = await this.request('/device/v1/data/create', {
        method: 'POST',
        body: JSON.stringify({
          deviceId: telemetryData.device_id || telemetryData.deviceId,
          vehicleId: telemetryData.vehicle_id || telemetryData.vehicleId,
          latitude: telemetryData.latitude,
          longitude: telemetryData.longitude,
          speed: telemetryData.speed,
          acceleration: telemetryData.acceleration,
          drowsiness: telemetryData.drowsiness,
          rashDriving: telemetryData.rash_driving || telemetryData.rashDriving,
          collision: telemetryData.collision,
          batteryVoltage: telemetryData.battery_voltage || telemetryData.batteryVoltage,
          signalStrength: telemetryData.signal_strength || telemetryData.signalStrength
        })
      });
      
      return response;
    } catch (error) {
      console.error('❌ Failed to create telemetry:', error);
      throw error;
    }
  }

  // Test telemetry endpoint availability
  async testTelemetryEndpoint(deviceId) {
    const endpointsToTest = [
      `/device/v1/data/${deviceId}?direction=desc`,
      `/device/v1/data/${deviceId}?page=0&size=1&direction=desc`,
      `/device/v1/data/${deviceId}`,
      `/deviceTelemetry/v1/device/${deviceId}`,
      `/device/v1/${deviceId}/telemetry`,
      `/telemetry/v1/device/${deviceId}`,
      `/device/v1/${deviceId}/data`,
      `/device/v1/${deviceId}/history`
    ];
    
    const results = [];
    
    for (const endpoint of endpointsToTest) {
      try {
        console.log(`🧪 Testing endpoint: ${endpoint}`);
        const response = await this.request(endpoint);
        
        results.push({
          endpoint: endpoint,
          status: 'success',
          hasData: !!(response.data && response.data.length > 0),
          response: response
        });
        
      } catch (error) {
        results.push({
          endpoint: endpoint,
          status: 'error',
          error: error.message,
          hasData: false
        });
        console.warn(`❌ Endpoint test failed: ${endpoint} - ${error.message}`);
      }
    }
    
    const workingEndpoints = results.filter(r => r.status === 'success');
    
    return {
      success: workingEndpoints.length > 0,
      workingEndpoints: workingEndpoints,
      allResults: results,
      message: workingEndpoints.length > 0 
        ? `Found ${workingEndpoints.length} working endpoints` 
        : 'No working telemetry endpoints found'
    };
  }

  // ===========================================
  // ALARM ENDPOINTS - ENHANCED WITH ERROR HANDLING
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
      // Don't throw error, return graceful response
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
  // HEALTH CHECK
  // ===========================================

  async healthCheck() {
    try {
      console.log('🔍 Performing health check...');
      const response = await this.request('/vehicle/v1/all?page=0&size=1');
      
      return {
        status: response ? 'healthy' : 'degraded',
        message: 'API is responsive',
        timestamp: new Date().toISOString(),
        endpoint: this.baseURL
      };
    } catch (error) {
      console.warn('⚠️ Health check failed:', error.message);
      
      try {
        const basicResponse = await fetch(`${this.baseURL}/health`).catch(() => null);
        if (basicResponse && basicResponse.ok) {
          return {
            status: 'degraded',
            message: 'Server reachable but authentication may be required',
            timestamp: new Date().toISOString(),
            endpoint: this.baseURL
          };
        }
      } catch (e) {
        // Ignore
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
  // UTILITY METHODS - ENHANCED
  // ===========================================

  // Graceful device data merging - use this in DataContext
  mergeDeviceWithTelemetry(device, telemetryResponse) {
    // Always return the device, with or without telemetry
    const baseDevice = {
      ...device,
      has_telemetry: false,
      telemetry_status: 'no_data',
      last_telemetry_attempt: new Date().toISOString()
    };
    
    if (telemetryResponse.success && telemetryResponse.data) {
      const telemetry = telemetryResponse.data;
      return {
        ...baseDevice,
        // Merge telemetry data
        latitude: telemetry.latitude || device.latitude,
        longitude: telemetry.longitude || device.longitude,
        speed: telemetry.speed,
        acceleration: telemetry.acceleration || device.acceleration,
        drowsiness: telemetry.drowsiness,
        rash_driving: telemetry.rash_driving,
        collision: telemetry.collision,
        battery_voltage: telemetry.battery_voltage || device.battery_voltage,
        signal_strength: telemetry.signal_strength || device.signal_strength,
        last_updated: telemetry.timestamp,
        has_telemetry: true,
        telemetry_status: 'active',
        telemetry_endpoint: telemetryResponse.endpoint_used
      };
    } else if (telemetryResponse.fallback_used) {
      return {
        ...baseDevice,
        telemetry_status: 'endpoint_failed',
        telemetry_error: telemetryResponse.error,
        attempted_endpoints: telemetryResponse.attempted_endpoints
      };
    } else if (telemetryResponse.critical_error) {
      return {
        ...baseDevice,
        telemetry_status: 'critical_error',
        telemetry_error: telemetryResponse.error
      };
    }
    
    return baseDevice;
  }

  // Get all devices with their latest telemetry data - Enhanced
  async getAllDevicesWithTelemetry() {
    try {
      console.log('📊 Fetching all devices with telemetry data...');
      
      // First get all devices
      const devicesResponse = await this.getDevices();
      
      if (!devicesResponse.success || !devicesResponse.data) {
        return devicesResponse;
      }
      
      // Then fetch latest telemetry for each device with error handling
      const devicesWithTelemetry = await Promise.all(
        devicesResponse.data.map(async (device) => {
          try {
            const telemetryResponse = await this.getLatestDeviceTelemetry(device.device_id);
            return this.mergeDeviceWithTelemetry(device, telemetryResponse);
          } catch (error) {
            console.warn(`⚠️ Telemetry fetch failed for device ${device.device_id}:`, error.message);
            return {
              ...device,
              has_telemetry: false,
              telemetry_status: 'fetch_error',
              telemetry_error: error.message,
              last_telemetry_attempt: new Date().toISOString()
            };
          }
        })
      );
      
      const telemetryStats = {
        total_devices: devicesWithTelemetry.length,
        with_telemetry: devicesWithTelemetry.filter(d => d.has_telemetry).length,
        endpoint_failed: devicesWithTelemetry.filter(d => d.telemetry_status === 'endpoint_failed').length,
        critical_errors: devicesWithTelemetry.filter(d => d.telemetry_status === 'critical_error').length,
        fetch_errors: devicesWithTelemetry.filter(d => d.telemetry_status === 'fetch_error').length
      };
      
      console.log('📊 Telemetry summary:', telemetryStats);
      
      return {
        success: true,
        data: devicesWithTelemetry,
        telemetry_stats: telemetryStats,
        message: `Retrieved ${devicesWithTelemetry.length} devices (${telemetryStats.with_telemetry} with telemetry)`
      };
      
    } catch (error) {
      console.error('❌ Failed to fetch devices with telemetry:', error);
      return {
        success: false,
        data: [],
        error: error.message,
        message: `Failed to fetch devices with telemetry: ${error.message}`
      };
    }
  }

  // Enhanced data fetching that combines devices with telemetry
  async getAllDataWithTelemetry() {
    try {
      console.log('🔄 Fetching all data with telemetry...');
      
      // Fetch main data in parallel
      const [vehiclesResponse, devicesResponse, alarmsResponse] = await Promise.allSettled([
        this.getVehicles(),
        this.getDevices(),
        this.getManagerAlarms()
      ]);

      const vehicles = vehiclesResponse.status === 'fulfilled' && vehiclesResponse.value.success ? 
        vehiclesResponse.value.data : [];
      const devices = devicesResponse.status === 'fulfilled' && devicesResponse.value.success ? 
        devicesResponse.value.data : [];
      const alerts = alarmsResponse.status === 'fulfilled' && alarmsResponse.value.success ? 
        alarmsResponse.value.data : [];

      // For each device, fetch latest telemetry data with enhanced error handling
      const devicesWithTelemetry = await Promise.all(
        devices.map(async (device) => {
          try {
            const telemetryResponse = await this.getLatestDeviceTelemetry(device.device_id);
            return this.mergeDeviceWithTelemetry(device, telemetryResponse);
          } catch (error) {
            console.warn(`⚠️ Telemetry failed for device ${device.device_id}:`, error.message);
            return {
              ...device,
              has_telemetry: false,
              telemetry_status: 'error',
              telemetry_error: error.message
            };
          }
        })
      );

      const telemetryStats = {
        total_devices: devicesWithTelemetry.length,
        with_telemetry: devicesWithTelemetry.filter(d => d.has_telemetry).length,
        failed_telemetry: devicesWithTelemetry.filter(d => !d.has_telemetry).length
      };

      console.log('✅ Successfully fetched all data with telemetry:', telemetryStats);
      
      return {
        vehicles,
        devices: devicesWithTelemetry,
        alerts,
        telemetry_stats: telemetryStats,
        success: true
      };
    } catch (error) {
      console.error('❌ Failed to fetch all data with telemetry:', error);
      throw error;
    }
  }

  // ===========================================
  // DEBUGGING AND TESTING METHODS
  // ===========================================

  // Test API connectivity and endpoints
  async runAPITests() {
    const results = {
      connection: null,
      authentication: null,
      vehicles: null,
      devices: null,
      telemetry: null,
      alarms: null
    };

    console.log('🧪 Running comprehensive API tests...');

    // Test 1: Basic connection
    try {
      const response = await fetch(this.baseURL, { method: 'HEAD' });
      results.connection = { 
        status: 'success', 
        message: `API server is reachable (${response.status})` 
      };
    } catch (error) {
      results.connection = { 
        status: 'error', 
        message: `Cannot reach API server: ${error.message}` 
      };
    }

    // Test 2: Authentication status
    if (this.token) {
      try {
        const response = await this.healthCheck();
        results.authentication = { 
          status: response.status === 'healthy' ? 'success' : 'warning', 
          message: `Token valid: ${response.message}` 
        };
      } catch (error) {
        results.authentication = { 
          status: 'error', 
          message: `Authentication failed: ${error.message}` 
        };
      }
    } else {
      results.authentication = { 
        status: 'warning', 
        message: 'No authentication token found' 
      };
    }

    // Test 3: Vehicles endpoint
    try {
      const vehiclesTest = await this.getVehicles(0, 1);
      results.vehicles = { 
        status: vehiclesTest.success ? 'success' : 'error', 
        message: `Vehicles: ${vehiclesTest.message}`,
        count: vehiclesTest.data?.length || 0
      };
    } catch (error) {
      results.vehicles = { 
        status: 'error', 
        message: `Vehicles endpoint failed: ${error.message}` 
      };
    }

    // Test 4: Devices endpoint
    try {
      const devicesTest = await this.getDevices(0, 1);
      results.devices = { 
        status: devicesTest.success ? 'success' : 'error', 
        message: `Devices: ${devicesTest.message}`,
        count: devicesTest.data?.length || 0
      };
    } catch (error) {
      results.devices = { 
        status: 'error', 
        message: `Devices endpoint failed: ${error.message}` 
      };
    }

    // Test 5: Telemetry endpoint (if devices exist)
    try {
      const devicesResponse = await this.getDevices(0, 1);
      if (devicesResponse.success && devicesResponse.data.length > 0) {
        const firstDeviceId = devicesResponse.data[0].device_id;
        const telemetryTest = await this.getDeviceTelemetry(firstDeviceId, 0, 1);
        results.telemetry = { 
          status: telemetryTest.success ? 'success' : 'warning', 
          message: `Telemetry for device ${firstDeviceId}: ${telemetryTest.message}`,
          endpoint_used: telemetryTest.endpoint_used,
          attempted_endpoints: telemetryTest.attempted_endpoints?.length || 0
        };
      } else {
        results.telemetry = { 
          status: 'warning', 
          message: 'No devices available to test telemetry' 
        };
      }
    } catch (error) {
      results.telemetry = { 
        status: 'error', 
        message: `Telemetry endpoint failed: ${error.message}` 
      };
    }

    // Test 6: Alarms endpoint
    try {
      const alarmsTest = await this.getManagerAlarms(0, 1);
      results.alarms = { 
        status: alarmsTest.success ? 'success' : 'error', 
        message: `Alarms: ${alarmsTest.message}`,
        count: alarmsTest.data?.length || 0
      };
    } catch (error) {
      results.alarms = { 
        status: 'error', 
        message: `Alarms endpoint failed: ${error.message}` 
      };
    }

    console.log('🧪 API tests completed:', results);
    return results;
  }

  // Create sample telemetry data for testing
  async createSampleTelemetryData(deviceId, count = 5) {
    const sampleData = [];
    
    console.log(`📊 Creating ${count} sample telemetry records for device ${deviceId}...`);
    
    for (let i = 0; i < count; i++) {
      try {
        const telemetryData = {
          device_id: deviceId,
          latitude: 28.6139 + (Math.random() - 0.5) * 0.01, // Around Delhi
          longitude: 77.2090 + (Math.random() - 0.5) * 0.01,
          speed: Math.random() * 80, // 0-80 km/h
          acceleration: (Math.random() - 0.5) * 4, // -2 to +2 m/s²
          drowsiness: Math.random() > 0.9, // 10% chance
          rash_driving: Math.random() > 0.85, // 15% chance
          collision: Math.random() > 0.98, // 2% chance
          battery_voltage: 11.5 + Math.random() * 1.5, // 11.5-13V
          signal_strength: 60 + Math.random() * 40 // 60-100%
        };
        
        const result = await this.createDeviceTelemetry(telemetryData);
        sampleData.push(result);
        
        // Small delay between creations
        await new Promise(resolve => setTimeout(resolve, 200));
        
      } catch (error) {
        console.warn(`Failed to create sample telemetry ${i + 1}:`, error.message);
        sampleData.push({ success: false, error: error.message });
      }
    }
    
    const successCount = sampleData.filter(d => d.success).length;
    console.log(`✅ Created ${successCount}/${count} sample telemetry records for device ${deviceId}`);
    return sampleData;
  }

  // Get API statistics and status
  getAPIStatus() {
    const tokenExpiry = this.getTokenExpiry();
    
    return {
      baseURL: this.baseURL,
      hasToken: !!this.token,
      hasRefreshToken: !!this.refreshToken,
      tokenValid: tokenExpiry ? !tokenExpiry.isExpired : false,
      tokenExpiry: tokenExpiry,
      lastSuccessfulEndpoint: this.lastSuccessfulEndpoint,
      connectionStartTime: this.connectionStartTime,
      uptime: Date.now() - this.connectionStartTime,
      uptimeFormatted: this.formatUptime(Date.now() - this.connectionStartTime)
    };
  }

  // Get token expiry information
  getTokenExpiry() {
    if (!this.token) return null;
    
    try {
      const tokenPayload = JSON.parse(atob(this.token.split('.')[1]));
      const currentTime = Date.now() / 1000;
      
      return {
        exp: tokenPayload.exp,
        iat: tokenPayload.iat,
        expiryDate: new Date(tokenPayload.exp * 1000),
        issuedDate: new Date(tokenPayload.iat * 1000),
        isExpired: tokenPayload.exp < currentTime,
        timeUntilExpiry: Math.max(0, tokenPayload.exp - currentTime),
        timeUntilExpiryFormatted: this.formatDuration(Math.max(0, tokenPayload.exp - currentTime))
      };
    } catch (error) {
      return { error: 'Could not decode token' };
    }
  }

  // Helper method to format uptime
  formatUptime(milliseconds) {
    const seconds = Math.floor(milliseconds / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);
    
    if (days > 0) return `${days}d ${hours % 24}h ${minutes % 60}m`;
    if (hours > 0) return `${hours}h ${minutes % 60}m ${seconds % 60}s`;
    if (minutes > 0) return `${minutes}m ${seconds % 60}s`;
    return `${seconds}s`;
  }

  // Helper method to format duration
  formatDuration(seconds) {
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);
    
    if (days > 0) return `${days}d ${hours % 24}h`;
    if (hours > 0) return `${hours}h ${minutes % 60}m`;
    if (minutes > 0) return `${minutes}m`;
    return `${Math.floor(seconds)}s`;
  }

  // Generate mock telemetry for testing UI
  generateMockTelemetry(deviceId, count = 10) {
    console.log(`🎭 Generating ${count} mock telemetry records for device ${deviceId}`);
    
    const mockData = [];
    const baseTime = Date.now();
    
    for (let i = 0; i < count; i++) {
      mockData.push({
        id: `mock_${deviceId}_${i}`,
        device_id: deviceId,
        latitude: 28.6139 + (Math.random() - 0.5) * 0.01,
        longitude: 77.2090 + (Math.random() - 0.5) * 0.01,
        speed: Math.random() * 60,
        acceleration: (Math.random() - 0.5) * 2,
        drowsiness: Math.random() > 0.9,
        rash_driving: Math.random() > 0.85,
        collision: false,
        battery_voltage: 11.5 + Math.random() * 1.5,
        signal_strength: 60 + Math.random() * 40,
        timestamp: new Date(baseTime - (i * 60000)).toISOString(), // 1 minute intervals
        mock: true
      });
    }
    
    return {
      success: true,
      data: mockData,
      totalElements: mockData.length,
      message: `Generated ${mockData.length} mock telemetry records`,
      mock_data: true
    };
  }
}

// Create and export singleton instance
const apiService = new ApiService();

// Initialize token on startup
try {
  apiService.initializeToken();
} catch (error) {
  console.warn('⚠️ Token initialization failed:', error);
}

export default apiService;