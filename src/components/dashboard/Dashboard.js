import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { AlertTriangle, CheckCircle, X, MapPin, Zap } from 'lucide-react';
import { toast } from 'react-toastify';
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
import ApiOnlyRouteTracker from '../tracking/ApiOnlyRouteTracker';
import ApiOnlyEnhancedVehicleTrackingModal from '../tracking/ApiOnlyEnhancedVehicleTrackingModal';
import apiService from '../../services/api';
import EventBasedAlarmTable from '../alarms/EventBasedAlarmTable';

const Dashboard = () => {
  const { isLoggedIn } = useAuth();
  const [activeTab, setActiveTab] = useState('overview');
  const [selectedDeviceId, setSelectedDeviceId] = useState(null);
  const [selectedVehicleId, setSelectedVehicleId] = useState(null);
  const [showApiTracking, setShowApiTracking] = useState(false);
  const [selectedTrackingVehicle, setSelectedTrackingVehicle] = useState(null);
  
  
  // GLOBAL LIVE ALARM STATE
  const [criticalAlarmPopup, setCriticalAlarmPopup] = useState(null);
  const [globalLiveAlarms, setGlobalLiveAlarms] = useState([]);
  const [persistentAlarms, setPersistentAlarms] = useState([]);
  const [globalStreamActive, setGlobalStreamActive] = useState(false);
  const [seenAlarmIds, setSeenAlarmIds] = useState(new Set());
  const [selectedAlarmForView, setSelectedAlarmForView] = useState(null);
  const [showViewModal, setShowViewModal] = useState(false);

  const [deviceModalOpen, setDeviceModalOpen] = useState(false);
  const [selectedDeviceForModal, setSelectedDeviceForModal] = useState(null);

  const openDeviceMapModal = (device) => {
  setSelectedDeviceForModal(device);
  setDeviceModalOpen(true);
   };

  
  const audioRef = useRef(null);
  const globalPollingRef = useRef(null);
  const eventSourceRef = useRef(null);

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

  // Fetch persistent alarms
  const fetchPersistentAlarms = async () => {
    try {
      const response = await apiService.getManagerAlarms(1, 100);
      if (response.success && response.data) {
        const normalizedAlarms = response.data.map(alarm => ({
          id: alarm.alert_id || alarm.alarmId || alarm.alarm_id || alarm.id,
          device_id: alarm.device_id || alarm.deviceId,
          alarmType: alarm.alert_type || alarm.alarm_type || alarm.alarmType || 'Unknown',
          severity: alarm.severity || alarm.alarmType || 'medium',
          status: alarm.status || 'active',
          message: alarm.message || alarm.description || 'No description',
          timestamp: alarm.timestamp || alarm.alarmTime || alarm.createdAt || new Date().toISOString(),
          resolved: Boolean(alarm.resolved),
          latitude: alarm.latitude ? parseFloat(alarm.latitude) : null,
          longitude: alarm.longitude ? parseFloat(alarm.longitude) : null,
          imageUrl: alarm.imageUrl || alarm.previewUrl || alarm.image_url,
          isLive: false,
          source: 'persistent'
        }));
        setPersistentAlarms(normalizedAlarms);
      } else {
        throw new Error('Failed to fetch persistent alarms');
      }
    } catch (err) {
      console.error('Fetch persistent alarms error:', err);
      toast.error('Failed to fetch persistent alarms');
    }
  };

  // GLOBAL LIVE ALARM POLLING
  const startGlobalLiveAlarmPolling = useCallback(async () => {
    if (globalPollingRef.current) {
      clearInterval(globalPollingRef.current);
    }

    console.log('🌍 Starting GLOBAL live alarm polling...');
    setGlobalStreamActive(true);

    const pollForGlobalLiveAlarms = async () => {
      try {
        console.log('🔍 Global polling for live alarms...');
        const response = await apiService.getManagerAlarms(1, 20);
        
        if (response.success && response.data) {
          const now = new Date();
          const tenMinutesAgo = new Date(now.getTime() - 10 * 60 * 1000);
          
          const recentAlarms = response.data.filter(alarm => {
            const alarmTime = new Date(alarm.timestamp || alarm.alarmTime || alarm.createdAt);
            return alarmTime > tenMinutesAgo && !alarm.resolved;
          });
          
          console.log(`📊 Found ${recentAlarms.length} recent alarms globally`);
          
          recentAlarms.forEach(alarm => {
            const alarmId = alarm.alert_id || alarm.alarm_id || alarm.alarmId || alarm.id;
            
            if (!seenAlarmIds.has(alarmId)) {
              console.log('🚨 NEW GLOBAL LIVE ALARM DETECTED:', alarm);
              
              setSeenAlarmIds(prev => new Set([...prev, alarmId]));
              
              const liveAlarm = {
                id: alarmId,
                device_id: alarm.device_id || alarm.deviceId,
                alarmType: alarm.alert_type || alarm.alarm_type || alarm.alarmType || 'Live Alert',
                severity: alarm.severity || alarm.alarmType || 'high',
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

              setGlobalLiveAlarms(prev => {
                const updatedAlarms = [liveAlarm, ...prev.filter(a => a.id !== alarmId)];
                console.log(`📢 Updated global live alarms: ${updatedAlarms.length} alarms`);
                return updatedAlarms;
              });
              
              const severity = (liveAlarm.severity || liveAlarm.alarmType || 'medium').toLowerCase();
              if (liveAlarm.isLive && (severity === 'critical' || severity === 'high')) {
                console.log(`🚨 Triggering GLOBAL popup for Alarm ID: ${alarmId}, Severity: ${severity}, Current Tab: ${activeTab}`);
                setCriticalAlarmPopup(liveAlarm);
                
                if (audioRef.current) {
                  audioRef.current.play().catch(error => 
                    console.error('Failed to play alarm sound:', error)
                  );
                }
                
                if ('Notification' in window && Notification.permission === 'granted') {
                  new Notification('🚨 LIVE ALARM', {
                    body: `${liveAlarm.alarmType}: ${liveAlarm.message}`,
                    icon: '/favicon.ico',
                    requireInteraction: true
                  });
                }
              }
            }
          });
        } else {
          console.warn('No alarms received or API call failed');
        }
      } catch (error) {
        console.error('❌ Global live alarm polling error:', error);
      }
    };
    
    globalPollingRef.current = setInterval(pollForGlobalLiveAlarms, 10000);
    pollForGlobalLiveAlarms();
  }, [seenAlarmIds, activeTab]);

  const stopGlobalLiveAlarmPolling = useCallback(() => {
    if (globalPollingRef.current) {
      clearInterval(globalPollingRef.current);
      globalPollingRef.current = null;
    }
    setGlobalStreamActive(false);
    console.log('🛑 Global live alarm polling stopped');
  }, []);

  // Global EventSource stream for live alarms
  useEffect(() => {
    if (!isLoggedIn || !apiService.getToken()) return;

    const mid = 1; // TODO: Replace with actual manager ID
    console.log(`🌐 Starting global alarm stream via EventSource for mid=${mid}...`);
    eventSourceRef.current = new EventSource(`http://164.52.194.198:9090/alarm/v1/stream/${mid}`);

    eventSourceRef.current.addEventListener('alarm', (event) => {
      try {
        const data = JSON.parse(event.data);
        const alarmId = data.alert_id || data.alarm_id || data.alarmId || `alarm_${Date.now()}`;

        if (!seenAlarmIds.has(alarmId)) {
          console.log("📡 Global live stream alarm received:", data);

          const liveAlarm = {
            id: alarmId,
            device_id: data.device_id || data.deviceId,
            alarmType: data.alarmType || 'Live Alert',
            severity: data.severity || data.alarmType || 'high',
            status: 'active',
            message: data.message || data.description || 'Live alarm detected',
            timestamp: data.timestamp || data.alarmTime || data.createdAt || new Date().toISOString(),
            resolved: Boolean(data.resolved),
            latitude: data.latitude ? parseFloat(data.latitude) : null,
            longitude: data.longitude ? parseFloat(data.longitude) : null,
            imageUrl: data.imageUrl || data.previewUrl || data.image_url,
            isLive: true,
            source: 'stream'
          };

          setSeenAlarmIds(prev => new Set([...prev, alarmId]));
          setGlobalLiveAlarms(prev => [liveAlarm, ...prev]);

          const allowedSeverities = ['critical', 'high', 'moderate', 'low'];
          const severity = (liveAlarm.severity || '').toLowerCase();

          if (liveAlarm.isLive && allowedSeverities.includes(severity)) {
            console.log(`🚨 Triggering GLOBAL popup for severity: ${severity}, Alarm ID: ${alarmId}, Current Tab: ${activeTab}`);
            setCriticalAlarmPopup(liveAlarm);
            toast.info(`🚨 ${liveAlarm.alarmType} - ${liveAlarm.message}`, { autoClose: 5000 });

            if (audioRef.current) {
              audioRef.current.play().catch(err => console.error("🔈 Alarm sound error:", err));
            }

            if ('Notification' in window && Notification.permission === 'granted') {
              new Notification('🚨 LIVE ALARM', {
                body: `${liveAlarm.alarmType}: ${liveAlarm.message}`,
                icon: '/favicon.ico',
                requireInteraction: true
              });
            }
          }
        }
      } catch (err) {
        console.error("❌ Failed to parse stream alarm data:", err);
      }
    });

    eventSourceRef.current.onerror = (err) => {
      console.error("❌ EventSource error:", err);
      setTimeout(() => {
        if (isLoggedIn && apiService.getToken()) {
          console.log(`🌐 Reconnecting to EventSource for mid=${mid}...`);
          eventSourceRef.current = new EventSource(`http://164.52.194.198:9090/alarm/v1/stream/${mid}`);
        }
      }, 5000);
    };

    return () => {
      if (eventSourceRef.current) {
        console.log("🛑 Stopping global EventSource stream");
        eventSourceRef.current.close();
      }
    };
  }, [isLoggedIn, seenAlarmIds, activeTab]);

  // Start global polling and fetch persistent alarms when user is logged in
  useEffect(() => {
    if (isLoggedIn && apiService.getToken()) {
      console.log('✅ User logged in, starting global live alarm polling and fetching persistent alarms');
      startGlobalLiveAlarmPolling();
      fetchPersistentAlarms();
    } else {
      console.log('🔒 User not logged in, stopping global polling and clearing alarms');
      stopGlobalLiveAlarmPolling();
      setSeenAlarmIds(new Set());
      setGlobalLiveAlarms([]);
      setPersistentAlarms([]);
      setCriticalAlarmPopup(null);
    }

    return () => {
      stopGlobalLiveAlarmPolling();
    };
  }, [isLoggedIn, startGlobalLiveAlarmPolling, stopGlobalLiveAlarmPolling]);

  // Alarm action handlers
  const handleAlarmAcknowledge = async (alarmId) => {
    try {
      const response = await apiService.acknowledgeAlarm(alarmId);
      if (response.success) {
        setGlobalLiveAlarms(prev =>
          prev.map(alarm =>
            alarm.id === alarmId ? { ...alarm, status: 'acknowledged', resolved: false } : alarm
          )
        );
        setPersistentAlarms(prev =>
          prev.map(alarm =>
            alarm.id === alarmId ? { ...alarm, status: 'acknowledged', resolved: false } : alarm
          )
        );
        setCriticalAlarmPopup(prev => (prev && prev.id === alarmId ? null : prev));
        toast.success('Alarm acknowledged');
      } else {
        throw new Error('Failed to acknowledge alarm');
      }
    } catch (err) {
      console.error('Acknowledge error:', err);
      toast.error('Failed to acknowledge alarm');
    }
  };

  const handleAlarmResolve = async (alarmId) => {
    try {
      const response = await apiService.resolveAlarm(alarmId);
      if (response.success) {
        setGlobalLiveAlarms(prev =>
          prev.map(alarm =>
            alarm.id === alarmId ? { ...alarm, status: 'resolved', resolved: true } : alarm
          )
        );
        setPersistentAlarms(prev =>
          prev.map(alarm =>
            alarm.id === alarmId ? { ...alarm, status: 'resolved', resolved: true } : alarm
          )
        );
        setCriticalAlarmPopup(prev => (prev && prev.id === alarmId ? null : prev));
        toast.success('Alarm resolved');
      } else {
        throw new Error('Failed to resolve alarm');
      }
    } catch (err) {
      console.error('Resolve error:', err);
      toast.error('Failed to resolve alarm');
    }
  };

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
        return (
          <EventBasedAlarmTable
            globalLiveAlarms={globalLiveAlarms}
            globalStreamActive={globalStreamActive}
            persistentAlarms={persistentAlarms}
            onAlarmAcknowledge={handleAlarmAcknowledge}
            onAlarmResolve={handleAlarmResolve}
            onStartGlobalStream={startGlobalLiveAlarmPolling}
            onStopGlobalStream={stopGlobalLiveAlarmPolling}          
            
          />
        );
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
      
      {/* GLOBAL Critical Alarm Popup */}
      {criticalAlarmPopup && criticalAlarmPopup.isLive && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 animate-fadeIn">
          <div className={`w-full max-w-lg p-6 mx-4 bg-white rounded-lg shadow-2xl
            ${criticalAlarmPopup.severity ? {
              'critical': 'border-4 border-red-500',
              'high': 'border-4 border-orange-500',
              'moderate': 'border-4 border-yellow-500',
              'low': 'border-4 border-green-500'
            }[criticalAlarmPopup.severity.toLowerCase()] || 'border-4 border-gray-500' : 'border-4 border-gray-500'}`}>
            <div className="flex items-center gap-3 mb-4">
              <AlertTriangle className={`w-10 h-10 animate-bounce
                ${criticalAlarmPopup.severity ? {
                  'critical': 'text-red-600',
                  'high': 'text-orange-600',
                  'moderate': 'text-yellow-600',
                  'low': 'text-green-600'
                }[criticalAlarmPopup.severity.toLowerCase()] || 'text-gray-600' : 'text-gray-600'}`} />
              <h2 className="text-2xl font-bold text-red-800">🚨 LIVE ALARM DETECTED</h2>
              <button onClick={() => {
                console.log(`Dismissing popup for Alarm ID: ${criticalAlarmPopup.id}`);
                setCriticalAlarmPopup(null);
              }} className="ml-auto text-gray-500 hover:text-gray-700">
                <X className="w-6 h-6" />
              </button>
            </div>
            
            <div className="space-y-4">
              <div className={`p-4 border rounded-lg
                ${criticalAlarmPopup.severity ? {
                  'critical': 'border-red-200 bg-red-50',
                  'high': 'border-orange-200 bg-orange-50',
                  'moderate': 'border-yellow-200 bg-yellow-50',
                  'low': 'border-green-200 bg-green-50'
                }[criticalAlarmPopup.severity.toLowerCase()] || 'border-gray-200 bg-gray-50' : 'border-gray-200 bg-gray-50'}`}>
                <div className="flex items-center gap-2 mb-2">
                  <div className={`w-3 h-3 rounded-full animate-pulse
                    ${criticalAlarmPopup.severity ? {
                      'critical': 'bg-red-500',
                      'high': 'bg-orange-500',
                      'moderate': 'bg-yellow-500',
                      'low': 'bg-green-500'
                    }[criticalAlarmPopup.severity.toLowerCase()] || 'bg-gray-500' : 'bg-gray-500'}`} />
                  <p className="font-bold text-red-800">IMMEDIATE ATTENTION REQUIRED</p>
                </div>
                <p className="font-semibold text-gray-900">Device: {criticalAlarmPopup.device_id}</p>
                <p className="text-gray-700">Type: {criticalAlarmPopup.alarmType}</p>
                <p className="text-gray-700">Message: {criticalAlarmPopup.message}</p>
                <p className="text-sm text-gray-500">Time: {new Date(criticalAlarmPopup.timestamp).toLocaleString()}</p>
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
             setSelectedAlarmForView(criticalAlarmPopup);
            setShowViewModal(true);
             setCriticalAlarmPopup(null);
            }} 
            className="flex-1 px-4 py-3 text-white bg-orange-600 rounded-lg hover:bg-orange-700"
             >
           View
          </button>
              <button 
                onClick={() => {
                  console.log(`Navigating to alarms tab for Alarm ID: ${criticalAlarmPopup.id}`);
                  setCriticalAlarmPopup(null);
                  setActiveTab('alarms');
                }} 
                className="flex items-center justify-center flex-1 gap-2 px-4 py-3 font-semibold text-white bg-green-600 rounded-lg hover:bg-green-700"
              >
                <CheckCircle className="w-5 h-5" />
                Go to Alarms Tab
              </button>
              <button 
                onClick={() => {
                  console.log(`Dismissing popup for Alarm ID: ${criticalAlarmPopup.id}`);
                  setCriticalAlarmPopup(null);
                }} 
                className="flex-1 px-4 py-3 text-white bg-gray-600 rounded-lg hover:bg-gray-700"
              >
                Dismiss & Continue
              </button>
            </div>
            

          </div>
        </div>
      )}

      <Header />
      
{showViewModal && selectedAlarmForView && (
  <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 animate-fadeIn">
    <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto">
      <div className="p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-900">Alarm Details</h3>
          <button
            onClick={() => setShowViewModal(false)}
            className="text-gray-400 hover:text-gray-600"
            title="Close modal"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700">Alarm ID</label>
              <p className="mt-1 text-sm text-gray-900">{selectedAlarmForView.id}</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Type</label>
              <p className="mt-1 text-sm text-gray-900">{selectedAlarmForView.alarmType}</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Severity</label>
              <p className="mt-1 text-sm text-gray-900">{selectedAlarmForView.severity}</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Status</label>
              <p className="mt-1 text-sm text-gray-900">{selectedAlarmForView.status}</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Device ID</label>
              <p className="mt-1 text-sm text-gray-900">{selectedAlarmForView.device_id || 'Unknown'}</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Time</label>
              <p className="mt-1 text-sm text-gray-900">
                {new Date(selectedAlarmForView.timestamp).toLocaleString()}
              </p>
            </div>
            {(selectedAlarmForView.latitude && selectedAlarmForView.longitude) && (
              <div className="col-span-2">
                <label className="block text-sm font-medium text-gray-700">Location</label>
                <p className="mt-1 text-sm text-gray-900">
                  {parseFloat(selectedAlarmForView.latitude).toFixed(6)},{' '}
                  {parseFloat(selectedAlarmForView.longitude).toFixed(6)}
                </p>
              </div>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700">Message</label>
            <p className="mt-1 text-sm text-gray-900">{selectedAlarmForView.message}</p>
          </div>
           
          {selectedAlarmForView.imageUrl && (
            <div>
              <label className="block text-sm font-medium text-gray-700">Preview Image</label>
              <img
                src={selectedAlarmForView.imageUrl}
                alt="Alarm preview"
                className="h-auto max-w-full mt-2 border border-gray-300 rounded-lg"
                onError={(e) => {
                  e.target.style.display = 'none';
                  console.error('❌ Failed to load image in modal:', selectedAlarmForView.imageUrl);
                }}
              />
            </div>
          )}

          <div className="flex justify-end pt-4 space-x-3">
            {selectedAlarmForView.status !== 'resolved' && (
              <button
                onClick={() => {
                  handleAlarmResolve(selectedAlarmForView.id);
                  setShowViewModal(false);
                }}
                className="px-4 py-2 text-white transition-colors bg-green-600 rounded-lg hover:bg-green-700"
                title="Resolve alarm"
              >
                Resolve
              </button>
            )}
            <button
              onClick={() => setShowViewModal(false)}
              className="px-4 py-2 text-white transition-colors bg-gray-600 rounded-lg hover:bg-gray-700"
              title="Close modal"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>
)}
      {activeTab !== 'device-details' && activeTab !== 'vehicle-details' && (
        <Navigation activeTab={activeTab} setActiveTab={setActiveTab} />
      )}
      <main className={`p-6 ${globalStreamActive ? '' : ''}`}>
        {renderContent()}
      </main>
      
      {showApiTracking && (
        <ApiOnlyEnhancedVehicleTrackingModal
          isOpen={showApiTracking}
          onClose={() => setShowApiTracking(false)}
          vehicle={selectedTrackingVehicle}
        />
      )}
      
      <button 
        onClick={() => {
          const testAlarm = {
            id: `test_${Date.now()}`,
            device_id: 'TEST_DEVICE',
            alarmType: 'Test Alert',
            severity: 'critical',
            status: 'active',
            message: 'This is a test alarm!',
            timestamp: new Date().toISOString(),
            isLive: true,
            source: 'test'
          };
          console.log('🚨 Triggering test popup for Alarm ID:', testAlarm.id);
          setCriticalAlarmPopup(testAlarm);
          setGlobalLiveAlarms(prev => [testAlarm, ...prev]);
          setSeenAlarmIds(prev => new Set([...prev, testAlarm.id]));
          if (audioRef.current) {
            audioRef.current.play().catch(error => 
              console.error('Failed to play test alarm sound:', error)
            );
          }
          toast.info(`🚨 ${testAlarm.alarmType} - ${testAlarm.message}`, { autoClose: 5000 });
        }} 
        className="fixed z-50 px-4 py-2 text-white bg-blue-600 rounded-lg shadow-lg bottom-4 right-4"
      >
        Trigger Test Popup
      </button>
      
    </div>
  );
};

export default Dashboard;