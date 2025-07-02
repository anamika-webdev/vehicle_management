import React from 'react';
import Modal from '../common/Modal';
import EnhancedDeviceMap from '../tracking/EnhancedDeviceMap';

const DeviceMapModal = ({ isOpen, onClose, device }) => {
  if (!device) return null;

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Device Map View" size="6xl">
      <EnhancedDeviceMap
        device={device}
        vehicle={device.associatedVehicle}
        center={[device.latitude || 0, device.longitude || 0]}
        zoom={15}
        enableTracking={false}
        height="400px"
        routePoints={device.routePoints}
      />
    </Modal>
  );
};

export default DeviceMapModal;
