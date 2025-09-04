import React, { useState } from 'react';
import { Plus, Car, Smartphone, AlertTriangle, CheckCircle, X, Clock, Zap, Shield, Trash2 } from 'lucide-react';
import { useData } from '../../contexts/DataContext';
import { useNotification } from '../notifications/RealTimeNotificationSystem';
import apiService from '../../services/api';
import Modal from '../common/Modal'; // Ensure Modal component is available
import VehicleForm from '../vehicles/VehicleForm'; // Ensure VehicleForm component is available

const DeviceAssignment = () => {
  const { data, loading, refreshData } = useData();
  const { showSuccess, showError } = useNotification();
  const [assignmentLoading, setAssignmentLoading] = useState({});
  const [confirmUnassign, setConfirmUnassign] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [modalType, setModalType] = useState('add');
  const [selectedVehicle, setSelectedVehicle] = useState(null);

  const getVehicleWithStatus = (vehicle) => {
    console.log('🔍 Processing vehicle alarms for:', vehicle.vehicle_number || vehicle.vehicleNumber || vehicle.vehicle_id);
    
    const assignedDevices = data.devices.filter(d => {
      const deviceVehicleId = d.vehicle_id || d.vehicleId;
      const vehicleId = vehicle.vehicle_id || vehicle.vehicleId;
      
      if (!deviceVehicleId || !vehicleId) return false;
      return deviceVehicleId.toString() === vehicleId.toString();
    });

    const alertsData = data.alerts || [];
    console.log('🔍 Processing alarms from API:', alertsData.length, 'total alarms');
    
    const vehicleAlarms = alertsData.filter(alarm => {
      if (!alarm) return false;
      
      const alarmDeviceId = alarm.deviceId || alarm.device_id || alarm.device;
      if (!alarmDeviceId) return false;
      
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

    const unresolvedAlarms = vehicleAlarms.filter(alarm => {
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

  const handleUnassignClick = (deviceId) => {
    setConfirmUnassign(deviceId);
  };

  const handleConfirmUnassign = async (deviceId) => {
    await handleDeviceAssignment(deviceId, 'unassign');
  };

  const handleCancelUnassign = () => {
    setConfirmUnassign(null);
  };

  const handleAdd = () => {
    setModalType('add');
    setSelectedVehicle(null);
    setShowModal(true);
  };

  const handleSubmit = async (vehicleData) => {
    try {
      const result = await apiService.createVehicle(vehicleData);
      if (result.success) {
        showSuccess('Vehicle Added', 'New vehicle has been added successfully.');
        refreshData(); // Refresh the data to show the new vehicle
        setShowModal(false); // Close the modal on success
      } else {
        throw new Error(result.error || 'Failed to create vehicle.');
      }
    } catch (error) {
      showError('Creation Failed', error.message);
    }
  };

  const handleCancel = () => {
    setShowModal(false);
    setSelectedVehicle(null);
  };

  const VehicleDataTable = () => {
    console.log('🔍 VehicleDataTable rendering with data:', {
      vehicles: data.vehicles.length,
      devices: data.devices.length,
      alerts: data.alerts.length,
      alarms: data.alarms?.length || 0
    });
    
    const tableRows = data.vehicles.map((vehicle, index) => {
      const vehicleWithStatus = getVehicleWithStatus(vehicle);
      const getFieldValue = (vehicle, primaryField, fallbackFields = [], defaultValue = 'N/A') => {
        if (vehicle[primaryField] && vehicle[primaryField] !== null && vehicle[primaryField] !== '') {
          return vehicle[primaryField];
        }
        for (const fallback of fallbackFields) {
          if (vehicle[fallback] && vehicle[fallback] !== null && vehicle[fallback] !== '') {
            return vehicle[fallback];
          }
        }
        return defaultValue;
      };

      return {
        vehicle_id: vehicle.vehicle_id,
        vehicle_number: getFieldValue(vehicle, 'vehicle_number', ['vehicleNumber', 'license_plate', 'plateNumber']),
        manufacturer: getFieldValue(vehicle, 'manufacturer', ['vehicleManufacturer', 'make', 'brand']),
        model: getFieldValue(vehicle, 'model', ['vehicle_model', 'vehicleModel', 'vehicleName']),
        vehicle_type: getFieldValue(vehicle, 'vehicle_type', ['vehicleType', 'type', 'category']),
        devices: vehicleWithStatus.deviceCount,
      };
    });

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
                {['Vehicle Number', 'Manufacturer', 'Model', 'Type', 'Devices', 'Actions'].map((header, index) => (
                  <th key={index} className="px-6 py-3 text-xs font-medium tracking-wider text-left text-gray-500 uppercase">
                    {header}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {tableRows.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-8 text-center text-gray-500">
                    {loading ? 'Loading vehicles...' : 'No vehicles found. Add your first vehicle to get started.'}
                  </td>
                </tr>
              ) : (
                tableRows.map((row, index) => (
                  <tr key={index} className="hover:bg-gray-50">
                    <td className="px-6 py-4 text-sm font-medium text-gray-900 whitespace-nowrap">{row.vehicle_number}</td>
                    <td className="px-6 py-4 text-sm text-gray-900 whitespace-nowrap">{row.manufacturer}</td>
                    <td className="px-6 py-4 text-sm text-gray-900 whitespace-nowrap">{row.model}</td>
                    <td className="px-6 py-4 text-sm text-gray-900 whitespace-nowrap">{row.vehicle_type}</td>
                    <td className="px-6 py-4 text-sm text-gray-900 whitespace-nowrap">{row.devices}</td>
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
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    );
  };

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

          {/* Assigned Devices */}
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
      <div className="flex flex-1 gap-6">
        <div className="w-1/2">
          <VehicleDataTable />
        </div>
        <div className="w-1/2">
          <DeviceAssignmentSection />
        </div>
      </div>

      {/* Modal for Adding/Editing a Vehicle */}
      {showModal && (
          <Modal 
              isOpen={showModal} 
              onClose={handleCancel} 
              title={modalType === 'add' ? 'Add New Vehicle' : 'Edit Vehicle'}
          >
              <VehicleForm 
                  vehicle={selectedVehicle} 
                  onSuccess={() => {
                      setShowModal(false);
                      refreshData();
                  }} 
                  onCancel={handleCancel} 
              />
          </Modal>
      )}
    </div>
  );
};

export default DeviceAssignment;