import React, { useState, useEffect } from 'react';
import FormField from '../common/FormField';
import { validateVehicleForm } from '../../utils/helpers';

const VehicleForm = ({ vehicle, onSubmit, onCancel, loading }) => {
  const [formData, setFormData] = useState({
    manufacturer: '',
    model: '',
    vehicle_number: '',
    vehicle_type: ''
  });
  const [errors, setErrors] = useState({});

  useEffect(() => {
    if (vehicle) {
      setFormData({
        manufacturer: vehicle.manufacturer || '',
        model: vehicle.model || '',
        vehicle_number: vehicle.vehicle_number || '',
        vehicle_type: vehicle.vehicle_type || ''
      });
    }
  }, [vehicle]);

  const handleChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    // Clear error when user starts typing
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: null }));
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    
    const validation = validateVehicleForm(formData);
    if (!validation.isValid) {
      setErrors(validation.errors);
      return;
    }

    onSubmit(formData);
  };

  const vehicleTypeOptions = [
    { value: 'Sedan', label: 'Sedan' },
    { value: 'SUV', label: 'SUV' },
    { value: 'Truck', label: 'Truck' },
    { value: 'Hatchback', label: 'Hatchback' },
    { value: 'Convertible', label: 'Convertible' },
    { value: 'Van', label: 'Van' },
    { value: 'Motorcycle', label: 'Motorcycle' }
  ];

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <FormField
        label="Manufacturer"
        value={formData.manufacturer}
        onChange={(e) => handleChange('manufacturer', e.target.value)}
        placeholder="e.g., Toyota, Honda, Ford"
        required
        error={errors.manufacturer}
        disabled={loading}
      />

      <FormField
        label="Model"
        value={formData.model}
        onChange={(e) => handleChange('model', e.target.value)}
        placeholder="e.g., Camry, Civic, F-150"
        required
        error={errors.model}
        disabled={loading}
      />

      <FormField
        label="Vehicle Number"
        value={formData.vehicle_number}
        onChange={(e) => handleChange('vehicle_number', e.target.value.toUpperCase())}
        placeholder="e.g., ABC123, XYZ789"
        required
        error={errors.vehicle_number}
        disabled={loading}
      />

      <FormField
        label="Vehicle Type"
        type="select"
        value={formData.vehicle_type}
        onChange={(e) => handleChange('vehicle_type', e.target.value)}
        options={vehicleTypeOptions}
        required
        error={errors.vehicle_type}
        disabled={loading}
      />

      <div className="flex gap-3 pt-4">
        <button
          type="submit"
          disabled={loading}
          className="flex-1 px-4 py-2 text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loading ? 'Saving...' : vehicle ? 'Update Vehicle' : 'Add Vehicle'}
        </button>
        <button
          type="button"
          onClick={onCancel}
          disabled={loading}
          className="flex-1 px-4 py-2 text-gray-700 bg-gray-300 rounded-lg hover:bg-gray-400 disabled:opacity-50"
        >
          Cancel
        </button>
      </div>
    </form>
  );
};

export default VehicleForm;