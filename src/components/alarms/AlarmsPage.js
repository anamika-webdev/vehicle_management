import React from 'react';
import { useData } from '../../contexts/DataContext';
import { useNotification } from '../../contexts/NotificationContext';
import DataTable from '../common/DataTable';

const AlarmsPage = () => {
  const { data, resolveAlarm, loading } = useData();
  const { showSuccess, showError } = useNotification();

  const handleResolveAlarm = async (alarmId) => {
    try {
      await resolveAlarm(alarmId);
      showSuccess('Success', 'Alarm resolved successfully');
    } catch (error) {
      showError('Error', `Failed to resolve alarm: ${error.message}`);
    }
  };

  // Prepare data for table
  const tableRows = data.alarms.map(alarm => ({
    ...alarm,
    resolved: alarm.resolved ? 'Yes' : 'No'
  }));

  return (
    <div className="space-y-6">
      <DataTable
        title="My Alarms"
        headers={['ID', 'Device ID', 'Time', 'Type', 'Description', 'Severity', 'Resolved']}
        rows={tableRows}
        loading={loading}
        emptyMessage="No alarms found."
      />
      
      {/* Critical alarms section */}
      <div className="p-6 border border-red-200 rounded-lg bg-red-50">
        <h3 className="mb-4 text-lg font-semibold text-red-800">Critical Alarms</h3>
        <div className="space-y-3">
          {data.alarms.filter(a => !a.resolved && a.severity === 'critical').map((alarm) => {
            const device = data.devices.find(d => d.device_id === alarm.device_id);
            const vehicle = data.vehicles.find(v => v.vehicle_id === device?.vehicle_id);
            
            return (
              <div key={alarm.alarm_id} className="flex items-center justify-between p-3 bg-white border border-red-200 rounded-lg">
                <div>
                  <p className="text-sm font-medium text-red-800">{alarm.alarm_type}</p>
                  <p className="text-xs text-gray-600">{alarm.description}</p>
                  <p className="text-xs text-gray-500">
                    Vehicle: {vehicle?.vehicle_number || 'N/A'} | Device: {device?.device_name || 'N/A'}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <span className="px-2 py-1 text-xs text-red-800 bg-red-100 rounded-full">
                    CRITICAL
                  </span>
                  <button
                    onClick={() => handleResolveAlarm(alarm.alarm_id)}
                    className="px-3 py-1 text-xs text-white bg-green-600 rounded hover:bg-green-700 disabled:opacity-50"
                    disabled={loading}
                  >
                    Resolve
                  </button>
                </div>
              </div>
            );
          })}
          {data.alarms.filter(a => !a.resolved && a.severity === 'critical').length === 0 && (
            <p className="text-center text-green-700">No critical alarms</p>
          )}
        </div>
      </div>

      {/* Alarm Statistics */}
      <div className="grid grid-cols-1 gap-6 md:grid-cols-4">
        <div className="p-4 bg-white rounded-lg shadow-md">
          <div className="text-center">
            <p className="text-2xl font-bold text-gray-900">{data.alarms.length}</p>
            <p className="text-sm text-gray-600">Total Alarms</p>
          </div>
        </div>
        <div className="p-4 bg-white rounded-lg shadow-md">
          <div className="text-center">
            <p className="text-2xl font-bold text-red-600">{data.alarms.filter(a => !a.resolved).length}</p>
            <p className="text-sm text-gray-600">Active Alarms</p>
          </div>
        </div>
        <div className="p-4 bg-white rounded-lg shadow-md">
          <div className="text-center">
            <p className="text-2xl font-bold text-red-800">{data.alarms.filter(a => !a.resolved && a.severity === 'critical').length}</p>
            <p className="text-sm text-gray-600">Critical Alarms</p>
          </div>
        </div>
        <div className="p-4 bg-white rounded-lg shadow-md">
          <div className="text-center">
            <p className="text-2xl font-bold text-green-600">{data.alarms.filter(a => a.resolved).length}</p>
            <p className="text-sm text-gray-600">Resolved Alarms</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AlarmsPage;