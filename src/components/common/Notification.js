import React from 'react';
import { X } from 'lucide-react';
import { useNotification } from '../../contexts/NotificationContext';

const NotificationPanel = () => {
  const { notifications, removeNotification } = useNotification();

  return (
    <div className="fixed z-50 max-w-sm top-4 right-4">
      {notifications.map(notification => (
        <div
          key={notification.id}
          className={`mb-2 p-4 rounded-lg shadow-lg border-l-4 bg-white animate-slide-in ${
            notification.type === 'critical' ? 'border-red-500' : 
            notification.type === 'error' ? 'border-red-500' :
            notification.type === 'warning' ? 'border-yellow-500' :
            notification.type === 'success' ? 'border-green-500' :
            'border-blue-500'
          }`}
        >
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <h4 className={`font-bold text-sm ${
                notification.type === 'critical' || notification.type === 'error' ? 'text-red-800' :
                notification.type === 'warning' ? 'text-yellow-800' :
                notification.type === 'success' ? 'text-green-800' :
                'text-blue-800'
              }`}>
                {notification.title}
              </h4>
              <p className="mt-1 text-xs text-gray-600">{notification.message}</p>
              <p className="mt-1 text-xs text-gray-400">
                {new Date(notification.timestamp).toLocaleTimeString()}
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
      ))}
    </div>
  );
};

export default NotificationPanel;