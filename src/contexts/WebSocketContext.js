// src/contexts/WebSocketContext.js - Create this file to fix the import
import React, { createContext, useContext, useState, useEffect } from 'react';

const WebSocketContext = createContext();

export const WebSocketProvider = ({ children }) => {
  const [isConnected, setIsConnected] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState('disconnected');
  const [lastMessage, setLastMessage] = useState(null);

  // Simple mock WebSocket for development
  useEffect(() => {
    console.log('🔌 Initializing WebSocket context...');
    
    // Simulate connection after a delay
    const timer = setTimeout(() => {
      setIsConnected(true);
      setConnectionStatus('connected');
      console.log('✅ Mock WebSocket connected');
    }, 1000);

    // Simulate periodic messages
    const messageInterval = setInterval(() => {
      setLastMessage({
        type: 'heartbeat',
        timestamp: new Date().toISOString(),
        data: { status: 'active' }
      });
    }, 30000); // Every 30 seconds

    return () => {
      clearTimeout(timer);
      clearInterval(messageInterval);
    };
  }, []);

  const value = {
    isConnected,
    connectionStatus,
    lastMessage,
    connect: () => {
      console.log('WebSocket connect called');
      setIsConnected(true);
      setConnectionStatus('connected');
    },
    disconnect: () => {
      console.log('WebSocket disconnect called');
      setIsConnected(false);
      setConnectionStatus('disconnected');
    },
    sendMessage: (message) => {
      console.log('WebSocket sendMessage called:', message);
      return true;
    },
    subscribe: (eventType, callback) => {
      console.log('WebSocket subscribe called:', eventType);
      return () => console.log('WebSocket unsubscribe called:', eventType);
    }
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

export default WebSocketContext;