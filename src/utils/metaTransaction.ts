import { ethers } from "ethers";
import { CONTRACT_ADDRESS, RELAYER_SERVICE_URL, debugLog } from "./config";
import { toast } from "sonner";

// Interface for Relayer Service
export interface RelayerResponse {
  success: boolean;
  message: string;
  txHash?: string;
  gasFee?: number;
  pollId?: number;
  candidateId?: number;
}

// Default relayer wallet (this would normally be obtained from the contract directly)
// The actual value is set during contract deployment and can be retrieved via the defaultRelayerWallet() method
export const DEFAULT_RELAYER_WALLET = "0xF0B5381A05A8d8368C7D3af031F7B50e979CeA12"; // Dedicated relayer address

// Keep track of relayer funds deductions (in a real app, this would be handled by a backend)
let userRelayerFunds: { [address: string]: number } = {};

// Function to initialize relayer funds for a user
export const initializeRelayerFunds = (address: string, amount: number) => {
  if (!userRelayerFunds[address.toLowerCase()]) {
    userRelayerFunds[address.toLowerCase()] = amount;
  }
};

// Function to get current relayer funds for a user
export const getRelayerFunds = (address: string): number => {
  return userRelayerFunds[address.toLowerCase()] || 0;
};

// Function to update relayer funds (add or withdraw)
export const updateRelayerFunds = (address: string, amount: number, isDeposit: boolean = true) => {
  const lowerCaseAddress = address.toLowerCase();
  
  if (!userRelayerFunds[lowerCaseAddress]) {
    userRelayerFunds[lowerCaseAddress] = 0;
  }
  
  if (isDeposit) {
    userRelayerFunds[lowerCaseAddress] += amount;
  } else {
    userRelayerFunds[lowerCaseAddress] -= amount;
    if (userRelayerFunds[lowerCaseAddress] < 0) {
      userRelayerFunds[lowerCaseAddress] = 0;
    }
  }
  
  return userRelayerFunds[lowerCaseAddress];
};

// EIP-712 domain and type definitions for voting
export const EIP712_DOMAIN = {
  name: "GasOptimizedVotingSystem",
  version: "1",
  // chainId will be filled at runtime
  // verifyingContract will be CONTRACT_ADDRESS
};

export const EIP712_VOTE_TYPE = {
  Vote: [
    { name: "pollId", type: "uint256" },
    { name: "candidateId", type: "uint16" },
    { name: "voter", type: "address" }
  ]
};

// Relayer service endpoint is now imported from config.ts

// Add a function to check if the relayer service is available
export const checkRelayerServiceStatus = async (): Promise<boolean> => {
  try {
    const response = await fetch(`${RELAYER_SERVICE_URL}/status`, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' }
    });
    
    if (!response.ok) return false;
    
    const result = await response.json();
    return result.success === true;
  } catch (error) {
    console.error("Error checking relayer service:", error);
    return false;
  }
};

// Function to submit a meta-transaction to a relayer service
export const submitMetaTransaction = async (
  pollId: number,
  candidateId: number,
  voter: string,
  signature: string,
  merkleProof: string[] = []
): Promise<RelayerResponse> => {
  debugLog("Submitting meta transaction:", {
    pollId,
    candidateId,
    voter,
    signature: signature.substring(0, 20) + "...", // Truncate for logging
    merkleProof: merkleProof.length > 0 ? "Provided" : "None"
  }, "info");
  
  try {
    // Check if relayer service is available first
    const isRelayerAvailable = await checkRelayerServiceStatus();
    if (!isRelayerAvailable) {
      debugLog("Relayer service unavailable during pre-check", null, "error");
      return {
        success: false,
        message: "Relayer service appears to be offline. Please try again later."
      };
    }
    
    // Send the signed vote to the relayer service
    toast.info("Sending signed vote to relayer service...");
    debugLog("Using relayer URL:", RELAYER_SERVICE_URL, "info");
    
    // Debug log the exact payload being sent
    const payload = {
      pollId: pollId.toString(),
      candidateId: candidateId.toString(),
      voter,
      signature,
      merkleProof: merkleProof || []
    };
    
    debugLog("Payload being sent to relayer:", payload, "info");
    
    // Set up fetch with improved timeout
    const timeoutDuration = 45000; // 45 seconds timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => {
      debugLog("Request timeout reached, aborting", null, "warn");
      controller.abort();
    }, timeoutDuration);
    
    // Add retry capability
    let retryCount = 0;
    const maxRetries = 2;
    
    const makeRequest = async () => {
      try {
        // Call the relayer service API with timeout
        debugLog(`Submitting vote request (attempt ${retryCount + 1})`, null, "info");
        const response = await fetch(`${RELAYER_SERVICE_URL}/submit-vote`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json'
          },
          body: JSON.stringify(payload),
          signal: controller.signal,
          mode: 'cors',
          cache: 'no-cache'
        });
        
        // Parse the response
        const result = await response.json();
        
        // Check if the request was successful
        if (!response.ok) {
          debugLog("Relayer service error:", result, "error");
          
          // Handle specific error codes
          if (response.status === 400) {
            if (result.message?.includes("already voted")) {
              return {
                success: false,
                message: "You have already voted in this poll."
              };
            } else if (result.message?.includes("Insufficient") || result.message?.includes("funds")) {
              return {
                success: false,
                message: "Poll creator doesn't have enough funds to cover gas fees for voting."
              };
            } else if (result.message?.includes("Invalid")) {
              return {
                success: false,
                message: "Invalid vote signature. Please try again."
              };
            } else if (result.message?.includes("ended")) {
              return {
                success: false,
                message: "This poll has ended. Voting is no longer possible."
              };
            } else if (result.message?.includes("Maximum voters")) {
      return {
        success: false,
                message: "Maximum number of voters reached for this poll."
      };
            }
    }
    
      return {
        success: false,
            message: result.message || "Failed to submit vote through relayer service"
          };
        }
        
        // Check for transaction hash in the response
        if (!result.txHash) {
          debugLog("Relayer response missing transaction hash:", result, "warn");
          
          // Still return success if the relayer said it was successful
          if (result.success) {
      return {
        success: true,
              message: "Vote submitted via relayer. Waiting for blockchain confirmation...",
        pollId: pollId,
        candidateId: candidateId
      };
          } else {
        return {
          success: false,
              message: result.message || "Relayer failed to process the vote"
        };
          }
        }
        
        // Return the result from the relayer
        return {
          success: true,
          message: "Vote submitted via relayer and recorded on the blockchain!",
          txHash: result.txHash,
          pollId: pollId,
          candidateId: candidateId
        };
      } catch (error: any) {
        // If we have retries left and it's a fetch/network error (not an abort), retry
        if (retryCount < maxRetries && error.name !== "AbortError") {
          retryCount++;
          debugLog(`Retrying request (${retryCount}/${maxRetries})`, null, "warn");
          // Exponential backoff - 2, 4 seconds
          await new Promise(resolve => setTimeout(resolve, retryCount * 2000));
          return makeRequest();
        }
        throw error;
      }
    };
    
    try {
      // Make the request with retry capability
      const result = await makeRequest();
      
      // Clear the timeout as we got a response
      clearTimeout(timeoutId);
      
      return result;
    } catch (error: any) {
      // Clear the timeout to free resources
      clearTimeout(timeoutId);
      
      // Re-throw the error for the outer catch
      throw error;
    }
  } catch (error: any) {
    console.error("Error in meta transaction:", error);
    
    // Check for abort error (timeout)
    if (error.name === "AbortError") {
      return {
        success: false,
        message: "Request to relayer service timed out. The network might be congested. Your vote might still be processed, please check back later."
      };
    }
    
    // Parse error message to provide user-friendly feedback
    const errorMessage = error.message || "Unknown error";
    
    if (errorMessage.includes("Already voted")) {
      return {
        success: false,
        message: "You have already voted in this poll on the blockchain."
      };
    } else if (errorMessage.includes("Insufficient") || errorMessage.includes("funds")) {
      return {
        success: false,
        message: "Insufficient funds from poll creator on the blockchain to cover gas costs."
      };
    } else if (errorMessage.includes("user rejected") || errorMessage.includes("User denied")) {
      return {
        success: false,
        message: "Transaction rejected by user. Please try again."
      };
    } else if (errorMessage.includes("Network request failed") || errorMessage.includes("Failed to fetch")) {
      return {
        success: false,
        message: "Failed to connect to relayer service. Please check your internet connection and try again later."
      };
    } else {
      return {
        success: false,
        message: `Error: ${errorMessage.slice(0, 100)}${errorMessage.length > 100 ? '...' : ''}`
      };
    }
  }
};

// Simple merkle tree implementation updated to match contract verification
export class MerkleTree {
  private leaves: string[];
  private layers: string[][];
  
  constructor(addresses: string[]) {
    // Hash all addresses
    this.leaves = addresses.map(addr => 
      ethers.utils.keccak256(ethers.utils.solidityPack(["address"], [addr]))
    );
    
    // Sort leaves for deterministic trees
    this.leaves.sort((a, b) => a.localeCompare(b));
    
    // Build tree
    this.layers = [this.leaves];
    this.buildTree();
  }
  
  private buildTree(): void {
    let layer = this.leaves;
    
    while (layer.length > 1) {
      const nextLayer: string[] = [];
      
      for (let i = 0; i < layer.length; i += 2) {
        if (i + 1 < layer.length) {
          // Hash pair of elements using the same ordering logic as the contract
          const left = layer[i];
          const right = layer[i + 1];
          
          const hash = left <= right
            ? ethers.utils.keccak256(ethers.utils.solidityPack(["bytes32", "bytes32"], [left, right]))
            : ethers.utils.keccak256(ethers.utils.solidityPack(["bytes32", "bytes32"], [right, left]));
          
          nextLayer.push(hash);
        } else {
          // Odd number of elements, push last one up
          nextLayer.push(layer[i]);
        }
      }
      
      this.layers.push(nextLayer);
      layer = nextLayer;
    }
  }
  
  public getRoot(): string {
    return this.layers[this.layers.length - 1][0];
  }
  
  public getProof(address: string): string[] {
    const leaf = ethers.utils.keccak256(ethers.utils.solidityPack(["address"], [address]));
    let idx = this.leaves.indexOf(leaf);
    
    if (idx === -1) return [];
    
    const proof: string[] = [];
    
    for (let i = 0; i < this.layers.length - 1; i++) {
      const layer = this.layers[i];
      const isOdd = idx % 2 === 1;
      
      if (isOdd) {
        // We're on the right, get element to the left
        proof.push(layer[idx - 1]);
      } else if (idx + 1 < layer.length) {
        // We're on the left, get element to the right
        proof.push(layer[idx + 1]);
      }
      
      // Move up to the parent index
      idx = Math.floor(idx / 2);
    }
    
    return proof;
  }
  
  public getDepth(): number {
    return this.layers.length - 1;
  }
}

// Generate a Merkle tree from an array of addresses
export const generateMerkleTree = (addresses: string[]): MerkleTree => {
  return new MerkleTree(addresses);
};

// Parse CSV string to array of addresses
export const parseAddressCSV = (csv: string): string[] => {
  return csv
    .split(/[\n,]/)
    .map(addr => addr.trim())
    .filter(addr => ethers.utils.isAddress(addr));
};

// Helper function to check if an address is an authorized relayer
export const checkRelayerAuthorization = async (): Promise<boolean> => {
  try {
    const provider = new ethers.providers.Web3Provider(window.ethereum);
    const signer = provider.getSigner();
    const userAddress = await signer.getAddress();
    
    // Get contract with ABI for checking relayer status
    const contract = new ethers.Contract(
      CONTRACT_ADDRESS, 
      [
        "function isAuthorizedRelayer(address _relayer) external view returns (bool)",
        "function defaultRelayerWallet() external view returns (address)"
      ], 
      provider
    );
    
    // Check if the current address is authorized
    const isAuthorized = await contract.isAuthorizedRelayer(userAddress);
    const defaultRelayer = await contract.defaultRelayerWallet();
    
    console.log("Relayer authorization check:", {
      address: userAddress,
      isAuthorized,
      defaultRelayer,
      isDefaultRelayer: defaultRelayer.toLowerCase() === userAddress.toLowerCase()
    });
    
    return isAuthorized;
  } catch (error) {
    console.error("Error checking relayer authorization:", error);
    return false;
  }
};
