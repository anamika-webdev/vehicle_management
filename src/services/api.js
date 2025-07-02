import { toast } from 'react-toastify';
import { config } from '../config/apiConfig';

class ApiService {
  constructor() {
    this.baseURL = config.API_BASE_URL || 'http://164.52.194.198:9090';
    this.token = localStorage.getItem('authToken') || null;
    this.lastSuccessfulEndpoint = null;
  }

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
      toast.error(`Request failed: ${error.message}`);
      throw error;
    }
  }

  async healthCheck() {
    try {
      console.log('🏥 Performing health check...');
      const response = await this.request('/health');
      return {
        status: response ? 'healthy' : 'degraded',
        message: 'API is responsive via health endpoint',
        timestamp: new Date().toISOString(),
        endpoint: this.baseURL
      };
    } catch (error) {
      console.warn('⚠️ Health check failed:', error.message);
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

  async getVehicles(page = 0, size = 20, sortBy = 'vehicleId', direction = 'asc') {
    try {
      console.log('🚗 Fetching vehicles from API...');
      const endpoint = `/vehicle/v1/all?page=${page}&size=${size}&sortBy=${sortBy}&direction=${direction}`;
      const response = await this.request(endpoint);
      if (response && response.data && Array.isArray(response.data)) {
        console.log('🔍 Raw API response for vehicles:', response.data);
        const transformedData = response.data.map(vehicle => {
          console.log('🔍 Processing vehicle:', vehicle);
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
            vehicle_number: getFieldValue(vehicle, 'vehicleNumber', ['vehicle_number', 'license_plate', 'plateNumber']),
            vehicle_type: getFieldValue(vehicle, 'vehicleType', ['vehicle_type', 'type', 'category']),
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
        });
        console.log(`✅ Successfully fetched ${transformedData.length} vehicles`);
        console.log('🔍 Sample transformed vehicle:', transformedData[0]);
        return {
          success: true,
          data: transformedData,
          total: response.totalElements || response.total || transformedData.length,
          totalPages: response.totalPages || Math.ceil((response.totalElements || transformedData.length) / size),
          currentPage: response.number || page
        };
      }
      console.log('📝 No vehicles found in response');
      return {
        success: true,
        data: [],
        total: 0,
        message: 'No vehicles found'
      };
    } catch (error) {
      console.error('❌ Failed to fetch vehicles:', error);
      return {
        success: false,
        data: [],
        total: 0,
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

  async getDevices(page = 0, size = 20) {
    try {
      console.log('📱 Fetching devices from API...');
      const endpoint = `/device/v1/all?page=${page}&size=${size}`;
      const response = await this.request(endpoint);
      if (response && response.data && Array.isArray(response.data)) {
        console.log('🔍 Raw API response for devices:', response.data);
        const transformedData = response.data.map(device => {
          console.log('🔍 Processing device:', device);
          return {
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
            speed: device.speed ? parseFloat(device.speed) : null,
            acceleration: device.acceleration ? parseFloat(device.acceleration) : null,
            drowsiness: Boolean(device.drowsiness),
            rash_driving: Boolean(device.rashDriving || device.rash_driving),
            collision: Boolean(device.collision),
            has_telemetry: !!(device.latitude && device.longitude)
          };
        });
        console.log(`✅ Successfully fetched ${transformedData.length} devices`);
        return {
          success: true,
          data: transformedData,
          total: response.totalElements || response.total || transformedData.length
        };
      }
      return {
        success: true,
        data: [],
        total: 0,
        message: 'No devices found'
      };
    } catch (error) {
      console.error('❌ Failed to fetch devices:', error);
      return {
        success: false,
        data: [],
        total: 0,
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

  async assignDevice(deviceId, vehicleId) {
    try {
      console.log(`🔗 Assigning device ${deviceId} to vehicle ${vehicleId}...`);
      if (vehicleId === 'unassign' || !vehicleId) {
        const response = await this.request(`/device/v1/unassign/${deviceId}`, {
          method: 'PUT'
        });
        return {
          success: true,
          data: response.data,
          message: 'Device unassigned successfully'
        };
      } else {
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
              total: response.totalElements || response.total || transformedData.length,
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
        total: 0,
        attempted_endpoints: endpoints,
        message: `No telemetry data found for device ${deviceId}`
      };
    } catch (error) {
      console.error(`❌ Failed to fetch telemetry for device ${deviceId}:`, error);
      return {
        success: false,
        data: [],
        total: 0,
        error: error.message,
        message: `Could not fetch telemetry for device ${deviceId}: ${error.message}`
      };
    }
  }

  async getManagerAlarms(page = 1, size = 20) {
    try {
      console.log('🚨 Fetching manager alarms...');
      const endpoint = `/alarm/v1/manager/all?page=${page}&size=${size}&sortBy=alarmId&direction=desc`;
      const response = await this.request(endpoint);
      if (response && response.data && Array.isArray(response.data)) {
        console.log('🔍 Raw alarm data:', response.data);
        const transformedData = response.data.map(alarm => {
          console.log('🔍 Processing alarm:', alarm);
          return {
            alert_id: String(alarm.alarmId || alarm.alert_id || alarm.id || `alarm_${Date.now()}`),
            device_id: String(alarm.deviceId || alarm.device_id || 'Unknown'),
            vehicle_id: alarm.vehicleId || alarm.vehicle_id || null,
            alert_type: alarm.alarmType || alarm.alert_type || 'Unknown',
            severity: alarm.alarmType || alarm.severity || 'medium',
            message: alarm.description || alarm.message || 'No description',
            timestamp: alarm.alarmTime || alarm.timestamp || alarm.createdAt || new Date().toISOString(),
            status: alarm.status || 'active',
            resolved: Boolean(alarm.resolved),
            latitude: alarm.latitude ? parseFloat(alarm.latitude) : null,
            longitude: alarm.longitude ? parseFloat(alarm.longitude) : null,
            imageUrl: alarm.previewUrl || alarm.imageUrl || null,
             speed: alarm.speed !== undefined ? alarm.speed : null,
             acceleration: alarm.acceleration !== undefined ? alarm.acceleration : null,
             drowsiness: alarm.drowsiness !== undefined ? alarm.drowsiness : null,
             rashDriving: alarm.rashDriving !== undefined ? alarm.rashDriving : null,
             collision: alarm.collision !== undefined ? alarm.collision : null
          };
        });
        console.log(`✅ Successfully fetched ${transformedData.length} alarms`);
        console.log('🔍 Transformed alarm data:', transformedData);
        return {
          success: true,
          data: transformedData,
          total: response.totalElements || response.total || transformedData.length
        };
      }
      return {
        success: true,
        data: [],
        total: 0,
        message: 'No alarms found'
      };
    } catch (error) {
      console.error('❌ Failed to fetch alarms:', error);
      return {
        success: false,
        data: [],
        total: 0,
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
        const transformedData = alarmData.map(alarm => ({
          alert_id: String(alarm.alarmId || alarm.alert_id || alarm.id || `alarm_${Date.now()}`),
          device_id: String(alarm.deviceId || alarm.device_id || 'Unknown'),
          vehicle_id: alarm.vehicleId || alarm.vehicle_id || null,
          alert_type: alarm.alarmType || alarm.alert_type || 'Unknown',
          severity: alarm.alarmType || alarm.severity || 'medium',
          message: alarm.description || alarm.message || 'No description',
          timestamp: alarm.alarmTime || alarm.timestamp || alarm.createdAt || new Date().toISOString(),
          status: alarm.status || 'active',
          resolved: Boolean(alarm.resolved),
          latitude: alarm.latitude ? parseFloat(alarm.latitude) : null,
          longitude: alarm.longitude ? parseFloat(alarm.longitude) : null,
          imageUrl: alarm.previewUrl || alarm.imageUrl || null,
           speed: alarm.speed !== undefined ? alarm.speed : null,
          acceleration: alarm.acceleration !== undefined ? alarm.acceleration : null,
          drowsiness: alarm.drowsiness !== undefined ? alarm.drowsiness : null,
           rashDriving: alarm.rashDriving !== undefined ? alarm.rashDriving : null,
           collision: alarm.collision !== undefined ? alarm.collision : null
        }));
        return {
          success: true,
          data: transformedData,
          total: response.totalElements || response.total || transformedData.length
        };
      }
      return {
        success: true,
        data: [],
        total: 0,
        message: 'No alarms found for device'
      };
    } catch (error) {
      console.error(`❌ Failed to fetch alarms for device ${deviceId}:`, error);
      return {
        success: false,
        data: [],
        total: 0,
        error: error.message
      };
    }
  }

  async acknowledgeAlarm(alarmId) {
    try {
      console.log(`🚨 Acknowledging alarm ${alarmId}...`);
      const endpoint = `/alarm/v1/manager/${alarmId}/acknowledge`; // Placeholder
      const response = await this.request(endpoint, {
        method: 'POST'
      });
      return {
        success: true,
        data: response.data
      };
    } catch (error) {
      console.error(`❌ Failed to acknowledge alarm ${alarmId}:`, error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  async resolveAlarm(alarmId) {
    try {
      console.log(`🚨 Resolving alarm ${alarmId}...`);
      const endpoint = `/alarm/v1/manager/${alarmId}/resolve`; // Placeholder
      const response = await this.request(endpoint, {
        method: 'POST'
      });
      return {
        success: true,
        data: response.data
      };
    } catch (error) {
      console.error(`❌ Failed to resolve alarm ${alarmId}:`, error);
      return {
        success: false,
        error: error.message
      };
    }
  }

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

  async getAllData(page = 0, size = 20) {
    try {
      console.log('🌍 Fetching all data from API...');
      const [vehiclesResult, devicesResult, alarmsResult] = await Promise.allSettled([
        this.getVehicles(page, size),
        this.getDevices(page, size),
        this.getManagerAlarms(page, size)
      ]);
      return {
        vehicles: vehiclesResult.status === 'fulfilled' ? vehiclesResult.value : { success: false, data: [], total: 0 },
        devices: devicesResult.status === 'fulfilled' ? devicesResult.value : { success: false, data: [], total: 0 },
        alarms: alarmsResult.status === 'fulfilled' ? alarmsResult.value : { success: false, data: [], total: 0 }
      };
    } catch (error) {
      console.error('❌ Failed to fetch all data:', error);
      return {
        vehicles: { success: false, data: [], total: 0 },
        devices: { success: false, data: [], total: 0 },
        alarms: { success: false, data: [], total: 0 }
      };
    }
  }
}

const apiService = new ApiService();

Object.getOwnPropertyNames(ApiService.prototype).forEach(method => {
  if (method !== 'constructor' && typeof apiService[method] === 'function') {
    apiService[method] = apiService[method].bind(apiService);
  }
});

export default apiService;