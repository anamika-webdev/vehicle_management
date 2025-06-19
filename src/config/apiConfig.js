// src/config/apiConfig.js - Updated with proxy and environment support

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

// API endpoints
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
    GET_BY_DEVICE: (deviceId) => `/device/v1/data/${deviceId}`,
    GET_ALL: '/deviceTelemetry/v1/all',
  },
  ALARMS: {
    GET_ALL: '/alarm/v1/manager/all',
    CREATE: '/alarm/v1/create',
  },
  HEALTH: '/health'
};

// Request headers
export const REQUEST_HEADERS = {
  'Content-Type': 'application/json',
  'Accept': 'application/json',
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
      MOCK_DATA_FALLBACK: false
    },
    ...API_CONFIG
  };
};

export const config = getEnvironmentConfig();

// Export all configurations
export default {
  API_CONFIG,
  API_ENDPOINTS,
  REQUEST_HEADERS,
  getApiUrl,
  getWebSocketUrl,
  config
};