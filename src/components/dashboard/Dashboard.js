import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { AlertTriangle, CheckCircle, X, MapPin, Zap } from 'lucide-react';
import LoginScreen from '../auth/LoginScreen';
import Header from '../layout/Header';
import Navigation from '../layout/Navigation';
import Overview from './Overview';
import VehicleDetailsPage from '../vehicles/VehicleDetailsPage';
import DevicesPage from '../devices/DevicesPage';
import DeviceDetailsPage from '../devices/DeviceDetailsPage';
import DeviceAssignment from '../devices/DeviceAssignment';
import LeafletLiveMapPage from '../tracking/LeafletLiveMapPage';
import ApiDiagnosticTool from '../diagnostics/ApiDiagnosticTool';
import SimpleErrorBoundary from '../common/SimpleErrorBoundary';
import ErrorDiagnostic from '../diagnostics/ErrorDiagnostic';
import ComprehensiveAlarmSystem from '../alarms/ComprehensiveAlarmSystem';
import ApiOnlyRouteTracker from '../tracking/ApiOnlyRouteTracker';
import ApiOnlyEnhancedVehicleTrackingModal from '../tracking/ApiOnlyEnhancedVehicleTrackingModal';
import apiService from '../../services/api';

const Dashboard = () => {
  const { isLoggedIn } = useAuth();
  const [activeTab, setActiveTab] = useState('overview');
  const [selectedDeviceId, setSelectedDeviceId] = useState(null);
  const [selectedVehicleId, setSelectedVehicleId] = useState(null);
  const [showApiTracking, setShowApiTracking] = useState(false);
  const [selectedTrackingVehicle, setSelectedTrackingVehicle] = useState(null);
  
  // GLOBAL LIVE ALARM STATE - Works across all tabs
  const [criticalAlarmPopup, setCriticalAlarmPopup] = useState(null);
  const [globalLiveAlarms, setGlobalLiveAlarms] = useState([]);
  const [globalStreamActive, setGlobalStreamActive] = useState(false);
  const [seenAlarmIds, setSeenAlarmIds] = useState(new Set());
  
  const audioRef = useRef(null);
  const globalPollingRef = useRef(null);

  // Initialize audio for critical alarms
  useEffect(() => {
    audioRef.current = new Audio('https://www.soundjay.com/buttons/beep-01a.mp3');
    audioRef.current.preload = 'auto';

    // Request notification permission on load
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission().then(permission => {
        console.log('Notification permission:', permission);
      });
    }
  }, []);

  // GLOBAL LIVE ALARM POLLING - Works on ALL tabs
  const startGlobalLiveAlarmPolling = useCallback(async () => {
    if (globalPollingRef.current) {
      clearInterval(globalPollingRef.current);
    }

    console.log('🌍 Starting GLOBAL live alarm polling...');
    setGlobalStreamActive(true);

    const pollForGlobalLiveAlarms = async () => {
      try {
        console.log('🔍 Global polling for live alarms...');
        const response = await apiService.getManagerAlarms(0, 20);
        
        if (response.success && response.data) {
          const now = new Date();
          const tenMinutesAgo = new Date(now.getTime() - 10 * 60 * 1000);
          
          // Filter for very recent alarms
          const recentAlarms = response.data.filter(alarm => {
            const alarmTime = new Date(alarm.timestamp || alarm.alarmTime || alarm.createdAt);
            return alarmTime > tenMinutesAgo;
          });
          
          console.log(`📊 Found ${recentAlarms.length} recent alarms globally`);
          
          // Check for new alarms we haven't seen before
          recentAlarms.forEach(alarm => {
            const alarmId = alarm.alert_id || alarm.alarm_id || alarm.alarmId || alarm.id;
            
            // Check if we've already seen this alarm
            if (!seenAlarmIds.has(alarmId)) {
              console.log('🚨 NEW GLOBAL LIVE ALARM DETECTED:', alarm);
              
              // Add to seen alarms immediately
              setSeenAlarmIds(prev => new Set([...prev, alarmId]));
              
              const liveAlarm = {
                id: alarmId,
                device_id: alarm.device_id || alarm.deviceId,
                alarmType: alarm.alert_type || alarm.alarm_type || alarm.alarmType || 'Live Alert',
                severity: alarm.severity || 'high',
                status: alarm.status || 'active',
                message: alarm.message || alarm.description || 'Live alarm detected',
                timestamp: alarm.timestamp || alarm.alarmTime || alarm.createdAt || new Date().toISOString(),
                resolved: Boolean(alarm.resolved),
                latitude: alarm.latitude ? parseFloat(alarm.latitude) : null,
                longitude: alarm.longitude ? parseFloat(alarm.longitude) : null,
                imageUrl: alarm.imageUrl || alarm.previewUrl || alarm.image_url,
                isLive: true,
                source: 'live'
              };

              // Add to global live alarms
              setGlobalLiveAlarms(prev => [liveAlarm, ...prev]);
              
              // ALWAYS show popup for new live alarms
              console.log('🚨 Triggering GLOBAL popup for live alarm');
              setCriticalAlarmPopup(liveAlarm);
              
              // Play sound immediately
              if (audioRef.current) {
                audioRef.current.play().catch(error => 
                  console.error('Failed to play alarm sound:', error)
                );
              }
              
              // Show browser notification
              if ('Notification' in window && Notification.permission === 'granted') {
                new Notification('🚨 LIVE ALARM', {
                  body: `${liveAlarm.alarmType}: ${liveAlarm.message}`,
                  icon: '/favicon.ico'
                });
              }
            }
          });
        }
      } catch (error) {
        console.error('❌ Global live alarm polling error:', error);
      }
    };
    
    // Poll every 15 seconds
    globalPollingRef.current = setInterval(pollForGlobalLiveAlarms, 15000);
    
    // Initial poll
    pollForGlobalLiveAlarms();
  }, [seenAlarmIds]);

  const stopGlobalLiveAlarmPolling = useCallback(() => {
    if (globalPollingRef.current) {
      clearInterval(globalPollingRef.current);
      globalPollingRef.current = null;
    }
    setGlobalStreamActive(false);
    console.log('🛑 Global live alarm polling stopped');
  }, []);

  // Start global polling when user is logged in
  useEffect(() => {
    if (isLoggedIn && apiService.getToken()) {
      console.log('✅ User logged in, starting global live alarm polling');
      startGlobalLiveAlarmPolling();
    } else {
      console.log('🔒 User not logged in, stopping global polling');
      stopGlobalLiveAlarmPolling();
      setSeenAlarmIds(new Set());
      setGlobalLiveAlarms([]);
    }

    return () => {
      stopGlobalLiveAlarmPolling();
    };
  }, [isLoggedIn, startGlobalLiveAlarmPolling, stopGlobalLiveAlarmPolling]);

  const handleViewDevice = (deviceId) => {
    setSelectedDeviceId(deviceId);
    setActiveTab('device-details');
  };

  const handleBackFromDeviceDetails = () => {
    setSelectedDeviceId(null);
    setActiveTab('devices');
  };

  const handleViewVehicle = (vehicleId) => {
    setSelectedVehicleId(vehicleId);
    setActiveTab('vehicle-details');
  };

  const handleBackFromVehicleDetails = () => {
    setSelectedVehicleId(null);
    setActiveTab('vehicles');
  };

  const handleApiTracking = (vehicle) => {
    setSelectedTrackingVehicle(vehicle);
    setShowApiTracking(true);
  };

  const handleMapVehicleSelect = (vehicle) => {
    setSelectedVehicleId(vehicle.vehicle_id);
    setActiveTab('vehicle-details');
  };

  const renderContent = () => {
    switch (activeTab) {
      case 'overview':
        return <Overview onViewVehicle={handleViewVehicle} />;
      case 'live-map':
        return <LeafletLiveMapPage />;
      case 'assign':
        return <DeviceAssignment />;
      case 'error-diagnostic':
        return <ErrorDiagnostic />;
      case 'route-tracker':
        return (
          <SimpleErrorBoundary componentName="ApiOnlyRouteTracker">
            <ApiOnlyRouteTracker />
          </SimpleErrorBoundary>
        );
      case 'diagnostics':
        return <ApiDiagnosticTool />;
      case 'vehicle-details':
        return (
          <VehicleDetailsPage 
            vehicleId={selectedVehicleId} 
            onBack={handleBackFromVehicleDetails}
            onEnhancedTracking={handleApiTracking}
          />
        );
      case 'devices':
        return <DevicesPage onViewDevice={handleViewDevice} />;
      case 'alarms':
        return <ComprehensiveAlarmSystem 
          globalLiveAlarms={globalLiveAlarms}
          globalStreamActive={globalStreamActive}
          onStopGlobalPolling={stopGlobalLiveAlarmPolling}
          onStartGlobalPolling={startGlobalLiveAlarmPolling}
        />;
      case 'device-details':
        return (
          <DeviceDetailsPage 
            deviceId={selectedDeviceId} 
            onBack={handleBackFromDeviceDetails} 
          />
        ); 
      default:
        return <Overview onViewVehicle={handleViewVehicle} />;
    }
  };

  if (!isLoggedIn) {
    return <LoginScreen />;
  }

  return (
    <div className="min-h-screen bg-gray-100">
      {/* GLOBAL Live Alarm Status Bar - Shows on ALL tabs */}
      {globalStreamActive && (
        <div className="fixed top-0 left-0 right-0 z-40 px-4 py-2 text-white bg-purple-600 shadow-lg">
          <div className="flex items-center justify-between max-w-6xl mx-auto">
            <div className="flex items-center gap-3">
              <div className="w-3 h-3 bg-white rounded-full animate-pulse"></div>
              <span className="font-semibold">🚨 Live Alarm Monitoring Active</span>
              <span className="text-purple-200">({globalLiveAlarms.length} live alarms detected)</span>
            </div>
            <div className="flex items-center gap-3">
              <button 
                onClick={() => setActiveTab('alarms')}
                className="px-3 py-1 text-sm text-purple-600 bg-white rounded hover:bg-gray-100"
              >
                View Alarms
              </button>
              <button 
                onClick={stopGlobalLiveAlarmPolling}
                className="px-3 py-1 text-sm text-white bg-purple-500 rounded hover:bg-purple-400"
              >
                <Zap className="inline w-4 h-4 mr-1" />
                Stop
              </button>
            </div>
          </div>
        </div>
      )}

      {/* GLOBAL Critical Alarm Popup - Shows on ALL tabs */}
      {criticalAlarmPopup && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 animate-fadeIn">
          <div className="w-full max-w-lg p-6 mx-4 bg-white border-4 border-red-500 rounded-lg shadow-2xl animate-pulse">
            <div className="flex items-center gap-3 mb-4">
              <AlertTriangle className="w-10 h-10 text-red-600 animate-bounce" />
              <h2 className="text-2xl font-bold text-red-800">🚨 LIVE ALARM DETECTED</h2>
              <button onClick={() => setCriticalAlarmPopup(null)} className="ml-auto text-gray-500 hover:text-gray-700">
                <X className="w-6 h-6" />
              </button>
            </div>
            
            <div className="space-y-4">
              <div className="p-4 border border-red-200 rounded-lg bg-red-50">
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-3 h-3 bg-red-500 rounded-full animate-pulse"></div>
                  <p className="font-bold text-red-800">IMMEDIATE ATTENTION REQUIRED</p>
                </div>
                <p className="font-semibold text-gray-900">Device: {criticalAlarmPopup.device_id}</p>
                <p className="text-gray-700">Type: {criticalAlarmPopup.alarmType}</p>
                <p className="text-gray-700">Message: {criticalAlarmPopup.message}</p>
                <p className="text-sm text-gray-500">Time: {new Date(criticalAlarmPopup.timestamp).toLocaleString()}</p>
                <p className="mt-2 text-sm font-bold text-purple-600">🔴 LIVE ALARM - Current Tab: {activeTab.toUpperCase()}</p>
                {criticalAlarmPopup.severity && (
                  <p className="text-xs font-bold text-red-600">SEVERITY: {criticalAlarmPopup.severity.toUpperCase()}</p>
                )}
              </div>
              
              {criticalAlarmPopup.imageUrl && (
                <img src={criticalAlarmPopup.imageUrl} alt="Critical Alarm" className="object-cover w-full h-32 border rounded" onError={(e) => e.target.style.display = 'none'} />
              )}
              
              {(criticalAlarmPopup.latitude && criticalAlarmPopup.longitude) && (
                <div className="flex items-center gap-2 p-3 border border-blue-200 rounded bg-blue-50">
                  <MapPin className="w-5 h-5 text-blue-600" />
                  <span className="text-sm font-semibold text-blue-800">📍 Location: {criticalAlarmPopup.latitude.toFixed(4)}, {criticalAlarmPopup.longitude.toFixed(4)}</span>
                </div>
              )}
            </div>
            
            <div className="flex gap-3 mt-6">
              <button 
                onClick={() => {
                  setCriticalAlarmPopup(null);
                  setActiveTab('alarms');
                }} 
                className="flex items-center justify-center flex-1 gap-2 px-4 py-3 font-semibold text-white bg-green-600 rounded-lg hover:bg-green-700"
              >
                <CheckCircle className="w-5 h-5" />
                Go to Alarms Tab
              </button>
              <button onClick={() => setCriticalAlarmPopup(null)} className="flex-1 px-4 py-3 text-white bg-gray-600 rounded-lg hover:bg-gray-700">
                Dismiss & Continue
              </button>
            </div>
            
            <div className="mt-3 text-center">
              <p className="text-xs text-gray-500">This popup appears on ALL tabs when live alarms are detected</p>
            </div>
          </div>
        </div>
      )}

      <Header />
      {activeTab !== 'device-details' && activeTab !== 'vehicle-details' && (
        <Navigation activeTab={activeTab} setActiveTab={setActiveTab} />
      )}
      <main className={`p-6 ${globalStreamActive ? 'pt-16' : ''}`}>
        {renderContent()}
      </main>
      
      {showApiTracking && (
        <ApiOnlyEnhancedVehicleTrackingModal
          isOpen={showApiTracking}
          onClose={() => setShowApiTracking(false)}
          vehicle={selectedTrackingVehicle}
        />
      )}
    </div>
  );
};

export default Dashboard;