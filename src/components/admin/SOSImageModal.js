import React from 'react';
import Modal from '../common/Modal';

const SOSImageModal = ({ isOpen, onClose, imageUrl, alertId }) => {
  if (!isOpen) {
    return null;
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={`Image for SOS Alert: ${alertId}`} size="3xl">
      <div className="p-4">
        <img src={imageUrl} alt={`SOS from alert ${alertId}`} className="w-full h-auto rounded-lg" />
      </div>
    </Modal>
  );
};

export default SOSImageModal;