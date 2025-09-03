import React, { useState, useEffect } from 'react';
import Modal from '../common/Modal';

const EditTripModal = ({ isOpen, onClose, trip, onSave }) => {
  // In a real application, you would fetch these from your backend
  const availableVehicles = ['Cab-101', 'Cab-102', 'Cab-103', 'Cab-104'];
  const availableEmployees = ['Priya Sharma', 'Rohan Verma', 'Anjali Gupta', 'Vikram Rathore'];

  const [vehicle, setVehicle] = useState('');
  const [employee, setEmployee] = useState('');

  useEffect(() => {
    if (trip) {
      setVehicle(trip.vehicle);
      setEmployee(trip.employee);
    }
  }, [trip]);

  const handleSave = () => {
    onSave({ ...trip, vehicle, employee });
    onClose();
  };

  if (!trip) {
    return null;
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={`Edit Trip ID: ${trip.id}`}>
      <div className="p-6">
        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700">Change Vehicle</label>
          <select
            value={vehicle}
            onChange={(e) => setVehicle(e.target.value)}
            className="w-full p-2 mt-1 border rounded-md focus:ring-blue-500 focus:border-blue-500"
          >
            {availableVehicles.map((v) => (
              <option key={v} value={v}>
                {v}
              </option>
            ))}
          </select>
        </div>
        <div className="mb-6">
          <label className="block text-sm font-medium text-gray-700">Change Employee</label>
          <select
            value={employee}
            onChange={(e) => setEmployee(e.target.value)}
            className="w-full p-2 mt-1 border rounded-md focus:ring-blue-500 focus:border-blue-500"
          >
            {availableEmployees.map((e) => (
              <option key={e} value={e}>
                {e}
              </option>
            ))}
          </select>
        </div>
        <div className="flex justify-end space-x-4">
          <button
            onClick={onClose}
            className="px-4 py-2 text-gray-700 bg-gray-200 rounded-md hover:bg-gray-300"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            className="px-4 py-2 text-white bg-blue-600 rounded-md hover:bg-blue-700"
          >
            Save Changes
          </button>
        </div>
      </div>
    </Modal>
  );
};

export default EditTripModal;