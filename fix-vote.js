// Simple script to fix voting issues (CommonJS version)
const { ethers } = require('ethers');
const fetch = require('node-fetch');
require('dotenv').config();

// Network configuration
const RPC_URL = process.env.PROVIDER_URL || "https://rpc-mumbai.maticvigil.com";
const RELAYER_URL = process.env.RELAYER_URL || 'http://localhost:3002';

async function resetNonce() {
  console.log("\n============= RESETTING NONCE =============");
  
  try {
    // Check if private key exists
    if (!process.env.RELAYER_PRIVATE_KEY) {
      console.error("No RELAYER_PRIVATE_KEY found in .env file!");
      console.log("Please make sure you have a valid .env file with your private key");
      return false;
    }
    
    const provider = new ethers.providers.JsonRpcProvider(RPC_URL);
    const wallet = new ethers.Wallet(process.env.RELAYER_PRIVATE_KEY, provider);
    
    console.log(`Wallet address: ${wallet.address}`);
    const nonce = await provider.getTransactionCount(wallet.address);
    console.log(`Current nonce: ${nonce}`);
    
    // Send transaction to self with 0 value to reset nonce
    console.log("\nSending 0 MATIC to self to reset nonce...");
    const tx = await wallet.sendTransaction({
      to: wallet.address,
      value: 0,
      gasLimit: 21000
    });
    
    console.log(`Transaction sent: ${tx.hash}`);
    console.log(`View on explorer: https://mumbai.polygonscan.com/tx/${tx.hash}`);
    
    console.log("\nWaiting for confirmation...");
    const receipt = await tx.wait(1);
    console.log(`✅ Transaction confirmed in block ${receipt.blockNumber}`);
    
    return true;
  } catch (error) {
    console.error("\n❌ Error resetting nonce:", error.message);
    if (error.message.includes("insufficient funds")) {
      console.log("\nThe relayer wallet doesn't have enough MATIC to send a transaction.");
      console.log("Please add more MATIC to the relayer wallet using a faucet:");
      console.log("https://mumbaifaucet.com/");
    }
    return false;
  }
}

async function main() {
  console.log("============= VOTE FIXER =============");
  console.log("This script will fix voting issues by resetting your relayer nonce");
  
  // Ask for confirmation
  console.log("\nDo you want to reset the relayer wallet nonce? (yes/no)");
  process.stdin.once('data', async (data) => {
    const input = data.toString().trim().toLowerCase();
    
    if (input === 'yes' || input === 'y') {
      const success = await resetNonce();
      if (success) {
        console.log("\n============= FIXING COMPLETE =============");
        console.log("To complete the fix, please:");
        console.log("1. Restart your relayer service (Ctrl+C and npm run dev)");
        console.log("2. Use a DIFFERENT wallet than the relayer wallet to vote");
        console.log("3. The relayer wallet cannot vote for itself!");
      }
    } else {
      console.log("Operation cancelled.");
    }
    
    process.exit(0);
  });
}

// Run the script
main().catch(error => {
  console.error("Unexpected error:", error);
  process.exit(1);
}); 