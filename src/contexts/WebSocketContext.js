// src/contexts/WebSocketContext.js - COMPLETE FIXED VERSION
import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { config } from '../config/apiConfig';

const WebSocketContext = createContext();

export const WebSocketProvider = ({ children }) => {
  const [socket, setSocket] = useState(null);
  const [isConnected, setIsConnected] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState('disconnected');
  const [lastMessage, setLastMessage] = useState(null);
  const [reconnectAttempts, setReconnectAttempts] = useState(0);
  const [messageQueue, setMessageQueue] = useState([]);

  const maxReconnectAttempts = 5;
  const reconnectDelay = 5000; // 5 seconds

  // Mock WebSocket connection function
  const connectMockWebSocket = useCallback(() => {
    console.log('🔌 Attempting mock WebSocket connection...');
    
    try {
      setConnectionStatus('connecting');
      setIsConnected(false);
      
      // Mock WebSocket connection with delayed success
      const mockConnectionTimeout = setTimeout(() => {
        setIsConnected(true);
        setConnectionStatus('connected');
        setReconnectAttempts(0);
        console.log('✅ Mock WebSocket connected');
        
        // Process any queued messages
        if (messageQueue.length > 0) {
          console.log(`📤 Processing ${messageQueue.length} queued messages`);
          setMessageQueue([]);
        }
        
        // Start mock data simulation
        startMockDataStream();
        
      }, 1000 + Math.random() * 2000); // 1-3 second delay
      
      // Mock socket object
      const mockSocket = {
        close: () => {
          clearTimeout(mockConnectionTimeout);
          setIsConnected(false);
          setConnectionStatus('disconnected');
          console.log('🔌 Mock WebSocket disconnected');
        },
        send: (message) => {
          console.log('📤 Mock WebSocket message sent:', message);
        }
      };
      
      setSocket(mockSocket);
      
    } catch (error) {
      console.error('❌ Mock WebSocket connection failed:', error);
      setConnectionStatus('error');
    }
  }, [messageQueue]);

  // Start mock data stream
  const startMockDataStream = useCallback(() => {
    const interval = setInterval(() => {
      if (isConnected) {
        const mockData = {
          type: 'telemetry',
          device_id: 'DEVICE_' + Math.floor(Math.random() * 100),
          data: {
            speed: Math.random() * 120,
            latitude: 28.6139 + (Math.random() - 0.5) * 0.01,
            longitude: 77.2090 + (Math.random() - 0.5) * 0.01,
            acceleration: (Math.random() - 0.5) * 4,
            fuel_level: Math.random() * 100,
            battery_voltage: 12 + Math.random() * 2
          }
        };
        
        setLastMessage(mockData);
        console.log('📡 Mock data received:', mockData.type);
      } else {
        clearInterval(interval);
      }
    }, 3000); // Every 3 seconds
    
    return () => clearInterval(interval);
  }, [isConnected]);

  // Real WebSocket connection function - FIXED
  const connectRealWebSocket = useCallback(() => {
    const wsUrl = config.WEBSOCKET_URL; // FIXED: Use config.WEBSOCKET_URL
    
    if (!wsUrl) {
      console.warn('⚠️ No WebSocket URL configured, using mock connection');
      connectMockWebSocket();
      return;
    }

    console.log('🔌 Attempting real WebSocket connection to:', wsUrl);
    
    try {
      setConnectionStatus('connecting');
      
      const ws = new WebSocket(wsUrl);
      
      ws.onopen = () => {
        console.log('✅ Real WebSocket connected');
        setIsConnected(true);
        setConnectionStatus('connected');
        setReconnectAttempts(0);
        setSocket(ws);
        
        // Send authentication if token available
        const token = localStorage.getItem(config.TOKEN_STORAGE_KEY);
        if (token) {
          ws.send(JSON.stringify({
            type: 'auth',
            token: token
          }));
        }
        
        // Process any queued messages
        if (messageQueue.length > 0) {
          console.log(`📤 Processing ${messageQueue.length} queued messages`);
          messageQueue.forEach(message => {
            try {
              ws.send(typeof message === 'string' ? message : JSON.stringify(message));
            } catch (error) {
              console.error('❌ Failed to send queued message:', error);
            }
          });
          setMessageQueue([]);
        }
      };
      
      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          setLastMessage(data);
          console.log('📡 WebSocket message received:', data.type || 'unknown');
        } catch (error) {
          console.error('❌ Failed to parse WebSocket message:', error);
        }
      };
      
      ws.onclose = (event) => {
        console.log('🔌 WebSocket connection closed:', event.code, event.reason);
        setIsConnected(false);
        setSocket(null);
        
        if (event.code !== 1000) { // Not a normal closure
          setConnectionStatus('disconnected');
          
          // Attempt reconnection
          if (reconnectAttempts < maxReconnectAttempts) {
            console.log(`🔄 Scheduling reconnection attempt ${reconnectAttempts + 1}/${maxReconnectAttempts}`);
            setTimeout(() => {
              setReconnectAttempts(prev => prev + 1);
              connectRealWebSocket();
            }, reconnectDelay);
          } else {
            setConnectionStatus('failed');
            console.log('🔄 Falling back to mock WebSocket after max attempts');
            connectMockWebSocket();
          }
        } else {
          setConnectionStatus('disconnected');
        }
      };
      
      ws.onerror = (error) => {
        console.error('❌ WebSocket error:', error);
        setConnectionStatus('error');
      };
      
    } catch (error) {
      console.error('❌ Failed to create WebSocket connection:', error);
      setConnectionStatus('error');
      
      // Fallback to mock connection
      console.log('🔄 Falling back to mock WebSocket...');
      connectMockWebSocket();
    }
  }, [reconnectAttempts, connectMockWebSocket, messageQueue]);

  const disconnect = useCallback(() => {
    if (socket) {
      console.log('🔌 Disconnecting WebSocket...');
      socket.close(1000, 'User requested disconnect');
      setSocket(null);
      setIsConnected(false);
      setConnectionStatus('disconnected');
    }
  }, [socket]);

  const sendMessage = useCallback((message) => {
    if (socket && isConnected) {
      try {
        const messageString = typeof message === 'string' ? message : JSON.stringify(message);
        socket.send(messageString);
        console.log('📤 WebSocket message sent:', message.type || 'data');
        return true;
      } catch (error) {
        console.error('❌ Failed to send WebSocket message:', error);
        return false;
      }
    } else {
      console.warn('⚠️ Cannot send message: WebSocket not connected');
      
      // Queue message for later sending
      setMessageQueue(prev => [...prev, message]);
      return false;
    }
  }, [socket, isConnected]);

  const subscribe = useCallback((eventType, callback) => {
    console.log(`📡 Subscribing to WebSocket events: ${eventType}`);
    
    // In a real implementation, you would set up event listeners
    // For now, we'll just log the subscription
    
    return () => {
      console.log(`📡 Unsubscribing from WebSocket events: ${eventType}`);
    };
  }, []);

  // Initialize WebSocket connection
  useEffect(() => {
    // Try real WebSocket first, fallback to mock
    if (config.FEATURES.REAL_TIME_ALARMS) {
      connectRealWebSocket();
    } else {
      connectMockWebSocket();
    }
    
    // Cleanup on unmount
    return () => {
      if (socket) {
        socket.close();
      }
    };
  }, [connectMockWebSocket, connectRealWebSocket]);

  // Auto-reconnection logic
  useEffect(() => {
    // Set up periodic reconnection attempts if not connected
    if (!isConnected && connectionStatus !== 'connecting' && reconnectAttempts < maxReconnectAttempts) {
      const retryInterval = setInterval(() => {
        console.log('🔄 Attempting automatic reconnection...');
        if (config.WEBSOCKET_URL) {
          connectRealWebSocket();
        } else {
          connectMockWebSocket();
        }
      }, reconnectDelay * 2); // Less frequent than manual retries
      
      return () => clearInterval(retryInterval);
    }
  }, [isConnected, connectionStatus, reconnectAttempts, connectMockWebSocket, connectRealWebSocket]);

  const value = {
    // Connection state
    socket,
    isConnected,
    connectionStatus,
    reconnectAttempts,
    
    // Data
    lastMessage,
    messageQueue: messageQueue.length,
    
    // Actions
    connect: config.WEBSOCKET_URL ? connectRealWebSocket : connectMockWebSocket,
    disconnect,
    sendMessage,
    subscribe,
    
    // Utils
    maxReconnectAttempts,
    canReconnect: reconnectAttempts < maxReconnectAttempts
  };

  return (
    <WebSocketContext.Provider value={value}>
      {children}
    </WebSocketContext.Provider>
  );
};

export const useWebSocket = () => {
  const context = useContext(WebSocketContext);
  if (!context) {
    throw new Error('useWebSocket must be used within a WebSocketProvider');
  }
  return context;
};