const ethers = require('ethers');
require('dotenv').config();

// Connect to the provider
const provider = new ethers.providers.JsonRpcProvider('https://polygon-rpc.com');
console.log(`Connecting to https://polygon-rpc.com...`);

const main = async () => {
  try {
    console.log("========== RELAYER DIAGNOSTIC TOOL ==========");
    
    // Get network info
    const network = await provider.getNetwork();
    console.log(`Connected to network: ${network.name} (chainId: ${network.chainId})`);
    
    // Contract address
    const contractAddress = '0x4995f6754359b2ec0b9d537c2f839e3dc01f6240';
    console.log(`Creating contract instance at ${contractAddress}...`);
    
    // Contract ABI (only the functions we need)
    const contractABI = [
      "function defaultRelayerWallet() external view returns (address)",
      "function authorizedRelayers(address) external view returns (bool)",
      "function isAuthorizedRelayer(address _relayer) external view returns (bool)",
      "function metaVote(uint256 _pollId, uint16 _candidateId, address _voter, bytes32[] calldata _merkleProof, bytes calldata _signature) external",
      "function hasVoted(uint256 _pollId, address _voter) external view returns (bool)",
      "function getPollDetails(uint256 _pollId) external view returns (string memory title, address creator, uint64 endTime, uint16 candidateCount, bool isPublic, uint64 voterCount, uint64 maxVoters)",
      "function getPollsCount() external view returns (uint256)",
      "function relayerAllowance(address, address) external view returns (uint256)"
    ];
    
    // Create contract instance
    const contract = new ethers.Contract(contractAddress, contractABI, provider);
    
    // 1. Check default relayer
    try {
      const defaultRelayer = await contract.defaultRelayerWallet();
      console.log(`Default relayer: ${defaultRelayer}`);
      
      // Now check if relayer is authorized
      const isAuthorized = await contract.isAuthorizedRelayer(defaultRelayer);
      console.log(`Default relayer is authorized: ${isAuthorized}`);
    } catch (error) {
      console.error(`Error checking default relayer: ${error.message}`);
    }
    
    // 2. Check connected wallet
    try {
      // Connect with wallet to test transaction
      const wallet = new ethers.Wallet(process.env.RELAYER_PRIVATE_KEY || '0x0123456789012345678901234567890123456789012345678901234567890123', provider);
      console.log(`\nConnected with wallet: ${wallet.address}`);
      
      // Check if our relayer is authorized
      const isAuthorized = await contract.isAuthorizedRelayer(wallet.address);
      console.log(`Our relayer wallet is authorized: ${isAuthorized}`);
      
      // Check balance
      const balance = await provider.getBalance(wallet.address);
      console.log(`Relayer wallet balance: ${ethers.utils.formatEther(balance)} MATIC`);
      
      if (ethers.utils.formatEther(balance) < 0.01) {
        console.log(`⚠️ WARNING: Relayer wallet balance is low. Consider adding more funds.`);
      }
    } catch (error) {
      console.error(`Error checking wallet: ${error.message}`);
    }
    
    // 3. Get total number of polls
    try {
      const pollsCount = await contract.getPollsCount();
      console.log(`\nTotal number of polls: ${pollsCount.toString()}`);
      
      // Check each poll
      for (let i = 0; i < Math.min(pollsCount.toNumber(), 5); i++) {
        console.log(`\n--------- Poll ID: ${i} ---------`);
        
        try {
          const [title, creator, endTime, candidateCount, isPublic, voterCount, maxVoters] = await contract.getPollDetails(i);
          
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
            console.log(`⚠️ Poll has already ended! End time: ${formattedDetails.endTime}`);
          } else {
            console.log(`✅ Poll is active. End time: ${formattedDetails.endTime}`);
          }
          
          // Check if poll is full
          if (voterCount.toString() === maxVoters.toString()) {
            console.log(`⚠️ Poll is full: ${voterCount}/${maxVoters} voters`);
          } else {
            console.log(`✅ Poll has space: ${voterCount}/${maxVoters} voters`);
          }
          
          // Check creator funds
          const funds = await contract.relayerAllowance(creator, ethers.constants.AddressZero);
          console.log(`Creator funds for gasless voting: ${ethers.utils.formatEther(funds)} MATIC`);
          
          if (ethers.utils.formatEther(funds) < 0.005) {
            console.log(`⚠️ WARNING: Creator funds are low. Voting might fail.`);
          } else {
            console.log(`✅ Creator has sufficient funds.`);
          }
          
        } catch (error) {
          console.error(`Error checking poll ${i}: ${error.message}`);
        }
      }
      
      // 4. Test signature verification with sample data for poll ID 2
      console.log(`\n--------- Testing Meta-Vote for Poll ID 2 ---------`);
      
      // Generate a test signature 
      const wallet = new ethers.Wallet(process.env.RELAYER_PRIVATE_KEY || '0x0123456789012345678901234567890123456789012345678901234567890123', provider);
      const contractWithSigner = contract.connect(wallet);
      
      // Sample parameters for testing
      const pollId = 2;
      const candidateId = 0;
      const testWallet = ethers.Wallet.createRandom();
      const testVoter = testWallet.address;
      
      // To prevent actual transactions from being sent, we'll just check if the call would be successful
      try {
        console.log(`Checking if voter ${testVoter} has already voted in poll ${pollId}...`);
        const hasVoted = await contract.hasVoted(pollId, testVoter);
        console.log(`Voter has voted: ${hasVoted}`);
        
        if (!hasVoted) {
          console.log(`Checking meta-vote prerequisites for poll ${pollId}...`);
          const [title, creator, endTime, candidateCount, isPublic, voterCount, maxVoters] = await contract.getPollDetails(pollId);
          
          // Check all preconditions
          const currentTimestamp = Math.floor(Date.now() / 1000);
          
          if (endTime.toNumber() < currentTimestamp) {
            console.log(`❌ Poll has ended. Meta-vote will fail.`);
          } else if (voterCount.toNumber() >= maxVoters.toNumber()) {
            console.log(`❌ Poll is full. Meta-vote will fail.`);
          } else {
            console.log(`✅ Meta-vote prerequisites pass for poll ${pollId}. Transaction should be successful.`);
          }
        } else {
          console.log(`❌ Voter has already voted. Meta-vote will fail.`);
        }
      } catch (error) {
        console.error(`Error checking meta-vote for poll ${pollId}: ${error.message}`);
      }
      
    } catch (error) {
      console.error(`Error getting polls count: ${error.message}`);
    }
    
    console.log("\n========== DIAGNOSTIC COMPLETE ==========");
  } catch (error) {
    console.error(`Error in diagnostic: ${error.message}`);
  }
};

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  }); 