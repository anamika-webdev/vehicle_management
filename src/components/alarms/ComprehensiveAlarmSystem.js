import React, { useState, useEffect, useRef } from 'react';
import { AlertTriangle, Volume2, VolumeX, RefreshCw } from 'lucide-react';
import { toast } from 'react-toastify';
import EventBasedAlarmTable from './EventBasedAlarmTable';
import enhancedAlarmService from '../../services/enhancedApiService';

const ComprehensiveAlarmSystem = ({
  globalLiveAlarms = [],
  globalStreamActive = false,
  persistentAlarms = [],
  onAlarmAcknowledge,
  onAlarmResolve,
  onStartGlobalPolling,
  onStopGlobalPolling
}) => {
  // CORE ALARM STATE
  const [alarms, setAlarms] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [autoRefresh, setAutoRefresh] = useState(true);

  // STATISTICS STATE
  const [statistics, setStatistics] = useState({
    total: 0,
    withLocation: 0,
    drowsiness: 0,
    rashDriving: 0,
    collision: 0,
    recent: 0,
    acknowledged: 0,
    resolved: 0
  });

  // REFS
  const audioRef = useRef(null);
  const refreshIntervalRef = useRef(null);

  // UTILITY FUNCTIONS
  const isRecentAlarm = (timestamp) => {
    const alarmTime = new Date(timestamp);
    const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000);
    return alarmTime >= tenMinutesAgo;
  };

  const updateStatistics = (alarmList) => {
    const stats = {
      total: alarmList.length,
      withLocation: alarmList.filter(alarm => 
        alarm.latitude && alarm.longitude && 
        alarm.latitude !== 0 && alarm.longitude !== 0
      ).length,
      drowsiness: alarmList.filter(alarm => 
        alarm.drowsiness || (alarm.alarmType || '').toLowerCase().includes('drowsiness')
      ).length,
      rashDriving: alarmList.filter(alarm => 
        alarm.rashDriving || (alarm.alarmType || '').toLowerCase().includes('rash')
      ).length,
      collision: alarmList.filter(alarm => 
        alarm.collision || (alarm.alarmType || '').toLowerCase().includes('collision')
      ).length,
      recent: alarmList.filter(alarm => alarm.isLive).length,
      acknowledged: alarmList.filter(alarm => alarm.status === 'acknowledged').length,
      resolved: alarmList.filter(alarm => alarm.status === 'resolved').length
    };
    setStatistics(stats);
  };

  const startAutoRefresh = () => {
    if (refreshIntervalRef.current) {
      clearInterval(refreshIntervalRef.current);
    }
    
    refreshIntervalRef.current = setInterval(() => {
      fetchAlarms();
    }, 30000);
  };

  const cleanup = () => {
    if (refreshIntervalRef.current) {
      clearInterval(refreshIntervalRef.current);
      refreshIntervalRef.current = null;
    }
    if (onStopGlobalPolling) {
      onStopGlobalPolling();
    }
  };

  const fetchAlarms = async () => {
    try {
      const response = await enhancedAlarmService.getAllManagerAlarms();
      if (response.success && response.data) {
        const allAlarms = [
          ...persistentAlarms,
          ...globalLiveAlarms,
          ...response.data.filter(alarm => 
            !persistentAlarms.some(persistent => persistent.alarmId === alarm.alarmId) &&
            !globalLiveAlarms.some(live => live.id === alarm.alarmId)
          )
        ];

        const alarmsWithStatus = allAlarms.map(alarm => ({
          ...alarm,
          alarmId: alarm.alarmId || alarm.id || `alarm_${Date.now()}_${Math.random()}`,
          alarmTime: alarm.alarmTime || alarm.timestamp,
          status: alarm.status || (isRecentAlarm(alarm.alarmTime || alarm.timestamp) ? 'active' : 'historical'),
          isLive: alarm.isLive || isRecentAlarm(alarm.alarmTime || alarm.timestamp)
        }));
        
        setAlarms(alarmsWithStatus);
        updateStatistics(alarmsWithStatus);
      } else {
        throw new Error('Failed to fetch alarms');
      }
    } catch (err) {
      setError('Failed to fetch alarms');
      console.error('Fetch error:', err);
      toast.error('Failed to fetch alarms');
    }
  };

  const initializeAlarmSystem = async () => {
    try {
      setLoading(true);
      await fetchAlarms();
      if (autoRefresh) {
        startAutoRefresh();
      }
      if (onStartGlobalPolling) {
        onStartGlobalPolling();
      }
    } catch (err) {
      setError('Failed to initialize alarm system');
      console.error('Initialization error:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    initializeAlarmSystem();
    
    audioRef.current = new Audio('/alarm-sound.mp3');
    audioRef.current.preload = 'auto';
    
    return () => {
      cleanup();
    };
  }, []);

  useEffect(() => {
    updateStatistics(alarms);
  }, [alarms, globalLiveAlarms, persistentAlarms]);

  const handleAcknowledgeAlarm = (alarmId) => {
    setAlarms(prev => prev.map(alarm => 
      (alarm.alarmId === alarmId || alarm.id === alarmId) 
        ? { ...alarm, status: 'acknowledged' }
        : alarm
    ));
    if (onAlarmAcknowledge) {
      onAlarmAcknowledge(alarmId);
    }
    toast.success('Alarm acknowledged');
  };

  const handleResolveAlarm = async (alarmId) => {
    try {
      const response = await enhancedAlarmService.resolveAlarm(alarmId);
      if (response.success) {
        setAlarms(prev => prev.map(alarm => 
          (alarm.alarmId === alarmId || alarm.id === alarmId) 
            ? { ...alarm, status: 'resolved' }
            : alarm
        ));
        if (onAlarmResolve) {
          onAlarmResolve(alarmId);
        }
        toast.success('Alarm resolved successfully');
      } else {
        throw new Error('Failed to resolve alarm');
      }
    } catch (err) {
      console.error('Failed to resolve alarm:', err);
      toast.error('Failed to resolve alarm');
    }
  };

  const renderHeaderWithStatistics = () => (
    <div className="bg-white border-b border-gray-200 shadow-sm">
      <div className="px-6 py-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">🚨 Alarm Management</h1>
            <p className="mt-1 text-gray-600">Real-time monitoring and management of vehicle alarms</p>
          </div>
          
          <div className="flex items-center space-x-4">
            <button
              onClick={() => setSoundEnabled(!soundEnabled)}
              className={`p-2 rounded-lg border ${
                soundEnabled 
                  ? 'bg-blue-50 text-blue-600 border-blue-200' 
                  : 'bg-gray-50 text-gray-400 border-gray-200'
              }`}
              title={soundEnabled ? 'Disable sound notifications' : 'Enable sound notifications'}
            >
              {soundEnabled ? <Volume2 className="w-5 h-5" /> : <VolumeX className="w-5 h-5" />}
            </button>

            <button
              onClick={() => {
                setAutoRefresh(!autoRefresh);
                if (!autoRefresh) {
                  startAutoRefresh();
                } else if (refreshIntervalRef.current) {
                  clearInterval(refreshIntervalRef.current);
                }
              }}
              className={`flex items-center px-3 py-2 rounded-lg border text-sm font-medium ${
                autoRefresh 
                  ? 'bg-green-50 text-green-600 border-green-200' 
                  : 'bg-gray-50 text-gray-400 border-gray-200'
              }`}
            >
              <RefreshCw className={`w-4 h-4 mr-2 ${autoRefresh ? 'animate-spin' : ''}`} />
              Auto Refresh
            </button>

            <button
              onClick={() => {
                fetchAlarms();
                toast.info('Refreshing alarms...');
              }}
              className="p-2 text-gray-600 border border-gray-200 rounded-lg hover:text-gray-900 hover:bg-gray-100"
              title="Manual refresh"
            >
              <RefreshCw className="w-5 h-5" />
            </button>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4 mt-6 md:grid-cols-4 lg:grid-cols-8">
          <div className="p-3 border border-blue-200 rounded-lg bg-blue-50">
            <div className="text-2xl font-bold text-blue-600">{statistics.total}</div>
            <div className="text-sm font-medium text-blue-800">Total Alarms</div>
          </div>
          <div className="p-3 border border-red-200 rounded-lg bg-red-50">
            <div className="text-2xl font-bold text-red-600">{statistics.recent}</div>
            <div className="text-sm font-medium text-red-800">Live Alarms</div>
          </div>
          <div className="p-3 border border-yellow-200 rounded-lg bg-yellow-50">
            <div className="text-2xl font-bold text-yellow-600">{statistics.acknowledged}</div>
            <div className="text-sm font-medium text-yellow-800">Acknowledged</div>
          </div>
          <div className="p-3 border border-green-200 rounded-lg bg-green-50">
            <div className="text-2xl font-bold text-green-600">{statistics.resolved}</div>
            <div className="text-sm font-medium text-green-800">Resolved</div>
          </div>
          <div className="p-3 border border-purple-200 rounded-lg bg-purple-50">
            <div className="text-2xl font-bold text-purple-600">{statistics.drowsiness}</div>
            <div className="text-sm font-medium text-purple-800">Drowsiness</div>
          </div>
          <div className="p-3 border border-orange-200 rounded-lg bg-orange-50">
            <div className="text-2xl font-bold text-orange-600">{statistics.rashDriving}</div>
            <div className="text-sm font-medium text-orange-800">Rash Driving</div>
          </div>
          <div className="p-3 border border-red-200 rounded-lg bg-red-50">
            <div className="text-2xl font-bold text-red-600">{statistics.collision}</div>
            <div className="text-sm font-medium text-red-800">Collisions</div>
          </div>
          <div className="p-3 border border-indigo-200 rounded-lg bg-indigo-50">
            <div className="text-2xl font-bold text-indigo-600">{statistics.withLocation}</div>
            <div className="text-sm font-medium text-indigo-800">With GPS</div>
          </div>
        </div>
      </div>
    </div>
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50">
        <div className="text-center">
          <RefreshCw className="w-12 h-12 mx-auto mb-4 text-blue-600 animate-spin" />
          <h3 className="mb-2 text-lg font-medium text-gray-900">Loading Alarms</h3>
          <p className="text-gray-600">Fetching latest alarm data...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50">
        <div className="text-center">
          <AlertTriangle className="w-12 h-12 mx-auto mb-4 text-red-600" />
          <h3 className="mb-2 text-lg font-medium text-gray-900">Error Loading Alarms</h3>
          <p className="mb-4 text-gray-600">{error}</p>
          <button
            onClick={() => {
              setError(null);
              fetchAlarms();
            }}
            className="px-4 py-2 text-white bg-blue-600 rounded-lg hover:bg-blue-700"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {renderHeaderWithStatistics()}
      <div className="flex-1 p-6">
        <EventBasedAlarmTable
          globalLiveAlarms={alarms}
          globalStreamActive={globalStreamActive}
          onStartGlobalStream={onStartGlobalPolling}
          onStopGlobalStream={onStopGlobalPolling}
          onAcknowledgeAlarm={handleAcknowledgeAlarm}
          onResolveAlarm={handleResolveAlarm}
        />
      </div>
    </div>
  );
};

export default ComprehensiveAlarmSystem;