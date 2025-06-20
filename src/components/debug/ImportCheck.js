// QUICK IMPORT CHECK - Add this to your app temporarily to debug imports
// Create this file: src/components/debug/ImportCheck.js

import React, { useEffect } from 'react';

const ImportCheck = () => {
  useEffect(() => {
    console.log('🔍 Checking imports...');
    
    // Test 1: Check if apiService is imported correctly
    import('../../../services/api')
      .then((module) => {
        console.log('✅ API Service imported successfully:', module);
        console.log('✅ Default export:', module.default);
        console.log('✅ Available methods:', Object.getOwnPropertyNames(module.default));
        
        // Test specific method
        if (module.default && typeof module.default.getVehicles === 'function') {
          console.log('✅ getVehicles method found');
        } else {
          console.error('❌ getVehicles method NOT found');
          console.log('Available methods:', Object.getOwnPropertyNames(module.default));
        }
      })
      .catch((error) => {
        console.error('❌ Failed to import API service:', error);
      });

    // Test 2: Check DataContext import
    import('../../../contexts/DataContext')
      .then((module) => {
        console.log('✅ DataContext imported successfully:', module);
      })
      .catch((error) => {
        console.error('❌ Failed to import DataContext:', error);
      });

  }, []);

  return (
    <div className="p-4 border border-yellow-200 rounded bg-yellow-50">
      <h3 className="font-bold text-yellow-800">Import Debug Check</h3>
      <p className="text-sm text-yellow-700">Check browser console for import results</p>
    </div>
  );
};

export default ImportCheck;