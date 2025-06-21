// Updated Dashboard.js - API-Only Components
// File: src/components/dashboard/Dashboard.js

import React, { useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import LoginScreen from '../auth/LoginScreen';
import Header from '../layout/Header';
import Navigation from '../layout/Navigation';
import Overview from './Overview';
import VehicleDetailsPage from '../vehicles/VehicleDetailsPage';
import DevicesPage from '../devices/DevicesPage';
import DeviceDetailsPage from '../devices/DeviceDetailsPage';
import DeviceAssignment from '../devices/DeviceAssignment';
//import NotificationPanel from '../common/Notification';
import LeafletLiveMapPage from '../tracking/LeafletLiveMapPage';
import ApiDiagnosticTool from '../diagnostics/ApiDiagnosticTool';
import SimpleErrorBoundary from '../common/SimpleErrorBoundary';
import ErrorDiagnostic from '../diagnostics/ErrorDiagnostic';
import EnhancedAlarmManagement from '../alarms/EnhancedAlarmManagement';
import EnhancedLiveAlarmManagement from '../alarms/EnhancedLiveAlarmManagement';

// Import API-Only components
import ApiOnlyRouteTracker from '../tracking/ApiOnlyRouteTracker';
import ApiOnlyEnhancedVehicleTrackingModal from '../tracking/ApiOnlyEnhancedVehicleTrackingModal';

const Dashboard = () => {
  const { isLoggedIn } = useAuth();
  const [activeTab, setActiveTab] = useState('overview');
  const [selectedDeviceId, setSelectedDeviceId] = useState(null);
  const [selectedVehicleId, setSelectedVehicleId] = useState(null);
  
  // API-Only tracking modal state
  const [showApiTracking, setShowApiTracking] = useState(false);
  const [selectedTrackingVehicle, setSelectedTrackingVehicle] = useState(null);

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
    setActiveTab('vehicles');
  };

  // API-Only tracking handler
  const handleApiTracking = (vehicle) => {
    setSelectedTrackingVehicle(vehicle);
    setShowApiTracking(true);
  };

  // Handle vehicle selection from Live Map
  const handleMapVehicleSelect = (vehicle) => {
    setSelectedVehicleId(vehicle.vehicle_id);
    setActiveTab('vehicle-details');
  };

  const renderContent = () => {
    switch (activeTab) {
      case 'overview':
        return <Overview onViewVehicle={handleViewVehicle} />;
      case 'live-map':
        return <LeafletLiveMapPage />;
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
  return <EnhancedLiveAlarmManagement />;
      case 'device-details':
        return (
          <DeviceDetailsPage 
            deviceId={selectedDeviceId} 
            onBack={handleBackFromDeviceDetails} 
          />
        );
        case 'alarms':
  return <EnhancedAlarmManagement />;
  
      default:
        return <Overview onViewVehicle={handleViewVehicle} />;
    }
  };

  if (!isLoggedIn) {
    return <LoginScreen />;
  }

  return (
    <div className="min-h-screen bg-gray-100">
      
      <Header />
      {/* Only show navigation if not viewing details pages */}
      {activeTab !== 'device-details' && activeTab !== 'vehicle-details' && (
        <Navigation activeTab={activeTab} setActiveTab={setActiveTab} />
      )}
      <main className="p-6">
        {renderContent()}
      </main>
      
      {/* API-Only Vehicle Tracking Modal */}
      {showApiTracking && (
        <ApiOnlyEnhancedVehicleTrackingModal
          isOpen={showApiTracking}
          onClose={() => setShowApiTracking(false)}
          vehicle={selectedTrackingVehicle}
        />
      )}
    </div>
  );
};

export default Dashboard;