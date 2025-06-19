
const API_CONFIG = {
  // Production API URL
  PRODUCTION_API_URL: 'http://164.52.194.198:9090',
  
  // WebSocket Configuration - FIXED: Added missing WebSocket URLs
  PRODUCTION_WEBSOCKET_URL: 'ws://164.52.194.198:9091',
  LOCAL_WEBSOCKET_URL: 'ws://localhost:9091',
  
  // Local development fallback
  LOCAL_API_URL: 'http://localhost:9090',
  
  // Request configuration
  REQUEST_TIMEOUT: 30000, // 30 seconds
  RETRY_ATTEMPTS: 3,
  RETRY_DELAY: 1000, // 1 second
  
  // Auto-refresh intervals
  DATA_REFRESH_INTERVAL: 30000, // 30 seconds
  TELEMETRY_REFRESH_INTERVAL: 10000, // 10 seconds for telemetry
  ALARM_STREAM_RECONNECT_DELAY: 5000, // 5 seconds
  
  // Pagination defaults
  DEFAULT_PAGE_SIZE: 20,
  MAX_PAGE_SIZE: 100,
  
  // Map settings (Delhi, India as default)
  DEFAULT_MAP_CENTER: {
    lat: 28.6139,
    lng: 77.2090
  },
  DEFAULT_ZOOM: 12,
  
  // Alert thresholds
  SPEED_LIMIT: 60, // km/h
  DROWSINESS_THRESHOLD: 30, // percentage
  ACCELERATION_THRESHOLD: 3.0, // m/s²
  BATTERY_LOW_THRESHOLD: 20, // percentage
  
  // Authentication
  TOKEN_STORAGE_KEY: 'authToken',
  REFRESH_TOKEN_STORAGE_KEY: 'refreshToken',
  USER_STORAGE_KEY: 'userData',
  TOKEN_EXPIRY_HOURS: 24,
  
  // Feature flags
  FEATURES: {
    REAL_TIME_ALARMS: true,
    DEVICE_TELEMETRY: true,
    LIVE_TRACKING: true,
    TELEMETRY_DEBUG: process.env.NODE_ENV === 'development',
    OFFLINE_MODE: false,
    DEBUG_MODE: process.env.NODE_ENV === 'development'
  }
};

// Choose API URL based on environment
const getApiUrl = () => {
  // Check if we're in development and have a local API
  if (process.env.NODE_ENV === 'development' && process.env.REACT_APP_USE_LOCAL_API === 'true') {
    return API_CONFIG.LOCAL_API_URL;
  }
  
  // Use environment variable if provided
  if (process.env.REACT_APP_API_URL) {
    return process.env.REACT_APP_API_URL;
  }
  
  // Default to production API
  return API_CONFIG.PRODUCTION_API_URL;
};

// FIXED: Add WebSocket URL function
const getWebSocketUrl = () => {
  // Check if we're in development and have a local WebSocket
  if (process.env.NODE_ENV === 'development' && process.env.REACT_APP_USE_LOCAL_API === 'true') {
    return API_CONFIG.LOCAL_WEBSOCKET_URL;
  }
  
  // Use environment variable if provided
  if (process.env.REACT_APP_WEBSOCKET_URL) {
    return process.env.REACT_APP_WEBSOCKET_URL;
  }
  
  // Default to production WebSocket
  return API_CONFIG.PRODUCTION_WEBSOCKET_URL;
};

// API endpoints mapping based on the provided API documentation
export const API_ENDPOINTS = {
  // Authentication endpoints
  AUTH: {
    REGISTER_V1: '/auth/v1/register',
    LOGIN_V1: '/auth/v1/login',
    LOGOUT_V1: '/auth/v1/logout',
    REGISTER_V0: '/auth/v0/register', // Legacy
    LOGIN_V0: '/auth/v0/login', // Legacy
  },
  
  // Vehicle endpoints
  VEHICLES: {
    REGISTER: '/vehicle/v1/register',
    GET_ALL: '/vehicle/v1/all',
    GET_BY_ID: (id) => `/vehicle/v1/${id}`,
    UPDATE: (id) => `/vehicle/v1/update/${id}`,
    DELETE: (id) => `/vehicle/v1/delete/${id}`,
  },
  
  // Device endpoints
  DEVICES: {
    REGISTER: '/device/v1/register',
    GET_ALL: '/device/v1/all',
    GET_BY_ID: (id) => `/device/v1/${id}`,
    UPDATE: (id) => `/device/v1/update/${id}`,
    DELETE: (id) => `/device/v1/delete/${id}`,
  },
  
  // Device telemetry endpoints
  TELEMETRY: {
    CREATE: '/deviceTelemetry/v1/create',
    GET_ALL: '/deviceTelemetry/v1/all',
    GET_BY_DEVICE: (deviceId) => `/deviceTelemetry/v1/device/${deviceId}`,
    GET_BY_ID: (id) => `/deviceTelemetry/v1/${id}`,
    UPDATE: (id) => `/deviceTelemetry/v1/update/${id}`,
    DELETE: (id) => `/deviceTelemetry/v1/delete/${id}`,
  },
  
  // Manager alarms endpoints
  ALARMS: {
    GET_ALL: '/managerAlarms/v1/all',
    GET_BY_ID: (id) => `/managerAlarms/v1/${id}`,
    CREATE: '/managerAlarms/v1/create',
    UPDATE: (id) => `/managerAlarms/v1/update/${id}`,
    DELETE: (id) => `/managerAlarms/v1/delete/${id}`,
  },
  
  // Health check endpoints
  HEALTH: {
    STATUS: '/health',
    PING: '/ping',
    VERSION: '/version'
  }
};

// Request headers
export const REQUEST_HEADERS = {
  'Content-Type': 'application/json',
  'Accept': 'application/json',
};

// HTTP status codes
export const HTTP_STATUS = {
  OK: 200,
  CREATED: 201,
  BAD_REQUEST: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  INTERNAL_SERVER_ERROR: 500
};

// Error messages
export const ERROR_MESSAGES = {
  NETWORK_ERROR: 'Network error. Please check your internet connection.',
  SERVER_ERROR: 'Server error. Please try again later.',
  UNAUTHORIZED: 'Session expired. Please login again.',
  NOT_FOUND: 'Resource not found.',
  VALIDATION_ERROR: 'Please check your input and try again.'
};

// Telemetry configuration
export const TELEMETRY_CONFIG = {
  MAX_RETRIES: 3,
  RETRY_DELAY: 2000,
  BATCH_SIZE: 50,
  MAX_CACHE_SIZE: 1000
};

// Transform telemetry response to ensure consistent data structure
export const transformTelemetryResponse = (apiResponse) => {
  if (!apiResponse || !apiResponse.data) {
    return {
      success: false,
      data: [],
      totalElements: 0,
      totalPages: 0,
      currentPage: 0,
      message: 'No telemetry data available'
    };
  }
  
  // Handle both array and paginated response formats
  const dataArray = Array.isArray(apiResponse.data) ? 
    apiResponse.data : 
    (apiResponse.data.content || []);
  
  // Transform and normalize telemetry data
  const transformedData = dataArray.map(item => ({
    id: item.id || `temp_${Date.now()}_${Math.random()}`,
    device_id: item.device_id || item.deviceId,
    vehicle_id: item.vehicle_id || item.vehicleId,
    speed: item.speed ? parseFloat(item.speed) : null,
    latitude: item.latitude ? parseFloat(item.latitude) : null,
    longitude: item.longitude ? parseFloat(item.longitude) : null,
    acceleration: item.acceleration ? parseFloat(item.acceleration) : null,
    drowsiness: Boolean(item.drowsiness),
    rash_driving: Boolean(item.rashDriving || item.rash_driving),
    rashDriving: Boolean(item.rashDriving || item.rash_driving), // Keep both for compatibility
    collision: Boolean(item.collision),
    timestamp: item.timestamp || item.createdAt || new Date().toISOString()
  }));
  
  return {
    success: true,
    data: transformedData,
    totalElements: apiResponse.data.totalElements || dataArray.length,
    totalPages: apiResponse.data.totalPages || 1,
    currentPage: apiResponse.data.number || 0,
    message: `Found ${transformedData.length} telemetry records`
  };
};

// Environment-specific configuration
export const getEnvironmentConfig = () => {
  const env = process.env.NODE_ENV || 'development';
  
  const configs = {
    development: {
      ...API_CONFIG,
      API_BASE_URL: getApiUrl(),
      WEBSOCKET_URL: getWebSocketUrl(), // FIXED: Added WebSocket URL
      FEATURES: {
        ...API_CONFIG.FEATURES,
        DEBUG_MODE: true,
        TELEMETRY_DEBUG: true,
        MOCK_DATA_FALLBACK: false
      },
      TELEMETRY_REFRESH_INTERVAL: 5000, // Faster refresh in dev
    },
    production: {
      ...API_CONFIG,
      API_BASE_URL: getApiUrl(),
      WEBSOCKET_URL: getWebSocketUrl(), // FIXED: Added WebSocket URL
      FEATURES: {
        ...API_CONFIG.FEATURES,
        DEBUG_MODE: false,
        TELEMETRY_DEBUG: false,
        MOCK_DATA_FALLBACK: false
      }
    }
  };
  
  return configs[env] || configs.development;
};

// Export main config
export const config = getEnvironmentConfig();

// Default export
export default {
  API_CONFIG,
  API_ENDPOINTS,
  REQUEST_HEADERS,
  HTTP_STATUS,
  ERROR_MESSAGES,
  TELEMETRY_CONFIG,
  transformTelemetryResponse,
  getApiUrl,
  getWebSocketUrl,
  config
};