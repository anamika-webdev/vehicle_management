// src/components/devices/DeviceAssignment.js - Fixed Status & Alarms Logic with Original UI
// ONLY fixes the status and alarms calculation logic - UI remains exactly the same

import React, { useState, useEffect } from 'react';
import { Plus, Car, Smartphone, AlertTriangle, CheckCircle, X, Clock, Zap, Shield, Trash2 } from 'lucide-react';
import { useData } from '../../contexts/DataContext';
import { useNotification } from '../notifications/RealTimeNotificationSystem';
import apiService from '../../services/api';

const DeviceAssignment = () => {
  const { data, loading, refreshData } = useData();
  const { showSuccess, showError } = useNotification();
  const [assignmentLoading, setAssignmentLoading] = useState({});
  const [confirmUnassign, setConfirmUnassign] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [modalType, setModalType] = useState('add');
  const [selectedVehicle, setSelectedVehicle] = useState(null);

  // FIXED: Simplified function focusing only on alarms from correct API endpoint
  const getVehicleWithStatus = (vehicle) => {
    console.log('🔍 Processing vehicle alarms for:', vehicle.vehicle_number || vehicle.vehicleNumber || vehicle.vehicle_id);
    
    // Get all devices assigned to this vehicle
    const assignedDevices = data.devices.filter(d => {
      const deviceVehicleId = d.vehicle_id || d.vehicleId;
      const vehicleId = vehicle.vehicle_id || vehicle.vehicleId;
      
      if (!deviceVehicleId || !vehicleId) return false;
      return deviceVehicleId.toString() === vehicleId.toString();
    });

    // Process alarms from /alarm/v1/manager/all API endpoint
    const alertsData = data.alerts || [];
    console.log('🔍 Processing alarms from API:', alertsData.length, 'total alarms');
    
    // Get alarms for this vehicle's devices from manager/all endpoint
    const vehicleAlarms = alertsData.filter(alarm => {
      if (!alarm) return false;
      
      // Handle alarm data structure from /alarm/v1/manager/all
      const alarmDeviceId = alarm.deviceId || alarm.device_id || alarm.device;
      if (!alarmDeviceId) return false;
      
      // Check if alarm belongs to any device assigned to this vehicle
      const belongsToVehicle = assignedDevices.some(device => {
        const deviceId = device.device_id || device.deviceId || device.id;
        return deviceId && alarmDeviceId.toString() === deviceId.toString();
      });
      
      if (belongsToVehicle) {
        console.log('🔍 Found vehicle alarm:', {
          alarmId: alarm.alarmId || alarm.id,
          deviceId: alarmDeviceId,
          alarmType: alarm.alarmType || alarm.type,
          status: alarm.status,
          resolved: alarm.resolved
        });
      }
      
      return belongsToVehicle;
    });

    // Count unresolved alarms based on API data structure
    const unresolvedAlarms = vehicleAlarms.filter(alarm => {
      // Based on /alarm/v1/manager/all API response structure
      const isResolved = alarm.resolved === true || 
                        alarm.resolved === 'true' ||
                        alarm.status === 'resolved' || 
                        alarm.status === 'RESOLVED';
      
      return !isResolved;
    });

    const result = {
      ...vehicle,
      deviceCount: assignedDevices.length,
      alarmCount: unresolvedAlarms.length,
      hasDevices: assignedDevices.length > 0
    };
    
    console.log('🔍 Final vehicle alarm calculation:', {
      vehicle_id: vehicle.vehicle_id,
      vehicle_number: vehicle.vehicle_number || vehicle.vehicleNumber,
      assignedDevices: assignedDevices.length,
      totalAlarms: vehicleAlarms.length,
      unresolvedAlarms: unresolvedAlarms.length
    });

    return result;
  };

  // Enhanced device assignment handler with better field handling
  const handleDeviceAssignment = async (deviceId, action, vehicleId = null) => {
    console.log('🔗 Device assignment requested:', { deviceId, action, vehicleId });
    
    setAssignmentLoading(prev => ({ ...prev, [deviceId]: true }));
    
    try {
      let response;
      
      if (action === 'assign' && vehicleId) {
        console.log(`🔗 Assigning device ${deviceId} to vehicle ${vehicleId}`);
        response = await apiService.assignDeviceToVehicle(deviceId, vehicleId);
      } else if (action === 'unassign') {
        console.log(`🔗 Unassigning device ${deviceId}`);
        response = await apiService.unassignDeviceFromVehicle(deviceId);
      } else if (action !== 'assign' && action !== 'unassign') {
        // Handle dropdown selection for assignment (action is vehicleId)
        console.log(`🔗 Assigning device ${deviceId} to vehicle ${action} (from dropdown)`);
        response = await apiService.assignDeviceToVehicle(deviceId, action);
      }

      if (response && response.success) {
        console.log('✅ Assignment successful, refreshing data...');
        await refreshData();
        showSuccess(
          'Assignment Updated',
          action === 'unassign' 
            ? 'Device unassigned successfully' 
            : 'Device assigned successfully'
        );
        setConfirmUnassign(null);
      } else {
        throw new Error(response?.message || 'Assignment operation failed');
      }
    } catch (error) {
      console.error('❌ Device assignment error:', error);
      showError('Error', `Failed to update device assignment: ${error.message}`);
    } finally {
      setAssignmentLoading(prev => ({ ...prev, [deviceId]: false }));
    }
  };

  // Handle unassign with confirmation
  const handleUnassignClick = (deviceId) => {
    setConfirmUnassign(deviceId);
  };

  const handleConfirmUnassign = async (deviceId) => {
    await handleDeviceAssignment(deviceId, 'unassign');
  };

  const handleCancelUnassign = () => {
    setConfirmUnassign(null);
  };

  // Modal handlers (keeping original structure)
  const handleAdd = () => {
    setModalType('add');
    setSelectedVehicle(null);
    setShowModal(true);
  };

  const handleSubmit = async (vehicleData) => {
    // Implementation for vehicle add/edit
    console.log('Vehicle submit:', vehicleData);
    setShowModal(false);
  };

  const handleCancel = () => {
    setShowModal(false);
    setSelectedVehicle(null);
  };

  // ORIGINAL VehicleCard component - UI unchanged, only using fixed getVehicleWithStatus
  const VehicleCard = ({ vehicle }) => {
    const vehicleWithStatus = getVehicleWithStatus(vehicle);
    
    return (
      <div className="p-6 transition-shadow bg-white border rounded-lg shadow-md hover:shadow-lg">
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center space-x-3">
            <div className={`w-12 h-12 rounded-lg flex items-center justify-center ${
              vehicleWithStatus.hasDevices ? 'bg-blue-100' : 'bg-gray-100'
            }`}>
              <div className={`w-3 h-3 rounded-full ${
                vehicleWithStatus.hasDevices ? 'bg-blue-500' : 'bg-gray-400'
              }`}></div>
            </div>
            <div>
              <h3 className="text-lg font-semibold text-gray-900">{vehicle.vehicle_number}</h3>
              <p className="text-sm text-gray-600">{vehicle.manufacturer} {vehicle.model}</p>
              <p className="text-xs text-gray-500">{vehicle.vehicle_type}</p>
            </div>
          </div>
          <span className={`px-3 py-1 text-sm rounded-full ${
            vehicleWithStatus.hasDevices ? 'bg-blue-100 text-blue-800' : 'bg-gray-100 text-gray-800'
          }`}>
            {vehicleWithStatus.hasDevices ? 'Assigned' : 'No Devices'}
          </span>
        </div>

        <div className="grid grid-cols-3 gap-4 mb-4">
          <div className="text-center">
            <div className="text-lg font-bold text-blue-900">{vehicleWithStatus.deviceCount}</div>
            <div className="text-xs text-blue-600">Devices</div>
          </div>
          <div className="text-center">
            <div className="text-lg font-bold text-green-900">{vehicleWithStatus.activeDeviceCount}</div>
            <div className="text-xs text-green-600">Active</div>
          </div>
          <div className="text-center">
            <div className="text-lg font-bold text-red-900">{vehicleWithStatus.alarmCount}</div>
            <div className="text-xs text-red-600">Alarms</div>
          </div>
        </div>

        {vehicleWithStatus.criticalAlarmCount > 0 && (
          <div className="p-3 mb-4 border border-red-200 rounded bg-red-50">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse"></div>
              <span className="text-sm font-medium text-red-800">
                {vehicleWithStatus.criticalAlarmCount} Critical Alert{vehicleWithStatus.criticalAlarmCount > 1 ? 's' : ''}
              </span>
            </div>
          </div>
        )}

        <div className="flex items-center justify-between pt-4 border-t border-gray-200">
          <div className="flex items-center space-x-2">
            <div className={`w-2 h-2 rounded-full ${vehicleWithStatus.hasDevices ? 'bg-blue-500' : 'bg-gray-300'}`}></div>
            <span className="text-sm text-gray-600">
              {vehicleWithStatus.hasDevices ? `${vehicleWithStatus.deviceCount} Device${vehicleWithStatus.deviceCount > 1 ? 's' : ''}` : 'No Devices'}
            </span>
          </div>
          <span className="text-xs text-gray-500">
            {vehicle.vehicle_type || 'N/A'}
          </span>
        </div>
      </div>
    );
  };

  // ORIGINAL VehicleDataTable component - UI unchanged, enhanced data processing with debugging
  const VehicleDataTable = () => {
    console.log('🔍 VehicleDataTable rendering with data:', {
      vehicles: data.vehicles.length,
      devices: data.devices.length,
      alerts: data.alerts.length,
      alarms: data.alarms?.length || 0
    });
    
    // Log sample data for debugging
    if (data.vehicles.length > 0) {
      console.log('🔍 Sample vehicle data:', data.vehicles[0]);
    }
    if (data.devices.length > 0) {
      console.log('🔍 Sample device data:', data.devices[0]);
    }
    if (data.alerts.length > 0) {
      console.log('🔍 Sample alert data:', data.alerts[0]);
    }
    
    // FIXED: Enhanced mapping of API fields to display fields with proper fallbacks
    const tableRows = data.vehicles.map((vehicle, index) => {
      console.log(`🔍 Processing vehicle ${index + 1}:`, vehicle);
      
      const vehicleWithStatus = getVehicleWithStatus(vehicle);
      console.log(`🔍 Vehicle ${index + 1} status result:`, vehicleWithStatus);
      
      // Enhanced field mapping to handle different API response formats
      const getFieldValue = (vehicle, primaryField, fallbackFields = [], defaultValue = 'N/A') => {
        // Check primary field first
        if (vehicle[primaryField] && vehicle[primaryField] !== null && vehicle[primaryField] !== '') {
          return vehicle[primaryField];
        }
        
        // Check fallback fields
        for (const fallback of fallbackFields) {
          if (vehicle[fallback] && vehicle[fallback] !== null && vehicle[fallback] !== '') {
            return vehicle[fallback];
          }
        }
        
        return defaultValue;
      };

      const row = {
        vehicle_id: vehicle.vehicle_id,
        vehicle_number: getFieldValue(vehicle, 'vehicle_number', ['vehicleNumber', 'license_plate', 'plateNumber']),
        manufacturer: getFieldValue(vehicle, 'manufacturer', ['vehicleManufacturer', 'make', 'brand']),
        model: getFieldValue(vehicle, 'model', ['vehicle_model', 'vehicleModel', 'vehicleName']),
        vehicle_type: getFieldValue(vehicle, 'vehicle_type', ['vehicleType', 'type', 'category']),
        devices: vehicleWithStatus.deviceCount,
        alarms: vehicleWithStatus.alarmCount
      };
      
      console.log(`🔍 Final table row for vehicle ${index + 1}:`, row);
      return row;
    });

    console.log('🔍 All processed table rows:', tableRows);

    return (
      <div className="p-6 bg-white rounded-lg shadow-md">
        <div className="p-6 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold text-gray-900">Vehicle Fleet Management</h3>
            <button
              onClick={handleAdd}
              className="flex items-center gap-2 px-4 py-2 text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50"
              disabled={loading}
            >
              <Plus className="w-4 h-4" />
              Add Vehicle
            </button>
          </div>
        </div>
        
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                {['Vehicle Number', 'Manufacturer', 'Model', 'Type', 'Devices', 'Alarms', 'Actions'].map((header, index) => (
                  <th key={index} className="px-6 py-3 text-xs font-medium tracking-wider text-left text-gray-500 uppercase">
                    {header}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {tableRows.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-6 py-8 text-center text-gray-500">
                    {loading ? 'Loading vehicles...' : 'No vehicles found. Add your first vehicle to get started.'}
                  </td>
                </tr>
              ) : (
                tableRows.map((row, index) => {
                  const vehicle = data.vehicles.find(v => v.vehicle_id === row.vehicle_id);
                  const vehicleWithStatus = getVehicleWithStatus(vehicle);
                  
                  return (
                    <tr key={index} className="hover:bg-gray-50">
                      <td className="px-6 py-4 text-sm font-medium text-gray-900 whitespace-nowrap">{row.vehicle_number}</td>
                      <td className="px-6 py-4 text-sm text-gray-900 whitespace-nowrap">{row.manufacturer}</td>
                      <td className="px-6 py-4 text-sm text-gray-900 whitespace-nowrap">{row.model}</td>
                      <td className="px-6 py-4 text-sm text-gray-900 whitespace-nowrap">{row.vehicle_type}</td>
                      <td className="px-6 py-4 text-sm text-gray-900 whitespace-nowrap">{row.devices}</td>
                      <td className="px-6 py-4 text-sm whitespace-nowrap">
                        <span className={`${row.alarms > 0 ? 'text-red-600 font-medium' : 'text-gray-600'}`}>
                          {row.alarms > 0 ? `${row.alarms} alarms` : 'No alarms'}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-sm font-medium whitespace-nowrap">
                        <div className="flex space-x-2">
                          <button className="text-indigo-600 hover:text-indigo-900">
                            Edit
                          </button>
                          <button 
                            className="text-red-600 hover:text-red-900"
                            title="Delete Vehicle"
                            disabled={loading}
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    );
  };

  // ORIGINAL DeviceAssignmentSection component - UI unchanged
  const DeviceAssignmentSection = () => (
    <div className="p-6 bg-white rounded-lg shadow-md">
      <div className="p-6 border-b border-gray-200">
        <h3 className="text-lg font-semibold text-gray-900">Device Assignment</h3>
        <p className="mt-1 text-sm text-gray-600">Assign devices to your vehicles</p>
      </div>
      
      <div className="p-6">
        <div className="grid grid-cols-1 gap-8 lg:grid-cols-2">
          {/* Unassigned Devices */}
          <div>
            <h4 className="flex items-center gap-2 mb-4 font-semibold text-gray-900 text-md">
              <Shield className="w-5 h-5" />
              Available Devices
            </h4>
            <div className="space-y-3 overflow-y-auto max-h-96">
              {data.devices.filter(device => !device.vehicle_id).map((device) => (
                <div key={device.device_id} className="p-4 border rounded-lg bg-gray-50">
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <h5 className="font-medium text-gray-900">{device.device_name}</h5>
                      <p className="text-sm text-gray-600">{device.device_type}</p>
                      <span className="inline-block px-2 py-1 mt-1 text-xs text-yellow-800 bg-yellow-100 rounded-full">
                        {device.status}
                      </span>
                    </div>
                  </div>
                  
                  <div className="flex gap-2">
                    <select
                      onChange={(e) => {
                        if (e.target.value) {
                          handleDeviceAssignment(device.device_id, e.target.value);
                        }
                      }}
                      className="flex-1 p-2 text-sm border border-gray-300 rounded"
                      defaultValue=""
                      disabled={loading}
                    >
                      <option value="">Select Vehicle</option>
                      {data.vehicles.map((vehicle) => (
                        <option key={vehicle.vehicle_id} value={vehicle.vehicle_id}>
                          {vehicle.vehicle_number} - {vehicle.manufacturer || 'Unknown'} {vehicle.model || 'Model'}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              ))}
              {data.devices.filter(device => !device.vehicle_id).length === 0 && (
                <p className="py-8 text-center text-gray-500">
                  {loading ? 'Loading...' : 'No unassigned devices available'}
                </p>
              )}
            </div>
          </div>

          {/* Assigned Devices - ORIGINAL SECTION WITH UNASSIGN BUTTON */}
          <div>
            <h4 className="flex items-center gap-2 mb-4 font-semibold text-gray-900 text-md">
              <Car className="w-5 h-5" />
              Vehicle-Device Assignments
            </h4>
            <div className="space-y-3 overflow-y-auto max-h-96">
              {data.vehicles.map((vehicle) => {
                const assignedDevices = data.devices.filter(device => device.vehicle_id === vehicle.vehicle_id);
                return (
                  <div key={vehicle.vehicle_id} className="p-4 border rounded-lg">
                    <div className="mb-3">
                      <h5 className="font-medium text-gray-900">
                        {vehicle.vehicle_number} - {vehicle.manufacturer || 'Unknown'} {vehicle.model || 'Model'}
                      </h5>
                      <p className="text-sm text-gray-600">{vehicle.vehicle_type}</p>
                    </div>
                    
                    {assignedDevices.length > 0 ? (
                      <div className="space-y-2">
                        {assignedDevices.map((device) => (
                          <div key={device.device_id} className="flex items-center justify-between p-3 border rounded bg-gray-50">
                            <div className="flex-1">
                              <div className="flex items-center gap-2">
                                <span className="font-medium text-gray-900">{device.device_name}</span>
                                <span className="px-2 py-1 text-xs text-blue-800 bg-blue-100 rounded-full">
                                  {device.status}
                                </span>
                              </div>
                              <p className="text-sm text-gray-600">{device.device_type}</p>
                            </div>
                            
                            {confirmUnassign === device.device_id ? (
                              // Show confirmation buttons
                              <div className="flex gap-2">
                                <button
                                  onClick={() => handleConfirmUnassign(device.device_id)}
                                  className="px-3 py-1 text-xs font-medium text-white transition-colors duration-200 bg-red-600 rounded hover:bg-red-700 disabled:opacity-50"
                                  disabled={assignmentLoading[device.device_id]}
                                >
                                  {assignmentLoading[device.device_id] ? 'Removing...' : 'Yes, Remove'}
                                </button>
                                <button
                                  onClick={handleCancelUnassign}
                                  className="px-3 py-1 text-xs font-medium text-gray-600 transition-colors duration-200 bg-gray-200 rounded hover:bg-gray-300"
                                  disabled={loading}
                                >
                                  Cancel
                                </button>
                              </div>
                            ) : (
                              // Show unassign button
                              <button
                                onClick={() => handleUnassignClick(device.device_id)}
                                className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-orange-600 transition-colors duration-200 border border-orange-200 rounded-md bg-orange-50 hover:bg-orange-100 hover:border-orange-300 disabled:opacity-50"
                                disabled={loading}
                              >
                                <X className="w-4 h-4" />
                                Unassign
                              </button>
                            )}
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-sm text-gray-400">No devices assigned</p>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="w-8 h-8 border-b-2 border-blue-600 rounded-full animate-spin"></div>
        <span className="ml-3 text-gray-600">Loading fleet data...</span>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full space-y-6">
      {/* Horizontal Layout for Vehicle Fleet Management and Device Assignment */}
      <div className="flex flex-1 gap-6">
        <div className="w-1/2">
          <VehicleDataTable />
        </div>
        <div className="w-1/2">
          <DeviceAssignmentSection />
        </div>
      </div>
    </div>
  );
};

export default DeviceAssignment;