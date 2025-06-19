import React from 'react';
import { Shield, Link, Car, Bell, Navigation as RouteIcon, MapPin, Settings } from 'lucide-react'; // Renamed Navigation to RouteIcon
import { useData } from '../../contexts/DataContext';

const Navigation = ({ activeTab, setActiveTab }) => {
  const { data } = useData();

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

  // Get active journeys count (you can implement this later when you have the service)
  const getActiveJourneysCount = () => {
    try {
      // This will work once you implement the route tracking service
      const activeJourneys = JSON.parse(localStorage.getItem('active_journeys') || '{}');
      return Object.keys(activeJourneys).length;
    } catch (error) {
      return 0;
    }
  };

  const navigationItems = [
    { id: 'overview', label: 'Overview', icon: Shield },
    { id: 'live-map', label: 'Live Map', icon: MapPin },
    { id: 'route-tracker', label: 'Route Tracker', icon: RouteIcon }, // Use RouteIcon instead of Navigation
    { id: 'assign', label: 'Assign Devices', icon: Link },
    { id: 'vehicles', label: 'My Vehicles', icon: Car },
    { id: 'devices', label: 'My Devices', icon: Shield },
    { id: 'alarms', label: 'Alarms', icon: Bell },
    { id: 'diagnostics', label: 'Diagnostics', icon: Settings },
    { id: 'error-diagnostic', label: 'Error Diagnostic', icon: Settings }
  ];

  const unresolvedAlarmsCount = getAlarmsCount();
  const vehiclesWithGPS = getVehiclesWithGPS();
  const activeJourneysCount = getActiveJourneysCount();

  return (
    <nav className="bg-white border-b">
      <div className="px-6">
        <div className="flex space-x-8">
          {navigationItems.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              onClick={() => setActiveTab(id)}
              className={`flex items-center gap-2 py-4 px-2 border-b-2 font-medium text-sm ${
                activeTab === id
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              <Icon className="w-4 h-4" />
              {label}
              {id === 'alarms' && unresolvedAlarmsCount > 0 && (
                <span className="px-2 py-1 ml-1 text-xs text-white bg-red-500 rounded-full">
                  {unresolvedAlarmsCount}
                </span>
              )}
              {id === 'live-map' && vehiclesWithGPS > 0 && (
                <span className="px-2 py-1 ml-1 text-xs text-white bg-green-500 rounded-full">
                  {vehiclesWithGPS}
                </span>
              )}
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