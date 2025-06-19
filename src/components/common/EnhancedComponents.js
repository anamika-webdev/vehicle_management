// Enhanced components for error handling and loading states
// src/components/common/EnhancedComponents.js

import React from 'react';
import { AlertTriangle, RefreshCw, Wifi, WifiOff } from 'lucide-react';

// Enhanced Error Boundary
export class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { 
      hasError: false, 
      error: null, 
      errorInfo: null,
      isApiError: false
    };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true };
  }

  componentDidCatch(error, errorInfo) {
    console.error('Error Boundary caught an error:', error, errorInfo);
    
    const isApiError = error.message.includes('API') || 
                      error.message.includes('fetch') || 
                      error.message.includes('Network');
    
    this.setState({
      error: error,
      errorInfo: errorInfo,
      isApiError
    });
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex items-center justify-center min-h-screen bg-gray-50">
          <div className="max-w-md p-8 text-center bg-white rounded-lg shadow-lg">
            <AlertTriangle className="w-16 h-16 mx-auto mb-4 text-red-500" />
            <h2 className="mb-4 text-2xl font-bold text-gray-900">
              {this.state.isApiError ? 'Connection Error' : 'Something went wrong'}
            </h2>
            <p className="mb-6 text-gray-600">
              {this.state.isApiError 
                ? 'Unable to connect to the server. Please check your internet connection and try again.'
                : 'We\'re sorry, but something unexpected happened. Please try refreshing the page.'
              }
            </p>
            
            <div className="space-y-3">
              <button
                onClick={() => window.location.reload()}
                className="flex items-center justify-center w-full px-4 py-2 text-white bg-blue-600 rounded-lg hover:bg-blue-700"
              >
                <RefreshCw className="w-4 h-4 mr-2" />
                Refresh Page
              </button>
              
              {this.state.isApiError && (
                <button
                  onClick={() => this.setState({ hasError: false, error: null, errorInfo: null })}
                  className="w-full px-4 py-2 text-blue-600 border border-blue-600 rounded-lg hover:bg-blue-50"
                >
                  Try Again
                </button>
              )}
            </div>
            
            {process.env.NODE_ENV === 'development' && this.state.error && (
              <details className="mt-6 text-left">
                <summary className="font-medium text-red-600 cursor-pointer">Error Details (Development)</summary>
                <pre className="p-4 mt-2 overflow-auto text-xs bg-gray-100 rounded">
                  {this.state.error && this.state.error.toString()}
                  <br />
                  {this.state.errorInfo.componentStack}
                </pre>
              </details>
            )}
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

// Enhanced Loading Spinner with different states
export const LoadingSpinner = ({ 
  size = 'medium', 
  text = 'Loading...', 
  type = 'default',
  isFullScreen = false 
}) => {
  const sizeClasses = {
    small: 'w-4 h-4',
    medium: 'w-8 h-8',
    large: 'w-12 h-12',
    xlarge: 'w-16 h-16'
  };

  const typeClasses = {
    default: 'border-gray-300 border-t-blue-600',
    success: 'border-gray-300 border-t-green-600',
    warning: 'border-gray-300 border-t-yellow-600',
    error: 'border-gray-300 border-t-red-600',
    info: 'border-gray-300 border-t-blue-600'
  };

  const containerClasses = isFullScreen 
    ? 'fixed inset-0 flex flex-col items-center justify-center bg-white bg-opacity-80 z-50'
    : 'flex flex-col items-center justify-center p-8';

  return (
    <div className={containerClasses}>
      <div className={`${sizeClasses[size]} animate-spin rounded-full border-4 ${typeClasses[type]}`}></div>
      {text && <p className="mt-4 text-sm text-gray-600">{text}</p>}
    </div>
  );
};

// Connection Status Component
export const ConnectionStatus = ({ isConnected, isLoading = false }) => {
  return (
    <div className="flex items-center space-x-2">
      {isLoading ? (
        <div className="w-2 h-2 bg-yellow-500 rounded-full animate-pulse"></div>
      ) : (
        <div className={`w-2 h-2 rounded-full ${isConnected ? 'bg-green-500' : 'bg-red-500'}`}>
        </div>
      )}
      <span className="text-sm text-gray-600">
        {isLoading ? 'Connecting...' : (isConnected ? 'Connected' : 'Disconnected')}
      </span>
      {isConnected ? (
        <Wifi className="w-4 h-4 text-green-600" />
      ) : (
        <WifiOff className="w-4 h-4 text-red-600" />
      )}
    </div>
  );
};

// API Status Banner
export const ApiStatusBanner = ({ error, onRetry, onDismiss }) => {
  if (!error) return null;

  const isNetworkError = error.includes('fetch') || error.includes('Network');
  
  return (
    <div className={`w-full p-4 text-white ${isNetworkError ? 'bg-red-600' : 'bg-yellow-600'}`}>
      <div className="flex items-center justify-between mx-auto max-w-7xl">
        <div className="flex items-center space-x-3">
          <AlertTriangle className="w-5 h-5" />
          <div>
            <p className="font-medium">
              {isNetworkError ? 'Connection Error' : 'API Error'}
            </p>
            <p className="text-sm opacity-90">
              {isNetworkError 
                ? 'Unable to reach the server. Some features may be limited.'
                : error
              }
            </p>
          </div>
        </div>
        <div className="flex items-center space-x-2">
          {onRetry && (
            <button
              onClick={onRetry}
              className="px-3 py-1 text-sm border border-white border-opacity-50 rounded hover:bg-white hover:bg-opacity-20"
            >
              Retry
            </button>
          )}
          {onDismiss && (
            <button
              onClick={onDismiss}
              className="text-white opacity-70 hover:opacity-100"
            >
              ×
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default {
  ErrorBoundary,
  LoadingSpinner,
  ConnectionStatus,
  ApiStatusBanner
};