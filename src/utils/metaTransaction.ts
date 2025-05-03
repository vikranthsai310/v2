import { ethers } from "ethers";
import { CONTRACT_ADDRESS } from "./contract";
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

// Function to submit a meta-transaction to a relayer service
export const submitMetaTransaction = async (
  pollId: number,
  candidateId: number,
  voter: string,
  signature: string,
  merkleProof: string[] = []
): Promise<RelayerResponse> => {
  // In a real application, this would call an actual relayer service API
  // Here we're implementing it directly in the frontend for development purposes
  
  console.log("Submitting meta transaction:", {
    pollId,
    candidateId,
    voter,
    signature,
    merkleProof
  });
  
  try {
    // Get the contract instance to interact with the blockchain
    const provider = new ethers.providers.Web3Provider(window.ethereum);
    const signer = provider.getSigner();
    
    // Get contract with full ABI for read/write operations
    const contract = new ethers.Contract(
      CONTRACT_ADDRESS, 
      [
        "function getPollDetails(uint256 _pollId) external view returns (string memory title, address creator, uint64 endTime, uint16 candidateCount, bool isPublic, uint64 voterCount, uint64 maxVoters)",
        "function metaVote(uint256 _pollId, uint16 _candidateId, address _voter, bytes32[] calldata _merkleProof, bytes calldata _signature) external",
        "function vote(uint256 _pollId, uint16 _candidateId) external", // Added direct vote function
        "function isAuthorizedRelayer(address _relayer) external view returns (bool)",
        "function hasVoted(uint256 _pollId, address _voter) external view returns (bool)",
        "function relayerAllowance(address, address) external view returns (uint256)"
      ], 
      signer
    );
    
    // First check if user has already voted
    const hasVoted = await contract.hasVoted(pollId, voter);
    if (hasVoted) {
      return {
        success: false,
        message: "You have already voted in this poll on the blockchain."
      };
    }
    
    // Get poll creator address and details
    const [title, creator, endTime, candidateCount, isPublic, voterCount, maxVoters] = await contract.getPollDetails(pollId);
    console.log("Poll creator:", creator);
    
    // Get current user address (for development only - in production this would be the relayer)
    const userAddress = await signer.getAddress();
    console.log("User address:", userAddress);
    
    // Check creator funds on the blockchain
    const creatorFunds = await contract.relayerAllowance(creator, ethers.constants.AddressZero);
    const creatorFundsEth = parseFloat(ethers.utils.formatEther(creatorFunds));
    console.log(`Creator blockchain funds: ${creatorFundsEth} MATIC`);
    
    // Check user's wallet balance for direct voting
    const userBalance = await provider.getBalance(userAddress);
    const userBalanceEth = parseFloat(ethers.utils.formatEther(userBalance));
    console.log(`User wallet balance: ${userBalanceEth} MATIC`);
    
    // Estimate gas fee (in a real system, this would be calculated more accurately)
    const estimatedGasFee = 0.001; // Simplified for demo
    
    if (creatorFundsEth < estimatedGasFee) {
      return {
        success: false,
        message: "Insufficient creator funds on the blockchain. The creator needs to deposit more MATIC."
      };
    }
    
    // For direct voting, check if user has enough funds
    if (userBalanceEth < estimatedGasFee) {
      return {
        success: false,
        message: "Your wallet doesn't have enough MATIC to cover gas fees. Please add funds to your wallet."
      };
    }
    
    toast.info("Submitting vote to blockchain...");
    
    try {
      // In development mode, we'll use the direct vote function to bypass relayer checks
      // This simulates what would happen in production with a proper relayer
      console.log("Using direct vote for development mode to bypass relayer authorization");
      
      // Call the regular vote function instead of metaVote to bypass relayer authorization
      const tx = await contract.vote(pollId, candidateId);
      
      toast.info("Vote transaction submitted! Waiting for confirmation...");
      
      // Wait for transaction to be mined
      const receipt = await tx.wait();
      console.log("Transaction confirmed:", receipt);
      
      return {
        success: true,
        message: "Vote submitted successfully and recorded on the blockchain!",
        txHash: receipt.transactionHash,
        pollId: pollId,
        candidateId: candidateId
      };
    } catch (directVoteError: any) {
      console.error("Direct vote error:", directVoteError);
      
      // If direct vote fails for some reason, return the error
      const errorMessage = directVoteError.message || "Unknown error";
      
      if (errorMessage.includes("Insufficient funds")) {
        return {
          success: false,
          message: "You don't have enough MATIC in your wallet to cover the gas fee. Please add funds to your wallet."
        };
      } else {
        return {
          success: false,
          message: `Failed to submit vote: ${directVoteError.message || "Unknown error"}`
        };
      }
    }
    
  } catch (error: any) {
    console.error("Error in meta transaction:", error);
    
    // Parse error message to provide user-friendly feedback
    const errorMessage = error.message || "Unknown error";
    
    if (errorMessage.includes("Already voted")) {
      return {
        success: false,
        message: "You have already voted in this poll on the blockchain."
      };
    } else if (errorMessage.includes("Insufficient relayer funds")) {
      return {
        success: false,
        message: "Insufficient funds from poll creator on the blockchain to cover gas costs."
      };
    } else if (errorMessage.includes("user rejected")) {
      return {
        success: false,
        message: "Transaction rejected by user. Please try again."
      };
    } else {
      return {
        success: false,
        message: `Blockchain error: ${errorMessage.slice(0, 100)}...`
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
