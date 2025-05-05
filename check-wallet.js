// Script to check if a wallet is the default relayer
import { ethers } from 'ethers';

// Configuration
const CONTRACT_ADDRESS = "0x4995f6754359b2ec0b9d537c2f839e3dc01f6240";
// Replace with your wallet address that you're using in the app
const WALLET_TO_CHECK = "YOUR_WALLET_ADDRESS";

// RPC endpoints to try
const RPC_ENDPOINTS = [
  "https://endpoints.omniatech.io/v1/matic/mumbai/public",
  "https://polygon-testnet.public.blastapi.io",
  "https://polygon-mumbai-bor.publicnode.com",
  "https://api.zan.top/node/v1/polygon/mumbai/public"
];

// Minimal ABI for checking
const ABI = [
  "function defaultRelayerWallet() external view returns (address)"
];

// Helper function for RPC connection
async function tryProvider(url, timeout = 10000) {
  return new Promise(async (resolve) => {
    const timeoutId = setTimeout(() => {
      console.log(`Timeout reached for ${url}`);
      resolve(null);
    }, timeout);
    
    try {
      const provider = new ethers.providers.JsonRpcProvider({
        url: url,
        timeout: 8000
      });
      
      const network = await provider.getNetwork();
      console.log(`Connected to network: ${network.name} (chainId: ${network.chainId})`);
      
      clearTimeout(timeoutId);
      resolve(provider);
    } catch (error) {
      console.log(`Failed to connect to ${url}: ${error.message}`);
      clearTimeout(timeoutId);
      resolve(null);
    }
  });
}

// Main function
async function checkWalletStatus() {
  console.log("Checking if wallet is the default relayer...");
  console.log(`Contract: ${CONTRACT_ADDRESS}`);
  console.log(`Wallet to check: ${WALLET_TO_CHECK}`);
  
  // Try each RPC endpoint until one works
  let provider = null;
  
  for (const endpoint of RPC_ENDPOINTS) {
    console.log(`\nTrying endpoint: ${endpoint}`);
    provider = await tryProvider(endpoint);
    
    if (provider) {
      console.log(`Connected successfully to: ${endpoint}`);
      break;
    }
  }
  
  if (!provider) {
    console.error("\n❌ ERROR: Failed to connect to any RPC endpoint");
    return;
  }
  
  try {
    // Connect to contract (read-only)
    const contract = new ethers.Contract(CONTRACT_ADDRESS, ABI, provider);
    
    // Get default relayer
    const defaultRelayer = await contract.defaultRelayerWallet();
    console.log(`\nDefault relayer address: ${defaultRelayer}`);
    
    // Check if the wallet is the default relayer
    const isDefaultRelayer = defaultRelayer.toLowerCase() === WALLET_TO_CHECK.toLowerCase();
    
    if (isDefaultRelayer) {
      console.log(`\n✅ SUCCESS: Your wallet IS the default relayer!`);
      console.log(`You should have admin access to the Admin Panel.`);
    } else {
      console.log(`\n❌ Your wallet is NOT the default relayer.`);
      console.log(`You won't have access to the Admin Panel.`);
      console.log(`The default relayer is: ${defaultRelayer}`);
    }
  } catch (error) {
    console.error(`\n❌ ERROR: ${error.message}`);
  }
}

// Run the script
checkWalletStatus().catch(error => {
  console.error(`Fatal error: ${error.message}`);
}); 