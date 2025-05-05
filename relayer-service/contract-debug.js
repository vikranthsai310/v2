// Script to debug the contract's metaVote function
const ethers = require('ethers');
require('dotenv').config();

// Read poll ID from command line arguments or default to 0
const pollId = process.argv[2] ? parseInt(process.argv[2]) : 0;
console.log(`Checking poll ${pollId} details...`);

// For testing, you can set these addresses
const debugVoter = '0x67e936fe37e0b5338ab3e7c168e90adcb11acd16';
const debugSignature = '0xd3b4bc67d3ad88a5168fbfacb42bbc07e18ef92ccc4a49e0bb6fb3a34d70c0ad06a1824e50d7c6fe0aae12efc759788c8ea5e7c20e3dd2df6ad63a2396f71cdd1c';
// Can be 0, 1, etc. based on the candidate you're voting for
const candidateId = 0;

// Connect to the provider
const provider = new ethers.providers.JsonRpcProvider('https://polygon-rpc.com');
console.log(`Connecting to https://polygon-rpc.com...`);

provider.getNetwork().then(async (network) => {
  console.log(`Connected to network: ${network.name} (chainId: ${network.chainId})`);

  // Contract address
  const contractAddress = '0x4995f6754359b2ec0b9d537c2f839e3dc01f6240';
  console.log(`Creating contract instance at ${contractAddress}...`);

  // Contract ABI (only the functions we need) - updated to match src/utils/contract.ts
  const contractABI = [
    "function defaultRelayerWallet() external view returns (address)",
    "function isAuthorizedRelayer(address _relayer) external view returns (bool)",
    "function metaVote(uint256 _pollId, uint16 _candidateId, address _voter, bytes32[] calldata _merkleProof, bytes calldata _signature) external",
    "function hasVoted(uint256 _pollId, address _voter) external view returns (bool)",
    "function getPollDetails(uint256 _pollId) external view returns (string memory title, address creator, uint64 endTime, uint16 candidateCount, bool isPublic, uint64 voterCount, uint64 maxVoters)"
  ];

  // Create contract instance
  const contract = new ethers.Contract(contractAddress, contractABI, provider);

  try {
    // Get default relayer
    const defaultRelayer = await contract.defaultRelayerWallet();
    console.log(`Contract is accessible. Default relayer: ${defaultRelayer}`);

    // Get poll details
    console.log(`\nChecking poll ${pollId} details...`);
    try {
      const [title, creator, endTime, candidateCount, isPublic, voterCount, maxVoters] = await contract.getPollDetails(pollId);
      
      const formattedDetails = {
        title,
        creator,
        endTime: new Date(endTime.toNumber() * 1000).toLocaleString(),
        candidateCount: candidateCount.toString(),
        isPublic,
        voterCount: voterCount.toString(),
        maxVoters: maxVoters.toString()
      };
      
      console.log('Poll details:', formattedDetails);
      
      // Check if poll has ended
      const currentTimestamp = Math.floor(Date.now() / 1000);
      if (endTime.toNumber() < currentTimestamp) {
        console.log(`❌ Poll has already ended! End time: ${formattedDetails.endTime}`);
      } else {
        console.log(`✅ Poll is active. End time: ${formattedDetails.endTime}`);
      }

      // Check if voter has already voted
      console.log(`\nChecking if ${debugVoter} has already voted...`);
      try {
        const hasVoted = await contract.hasVoted(pollId, debugVoter);
        console.log(`Voter has voted: ${hasVoted}`);
      } catch (error) {
        console.log(`Error checking voter status: ${error.message}`);
      }

      // Connect with wallet to test transaction
      const wallet = new ethers.Wallet(process.env.RELAYER_PRIVATE_KEY || '0x0123456789012345678901234567890123456789012345678901234567890123', provider);
      console.log(`\nConnected with wallet: ${wallet.address}`);
      
      // Check if relayer is authorized
      const isAuthorized = await contract.isAuthorizedRelayer(wallet.address);
      console.log(`Relayer is authorized: ${isAuthorized}`);
      
      // Create contract instance with signer
      const contractWithSigner = contract.connect(wallet);
      
      // Simulate metaVote call
      console.log(`\nSimulating metaVote call...`);
      try {
        // First, estimate gas to see if the transaction would succeed
        // Note: metaVote in the contract expects merkleProof as a parameter
        await contractWithSigner.estimateGas.metaVote(
          pollId,
          candidateId,
          debugVoter,
          [], // Empty merkle proof array
          debugSignature
        );
        console.log(`✅ metaVote call would succeed!`);
      } catch (error) {
        console.log(`❌ metaVote call would fail: ${error.message}`);
        
        // Extract more detailed error information when available
        if (error.error) {
          console.log(`\nDetailed error information:`);
          if (error.error.data) {
            console.log(`Error data: ${error.error.data}`);
            // 0xf645eedf is POLL_ENDED error signature in the contract
            if (error.error.data === '0xf645eedf') {
              console.log(`Error decoded: POLL_ENDED - The poll has already ended`);
            }
            // Add more error signature mappings as you identify them
          }
          if (error.error.message) {
            console.log(`Error message: ${error.error.message}`);
          }
        }
        
        // Check other common issues
        if (voterCount.toString() === maxVoters.toString()) {
          console.log(`❌ Poll has reached maximum voters: ${voterCount}/${maxVoters}`);
        }
        if (debugVoter.toLowerCase() === wallet.address.toLowerCase()) {
          console.log(`❌ Voter address is the same as the relayer address! This won't work.`);
        }
      }
    } catch (error) {
      console.log(`Failed to get poll details: ${error.message}`);
    }
  } catch (error) {
    console.log(`Error accessing contract: ${error.message}`);
  }
}).catch(error => {
  console.error(`Failed to connect to network: ${error.message}`);
}); 