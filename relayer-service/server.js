// Relayer Service for Gasless Voting
const express = require('express');
const cors = require('cors');
const ethers = require('ethers');
const dotenv = require('dotenv');
const bodyParser = require('body-parser');

// Load environment variables
dotenv.config();

// Create Express app
const app = express();

// Configure CORS for all origins during development
app.use(cors({
  origin: '*', // Allow all origins
  methods: ['GET', 'POST'], // Allow only GET and POST
  allowedHeaders: ['Content-Type', 'Accept'], // Allow only these headers
  credentials: true // Allow cookies
}));

app.use(bodyParser.json());

// Add a logging middleware to see all requests
app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
  next();
});

// Contract ABI (only the functions we need)
const CONTRACT_ABI = [
  "function metaVote(uint256 _pollId, uint16 _candidateId, address _voter, bytes32[] calldata _merkleProof, bytes calldata _signature) external",
  "function hasVoted(uint256 _pollId, address _voter) external view returns (bool)",
  "function getPollDetails(uint256 _pollId) external view returns (string memory title, address creator, uint64 endTime, uint16 candidateCount, bool isPublic, uint64 voterCount, uint64 maxVoters)",
  "function relayerAllowance(address, address) external view returns (uint256)",
  "function isAuthorizedRelayer(address _relayer) external view returns (bool)"
];

// Default relayer wallet (for messages if config is incorrect)
const DEFAULT_RELAYER_ADDRESS = '0xF0B5381A05A8d8368C7D3af031F7B50e979CeA12';

// Get private key from environment variables
// IMPORTANT: Never hardcode private keys in production code
// Use environment variables or a secure secret management service
const RELAYER_PRIVATE_KEY = process.env.RELAYER_PRIVATE_KEY;

// Contract address from environment variables
const CONTRACT_ADDRESS = process.env.CONTRACT_ADDRESS || '0x4995f6754359b2ec0b9d537c2f839e3dc01f6240';

// RPC provider URL (use Polygon Mainnet or Mumbai Testnet)
const PROVIDER_URL = process.env.PROVIDER_URL || "https://rpc-mumbai.maticvigil.com";

// Initialize provider and wallet
let provider;
let wallet;
let contract;

// Initialize blockchain connection
const initializeBlockchain = () => {
  try {
    // Create provider
    provider = new ethers.providers.JsonRpcProvider(PROVIDER_URL);
    
    // Create wallet from private key
    wallet = new ethers.Wallet(RELAYER_PRIVATE_KEY, provider);
    
    // Create contract instance
    contract = new ethers.Contract(CONTRACT_ADDRESS, CONTRACT_ABI, wallet);
    
    console.log(`Relayer service initialized with address: ${wallet.address}`);
    
    // Check if relayer is authorized
    checkRelayerAuthorization();
  } catch (error) {
    console.error("Failed to initialize blockchain connection:", error);
    process.exit(1);
  }
};

// Check if the relayer wallet is authorized
const checkRelayerAuthorization = async () => {
  try {
    const isAuthorized = await contract.isAuthorizedRelayer(wallet.address);
    console.log(`Relayer authorization status: ${isAuthorized}`);
    
    if (!isAuthorized) {
      console.error("WARNING: Relayer wallet is not authorized in the contract!");
      console.log("The relayer must be authorized by the default relayer wallet.");
      console.log(`Relayer address: ${wallet.address}`);
    }
  } catch (error) {
    console.error("Failed to check relayer authorization:", error);
  }
};

// Add this function after the initialization function
const checkWalletBalance = async () => {
  try {
    const balance = await provider.getBalance(wallet.address);
    const balanceEth = ethers.utils.formatEther(balance);
    console.log(`Current relayer wallet balance: ${balanceEth} MATIC`);
    
    // Check if balance is too low
    if (parseFloat(balanceEth) < 0.05) {
      console.warn(`⚠️ WARNING: Relayer wallet balance is critically low (${balanceEth} MATIC)`);
      console.warn(`Please add more funds to ${wallet.address}`);
    }
    
    return balance;
  } catch (error) {
    console.error("Error checking wallet balance:", error);
    return ethers.BigNumber.from("0");
  }
};

// Endpoint to check relayer status
app.get('/status', async (req, res) => {
  try {
    if (!contract) {
      return res.status(500).json({
        success: false,
        message: "Relayer service not initialized"
      });
    }
    
    const isAuthorized = await contract.isAuthorizedRelayer(wallet.address);
    const balance = await provider.getBalance(wallet.address);
    const balanceEth = ethers.utils.formatEther(balance);
    
    return res.json({
      success: true,
      address: wallet.address,
      authorized: isAuthorized,
      balance: balanceEth
    });
  } catch (error) {
    console.error("Error in status check:", error);
    return res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

// Add a debugging endpoint to echo back the received request
app.post('/debug', (req, res) => {
  try {
    console.log('DEBUG endpoint called with body:', req.body);
    console.log('DEBUG endpoint headers:', req.headers);
    
    // Return the request data as-is for debugging
    return res.json({
      success: true,
      message: "Debug endpoint called successfully",
      receivedData: {
        body: req.body,
        headers: {
          'content-type': req.headers['content-type'],
          'user-agent': req.headers['user-agent'],
          'origin': req.headers.origin || 'not provided'
        }
      }
    });
  } catch (error) {
    console.error("Error in debug endpoint:", error);
    return res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

// Endpoint to submit a vote via relayer
app.post('/submit-vote', async (req, res) => {
  // Log the raw request body for debugging
  console.log('Raw request body:', JSON.stringify(req.body, null, 2));
  
  try {
    const { pollId, candidateId, voter, signature, merkleProof = [] } = req.body;
    
    // Validate required parameters
    if (!pollId || candidateId === undefined || !voter || !signature) {
      console.log('Missing parameters in request:', { 
        hasPollId: !!pollId, 
        hasCandidateId: candidateId !== undefined,
        hasVoter: !!voter,
        hasSignature: !!signature
      });
      
      return res.status(400).json({
        success: false,
        message: "Missing required parameters: pollId, candidateId, voter, signature"
      });
    }
    
    // Generate a unique ID for this vote request for logging
    const requestId = `vote-${Date.now()}-${Math.floor(Math.random() * 10000)}`;
    console.log(`[${requestId}] Processing vote: Poll ${pollId}, Candidate ${candidateId}, Voter ${voter}`);
    
    // Set timeout for the entire request processing
    const timeoutMs = 15000; // 15 seconds
    const requestTimeout = setTimeout(() => {
      console.error(`[${requestId}] Request processing timeout for vote: Poll ${pollId}, Voter ${voter}`);
      // Note: The response will already be sent before this triggers in most cases
    }, timeoutMs);
    
    // Convert parameters to correct types
    let pollIdBN;
    let candidateIdBN;
    
    try {
      pollIdBN = ethers.BigNumber.from(pollId);
      candidateIdBN = ethers.BigNumber.from(candidateId);
      console.log(`[${requestId}] Converted pollId: ${pollIdBN.toString()}, candidateId: ${candidateIdBN.toString()}`);
    } catch (error) {
      clearTimeout(requestTimeout);
      console.error(`[${requestId}] Error converting parameters to BigNumber:`, error);
      return res.status(400).json({
        success: false,
        message: `Invalid parameters format: ${error.message}`
      });
    }

    // Try to get poll details to check if poll exists
    try {
      console.log(`[${requestId}] Fetching poll details for poll ${pollIdBN}`);
      const [title, creator, endTime, candidateCount, isPublic, voterCount, maxVoters] = 
        await contract.getPollDetails(pollIdBN);
      
      console.log(`[${requestId}] Poll details: `, {
        title,
        creator,
        endTime: endTime.toString(),
        candidateCount: candidateCount.toString(),
        isPublic,
        voterCount: voterCount.toString(),
        maxVoters: maxVoters.toString()
      });
      
      // Check if candidateId is valid
      if (candidateIdBN.gte(candidateCount)) {
        clearTimeout(requestTimeout);
        console.error(`[${requestId}] Invalid candidate ID: ${candidateIdBN} (max: ${candidateCount-1})`);
        return res.status(400).json({
          success: false,
          message: "Invalid candidate ID"
        });
      }
    } catch (error) {
      console.error(`[${requestId}] Error fetching poll details:`, error);
      // Continue anyway as the poll might exist but we have an issue fetching details
    }
    
    // Check if the voter has already voted
    try {
      console.log(`[${requestId}] Checking if voter ${voter} has already voted`);
      const hasVoted = await contract.hasVoted(pollIdBN, voter);
      console.log(`[${requestId}] Voter ${voter} has voted: ${hasVoted}`);
      
      if (hasVoted) {
        clearTimeout(requestTimeout);
        console.log(`[${requestId}] Voter ${voter} has already voted in poll ${pollId}`);
        return res.status(400).json({
          success: false,
          message: "Voter has already voted in this poll"
        });
      }
    } catch (error) {
      clearTimeout(requestTimeout);
      console.error(`[${requestId}] Error checking if voter has voted:`, error);
      return res.status(500).json({
        success: false,
        message: "Failed to check voter status"
      });
    }
    
    // Verify signature with the contract directly
    try {
      console.log(`[${requestId}] Signature length: ${signature.length}`);
      console.log(`[${requestId}] Signature: ${signature.substring(0, 30)}...`);
      // Normally you would verify the signature here, but we'll let the contract handle it
    } catch (error) {
      console.error(`[${requestId}] Error with signature:`, error);
    }
    
    // Format merkle proof if provided
    const formattedMerkleProof = merkleProof || [];
    
    // Check if relayer has enough balance first
    const balance = await checkWalletBalance();
    const estimatedGasCost = ethers.utils.parseUnits("80", "gwei").mul(ethers.BigNumber.from("500000"));
    
    if (balance.lt(estimatedGasCost)) {
      console.error(`[${requestId}] Insufficient funds in relayer wallet. Has ${ethers.utils.formatEther(balance)} MATIC, needs approximately ${ethers.utils.formatEther(estimatedGasCost)} MATIC`);
      return res.status(400).json({
        success: false,
        message: "Relayer service wallet needs more funds. Please try again later or contact the administrator."
      });
    }
    
    // Check if voter is the relayer (don't allow relayer to vote for itself)
    if (voter.toLowerCase() === wallet.address.toLowerCase()) {
      clearTimeout(requestTimeout);
      console.error(`[${requestId}] Voter ${voter} is the relayer wallet. Relayers cannot vote for themselves.`);
      return res.status(400).json({
        success: false,
        message: "The relayer wallet cannot vote. Please use a different wallet."
      });
    }
    
    // Submit the vote via metaVote function
    console.log(`[${requestId}] Submitting vote: Poll ${pollId}, Candidate ${candidateId}, Voter ${voter}`);
    
    // Use a fixed gas limit instead of estimation to avoid timeouts
    const gasLimit = ethers.BigNumber.from("500000"); // Increased from 300000 to ensure transaction has enough gas
    
    try {
      // Get relayer address for debugging
      console.log(`[${requestId}] Relayer address: ${wallet.address}`);
      
      // Submit the transaction with more conservative gas prices
      console.log(`[${requestId}] Calling metaVote with params:`, {
        pollId: pollIdBN.toString(),
        candidateId: candidateIdBN.toString(),
        voter,
        merkleProofLength: formattedMerkleProof.length,
        signatureLength: signature.length
      });
      
      // Add more debugging for transaction construction
      console.log(`[${requestId}] Transaction options:`, {
        gasLimit: gasLimit.toString(),
        maxFeePerGas: ethers.utils.parseUnits("80", "gwei").toString(),
        maxPriorityFeePerGas: ethers.utils.parseUnits("30", "gwei").toString()
      });
      
      // Submit transaction
      const tx = await contract.metaVote(
        pollIdBN,
        candidateIdBN,
        voter,
        formattedMerkleProof,
        signature,
        { 
          gasLimit,
          maxFeePerGas: ethers.utils.parseUnits("80", "gwei"),     // Lower max fee to conserve funds
          maxPriorityFeePerGas: ethers.utils.parseUnits("30", "gwei") // Keep priority fee high enough
        }
      );
      
      console.log(`[${requestId}] Transaction submitted: ${tx.hash}`);
      
      // Clear timeout since we got a response
      clearTimeout(requestTimeout);
      
      // Start a timer to wait for the first confirmation
      let confirmationTimeout;
      const verifyConfirmation = new Promise((resolve, reject) => {
        // Set timeout for first confirmation
        confirmationTimeout = setTimeout(() => {
          console.log(`[${requestId}] First confirmation timeout for tx ${tx.hash}`);
          resolve({ confirmed: false, status: 'timeout' });
        }, 10000); // 10 seconds for first confirmation
        
        // Wait for confirmation
        tx.wait(1)
          .then(receipt => {
            clearTimeout(confirmationTimeout);
            console.log(`[${requestId}] Transaction confirmed (1): ${tx.hash}`);
            resolve({ confirmed: true, receipt });
          })
          .catch(error => {
            clearTimeout(confirmationTimeout);
            console.error(`[${requestId}] Error confirming transaction: ${error.message}`);
            resolve({ confirmed: false, error });
          });
      });
      
      // Return response immediately, don't wait for confirmation
      const response = {
        success: true,
        message: "Vote submitted successfully",
        txHash: tx.hash,
        pollId,
        candidateId,
        requestId
      };
      
      // Send the response
      res.json(response);
      
      // After sending response, verify if tx was confirmed
      const confirmResult = await verifyConfirmation;
      if (!confirmResult.confirmed) {
        console.log(`[${requestId}] Transaction may need verification: ${tx.hash}`);
        
        // Continue monitoring in the background
        setTimeout(() => {
          tx.wait(1)
            .then(receipt => {
              console.log(`[${requestId}] Transaction confirmed later: ${tx.hash}`);
            })
            .catch(error => {
              console.error(`[${requestId}] Transaction may have failed: ${tx.hash}`);
              // If transaction failed, we could try to resubmit or notify the user
            });
        }, 5000);
      }
      
      // In the background, wait for confirmation and log the result
      // Monitor transaction with retry logic
      let confirmationAttempts = 0;
      const maxConfirmationAttempts = 5;
      
      const checkTransactionConfirmation = async () => {
        try {
          confirmationAttempts++;
          console.log(`[${requestId}] Checking transaction confirmation (attempt ${confirmationAttempts}): ${tx.hash}`);
          
          // Get transaction receipt
          const receipt = await provider.getTransactionReceipt(tx.hash);
          
          // If receipt is null, transaction is still pending
          if (receipt === null) {
            if (confirmationAttempts < maxConfirmationAttempts) {
              console.log(`[${requestId}] Transaction still pending: ${tx.hash}`);
              // Wait before next check (increasing delays between attempts)
              setTimeout(checkTransactionConfirmation, 5000 * confirmationAttempts);
            } else {
              console.error(`[${requestId}] Transaction may be stuck: ${tx.hash}`);
              console.log(`[${requestId}] Attempting to speed up transaction for: Poll ${pollId}, Voter ${voter}`);
              
              // Replace transaction with much higher gas price
              try {
                console.log(`[${requestId}] Replacing stuck transaction with higher gas price`);
                
                // Updated replacement gas settings to be more conservative
                const replacementGasPrice = {
                  gasLimit: ethers.BigNumber.from("600000"),
                  maxFeePerGas: ethers.utils.parseUnits("100", "gwei"),     // Still higher than initial but more conservative
                  maxPriorityFeePerGas: ethers.utils.parseUnits("35", "gwei") // Slightly higher than minimum
                };
                
                console.log(`[${requestId}] Replacement transaction options:`, {
                  gasLimit: replacementGasPrice.gasLimit.toString(),
                  maxFeePerGas: replacementGasPrice.maxFeePerGas.toString(),
                  maxPriorityFeePerGas: replacementGasPrice.maxPriorityFeePerGas.toString()
                });
                
                // Get the transaction to find its nonce
                const originalTx = await provider.getTransaction(tx.hash);
                if (!originalTx) {
                  throw new Error("Could not find the original transaction to replace");
                }
                
                console.log(`[${requestId}] Original transaction nonce: ${originalTx.nonce}`);
                
                // Submit with same nonce but higher gas price
                const replacementTx = await contract.metaVote(
                  pollIdBN,
                  candidateIdBN,
                  voter,
                  formattedMerkleProof,
                  signature,
                  { 
                    ...replacementGasPrice,
                    nonce: originalTx.nonce // Use same nonce as original transaction
                  }
                );
                
                console.log(`[${requestId}] Replacement transaction submitted: ${replacementTx.hash}`);
                
                // Start monitoring the replacement transaction
                setTimeout(() => {
                  console.log(`[${requestId}] Checking replacement transaction confirmation: ${replacementTx.hash}`);
                  provider.getTransactionReceipt(replacementTx.hash).then(receipt => {
                    if (receipt && receipt.status === 1) {
                      console.log(`[${requestId}] Replacement transaction confirmed successfully: ${replacementTx.hash}`);
                    } else if (receipt) {
                      console.error(`[${requestId}] Replacement transaction failed: ${replacementTx.hash}`);
                    } else {
                      console.log(`[${requestId}] Replacement transaction still pending: ${replacementTx.hash}`);
                    }
                  }).catch(err => {
                    console.error(`[${requestId}] Error checking replacement transaction: ${err.message}`);
                  });
                }, 10000);
                
              } catch (error) {
                console.error(`[${requestId}] Failed to replace transaction: ${error.message}`);
              }
            }
            return;
          }
          
          // Transaction was mined
          if (receipt.status === 1) {
            console.log(`[${requestId}] Transaction confirmed successfully: ${tx.hash}`);
            console.log(`[${requestId}] Gas used: ${receipt.gasUsed.toString()}`);
            console.log(`[${requestId}] Block number: ${receipt.blockNumber}`);
            
            // Double check that the vote was recorded
            try {
              const votedAfterTx = await contract.hasVoted(pollIdBN, voter);
              console.log(`[${requestId}] Vote recorded on chain: ${votedAfterTx}`);
              
              if (!votedAfterTx) {
                console.error(`[${requestId}] CRITICAL: Transaction confirmed but vote not recorded!`);
              }
            } catch (error) {
              console.error(`[${requestId}] Error checking vote status after tx:`, error);
            }
          } else {
            console.error(`[${requestId}] Transaction reverted: ${tx.hash}`);
            console.error(`[${requestId}] Gas used: ${receipt.gasUsed.toString()}`);
            
            // Try to get reason for reversion
            try {
              // Get last transaction data to debug
              const transaction = await provider.getTransaction(tx.hash);
              
              // Detailed error diagnosis
              console.error(`[${requestId}] Transaction details:`, {
                from: transaction.from,
                to: transaction.to,
                nonce: transaction.nonce,
                gasLimit: transaction.gasLimit.toString(),
                gasPrice: transaction.gasPrice ? transaction.gasPrice.toString() : 'N/A',
                maxFeePerGas: transaction.maxFeePerGas ? transaction.maxFeePerGas.toString() : 'N/A',
                maxPriorityFeePerGas: transaction.maxPriorityFeePerGas ? transaction.maxPriorityFeePerGas.toString() : 'N/A',
              });
            } catch (error) {
              console.error(`[${requestId}] Failed to get detailed transaction info: ${error.message}`);
            }
          }
        } catch (error) {
          console.error(`[${requestId}] Error checking transaction: ${tx.hash}`, error);
          
          if (confirmationAttempts < maxConfirmationAttempts) {
            // Wait before next check
            setTimeout(checkTransactionConfirmation, 5000 * confirmationAttempts);
          }
        }
      };
      
      // Start monitoring the transaction
      setTimeout(checkTransactionConfirmation, 5000);
    } catch (error) {
      // Clear timeout if there's an error
      clearTimeout(requestTimeout);
      
      console.error("Error submitting vote:", error);
      
      // Detailed error logging
      if (error.code) {
        console.error(`Error code: ${error.code}`);
      }
      
      if (error.transaction) {
        console.error(`Transaction data:`, {
          from: error.transaction.from,
          to: error.transaction.to,
          data: error.transaction.data.substring(0, 100) + '...' // Truncate to avoid huge logs
        });
      }
      
      // Handle specific error types with user-friendly messages
      if (error.message.includes("Bad signature")) {
        return res.status(400).json({
          success: false,
          message: "Invalid signature provided for vote verification"
        });
      } else if (error.message.includes("Already voted")) {
        return res.status(400).json({
          success: false,
          message: "Voter has already voted in this poll"
        });
      } else if (error.message.includes("Insufficient relayer funds") || error.message.includes("doesn't have enough funds")) {
        return res.status(400).json({
          success: false,
          message: "Insufficient funds from poll creator to cover gas fees"
        });
      } else if (error.message.includes("insufficient funds")) {
        return res.status(400).json({
          success: false,
          message: "Relayer wallet needs more funds. Please try again later."
        });
      } else if (error.message.includes("nonce")) {
        return res.status(500).json({
          success: false,
          message: "Transaction nonce error. Please try again."
        });
      } else if (error.message.includes("gas")) {
        return res.status(500).json({
          success: false,
          message: "Transaction gas error. Please try again later."
        });
      }
      
      return res.status(500).json({
        success: false,
        message: "Failed to submit vote. Please try again later.",
        error: error.message
      });
    }
  } catch (error) {
    console.error("Unexpected error in submit-vote endpoint:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message
    });
  }
});

// Add a simple echo endpoint for testing
app.get('/echo', (req, res) => {
  console.log('Echo endpoint called');
  return res.json({
    success: true,
    message: "Relayer service is responding correctly",
    timestamp: new Date().toISOString(),
    address: wallet ? wallet.address : "Not initialized"
  });
});

// Add a diagnostic endpoint to check the relayer wallet status
app.get('/wallet-info', async (req, res) => {
  try {
    if (!wallet || !provider) {
      return res.status(500).json({
        success: false,
        message: "Relayer service not initialized"
      });
    }
    
    const address = wallet.address;
    const balance = await provider.getBalance(address);
    const balanceEth = ethers.utils.formatEther(balance);
    const nonce = await provider.getTransactionCount(address);
    const network = await provider.getNetwork();
    const gasPrice = await provider.getGasPrice();
    const gasPriceGwei = ethers.utils.formatUnits(gasPrice, "gwei");
    
    // Check if relayer is authorized
    const isAuthorized = await contract.isAuthorizedRelayer(address);
    
    // Calculate minimum gas needed for typical transaction
    const typicalGasCost = gasPrice.mul(ethers.BigNumber.from("300000"));
    const typicalGasCostEth = ethers.utils.formatEther(typicalGasCost);
    const hasEnoughFunds = balance.gt(typicalGasCost.mul(2)); // Can process at least 2 txs
    
    return res.json({
      success: true,
      address,
      balance: balanceEth,
      authorized: isAuthorized,
      nonce,
      network: {
        name: network.name,
        chainId: network.chainId
      },
      gasData: {
        currentGasPrice: gasPriceGwei,
        typicalTransactionCost: typicalGasCostEth
      },
      status: {
        initialized: true,
        hasEnoughFunds,
        minBalance: typicalGasCostEth
      }
    });
  } catch (error) {
    console.error("Error getting wallet info:", error);
    return res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

// Start the server
const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`Relayer service listening on port ${PORT}`);
  console.log(`Server time: ${new Date().toISOString()}`);
  console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
  initializeBlockchain();
}); 