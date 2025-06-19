// Updated LoginScreen.js with ESLint fixes
// src/components/auth/LoginScreen.js

import React, { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { useNotification } from '../../contexts/NotificationContext';
import { Shield, Eye, EyeOff, RefreshCw } from 'lucide-react'; // Removed CheckCircle
import apiService from '../../services/api';

const LoginScreen = () => {
  const { login, loginForm, setLoginForm, loginError, loading } = useAuth();
  const { showError, showSuccess } = useNotification();
  const [showPassword, setShowPassword] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState('checking');

  useEffect(() => {
    const checkConnection = async () => {
      try {
        await apiService.healthCheck();
        setConnectionStatus('connected');
      } catch (error) {
        console.warn('Connection check failed:', error.message);
        if (error.message.includes('Network') || error.message.includes('fetch')) {
          setConnectionStatus('offline');
        } else {
          setConnectionStatus('limited');
        }
      }
    };

    checkConnection();
    
    // Check connection every 30 seconds
    const interval = setInterval(checkConnection, 30000);
    return () => clearInterval(interval);
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!loginForm.email || !loginForm.password) {
      showError('Validation Error', 'Please enter both email and password');
      return;
    }

    if (!loginForm.email.includes('@')) {
      showError('Validation Error', 'Please enter a valid email address');
      return;
    }

    try {
      await login();
      showSuccess('Login Successful', 'Welcome to Vehicle Management Dashboard');
    } catch (error) {
      console.error('Login failed:', error);
      // Error is already handled in AuthContext
    }
  };

  const handleQuickLogin = () => {
    setLoginForm({
      email: 'demo@vehiclemanagement.com',
      password: 'demo123'
    });
  };

  const handleInputChange = (field, value) => {
    setLoginForm(prev => ({
      ...prev,
      [field]: value
    }));
    
    // Clear login error when user starts typing
    if (loginError) {
      // This would be handled in AuthContext
    }
  };

  const togglePasswordVisibility = () => {
    setShowPassword(!showPassword);
  };

  const handleForgotPassword = () => {
    showError('Feature Unavailable', 'Password reset functionality is not yet implemented');
  };

  const isFormValid = loginForm.email && loginForm.password && loginForm.email.includes('@');

  const getConnectionStatusColor = () => {
    switch (connectionStatus) {
      case 'connected': return 'text-green-600 bg-green-100';
      case 'limited': return 'text-yellow-600 bg-yellow-100';
      case 'offline': return 'text-red-600 bg-red-100';
      default: return 'text-gray-600 bg-gray-100';
    }
  };

  const getConnectionStatusText = () => {
    switch (connectionStatus) {
      case 'connected': return '✅ Server Connected';
      case 'limited': return '⚠️ Limited Connectivity';
      case 'offline': return '❌ Working Offline';
      default: return '🔄 Checking Connection...';
    }
  };

  return (
    <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-blue-900 to-blue-700">
      <div className="w-full max-w-md p-8 bg-white rounded-lg shadow-2xl">
        {/* Header */}
        <div className="mb-8 text-center">
          <Shield className="w-16 h-16 mx-auto mb-4 text-blue-600" />
          <h1 className="text-2xl font-bold text-gray-900">Vehicle Management Dashboard</h1>
          <p className="text-gray-600">Manager Login</p>
        </div>

        {/* Connection Status */}
        <div className={`mb-6 p-3 rounded-lg border ${getConnectionStatusColor()}`}>
          <div className="flex items-center justify-center text-sm font-medium">
            {connectionStatus === 'checking' && <RefreshCw className="w-4 h-4 mr-2 animate-spin" />}
            {getConnectionStatusText()}
          </div>
          {connectionStatus === 'offline' && (
            <div className="mt-1 text-xs text-center opacity-75">
              Some features may be limited in offline mode
            </div>
          )}
        </div>

        {/* Login Error */}
        {loginError && (
          <div className="p-4 mb-6 bg-red-100 border border-red-300 rounded-lg">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <svg className="w-5 h-5 text-red-500" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                </svg>
              </div>
              <div className="ml-3">
                <h3 className="text-sm font-medium text-red-800">Login Failed</h3>
                <p className="text-sm text-red-700">{loginError}</p>
              </div>
            </div>
          </div>
        )}

        {/* Login Form */}
        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label htmlFor="email" className="block text-sm font-medium text-gray-700">
              Email
            </label>
            <input
              id="email"
              type="email"
              value={loginForm.email}
              onChange={(e) => handleInputChange('email', e.target.value)}
              className="w-full px-3 py-2 mt-1 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
              placeholder="Enter your email"
              required
              disabled={loading}
            />
          </div>

          <div>
            <label htmlFor="password" className="block text-sm font-medium text-gray-700">
              Password
            </label>
            <div className="relative mt-1">
              <input
                id="password"
                type={showPassword ? 'text' : 'password'}
                value={loginForm.password}
                onChange={(e) => handleInputChange('password', e.target.value)}
                className="w-full px-3 py-2 pr-10 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                placeholder="Enter your password"
                required
                disabled={loading}
              />
              <button
                type="button"
                onClick={togglePasswordVisibility}
                className="absolute inset-y-0 right-0 flex items-center pr-3 text-gray-400 hover:text-gray-600"
                disabled={loading}
              >
                {showPassword ? (
                  <EyeOff className="w-5 h-5" />
                ) : (
                  <Eye className="w-5 h-5" />
                )}
              </button>
            </div>
          </div>

          <div className="flex items-center justify-between">
            <div className="flex items-center">
              <input
                id="remember-me"
                name="remember-me"
                type="checkbox"
                className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                disabled={loading}
              />
              <label htmlFor="remember-me" className="ml-2 text-sm text-gray-900">
                Remember me
              </label>
            </div>

            <button
              type="button"
              onClick={handleForgotPassword}
              className="text-sm text-blue-600 hover:text-blue-500"
              disabled={loading}
            >
              Forgot password?
            </button>
          </div>

          <button
            type="submit"
            disabled={loading || !isFormValid || connectionStatus === 'offline'}
            className="flex justify-center w-full px-4 py-2 text-sm font-medium text-white bg-blue-600 border border-transparent rounded-md shadow-sm hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? (
              <>
                <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                Signing In...
              </>
            ) : (
              'Sign In'
            )}
          </button>
        </form>

        {/* Quick Login */}
        <div className="pt-6 mt-6 border-t border-gray-200">
          <div className="text-center">
            <p className="mb-3 text-sm text-gray-600">Quick Login</p>
            <button
              type="button"
              onClick={handleQuickLogin}
              disabled={loading || connectionStatus === 'offline'}
              className="inline-flex items-center px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md shadow-sm hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Use Demo Credentials
            </button>
          </div>
        </div>

        {/* Footer */}
        <div className="mt-8 text-center">
          <p className="text-xs text-gray-500">
            Vehicle Management Dashboard v1.0.0
          </p>
          <p className="mt-1 text-xs text-gray-500">
            Secure • Reliable • Real-time
          </p>
        </div>
      </div>
    </div>
  );
};

export default LoginScreen;