import { ethers } from "ethers";

// Contract Address on Polygon
export const CONTRACT_ADDRESS = "0x14b1c2df30f31f43126e6bef94009d0b1b9cc51c";

// ABI for GasOptimizedVotingSystem
export const CONTRACT_ABI = [
  // Poll creation
  "function createPoll(string calldata _title, string[] calldata _candidateNames, uint24 _durationHours, bool _isPublic, uint64 _maxVoters, bytes32 _merkleRoot, uint8 _merkleDepth) external payable",
  
  // Fund management
  "function depositFunds() external payable",
  "function setRelayerAllowance(address _relayer, uint256 _amount) external",
  "function withdrawFunds(uint256 _amount) external",
  
  // Voting
  "function vote(uint256 _pollId, uint16 _candidateId) external",
  "function metaVote(uint256 _pollId, uint16 _candidateId, address _voter, bytes32[] calldata _merkleProof, bytes calldata _signature) external",
  
  // View functions
  "function getPollDetails(uint256 _pollId) external view returns (string memory title, address creator, uint64 endTime, uint16 candidateCount, bool isPublic, uint64 voterCount, uint64 maxVoters)",
  "function getCandidate(uint256 _pollId, uint16 _candidateId) external view returns (string memory name, uint64 voteCount)",
  "function hasVoted(uint256 _pollId, address _voter) external view returns (bool)",
  "function getPollsCount() external view returns (uint256)",
  
  // Relayer functions
  "function defaultRelayerWallet() external view returns (address)",
  "function authorizedRelayers(address) external view returns (bool)",
  "function setRelayerStatus(address _relayer, bool _status) external",
  "function updateDefaultRelayer(address _newDefaultRelayer) external",
  "function isAuthorizedRelayer(address _relayer) external view returns (bool)",
  
  // Events
  "event PollCreated(uint256 indexed pollId, address indexed creator)",
  "event Voted(uint256 indexed pollId, address indexed voter)",
  "event RelayerAdded(address indexed relayer, bool status)",
  "event DefaultRelayerUpdated(address indexed oldRelayer, address indexed newRelayer)",
  
  // Mappings (state variables)
  "function relayerAllowance(address, address) external view returns (uint256)"
];

// Check if window.ethereum is available
export const isMetaMaskAvailable = () => {
  return typeof window !== "undefined" && typeof window.ethereum !== "undefined";
};

// Get ethers provider
export const getProvider = () => {
  if (!isMetaMaskAvailable()) return null;
  return new ethers.providers.Web3Provider(window.ethereum);
};

// Get contract instance
export const getContract = (providerOrSigner: ethers.providers.Provider | ethers.Signer) => {
  return new ethers.Contract(CONTRACT_ADDRESS, CONTRACT_ABI, providerOrSigner);
};

// Format address for display
export const formatAddress = (address: string) => {
  if (!address) return "";
  return `${address.substring(0, 6)}...${address.substring(address.length - 4)}`;
};

// Format timestamp to readable date
export const formatTimestamp = (timestamp: number) => {
  return new Date(timestamp * 1000).toLocaleString();
};

// Calculate time remaining
export const timeRemaining = (endTime: number) => {
  const now = Math.floor(Date.now() / 1000);
  const remaining = endTime - now;
  
  if (remaining <= 0) return "Ended";
  
  const days = Math.floor(remaining / 86400);
  const hours = Math.floor((remaining % 86400) / 3600);
  const minutes = Math.floor((remaining % 3600) / 60);
  
  if (days > 0) return `${days}d ${hours}h remaining`;
  if (hours > 0) return `${hours}h ${minutes}m remaining`;
  return `${minutes}m remaining`;
};

// Helper for EIP-712 typed data signing for meta-transactions
export const signVote = async (
  signer: ethers.Signer,
  pollId: number,
  candidateId: number,
  voter: string
) => {
  const domain = {
    name: "GasOptimizedVotingSystem",
    version: "1",
    chainId: (await signer.getChainId()),
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
    voter
  };

  // Sign using EIP-712 (ethers v5 way)
  return (signer as any)._signTypedData(domain, types, value);
};

// Parse BigNumber to JavaScript number safely
export const parseNumber = (value: ethers.BigNumber) => {
  try {
    return value.toNumber();
  } catch (e) {
    return 0;
  }
};

// Interface for Poll data
export interface Poll {
  id: number;
  title: string;
  creator: string;
  endTime: number;
  candidateCount: number;
  isPublic: boolean;
  voterCount: number;
  maxVoters: number;
  candidates?: Candidate[];
}

// Interface for Candidate data
export interface Candidate {
  id: number;
  name: string;
  voteCount: number;
}
