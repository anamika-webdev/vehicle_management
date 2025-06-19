
// API Configuration - UPDATED
export const API_CONFIG = {
  BASE_URL: process.env.REACT_APP_API_BASE_URL || 'http://164.52.194.198:9090',
  WEBSOCKET_URL: process.env.REACT_APP_WEBSOCKET_URL || 'ws://164.52.194.198:9091', // FIXED
  TIMEOUT: 30000, // 30 seconds
  RETRY_ATTEMPTS: 3
};

// Vehicle Types
export const VEHICLE_TYPES = [
  { value: 'Sedan', label: 'Sedan' },
  { value: 'SUV', label: 'SUV' },
  { value: 'Truck', label: 'Truck' },
  { value: 'Hatchback', label: 'Hatchback' },
  { value: 'Convertible', label: 'Convertible' },
  { value: 'Van', label: 'Van' },
  { value: 'Motorcycle', label: 'Motorcycle' }
];

// Device Types
export const DEVICE_TYPES = [
  { value: 'GPS', label: 'GPS Tracker' },
  { value: 'Security', label: 'Security System' },
  { value: 'Surveillance', label: 'Camera System' },
  { value: 'Environmental', label: 'Environmental Sensor' },
  { value: 'OBD', label: 'OBD Device' }
];

// Device Status
export const DEVICE_STATUS = [
  { value: 'Active', label: 'Active' },
  { value: 'Inactive', label: 'Inactive' },
  { value: 'Unassigned', label: 'Unassigned' },
  { value: 'Maintenance', label: 'Maintenance' }
];

// Alarm Severity Levels
export const ALARM_SEVERITY = {
  CRITICAL: 'critical',
  HIGH: 'high',
  MEDIUM: 'medium',
  LOW: 'low'
};

// Alarm Types
export const ALARM_TYPES = [
  'Speed Alert',
  'Rash Driving',
  'Collision Alert',
  'GPS Signal Lost',
  'Low Battery',
  'Maintenance Required',
  'Security Breach',
  'Drowsiness Alert',
  'Unauthorized Access'
];

// Notification Types
export const NOTIFICATION_TYPES = {
  SUCCESS: 'success',
  ERROR: 'error',
  WARNING: 'warning',
  INFO: 'info',
  CRITICAL: 'critical'
};

// Map Configuration
export const MAP_CONFIG = {
  DEFAULT_CENTER: { lat: 28.6139, lng: 77.2090 }, // Delhi, India
  DEFAULT_ZOOM: 12,
  MIN_ZOOM: 8,
  MAX_ZOOM: 18
};

// Thresholds for Device Alerts
export const DEVICE_THRESHOLDS = {
  DROWSINESS_WARNING: 20,
  DROWSINESS_CRITICAL: 30,
  ACCELERATION_WARNING: 3.0,
  ACCELERATION_CRITICAL: 5.0,
  SPEED_LIMIT_DEFAULT: 60 // km/h
};

// Playback Speeds for Route Replay
export const PLAYBACK_SPEEDS = [
  { value: 0.5, label: '0.5x' },
  { value: 1, label: '1x' },
  { value: 2, label: '2x' },
  { value: 5, label: '5x' },
  { value: 10, label: '10x' }
];

// Connection Status Types - ADDED
export const CONNECTION_STATUS = {
  CONNECTED: 'connected',
  CONNECTING: 'connecting',
  DISCONNECTED: 'disconnected',
  FAILED: 'failed',
  ERROR: 'error',
  UNKNOWN: 'unknown'
};

// Authentication Status Types - ADDED
export const AUTH_STATUS = {
  VALID: 'valid',
  EXPIRED: 'expired',
  EXPIRING: 'expiring',
  INVALID: 'invalid',
  NONE: 'none',
  ERROR: 'error',
  UNKNOWN: 'unknown'
};

// API Health Status Types - ADDED
export const API_STATUS = {
  HEALTHY: 'healthy',
  DEGRADED: 'degraded',
  ERROR: 'error',
  CHECKING: 'checking',
  UNKNOWN: 'unknown'
};