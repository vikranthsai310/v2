# Gasless Voting Relayer Service

A backend service that enables gasless voting in the Voting System by acting as a relayer. This service receives signed vote messages from users and submits them to the blockchain on behalf of the users, with gas fees covered by the poll creator's deposit.

## How It Works

1. User signs a message containing vote details (poll ID, candidate ID) using their wallet
2. Frontend sends this signature to the relayer service
3. Relayer verifies the signature and submits the vote to the blockchain
4. Gas fees are paid by the relayer wallet, which is reimbursed from the poll creator's deposit

## Prerequisites

- Node.js (v14+)
- npm or yarn
- A funded wallet to use as the relayer (address: `0xF0B5381A05A8d8368C7D3af031F7B50e979CeA12`)
- The relayer wallet must be authorized in the voting contract by the default relayer

## Installation

1. Clone this repository
2. Install dependencies:

```bash
npm install
# or
yarn install
```

3. Copy the example environment file and fill in your values:

```bash
cp .env.example .env
```

4. Edit `.env` file and add the private key for the relayer wallet

## Configuration

The `.env` file contains all the configuration needed:

```
CONTRACT_ADDRESS=0xf928B4919fE4Eef1EFFDE65239697024Dd90A532
PROVIDER_URL=https://rpc-mumbai.maticvigil.com
RELAYER_PRIVATE_KEY=your_private_key_here
PORT=3001
```

Make sure to replace `your_private_key_here` with the actual private key for the relayer wallet (`0xF0B5381A05A8d8368C7D3af031F7B50e979CeA12`).

## Running the Service

Start the service in development mode:

```bash
npm run dev
# or
yarn dev
```

For production, use:

```bash
npm start
# or
yarn start
```

## API Endpoints

### Check Relayer Status

```
GET /status
```

Response:
```json
{
  "success": true,
  "address": "0xF0B5381A05A8d8368C7D3af031F7B50e979CeA12",
  "authorized": true,
  "balance": "0.5"
}
```

### Submit Vote

```
POST /submit-vote
```

Request body:
```json
{
  "pollId": 1,
  "candidateId": 0,
  "voter": "0x123...",
  "signature": "0xabcd...",
  "merkleProof": [] // For private polls only
}
```

Response:
```json
{
  "success": true,
  "message": "Vote submitted successfully",
  "txHash": "0x123...",
  "pollId": 1,
  "candidateId": 0
}
```

## Important Notes

1. **Security**: Protect the relayer wallet's private key. Never expose it in client-side code.
2. **Authorization**: The relayer wallet must be authorized in the contract by the default relayer.
3. **Funding**: Ensure the relayer wallet has enough MATIC to submit transactions.
4. **Reimbursement**: The contract reimburses the relayer from the poll creator's deposit.

## Troubleshooting

- If you see "Relayer not authorized" errors, make sure the wallet is authorized in the contract.
- If transactions fail, check that the relayer wallet has enough MATIC for gas.
- Check logs for detailed error messages and transaction status. 