// Script to diagnose and fix relayer issues
import fetch from 'node-fetch';
import { ethers } from 'ethers';
import dotenv from 'dotenv';
import { createInterface } from 'readline';

// Initialize dotenv
dotenv.config();

// Default relayer URL
const RELAYER_URL = process.env.RELAYER_URL || 'http://localhost:3002';

// Get private key from .env file
const PRIVATE_KEY = process.env.RELAYER_PRIVATE_KEY;
if (!PRIVATE_KEY) {
  console.error('RELAYER_PRIVATE_KEY not found in .env file');
  process.exit(1);
}

// Network RPC URL
const PROVIDER_URL = process.env.PROVIDER_URL || "https://rpc-mumbai.maticvigil.com";

async function checkWalletStatus() {
  try {
    console.log(`Checking relayer wallet status at: ${RELAYER_URL}`);
    const response = await fetch(`${RELAYER_URL}/wallet-info`);
    const data = await response.json();
    
    console.log('\n==== Relayer Wallet Status ====');
    console.log(`Address: ${data.address}`);
    console.log(`Balance: ${data.balance} MATIC`);
    console.log(`Authorized: ${data.authorized}`);
    console.log(`Current Nonce: ${data.nonce}`);
    console.log(`Network: ${data.network.name} (Chain ID: ${data.network.chainId})`);
    console.log(`\nGas Information:`);
    console.log(`Current Gas Price: ${data.gasData.currentGasPrice} Gwei`);
    console.log(`Typical Transaction Cost: ${data.gasData.typicalTransactionCost} MATIC`);
    
    if (!data.status.hasEnoughFunds) {
      console.error('\n⚠️ WARNING: Relayer has insufficient funds!');
      console.log(`Minimum recommended balance: ${data.status.minBalance} MATIC`);
      console.log('Please add more MATIC to the relayer wallet.');
    }
    
    return data;
  } catch (error) {
    console.error('Error getting wallet info:', error.message);
    return null;
  }
}

async function sendEmptyTransaction() {
  console.log('\n==== Sending Empty Transaction to Reset Nonce ====');
  try {
    // Connect to provider
    const provider = new ethers.providers.JsonRpcProvider(PROVIDER_URL);
    const wallet = new ethers.Wallet(PRIVATE_KEY, provider);
    
    // Get current gas price
    const gasPrice = await provider.getGasPrice();
    // Use 10% higher gas price to ensure it goes through
    const adjustedGasPrice = gasPrice.mul(110).div(100);
    
    console.log(`Sending from: ${wallet.address}`);
    console.log(`Current gas price: ${ethers.utils.formatUnits(gasPrice, 'gwei')} Gwei`);
    console.log(`Using gas price: ${ethers.utils.formatUnits(adjustedGasPrice, 'gwei')} Gwei`);
    
    // Send transaction to self with 0 value (just to consume a nonce)
    const tx = await wallet.sendTransaction({
      to: wallet.address,
      value: ethers.utils.parseEther("0"),
      gasLimit: 21000,
      maxFeePerGas: adjustedGasPrice,
      maxPriorityFeePerGas: ethers.utils.parseUnits("1", "gwei")
    });
    
    console.log(`Transaction submitted: ${tx.hash}`);
    console.log(`View on explorer: https://mumbai.polygonscan.com/tx/${tx.hash}`);
    
    console.log('\nWaiting for transaction confirmation...');
    const receipt = await tx.wait(1);
    console.log(`Transaction confirmed in block ${receipt.blockNumber}`);
    console.log(`Gas used: ${receipt.gasUsed.toString()}`);
    
    return true;
  } catch (error) {
    console.error('Error sending transaction:', error.message);
    return false;
  }
}

async function main() {
  // First check wallet status
  const walletData = await checkWalletStatus();
  
  if (!walletData) {
    console.error('\nFailed to get wallet data. Please check if relayer service is running.');
    return;
  }
  
  // Create readline interface
  const rl = createInterface({
    input: process.stdin,
    output: process.stdout
  });
  
  // Ask if user wants to send a nonce-resetting transaction
  rl.question('\nDo you want to send an empty transaction to reset the nonce? (y/n) ', async (answer) => {
    const input = answer.trim().toLowerCase();
    if (input === 'y' || input === 'yes') {
      const success = await sendEmptyTransaction();
      if (success) {
        // Check wallet status again after transaction
        console.log('\nChecking wallet status again...');
        await checkWalletStatus();
      }
    } else {
      console.log('Operation cancelled.');
    }
    rl.close();
  });
}

// Run the script
main().catch(error => {
  console.error('Error:', error);
  process.exit(1);
}); 