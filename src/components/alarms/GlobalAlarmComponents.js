import React from 'react';
import { 
  AlertTriangle, 
  X, 
  Bell, 
  Eye, 
  MapPin, 
  Clock,
  Shield,
  ExternalLink
} from 'lucide-react';
import { useGlobalAlarms, useAlarmIndicator } from '..//../hooks/useGlobalAlarms';

// Component to show in navigation/header - shows active alarm count
export const GlobalAlarmIndicator = ({ onShowAllAlarms }) => {
  const { 
    hasActiveAlarms, 
    activeCount, 
    criticalCount, 
    shouldPulse, 
    connected 
  } = useAlarmIndicator();

  if (!hasActiveAlarms) return null;

  return (
    <button
      onClick={onShowAllAlarms}
      className={`relative flex items-center gap-2 px-3 py-2 text-sm font-medium text-white rounded-lg transition-all duration-300 ${
        criticalCount > 0 
          ? 'bg-red-600 hover:bg-red-700' 
          : 'bg-orange-600 hover:bg-orange-700'
      } ${shouldPulse ? 'animate-pulse' : ''}`}
    >
      <AlertTriangle className="w-4 h-4" />
      <span>{activeCount} Active Alarm{activeCount > 1 ? 's' : ''}</span>
      
      {/* Critical alarm badge */}
      {criticalCount > 0 && (
        <span className="absolute flex items-center justify-center w-5 h-5 text-xs font-bold text-red-900 bg-yellow-400 rounded-full -top-1 -right-1 animate-bounce">
          {criticalCount}
        </span>
      )}
      
      {/* Connection status indicator */}
      <div className={`w-2 h-2 rounded-full ${connected ? 'bg-green-400' : 'bg-gray-400'}`} />
    </button>
  );
};

// Floating notification for new alarms
export const GlobalAlarmNotification = ({ alarm, onDismiss, onViewDetails, onViewAll, onView }) => {
  if (!alarm) return null;

  const getSeverityColors = (severity) => {
    switch (severity?.toLowerCase()) {
      case 'critical':
        return 'bg-red-600 border-red-700 text-white shadow-red-200';
      case 'high':
        return 'bg-orange-600 border-orange-700 text-white shadow-orange-200';
      case 'medium':
        return 'bg-yellow-600 border-yellow-700 text-white shadow-yellow-200';
      default:
        return 'bg-blue-600 border-blue-700 text-white shadow-blue-200';
    }
  };

  return (
    <div className="fixed z-50 top-4 right-4 w-96 animate-slideInRight">
      <div className={`rounded-lg shadow-2xl border-2 p-4 ${getSeverityColors(alarm.severity)}`}>
        <div className="flex items-start justify-between mb-3">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-6 h-6 animate-pulse" />
            <h3 className="text-lg font-bold">🚨 LIVE ALARM</h3>
          </div>
          <button onClick={onDismiss} className="opacity-75 hover:opacity-100">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="mb-4 space-y-2">
          <div className="font-semibold">Device: {alarm.device_id}</div>
          <div className="font-medium">{alarm.alarmType}</div>
          <div className="text-sm opacity-90">{alarm.message}</div>
          <div className="flex items-center gap-1 text-xs opacity-75">
            <Clock className="w-3 h-3" />
            {new Date(alarm.timestamp).toLocaleString()}
          </div>
          {alarm.latitude && alarm.longitude && (
            <div className="flex items-center gap-1 text-xs opacity-75">
              <MapPin className="w-3 h-3" />
              Location available
            </div>
          )}
        </div>

        <div className="flex gap-2">
          <button 
            onClick={onViewDetails}
            className="flex items-center justify-center flex-1 gap-1 px-3 py-1 text-xs bg-white rounded bg-opacity-20 hover:bg-opacity-30"
          >
            <Eye className="w-3 h-3" />
            Details
          </button>
          <button 
            onClick={onViewAll}
            className="flex items-center justify-center flex-1 gap-1 px-3 py-1 text-xs bg-white rounded bg-opacity-20 hover:bg-opacity-30"
          >
            <Bell className="w-3 h-3" />
            View All
          </button>
          
        </div>
      </div>
    </div>
  );
};

// Mini alarm widget for dashboards
export const AlarmSummaryWidget = ({ onShowDetails }) => {
  const { statistics, activeAlarms, loading, connected } = useGlobalAlarms();

  return (
    <div className="p-4 bg-white rounded-lg shadow-sm">
      <div className="flex items-center justify-between mb-4">
        <h3 className="flex items-center gap-2 text-lg font-semibold text-gray-900">
          <Shield className="w-5 h-5" />
          Alarm Status
        </h3>
        <div className={`w-3 h-3 rounded-full ${connected ? 'bg-green-500' : 'bg-red-500'}`} />
      </div>

      <div className="grid grid-cols-2 gap-4 mb-4">
        <div className="text-center">
          <div className="text-2xl font-bold text-red-600">{statistics.active}</div>
          <div className="text-sm text-gray-600">Active</div>
        </div>
        <div className="text-center">
          <div className="text-2xl font-bold text-orange-600">{statistics.critical}</div>
          <div className="text-sm text-gray-600">Critical</div>
        </div>
      </div>

      {activeAlarms.length > 0 && (
        <div className="mb-4 space-y-2">
          <div className="text-sm font-medium text-gray-700">Recent Active Alarms:</div>
          {activeAlarms.slice(0, 3).map((alarm) => (
            <div key={alarm.id} className="flex items-center gap-2 p-2 text-sm rounded bg-gray-50">
              <div className={`w-2 h-2 rounded-full ${
                alarm.severity === 'critical' ? 'bg-red-500' :
                alarm.severity === 'high' ? 'bg-orange-500' :
                alarm.severity === 'medium' ? 'bg-yellow-500' : 'bg-blue-500'
              }`} />
              <div className="flex-1 truncate">
                <div className="font-medium">{alarm.device_id}</div>
                <div className="text-gray-600">{alarm.alarmType}</div>
              </div>
            </div>
          ))}
          {activeAlarms.length > 3 && (
            <div className="text-xs text-center text-gray-500">
              +{activeAlarms.length - 3} more alarms
            </div>
          )}
        </div>
      )}

      <button
        onClick={onShowDetails}
        className="w-full px-4 py-2 text-sm text-blue-600 border border-blue-600 rounded-lg hover:bg-blue-50"
      >
        View All Alarms
      </button>
    </div>
  );
};

// Quick alarm list for sidebars
export const QuickAlarmList = ({ maxItems = 5, onAlarmClick }) => {
  const { activeAlarms, loading } = useGlobalAlarms();

  if (loading) {
    return (
      <div className="p-4 bg-white rounded-lg shadow-sm">
        <div className="space-y-2 animate-pulse">
          <div className="w-3/4 h-4 bg-gray-200 rounded"></div>
          <div className="w-1/2 h-3 bg-gray-200 rounded"></div>
        </div>
      </div>
    );
  }

  if (activeAlarms.length === 0) {
    return (
      <div className="p-4 bg-white rounded-lg shadow-sm">
        <div className="text-center text-gray-500">
          <Shield className="w-8 h-8 mx-auto mb-2 text-green-500" />
          <div className="text-sm">No Active Alarms</div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow-sm">
      <div className="p-4 border-b border-gray-200">
        <h3 className="font-semibold text-gray-900">Active Alarms</h3>
      </div>
      <div className="divide-y divide-gray-200">
        {activeAlarms.slice(0, maxItems).map((alarm) => (
          <div 
            key={alarm.id} 
            className="p-3 cursor-pointer hover:bg-gray-50"
            onClick={() => onAlarmClick && onAlarmClick(alarm)}
          >
            <div className="flex items-start gap-3">
              <div className={`w-3 h-3 rounded-full mt-1 ${
                alarm.severity === 'critical' ? 'bg-red-500' :
                alarm.severity === 'high' ? 'bg-orange-500' :
                alarm.severity === 'medium' ? 'bg-yellow-500' : 'bg-blue-500'
              }`} />
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium text-gray-900 truncate">
                  {alarm.device_id} - {alarm.alarmType}
                </div>
                <div className="text-xs text-gray-500 truncate">
                  {alarm.message}
                </div>
                <div className="mt-1 text-xs text-gray-400">
                  {new Date(alarm.timestamp).toLocaleTimeString()}
                </div>
              </div>
              {alarm.latitude && alarm.longitude && (
                <MapPin className="w-4 h-4 text-gray-400" />
              )}
            </div>
          </div>
        ))}
      </div>
      {activeAlarms.length > maxItems && (
        <div className="p-3 text-center border-t border-gray-200">
          <button className="text-sm text-blue-600 hover:text-blue-800">
            View {activeAlarms.length - maxItems} more alarms
          </button>
        </div>
      )}
    </div>
  );
};

// Floating action button for quick alarm access
export const AlarmFloatingButton = ({ onShowAlarms }) => {
  const { hasActiveAlarms, activeCount, criticalCount } = useAlarmIndicator();

  if (!hasActiveAlarms) return null;

  return (
    <div className="fixed z-40 bottom-6 right-6">
      <button
        onClick={onShowAlarms}
        className={`relative w-14 h-14 rounded-full shadow-lg text-white transition-all duration-300 ${
          criticalCount > 0 
            ? 'bg-red-600 hover:bg-red-700 animate-pulse' 
            : 'bg-orange-600 hover:bg-orange-700'
        }`}
      >
        <AlertTriangle className="w-6 h-6 mx-auto" />
        
        {/* Badge */}
        <span className="absolute flex items-center justify-center w-6 h-6 text-xs font-bold text-red-900 bg-yellow-400 rounded-full -top-2 -right-2">
          {activeCount > 99 ? '99+' : activeCount}
        </span>
      </button>
    </div>
  );
};

// Main component that handles all global alarm display logic
export const GlobalAlarmProvider = ({ children, onShowAllAlarms, onShowAlarmDetails }) => {
  const { notification, dismissNotification } = useGlobalAlarms();

  return (
    <>
      {children}
      
      {/* Global notification overlay */}
      {notification && (
        <GlobalAlarmNotification
          alarm={notification}
          onDismiss={dismissNotification}
          onViewDetails={() => {
            if (onShowAlarmDetails) {
              onShowAlarmDetails(notification);
            }
            dismissNotification();
          }}
          onViewAll={() => {
            if (onShowAllAlarms) {
              onShowAllAlarms();
            }
            dismissNotification();
          }}
        />
      )}
    </>
  );
};

// Hook to easily add alarm functionality to any component
export const useAlarmActions = () => {
  const { resolveAlarm, acknowledgeAlarm } = useGlobalAlarms();

  const handleResolveAlarm = async (alarmId) => {
    const result = await resolveAlarm(alarmId);
    if (result.success) {
      // You can add toast notification here
      console.log(`✅ Alarm ${alarmId} resolved successfully`);
    } else {
      console.error(`❌ Failed to resolve alarm ${alarmId}:`, result.error);
    }
    return result;
  };

  const handleAcknowledgeAlarm = async (alarmId) => {
    const result = await acknowledgeAlarm(alarmId);
    if (result.success) {
      console.log(`👁️ Alarm ${alarmId} acknowledged successfully`);
    } else {
      console.error(`❌ Failed to acknowledge alarm ${alarmId}:`, result.error);
    }
    return result;
  };

  return {
    resolveAlarm: handleResolveAlarm,
    acknowledgeAlarm: handleAcknowledgeAlarm
  };
};