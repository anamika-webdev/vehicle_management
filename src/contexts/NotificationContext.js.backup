// Add this to your NotificationContext.js to prevent notification spam
// src/contexts/NotificationContext.js - Debounced notifications

import React, { createContext, useContext, useState, useCallback } from 'react';

const NotificationContext = createContext();

export const useNotification = () => {
  const context = useContext(NotificationContext);
  if (!context) {
    throw new Error('useNotification must be used within a NotificationProvider');
  }
  return context;
};

export const NotificationProvider = ({ children }) => {
  const [notifications, setNotifications] = useState([]);
  const [notificationHistory, setNotificationHistory] = useState(new Set()); // Prevent duplicates

  // Debounce notifications to prevent spam
  const showNotification = useCallback((type, title, message, duration = 5000) => {
    const notificationKey = `${type}-${title}-${message}`;
    
    // Check if this exact notification was shown recently (within 10 seconds)
    if (notificationHistory.has(notificationKey)) {
      console.log('🔇 Duplicate notification prevented:', title);
      return;
    }

    // Add to history to prevent duplicates
    setNotificationHistory(prev => new Set([...prev, notificationKey]));
    
    // Remove from history after 10 seconds
    setTimeout(() => {
      setNotificationHistory(prev => {
        const newSet = new Set(prev);
        newSet.delete(notificationKey);
        return newSet;
      });
    }, 10000);

    const id = Date.now() + Math.random();
    const notification = {
      id,
      type,
      title,
      message,
      timestamp: new Date()
    };

    console.log(`🔔 ${type.toUpperCase()} notification:`, title, message);

    setNotifications(prev => [...prev, notification]);

    // Auto-remove after duration
    setTimeout(() => {
      setNotifications(prev => prev.filter(n => n.id !== id));
    }, duration);
  }, [notificationHistory]);

  const showSuccess = useCallback((title, message, duration) => {
    showNotification('success', title, message, duration);
  }, [showNotification]);

  const showError = useCallback((title, message, duration) => {
    showNotification('error', title, message, duration);
  }, [showNotification]);

  const showWarning = useCallback((title, message, duration) => {
    showNotification('warning', title, message, duration);
  }, [showNotification]);

  const showInfo = useCallback((title, message, duration) => {
    showNotification('info', title, message, duration);
  }, [showNotification]);

  const removeNotification = useCallback((id) => {
    setNotifications(prev => prev.filter(n => n.id !== id));
  }, []);

  const clearAll = useCallback(() => {
    setNotifications([]);
    setNotificationHistory(new Set());
  }, []);

  const value = {
    notifications,
    showSuccess,
    showError,
    showWarning,
    showInfo,
    removeNotification,
    clearAll
  };

  return (
    <NotificationContext.Provider value={value}>
      {children}
      
      {/* Notification Display Component */}
      <div className="fixed z-50 space-y-2 top-4 right-4">
        {notifications.map(notification => (
          <div
            key={notification.id}
            className={`
              p-4 rounded-lg shadow-lg max-w-sm border-l-4 bg-white
              ${notification.type === 'success' ? 'border-green-500' : ''}
              ${notification.type === 'error' ? 'border-red-500' : ''}
              ${notification.type === 'warning' ? 'border-yellow-500' : ''}
              ${notification.type === 'info' ? 'border-blue-500' : ''}
              animate-in slide-in-from-right duration-300
            `}
          >
            <div className="flex items-start gap-3">
              <div className={`
                w-5 h-5 rounded-full flex items-center justify-center text-white text-xs
                ${notification.type === 'success' ? 'bg-green-500' : ''}
                ${notification.type === 'error' ? 'bg-red-500' : ''}
                ${notification.type === 'warning' ? 'bg-yellow-500' : ''}
                ${notification.type === 'info' ? 'bg-blue-500' : ''}
              `}>
                {notification.type === 'success' && '✓'}
                {notification.type === 'error' && '✕'}
                {notification.type === 'warning' && '!'}
                {notification.type === 'info' && 'i'}
              </div>
              
              <div className="flex-1">
                <h4 className="font-semibold text-gray-900">{notification.title}</h4>
                <p className="text-sm text-gray-600">{notification.message}</p>
              </div>
              
              <button
                onClick={() => removeNotification(notification.id)}
                className="text-gray-400 hover:text-gray-600"
              >
                ✕
              </button>
            </div>
          </div>
        ))}
      </div>
    </NotificationContext.Provider>
  );
};