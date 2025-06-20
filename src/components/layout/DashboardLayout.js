// src/components/dashboard/Dashboard.js - Updated with Route Tracking Support
import React, { useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import LoginScreen from '../auth/LoginScreen';
import Header from '../layout/Header';
import Navigation from '../layout/Navigation';
import NotificationPanel from '../common/Notification';

// Page Components
import Overview from './Overview';
import VehiclesPage from '../vehicles/VehiclesPage';
import VehicleDetailsPage from '../vehicles/VehicleDetailsPage';
import DevicesPage from '../devices/DevicesPage';
import DeviceDetailsPage from '../devices/DeviceDetailsPage';
import AlarmsPage from '../alarms/AlarmsPage';
import DeviceAssignment from '../devices/DeviceAssignment';
import LeafletLiveMapPage from '../tracking/LeafletLiveMapPage';
import ApiOnlyRouteTracker from '../tracking/ApiOnlyRouteTracker';

// Import diagnostic components if they exist
let DeviceDataDiagnostic;
try {
  DeviceDataDiagnostic = require('../diagnostics/DeviceDataDiagnostic').default;
} catch {
  // Create a placeholder if the component doesn't exist
  DeviceDataDiagnostic = () => (
    <div className="p-6 bg-white rounded-lg shadow-md">
      <h3 className="mb-4 text-lg font-semibold">Diagnostics</h3>
      <p className="text-gray-600">Diagnostic tools are being loaded...</p>
    </div>
  );
}

const Dashboard = ({ onEnhancedTracking, systemHealth }) => {
  const { isLoggedIn } = useAuth();
  const [activeTab, setActiveTab] = useState('overview');
  const [selectedDeviceId, setSelectedDeviceId] = useState(null);
  const [selectedVehicleId, setSelectedVehicleId] = useState(null);

  // Navigation handlers
  const handleViewDevice = (deviceId) => {
    console.log('📱 Viewing device:', deviceId);
    setSelectedDeviceId(deviceId);
    setActiveTab('device-details');
  };

  const handleBackFromDeviceDetails = () => {
    setSelectedDeviceId(null);
    setActiveTab('devices');
  };

  const handleViewVehicle = (vehicleId) => {
    console.log('🚗 Viewing vehicle:', vehicleId);
    setSelectedVehicleId(vehicleId);
    setActiveTab('vehicle-details');
  };

  const handleBackFromVehicleDetails = () => {
    setSelectedVehicleId(null);
    setActiveTab('vehicles');
  };

  // ENHANCED TRACKING HANDLER - Pass down to components
  const handleApiTracking = (vehicle) => {
    console.log('📡 Dashboard: Enhanced tracking requested for:', vehicle);
    
    if (onEnhancedTracking && typeof onEnhancedTracking === 'function') {
      console.log('✅ Calling parent enhanced tracking function...');
      onEnhancedTracking(vehicle);
    } else {
      console.error('❌ onEnhancedTracking not available in Dashboard');
      console.log('Available props:', { onEnhancedTracking: typeof onEnhancedTracking });
    }
  };

  // Main content renderer
  const renderContent = () => {
    switch (activeTab) {
      case 'overview':
        return (
          <Overview 
            onViewVehicle={handleViewVehicle}
            onEnhancedTracking={handleApiTracking}
          />
        );
      
      case 'live-map':
        return (
          <LeafletLiveMapPage 
            onEnhancedTracking={handleApiTracking}
          />
        );
      
      case 'route-tracker':
        return <ApiOnlyRouteTracker />;
      
      case 'assign-devices':
        return <DeviceAssignment />;
      
      case 'vehicles':
        return (
          <VehiclesPage 
            onViewVehicle={handleViewVehicle}
            onEnhancedTracking={handleApiTracking}
          />
        );
      
      case 'vehicle-details':
        return (
          <VehicleDetailsPage 
            vehicleId={selectedVehicleId} 
            onBack={handleBackFromVehicleDetails}
            onEnhancedTracking={handleApiTracking}
          />
        );
      
      case 'devices':
        return (
          <DevicesPage 
            onViewDevice={handleViewDevice}
          />
        );
      
      case 'device-details':
        return (
          <DeviceDetailsPage 
            deviceId={selectedDeviceId} 
            onBack={handleBackFromDeviceDetails} 
          />
        );
      
      case 'alarms':
        return <AlarmsPage />;
      
      case 'diagnostics':
        return <DeviceDataDiagnostic />;
      
      default:
        return (
          <Overview 
            onViewVehicle={handleViewVehicle}
            onEnhancedTracking={handleApiTracking}
          />
        );
    }
  };

  // Show login screen if not authenticated
  if (!isLoggedIn) {
    return <LoginScreen />;
  }

  return (
    <div className="min-h-screen bg-gray-100">
      <NotificationPanel />
      
      {/* Header with system health if available */}
      {Header ? (
        <Header systemHealth={systemHealth} />
      ) : (
        <div className="bg-white border-b shadow-sm">
          <div className="px-4 mx-auto max-w-7xl sm:px-6 lg:px-8">
            <div className="flex items-center justify-between py-6">
              <h1 className="text-2xl font-bold text-gray-900">Vehicle Management Dashboard</h1>
              <div className="flex items-center space-x-2">
                <span className="text-sm text-gray-500">
                  API: {systemHealth?.api || 'Unknown'}
                </span>
              </div>
            </div>
          </div>
        </div>
      )}
      
      {/* Only show navigation if not viewing details pages */}
      {activeTab !== 'device-details' && activeTab !== 'vehicle-details' && Navigation && (
        <Navigation activeTab={activeTab} setActiveTab={setActiveTab} />
      )}
      
      <main className="p-6">
        <div className="mx-auto max-w-7xl">
          {renderContent()}
        </div>
      </main>
    </div>
  );
};

export default Dashboard;