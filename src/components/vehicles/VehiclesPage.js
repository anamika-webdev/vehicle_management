// Final VehiclesPage with working navigation and Enhanced Tracking
// src/components/vehicles/VehiclesPage.js

import React, { useState } from 'react';
import { Eye, Edit, Trash2, Plus, Navigation } from 'lucide-react';
import { useData } from '../../contexts/DataContext';
import { useNotification } from '../../contexts/NotificationContext';
import Modal from '../common/Modal';
import VehicleForm from './VehicleForm';

const VehiclesPage = ({ onViewVehicle, onEnhancedTracking }) => { // Updated props
  const { data, createVehicle, updateVehicle, deleteVehicle, loading } = useData();
  const { showSuccess, showError } = useNotification();
  const [showModal, setShowModal] = useState(false);
  const [modalType, setModalType] = useState('');
  const [selectedVehicle, setSelectedVehicle] = useState(null);

  const handleAdd = () => {
    setModalType('add');
    setSelectedVehicle(null);
    setShowModal(true);
  };

  const handleEdit = (vehicle) => {
    setModalType('edit');
    setSelectedVehicle(vehicle);
    setShowModal(true);
  };

  const handleView = (vehicle) => {
    if (onViewVehicle && typeof onViewVehicle === 'function') {
      onViewVehicle(vehicle.vehicle_id);
    }
  };

  // Enhanced tracking handler
  const handleEnhancedTracking = (vehicle) => {
    if (onEnhancedTracking && typeof onEnhancedTracking === 'function') {
      onEnhancedTracking(vehicle);
    }
  };

  const handleDelete = async (vehicleId) => {
    if (!window.confirm('Are you sure you want to delete this vehicle?')) return;
    
    try {
      await deleteVehicle(vehicleId);
      showSuccess('Success', 'Vehicle deleted successfully');
    } catch (error) {
      showError('Error', `Failed to delete vehicle: ${error.message}`);
    }
  };

  const handleSubmit = async (formData) => {
    try {
      if (modalType === 'add') {
        await createVehicle(formData);
        showSuccess('Success', 'Vehicle created successfully');
      } else {
        await updateVehicle(selectedVehicle.vehicle_id, formData);
        showSuccess('Success', 'Vehicle updated successfully');
      }
      setShowModal(false);
    } catch (error) {
      showError('Error', `Failed to save vehicle: ${error.message}`);
    }
  };

  const handleCancel = () => {
    setShowModal(false);
    setSelectedVehicle(null);
    setModalType('');
  };

  const getVehicleWithStatus = (vehicle) => {
    const assignedDevices = data.devices.filter(d => d.vehicle_id === vehicle.vehicle_id);
    const activeDevices = assignedDevices.filter(d => d.status === 'Active');
    const vehicleAlarms = data.alarms.filter(alarm => 
      assignedDevices.some(device => device.device_id === alarm.device_id)
    );
    const criticalAlarms = vehicleAlarms.filter(a => !a.resolved && a.severity === 'critical');
    
    return {
      ...vehicle,
      deviceCount: assignedDevices.length,
      activeDeviceCount: activeDevices.length,
      alarmCount: vehicleAlarms.filter(a => !a.resolved).length,
      criticalAlarmCount: criticalAlarms.length,
      hasDevices: assignedDevices.length > 0,
      isOnline: activeDevices.length > 0
    };
  };

  const VehicleCard = ({ vehicle }) => {
    const vehicleWithStatus = getVehicleWithStatus(vehicle);
    
    return (
      <div className="p-6 transition-shadow bg-white border rounded-lg shadow-md hover:shadow-lg">
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center space-x-3">
            <div className={`w-12 h-12 rounded-lg flex items-center justify-center ${
              vehicleWithStatus.isOnline ? 'bg-green-100' : 'bg-gray-100'
            }`}>
              <div className={`w-3 h-3 rounded-full ${
                vehicleWithStatus.isOnline ? 'bg-green-500 animate-pulse' : 'bg-gray-400'
              }`}></div>
            </div>
            <div>
              <h3 className="text-lg font-semibold text-gray-900">{vehicle.vehicle_number}</h3>
              <p className="text-sm text-gray-600">{vehicle.manufacturer} {vehicle.model}</p>
              <p className="text-xs text-gray-500">{vehicle.vehicle_type}</p>
            </div>
          </div>
          <span className={`px-3 py-1 text-sm rounded-full ${
            vehicleWithStatus.isOnline ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'
          }`}>
            {vehicleWithStatus.isOnline ? 'Online' : 'Offline'}
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

        {/* Updated action buttons section */}
        <div className="space-y-3">
          {/* Primary action buttons */}
          <div className="flex items-center justify-between">
            <button
              onClick={() => handleView(vehicle)}
              className="flex items-center gap-2 px-4 py-2 text-blue-600 border border-blue-600 rounded-lg hover:bg-blue-50"
            >
              <Eye className="w-4 h-4" />
              View Details
            </button>
            
            <div className="flex gap-2">
              <button
                onClick={() => handleEdit(vehicle)}
                className="p-2 text-gray-600 rounded hover:text-gray-800 hover:bg-gray-100"
                title="Edit Vehicle"
                disabled={loading}
              >
                <Edit className="w-4 h-4" />
              </button>
              <button
                onClick={() => handleDelete(vehicle.vehicle_id)}
                className="p-2 text-red-600 rounded hover:text-red-800 hover:bg-red-100"
                title="Delete Vehicle"
                disabled={loading}
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Enhanced tracking button */}
          {onEnhancedTracking && (
            <button
              onClick={() => handleEnhancedTracking(vehicle)}
              className="flex items-center justify-center w-full px-3 py-2 space-x-2 text-white transition-colors bg-blue-600 rounded-lg hover:bg-blue-700"
              title="Enhanced Tracking"
              disabled={!vehicleWithStatus.hasDevices}
            >
              <Navigation className="w-4 h-4" />
              <span>Track Route</span>
            </button>
          )}
        </div>

        <div className="pt-4 mt-4 border-t border-gray-200">
          <div className="flex justify-between text-sm text-gray-500">
            <span>Speed: {Math.round(vehicle.current_speed || 0)} km/h</span>
            <span>Location: {vehicle.current_latitude ? 'Available' : 'N/A'}</span>
          </div>
        </div>
      </div>
    );
  };

  const VehicleDataTable = () => {
    const tableRows = data.vehicles.map(vehicle => {
      const vehicleWithStatus = getVehicleWithStatus(vehicle);
      return {
        vehicle_id: vehicle.vehicle_id,
        vehicle_number: vehicle.vehicle_number,
        manufacturer: vehicle.manufacturer,
        model: vehicle.model,
        vehicle_type: vehicle.vehicle_type,
        status: vehicleWithStatus.isOnline ? 'Online' : 'Offline',
        devices: vehicleWithStatus.deviceCount,
        alarms: vehicleWithStatus.alarmCount
      };
    });

    return (
      <div className="bg-white rounded-lg shadow-md">
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
                {['Vehicle Number', 'Manufacturer', 'Model', 'Type', 'Status', 'Devices', 'Alarms', 'Actions'].map((header, index) => (
                  <th key={index} className="px-6 py-3 text-xs font-medium tracking-wider text-left text-gray-500 uppercase">
                    {header}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {tableRows.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-6 py-8 text-center text-gray-500">
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
                      <td className="px-6 py-4 text-sm whitespace-nowrap">
                        <span className={`px-2 py-1 text-xs rounded-full ${
                          vehicleWithStatus.isOnline ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'
                        }`}>
                          {row.status}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-900 whitespace-nowrap">
                        <span className="flex items-center gap-1">
                          {row.devices}
                          {vehicleWithStatus.activeDeviceCount > 0 && (
                            <span className="text-xs text-green-600">({vehicleWithStatus.activeDeviceCount} active)</span>
                          )}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-sm whitespace-nowrap">
                        {row.alarms > 0 ? (
                          <span className={`px-2 py-1 text-xs rounded-full ${
                            vehicleWithStatus.criticalAlarmCount > 0 ? 'bg-red-100 text-red-800' : 'bg-yellow-100 text-yellow-800'
                          }`}>
                            {row.alarms} alarm{row.alarms > 1 ? 's' : ''}
                          </span>
                        ) : (
                          <span className="text-green-600">No alarms</span>
                        )}
                      </td>
                      <td className="px-6 py-4 text-sm font-medium whitespace-nowrap">
                        <div className="flex gap-2">
                          <button
                            onClick={() => handleView(vehicle)}
                            className="text-blue-600 hover:text-blue-900"
                            title="View Vehicle Details"
                          >
                            <Eye className="w-4 h-4" />
                          </button>
                          {onEnhancedTracking && (
                            <button
                              onClick={() => handleEnhancedTracking(vehicle)}
                              className="text-green-600 hover:text-green-900"
                              title="Enhanced Tracking"
                              disabled={!vehicleWithStatus.hasDevices}
                            >
                              <Navigation className="w-4 h-4" />
                            </button>
                          )}
                          <button
                            onClick={() => handleEdit(vehicle)}
                            className="text-gray-600 hover:text-gray-900"
                            title="Edit Vehicle"
                            disabled={loading}
                          >
                            <Edit className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleDelete(vehicle.vehicle_id)}
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

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-1 gap-6 md:grid-cols-4">
        <div className="p-4 bg-white rounded-lg shadow-md">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Total Vehicles</p>
              <p className="text-2xl font-bold text-gray-900">{data.vehicles.length}</p>
            </div>
            <div className="p-2 bg-blue-100 rounded-lg">
              <div className="w-6 h-6 text-blue-600">🚗</div>
            </div>
          </div>
        </div>
        
        <div className="p-4 bg-white rounded-lg shadow-md">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Online Vehicles</p>
              <p className="text-2xl font-bold text-green-600">
                {data.vehicles.filter(v => {
                  const activeDevices = data.devices.filter(d => d.vehicle_id === v.vehicle_id && d.status === 'Active');
                  return activeDevices.length > 0;
                }).length}
              </p>
            </div>
            <div className="p-2 bg-green-100 rounded-lg">
              <div className="w-6 h-6 text-green-600">✅</div>
            </div>
          </div>
        </div>
        
        <div className="p-4 bg-white rounded-lg shadow-md">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">With Active Alarms</p>
              <p className="text-2xl font-bold text-red-600">
                {data.vehicles.filter(v => {
                  const assignedDevices = data.devices.filter(d => d.vehicle_id === v.vehicle_id);
                  const vehicleAlarms = data.alarms.filter(alarm => 
                    assignedDevices.some(device => device.device_id === alarm.device_id) && !alarm.resolved
                  );
                  return vehicleAlarms.length > 0;
                }).length}
              </p>
            </div>
            <div className="p-2 bg-red-100 rounded-lg">
              <div className="w-6 h-6 text-red-600">🚨</div>
            </div>
          </div>
        </div>
        
        <div className="p-4 bg-white rounded-lg shadow-md">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Average Speed</p>
              <p className="text-2xl font-bold text-purple-600">
                {Math.round(data.vehicles.reduce((sum, v) => sum + (v.current_speed || 0), 0) / Math.max(data.vehicles.length, 1))} km/h
              </p>
            </div>
            <div className="p-2 bg-purple-100 rounded-lg">
              <div className="w-6 h-6 text-purple-600">⚡</div>
            </div>
          </div>
        </div>
      </div>

      {/* Vehicle Data Table */}
      <VehicleDataTable />
      
      {/* Vehicle Cards Grid */}
      <div className="p-6 bg-white rounded-lg shadow-md">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h3 className="text-lg font-semibold">Fleet Overview</h3>
            <p className="text-sm text-gray-600">Monitor your vehicle fleet with real-time status</p>
          </div>
          <span className="text-sm text-gray-500">
            {data.vehicles.filter(v => {
              const activeDevices = data.devices.filter(d => d.vehicle_id === v.vehicle_id && d.status === 'Active');
              return activeDevices.length > 0;
            }).length} of {data.vehicles.length} vehicles online
          </span>
        </div>
        
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
          {data.vehicles.map((vehicle) => (
            <VehicleCard key={vehicle.vehicle_id} vehicle={vehicle} />
          ))}
        </div>
        
        {data.vehicles.length === 0 && (
          <div className="py-12 text-center text-gray-500">
            <div className="w-16 h-16 mx-auto mb-4 text-gray-300">🚗</div>
            <h3 className="mb-2 text-lg font-medium text-gray-900">No Vehicles Found</h3>
            <p className="mb-4 text-gray-600">Get started by adding your first vehicle to the fleet</p>
            <button
              onClick={handleAdd}
              className="flex items-center gap-2 px-4 py-2 mx-auto text-white bg-blue-600 rounded-lg hover:bg-blue-700"
            >
              <Plus className="w-4 h-4" />
              Add Your First Vehicle
            </button>
          </div>
        )}
      </div>

      {/* Add/Edit Vehicle Modal */}
      <Modal
        isOpen={showModal}
        onClose={handleCancel}
        title={`${modalType === 'add' ? 'Add New' : 'Edit'} Vehicle`}
        size="lg"
      >
        <VehicleForm
          vehicle={selectedVehicle}
          onSubmit={handleSubmit}
          onCancel={handleCancel}
          loading={loading}
        />
      </Modal>
    </div>
  );
};

export default VehiclesPage;