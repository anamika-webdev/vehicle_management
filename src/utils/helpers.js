// Updated helpers.js with ESLint fixes
// src/utils/helpers.js

// Calculate dashboard statistics
export const calculateStats = (vehicles, devices, alerts) => {
  const totalVehicles = vehicles.length;
  const activeVehicles = vehicles.filter(v => {
    const assignedDevice = devices.find(d => d.vehicle_id === v.vehicle_id);
    return assignedDevice && assignedDevice.status === 'Active';
  }).length;
  
  const totalDevices = devices.length;
  const activeDevices = devices.filter(d => d.status === 'Active').length;
  
  const totalAlerts = alerts.length;
  const activeAlerts = alerts.filter(a => !a.resolved).length;
  
  const criticalAlerts = alerts.filter(a => 
    !a.resolved && (
      a.alarm_type === 'collision' || 
      a.alarm_type === 'emergency' ||
      a.severity === 'critical'
    )
  ).length;

  return {
    totalVehicles,
    activeVehicles,
    totalDevices,
    activeDevices,
    totalAlerts,
    activeAlerts,
    criticalAlerts,
    vehicleUtilization: totalVehicles > 0 ? (activeVehicles / totalVehicles * 100).toFixed(1) : 0,
    deviceUtilization: totalDevices > 0 ? (activeDevices / totalDevices * 100).toFixed(1) : 0
  };
};

// Check if device has any alerts
export const hasDeviceAlerts = (device) => {
  return Boolean(
    device.collision_detected || 
    device.rash_driving || 
    device.drowsiness_level > 30 ||
    device.battery_voltage < 11.5 ||
    device.signal_strength < 20
  );
};

// Get device alert level
export const getDeviceAlertLevel = (device) => {
  if (device.collision_detected) return 'critical';
  if (device.rash_driving) return 'high';
  if (device.drowsiness_level > 50) return 'high';
  if (device.drowsiness_level > 30) return 'medium';
  if (device.battery_voltage < 11.5) return 'medium';
  if (device.signal_strength < 20) return 'medium';
  return 'normal';
};

// Format time for display
export const formatTime = (timestamp) => {
  if (!timestamp) return 'Never';
  
  try {
    const date = new Date(timestamp);
    return date.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: true
    });
  } catch (error) {
    console.warn('Invalid timestamp:', timestamp);
    return 'Invalid time';
  }
};

// Format date for display
export const formatDate = (timestamp) => {
  if (!timestamp) return 'Never';
  
  try {
    const date = new Date(timestamp);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  } catch (error) {
    console.warn('Invalid timestamp:', timestamp);
    return 'Invalid date';
  }
};

// Format date and time for display
export const formatDateTime = (timestamp) => {
  if (!timestamp) return 'Never';
  
  try {
    const date = new Date(timestamp);
    return date.toLocaleString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true
    });
  } catch (error) {
    console.warn('Invalid timestamp:', timestamp);
    return 'Invalid date/time';
  }
};

// Get relative time (time ago)
export const timeAgo = (timestamp) => {
  if (!timestamp) return 'Never';
  
  try {
    const now = new Date();
    const date = new Date(timestamp);
    const diffInSeconds = Math.floor((now - date) / 1000);
    
    if (diffInSeconds < 60) return 'Just now';
    if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)}m ago`;
    if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)}h ago`;
    if (diffInSeconds < 2592000) return `${Math.floor(diffInSeconds / 86400)}d ago`;
    
    return formatDate(timestamp);
  } catch (error) {
    console.warn('Invalid timestamp for timeAgo:', timestamp);
    return 'Unknown';
  }
};

// Validate vehicle form data
export const validateVehicleForm = (formData) => {
  const errors = {};
  
  if (!formData.vehicle_number?.trim()) {
    errors.vehicle_number = 'Vehicle number is required';
  }
  
  if (!formData.manufacturer?.trim()) {
    errors.manufacturer = 'Manufacturer is required';
  }
  
  if (!formData.model?.trim()) {
    errors.model = 'Model is required';
  }
  
  if (!formData.vehicle_type?.trim()) {
    errors.vehicle_type = 'Vehicle type is required';
  }
  
  if (formData.year && (formData.year < 1900 || formData.year > new Date().getFullYear() + 1)) {
    errors.year = 'Please enter a valid year';
  }
  
  return {
    isValid: Object.keys(errors).length === 0,
    errors
  };
};

// Get map center based on vehicles
export const getMapCenter = (vehicles) => {
  if (!vehicles || vehicles.length === 0) {
    // Default to Delhi, India
    return { lat: 28.6139, lng: 77.2090 };
  }
  
  const vehiclesWithLocation = vehicles.filter(v => 
    v.current_latitude && v.current_longitude
  );
  
  if (vehiclesWithLocation.length === 0) {
    return { lat: 28.6139, lng: 77.2090 };
  }
  
  const avgLat = vehiclesWithLocation.reduce((sum, v) => sum + v.current_latitude, 0) / vehiclesWithLocation.length;
  const avgLng = vehiclesWithLocation.reduce((sum, v) => sum + v.current_longitude, 0) / vehiclesWithLocation.length;
  
  return { lat: avgLat, lng: avgLng };
};

// Calculate distance between two coordinates
export const calculateDistance = (lat1, lng1, lat2, lng2) => {
  const R = 6371; // Earth's radius in kilometers
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = 
    Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
    Math.sin(dLng/2) * Math.sin(dLng/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c; // Distance in kilometers
};

// Format distance for display
export const formatDistance = (distanceKm) => {
  if (distanceKm < 1) {
    return `${Math.round(distanceKm * 1000)}m`;
  }
  return `${distanceKm.toFixed(1)}km`;
};

// Get speed status
export const getSpeedStatus = (speed, speedLimit = 60) => {
  if (speed === 0) return { status: 'stopped', color: 'red' };
  if (speed > speedLimit) return { status: 'speeding', color: 'red' };
  if (speed > speedLimit * 0.8) return { status: 'fast', color: 'orange' };
  return { status: 'normal', color: 'green' };
};

// Get battery level color
export const getBatteryColor = (level) => {
  if (level > 50) return 'green';
  if (level > 20) return 'orange';
  return 'red';
};

// Get signal strength description
export const getSignalStrength = (strength) => {
  if (strength >= 80) return { level: 'Excellent', color: 'green' };
  if (strength >= 60) return { level: 'Good', color: 'green' };
  if (strength >= 40) return { level: 'Fair', color: 'orange' };
  if (strength >= 20) return { level: 'Poor', color: 'red' };
  return { level: 'No Signal', color: 'gray' };
};

// Generate unique ID
export const generateId = () => {
  return Date.now().toString(36) + Math.random().toString(36).substr(2);
};

// Debounce function
export const debounce = (func, wait) => {
  let timeout;
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
};

// Throttle function
export const throttle = (func, limit) => {
  let inThrottle;
  return function(...args) {
    if (!inThrottle) {
      func.apply(this, args);
      inThrottle = true;
      setTimeout(() => inThrottle = false, limit);
    }
  };
};

// Local storage helpers
export const storage = {
  get: (key, defaultValue = null) => {
    try {
      const item = localStorage.getItem(key);
      return item ? JSON.parse(item) : defaultValue;
    } catch (error) {
      console.error('Storage get error:', error);
      return defaultValue;
    }
  },
  
  set: (key, value) => {
    try {
      localStorage.setItem(key, JSON.stringify(value));
      return true;
    } catch (error) {
      console.error('Storage set error:', error);
      return false;
    }
  },
  
  remove: (key) => {
    try {
      localStorage.removeItem(key);
      return true;
    } catch (error) {
      console.error('Storage remove error:', error);
      return false;
    }
  }
};

// API error handler
export const handleApiError = (error) => {
  console.error('API Error:', error);
  
  if (error.message.includes('401')) {
    return 'Authentication failed. Please login again.';
  }
  
  if (error.message.includes('403')) {
    return 'Access denied. You do not have permission for this action.';
  }
  
  if (error.message.includes('404')) {
    return 'Resource not found.';
  }
  
  if (error.message.includes('500')) {
    return 'Server error. Please try again later.';
  }
  
  if (error.message.includes('Network')) {
    return 'Network error. Please check your connection.';
  }
  
  return error.message || 'An unexpected error occurred.';
};

// Format vehicle status
export const getVehicleStatus = (vehicle, devices) => {
  const assignedDevice = devices.find(d => d.vehicle_id === vehicle.vehicle_id);
  
  if (!assignedDevice) {
    return { status: 'No Device', color: 'gray', bg: 'bg-gray-100', icon: 'AlertCircle' };
  }
  
  if (assignedDevice.status !== 'Active') {
    return { status: 'Device Inactive', color: 'text-red-600', bg: 'bg-red-100', icon: 'XCircle' };
  }
  
  if (hasDeviceAlerts(assignedDevice)) {
    return { status: 'Alert', color: 'text-red-600', bg: 'bg-red-100', icon: 'AlertTriangle' };
  }
  
  if (vehicle.current_speed > 5) {
    return { status: 'Moving', color: 'text-green-600', bg: 'bg-green-100', icon: 'Navigation' };
  }
  
  return { status: 'Parked', color: 'text-yellow-600', bg: 'bg-yellow-100', icon: 'Clock' };
};

// Validate device form data
export const validateDeviceForm = (formData) => {
  const errors = {};
  
  if (!formData.device_name?.trim()) {
    errors.device_name = 'Device name is required';
  }
  
  if (!formData.device_type?.trim()) {
    errors.device_type = 'Device type is required';
  }
  
  if (!formData.serial_number?.trim()) {
    errors.serial_number = 'Serial number is required';
  }
  
  return {
    isValid: Object.keys(errors).length === 0,
    errors
  };
};

// Parse CSV data
export const parseCSVData = (csvText) => {
  try {
    const lines = csvText.split('\n');
    const headers = lines[0].split(',').map(h => h.trim());
    const data = [];
    
    for (let i = 1; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;
      
      const values = line.split(',').map(v => v.trim());
      const row = {};
      
      headers.forEach((header, index) => {
        row[header] = values[index] || '';
      });
      
      data.push(row);
    }
    
    return { success: true, data, headers };
  } catch (error) {
    return { success: false, error: error.message };
  }
};

// Format file size
export const formatFileSize = (bytes) => {
  if (bytes === 0) return '0 Bytes';
  
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
};

// Validate email format
export const isValidEmail = (email) => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
};

// Validate phone number format
export const isValidPhone = (phone) => {
  const phoneRegex = /^[\+]?[1-9][\d]{0,15}$/;
  return phoneRegex.test(phone.replace(/\s/g, ''));
};

// Fix: Assign object to variable before exporting as default
const helpers = {
  calculateStats,
  hasDeviceAlerts,
  getDeviceAlertLevel,
  formatTime,
  formatDate,
  formatDateTime,
  timeAgo,
  validateVehicleForm,
  getMapCenter,
  calculateDistance,
  formatDistance,
  getSpeedStatus,
  getBatteryColor,
  getSignalStrength,
  generateId,
  debounce,
  throttle,
  storage,
  handleApiError,
  getVehicleStatus,
  validateDeviceForm,
  parseCSVData,
  formatFileSize,
  isValidEmail,
  isValidPhone
};

export default helpers;