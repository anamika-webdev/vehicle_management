// Enhanced Route Tracking Service with better error handling and fallback mechanisms
// src/services/enhancedRouteTrackingService.js

class EnhancedRouteTrackingService {
  constructor() {
    this.apiBaseUrl = 'http://164.52.194.198:9090';
    this.wsUrl = 'ws://164.52.194.198:9091';
    this.activeJourneys = new Map();
    this.trackingIntervals = new Map();
    this.routeHistory = [];
    this.fallbackMode = false;
    this.telemetryCache = new Map();
    
    // Initialize fallback mechanisms
    this.initializeFallbackSystems();
  }

  // Initialize fallback systems for when APIs fail
  initializeFallbackSystems() {
    // Set up periodic health checks
    setInterval(() => this.healthCheck(), 30000); // Check every 30 seconds
    
    // Load existing data
    this.loadRouteHistory();
    this.loadActiveJourneys();
  }

  // Health check for API endpoints
  async healthCheck() {
    try {
      const response = await fetch(`${this.apiBaseUrl}/health`, {
        method: 'GET',
        timeout: 5000
      });
      
      if (response.ok) {
        this.fallbackMode = false;
        console.log('✅ API health check passed');
      } else {
        this.fallbackMode = true;
        console.warn('⚠️ API health check failed, enabling fallback mode');
      }
    } catch (error) {
      this.fallbackMode = true;
      console.warn('⚠️ API unreachable, using fallback mode:', error.message);
    }
  }

  // Enhanced journey start with multiple data sources
  async startJourneyTracking(vehicleId, managerId) {
    try {
      const journeyId = `J_${Date.now()}_${vehicleId}`;
      
      // Try to get initial position from multiple sources
      const initialPosition = await this.getInitialPositionWithFallback(vehicleId, managerId);
      
      const journey = {
        journey_id: journeyId,
        vehicle_id: vehicleId,
        manager_id: managerId,
        start_time: new Date().toISOString(),
        start_location: {
          latitude: initialPosition.latitude,
          longitude: initialPosition.longitude,
          timestamp: new Date().toISOString(),
          source: initialPosition.source,
          address: await this.reverseGeocode(initialPosition.latitude, initialPosition.longitude)
        },
        route_points: [{
          latitude: initialPosition.latitude,
          longitude: initialPosition.longitude,
          timestamp: new Date().toISOString(),
          speed: initialPosition.speed || 0,
          heading: initialPosition.heading || 0,
          source: initialPosition.source,
          accuracy: initialPosition.accuracy || null
        }],
        status: 'active',
        total_distance: 0,
        max_speed: initialPosition.speed || 0,
        avg_speed: initialPosition.speed || 0,
        total_duration: 0,
        alerts: [],
        waypoints: [],
        data_sources: [initialPosition.source],
        fallback_mode: this.fallbackMode,
        vehicle_info: await this.getVehicleInfoWithFallback(vehicleId, managerId)
      };

      this.activeJourneys.set(vehicleId, journey);

      // Start enhanced tracking with multiple update strategies
      this.startEnhancedTracking(vehicleId, managerId);

      // Save journey start
      this.saveJourneyToStorage(journey);

      console.log(`✅ Enhanced journey tracking started: ${journeyId} (fallback: ${this.fallbackMode})`);
      return journey;

    } catch (error) {
      console.error('❌ Error starting enhanced journey tracking:', error);
      throw error;
    }
  }

  // Get initial position with multiple fallback sources
  async getInitialPositionWithFallback(vehicleId, managerId) {
    const fallbackSources = [
      () => this.getPositionFromTelemetry(vehicleId, managerId),
      () => this.getPositionFromDevice(vehicleId, managerId),
      () => this.getPositionFromVehicle(vehicleId, managerId),
      () => this.getPositionFromGeolocation(),
      () => this.getPositionFromCache(vehicleId),
      () => this.getDefaultPosition()
    ];

    for (const [index, source] of fallbackSources.entries()) {
      try {
        const position = await source();
        if (position && position.latitude && position.longitude) {
          console.log(`✅ Position obtained from source ${index + 1}`);
          return { ...position, source: this.getSourceName(index) };
        }
      } catch (error) {
        console.warn(`⚠️ Position source ${index + 1} failed:`, error.message);
      }
    }

    throw new Error('All position sources failed');
  }

  // Get position from telemetry API with enhanced error handling
  async getPositionFromTelemetry(vehicleId, managerId) {
    if (this.fallbackMode) return null;

    try {
      // Get device for this vehicle
      const devices = await this.getDevicesWithRetry(managerId);
      const device = devices.find(d => d.vehicle_id === vehicleId);
      
      if (!device) {
        throw new Error('No device found for vehicle');
      }

      // Try multiple telemetry endpoints
      const telemetryEndpoints = [
        `/device/v1/data/${device.device_id}?direction=desc&size=1`,
        `/device/v1/data/${device.device_id}`,
        `/deviceTelemetry/v1/device/${device.device_id}?page=0&size=1`,
        `/telemetry/v1/device/${device.device_id}?direction=desc`
      ];

      for (const endpoint of telemetryEndpoints) {
        try {
          const response = await fetch(`${this.apiBaseUrl}${endpoint}`);
          
          if (response.ok) {
            const data = await response.json();
            const telemetryData = data.data || data.content || data;
            
            if (Array.isArray(telemetryData) && telemetryData.length > 0) {
              const latest = telemetryData[0];
              
              if (latest.latitude && latest.longitude) {
                return {
                  latitude: parseFloat(latest.latitude),
                  longitude: parseFloat(latest.longitude),
                  speed: parseFloat(latest.speed || 0),
                  heading: parseFloat(latest.heading || 0),
                  accuracy: latest.accuracy,
                  timestamp: latest.timestamp || new Date().toISOString()
                };
              }
            }
          }
        } catch (endpointError) {
          console.warn(`Telemetry endpoint failed: ${endpoint}`, endpointError.message);
          continue;
        }
      }

      throw new Error('All telemetry endpoints failed');
    } catch (error) {
      console.warn('Telemetry position failed:', error.message);
      return null;
    }
  }

  // Get position from device data
  async getPositionFromDevice(vehicleId, managerId) {
    try {
      const devices = await this.getDevicesWithRetry(managerId);
      const device = devices.find(d => d.vehicle_id === vehicleId);
      
      if (device && device.latitude && device.longitude) {
        return {
          latitude: parseFloat(device.latitude),
          longitude: parseFloat(device.longitude),
          speed: parseFloat(device.speed || 0),
          heading: 0,
          accuracy: null
        };
      }
      
      return null;
    } catch (error) {
      console.warn('Device position failed:', error.message);
      return null;
    }
  }

  // Get position from vehicle data
  async getPositionFromVehicle(vehicleId, managerId) {
    try {
      const vehicles = await this.getVehiclesWithRetry(managerId);
      const vehicle = vehicles.find(v => v.vehicle_id === vehicleId);
      
      if (vehicle && vehicle.current_latitude && vehicle.current_longitude) {
        return {
          latitude: parseFloat(vehicle.current_latitude),
          longitude: parseFloat(vehicle.current_longitude),
          speed: 0,
          heading: 0,
          accuracy: null
        };
      }
      
      return null;
    } catch (error) {
      console.warn('Vehicle position failed:', error.message);
      return null;
    }
  }

  // Get position from browser geolocation
  async getPositionFromGeolocation() {
    return new Promise((resolve, reject) => {
      if (!navigator.geolocation) {
        reject(new Error('Geolocation not supported'));
        return;
      }

      navigator.geolocation.getCurrentPosition(
        (position) => {
          resolve({
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
            speed: position.coords.speed || 0,
            heading: position.coords.heading || 0,
            accuracy: position.coords.accuracy
          });
        },
        (error) => {
          reject(new Error(`Geolocation error: ${error.message}`));
        },
        { timeout: 10000, enableHighAccuracy: true }
      );
    });
  }

  // Get position from cache
  async getPositionFromCache(vehicleId) {
    const cached = this.telemetryCache.get(vehicleId);
    if (cached && Date.now() - cached.timestamp < 300000) { // 5 minutes
      return cached.position;
    }
    return null;
  }

  // Default position (fallback location)
  async getDefaultPosition() {
    // Default to a central location - you can customize this
    return {
      latitude: 28.4595,  // Gurugram
      longitude: 77.0266,
      speed: 0,
      heading: 0,
      accuracy: null
    };
  }

  // Enhanced tracking with multiple update strategies
  startEnhancedTracking(vehicleId, managerId) {
    // Clear any existing interval
    if (this.trackingIntervals.has(vehicleId)) {
      clearInterval(this.trackingIntervals.get(vehicleId));
    }

    // Set up tracking interval with adaptive frequency
    const updateInterval = this.fallbackMode ? 30000 : 10000; // 30s in fallback, 10s normal
    
    const interval = setInterval(async () => {
      await this.updateJourneyWithEnhancedData(vehicleId, managerId);
    }, updateInterval);

    this.trackingIntervals.set(vehicleId, interval);
  }

  // Enhanced journey update with multiple data sources
  async updateJourneyWithEnhancedData(vehicleId, managerId) {
    try {
      const journey = this.activeJourneys.get(vehicleId);
      if (!journey) return;

      // Try to get new position
      const newPosition = await this.getInitialPositionWithFallback(vehicleId, managerId);
      
      if (!newPosition.latitude || !newPosition.longitude) {
        console.warn('⚠️ No valid position data for journey update');
        return;
      }

      const lastPoint = journey.route_points[journey.route_points.length - 1];
      
      // Calculate distance from last point
      const distance = this.calculateDistance(
        lastPoint.latitude, lastPoint.longitude,
        newPosition.latitude, newPosition.longitude
      );

      // Only add point if significant movement (> 10 meters) or speed change
      const speedChange = Math.abs((newPosition.speed || 0) - (lastPoint.speed || 0));
      
      if (distance > 0.01 || speedChange > 5) { // 10m or 5km/h speed change
        const newPoint = {
          latitude: newPosition.latitude,
          longitude: newPosition.longitude,
          timestamp: new Date().toISOString(),
          speed: newPosition.speed || 0,
          heading: newPosition.heading || 0,
          accuracy: newPosition.accuracy || null,
          source: newPosition.source,
          distance_from_previous: distance,
          address: await this.reverseGeocode(newPosition.latitude, newPosition.longitude)
        };

        journey.route_points.push(newPoint);

        // Update journey stats
        journey.total_distance += distance;
        journey.max_speed = Math.max(journey.max_speed, newPosition.speed || 0);
        journey.avg_speed = journey.route_points.reduce((sum, p) => sum + (p.speed || 0), 0) / journey.route_points.length;
        journey.total_duration = Date.now() - new Date(journey.start_time).getTime();
        journey.last_updated = new Date().toISOString();

        // Add data source to tracking
        if (!journey.data_sources.includes(newPosition.source)) {
          journey.data_sources.push(newPosition.source);
        }

        // Check for driving alerts
        await this.checkForDrivingAlerts(journey, newPoint, lastPoint);

        // Cache the position
        this.telemetryCache.set(vehicleId, {
          position: newPosition,
          timestamp: Date.now()
        });

        // Save updated journey
        this.saveJourneyToStorage(journey);

        // Trigger real-time updates
        this.notifyJourneyUpdate(vehicleId, journey);

        console.log(`📍 Enhanced position updated: ${newPosition.source} - ${newPosition.latitude.toFixed(6)}, ${newPosition.longitude.toFixed(6)}`);
      }

    } catch (error) {
      console.error('❌ Error in enhanced journey update:', error);
      
      // In case of error, try to continue with cached data
      await this.continueWithCachedData(vehicleId);
    }
  }

  // Continue tracking with cached data when API fails
  async continueWithCachedData(vehicleId) {
    const journey = this.activeJourneys.get(vehicleId);
    if (!journey) return;

    const lastPoint = journey.route_points[journey.route_points.length - 1];
    
    // Simulate movement based on last known trajectory
    if (lastPoint && lastPoint.speed > 0) {
      const timeElapsed = 10; // 10 seconds
      const distance = (lastPoint.speed * timeElapsed) / 3600; // km
      
      // Simple dead reckoning
      const bearing = lastPoint.heading || 0;
      const newPosition = this.calculateNewPosition(
        lastPoint.latitude,
        lastPoint.longitude,
        distance,
        bearing
      );

      const estimatedPoint = {
        latitude: newPosition.latitude,
        longitude: newPosition.longitude,
        timestamp: new Date().toISOString(),
        speed: lastPoint.speed * 0.95, // Slight deceleration
        heading: lastPoint.heading,
        accuracy: null,
        source: 'estimated',
        distance_from_previous: distance,
        address: 'Estimated location'
      };

      journey.route_points.push(estimatedPoint);
      journey.total_distance += distance;
      journey.total_duration = Date.now() - new Date(journey.start_time).getTime();

      this.saveJourneyToStorage(journey);
      this.notifyJourneyUpdate(vehicleId, journey);

      console.log('📍 Using estimated position due to API failure');
    }
  }

  // API calls with retry logic
  async getVehiclesWithRetry(managerId, retries = 3) {
    for (let i = 0; i < retries; i++) {
      try {
        const response = await fetch(`${this.apiBaseUrl}/vehicle/v1/all?managerId=${managerId}`);
        if (response.ok) {
          const data = await response.json();
          return data.data || [];
        }
      } catch (error) {
        if (i === retries - 1) throw error;
        await this.delay(1000 * (i + 1)); // Exponential backoff
      }
    }
    return [];
  }

  async getDevicesWithRetry(managerId, retries = 3) {
    for (let i = 0; i < retries; i++) {
      try {
        const response = await fetch(`${this.apiBaseUrl}/device/v1/all?managerId=${managerId}`);
        if (response.ok) {
          const data = await response.json();
          return data.data || [];
        }
      } catch (error) {
        if (i === retries - 1) throw error;
        await this.delay(1000 * (i + 1));
      }
    }
    return [];
  }

  // Utility functions
  getSourceName(index) {
    const sources = ['telemetry', 'device', 'vehicle', 'geolocation', 'cache', 'default'];
    return sources[index] || 'unknown';
  }

  calculateDistance(lat1, lon1, lat2, lon2) {
    const R = 6371; // Earth's radius in km
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
              Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
              Math.sin(dLon/2) * Math.sin(dLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c;
  }

  calculateNewPosition(lat, lon, distance, bearing) {
    const R = 6371; // Earth's radius in km
    const bearingRad = bearing * Math.PI / 180;
    const latRad = lat * Math.PI / 180;
    const lonRad = lon * Math.PI / 180;

    const newLatRad = Math.asin(Math.sin(latRad) * Math.cos(distance/R) +
                               Math.cos(latRad) * Math.sin(distance/R) * Math.cos(bearingRad));
    
    const newLonRad = lonRad + Math.atan2(Math.sin(bearingRad) * Math.sin(distance/R) * Math.cos(latRad),
                                         Math.cos(distance/R) - Math.sin(latRad) * Math.sin(newLatRad));

    return {
      latitude: newLatRad * 180 / Math.PI,
      longitude: newLonRad * 180 / Math.PI
    };
  }

  delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  // Enhanced reverse geocoding with fallback
  async reverseGeocode(latitude, longitude) {
    try {
      // Try OpenStreetMap Nominatim (free)
      const response = await fetch(
        `https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}&zoom=18&addressdetails=1`
      );
      
      if (response.ok) {
        const data = await response.json();
        return data.display_name || `${latitude.toFixed(6)}, ${longitude.toFixed(6)}`;
      }
    } catch (error) {
      console.warn('Reverse geocoding failed:', error);
    }
    
    return `${latitude.toFixed(6)}, ${longitude.toFixed(6)}`;
  }

  // Enhanced driving alerts
  async checkForDrivingAlerts(journey, newPoint, previousPoint) {
    if (!previousPoint) return;

    const alerts = [];
    const timeDiff = (new Date(newPoint.timestamp) - new Date(previousPoint.timestamp)) / 1000; // seconds

    if (timeDiff <= 0) return;

    // Speed limit check (configurable)
    const speedLimit = 60; // km/h - make this configurable
    if (newPoint.speed > speedLimit) {
      alerts.push({
        type: 'speeding',
        timestamp: newPoint.timestamp,
        location: { latitude: newPoint.latitude, longitude: newPoint.longitude },
        address: newPoint.address,
        speed: newPoint.speed,
        speed_limit: speedLimit,
        severity: newPoint.speed > speedLimit * 1.2 ? 'high' : 'medium'
      });
    }

    // Harsh acceleration/deceleration
    const speedDiff = newPoint.speed - previousPoint.speed;
    const acceleration = speedDiff / timeDiff;
    
    if (acceleration > 8) { // 8 km/h per second
      alerts.push({
        type: 'harsh_acceleration',
        timestamp: newPoint.timestamp,
        location: { latitude: newPoint.latitude, longitude: newPoint.longitude },
        address: newPoint.address,
        acceleration: acceleration,
        severity: 'medium'
      });
    }

    if (acceleration < -10) { // harsh braking
      alerts.push({
        type: 'harsh_braking',
        timestamp: newPoint.timestamp,
        location: { latitude: newPoint.latitude, longitude: newPoint.longitude },
        address: newPoint.address,
        deceleration: Math.abs(acceleration),
        severity: 'high'
      });
    }

    // Add data source reliability alerts
    if (newPoint.source === 'estimated') {
      alerts.push({
        type: 'data_quality',
        timestamp: newPoint.timestamp,
        location: { latitude: newPoint.latitude, longitude: newPoint.longitude },
        message: 'Using estimated position due to API unavailability',
        severity: 'low'
      });
    }

    journey.alerts.push(...alerts);

    if (alerts.length > 0) {
      console.log('🚨 Enhanced driving alerts detected:', alerts);
    }
  }

  // Enhanced vehicle info retrieval
  async getVehicleInfoWithFallback(vehicleId, managerId) {
    try {
      const vehicles = await this.getVehiclesWithRetry(managerId);
      const vehicle = vehicles.find(v => v.vehicle_id === vehicleId);
      
      if (vehicle) {
        return {
          vehicle_number: vehicle.vehicle_number,
          make: vehicle.make,
          model: vehicle.model,
          year: vehicle.year,
          color: vehicle.color,
          fuel_type: vehicle.fuel_type,
          engine_capacity: vehicle.engine_capacity
        };
      }
    } catch (error) {
      console.warn('Failed to get vehicle info:', error);
    }

    return {
      vehicle_number: `VEH_${vehicleId}`,
      make: 'Unknown',
      model: 'Unknown',
      year: null,
      color: null,
      fuel_type: null,
      engine_capacity: null
    };
  }

  // Enhanced journey stopping
  async stopJourneyTracking(vehicleId) {
    try {
      const journey = this.activeJourneys.get(vehicleId);
      if (!journey) {
        throw new Error('No active journey found for this vehicle');
      }

      // Clear tracking interval
      if (this.trackingIntervals.has(vehicleId)) {
        clearInterval(this.trackingIntervals.get(vehicleId));
        this.trackingIntervals.delete(vehicleId);
      }

      // Get final position
      const finalPosition = await this.getInitialPositionWithFallback(vehicleId, journey.manager_id);
      
      // Finalize journey
      journey.end_time = new Date().toISOString();
      journey.end_location = {
        latitude: finalPosition.latitude,
        longitude: finalPosition.longitude,
        timestamp: new Date().toISOString(),
        source: finalPosition.source,
        address: await this.reverseGeocode(finalPosition.latitude, finalPosition.longitude)
      };
      journey.status = 'completed';
      journey.total_duration = Date.now() - new Date(journey.start_time).getTime();

      // Generate enhanced summary
      journey.summary = {
        total_points: journey.route_points.length,
        total_distance_km: journey.total_distance,
        duration_hours: journey.total_duration / (1000 * 60 * 60),
        avg_speed_kmh: journey.avg_speed,
        max_speed_kmh: journey.max_speed,
        data_sources_used: journey.data_sources,
        fallback_mode_used: journey.fallback_mode,
        estimated_points: journey.route_points.filter(p => p.source === 'estimated').length,
        api_success_rate: (journey.route_points.length - journey.route_points.filter(p => p.source === 'estimated').length) / journey.route_points.length,
        stops_detected: this.detectStops(journey.route_points),
        harsh_events: journey.alerts.filter(alert => 
          ['harsh_braking', 'harsh_acceleration'].includes(alert.type)
        ).length,
        speeding_events: journey.alerts.filter(alert => alert.type === 'speeding').length,
        data_quality_alerts: journey.alerts.filter(alert => alert.type === 'data_quality').length
      };

      // Move to history
      this.routeHistory.unshift(journey);
      this.activeJourneys.delete(vehicleId);

      // Save to persistent storage
      this.saveRouteHistory();
      this.removeJourneyFromStorage(vehicleId);

      // Try to save to API (best effort)
      try {
        await this.saveJourneyToAPI(journey);
      } catch (apiError) {
        console.warn('Failed to save journey to API, saved locally:', apiError.message);
      }

      console.log('✅ Enhanced journey tracking stopped:', journey.journey_id);
      return journey;

    } catch (error) {
      console.error('❌ Error stopping enhanced journey tracking:', error);
      throw error;
    }
  }

  // Rest of the methods remain the same...
  // (saveRouteHistory, loadRouteHistory, saveJourneyToAPI, etc.)
  
  saveRouteHistory() {
    try {
      localStorage.setItem('route_history', JSON.stringify(this.routeHistory));
    } catch (error) {
      console.error('❌ Error saving route history:', error);
    }
  }

  loadRouteHistory() {
    try {
      const history = localStorage.getItem('route_history');
      if (history) {
        this.routeHistory = JSON.parse(history);
      }
    } catch (error) {
      console.error('❌ Error loading route history:', error);
    }
  }

  saveJourneyToStorage(journey) {
    try {
      const activeJourneys = JSON.parse(localStorage.getItem('active_journeys') || '{}');
      activeJourneys[journey.vehicle_id] = journey;
      localStorage.setItem('active_journeys', JSON.stringify(activeJourneys));
    } catch (error) {
      console.error('❌ Error saving journey to storage:', error);
    }
  }

  removeJourneyFromStorage(vehicleId) {
    try {
      const activeJourneys = JSON.parse(localStorage.getItem('active_journeys') || '{}');
      delete activeJourneys[vehicleId];
      localStorage.setItem('active_journeys', JSON.stringify(activeJourneys));
    } catch (error) {
      console.error('❌ Error removing journey from storage:', error);
    }
  }

  loadActiveJourneys() {
    try {
      const activeJourneys = JSON.parse(localStorage.getItem('active_journeys') || '{}');
      
      Object.values(activeJourneys).forEach(journey => {
        this.activeJourneys.set(journey.vehicle_id, journey);
        
        if (journey.status === 'active') {
          this.startEnhancedTracking(journey.vehicle_id, journey.manager_id);
        }
      });
    } catch (error) {
      console.error('❌ Error loading active journeys:', error);
    }
  }

  async saveJourneyToAPI(journey) {
    try {
      const response = await fetch(`${this.apiBaseUrl}/journeys`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(journey)
      });

      if (!response.ok) {
        throw new Error(`API save failed: ${response.statusText}`);
      }
      
      console.log('✅ Journey saved successfully to API');
    } catch (error) {
      console.error('❌ Error saving journey to API:', error);
      throw error;
    }
  }

  detectStops(routePoints, minStopDuration = 300000) { // 5 minutes
    const stops = [];
    let stopStart = null;
    const speedThreshold = 2; // km/h

    for (let i = 0; i < routePoints.length; i++) {
      const point = routePoints[i];
      
      if ((point.speed || 0) <= speedThreshold) {
        if (!stopStart) {
          stopStart = i;
        }
      } else {
        if (stopStart !== null) {
          const stopEnd = i - 1;
          const duration = new Date(routePoints[stopEnd].timestamp).getTime() - 
                          new Date(routePoints[stopStart].timestamp).getTime();
          
          if (duration >= minStopDuration) {
            stops.push({
              start_time: routePoints[stopStart].timestamp,
              end_time: routePoints[stopEnd].timestamp,
              duration: duration,
              location: {
                latitude: routePoints[stopStart].latitude,
                longitude: routePoints[stopStart].longitude
              },
              address: routePoints[stopStart].address
            });
          }
          stopStart = null;
        }
      }
    }

    return stops;
  }

  notifyJourneyUpdate(vehicleId, journey) {
    const event = new CustomEvent('journeyUpdate', {
      detail: { vehicleId, journey }
    });
    window.dispatchEvent(event);
  }

  getActiveJourney(vehicleId) {
    return this.activeJourneys.get(vehicleId);
  }

  getAllActiveJourneys() {
    return Array.from(this.activeJourneys.values());
  }

  getJourneyHistory() {
    return this.routeHistory;
  }

  cleanup() {
    this.trackingIntervals.forEach(interval => clearInterval(interval));
    this.trackingIntervals.clear();
    
    this.activeJourneys.forEach(journey => {
      this.saveJourneyToStorage(journey);
    });
  }

  // Enhanced export functionality with data source information
  exportJourneyData(journeyId, format = 'json') {
    const journey = this.routeHistory.find(j => j.journey_id === journeyId) ||
                   Array.from(this.activeJourneys.values()).find(j => j.journey_id === journeyId);
    
    if (!journey) {
      throw new Error('Journey not found');
    }

    switch (format.toLowerCase()) {
      case 'json':
        return this.exportAsJSON(journey);
      case 'csv':
        return this.exportAsCSV(journey);
      case 'gpx':
        return this.exportAsGPX(journey);
      case 'enhanced':
        return this.exportAsEnhancedJSON(journey);
      default:
        throw new Error(`Unsupported export format: ${format}`);
    }
  }

  exportAsEnhancedJSON(journey) {
    const enhancedData = {
      ...journey,
      export_metadata: {
        exported_at: new Date().toISOString(),
        export_version: '2.0_enhanced',
        data_reliability: {
          total_points: journey.route_points.length,
          api_sourced_points: journey.route_points.filter(p => ['telemetry', 'device', 'vehicle'].includes(p.source)).length,
          estimated_points: journey.route_points.filter(p => p.source === 'estimated').length,
          fallback_mode_used: journey.fallback_mode,
          data_sources_used: journey.data_sources,
          api_success_rate: journey.summary?.api_success_rate || 0
        },
        quality_metrics: {
          distance_accuracy: journey.total_distance > 0 ? 'good' : 'poor',
          speed_data_available: journey.route_points.some(p => p.speed > 0),
          location_continuity: this.calculateLocationContinuity(journey.route_points),
          alerts_detected: journey.alerts.length
        }
      }
    };

    const blob = new Blob([JSON.stringify(enhancedData, null, 2)], { type: 'application/json' });
    this.downloadFile(
      blob, 
      `enhanced_journey_${journey.vehicle_info?.vehicle_number || journey.vehicle_id}_${this.formatDateForFilename(journey.start_time)}.json`
    );

    return enhancedData;
  }

  exportAsJSON(journey) {
    const data = JSON.stringify(journey, null, 2);
    const blob = new Blob([data], { type: 'application/json' });
    
    this.downloadFile(
      blob, 
      `journey_${journey.vehicle_info?.vehicle_number || journey.vehicle_id}_${this.formatDateForFilename(journey.start_time)}.json`
    );

    return data;
  }

  exportAsCSV(journey) {
    const headers = [
      'Timestamp', 'Latitude', 'Longitude', 'Speed_KMH', 'Heading_Deg', 
      'Accuracy_M', 'Altitude_M', 'Address', 'Distance_From_Previous_KM', 
      'Data_Source', 'Reliability'
    ];

    const rows = journey.route_points.map(point => [
      point.timestamp,
      point.latitude,
      point.longitude,
      point.speed || 0,
      point.heading || 0,
      point.accuracy || '',
      point.altitude || '',
      `"${point.address || ''}"`,
      point.distance_from_previous || 0,
      point.source || 'unknown',
      point.source === 'estimated' ? 'low' : 'high'
    ]);

    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv' });
    
    this.downloadFile(
      blob, 
      `journey_${journey.vehicle_info?.vehicle_number || journey.vehicle_id}_${this.formatDateForFilename(journey.start_time)}.csv`
    );

    return csvContent;
  }

  exportAsGPX(journey) {
    const gpxContent = `<?xml version="1.0" encoding="UTF-8"?>
<gpx version="1.1" creator="Enhanced Vehicle Route Tracker">
  <metadata>
    <name>Vehicle Route - ${journey.vehicle_info?.vehicle_number || journey.vehicle_id}</name>
    <desc>Enhanced Journey from ${journey.start_time} to ${journey.end_time || 'ongoing'}</desc>
    <time>${journey.start_time}</time>
    <keywords>vehicle,tracking,enhanced,${journey.data_sources?.join(',') || ''}</keywords>
  </metadata>
  <trk>
    <name>Vehicle Route</name>
    <desc>Total Distance: ${journey.total_distance.toFixed(2)} km, Max Speed: ${journey.max_speed.toFixed(0)} km/h, Data Sources: ${journey.data_sources?.join(', ') || 'unknown'}</desc>
    <trkseg>
${journey.route_points.map(point => `      <trkpt lat="${point.latitude}" lon="${point.longitude}">
        <time>${point.timestamp}</time>
        <speed>${(point.speed / 3.6).toFixed(2)}</speed>
        ${point.altitude ? `<ele>${point.altitude}</ele>` : ''}
        <extensions>
          <source>${point.source || 'unknown'}</source>
          <reliability>${point.source === 'estimated' ? 'low' : 'high'}</reliability>
        </extensions>
      </trkpt>`).join('\n')}
    </trkseg>
  </trk>
</gpx>`;

    const blob = new Blob([gpxContent], { type: 'application/gpx+xml' });
    
    this.downloadFile(
      blob, 
      `journey_${journey.vehicle_info?.vehicle_number || journey.vehicle_id}_${this.formatDateForFilename(journey.start_time)}.gpx`
    );

    return gpxContent;
  }

  calculateLocationContinuity(routePoints) {
    if (routePoints.length < 2) return 'insufficient_data';
    
    let continuousPoints = 0;
    let totalGaps = 0;

    for (let i = 1; i < routePoints.length; i++) {
      const timeDiff = new Date(routePoints[i].timestamp) - new Date(routePoints[i-1].timestamp);
      const distance = this.calculateDistance(
        routePoints[i-1].latitude, routePoints[i-1].longitude,
        routePoints[i].latitude, routePoints[i].longitude
      );

      // Check for reasonable continuity (not teleporting)
      if (timeDiff < 60000 && distance < 2) { // Less than 1 minute and 2km
        continuousPoints++;
      } else {
        totalGaps++;
      }
    }

    const continuityRatio = continuousPoints / (continuousPoints + totalGaps);
    
    if (continuityRatio > 0.8) return 'excellent';
    if (continuityRatio > 0.6) return 'good';
    if (continuityRatio > 0.4) return 'fair';
    return 'poor';
  }

  downloadFile(blob, filename) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  formatDateForFilename(dateString) {
    return new Date(dateString).toISOString().slice(0, 19).replace(/:/g, '-');
  }

  // Get system status for debugging
  getSystemStatus() {
    return {
      api_status: this.fallbackMode ? 'fallback' : 'normal',
      active_journeys: this.activeJourneys.size,
      tracking_intervals: this.trackingIntervals.size,
      history_count: this.routeHistory.length,
      cache_size: this.telemetryCache.size,
      websocket_status: 'checking', // This would be updated by WebSocket handler
      last_health_check: new Date().toISOString()
    };
  }
}

// Create enhanced singleton instance
const enhancedRouteTrackingService = new EnhancedRouteTrackingService();

// Load existing data on initialization
enhancedRouteTrackingService.loadRouteHistory();
enhancedRouteTrackingService.loadActiveJourneys();

// Cleanup on page unload
window.addEventListener('beforeunload', () => {
  enhancedRouteTrackingService.cleanup();
});

export default enhancedRouteTrackingService;