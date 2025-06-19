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
      console.log('🏥 Performing health check...');
      const response = await this.request('/health');
      
      return {
        status: response.status === 'ok' || response.status === 'healthy' ? 'healthy' : 'degraded',
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
}

// Create and export single instance
const apiService = new ApiService();
export default apiService;