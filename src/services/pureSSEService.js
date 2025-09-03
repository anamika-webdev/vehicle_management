// Copy the entire Pure Event-Based SSE Service code from the first artifact
// Save this as: src/services/pureSSEService.js

class PureSSEService {
  constructor() {
    this.eventSource = null;
    this.subscribers = new Map();
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = 10;
    this.reconnectDelay = 2000;
    this.isConnected = false;
    this.lastEventId = null;
    this.connectionListeners = new Set();
    this.heartbeatTimeout = null;
    this.heartbeatInterval = 30000; // 30 seconds
    
    // Device state management
    this.deviceStates = new Map();
    this.lastEventTime = null;
    this.connectionStartTime = null;
    
    // SSE endpoint configurations
    this.sseEndpoints = [
      '/api/v1/events/stream',
      '/events/stream', 
      '/api/events',
      '/stream/telemetry',
      '/realtime/devices',
      '/sse/devices',
      '/live/events'
    ];
  }

  // Add connection state listener
  addConnectionListener(callback) {
    this.connectionListeners.add(callback);
    // Immediately notify of current state
    callback(this.getConnectionState());
  }

  removeConnectionListener(callback) {
    this.connectionListeners.delete(callback);
  }

  notifyConnectionListeners(state, data = {}) {
    const stateData = {
      state,
      timestamp: new Date().toISOString(),
      reconnectAttempts: this.reconnectAttempts,
      ...data
    };
    
    this.connectionListeners.forEach(callback => {
      try {
        callback(stateData);
      } catch (error) {
        console.error('❌ Error in connection listener:', error);
      }
    });
  }

  // Get current connection state
  getConnectionState() {
    return {
      isConnected: this.isConnected,
      state: this.isConnected ? 'connected' : 'disconnected',
      reconnectAttempts: this.reconnectAttempts,
      lastEventTime: this.lastEventTime,
      connectionStartTime: this.connectionStartTime,
      eventSourceReadyState: this.eventSource?.readyState,
      deviceCount: this.deviceStates.size
    };
  }

  // Connect to SSE endpoint
  async connect(apiBaseUrl = 'http://164.52.194.198:9090') {
    if (this.eventSource && this.isConnected) {
      console.log('📡 SSE already connected');
      return Promise.resolve();
    }

    console.log('🚀 Starting pure event-based connection...');
    this.notifyConnectionListeners('connecting');

    return new Promise((resolve, reject) => {
      this.attemptConnection(apiBaseUrl, 0, resolve, reject);
    });
  }

  // Basic implementation for now - you can expand this
  async attemptConnection(apiBaseUrl, endpointIndex, resolve, reject) {
    // For now, just simulate a connection
    setTimeout(() => {
      this.isConnected = false;
      this.notifyConnectionListeners('failed', { error: 'SSE server not available' });
      reject(new Error('SSE server not available'));
    }, 1000);
  }

  // Subscription management
  subscribe(eventType, callback) {
    if (!this.subscribers.has(eventType)) {
      this.subscribers.set(eventType, new Set());
    }
    this.subscribers.get(eventType).add(callback);

    console.log(`📝 Subscribed to ${eventType} events`);

    return () => {
      const eventSubscribers = this.subscribers.get(eventType);
      if (eventSubscribers) {
        eventSubscribers.delete(callback);
        if (eventSubscribers.size === 0) {
          this.subscribers.delete(eventType);
        }
      }
    };
  }

  notify(eventType, data) {
    const eventSubscribers = this.subscribers.get(eventType);
    if (eventSubscribers) {
      eventSubscribers.forEach(callback => {
        try {
          callback(data);
        } catch (error) {
          console.error(`❌ Error in ${eventType} subscriber:`, error);
        }
      });
    }
  }

  // Get device state
  getDeviceState(deviceId) {
    return this.deviceStates.get(deviceId);
  }

  getAllDeviceStates() {
    return Object.fromEntries(this.deviceStates);
  }

  // Connection management
  disconnect() {
    console.log('🔌 Disconnecting SSE...');
    
    if (this.eventSource) {
      this.eventSource.close();
      this.eventSource = null;
    }
    
    this.isConnected = false;
    this.notifyConnectionListeners('disconnected');
  }

  reconnect() {
    console.log('🔄 Manual SSE reconnection...');
    this.disconnect();
    this.reconnectAttempts = 0;
    return this.connect();
  }

  // Get connection status
  getConnectionStatus() {
    if (!this.eventSource) return 'disconnected';
    
    switch (this.eventSource.readyState) {
      case EventSource.CONNECTING:
        return 'connecting';
      case EventSource.OPEN:
        return 'connected';
      case EventSource.CLOSED:
        return 'disconnected';
      default:
        return 'unknown';
    }
  }

  // Statistics and diagnostics
  getStats() {
    return {
      isConnected: this.isConnected,
      connectionStatus: this.getConnectionStatus(),
      deviceCount: this.deviceStates.size,
      lastEventTime: this.lastEventTime,
      connectionStartTime: this.connectionStartTime,
      reconnectAttempts: this.reconnectAttempts,
      lastEventId: this.lastEventId,
      subscriberCount: Array.from(this.subscribers.values()).reduce((total, set) => total + set.size, 0),
      eventSourceReadyState: this.eventSource?.readyState
    };
  }
}

// Create singleton instance
const pureSSEService = new PureSSEService();

export default pureSSEService;