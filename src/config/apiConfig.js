// src/config/apiConfig.js - Complete Updated Configuration

const API_CONFIG = {
  // Direct backend URLs
  PRODUCTION_API_URL: 'http://164.52.194.198:9090',
  LOCAL_API_URL: 'http://localhost:9090',
  
  // Proxy URL (when using Vercel rewrites)
  PROXY_API_URL: '/api',
  
  // WebSocket URLs
  PRODUCTION_WEBSOCKET_URL: 'ws://164.52.194.198:9091',
  LOCAL_WEBSOCKET_URL: 'ws://localhost:9091',
  
  // Request configuration
  REQUEST_TIMEOUT: 30000,
  RETRY_ATTEMPTS: 3,
  RETRY_DELAY: 1000,
  
  // Authentication
  TOKEN_STORAGE_KEY: 'authToken',
  REFRESH_TOKEN_STORAGE_KEY: 'refreshToken',
  USER_STORAGE_KEY: 'userData',
  TOKEN_EXPIRY_HOURS: 24,
};

// Get API URL based on environment and configuration
const getApiUrl = () => {
  console.log('🔧 Environment:', process.env.NODE_ENV);
  console.log('🔧 USE_PROXY:', process.env.REACT_APP_USE_PROXY);
  console.log('🔧 API_URL:', process.env.REACT_APP_API_URL);
  
  // If explicitly using proxy
  if (process.env.REACT_APP_USE_PROXY === 'true') {
    console.log('🔀 Using Vercel proxy for API requests');
    return API_CONFIG.PROXY_API_URL;
  }
  
  // Use environment variable if provided
  if (process.env.REACT_APP_API_URL) {
    console.log('🌐 Using API URL from environment:', process.env.REACT_APP_API_URL);
    return process.env.REACT_APP_API_URL;
  }
  
  // Development mode with local API
  if (process.env.NODE_ENV === 'development' && process.env.REACT_APP_USE_LOCAL_API === 'true') {
    console.log('🏠 Using local development API');
    return API_CONFIG.LOCAL_API_URL;
  }
  
  // Default to production API
  console.log('🌐 Using production API URL');
  return API_CONFIG.PRODUCTION_API_URL;
};

// Get WebSocket URL
const getWebSocketUrl = () => {
  if (process.env.REACT_APP_WEBSOCKET_URL) {
    return process.env.REACT_APP_WEBSOCKET_URL;
  }
  
  if (process.env.NODE_ENV === 'development' && process.env.REACT_APP_USE_LOCAL_API === 'true') {
    return API_CONFIG.LOCAL_WEBSOCKET_URL;
  }
  
  return API_CONFIG.PRODUCTION_WEBSOCKET_URL;
};

// API endpoints with enhanced telemetry support
export const API_ENDPOINTS = {
  AUTH: {
    LOGIN_V1: '/auth/v1/login',
    REGISTER_V1: '/auth/v1/register',
    LOGOUT_V1: '/auth/v1/logout',
  },
  VEHICLES: {
    GET_ALL: '/vehicle/v1/all',
    REGISTER: '/vehicle/v1/register',
    GET_BY_ID: (id) => `/vehicle/v1/${id}`,
    UPDATE: (id) => `/vehicle/v1/update/${id}`,
    DELETE: (id) => `/vehicle/v1/delete/${id}`,
  },
  DEVICES: {
    GET_ALL: '/device/v1/all',
    REGISTER: '/device/v1/register',
    GET_BY_ID: (id) => `/device/v1/${id}`,
    UPDATE: (id) => `/device/v1/update/${id}`,
    DELETE: (id) => `/device/v1/delete/${id}`,
  },
  TELEMETRY: {
    // Primary telemetry endpoints
    GET_BY_DEVICE: (deviceId) => `/device/v1/data/${deviceId}`,
    GET_BY_DEVICE_WITH_PARAMS: (deviceId, params) => `/device/v1/data/${deviceId}?${params}`,
    GET_LATEST: (deviceId) => `/device/v1/data/${deviceId}?direction=desc&size=1`,
    GET_PAGINATED: (deviceId, page, size) => `/device/v1/data/${deviceId}?page=${page}&size=${size}&direction=desc`,
    
    // Alternative telemetry endpoints (fallbacks)
    GET_ALL: '/deviceTelemetry/v1/all',
    GET_BY_DEVICE_ALT: (deviceId) => `/deviceTelemetry/v1/device/${deviceId}`,
    GET_BY_DEVICE_ALT_PAGINATED: (deviceId, page, size) => `/deviceTelemetry/v1/device/${deviceId}?page=${page}&size=${size}`,
  },
  ALARMS: {
    GET_ALL: '/alarm/v1/manager/all',
    GET_BY_DEVICE: (deviceId) => `/alarm/v1/device/${deviceId}`,
    CREATE: '/alarm/v1/create',
  },
  HEALTH: '/health'
};

// Request headers
export const REQUEST_HEADERS = {
  'Content-Type': 'application/json',
  'Accept': 'application/json',
};

// Token validation helper
export const isTokenValid = (token) => {
  if (!token) return false;
  
  try {
    // Basic JWT token validation
    const parts = token.split('.');
    if (parts.length !== 3) return false;
    
    const payload = JSON.parse(atob(parts[1]));
    const now = Date.now() / 1000;
    
    // Check if token is expired
    if (payload.exp && payload.exp < now) {
      console.log('🔍 Token has expired');
      return false;
    }
    
    console.log('🔍 Token is still valid');
    return true;
  } catch (error) {
    console.warn('⚠️ Error validating token:', error);
    return false;
  }
};

// Device ID validation and normalization
export const normalizeDeviceId = (device) => {
  // Handle different possible device ID field names
  const deviceId = device.device_id || device.deviceId || device.id;
  
  if (!deviceId || deviceId === 'undefined' || deviceId === null || deviceId === 'null') {
    console.warn('⚠️ Device found without valid ID:', device);
    return null;
  }
  
  return deviceId;
};

// Normalize device data structure
export const normalizeDeviceData = (device) => {
  const deviceId = normalizeDeviceId(device);
  
  return {
    ...device,
    device_id: deviceId,
    id: deviceId,
    device_name: device.device_name || device.deviceName || device.name || `Device ${deviceId}`,
    device_type: device.device_type || device.deviceType || device.type || 'Unknown',
    status: device.status || 'Unknown',
    vehicle_id: device.vehicle_id || device.vehicleId || null,
    // Add telemetry-related fields with defaults
    has_telemetry: false,
    telemetry_status: 'pending',
    telemetry_count: 0,
    last_updated: null,
    has_location: false,
    has_acceleration: false
  };
};

// Environment-specific configuration
export const getEnvironmentConfig = () => {
  const env = process.env.NODE_ENV || 'development';
  const isProduction = env === 'production';
  
  return {
    API_BASE_URL: getApiUrl(),
    WEBSOCKET_URL: getWebSocketUrl(),
    FEATURES: {
      DEBUG_MODE: !isProduction || process.env.REACT_APP_DEBUG_MODE === 'true',
      TELEMETRY_DEBUG: !isProduction || process.env.REACT_APP_TELEMETRY_DEBUG === 'true',
      REAL_TIME_ALARMS: process.env.REACT_APP_REAL_TIME_ALARMS === 'true',
      MOCK_DATA_FALLBACK: process.env.REACT_APP_MOCK_FALLBACK === 'true',
      AUTO_REFRESH: process.env.REACT_APP_AUTO_REFRESH !== 'false', // Default to true
      ENHANCED_LOGGING: !isProduction || process.env.REACT_APP_ENHANCED_LOGGING === 'true',
      DEVICE_ID_VALIDATION: true, // Always enabled
      AUTH_TOKEN_VALIDATION: true // Always enabled
    },
    TIMEOUTS: {
      API_REQUEST: parseInt(process.env.REACT_APP_API_TIMEOUT) || API_CONFIG.REQUEST_TIMEOUT,
      WEBSOCKET_CONNECT: parseInt(process.env.REACT_APP_WS_TIMEOUT) || 5000,
      RETRY_DELAY: parseInt(process.env.REACT_APP_RETRY_DELAY) || API_CONFIG.RETRY_DELAY
    },
    INTERVALS: {
      AUTO_REFRESH: parseInt(process.env.REACT_APP_REFRESH_INTERVAL) || 30000,
      HEALTH_CHECK: parseInt(process.env.REACT_APP_HEALTH_CHECK_INTERVAL) || 60000,
      TOKEN_REFRESH: parseInt(process.env.REACT_APP_TOKEN_REFRESH_INTERVAL) || 3600000 // 1 hour
    },
    TELEMETRY: {
      DEFAULT_PAGE_SIZE: 20,
      MAX_RETRY_ATTEMPTS: 3,
      FALLBACK_ENDPOINTS: [
        'GET_LATEST',
        'GET_PAGINATED',
        'GET_BY_DEVICE_ALT_PAGINATED'
      ]
    },
    ...API_CONFIG
  };
};

// Configuration validation
export const validateConfig = () => {
  const config = getEnvironmentConfig();
  const errors = [];
  
  if (!config.API_BASE_URL) {
    errors.push('API_BASE_URL is not configured');
  }
  
  if (!config.API_BASE_URL.startsWith('http')) {
    errors.push('API_BASE_URL must start with http:// or https://');
  }
  
  if (config.WEBSOCKET_URL && !config.WEBSOCKET_URL.startsWith('ws')) {
    errors.push('WEBSOCKET_URL must start with ws:// or wss://');
  }
  
  if (errors.length > 0) {
    console.error('❌ Configuration errors:', errors);
    return { valid: false, errors };
  }
  
  console.log('✅ Configuration is valid');
  return { valid: true, errors: [] };
};

// Get telemetry endpoints for device
export const getTelemetryEndpoints = (deviceId, page = 0, size = 20) => {
  if (!deviceId || deviceId === 'undefined') {
    return [];
  }
  
  return [
    API_ENDPOINTS.TELEMETRY.GET_LATEST(deviceId),
    API_ENDPOINTS.TELEMETRY.GET_PAGINATED(deviceId, page, size),
    API_ENDPOINTS.TELEMETRY.GET_BY_DEVICE_ALT_PAGINATED(deviceId, page, size),
    API_ENDPOINTS.TELEMETRY.GET_BY_DEVICE_WITH_PARAMS(deviceId, `direction=desc&size=${size}`),
  ];
};

// Authentication helpers
export const getAuthHeaders = () => {
  const token = localStorage.getItem(API_CONFIG.TOKEN_STORAGE_KEY);
  if (!token) return {};
  
  return {
    'Authorization': `Bearer ${token}`,
    ...REQUEST_HEADERS
  };
};

export const clearAuthData = () => {
  localStorage.removeItem(API_CONFIG.TOKEN_STORAGE_KEY);
  localStorage.removeItem(API_CONFIG.REFRESH_TOKEN_STORAGE_KEY);
  localStorage.removeItem(API_CONFIG.USER_STORAGE_KEY);
  console.log('🔒 Authentication data cleared');
};

export const config = getEnvironmentConfig();

// Export all configurations
export default {
  API_CONFIG,
  API_ENDPOINTS,
  REQUEST_HEADERS,
  getApiUrl,
  getWebSocketUrl,
  getEnvironmentConfig,
  isTokenValid,
  normalizeDeviceId,
  normalizeDeviceData,
  validateConfig,
  getTelemetryEndpoints,
  getAuthHeaders,
  clearAuthData,
  config
};