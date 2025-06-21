// src/components/common/Notification.js - Minimal debug version
import React from 'react';
import { X } from 'lucide-react';
import { useNotification } from '../../contexts/NotificationContext';

const NotificationPanel = () => {
  // This should be line 8 - hook called unconditionally
  const { notifications = [], removeNotification = () => {} } = useNotification();

  console.log('NotificationPanel rendered, notifications:', notifications);

  return (
    <div className="fixed z-50 max-w-sm top-4 right-4">
      {notifications.map ? notifications.map(notification => (
        <div
          key={notification.id}
          className="p-4 mb-2 bg-white border-l-4 border-blue-500 rounded-lg shadow-lg"
        >
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <h4 className="text-sm font-bold text-blue-800">
                {notification.title || 'Test'}
              </h4>
              <p className="mt-1 text-xs text-gray-600">
                {notification.message || 'Test message'}
              </p>
            </div>
            <button
              onClick={() => removeNotification(notification.id)}
              className="text-gray-400 hover:text-gray-600"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )) : <div>No notifications array</div>}
    </div>
  );
};

export default NotificationPanel;