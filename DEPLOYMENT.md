# Deployment Information

## Contract Details

- **Contract Name**: GasOptimizedVotingSystem
- **Deployed Address**: `0xf928b4919fe4eef1effde65239697024dd90a532`
- **Network**: Polygon Mainnet
- **Solidity Version**: 0.8.18

## Contract Features

This contract implements a gas-optimized voting system with several key features:

1. **Bitmap Storage**: Uses bitmap storage for extremely gas-efficient vote tracking
2. **Meta-Transactions**: Allows gasless voting through signature-based meta-transactions
3. **Whitelist Support**: Supports both public polls and whitelisted polls using Merkle tree verification
4. **Relayer System**: Implements an authorized relayer system for meta-transaction processing

## Interacting with the Contract

### Required Tools

- MetaMask or another Web3 wallet connected to Polygon Mainnet
- Sufficient MATIC for gas fees (only for poll creation and setup)

### Creating a Poll

1. Connect your wallet to the application
2. Navigate to the "Create Poll" section
3. Fill in the poll details:
   - Title
   - Candidate names
   - Duration
   - Poll type (public or whitelist-only)
   - Maximum number of voters
   - Whitelist addresses (if applicable)
4. Submit the transaction with the required MATIC deposit for relayer gas costs

### Voting in a Poll

#### Direct Voting (User Pays Gas)

1. Connect your wallet
2. Browse available polls
3. Select a poll and choose a candidate
4. Submit your vote (requires MATIC for gas)

#### Gasless Voting (Meta-Transaction)

1. Connect your wallet
2. Browse available polls
3. Select a poll and choose a candidate
4. Sign the meta-transaction message when prompted
5. The vote will be submitted without requiring you to pay for gas

### Managing Relayer Funds

1. Navigate to the Dashboard section
2. Use the "Deposit" function to add funds for relayer operations
3. Use the "Withdraw" function to retrieve unused funds

## Technical Details

### Contract ABI

The contract ABI is available in the `src/utils/contract.ts` file. The key methods include:

- `createPoll` - Create a new poll
- `vote` - Vote directly (user pays gas)
- `metaVote` - Meta-transaction vote (gasless for voter)
- `depositFunds` - Deposit funds for relayer operations
- `withdrawFunds` - Withdraw unused funds

### Merkle Tree Implementation

For whitelist verification, the contract uses a Merkle tree. The frontend application handles:

1. Generating Merkle trees from lists of Ethereum addresses
2. Creating Merkle proofs for verification
3. Submitting these proofs with meta-transactions

## Troubleshooting

### Common Issues

1. **Insufficient Relayer Funds**: Ensure the poll creator has deposited enough MATIC to cover relayer costs
2. **Invalid Signature**: Make sure you're signing with the correct account
3. **Not Whitelisted**: Verify your address is included in the whitelist for private polls

### Getting Help

If you encounter issues or have questions about the contract, please:

1. Check the documentation in this repository
2. Open an issue in the GitHub repository
3. Contact the development team at support@example.com

## Security Considerations

The contract has been designed with security best practices in mind:

- Gas-efficient bitmap storage to prevent DoS attacks
- Signature verification for all meta-transactions
- Strict access control for relayer management
- Merkle tree verification for whitelists

However, users should always:

- Verify transaction details before signing
- Use unique wallets for high-value operations
- Be cautious when interacting with any blockchain application 