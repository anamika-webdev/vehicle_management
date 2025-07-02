// OverviewWithSSE.js
import React, { useEffect, useState, useRef } from 'react';
import {
  Car, Shield, Gauge, AlertTriangle, Activity, MapPin, CheckCircle, RefreshCw, Wifi
} from 'lucide-react';

const Overview = () => {
  const [devices, setDevices] = useState([]);
  const [vehicles, setVehicles] = useState([]);
  const [alerts, setAlerts] = useState([]);
  const [loading, setLoading] = useState(true);
  const eventSourceRef = useRef(null);

  const token = localStorage.getItem('authToken');

  const headers = {
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json'
  };

  useEffect(() => {
    // Initial vehicle fetch
    fetch('http://164.52.194.198:9090/vehicle/v1/all?page=0&size=100', { headers })
      .then(res => res.json())
      .then(data => setVehicles(data.data || []));

    // Initial alert fetch
    fetch('http://164.52.194.198:9090/alarm/v1/manager/all?page=0&size=50', { headers })
      .then(res => res.json())
      .then(data => setAlerts(data.data || []));

    // Setup SSE for devices
    eventSourceRef.current = new EventSource(`http://164.52.194.198:9090/device/stream?token=${token}`);

    eventSourceRef.current.onmessage = (event) => {
      try {
        const parsedData = JSON.parse(event.data);

        if (parsedData.device_id) {
          setDevices((prev) => {
            const existing = prev.find(d => d.device_id === parsedData.device_id);
            if (existing) {
              return prev.map(d => d.device_id === parsedData.device_id ? { ...d, ...parsedData } : d);
            }
            return [...prev, parsedData];
          });
        }
      } catch (err) {
        console.warn('SSE JSON Parse Error:', err);
      }
    };

    eventSourceRef.current.onerror = (err) => {
      console.error('SSE connection error:', err);
    };

    setLoading(false);

    return () => {
      if (eventSourceRef.current) eventSourceRef.current.close();
    };
  }, []);

  const stats = {
    totalVehicles: vehicles.length,
    totalDevices: devices.length,
    activeDevices: devices.filter(d => (d.status || '').toLowerCase() === 'active').length,
    devicesWithLocation: devices.filter(d => d.latitude && d.longitude).length,
    activeAlerts: alerts.filter(a => a.status === 'active' || !a.status).length
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <RefreshCw className="w-12 h-12 text-blue-600 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard Icon={Car} label="Total Vehicles" value={stats.totalVehicles} color="text-blue-600" />
        <StatCard Icon={Shield} label="Total Devices" value={stats.totalDevices} color="text-green-600" />
        <StatCard Icon={Gauge} label="With Location" value={stats.devicesWithLocation} color="text-purple-600" />
        <StatCard Icon={AlertTriangle} label="Active Alerts" value={stats.activeAlerts} color="text-red-600" />
      </div>

      <div className="overflow-hidden bg-white shadow sm:rounded-md">
        <div className="flex items-center justify-between px-4 py-5 sm:px-6">
          <div>
            <h3 className="text-lg font-medium text-gray-900">Device Status & Location</h3>
          </div>
          <Activity className="w-5 h-5 text-gray-400" />
        </div>

        {devices.length === 0 ? (
          <div className="px-6 py-10 text-center text-gray-500">
            <Shield className="w-12 h-12 mx-auto mb-4 text-gray-300" />
            <h3 className="mb-2 text-lg font-medium text-gray-900">No Active Devices</h3>
            <p>No devices are currently reporting live data.</p>
          </div>
        ) : (
          <ul className="divide-y divide-gray-200">
            {devices.map(device => (
              <li key={device.device_id} className="px-4 py-6 sm:px-6">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-lg font-medium text-gray-900">
                      {device.device_name || `Device ${device.device_id}`}
                    </div>
                    <div className="text-sm text-gray-500">
                      ID: {device.device_id} • Type: {device.device_type || 'Unknown'}
                    </div>
                    <div className="text-sm text-green-600">
                      📍 {device.latitude?.toFixed(4)}, {device.longitude?.toFixed(4)}
                    </div>
                  </div>

                  <div className="text-right">
                    <div className="text-sm font-medium text-gray-900">Status</div>
                    <div className="mt-1">
                     {device.latitude && device.longitude ? (
  <span className="inline-flex items-center px-3 py-1 text-sm font-medium text-green-800 bg-green-100 rounded-full">
    ✅ Live
  </span>
) : (
  <span className="inline-flex items-center px-3 py-1 text-sm font-medium text-gray-800 bg-gray-100 rounded-full">
    ❌ No Data
  </span>
)}

                    </div>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
};

const StatCard = ({ Icon, label, value, color }) => (
  <div className="overflow-hidden bg-white rounded-lg shadow">
    <div className="flex items-center p-5">
      <Icon className={`w-8 h-8 ${color}`} />
      <div className="ml-5">
        <dt className="text-sm font-medium text-gray-500 truncate">{label}</dt>
        <dd className="text-2xl font-bold text-gray-900">{value}</dd>
      </div>
    </div>
  </div>
);

export default Overview;
