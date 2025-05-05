import { CONTRACT_ADDRESS } from './utils/config';

// Export contract address for global use
export { CONTRACT_ADDRESS };

// Create a wrapper for console.error to inject the CONTRACT_ADDRESS
// This fixes the "CONTRACT_ADDRESS is not defined" error
const originalError = console.error;
console.error = function() {
  // Make CONTRACT_ADDRESS available to error handling code
  window.CONTRACT_ADDRESS = CONTRACT_ADDRESS;
  
  // Call the original console.error
  return originalError.apply(this, arguments);
};

// Override method for global access to fix "CONTRACT_ADDRESS is not defined" error
export const overrideMethod = (method) => {
  return function(...args) {
    try {
      // Ensure CONTRACT_ADDRESS is available
      if (typeof CONTRACT_ADDRESS === 'undefined' && window.CONTRACT_ADDRESS) {
        // Use the global version if the imported one is undefined
        const CONTRACT_ADDRESS = window.CONTRACT_ADDRESS;
        return method.apply(this, args);
      }
      return method.apply(this, args);
    } catch (error) {
      console.error("Error in overridden method:", error);
      throw error;
    }
  };
}; 