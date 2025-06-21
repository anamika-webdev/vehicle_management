// Fixed AuthContext.js - Corrected API service method calls
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
    
    // Clear API service tokens - FIXED: Use correct method
    if (apiService.setToken) {
      apiService.setToken(null);
    }
    if (apiService.setRefreshToken) {
      apiService.setRefreshToken(null);
    }
    
    // Reset auth state
    setCurrentUser(null);
    setIsLoggedIn(false);
    setLoginError('Your session has expired. Please login again.');
    
    console.log('🔒 Authentication state cleared');
  }, []);

  // ===========================================
  // LOGIN FUNCTION - FIXED
  // ===========================================

  const login = async () => {
    setLoading(true);
    setLoginError('');
    
    try {
      console.log('🔐 Attempting login with:', loginForm.email);
      
      // Validate inputs
      if (!loginForm.email || !loginForm.password) {
        throw new Error('Email and password are required');
      }
      
      if (!loginForm.email.includes('@')) {
        throw new Error('Please enter a valid email address');
      }
      
      // FIXED: Call the correct login method
      const response = await apiService.login(loginForm.email, loginForm.password);
      
      console.log('🔍 Login response:', response);
      
      if (response && response.success) {
        // Parse the response to extract token and user data
        const { token, userData, refreshToken } = parseLoginResponse(response.data || response);
        
        if (token) {
          // Store authentication data
          localStorage.setItem(config.TOKEN_STORAGE_KEY, token);
          if (userData) {
            localStorage.setItem(config.USER_STORAGE_KEY, JSON.stringify(userData));
          }
          if (refreshToken) {
            localStorage.setItem(config.REFRESH_TOKEN_STORAGE_KEY, refreshToken);
          }
          
          // Update API service with new token - FIXED: Use correct method
          if (apiService.setToken) {
            apiService.setToken(token);
          }
          if (refreshToken && apiService.setRefreshToken) {
            apiService.setRefreshToken(refreshToken);
          }
          
          // Update state
          setCurrentUser(userData);
          setIsLoggedIn(true);
          setLoginError('');
          
          console.log('✅ Login successful for:', userData?.email || loginForm.email);
          
          return { success: true, user: userData };
        } else {
          throw new Error('No authentication token received from server');
        }
      } else {
        const errorMessage = response?.message || response?.error || 'Login failed';
        throw new Error(errorMessage);
      }
      
    } catch (error) {
      console.error('❌ Login failed:', error);
      
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
      
      return { success: false, error: errorMessage };
      
    } finally {
      setLoading(false);
    }
  };

  // ===========================================
  // LOGOUT FUNCTION - FIXED
  // ===========================================

  const logout = async () => {
    try {
      console.log('🔓 Logging out...');
      
      // FIXED: Call the correct logout method if it exists
      if (apiService.logout) {
        await apiService.logout();
      }
      
      // Clear all authentication data
      handleAuthenticationError();
      
      console.log('✅ Logout successful');
      
    } catch (error) {
      console.error('❌ Logout error:', error);
      // Clear auth data even if logout API call fails
      handleAuthenticationError();
    }
  };

  // ===========================================
  // INITIALIZATION
  // ===========================================

  const checkExistingAuth = useCallback(async () => {
    try {
      console.log('🔍 Checking existing authentication...');
      
      const token = localStorage.getItem(config.TOKEN_STORAGE_KEY);
      const userDataStr = localStorage.getItem(config.USER_STORAGE_KEY);
      const refreshToken = localStorage.getItem(config.REFRESH_TOKEN_STORAGE_KEY);
      
      if (token && userDataStr) {
        try {
          const userData = JSON.parse(userDataStr);
          
          if (!isTokenExpired(token)) {
            // FIXED: Use correct method to set token
            if (apiService.setToken) {
              apiService.setToken(token);
            }
            if (refreshToken && apiService.setRefreshToken) {
              apiService.setRefreshToken(refreshToken);
            }
            
            setCurrentUser(userData);
            setIsLoggedIn(true);
            console.log('✅ Restored authentication for:', userData.email);
          } else {
            console.log('🔐 Stored token has expired, clearing auth');
            localStorage.clear();
            if (apiService.setToken) {
              apiService.setToken(null);
            }
          }
          
        } catch (parseError) {
          console.warn('⚠️ Invalid stored user data, clearing auth');
          localStorage.clear();
          if (apiService.setToken) {
            apiService.setToken(null);
          }
        }
      } else {
        console.log('ℹ️ No existing authentication found');
      }
    } catch (error) {
      console.error('❌ Error checking existing auth:', error);
      // Clear potentially corrupted data
      localStorage.clear();
      if (apiService.setToken) {
        apiService.setToken(null);
      }
    } finally {
      setLoading(false);
    }
  }, [isTokenExpired]);

  // Check token expiry periodically
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
    console.log('✅ User data updated:', updatedUser.email);
  };

  // ===========================================
  // EFFECTS
  // ===========================================

  // Check existing authentication on mount
  useEffect(() => {
    checkExistingAuth();
  }, [checkExistingAuth]);

  // Set up token expiry checking
  useEffect(() => {
    if (isLoggedIn) {
      const interval = setInterval(checkTokenExpiry, 60000); // Check every minute
      return () => clearInterval(interval);
    }
  }, [isLoggedIn, checkTokenExpiry]);

  // ===========================================
  // CONTEXT VALUE
  // ===========================================

  const value = {
    isLoggedIn,
    currentUser,
    loading,
    loginForm,
    setLoginForm,
    loginError,
    setLoginError,
    login,
    logout,
    updateUser,
    handleAuthenticationError,
    getTokenExpiry: () => {
      const token = localStorage.getItem(config.TOKEN_STORAGE_KEY);
      return getTokenExpiry(token);
    }
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};

export default AuthProvider;