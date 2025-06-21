// src/services/enhancedApiService.js
import axios from 'axios';

class EnhancedApiService {
  constructor() {
    this.baseURL = 'http://164.52.194.198:9090';
    this.timeout = 30000;
    
    // Create axios instance
    this.api = axios.create({
      baseURL: this.baseURL,
      timeout: this.timeout,
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
    });

    // Add request interceptor for logging
    this.api.interceptors.request.use(
      (config) => {
        console.log(`🚀 API Request: ${config.method?.toUpperCase()} ${config.url}`);
        return config;
      },
      (error) => {
        console.error('❌ API Request Error:', error);
        return Promise.reject(error);
      }
    );

    // Add response interceptor for logging
    this.api.interceptors.response.use(
      (response) => {
        console.log(`✅ API Response: ${response.status} ${response.config.url}`);
        return response;
      },
      (error) => {
        console.error(`❌ API Response Error: ${error.response?.status} ${error.config?.url}`, error);
        return Promise.reject(error);
      }
    );
  }

  // ===========================================
  // DEVICE ENDPOINTS
  // ===========================================

  async getAllDevices() {
    try {
      console.log('📱 Fetching all devices...');
      const response = await this.api.get('/device/v1/all');
      
      if (response.data) {
        const devices = Array.isArray(response.data) ? response.data : 
                       (response.data.data && Array.isArray(response.data.data)) ? response.data.data : [];
        
        console.log(`✅ Found ${devices.length} devices`);
        return {
          success: true,
          data: devices.map(device => ({
            ...device,
            deviceId: device.deviceId || device.device_id || device.id,
            deviceName: device.deviceName || device.device_name || device.name,
            status: device.status || 'unknown',
            latitude: device.latitude ? parseFloat(device.latitude) : null,
            longitude: device.longitude ? parseFloat(device.longitude) : null
          }))
        };
      }
      
      return { success: true, data: [] };
    } catch (error) {
      console.error('❌ Failed to fetch devices:', error);
      return {
        success: false,
        data: [],
        error: error.message
      };
    }
  }

  // ===========================================
  // ALARM ENDPOINTS - COMPREHENSIVE FETCHING
  // ===========================================

  async getDeviceAlarms(deviceId, page = 0, size = 20) {
    try {
      console.log(`🚨 Fetching alarms for device ${deviceId}...`);
      const endpoint = `/alarm/v1/device/${deviceId}?page=${page}&size=${size}&sortBy=deviceId&direction=asc`;
      const response = await this.api.get(endpoint);
      
      if (response.data) {
        const alarms = Array.isArray(response.data) ? response.data : 
                      (response.data.data && Array.isArray(response.data.data)) ? response.data.data : [];
        
        const transformedAlarms = alarms.map(alarm => ({
          id: alarm.alarmId || alarm.id || `${deviceId}_${Date.now()}`,
          device_id: deviceId,
          alarmType: alarm.alarmType || alarm.type || alarm.alert_type,
          severity: alarm.severity || 'medium',
          status: alarm.status || 'active',
          message: alarm.message || alarm.description,
          timestamp: alarm.timestamp || alarm.createdAt || new Date().toISOString(),
          resolved: Boolean(alarm.resolved),
          latitude: alarm.latitude ? parseFloat(alarm.latitude) : null,
          longitude: alarm.longitude ? parseFloat(alarm.longitude) : null,
          imageUrl: alarm.imageUrl || alarm.image_url || alarm.attachmentUrl,
          // Additional fields that might be present
          vehicleId: alarm.vehicleId || alarm.vehicle_id,
          alertCode: alarm.alertCode || alarm.alert_code,
          priority: alarm.priority,
          acknowledgedBy: alarm.acknowledgedBy,
          acknowledgedAt: alarm.acknowledgedAt,
          resolvedBy: alarm.resolvedBy,
          resolvedAt: alarm.resolvedAt,
          metadata: alarm.metadata || {}
        }));
        
        console.log(`✅ Found ${transformedAlarms.length} alarms for device ${deviceId}`);
        return {
          success: true,
          data: transformedAlarms
        };
      }
      
      return { success: true, data: [] };
    } catch (error) {
      console.error(`❌ Failed to fetch alarms for device ${deviceId}:`, error);
      return {
        success: false,
        data: [],
        error: error.message
      };
    }
  }

  async getAllManagerAlarms(page = 0, size = 100) {
    try {
      console.log('🚨 Fetching all manager alarms...');
      const endpoint = `/alarm/v1/manager/all?page=${page}&size=${size}`;
      const response = await this.api.get(endpoint);
      
      if (response.data) {
        const alarms = Array.isArray(response.data) ? response.data : 
                      (response.data.data && Array.isArray(response.data.data)) ? response.data.data : [];
        
        const transformedAlarms = alarms.map(alarm => ({
          id: alarm.alarmId || alarm.id || `alarm_${Date.now()}`,
          device_id: alarm.deviceId || alarm.device_id,
          vehicleId: alarm.vehicleId || alarm.vehicle_id,
          alarmType: alarm.alarmType || alarm.type || alarm.alert_type,
          severity: alarm.severity || 'medium',
          status: alarm.status || 'active',
          message: alarm.message || alarm.description,
          timestamp: alarm.timestamp || alarm.createdAt || new Date().toISOString(),
          resolved: Boolean(alarm.resolved),
          latitude: alarm.latitude ? parseFloat(alarm.latitude) : null,
          longitude: alarm.longitude ? parseFloat(alarm.longitude) : null,
          imageUrl: alarm.imageUrl || alarm.image_url || alarm.attachmentUrl,
          // Additional fields
          alertCode: alarm.alertCode || alarm.alert_code,
          priority: alarm.priority,
          acknowledgedBy: alarm.acknowledgedBy,
          acknowledgedAt: alarm.acknowledgedAt,
          resolvedBy: alarm.resolvedBy,
          resolvedAt: alarm.resolvedAt,
          metadata: alarm.metadata || {}
        }));
        
        console.log(`✅ Found ${transformedAlarms.length} manager alarms`);
        return {
          success: true,
          data: transformedAlarms
        };
      }
      
      return { success: true, data: [] };
    } catch (error) {
      console.error('❌ Failed to fetch manager alarms:', error);
      return {
        success: false,
        data: [],
        error: error.message
      };
    }
  }

  async getAllAlarmsFromAllDevices() {
    try {
      console.log('🚨 Fetching alarms from all devices...');
      
      // First, get all devices
      const devicesResponse = await this.getAllDevices();
      if (!devicesResponse.success || devicesResponse.data.length === 0) {
        console.warn('⚠️ No devices found');
        return { success: true, data: [] };
      }

      console.log(`📱 Found ${devicesResponse.data.length} devices, fetching alarms for each...`);
      
      // Fetch alarms for all devices concurrently
      const alarmPromises = devicesResponse.data.map(device => {
        const deviceId = device.deviceId || device.device_id || device.id;
        return this.getDeviceAlarms(deviceId, 0, 50); // Get more alarms per device
      });

      const alarmResults = await Promise.allSettled(alarmPromises);
      
      // Collect all successful alarm fetches
      const allAlarms = [];
      alarmResults.forEach((result, index) => {
        if (result.status === 'fulfilled' && result.value.success) {
          allAlarms.push(...result.value.data);
        } else {
          const deviceId = devicesResponse.data[index]?.deviceId || index;
          console.warn(`⚠️ Failed to fetch alarms for device ${deviceId}`);
        }
      });

      console.log(`✅ Successfully collected ${allAlarms.length} total alarms from all devices`);
      
      // Sort alarms by timestamp (newest first)
      allAlarms.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
      
      return {
        success: true,
        data: allAlarms,
        deviceCount: devicesResponse.data.length,
        message: `Found ${allAlarms.length} alarms from ${devicesResponse.data.length} devices`
      };
      
    } catch (error) {
      console.error('❌ Failed to fetch alarms from all devices:', error);
      return {
        success: false,
        data: [],
        error: error.message
      };
    }
  }

  // ===========================================
  // ALARM RESOLUTION ENDPOINTS
  // ===========================================

  async resolveAlarm(alarmId, deviceId = null) {
    try {
      console.log(`🔧 Resolving alarm ${alarmId}...`);
      
      // Try different endpoints for resolving alarms
      const endpoints = [
        `/alarm/v1/resolve/${alarmId}`,
        `/alarm/v1/update/${alarmId}`,
        deviceId ? `/alarm/v1/device/${deviceId}/resolve/${alarmId}` : null
      ].filter(Boolean);

      for (const endpoint of endpoints) {
        try {
          const response = await this.api.post(endpoint, {
            resolved: true,
            status: 'resolved',
            resolvedAt: new Date().toISOString()
          });
          
          if (response.status === 200 || response.status === 204) {
            console.log(`✅ Alarm ${alarmId} resolved successfully`);
            return { success: true };
          }
        } catch (endpointError) {
          console.warn(`⚠️ Endpoint ${endpoint} failed:`, endpointError.message);
          continue;
        }
      }
      
      throw new Error('All resolve endpoints failed');
      
    } catch (error) {
      console.error(`❌ Failed to resolve alarm ${alarmId}:`, error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  async acknowledgeAlarm(alarmId, deviceId = null) {
    try {
      console.log(`👍 Acknowledging alarm ${alarmId}...`);
      
      const endpoints = [
        `/alarm/v1/acknowledge/${alarmId}`,
        `/alarm/v1/update/${alarmId}`,
        deviceId ? `/alarm/v1/device/${deviceId}/acknowledge/${alarmId}` : null
      ].filter(Boolean);

      for (const endpoint of endpoints) {
        try {
          const response = await this.api.post(endpoint, {
            acknowledged: true,
            acknowledgedAt: new Date().toISOString()
          });
          
          if (response.status === 200 || response.status === 204) {
            console.log(`✅ Alarm ${alarmId} acknowledged successfully`);
            return { success: true };
          }
        } catch (endpointError) {
          console.warn(`⚠️ Endpoint ${endpoint} failed:`, endpointError.message);
          continue;
        }
      }
      
      throw new Error('All acknowledge endpoints failed');
      
    } catch (error) {
      console.error(`❌ Failed to acknowledge alarm ${alarmId}:`, error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  // ===========================================
  // IMAGE/ATTACHMENT ENDPOINTS
  // ===========================================

  async downloadAlarmImage(imageUrl, alarmId = null) {
    try {
      console.log(`📸 Downloading alarm image: ${imageUrl}`);
      
      const response = await this.api.get(imageUrl, {
        responseType: 'blob'
      });
      
      if (response.data) {
        // Create download link
        const blob = new Blob([response.data]);
        const url = window.URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `alarm_image_${alarmId || Date.now()}.jpg`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        window.URL.revokeObjectURL(url);
        
        console.log(`✅ Image downloaded successfully`);
        return { success: true };
      }
      
      throw new Error('No image data received');
      
    } catch (error) {
      console.error('❌ Failed to download alarm image:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  // ===========================================
  // TELEMETRY ENDPOINTS
  // ===========================================

  async getDeviceTelemetry(deviceId, page = 0, size = 10) {
    try {
      console.log(`📊 Fetching telemetry for device ${deviceId}...`);
      
      const endpoints = [
        `/device/v1/data/${deviceId}?page=${page}&size=${size}&direction=desc`,
        `/deviceTelemetry/v1/device/${deviceId}?page=${page}&size=${size}`,
        `/telemetry/v1/device/${deviceId}?page=${page}&size=${size}`
      ];

      for (const endpoint of endpoints) {
        try {
          const response = await this.api.get(endpoint);
          
          if (response.data) {
            const telemetryData = Array.isArray(response.data) ? response.data : 
                                 (response.data.data && Array.isArray(response.data.data)) ? response.data.data : [];
            
            const transformedData = telemetryData.map(item => ({
              id: item.id || `${deviceId}_${Date.now()}`,
              device_id: deviceId,
              timestamp: item.timestamp || item.createdAt || new Date().toISOString(),
              latitude: item.latitude ? parseFloat(item.latitude) : null,
              longitude: item.longitude ? parseFloat(item.longitude) : null,
              speed: item.speed ? parseFloat(item.speed) : null,
              heading: item.heading ? parseFloat(item.heading) : null,
              altitude: item.altitude ? parseFloat(item.altitude) : null,
              accuracy: item.accuracy ? parseFloat(item.accuracy) : null,
              battery_voltage: item.battery_voltage ? parseFloat(item.battery_voltage) : null,
              signal_strength: item.signal_strength ? parseFloat(item.signal_strength) : null,
              temperature: item.temperature ? parseFloat(item.temperature) : null,
              // Alert flags
              collision: Boolean(item.collision),
              rash_driving: Boolean(item.rashDriving || item.rash_driving),
              drowsiness: Boolean(item.drowsiness),
              speed_violation: Boolean(item.speed_violation),
              harsh_braking: Boolean(item.harsh_braking),
              harsh_acceleration: Boolean(item.harsh_acceleration),
              // Additional data
              ignition: Boolean(item.ignition),
              engine_status: item.engine_status,
              fuel_level: item.fuel_level ? parseFloat(item.fuel_level) : null,
              odometer: item.odometer ? parseFloat(item.odometer) : null
            }));
            
            console.log(`✅ Found ${transformedData.length} telemetry records for device ${deviceId}`);
            return {
              success: true,
              data: transformedData,
              endpoint_used: endpoint
            };
          }
        } catch (endpointError) {
          console.warn(`⚠️ Endpoint ${endpoint} failed:`, endpointError.message);
          continue;
        }
      }
      
      return { success: true, data: [] };
      
    } catch (error) {
      console.error(`❌ Failed to fetch telemetry for device ${deviceId}:`, error);
      return {
        success: false,
        data: [],
        error: error.message
      };
    }
  }

  // ===========================================
  // UTILITY METHODS
  // ===========================================

  async testConnection() {
    try {
      console.log('🔌 Testing API connection...');
      const response = await this.api.get('/health');
      return {
        success: true,
        status: 'connected',
        message: 'API connection successful'
      };
    } catch (error) {
      console.error('❌ API connection test failed:', error);
      return {
        success: false,
        status: 'disconnected',
        error: error.message
      };
    }
  }

  // Export alarm data to CSV
  exportAlarmsToCSV(alarms, filename = null) {
    try {
      if (!alarms || alarms.length === 0) {
        throw new Error('No alarms to export');
      }

      const headers = [
        'Alarm ID',
        'Device ID',
        'Vehicle ID',
        'Type',
        'Severity',
        'Status',
        'Message',
        'Timestamp',
        'Resolved',
        'Latitude',
        'Longitude',
        'Image URL',
        'Alert Code',
        'Priority',
        'Acknowledged By',
        'Acknowledged At',
        'Resolved By',
        'Resolved At'
      ];

      const csvRows = alarms.map(alarm => [
        alarm.id || '',
        alarm.device_id || '',
        alarm.vehicleId || '',
        alarm.alarmType || '',
        alarm.severity || '',
        alarm.status || '',
        (alarm.message || '').replace(/,/g, ';'),
        alarm.timestamp || '',
        alarm.resolved ? 'Yes' : 'No',
        alarm.latitude || '',
        alarm.longitude || '',
        alarm.imageUrl || '',
        alarm.alertCode || '',
        alarm.priority || '',
        alarm.acknowledgedBy || '',
        alarm.acknowledgedAt || '',
        alarm.resolvedBy || '',
        alarm.resolvedAt || ''
      ]);

      const csvContent = [headers, ...csvRows]
        .map(row => row.map(cell => `"${cell}"`).join(','))
        .join('\n');

      // Create and download file
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement('a');
      const url = URL.createObjectURL(blob);
      link.setAttribute('href', url);
      link.setAttribute('download', filename || `alarms_export_${new Date().toISOString().split('T')[0]}.csv`);
      link.style.visibility = 'hidden';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      console.log(`✅ Exported ${alarms.length} alarms to CSV`);
      return { success: true };
      
    } catch (error) {
      console.error('❌ Failed to export alarms to CSV:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  // Export alarm locations to KML for mapping
  exportAlarmLocationsToKML(alarms, filename = null) {
    try {
      const alarmsWithLocation = alarms.filter(alarm => alarm.latitude && alarm.longitude);
      
      if (alarmsWithLocation.length === 0) {
        throw new Error('No alarms with location data to export');
      }

      let kmlContent = `<?xml version="1.0" encoding="UTF-8"?>
<kml xmlns="http://www.opengis.net/kml/2.2">
  <Document>
    <name>Alarm Locations</name>
    <description>Exported alarm locations with details</description>
`;

      alarmsWithLocation.forEach(alarm => {
        const severity = alarm.severity || 'medium';
        const color = severity === 'critical' ? 'ff0000ff' : 
                     severity === 'high' ? 'ff0080ff' :
                     severity === 'medium' ? 'ff00ffff' : 'ff00ff00';

        kmlContent += `
    <Placemark>
      <name>Alarm: ${alarm.alarmType || 'Unknown'}</name>
      <description><![CDATA[
        <b>Device ID:</b> ${alarm.device_id}<br/>
        <b>Type:</b> ${alarm.alarmType || 'Unknown'}<br/>
        <b>Severity:</b> ${alarm.severity || 'medium'}<br/>
        <b>Message:</b> ${alarm.message || 'No message'}<br/>
        <b>Timestamp:</b> ${new Date(alarm.timestamp).toLocaleString()}<br/>
        <b>Status:</b> ${alarm.resolved ? 'Resolved' : 'Active'}
      ]]></description>
      <Style>
        <IconStyle>
          <color>${color}</color>
          <scale>1.2</scale>
        </IconStyle>
      </Style>
      <Point>
        <coordinates>${alarm.longitude},${alarm.latitude},0</coordinates>
      </Point>
    </Placemark>`;
      });

      kmlContent += `
  </Document>
</kml>`;

      // Create and download file
      const blob = new Blob([kmlContent], { type: 'application/vnd.google-earth.kml+xml' });
      const link = document.createElement('a');
      const url = URL.createObjectURL(blob);
      link.setAttribute('href', url);
      link.setAttribute('download', filename || `alarm_locations_${new Date().toISOString().split('T')[0]}.kml`);
      link.style.visibility = 'hidden';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      console.log(`✅ Exported ${alarmsWithLocation.length} alarm locations to KML`);
      return { success: true };
      
    } catch (error) {
      console.error('❌ Failed to export alarm locations to KML:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }
}

// Create and export singleton instance
const enhancedApiService = new EnhancedApiService();
export default enhancedApiService;