// src/services/enhancedApiService.js - Updated to integrate with your existing API service

import apiService from './api'; // Import your existing API service

class EnhancedAlarmService {
  constructor() {
    this.baseURL = 'http://164.52.194.198:9090';
    this.eventSource = null;
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = 5;
    this.reconnectDelay = 5000;
  }

  // ============================================
  // ALARM FETCHING METHODS - ENHANCED
  // ============================================

  /**
   * Fetch all manager alarms from /alarm/v1/manager/all
   */
  async getAllManagerAlarms(page = 0, size = 100) {
    try {
      console.log('🚨 Fetching all manager alarms...');
      const endpoint = `/alarm/v1/manager/all?page=${page}&size=${size}`;
      
      // Use your existing API service request method
      const response = await apiService.request(endpoint);
      
      if (response?.data) {
        const alarms = Array.isArray(response.data) ? response.data : 
                      (response.data.data && Array.isArray(response.data.data)) ? response.data.data : [];
        
        const transformedAlarms = alarms.map(alarm => ({
          id: alarm.alarmId || alarm.id || `manager_${Date.now()}`,
          device_id: alarm.deviceId || alarm.device_id,
          vehicleId: alarm.vehicleId || alarm.vehicle_id,
          alarmType: alarm.alarmType || alarm.type || alarm.alert_type || 'Manager Alert',
          severity: this.normalizeSeverity(alarm.severity),
          status: alarm.status || 'active',
          message: alarm.message || alarm.description || 'Manager alarm detected',
          timestamp: alarm.timestamp || alarm.createdAt || new Date().toISOString(),
          resolved: Boolean(alarm.resolved),
          latitude: alarm.latitude ? parseFloat(alarm.latitude) : null,
          longitude: alarm.longitude ? parseFloat(alarm.longitude) : null,
          imageUrl: alarm.imageUrl || alarm.image_url || alarm.attachmentUrl,
          speed: alarm.speed !== undefined && alarm.speed !== null ? parseFloat(alarm.speed) : null, // Add speed
          acceleration: alarm.acceleration !== undefined && alarm.acceleration !== null ? parseFloat(alarm.acceleration) : null, // Add acceleration
          drowsiness: alarm.drowsiness !== undefined ? alarm.drowsiness : null,
          rashDriving: alarm.rashDriving !== undefined ? alarm.rashDriving : null,
          collision: alarm.collision !== undefined ? alarm.collision : null,

          // Additional metadata
          alertCode: alarm.alertCode || alarm.alert_code,
          priority: alarm.priority,
          acknowledgedBy: alarm.acknowledgedBy,
          acknowledgedAt: alarm.acknowledgedAt,
          resolvedBy: alarm.resolvedBy,
          resolvedAt: alarm.resolvedAt,
          metadata: alarm.metadata || {},
          source: 'manager'
        }));
        
        console.log(`✅ Found ${transformedAlarms.length} manager alarms`);
        return {
          success: true,
          data: transformedAlarms,
          total: transformedAlarms.length
        };
      }
      
      return { success: true, data: [], total: 0 };
    } catch (error) {
      console.error('❌ Failed to fetch manager alarms:', error);
      return {
        success: false,
        data: [],
        error: error.message,
        total: 0
      };
    }
  }
 /* resolve api*/

 async resolveAlarm(alarmId) {
    try {
      const payload = { alarmId, isResolved: true };
      const response = await apiService.request('/alarm/v1/resolve', {
        method: 'POST',
        body: JSON.stringify(payload)
      });
      return { success: true, data: response };
    } catch (error) {
      console.error('❌ Resolve API failed:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Fetch device-specific alarms from /alarm/v1/device/{deviceId}
   */
  async getDeviceAlarms(deviceId, page = 0, size = 20, sortBy = 'deviceId', direction = 'asc') {
    try {
      console.log(`🔍 Fetching alarms for device ${deviceId}...`);
      const endpoint = `/alarm/v1/device/${deviceId}?page=${page}&size=${size}&sortBy=${sortBy}&direction=${direction}`;
      
      // Use your existing API service request method
      const response = await apiService.request(endpoint);
      
      if (response?.data) {
        const alarms = Array.isArray(response.data) ? response.data : 
                      (response.data.data && Array.isArray(response.data.data)) ? response.data.data : [];
        
        const transformedAlarms = alarms.map(alarm => ({
          id: alarm.alarmId || alarm.id || `device_${deviceId}_${Date.now()}`,
          device_id: deviceId,
          vehicleId: alarm.vehicleId || alarm.vehicle_id,
          alarmType: alarm.alarmType || alarm.type || alarm.alert_type || 'Device Alert',
          severity: this.normalizeSeverity(alarm.severity),
          status: alarm.status || 'active',
          message: alarm.message || alarm.description || 'Device alarm detected',
          timestamp: alarm.timestamp || alarm.createdAt || new Date().toISOString(),
          resolved: Boolean(alarm.resolved),
          latitude: alarm.latitude ? parseFloat(alarm.latitude) : null,
          longitude: alarm.longitude ? parseFloat(alarm.longitude) : null,
          imageUrl: alarm.imageUrl || alarm.image_url || alarm.attachmentUrl,
          speed: alarm.speed !== undefined && alarm.speed !== null ? parseFloat(alarm.speed) : null, // Add speed
          acceleration: alarm.acceleration !== undefined && alarm.acceleration !== null ? parseFloat(alarm.acceleration) : null, // Add acceleration
          drowsiness: alarm.drowsiness !== undefined ? alarm.drowsiness : null,
          rashDriving: alarm.rashDriving !== undefined ? alarm.rashDriving : null,
          collision: alarm.collision !== undefined ? alarm.collision : null,

          // Additional metadata
          alertCode: alarm.alertCode || alarm.alert_code,
          priority: alarm.priority,
          acknowledgedBy: alarm.acknowledgedBy,
          acknowledgedAt: alarm.acknowledgedAt,
          resolvedBy: alarm.resolvedBy,
          resolvedAt: alarm.resolvedAt,
          metadata: alarm.metadata || {},
          source: 'device'
        }));
        
        console.log(`✅ Found ${transformedAlarms.length} alarms for device ${deviceId}`);
        return {
          success: true,
          data: transformedAlarms,
          total: transformedAlarms.length
        };
      }
      
      return { success: true, data: [], total: 0 };
    } catch (error) {
      console.error(`❌ Failed to fetch alarms for device ${deviceId}:`, error);
      return {
        success: false,
        data: [],
        error: error.message,
        total: 0
      };
    }
  }

  /**
   * Fetch all historical alarms from all sources
   */
  async getAllHistoricalAlarms() {
    try {
      console.log('📚 Fetching all historical alarms...');
      
      // Fetch manager alarms and devices concurrently
      const [managerAlarmsResult, devicesResult] = await Promise.allSettled([
        this.getAllManagerAlarms(0, 100),
        apiService.getAllDevices()
      ]);

      let managerAlarms = [];
      if (managerAlarmsResult.status === 'fulfilled' && managerAlarmsResult.value.success) {
        managerAlarms = managerAlarmsResult.value.data;
      }

      let devices = [];
      if (devicesResult.status === 'fulfilled' && devicesResult.value.success) {
        devices = devicesResult.value.data;
      }

      console.log(`📱 Found ${devices.length} devices, fetching device alarms...`);
      
      // Fetch alarms for all devices
      const deviceAlarmPromises = devices.map(device => {
        const deviceId = device.deviceId || device.device_id || device.id;
        return this.getDeviceAlarms(deviceId, 0, 50);
      });

      const deviceAlarmResults = await Promise.allSettled(deviceAlarmPromises);
      
      // Collect all device alarms
      const allDeviceAlarms = deviceAlarmResults
        .filter(result => result.status === 'fulfilled' && result.value.success)
        .flatMap(result => result.value.data);

      // Combine all alarms
      const allAlarms = [...managerAlarms, ...allDeviceAlarms];
      
      // Remove duplicates by ID
      const uniqueAlarms = allAlarms.filter((alarm, index, self) => 
        index === self.findIndex(a => a.id === alarm.id)
      );

      // Sort by timestamp (newest first)
      const sortedAlarms = uniqueAlarms.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

      console.log(`✅ Total historical alarms: ${sortedAlarms.length}`);
      return sortedAlarms;
      
    } catch (error) {
      console.error('❌ Failed to fetch historical alarms:', error);
      return [];
    }
  }

  // ============================================
  // LIVE STREAM MANAGEMENT - ENHANCED
  // ============================================

  /**
   * Start live alarm stream from /alarm/v1/stream
   */
  startLiveStream(onAlarmReceived, onConnectionChange = null) {
    try {
      // Close existing connection if any
      this.stopLiveStream();

      console.log('🔴 Starting live alarm stream...');
      this.eventSource = new EventSource(`${this.baseURL}/alarm/v1/stream`);
      
      this.eventSource.onopen = () => {
        console.log('✅ Live alarm stream connected');
        this.reconnectAttempts = 0;
        onConnectionChange && onConnectionChange({ connected: true, attempts: 0 });
      };

      this.eventSource.onmessage = (event) => {
        try {
          const alarmData = JSON.parse(event.data);
          console.log('🚨 New live alarm received:', alarmData);
          
          // Transform the alarm data to match our format
          const transformedAlarm = {
            id: alarmData.alarmId || alarmData.id || `live_${Date.now()}`,
            device_id: alarmData.deviceId || alarmData.device_id,
            vehicleId: alarmData.vehicleId || alarmData.vehicle_id,
            alarmType: alarmData.alarmType || alarmData.type || 'Live Alert',
            severity: this.normalizeSeverity(alarmData.severity),
            status: alarmData.status || 'active',
            message: alarmData.message || alarmData.description || 'Live alarm detected',
            timestamp: alarmData.timestamp || new Date().toISOString(),
            latitude: alarmData.latitude ? parseFloat(alarmData.latitude) : null,
            longitude: alarmData.longitude ? parseFloat(alarmData.longitude) : null,
            imageUrl: alarmData.imageUrl || alarmData.image_url,
            speed: alarmData.speed !== undefined && alarmData.speed !== null ? parseFloat(alarmData.speed) : null, // Add speed
            acceleration: alarmData.acceleration !== undefined && alarmData.acceleration !== null ? parseFloat(alarmData.acceleration) : null, // Add acceleration
            resolved: false,
            isLive: true,
            source: 'live_stream',
            // Additional live stream metadata
            streamTimestamp: new Date().toISOString(),
            priority: alarmData.priority || (alarmData.severity === 'critical' ? 'high' : 'normal')
          };

          onAlarmReceived(transformedAlarm);
        } catch (error) {
          console.error('❌ Error parsing live alarm data:', error);
        }
      };

      this.eventSource.onerror = (error) => {
        console.error('❌ Live alarm stream error:', error);
        onConnectionChange && onConnectionChange({ 
          connected: false, 
          attempts: this.reconnectAttempts,
          error: error 
        });
        
        // Implement exponential backoff for reconnection
        if (this.reconnectAttempts < this.maxReconnectAttempts) {
          this.reconnectAttempts++;
          const delay = this.reconnectDelay * Math.pow(2, this.reconnectAttempts - 1);
          
          console.log(`🔄 Attempting to reconnect in ${delay}ms (${this.reconnectAttempts}/${this.maxReconnectAttempts})...`);
          
          setTimeout(() => {
            if (this.eventSource?.readyState === EventSource.CLOSED) {
              this.startLiveStream(onAlarmReceived, onConnectionChange);
            }
          }, delay);
        } else {
          console.error('❌ Max reconnection attempts reached');
          onConnectionChange && onConnectionChange({ 
            connected: false, 
            attempts: this.reconnectAttempts,
            maxAttemptsReached: true 
          });
        }
      };

    } catch (error) {
      console.error('❌ Failed to start live stream:', error);
      onConnectionChange && onConnectionChange({ 
        connected: false, 
        error: error.message 
      });
    }
  }

  /**
   * Stop live alarm stream
   */
  stopLiveStream() {
    if (this.eventSource) {
      console.log('🛑 Stopping live alarm stream');
      this.eventSource.close();
      this.eventSource = null;
      this.reconnectAttempts = 0;
    }
  }

  /**
   * Get live stream connection status
   */
  getLiveStreamStatus() {
    if (!this.eventSource) {
      return { connected: false, readyState: 'CLOSED' };
    }
    
    const readyStateNames = {
      [EventSource.CONNECTING]: 'CONNECTING',
      [EventSource.OPEN]: 'OPEN',
      [EventSource.CLOSED]: 'CLOSED'
    };
    
    return {
      connected: this.eventSource.readyState === EventSource.OPEN,
      readyState: readyStateNames[this.eventSource.readyState],
      reconnectAttempts: this.reconnectAttempts
    };
  }

  // ============================================
  // ALARM MANAGEMENT METHODS
  // ============================================

  /**
   * Resolve alarm (mock implementation since no API endpoint provided)
   */
  async resolveAlarm(alarmId, resolvedBy = 'system') {
    try {
      console.log(`✅ Resolving alarm ${alarmId}`);
      
      // TODO: Replace with actual API call when endpoint is available
      // const response = await apiService.request(`/alarm/v1/resolve/${alarmId}`, 'POST', { resolvedBy });
      
      // Mock successful resolution
      await new Promise(resolve => setTimeout(resolve, 500)); // Simulate API delay
      
      return { 
        success: true, 
        message: 'Alarm resolved successfully',
        alarmId,
        resolvedAt: new Date().toISOString(),
        resolvedBy
      };
    } catch (error) {
      console.error(`❌ Failed to resolve alarm ${alarmId}:`, error);
      return { 
        success: false, 
        error: error.message,
        alarmId
      };
    }
  }

  /**
   * Acknowledge alarm (mock implementation)
   */
  async acknowledgeAlarm(alarmId, acknowledgedBy = 'system') {
    try {
      console.log(`👁️ Acknowledging alarm ${alarmId}`);
      
      // TODO: Replace with actual API call when endpoint is available
      // const response = await apiService.request(`/alarm/v1/acknowledge/${alarmId}`, 'POST', { acknowledgedBy });
      
      // Mock successful acknowledgment
      await new Promise(resolve => setTimeout(resolve, 300));
      
      return { 
        success: true, 
        message: 'Alarm acknowledged successfully',
        alarmId,
        acknowledgedAt: new Date().toISOString(),
        acknowledgedBy
      };
    } catch (error) {
      console.error(`❌ Failed to acknowledge alarm ${alarmId}:`, error);
      return { 
        success: false, 
        error: error.message,
        alarmId
      };
    }
  }

  /**
   * Bulk resolve multiple alarms
   */
  async bulkResolveAlarms(alarmIds, resolvedBy = 'system') {
    try {
      console.log(`✅ Bulk resolving ${alarmIds.length} alarms`);
      
      const results = await Promise.allSettled(
        alarmIds.map(alarmId => this.resolveAlarm(alarmId, resolvedBy))
      );
      
      const successful = results.filter(r => r.status === 'fulfilled' && r.value.success).length;
      const failed = results.length - successful;
      
      return {
        success: true,
        message: `Resolved ${successful} alarms, ${failed} failed`,
        successful,
        failed,
        results
      };
    } catch (error) {
      console.error('❌ Failed to bulk resolve alarms:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  // ============================================
  // UTILITY METHODS
  // ============================================

  /**
   * Normalize severity levels
   */
  normalizeSeverity(severity) {
    if (!severity) return 'medium';
    
    const severityMap = {
      'critical': 'critical',
      'high': 'high',
      'medium': 'medium',
      'low': 'low',
      'warning': 'medium',
      'error': 'high',
      'info': 'low',
      'alert': 'high'
    };
    
    return severityMap[severity.toLowerCase()] || 'medium';
  }

  /**
   * Get alarm statistics
   */
  getAlarmStatistics(alarms) {
    const stats = {
      total: alarms.length,
      critical: 0,
      high: 0,
      medium: 0,
      low: 0,
      active: 0,
      resolved: 0,
      live: 0,
      withLocation: 0,
      byDevice: {},
      byType: {},
      recentAlarms: 0 // Last 24 hours
    };

    const now = new Date();
    const twentyFourHoursAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);

    alarms.forEach(alarm => {
      // Severity counts
      if (alarm.severity === 'critical') stats.critical++;
      else if (alarm.severity === 'high') stats.high++;
      else if (alarm.severity === 'medium') stats.medium++;
      else if (alarm.severity === 'low') stats.low++;

      // Status counts
      if (alarm.resolved) stats.resolved++;
      else stats.active++;

      // Live alarms
      if (alarm.isLive) stats.live++;

      // Location data
      if (alarm.latitude && alarm.longitude) stats.withLocation++;

      // Recent alarms (last 24 hours)
      if (new Date(alarm.timestamp) > twentyFourHoursAgo) stats.recentAlarms++;

      // By device
      const deviceId = alarm.device_id || 'unknown';
      stats.byDevice[deviceId] = (stats.byDevice[deviceId] || 0) + 1;

      // By type
      const alarmType = alarm.alarmType || 'unknown';
      stats.byType[alarmType] = (stats.byType[alarmType] || 0) + 1;
    });

    return stats;
  }

  /**
   * Filter alarms by criteria
   */
  filterAlarms(alarms, criteria) {
    return alarms.filter(alarm => {
      // Severity filter
      if (criteria.severity && alarm.severity !== criteria.severity) {
        return false;
      }

      // Status filter
      if (criteria.status) {
        if (criteria.status === 'active' && alarm.resolved) return false;
        if (criteria.status === 'resolved' && !alarm.resolved) return false;
        if (criteria.status === 'live' && !alarm.isLive) return false;
      }

      // Device filter
      if (criteria.deviceId && alarm.device_id !== criteria.deviceId) {
        return false;
      }

      // Date range filter
      if (criteria.startDate || criteria.endDate) {
        const alarmDate = new Date(alarm.timestamp);
        if (criteria.startDate && alarmDate < new Date(criteria.startDate)) return false;
        if (criteria.endDate && alarmDate > new Date(criteria.endDate)) return false;
      }

      // Search term filter
      if (criteria.searchTerm) {
        const searchLower = criteria.searchTerm.toLowerCase();
        const matchesMessage = alarm.message?.toLowerCase().includes(searchLower);
        const matchesType = alarm.alarmType?.toLowerCase().includes(searchLower);
        const matchesDevice = alarm.device_id?.toString().includes(searchLower);
        
        if (!matchesMessage && !matchesType && !matchesDevice) {
          return false;
        }
      }

      return true;
    });
  }

  /**
   * Export alarms to various formats
   */
  exportAlarms(alarms, format = 'csv') {
    try {
      if (format === 'csv') {
        return this.exportToCSV(alarms);
      } else if (format === 'json') {
        return this.exportToJSON(alarms);
      } else {
        throw new Error(`Unsupported export format: ${format}`);
      }
    } catch (error) {
      console.error('❌ Failed to export alarms:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Export alarms to CSV format
   */
  exportToCSV(alarms) {
    const headers = [
      'ID', 'Device ID', 'Vehicle ID', 'Type', 'Severity', 'Status', 'Message', 
      'Timestamp', 'Resolved', 'Latitude', 'Longitude', 'Source', 'Live Alarm',
      'Alert Code', 'Priority', 'Acknowledged By', 'Resolved By', 'Speed', 'Acceleration'
    ];
    
    const rows = alarms.map(alarm => [
      alarm.id,
      alarm.device_id,
      alarm.vehicleId || '',
      alarm.alarmType,
      alarm.severity,
      alarm.status,
      alarm.message,
      alarm.timestamp,
      alarm.resolved ? 'Yes' : 'No',
      alarm.latitude || '',
      alarm.longitude || '',
      alarm.source || '',
      alarm.isLive ? 'Yes' : 'No',
      alarm.alertCode || '',
      alarm.priority || '',
      alarm.acknowledgedBy || '',
      alarm.resolvedBy || '',
      alarm.speed !== null ? alarm.speed : '',
      alarm.acceleration !== null ? alarm.acceleration : ''
    ]);

    const csvContent = [headers, ...rows]
      .map(row => row.map(cell => `"${cell}"`).join(','))
      .join('\n');

    return {
      success: true,
      data: csvContent,
      filename: `alarms_export_${new Date().toISOString().split('T')[0]}.csv`,
      mimeType: 'text/csv'
    };
  }

  /**
   * Export alarms to JSON format
   */
  exportToJSON(alarms) {
    const exportData = {
      export_info: {
        timestamp: new Date().toISOString(),
        total_alarms: alarms.length,
        export_version: '1.0'
      },
      statistics: this.getAlarmStatistics(alarms),
      alarms: alarms
    };

    return {
      success: true,
      data: JSON.stringify(exportData, null, 2),
      filename: `alarms_export_${new Date().toISOString().split('T')[0]}.json`,
      mimeType: 'application/json'
    };
  }

  // ============================================
  // INTEGRATION WITH EXISTING API SERVICE
  // ============================================

  /**
   * Get all devices using existing API service
   */
  async getAllDevices() {
    try {
      return await apiService.getAllDevices();
    } catch (error) {
      console.error('❌ Failed to fetch devices:', error);
      return { success: false, data: [], error: error.message };
    }
  }

  /**
   * Health check for alarm services
   */
  async healthCheck() {
    try {
      const endpoints = [
        '/alarm/v1/manager/all?page=0&size=1',
        '/device/v1/all'
      ];

      const results = await Promise.allSettled(
        endpoints.map(endpoint => apiService.request(endpoint))
      );

      const managerAlarmsOk = results[0].status === 'fulfilled';
      const devicesOk = results[1].status === 'fulfilled';
      const liveStreamStatus = this.getLiveStreamStatus();

      return {
        success: true,
        services: {
          manager_alarms: managerAlarmsOk,
          devices: devicesOk,
          live_stream: liveStreamStatus.connected
        },
        overall_health: managerAlarmsOk && devicesOk ? 'healthy' : 'degraded'
      };
    } catch (error) {
      console.error('❌ Health check failed:', error);
      return {
        success: false,
        error: error.message,
        overall_health: 'unhealthy'
      };
    }
  }
}



// Create and export enhanced alarm service instance
const enhancedAlarmService = new EnhancedAlarmService();

export default enhancedAlarmService;