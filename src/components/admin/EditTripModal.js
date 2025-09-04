import React, { useState, useEffect } from 'react';
import Modal from '../common/Modal';
import { X } from 'lucide-react';
import apiService from '../../services/api';

const EditTripModal = ({ isOpen, onClose, trip, onSave }) => {
  // State for all available options
  const [allVehicles, setAllVehicles] = useState([]);
  const [allDrivers, setAllDrivers] = useState([]);
  const [allEmployees, setAllEmployees] = useState([]);

  // State for the current trip's selections
  const [selectedVehicle, setSelectedVehicle] = useState('');
  const [selectedDriver, setSelectedDriver] = useState('');
  const [currentEmployees, setCurrentEmployees] = useState([]);
  const [employeeToAdd, setEmployeeToAdd] = useState('');

  useEffect(() => {
    // Fetch all possible options when the modal opens
    const fetchOptions = async () => {
      const vehiclesRes = await apiService.getVehicles();
      const driversRes = await apiService.getDrivers();
      // In a real app, you might have a dedicated endpoint for employees
      const employeesRes = await apiService.getEmployees(); 

      setAllVehicles(vehiclesRes.data || []);
      setAllDrivers(driversRes.data || []);
      setAllEmployees(employeesRes.data || []);
    };
    fetchOptions();
  }, []);

  useEffect(() => {
    // Populate modal with the selected trip's data
    if (trip) {
      setSelectedVehicle(trip.vehicle.name);
      setSelectedDriver(trip.driver.name);
      setCurrentEmployees(trip.employees.map(e => e.name));
    }
  }, [trip]);

  const handleAddEmployee = () => {
    if (employeeToAdd && !currentEmployees.includes(employeeToAdd)) {
      setCurrentEmployees([...currentEmployees, employeeToAdd]);
      setEmployeeToAdd('');
    }
  };

  const handleRemoveEmployee = (employeeToRemove) => {
    setCurrentEmployees(currentEmployees.filter(e => e !== employeeToRemove));
  };

  const handleSave = () => {
    const updatedTrip = {
      ...trip,
      vehicle: { ...trip.vehicle, name: selectedVehicle },
      driver: { ...trip.driver, name: selectedDriver },
      employees: currentEmployees.map(name => {
        // Find existing employee to preserve pickup location, or create a new object
        const existing = trip.employees.find(e => e.name === name);
        return existing || { name, pickup: { lat: 0, lng: 0 } }; // Default for new employees
      }),
      passengers: currentEmployees.length,
    };
    onSave(updatedTrip);
    onClose();
  };
  
  const availableEmployees = allEmployees.filter(e => !currentEmployees.includes(e.name)).map(e => e.name);

  if (!trip) return null;

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={`Edit Trip ID: ${trip.id}`}>
      <div className="p-6 space-y-4">
        {/* Vehicle Selection */}
        <div>
          <label className="block text-sm font-medium text-gray-700">Change Vehicle</label>
          <select value={selectedVehicle} onChange={(e) => setSelectedVehicle(e.target.value)} className="w-full p-2 mt-1 border rounded-md">
            {allVehicles.map(v => <option key={v.vehicle_id} value={v.vehicle_name}>{v.vehicle_name}</option>)}
          </select>
        </div>

        {/* Driver Selection */}
        <div>
          <label className="block text-sm font-medium text-gray-700">Change Driver</label>
          <select value={selectedDriver} onChange={(e) => setSelectedDriver(e.target.value)} className="w-full p-2 mt-1 border rounded-md">
            {allDrivers.map(d => <option key={d.id} value={d.name}>{d.name}</option>)}
          </select>
        </div>

        {/* Employee Management */}
        <div>
          <label className="block text-sm font-medium text-gray-700">Manage Employees</label>
          <div className="mt-1 mb-2 space-y-2">
            {currentEmployees.map(employee => (
              <div key={employee} className="flex items-center justify-between p-2 bg-gray-100 rounded">
                <span>{employee}</span>
                <button onClick={() => handleRemoveEmployee(employee)} className="text-red-500 hover:text-red-700"><X size={16} /></button>
              </div>
            ))}
          </div>
          <div className="flex items-center space-x-2">
            <select value={employeeToAdd} onChange={(e) => setEmployeeToAdd(e.target.value)} className="w-full p-2 border rounded-md">
              <option value="">-- Add an employee --</option>
              {availableEmployees.map(e => <option key={e} value={e}>{e}</option>)}
            </select>
            <button onClick={handleAddEmployee} className="px-4 py-2 text-white bg-green-600 rounded-md hover:bg-green-700">Add</button>
          </div>
        </div>

        <div className="flex justify-end pt-4 space-x-4">
          <button onClick={onClose} className="px-4 py-2 text-gray-700 bg-gray-200 rounded-md hover:bg-gray-300">Cancel</button>
          <button onClick={handleSave} className="px-4 py-2 text-white bg-blue-600 rounded-md hover:bg-blue-700">Save Changes</button>
        </div>
      </div>
    </Modal>
  );
};

export default EditTripModal;