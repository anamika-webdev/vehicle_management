// src/components/notifications/RealTimeNotificationSystem.js - Minimal version
import React, { useState, useCallback, createContext, useContext } from 'react';
import { CheckCircle, X, AlertTriangle, Bell } from 'lucide-react';

// Create the notification context
const NotificationContext = createContext();

// Minimal Notification Provider - just handles notifications, no polling
export const NotificationProvider = ({ children }) => {
  const [notifications, setNotifications] = useState([]);

  // Add notification with deduplication
  const addNotification = useCallback((notification) => {
    // Prevent duplicate notifications
    setNotifications(prev => {
      const isDuplicate = prev.some(n => 
        n.title === notification.title && 
        n.message === notification.message &&
        Date.now() - new Date(n.timestamp || 0).getTime() < 5000 // Within 5 seconds
      );
      
      if (isDuplicate) {
        console.log('🔇 Duplicate notification prevented:', notification.title);
        return prev;
      }
      
      return [{ ...notification, timestamp: new Date() }, ...prev.slice(0, 3)]; // Keep max 4 notifications
    });
    
    if (notification.autoHide !== false) {
      setTimeout(() => {
        removeNotification(notification.id);
      }, 4000);
    }
  }, []);

  // Remove notification
  const removeNotification = useCallback((id) => {
    setNotifications(prev => prev.filter(n => n.id !== id));
  }, []);

  // Show success notification (compatible with old API)
  const showSuccess = useCallback((title, message) => {
    addNotification({
      id: Date.now(),
      type: 'success',
      title,
      message,
      autoHide: true
    });
  }, [addNotification]);

  // Show error notification (compatible with old API)
  const showError = useCallback((title, message) => {
    addNotification({
      id: Date.now(),
      type: 'error',
      title,
      message,
      autoHide: true
    });
  }, [addNotification]);

  // Show warning notification (compatible with old API)
  const showWarning = useCallback((title, message) => {
    addNotification({
      id: Date.now(),
      type: 'warning',
      title,
      message,
      autoHide: true
    });
  }, [addNotification]);

  // Show info notification (compatible with old API)
  const showInfo = useCallback((title, message) => {
    addNotification({
      id: Date.now(),
      type: 'info',
      title,
      message,
      autoHide: true
    });
  }, [addNotification]);

  // Provide both old API and new API
  const value = {
    // Old API (for compatibility)
    notifications,
    showSuccess,
    showError,
    showWarning,
    showInfo,
    // New API
    connectionStatus: 'connected', // Always show connected
    realTimeData: { vehicles: 0, devices: 0, activeAlarms: 0 }, // Placeholder
    addNotification,
    removeNotification
  };

  return (
    <NotificationContext.Provider value={value}>
      {children}
    </NotificationContext.Provider>
  );
};

// Hook for old compatibility
export const useNotification = () => {
  const context = useContext(NotificationContext);
  if (!context) {
    throw new Error('useNotification must be used within a NotificationProvider');
  }
  return {
    showSuccess: context.showSuccess,
    showError: context.showError,
    showWarning: context.showWarning,
    showInfo: context.showInfo,
    notifications: context.notifications,
    removeNotification: context.removeNotification
  };
};

// Hook for new real-time features
export const useRealTimeNotifications = () => {
  const context = useContext(NotificationContext);
  if (!context) {
    throw new Error('useRealTimeNotifications must be used within a NotificationProvider');
  }
  return context;
};

// Simplified Status Header Component (no data display)
export const RealTimeStatusHeader = () => {
  return (
    <div className="flex items-center gap-2 text-sm">
      <span className="text-gray-600">System Status: </span>
      <span className="font-medium text-green-600">Connected</span>
    </div>
  );
};

// Notification Toast Component
export const NotificationToast = ({ notification, onClose }) => {
  const getIcon = () => {
    switch (notification.type) {
      case 'success':
        return <CheckCircle className="w-5 h-5 text-green-600" />;
      case 'error':
        return <AlertTriangle className="w-5 h-5 text-red-600" />;
      case 'warning':
        return <Bell className="w-5 h-5 text-orange-600" />;
      default:
        return <Bell className="w-5 h-5 text-blue-600" />;
    }
  };

  const getBgColor = () => {
    switch (notification.type) {
      case 'success':
        return 'bg-green-50 border-green-200';
      case 'error':
        return 'bg-red-50 border-red-200';
      case 'warning':
        return 'bg-orange-50 border-orange-200';
      default:
        return 'bg-blue-50 border-blue-200';
    }
  };

  return (
    <div className={`p-4 rounded-lg border shadow-lg max-w-sm ${getBgColor()} transform transition-all duration-300`}>
      <div className="flex items-start gap-3">
        {getIcon()}
        <div className="flex-1 min-w-0">
          <h4 className="text-sm font-semibold text-gray-900">{notification.title}</h4>
          <p className="mt-1 text-sm text-gray-700">{notification.message}</p>
        </div>
        <button
          onClick={() => onClose(notification.id)}
          className="flex-shrink-0 text-gray-400 hover:text-gray-600"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};

// Notification Container
export const NotificationContainer = () => {
  const { notifications, removeNotification } = useRealTimeNotifications();

  if (!notifications || notifications.length === 0) {
    return null;
  }

  return (
    <div className="fixed z-50 space-y-2 top-4 right-4">
      {notifications.map((notification) => (
        <NotificationToast
          key={notification.id}
          notification={notification}
          onClose={removeNotification}
        />
      ))}
    </div>
  );
};

// No connection popup since we're not doing real-time polling
export const RealTimeConnectionPopup = () => {
  return null;
};