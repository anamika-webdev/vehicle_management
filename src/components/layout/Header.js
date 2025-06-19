import React, { useState } from 'react';
import { User, Search, RefreshCw, LogOut, Wifi, WifiOff } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { useData } from '../../contexts/DataContext';
import { useWebSocket } from '../../contexts/WebSocketContext';

const Header = () => {
  const { currentUser, logout } = useAuth();
  const { fetchData, loading, error } = useData();
  const { isConnected } = useWebSocket();
  const [searchTerm, setSearchTerm] = useState('');

  const ConnectionStatus = () => (
    <div className="flex items-center gap-2">
      {isConnected ? (
        <>
          <Wifi className="w-4 h-4 text-green-600" />
          <span className="text-xs text-green-600">Live</span>
        </>
      ) : (
        <>
          <WifiOff className="w-4 h-4 text-red-600" />
          <span className="text-xs text-red-600">Offline</span>
        </>
      )}
    </div>
  );

  return (
    <header className="bg-white border-b shadow-sm">
      <div className="px-6 py-4">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold text-gray-900">Vehicle Management Dashboard</h1>
          <div className="flex items-center gap-4">
            <ConnectionStatus />
            <div className="flex items-center gap-3 text-sm text-gray-600">
              <User className="w-4 h-4" />
              <span>Welcome, {currentUser?.name}</span>
            </div>
            <div className="relative">
              <Search className="absolute w-4 h-4 text-gray-400 transform -translate-y-1/2 left-3 top-1/2" />
              <input
                type="text"
                placeholder="Search..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="py-2 pl-10 pr-4 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
            <button
              onClick={fetchData}
              className="p-2 text-gray-600 hover:text-gray-900"
              title="Refresh"
              disabled={loading}
            >
              <RefreshCw className={`w-5 h-5 ${loading ? 'animate-spin' : ''}`} />
            </button>
            <button
              onClick={logout}
              className="p-2 text-gray-600 hover:text-gray-900"
              title="Logout"
            >
              <LogOut className="w-5 h-5" />
            </button>
          </div>
        </div>
        
        {error && (
          <div className="p-3 mt-2 text-sm text-yellow-700 bg-yellow-100 border border-yellow-400 rounded-lg">
            ⚠️ {error}
          </div>
        )}
      </div>
    </header>
  );
};

export default Header;