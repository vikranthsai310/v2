// Configuration for the application

// Chain configuration
export const CHAIN_ID = process.env.NEXT_PUBLIC_CHAIN_ID || '80001'; // Mumbai testnet
export const CHAIN_NAME = process.env.NEXT_PUBLIC_CHAIN_NAME || 'Polygon Mumbai';
export const RPC_URL = process.env.NEXT_PUBLIC_RPC_URL || 'https://rpc-mumbai.maticvigil.com';
export const BLOCK_EXPLORER_URL = process.env.NEXT_PUBLIC_BLOCK_EXPLORER_URL || 'https://mumbai.polygonscan.com';

// Contract configuration
export const CONTRACT_ADDRESS = process.env.NEXT_PUBLIC_CONTRACT_ADDRESS || '0x4995f6754359b2ec0b9d537c2f839e3dc01f6240';

// Relayer service configuration
export const RELAYER_SERVICE_URL = process.env.NEXT_PUBLIC_RELAYER_URL || 'http://localhost:3002';

// Determine if we're in development or production
export const IS_DEVELOPMENT = process.env.NODE_ENV === 'development';
export const IS_PRODUCTION = process.env.NODE_ENV === 'production';

// Logging configuration
export const DEBUG_LEVEL = process.env.NEXT_PUBLIC_DEBUG_LEVEL || (IS_DEVELOPMENT ? 'debug' : 'info');

// Function to log debugging information based on level
export const debugLog = (message: string, data?: any, level: 'debug' | 'info' | 'warn' | 'error' = 'debug') => {
  // Only log if the level is appropriate
  const levels = { debug: 0, info: 1, warn: 2, error: 3 };
  const configLevel = levels[DEBUG_LEVEL as keyof typeof levels] || 0;
  const messageLevel = levels[level];
  
  if (messageLevel >= configLevel) {
    if (data) {
      console[level](message, data);
    } else {
      console[level](message);
    }
  }
}; 