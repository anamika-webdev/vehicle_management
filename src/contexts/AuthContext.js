// Complete AuthContext.js - Enhanced with token management and 401 handling
// src/contexts/AuthContext.js

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import apiService from '../services/api';
import { config } from '../config/apiConfig';

const AuthContext = createContext();

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export const AuthProvider = ({ children }) => {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [currentUser, setCurrentUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loginForm, setLoginForm] = useState({ email: '', password: '' });
  const [loginError, setLoginError] = useState('');

  // ===========================================
  // TOKEN MANAGEMENT UTILITIES
  // ===========================================

  // Parse login response to handle multiple API formats
  const parseLoginResponse = useCallback((response) => {
    console.log('🔍 Parsing login response:', response);
    
    let token = null;
    let userData = null;
    let refreshToken = null;

    // Extract token - try multiple possible locations
    if (response.token) {
      token = response.token;
    } else if (response.access_token) {
      token = response.access_token;
    } else if (response.accessToken) {
      token = response.accessToken;
    } else if (response.data && response.data.token) {
      token = response.data.token;
    }

    // Extract refresh token
    if (response.refreshToken) {
      refreshToken = response.refreshToken;
    } else if (response.refresh_token) {
      refreshToken = response.refresh_token;
    } else if (response.data && response.data.refreshToken) {
      refreshToken = response.data.refreshToken;
    }

    // Extract user data - try multiple possible locations and formats
    if (response.manager) {
      userData = response.manager;
    } else if (response.user) {
      userData = response.user;
    } else if (response.data && response.data.manager) {
      userData = response.data.manager;
    } else if (response.data && response.data.user) {
      userData = response.data.user;
    } else if (response.data && response.data.userData) {
      userData = response.data.userData;
    } else if (response.userData) {
      userData = response.userData;
    }

    // If we have basic info but no structured user data, create it
    if (!userData && (response.email || response.name || response.id)) {
      userData = {
        id: response.id || response.userId || response.managerId,
        email: response.email,
        name: response.name || response.username,
        role: response.role || 'manager'
      };
    }

    console.log('🔍 Extracted data:', { 
      hasToken: !!token, 
      hasUserData: !!userData, 
      hasRefreshToken: !!refreshToken 
    });

    return { token, userData, refreshToken };
  }, []);

  // Check if token is expired
  const isTokenExpired = useCallback((token) => {
    if (!token) return true;
    
    try {
      const tokenPayload = JSON.parse(atob(token.split('.')[1]));
      const currentTime = Date.now() / 1000;
      return tokenPayload.exp && tokenPayload.exp < currentTime;
    } catch (error) {
      console.warn('⚠️ Could not decode token:', error);
      return true;
    }
  }, []);

  // Get token expiry information
  const getTokenExpiry = useCallback((token) => {
    if (!token) return null;
    
    try {
      const tokenPayload = JSON.parse(atob(token.split('.')[1]));
      return {
        exp: tokenPayload.exp,
        expiryDate: new Date(tokenPayload.exp * 1000),
        isExpired: tokenPayload.exp < Date.now() / 1000,
        timeUntilExpiry: Math.max(0, tokenPayload.exp - Date.now() / 1000)
      };
    } catch (error) {
      return { error: 'Could not decode token' };
    }
  }, []);

  // ===========================================
  // AUTHENTICATION ERROR HANDLING
  // ===========================================

  const handleAuthenticationError = useCallback(async () => {
    console.warn('🔐 Authentication failed - handling auth error...');
    
    // Clear current invalid tokens
    localStorage.removeItem(config.TOKEN_STORAGE_KEY);
    localStorage.removeItem(config.USER_STORAGE_KEY);
    localStorage.removeItem(config.REFRESH_TOKEN_STORAGE_KEY);
    
    // Clear API service tokens
    apiService.token = null;
    apiService.refreshToken = null;
    
    // Reset auth state
    setCurrentUser(null);
    setIsLoggedIn(false);
    setLoginError('Your session has expired. Please login again.');
    
    console.log('🔒 Session expired - user needs to login again');
  }, []);

  // ===========================================
  // LOGOUT FUNCTION
  // ===========================================

  const logout = useCallback(async () => {
    try {
      setLoading(true);
      
      console.log('🚪 Logging out user...');
      
      // Call API logout if available
      try {
        await apiService.logout();
      } catch (error) {
        console.warn('⚠️ API logout failed, continuing with local logout:', error.message);
      }
      
      // Clear all authentication data
      localStorage.removeItem(config.TOKEN_STORAGE_KEY);
      localStorage.removeItem(config.USER_STORAGE_KEY);
      localStorage.removeItem(config.REFRESH_TOKEN_STORAGE_KEY);
      
      // Clear API service tokens
      apiService.token = null;
      apiService.refreshToken = null;
      
      // Reset state
      setCurrentUser(null);
      setIsLoggedIn(false);
      setLoginForm({ email: '', password: '' });
      setLoginError('');
      
      console.log('✅ Logout completed');
      
    } catch (error) {
      console.error('❌ Logout error:', error);
      
      // Force logout even if API call fails
      localStorage.clear();
      apiService.token = null;
      setCurrentUser(null);
      setIsLoggedIn(false);
      setLoginForm({ email: '', password: '' });
      setLoginError('');
      
    } finally {
      setLoading(false);
    }
  }, []);

  // ===========================================
  // LOGIN FUNCTIONS
  // ===========================================

  const login = async () => {
    setLoading(true);
    setLoginError('');
    
    try {
      console.log('🔐 Attempting login with API:', loginForm.email);
      
      // Validate inputs
      if (!loginForm.email || !loginForm.password) {
        throw new Error('Email and password are required');
      }
      
      if (!loginForm.email.includes('@')) {
        throw new Error('Please enter a valid email address');
      }
      
      // Call the real API login endpoint
      const response = await apiService.login(loginForm.email, loginForm.password);
      
      console.log('🔑 Login API response received:', response);

      // Parse response to handle different API formats
      const { token, userData, refreshToken } = parseLoginResponse(response);

      if (token && userData) {
        // Check if token is already expired
        if (isTokenExpired(token)) {
          throw new Error('Received token is already expired. Please try again.');
        }

        // Store authentication data
        localStorage.setItem(config.TOKEN_STORAGE_KEY, token);
        localStorage.setItem(config.USER_STORAGE_KEY, JSON.stringify(userData));
        
        // Set token in API service immediately
        apiService.token = token;
        
        if (refreshToken) {
          localStorage.setItem(config.REFRESH_TOKEN_STORAGE_KEY, refreshToken);
          apiService.refreshToken = refreshToken;
        }
        
        // Update state
        setCurrentUser(userData);
        setIsLoggedIn(true);
        
        // Clear form and error
        setLoginForm({ email: '', password: '' });
        setLoginError('');
        
        console.log('✅ Login successful for:', userData.name || userData.email);
        
        // Test the token immediately
        try {
          const healthCheck = await apiService.healthCheck();
          console.log('🧪 Post-login health check:', healthCheck);
          
          if (healthCheck.status === 'unhealthy') {
            console.warn('⚠️ Health check failed after login, but continuing...');
          }
        } catch (testError) {
          console.warn('⚠️ Post-login test failed:', testError.message);
          // Don't fail the login, but log the warning
        }
        
      } else if (token && !userData) {
        // We have token but no user data - this might be okay for some APIs
        console.warn('⚠️ Login succeeded but no user data provided');
        
        // Create minimal user data from email
        const minimalUserData = {
          email: loginForm.email,
          name: loginForm.email.split('@')[0],
          role: 'manager'
        };
        
        localStorage.setItem(config.TOKEN_STORAGE_KEY, token);
        localStorage.setItem(config.USER_STORAGE_KEY, JSON.stringify(minimalUserData));
        apiService.token = token;
        
        if (refreshToken) {
          localStorage.setItem(config.REFRESH_TOKEN_STORAGE_KEY, refreshToken);
          apiService.refreshToken = refreshToken;
        }
        
        setCurrentUser(minimalUserData);
        setIsLoggedIn(true);
        setLoginForm({ email: '', password: '' });
        setLoginError('');
        
        console.log('✅ Login successful (minimal user data)');
        
      } else if (!token) {
        console.error('❌ No token in response:', response);
        throw new Error('No authentication token received from server');
      } else {
        console.error('❌ Invalid response structure:', response);
        throw new Error('Invalid response from login API - missing user data');
      }

    } catch (error) {
      console.error('❌ Login failed:', error);
      
      // Handle specific error types
      let errorMessage = 'Login failed. Please try again.';
      
      if (error.message.includes('401') || error.message.includes('Authentication failed') || error.message.includes('Unauthorized')) {
        errorMessage = 'Invalid email or password. Please check your credentials.';
      } else if (error.message.includes('Network') || error.message.includes('fetch') || error.message.includes('Failed to fetch')) {
        errorMessage = 'Unable to connect to the server. Please check your internet connection.';
      } else if (error.message.includes('500') || error.message.includes('Internal Server Error')) {
        errorMessage = 'Server error occurred. Please try again in a few moments.';
      } else if (error.message.includes('403') || error.message.includes('Forbidden')) {
        errorMessage = 'Access denied. Please contact your administrator.';
      } else if (error.message.includes('400') || error.message.includes('Bad Request')) {
        errorMessage = 'Invalid login request. Please check your email format.';
      } else if (error.message) {
        errorMessage = error.message;
      }
      
      setLoginError(errorMessage);
      
      // Clear any potentially invalid tokens
      handleAuthenticationError();
      
    } finally {
      setLoading(false);
    }
  };

  // Force login with direct API call (bypass cached tokens)
  const forceLogin = async (email, password) => {
    setLoading(true);
    setLoginError('');
    
    try {
      console.log('🔐 Force login attempt for:', email);
      
      // Clear any existing tokens first
      localStorage.clear();
      apiService.token = null;
      apiService.refreshToken = null;
      
      // Validate inputs
      if (!email || !password) {
        throw new Error('Email and password are required');
      }
      
      if (!email.includes('@')) {
        throw new Error('Please enter a valid email address');
      }
      
      // Make a direct API call to login (bypassing potentially cached tokens)
      const response = await fetch('http://164.52.194.198:9090/auth/v1/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          // Don't include any authorization headers for login
        },
        body: JSON.stringify({ email, password })
      });
      
      console.log('🔑 Direct login response:', response.status, response.statusText);
      
      if (!response.ok) {
        let errorData;
        try {
          errorData = await response.text();
        } catch (e) {
          errorData = 'Unknown error';
        }
        
        console.error('❌ Login failed with status:', response.status, errorData);
        
        if (response.status === 401) {
          throw new Error('Invalid email or password. Please check your credentials.');
        } else if (response.status === 500) {
          throw new Error('Server error. Please try again in a few moments.');
        } else {
          throw new Error(`Login failed: ${response.status} ${response.statusText}`);
        }
      }
      
      const loginData = await response.json();
      console.log('🔑 Login data received:', loginData);
      
      // Parse the response using the enhanced parser
      const { token, userData, refreshToken } = parseLoginResponse(loginData);
      
      if (token) {
        // Store new authentication data
        localStorage.setItem(config.TOKEN_STORAGE_KEY, token);
        apiService.token = token;
        
        if (userData) {
          localStorage.setItem(config.USER_STORAGE_KEY, JSON.stringify(userData));
          setCurrentUser(userData);
        } else {
          // Create minimal user data if none provided
          const minimalUser = {
            email: email,
            name: email.split('@')[0],
            role: 'manager'
          };
          localStorage.setItem(config.USER_STORAGE_KEY, JSON.stringify(minimalUser));
          setCurrentUser(minimalUser);
        }
        
        if (refreshToken) {
          localStorage.setItem(config.REFRESH_TOKEN_STORAGE_KEY, refreshToken);
          apiService.refreshToken = refreshToken;
        }
        
        // Update auth state
        setIsLoggedIn(true);
        setLoginForm({ email: '', password: '' });
        setLoginError('');
        
        console.log('✅ Force login successful');
        
        // Test the new token immediately
        try {
          const testResponse = await apiService.healthCheck();
          console.log('🧪 Token test result:', testResponse);
          
          if (testResponse.status === 'unhealthy') {
            throw new Error('Token validation failed');
          }
        } catch (testError) {
          console.warn('⚠️ Token test failed:', testError.message);
          // Don't fail the login, but warn the user
        }
        
      } else {
        throw new Error('No authentication token received from server');
      }
      
    } catch (error) {
      console.error('❌ Force login failed:', error);
      
      let errorMessage = 'Login failed. Please try again.';
      
      if (error.message.includes('401') || error.message.includes('Invalid')) {
        errorMessage = 'Invalid email or password. Please check your credentials.';
      } else if (error.message.includes('Network') || error.message.includes('fetch')) {
        errorMessage = 'Unable to connect to the server. Please check your internet connection.';
      } else if (error.message.includes('500')) {
        errorMessage = 'Server error occurred. Please try again in a few moments.';
      } else if (error.message) {
        errorMessage = error.message;
      }
      
      setLoginError(errorMessage);
      
      // Clear everything on failed login
      handleAuthenticationError();
      
    } finally {
      setLoading(false);
    }
  };

  // ===========================================
  // REGISTRATION FUNCTION
  // ===========================================

  const register = async (userData) => {
    setLoading(true);
    
    try {
      console.log('📝 Attempting registration:', userData.email);
      
      const response = await apiService.register({
        name: userData.name,
        email: userData.email,
        phoneNumber: userData.phoneNumber || userData.phone,
        password: userData.password
      });
      
      console.log('✅ Registration successful:', response);
      
      // Handle different response formats for registration
      if (response.success || response.token || response.message === 'Registration successful') {
        // Auto-login after successful registration
        setLoginForm({ email: userData.email, password: userData.password });
        await login();
      } else {
        throw new Error(response.message || 'Registration failed');
      }
      
      return response;
    } catch (error) {
      console.error('❌ Registration failed:', error);
      throw error;
    } finally {
      setLoading(false);
    }
  };

  // ===========================================
  // TOKEN VALIDATION AND REFRESH
  // ===========================================

  const checkExistingAuth = useCallback(async () => {
    try {
      console.log('🔍 Checking for existing authentication...');
      
      const token = localStorage.getItem(config.TOKEN_STORAGE_KEY);
      const userData = localStorage.getItem(config.USER_STORAGE_KEY);
      const refreshToken = localStorage.getItem(config.REFRESH_TOKEN_STORAGE_KEY);

      if (token && userData) {
        // Check if token is expired
        if (isTokenExpired(token)) {
          console.warn('⚠️ Stored token is expired, clearing auth');
          localStorage.clear();
          apiService.token = null;
          apiService.refreshToken = null;
          return;
        }

        try {
          const user = JSON.parse(userData);
          
          // Set token in API service
          apiService.token = token;
          if (refreshToken) {
            apiService.refreshToken = refreshToken;
          }
          
          // Verify token is still valid by making a test request
          try {
            const healthCheck = await apiService.healthCheck();
            console.log('🔍 Auth validation health check:', healthCheck);
            
            if (healthCheck.status === 'unhealthy') {
              throw new Error('Health check failed');
            }
            
            setCurrentUser(user);
            setIsLoggedIn(true);
            console.log('✅ Restored authentication for:', user.email || user.name);
            
          } catch (apiError) {
            console.warn('⚠️ Stored token is invalid, clearing auth:', apiError.message);
            localStorage.clear();
            apiService.token = null;
            apiService.refreshToken = null;
          }
          
        } catch (parseError) {
          console.warn('⚠️ Invalid stored user data, clearing auth');
          localStorage.clear();
          apiService.token = null;
        }
      } else {
        console.log('ℹ️ No existing authentication found');
      }
    } catch (error) {
      console.error('❌ Error checking existing auth:', error);
      // Clear potentially corrupted data
      localStorage.clear();
      apiService.token = null;
    } finally {
      setLoading(false);
    }
  }, [isTokenExpired]);

  const checkTokenExpiry = useCallback(() => {
    const token = localStorage.getItem(config.TOKEN_STORAGE_KEY);
    
    if (token && isLoggedIn) {
      if (isTokenExpired(token)) {
        console.warn('🔐 Token has expired, logging out');
        handleAuthenticationError();
        return;
      }
      
      // Check if token expires within 5 minutes and warn user
      const expiry = getTokenExpiry(token);
      if (expiry && expiry.timeUntilExpiry < 300) {
        console.log('🔄 Token expiring soon...');
        // Could implement token refresh logic here if your API supports it
      }
      
      console.log('🔍 Token is still valid');
    }
  }, [isLoggedIn, isTokenExpired, getTokenExpiry, handleAuthenticationError]);

  // ===========================================
  // USER MANAGEMENT
  // ===========================================

  const updateUser = (updatedUserData) => {
    const updatedUser = { ...currentUser, ...updatedUserData };
    setCurrentUser(updatedUser);
    localStorage.setItem(config.USER_STORAGE_KEY, JSON.stringify(updatedUser));
    console.log('👤 User data updated:', updatedUser.email);
  };

  // ===========================================
  // INITIALIZATION EFFECT
  // ===========================================

  // Initialize authentication on component mount
  useEffect(() => {
    checkExistingAuth();
  }, [checkExistingAuth]);

  // Check token expiry periodically
  useEffect(() => {
    if (isLoggedIn) {
      checkTokenExpiry();
      const interval = setInterval(checkTokenExpiry, 60000); // Check every minute
      return () => clearInterval(interval);
    }
  }, [isLoggedIn, checkTokenExpiry]);

  // ===========================================
  // CONTEXT VALUE
  // ===========================================

  const contextValue = {
    // State
    isLoggedIn,
    currentUser,
    loading,
    loginForm,
    setLoginForm,
    loginError,
    setLoginError,
    
    // Actions
    login,
    forceLogin,
    logout,
    register,
    updateUser,
    
    // Token management
    handleAuthenticationError,
    isTokenExpired: (token) => isTokenExpired(token || localStorage.getItem(config.TOKEN_STORAGE_KEY)),
    getTokenExpiry: (token) => getTokenExpiry(token || localStorage.getItem(config.TOKEN_STORAGE_KEY)),
    
    // Utilities
    checkExistingAuth,
    parseLoginResponse
  };

  return (
    <AuthContext.Provider value={contextValue}>
      {children}
    </AuthContext.Provider>
  );
};