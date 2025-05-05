// Simple script to fix voting issues by resetting relayer nonce
import { ethers } from 'ethers';
import dotenv from 'dotenv';
import fetch from 'node-fetch';

// Load environment variables
dotenv.config();

// Network configuration
const RPC_URL = process.env.PROVIDER_URL || "https://rpc-mumbai.maticvigil.com";
const RELAYER_URL = process.env.RELAYER_URL || 'http://localhost:3002';

async function quickDiagnose() {
  console.log("============= VOTE FIXER =============");
  console.log("Diagnosing voting issues...");
  
  try {
    // Check relayer status
    console.log("\nChecking relayer service...");
    const statusResponse = await fetch(`${RELAYER_URL}/status`);
    if (!statusResponse.ok) {
      console.error("❌ Relayer service is not responding properly!");
      console.log(`Status: ${statusResponse.status} ${statusResponse.statusText}`);
      console.log("Make sure the relayer service is running and accessible.");
      return false;
    }
    
    const statusData = await statusResponse.json();
    console.log("✅ Relayer service is online:", statusData.address);
    console.log(`Authorized: ${statusData.authorized ? "Yes" : "No"}`);
    console.log(`Balance: ${statusData.balance} MATIC`);
    
    // Check if we have access to the private key
    if (!process.env.RELAYER_PRIVATE_KEY) {
      console.error("\n❌ No relayer private key found in environment variables!");
      console.log("The private key is needed to reset the nonce.");
      return false;
    }
    
    console.log("\n✅ Private key is available for resetting nonce");
    return true;
  } catch (error) {
    console.error("\n❌ Error diagnosing relayer:", error.message);
    return false;
  }
}

async function resetNonce() {
  console.log("\n============= RESETTING NONCE =============");
  
  try {
    const provider = new ethers.providers.JsonRpcProvider(RPC_URL);
    const wallet = new ethers.Wallet(process.env.RELAYER_PRIVATE_KEY, provider);
    
    console.log(`Wallet address: ${wallet.address}`);
    const nonce = await provider.getTransactionCount(wallet.address);
    console.log(`Current nonce: ${nonce}`);
    
    // Get current gas price
    const gasPrice = await provider.getGasPrice();
    const gasPriceGwei = ethers.utils.formatUnits(gasPrice, "gwei");
    console.log(`Current gas price: ${gasPriceGwei} Gwei`);
    
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
    
    // Check new nonce
    const newNonce = await provider.getTransactionCount(wallet.address);
    console.log(`New nonce: ${newNonce}`);
    
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

async function restartRelayer() {
  console.log("\n============= FIXING COMPLETE =============");
  console.log("To complete the fix, please restart your relayer service:");
  console.log("1. Stop the current relayer service (Ctrl+C in the terminal)");
  console.log("2. Start it again with: cd relayer-service && npm run dev");
  console.log("\nAfter restarting, try voting again with a different wallet than the relayer wallet.");
}

// Run the script
async function main() {
  const diagnosisOk = await quickDiagnose();
  
  if (diagnosisOk) {
    console.log("\nDiagnosis complete. Ready to fix voting issues.");
    console.log("This will reset the relayer wallet's nonce to fix stuck transactions.");
    
    // Ask for confirmation
    console.log("\nDo you want to proceed with the fix? (Type 'yes' to continue)");
    process.stdin.once('data', async (data) => {
      const input = data.toString().trim().toLowerCase();
      
      if (input === 'yes' || input === 'y') {
        const success = await resetNonce();
        if (success) {
          await restartRelayer();
        }
      } else {
        console.log("Operation cancelled.");
      }
      
      process.exit(0);
    });
  } else {
    console.log("\nCannot proceed with fixing due to issues found during diagnosis.");
    process.exit(1);
  }
}

main().catch(error => {
  console.error("Unexpected error:", error);
  process.exit(1);
}); 