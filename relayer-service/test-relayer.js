// Create a file named "relayer-test.js" in your relayer-service folder
const ethers = require('ethers');
require('dotenv').config();

const main = async () => {
  // Connect to the provider
  const provider = new ethers.providers.JsonRpcProvider('https://polygon-rpc.com');
  console.log(`Connected to network: ${(await provider.getNetwork()).name}`);
  
  // Connect with wallet
  const wallet = new ethers.Wallet(process.env.RELAYER_PRIVATE_KEY, provider);
  console.log(`Relayer wallet: ${wallet.address}`);
  
  // Contract address
  const contractAddress = '0x4995f6754359b2ec0b9d537c2f839e3dc01f6240';
  
  // Contract ABI (only the functions we need)
  const contractABI = [
    "function isAuthorizedRelayer(address _relayer) external view returns (bool)",
    "function hasVoted(uint256 _pollId, address _voter) external view returns (bool)",
    "function getPollDetails(uint256 _pollId) external view returns (string memory title, address creator, uint64 endTime, uint16 candidateCount, bool isPublic, uint64 voterCount, uint64 maxVoters)"
  ];
  
  // Create contract instance
  const contract = new ethers.Contract(contractAddress, contractABI, wallet);
  
  // Check if relayer is authorized
  const isAuthorized = await contract.isAuthorizedRelayer(wallet.address);
  console.log(`Relayer is authorized: ${isAuthorized}`);
  
  // Check poll details
  const pollId = 2;
  const [title, creator, endTime, candidateCount, isPublic, voterCount, maxVoters] = 
    await contract.getPollDetails(pollId);
  
  console.log(`Poll ${pollId} details:`);
  console.log(`- Title: ${title}`);
  console.log(`- Creator: ${creator}`);
  console.log(`- End time: ${new Date(endTime.toNumber() * 1000).toLocaleString()}`);
  console.log(`- Active: ${endTime.toNumber() > Math.floor(Date.now() / 1000)}`);
  console.log(`- Candidates: ${candidateCount}`);
  console.log(`- Public: ${isPublic}`);
  console.log(`- Voters: ${voterCount}/${maxVoters}`);
  
  // Test a sample address
  const testAddr = "0x67e936fe37e0b5338ab3e7c168e90adcb11acd16";
  const hasVoted = await contract.hasVoted(pollId, testAddr);
  console.log(`Test address has voted: ${hasVoted}`);
  
  console.log("\nTest complete. If everything shows correctly but votes aren't being recorded,");
  console.log("the issue is likely with signature validation or transaction submission.");
  console.log("Check the relayer logs for transaction errors.");
}

main().catch(console.error);