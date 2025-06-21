// File: src/components/common/Modal.js
// Fixed Modal Component - Prevents Page Refresh Issues

import React, { useEffect } from 'react';
import { X } from 'lucide-react';

const Modal = ({ isOpen, onClose, title, children, size = 'md' }) => {
  // Prevent page refresh when modal is open
  useEffect(() => {
    if (isOpen) {
      // Disable browser refresh shortcut
      const handleKeyDown = (e) => {
        if ((e.ctrlKey || e.metaKey) && e.key === 'r') {
          e.preventDefault();
          console.warn('Page refresh disabled while modal is open');
          return false;
        }
        if (e.key === 'F5') {
          e.preventDefault();
          console.warn('Page refresh disabled while modal is open');
          return false;
        }
        if (e.key === 'Escape') {
          onClose();
        }
      };

      // Prevent beforeunload events
      const handleBeforeUnload = (e) => {
        e.preventDefault();
        e.returnValue = '';
        return '';
      };

      document.addEventListener('keydown', handleKeyDown);
      window.addEventListener('beforeunload', handleBeforeUnload);

      return () => {
        document.removeEventListener('keydown', handleKeyDown);
        window.removeEventListener('beforeunload', handleBeforeUnload);
      };
    }
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const sizeClasses = {
    sm: 'max-w-sm',
    md: 'max-w-md',
    lg: 'max-w-lg',
    xl: 'max-w-xl',
    '2xl': 'max-w-2xl',
    '3xl': 'max-w-3xl',
    '4xl': 'max-w-4xl',
    '5xl': 'max-w-5xl',
    '6xl': 'max-w-6xl',
    '7xl': 'max-w-7xl',
    'full': 'max-w-full'
  };

  // Better responsive height classes
  const getHeightClass = (size) => {
    if (['6xl', '7xl', 'full'].includes(size)) {
      return 'max-h-[95vh]'; // For large modals, use almost full screen height
    }
    return 'max-h-[80vh]'; // For smaller modals
  };

  const handleBackdropClick = (e) => {
    // Only close if clicking the backdrop, not the modal content
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  const handleCloseClick = (e) => {
    e.preventDefault();
    e.stopPropagation();
    onClose();
  };

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50"
      onClick={handleBackdropClick}
    >
      {/* Modal Content */}
      <div className={`
        relative w-full mx-4 bg-white rounded-lg shadow-xl 
        ${sizeClasses[size]} 
        ${getHeightClass(size)}
        flex flex-col
        overflow-hidden
      `}>
        {/* Fixed Header */}
        <div className="sticky top-0 z-10 flex items-center justify-between p-4 bg-white border-b border-gray-200">
          <h3 className="pr-8 text-lg font-semibold text-gray-900">{title}</h3>
          <button 
            onClick={handleCloseClick}
            type="button"
            className="absolute p-1 text-gray-400 transition-colors rounded-full right-4 top-4 hover:text-gray-600 hover:bg-gray-100"
            aria-label="Close modal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        
        {/* Scrollable Content */}
        <div className="flex-1 p-4 overflow-y-auto">
          {children}
        </div>
      </div>
    </div>
  );
};

export default Modal;