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
import AdminDashboard from '../admin/AdminDashboard'; // New Admin component

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
  const [tableRefreshTrigger, setTableRefreshTrigger] = useState(0);

  const audioRef = useRef(null);
  const globalPollingRef = useRef(null);
  const eventSourceRef = useRef(null);

  // FIXED: Initialize simple buzzer sound
  useEffect(() => {
    console.log('🔊 Initializing simple buzzer audio...');
    
    const createSimpleBuzzer = () => {
      try {
        const AudioContext = window.AudioContext || window.webkitAudioContext;
        const audioContext = new AudioContext();
        
        audioRef.current = {
          play: () => {
            return new Promise((resolve) => {
              try {
                console.log('🔊 Playing simple buzzer sound');
                
                // Create simple buzzer: 3 quick beeps at 800Hz
                const createBuzzerBeep = (delay) => {
                  setTimeout(() => {
                    const oscillator = audioContext.createOscillator();
                    const gainNode = audioContext.createGain();
                    
                    oscillator.connect(gainNode);
                    gainNode.connect(audioContext.destination);
                    
                    oscillator.frequency.setValueAtTime(800, audioContext.currentTime); // 800Hz buzzer
                    oscillator.type = 'square'; // Square wave for buzzer sound
                    
                    gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
                    gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.2);
                    
                    oscillator.start(audioContext.currentTime);
                    oscillator.stop(audioContext.currentTime + 0.2);
                  }, delay);
                };
                
                // Play 3 quick buzzer beeps
                createBuzzerBeep(0);     // First beep
                createBuzzerBeep(300);   // Second beep
                createBuzzerBeep(600);   // Third beep
                
                resolve();
                
              } catch (error) {
                console.error('Simple buzzer error:', error);
                resolve(); // Don't fail, just resolve
              }
            });
          }
        };
        
        console.log('✅ Simple buzzer sound created');
      } catch (error) {
        console.error('❌ Failed to create simple buzzer:', error);
        // Final fallback - no sound
        audioRef.current = { play: () => Promise.resolve() };
      }
    };

    // Try to load a simple buzzer audio file first, then fallback to Web Audio
    audioRef.current = new Audio();
    audioRef.current.src = '/buzzer.mp3'; // Simple buzzer file
    audioRef.current.preload = 'auto';
    audioRef.current.volume = 0.6;
    audioRef.current.loop = false;
    
    audioRef.current.addEventListener('error', () => {
      console.warn('❌ Failed to load buzzer.mp3, using Web Audio buzzer');
      createSimpleBuzzer();
    });
    
    audioRef.current.addEventListener('canplaythrough', () => {
      console.log('✅ Buzzer audio loaded successfully');
    });
    
    audioRef.current.load();
  }, []);

  // Force alarm table refresh function
  const forceAlarmTableRefresh = useCallback(() => {
    console.log('🔄 Forcing alarm table refresh');
    setTableRefreshTrigger(prev => prev + 1);
    
    // Dispatch custom event for table to listen
    if (window.dispatchEvent) {
      window.dispatchEvent(new CustomEvent('alarmTableRefresh', {
        detail: { 
          timestamp: new Date().toISOString(),
          trigger: 'manual'
        }
      }));
    }
  }, []);

  // Navigation handlers
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
    setActiveTab('overview');
  };

  const handleApiTracking = (vehicle) => {
    setSelectedTrackingVehicle(vehicle);
    setShowApiTracking(true);
  };

  // FIXED: Enhanced sound playing function
  const playAlarmSound = useCallback(async () => {
    if (!audioRef.current) {
      console.warn('⚠️ No audio reference available');
      return;
    }

    try {
      console.log('🔊 Attempting to play alarm sound...');
      
      // Reset audio to beginning
      if (audioRef.current.currentTime !== undefined) {
        audioRef.current.currentTime = 0;
      }
      
      await audioRef.current.play();
      console.log('✅ Alarm sound played successfully');
      
    } catch (error) {
      console.error('❌ Failed to play alarm sound:', error);
      
      // Try alternative notification methods
      try {
        // Vibration API for mobile devices
        if ('vibrate' in navigator) {
          navigator.vibrate([200, 100, 200, 100, 200]);
          console.log('📳 Vibration triggered as audio fallback');
        }
        
        // Visual flash effect
        document.body.style.backgroundColor = '#ff0000';
        setTimeout(() => {
          document.body.style.backgroundColor = '';
        }, 200);
        
      } catch (fallbackError) {
        console.error('❌ Fallback notification methods failed:', fallbackError);
      }
    }
  }, []);

  // FIXED: Enhanced alarm processing with proper metrics handling
  const processNewAlarm = useCallback((alarmData, source = 'unknown') => {
    const alarmId = alarmData.alarmId || alarmData.id || alarmData.alert_id || `alarm_${Date.now()}`;
    
    // Skip if already seen
    if (seenAlarmIds.has(alarmId)) {
      console.log(`⏭️ Skipping duplicate alarm: ${alarmId}`);
      return;
    }

    console.log(`🚨 Processing new alarm from ${source}:`, alarmData);

    // FIXED: Enhanced normalize alarm data with proper metrics
    const normalizedAlarm = {
      id: alarmId,
      device_id: alarmData.deviceId || alarmData.device_id || 'UNKNOWN',
      alarmType: alarmData.alarmType || alarmData.alert_type || alarmData.type || 'Alert',
      severity: (alarmData.severity || 'medium').toLowerCase(),
      status: alarmData.status || 'active',
      message: alarmData.message || alarmData.description || 'New alarm detected',
      timestamp: alarmData.timestamp || alarmData.alarmTime || new Date().toISOString(),
      latitude: alarmData.latitude ? parseFloat(alarmData.latitude) : null,
      longitude: alarmData.longitude ? parseFloat(alarmData.longitude) : null,
      imageUrl: alarmData.imageUrl || alarmData.previewUrl || alarmData.image_url || null,
      speed: alarmData.speed !== undefined ? parseFloat(alarmData.speed) : null,
      acceleration: alarmData.acceleration !== undefined ? parseFloat(alarmData.acceleration) : null,
      
      // FIXED: Proper handling of metrics (same as alarm table)
      drowsiness: (() => {
        if (alarmData.drowsiness !== undefined && alarmData.drowsiness !== null) {
          const drowsinessValue = parseFloat(alarmData.drowsiness);
          return isNaN(drowsinessValue) ? null : drowsinessValue;
        }
        if (alarmData.drowsiness_level !== undefined && alarmData.drowsiness_level !== null) {
          const drowsinessValue = parseFloat(alarmData.drowsiness_level);
          return isNaN(drowsinessValue) ? null : drowsinessValue;
        }
        return null;
      })(),
      
      rashDriving: (() => {
        if (alarmData.rashDriving !== undefined && alarmData.rashDriving !== null) {
          return alarmData.rashDriving === true || alarmData.rashDriving === 'true' || alarmData.rashDriving === 1 || alarmData.rashDriving === '1';
        }
        if (alarmData.rash_driving !== undefined && alarmData.rash_driving !== null) {
          return alarmData.rash_driving === true || alarmData.rash_driving === 'true' || alarmData.rash_driving === 1 || alarmData.rash_driving === '1';
        }
        return null;
      })(),
      
      collision: (() => {
        if (alarmData.collision !== undefined && alarmData.collision !== null) {
          return alarmData.collision === true || alarmData.collision === 'true' || alarmData.collision === 1 || alarmData.collision === '1';
        }
        if (alarmData.collision_detected !== undefined && alarmData.collision_detected !== null) {
          return alarmData.collision_detected === true || alarmData.collision_detected === 'true' || alarmData.collision_detected === 1 || alarmData.collision_detected === '1';
        }
        return null;
      })(),
      
      isLive: true,
      source: source,
      resolved: false
    };

    // Debug logging for processed alarm
    console.log('🔍 Processed alarm metrics:', {
      alarmId: normalizedAlarm.id,
      drowsiness: normalizedAlarm.drowsiness,
      rashDriving: normalizedAlarm.rashDriving,
      collision: normalizedAlarm.collision
    });

    // FIXED: Immediate popup trigger (no delays)
    const allowedSeverities = ['critical', 'high', 'moderate', 'medium', 'low'];
    if (normalizedAlarm.isLive && allowedSeverities.includes(normalizedAlarm.severity)) {
      console.log(`🚨 INSTANT POPUP TRIGGER for ${normalizedAlarm.severity} alarm: ${alarmId}`);
      
      // Set popup IMMEDIATELY
      setCriticalAlarmPopup(normalizedAlarm);

      // FIXED: Play sound immediately (no await to avoid delays)
      playAlarmSound().catch(error => 
        console.error('Sound play error:', error)
      );

      // FIXED: Enhanced browser notification
      if ('Notification' in window) {
        if (Notification.permission === 'granted') {
          new Notification('🚨 LIVE ALARM DETECTED', {
            body: `${normalizedAlarm.severity.toUpperCase()}: ${normalizedAlarm.alarmType} - ${normalizedAlarm.message}`,
            icon: '/favicon.ico',
            requireInteraction: normalizedAlarm.severity === 'critical',
            tag: `alarm-${alarmId}`, // Prevent duplicate notifications
            vibrate: [200, 100, 200], // Vibration pattern
          });
        } else if (Notification.permission === 'default') {
          // Request permission and show notification
          Notification.requestPermission().then(permission => {
            if (permission === 'granted') {
              new Notification('🚨 LIVE ALARM DETECTED', {
                body: `${normalizedAlarm.severity.toUpperCase()}: ${normalizedAlarm.alarmType}`,
                icon: '/favicon.ico',
              });
            }
          });
        }
      }
    }

    // Add to seen list (after popup to avoid race conditions)
    setSeenAlarmIds(prev => new Set([...prev, alarmId]));

    // Update global live alarms
    setGlobalLiveAlarms(prev => {
      const filtered = prev.filter(a => a.id !== alarmId);
      const updated = [normalizedAlarm, ...filtered];
      console.log(`📢 Updated global live alarms: ${updated.length} total`);
      return updated;
    });

    // Force table refresh (minimal delay)
    setTimeout(() => {
      forceAlarmTableRefresh();
    }, 50); // Reduced from 100ms to 50ms

  }, [seenAlarmIds, forceAlarmTableRefresh, playAlarmSound]);

  // FIXED: Enhanced SSE stream with faster processing
  useEffect(() => {
    if (!isLoggedIn) return;

    let isActive = true;
    let reconnectTimeout = null;
    let reconnectAttempts = 0;
    const maxReconnectAttempts = 5;

    const startSSEConnection = async () => {
      try {
        console.log('🚀 Starting unified SSE stream...');
        
        const token = apiService.getToken();
        if (!token) {
          console.error('❌ No auth token available');
          return;
        }

        // Clean up existing connection
        if (eventSourceRef.current) {
          eventSourceRef.current.close();
        }

        setGlobalStreamActive(true);

        // Use your existing API service endpoint
        const sseUrl = `${apiService.baseUrl}/alarm/v1/stream/1`;
        
        const response = await fetch(sseUrl, {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Accept': 'text/event-stream',
            'Cache-Control': 'no-cache'
          }
        });

        if (!response.ok) {
          throw new Error(`SSE connection failed: ${response.status} ${response.statusText}`);
        }

        console.log('✅ SSE stream connected successfully');
        reconnectAttempts = 0;

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';

        // Store connection reference for cleanup
        eventSourceRef.current = {
          close: () => {
            isActive = false;
            reader.cancel();
            setGlobalStreamActive(false);
          }
        };

        // FIXED: Optimized stream processing for faster response
        while (isActive) {
          try {
            const { done, value } = await reader.read();
            
            if (done) {
              console.log('📡 SSE stream ended');
              break;
            }

            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split('\n');
            buffer = lines.pop() || '';

            // Process each line immediately (no batching)
            for (const line of lines) {
              if (line.trim() === '') continue;
              
              if (line.startsWith('data: ')) {
                try {
                  const jsonData = line.slice(6).trim();
                  if (jsonData === '') continue;
                  
                  const alarmData = JSON.parse(jsonData);
                  console.log('📊 Parsed alarm data:', alarmData);
                  
                  // FIXED: Process alarm immediately (no setTimeout)
                  processNewAlarm(alarmData, 'sse_stream');
                  
                } catch (parseError) {
                  console.error('❌ Failed to parse SSE data:', parseError, 'Raw line:', line);
                }
              }
            }
          } catch (readError) {
            if (isActive) {
              console.error('❌ SSE read error:', readError);
              break;
            }
          }
        }

      } catch (error) {
        console.error('❌ SSE connection error:', error);
      } finally {
        setGlobalStreamActive(false);
        
        // Auto-reconnect logic
        if (isActive && isLoggedIn && reconnectAttempts < maxReconnectAttempts) {
          reconnectAttempts++;
          const delay = Math.min(1000 * Math.pow(2, reconnectAttempts - 1), 30000);
          
          console.log(`🔄 Reconnecting SSE in ${delay}ms (attempt ${reconnectAttempts}/${maxReconnectAttempts})`);
          
          reconnectTimeout = setTimeout(() => {
            if (isActive && isLoggedIn) {
              startSSEConnection();
            }
          }, delay);
        }
      }
    };

    // Start the connection
    startSSEConnection();

    // Cleanup function
    return () => {
      isActive = false;
      if (reconnectTimeout) {
        clearTimeout(reconnectTimeout);
      }
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
      }
    };
  }, [isLoggedIn, processNewAlarm]);

  // BACKUP: Polling mechanism for when SSE fails
  useEffect(() => {
    if (!isLoggedIn || globalStreamActive) return;

    console.log('🔄 Starting backup polling (SSE not active)...');
    
    const pollForAlarms = async () => {
      try {
        const response = await apiService.getManagerAlarms(0, 10);
        
        if (response.success && response.data) {
          response.data.forEach(alarm => {
            processNewAlarm(alarm, 'backup_polling');
          });
        }
      } catch (error) {
        console.error('❌ Backup polling error:', error);
      }
    };

    // Poll every 10 seconds when SSE is not working (reduced from 15s)
    const pollInterval = setInterval(pollForAlarms, 10000);
    pollForAlarms(); // Initial poll

    return () => {
      clearInterval(pollInterval);
    };
  }, [isLoggedIn, globalStreamActive, processNewAlarm]);

  // FIXED: Enhanced alarm resolve function using the new API
  const handleAlarmResolve = async (alarmId) => {
    try {
      console.log(`🔧 Resolving alarm: ${alarmId}`);
      
      // Call the new resolve API endpoint
      const response = await fetch(`http://164.52.194.198:9090/alarm/v1/resolve`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiService.getToken()}`
        },
        body: JSON.stringify({
          alarmID: alarmId,
          isResolved: true
        })
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const result = await response.json();
      console.log('✅ Alarm resolve API response:', result);

      if (result.success || response.status === 200) {
        // Update global live alarms state
        setGlobalLiveAlarms(prev =>
          prev.map(alarm =>
            alarm.id === alarmId
              ? { ...alarm, resolved: true, resolvedAt: new Date().toISOString(), status: 'resolved' }
              : alarm
          )
        );

        // Update persistent alarms state
        setPersistentAlarms(prev =>
          prev.map(alarm =>
            alarm.id === alarmId
              ? { ...alarm, resolved: true, resolvedAt: new Date().toISOString(), status: 'resolved' }
              : alarm
          )
        );

        // Close popup if it's for this alarm
        setCriticalAlarmPopup(prev => (prev && prev.id === alarmId ? null : prev));

        toast.success('✅ Alarm resolved successfully');
        forceAlarmTableRefresh();
      } else {
        throw new Error(result.message || 'Failed to resolve alarm');
      }
    } catch (error) {
      console.error('❌ Failed to resolve alarm:', error);
      toast.error(`❌ Failed to resolve alarm: ${error.message}`);
    }
  };

  // FIXED: Enhanced alarm acknowledge function (keeping existing logic)
  const handleAlarmAcknowledge = async (alarmId) => {
    try {
      console.log(`📋 Acknowledging alarm: ${alarmId}`);
      
      // Use existing acknowledge API or create similar pattern
      const response = await fetch(`http://164.52.194.198:9090/alarm/v1/acknowledge`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiService.getToken()}`
        },
        body: JSON.stringify({
          alarmID: alarmId,
          isAcknowledged: true
        })
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const result = await response.json();
      console.log('✅ Alarm acknowledge API response:', result);

      if (result.success || response.status === 200) {
        setGlobalLiveAlarms(prev =>
          prev.map(alarm =>
            alarm.id === alarmId
              ? { ...alarm, acknowledged: true, acknowledgedAt: new Date().toISOString() }
              : alarm
          )
        );

        setPersistentAlarms(prev =>
          prev.map(alarm =>
            alarm.id === alarmId
              ? { ...alarm, acknowledged: true, acknowledgedAt: new Date().toISOString() }
              : alarm
          )
        );

        toast.success('✅ Alarm acknowledged successfully');
        forceAlarmTableRefresh();
      } else {
        throw new Error(result.message || 'Failed to acknowledge alarm');
      }
    } catch (error) {
      console.error('❌ Failed to acknowledge alarm:', error);
      toast.error(`❌ Failed to acknowledge alarm: ${error.message}`);
    }
  };

  // Request notification permission on component mount
  useEffect(() => {
    if ('Notification' in window && Notification.permission === 'default') {
      console.log('🔔 Requesting notification permission...');
      Notification.requestPermission().then(permission => {
        console.log('🔔 Notification permission:', permission);
      });
    }
  }, []);

  // Render content based on active tab
  const renderContent = () => {
    switch (activeTab) {
      case 'overview':
        return <Overview onViewVehicle={handleViewVehicle} />;
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
            tableRefreshTrigger={tableRefreshTrigger}
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
      
      {/* FIXED: Instant Global Critical Alarm Popup */}
      {criticalAlarmPopup && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 animate-fadeIn">
          <div className={`w-full max-w-lg p-6 mx-4 bg-white rounded-lg shadow-2xl animate-pulse
            ${criticalAlarmPopup.severity ? {
              'critical': 'border-4 border-red-500 bg-red-50',
              'high': 'border-4 border-orange-500 bg-orange-50',
              'moderate': 'border-4 border-yellow-500 bg-yellow-50',
              'medium': 'border-4 border-yellow-500 bg-yellow-50',
              'low': 'border-4 border-green-500 bg-green-50'
            }[criticalAlarmPopup.severity.toLowerCase()] || 'border-4 border-gray-500' : 'border-4 border-gray-500'}`}>
            
            <div className="flex items-center gap-3 mb-4">
              <AlertTriangle className={`w-10 h-10 animate-bounce
                ${criticalAlarmPopup.severity ? {
                  'critical': 'text-red-600',
                  'high': 'text-orange-600',
                  'moderate': 'text-yellow-600',
                  'medium': 'text-yellow-600',
                  'low': 'text-green-600'
                }[criticalAlarmPopup.severity.toLowerCase()] || 'text-gray-600' : 'text-gray-600'}`} />
              
              <h2 className="text-2xl font-bold text-red-800 animate-pulse">
                🚨 {criticalAlarmPopup.severity?.toUpperCase() || 'LIVE'} ALARM DETECTED
              </h2>
              
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
                  'medium': 'border-yellow-200 bg-yellow-50',
                  'low': 'border-green-200 bg-green-50'
                }[criticalAlarmPopup.severity.toLowerCase()] || 'border-gray-200 bg-gray-50' : 'border-gray-200 bg-gray-50'}`}>
                
                <div className="flex items-center gap-2 mb-2">
                  <div className={`w-3 h-3 rounded-full animate-pulse
                    ${criticalAlarmPopup.severity ? {
                      'critical': 'bg-red-500',
                      'high': 'bg-orange-500',
                      'moderate': 'bg-yellow-500',
                      'medium': 'bg-yellow-500',
                      'low': 'bg-green-500'
                    }[criticalAlarmPopup.severity.toLowerCase()] || 'bg-gray-500' : 'bg-gray-500'}`} />
                  <p className="font-bold text-red-800">IMMEDIATE ATTENTION REQUIRED</p>
                </div>
                
                <p className="font-semibold text-gray-900">Device: {criticalAlarmPopup.device_id}</p>
                <p className="text-gray-700">Type: {criticalAlarmPopup.alarmType}</p>
                <p className="text-gray-700">Message: {criticalAlarmPopup.message}</p>
                <p className="text-sm text-gray-500">Time: {new Date(criticalAlarmPopup.timestamp).toLocaleString()}</p>
                <p className="text-xs font-bold text-red-600">SEVERITY: {criticalAlarmPopup.severity.toUpperCase()}</p>
              </div>
              
              {criticalAlarmPopup.imageUrl && (
                <img 
                  src={criticalAlarmPopup.imageUrl} 
                  alt="Critical Alarm" 
                  className="object-cover w-full h-32 border rounded" 
                  onError={(e) => e.target.style.display = 'none'} 
                />
              )}
              
              {(criticalAlarmPopup.latitude && criticalAlarmPopup.longitude) && (
                <div className="flex items-center gap-2 p-3 border border-blue-200 rounded bg-blue-50">
                  <MapPin className="w-5 h-5 text-blue-600" />
                  <span className="text-sm font-semibold text-blue-800">
                    📍 Location: {criticalAlarmPopup.latitude.toFixed(4)}, {criticalAlarmPopup.longitude.toFixed(4)}
                  </span>
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
                View Details
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
                Go to Alarms
              </button>
              
              <button 
                onClick={() => {
                  console.log(`Dismissing popup for Alarm ID: ${criticalAlarmPopup.id}`);
                  setCriticalAlarmPopup(null);
                }} 
                className="flex-1 px-4 py-3 text-white bg-gray-600 rounded-lg hover:bg-gray-700"
              >
                Dismiss
              </button>
            </div>
          </div>
        </div>
      )}

      <Header />
      
      {/* View Modal */}
      {showViewModal && selectedAlarmForView && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 animate-fadeIn">
          <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-gray-900">Alarm Details</h3>
                <button
                  onClick={() => setShowViewModal(false)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>
              
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-gray-900">{selectedAlarmForView.id}</p>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-500">Device ID</label>
                    <p className="text-gray-900">{selectedAlarmForView.device_id}</p>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-500">Type</label>
                    <p className="text-gray-900">{selectedAlarmForView.alarmType}</p>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-500">Severity</label>
                    <span className={`px-2 py-1 text-xs rounded-full ${
                      selectedAlarmForView.severity === 'critical' ? 'bg-red-100 text-red-800' :
                      selectedAlarmForView.severity === 'high' ? 'bg-orange-100 text-orange-800' :
                      selectedAlarmForView.severity === 'medium' ? 'bg-yellow-100 text-yellow-800' :
                      'bg-blue-100 text-blue-800'
                    }`}>
                      {selectedAlarmForView.severity}
                    </span>
                  </div>
                </div>
                
                <div>
                  <label className="text-sm font-medium text-gray-500">Message</label>
                  <p className="text-gray-900">{selectedAlarmForView.message}</p>
                </div>
                
                <div>
                  <label className="text-sm font-medium text-gray-500">Timestamp</label>
                  <p className="text-gray-900">{new Date(selectedAlarmForView.timestamp).toLocaleString()}</p>
                </div>
                
                {selectedAlarmForView.imageUrl && (
                  <div>
                    <label className="text-sm font-medium text-gray-500">Image</label>
                    <img 
                      src={selectedAlarmForView.imageUrl} 
                      alt="Alarm" 
                      className="object-cover w-full h-48 border rounded"
                      onError={(e) => e.target.style.display = 'none'}
                    />
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      <main className="pt-1">
        <Navigation activeTab={activeTab} setActiveTab={setActiveTab} />
        <div className="p-6">
          {renderContent()}
        </div>
      </main>
      
      {showApiTracking && (
        <ApiOnlyEnhancedVehicleTrackingModal
          isOpen={showApiTracking}
          onClose={() => setShowApiTracking(false)}
          vehicle={selectedTrackingVehicle}
        />
      )}
      
      {/* ENHANCED Test Buttons with Sound Testing */}
      <div className="fixed z-50 bottom-4 right-4">
        <div className="space-y-2">
          {/* Simple Sound Test Button */}
        {/*  <button 
            onClick={() => {
              console.log('🔊 Testing simple buzzer sound...');
              playAlarmSound().then(() => {
                toast.success('🔊 Buzzer sound test completed!');
              }).catch(error => {
                toast.error('❌ Buzzer sound test failed: ' + error.message);
              });
            }}
            className="block w-full px-3 py-2 mb-1 text-sm text-white bg-purple-600 rounded-lg shadow-lg hover:bg-purple-700"
          >
            🔊 Test Buzzer
          </button>*/}

          {/* API Test Button */}
         {/* <button 
            onClick={async () => {
              console.log('🔧 Testing Resolve API...');
              const testAlarmId = 'test_resolve_' + Date.now();
              try {
                await handleAlarmResolve(testAlarmId);
                toast.success('✅ Resolve API test completed!');
              } catch (error) {
                toast.error('❌ Resolve API test failed: ' + error.message);
              }
            }}
            className="block w-full px-3 py-2 mb-1 text-sm text-white bg-indigo-600 rounded-lg shadow-lg hover:bg-indigo-700"
          >
            🔧 Test Resolve API
          </button>
          
          {['low', 'medium', 'high', 'critical'].map(severity => (
            <button 
              key={severity}
              onClick={() => {
                const testAlarm = {
                  id: `test_${severity}_${Date.now()}`,
                  device_id: 'TEST_DEVICE',
                  alarmType: `Test ${severity.charAt(0).toUpperCase() + severity.slice(1)} Alert`,
                  severity: severity,
                  status: 'active',
                  message: `This is a test ${severity} severity alarm with sound!`,
                  timestamp: new Date().toISOString(),
                  isLive: true,
                  source: 'test',
                  resolved: false
                };
                
                console.log(`🚨 Triggering INSTANT test ${severity} popup:`, testAlarm);
                processNewAlarm(testAlarm, 'test_button');
                
                toast.info(`🚨 Test ${severity} alarm triggered with sound!`, { autoClose: 3000 });
              }} 
              className={`block w-full px-3 py-2 text-white text-sm rounded-lg shadow-lg mb-1 ${
                severity === 'critical' ? 'bg-red-600 hover:bg-red-700' :
                severity === 'high' ? 'bg-orange-600 hover:bg-orange-700' :
                severity === 'medium' ? 'bg-yellow-600 hover:bg-yellow-700' :
                'bg-green-600 hover:bg-green-700'
              }`}
            >
              Test {severity.charAt(0).toUpperCase() + severity.slice(1)}
            </button>
          ))} */}
        </div>
      </div>
      
    </div>
  );
};

export default Dashboard;