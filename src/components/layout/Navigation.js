import React from 'react';
import { Shield, Link, Car, Bell, Navigation as RouteIcon, MapPin, Settings } from 'lucide-react';
import { useData } from '../../contexts/DataContext';

const Navigation = ({ activeTab, onTabChange, setActiveTab }) => {
  const { data } = useData();

  // Use either onTabChange or setActiveTab (for backward compatibility)
  const handleTabChange = onTabChange || setActiveTab;

  // Safely get alarms count with fallback
  const getAlarmsCount = () => {
    try {
      const alarms = data?.alarms || data?.alerts || [];
      return alarms.filter(a => a && !a.resolved).length;
    } catch (error) {
      console.warn('Error counting alarms:', error);
      return 0;
    }
  };

  // Get vehicles with GPS data count
  const getVehiclesWithGPS = () => {
    try {
      const vehicles = data?.vehicles || [];
      return vehicles.filter(v => v.current_latitude && v.current_longitude).length;
    } catch (error) {
      console.warn('Error counting GPS vehicles:', error);
      return 0;
    }
  };

  // Get active journeys count
  const getActiveJourneysCount = () => {
    try {
      const activeJourneys = JSON.parse(localStorage.getItem('active_journeys') || '{}');
      return Object.keys(activeJourneys).length;
    } catch (error) {
      return 0;
    }
  };

  const navigationItems = [
    { id: 'overview', label: 'Overview', icon: Shield },
    { id: 'assign', label: 'Assign Devices', icon: Link },
    { id: 'devices', label: 'My Devices', icon: Shield },
    { id: 'alarms', label: 'Alarms', icon: Bell },
   // { id: 'route-tracker', label: 'Route Tracker', icon: RouteIcon },
   // { id: 'diagnostics', label: 'Diagnostics', icon: Settings },
  ];

  const unresolvedAlarmsCount = getAlarmsCount();
  const vehiclesWithGPS = getVehiclesWithGPS();
  const activeJourneysCount = getActiveJourneysCount();

  // Guard against missing handleTabChange
  if (!handleTabChange) {
    console.error('Navigation component requires either onTabChange or setActiveTab prop');
    return null;
  }

  return (
    <nav className="bg-white border-b">
      <div className="px-6">
        <div className="flex space-x-8">
          {navigationItems.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              onClick={() => handleTabChange(id)}
              className={`flex items-center gap-2 py-4 px-2 border-b-2 font-medium text-sm ${
                activeTab === id
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              <Icon className="w-4 h-4" />
              {label}
              
              {/* Show badge for alarms */}
             {/* {id === 'alarms' && unresolvedAlarmsCount > 0 && (
                <span className="px-2 py-1 ml-1 text-xs text-white bg-red-500 rounded-full">
                  {unresolvedAlarmsCount}
                </span>
              )}*/}
              
              {/* Show badge for live map */}
              {id === 'live-map' && vehiclesWithGPS > 0 && (
                <span className="px-2 py-1 ml-1 text-xs text-white bg-green-500 rounded-full">
                  {vehiclesWithGPS}
                </span>
              )}
              
              {/* Show badge for route tracker */}
              {id === 'route-tracker' && activeJourneysCount > 0 && (
                <span className="px-2 py-1 ml-1 text-xs text-white bg-blue-500 rounded-full">
                  {activeJourneysCount}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>
    </nav>
  );
};

export default Navigation;