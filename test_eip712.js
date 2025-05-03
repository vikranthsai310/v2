// Test script for EIP-712 signing in GasOptimizedVotingSystem
// Run with: node test_eip712.js

const { ethers } = require('ethers');

// Contract specifics
const CONTRACT_ADDRESS = "0x14b1c2df30f31f43126e6bef94009d0b1b9cc51c";
const CHAIN_ID = 80001; // Mumbai testnet - adjust as needed

// Mock data for testing
const pollId = 1;
const candidateId = 0;
const voterAddress = "0x70997970C51812dc3A010C7d01b50e0d17dc79C8"; // Example address

// EIP-712 domain and types definition
const domain = {
  name: "GasOptimizedVotingSystem",
  version: "1",
  chainId: CHAIN_ID,
  verifyingContract: CONTRACT_ADDRESS
};

const types = {
  Vote: [
    { name: "pollId", type: "uint256" },
    { name: "candidateId", type: "uint16" },
    { name: "voter", type: "address" }
  ]
};

const value = {
  pollId,
  candidateId,
  voterAddress
};

console.log("EIP-712 Test for GasOptimizedVotingSystem");
console.log("------------------------------------------");
console.log("Contract:", CONTRACT_ADDRESS);
console.log("Chain ID:", CHAIN_ID);
console.log("Poll ID:", pollId);
console.log("Candidate ID:", candidateId);
console.log("Voter:", voterAddress);
console.log("\nEIP-712 Domain:", JSON.stringify(domain, null, 2));
console.log("\nEIP-712 Types:", JSON.stringify(types, null, 2));
console.log("\nEIP-712 Value:", JSON.stringify(value, null, 2));

// To actually sign, you would need a wallet with private key:
/*
const wallet = new ethers.Wallet(privateKey);
const signature = await wallet._signTypedData(domain, types, value);
console.log("\nSignature:", signature);
*/

console.log("\nThis script helps verify the EIP-712 configuration is correct.");
console.log("To generate an actual signature, uncomment the signing code and provide a private key."); 