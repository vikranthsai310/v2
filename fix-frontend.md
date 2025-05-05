# Fix for PollDetails.tsx CONTRACT_ADDRESS Issue

There's a problem with your frontend where the `CONTRACT_ADDRESS` variable is not being properly accessed in some contexts. Here's a simple fix:

## Option 1: Add Global Variable in index.html

1. Open your `public/index.html` file
2. Add this script tag just before the closing `</head>` tag:

```html
<script>
  window.CONTRACT_ADDRESS = '0x4995f6754359b2ec0b9d537c2f839e3dc01f6240';
</script>
```

This will make the contract address globally available to all JavaScript code.

## Option 2: Fix PollDetails.tsx directly

1. Open src/pages/PollDetails.tsx
2. Look for this line at the beginning of `handleMetaVote`:

```javascript
if (!CONTRACT_ADDRESS) {
  console.error("Error checking if voter is relayer: CONTRACT_ADDRESS is not defined");
  throw new Error("Application configuration error. Please contact support.");
}
```

3. Replace it with this code:

```javascript
// Define a fallback contract address in case the import fails
const contractAddress = CONTRACT_ADDRESS || '0x4995f6754359b2ec0b9d537c2f839e3dc01f6240';
if (!contractAddress) {
  console.error("Error checking if voter is relayer: Contract address is not defined");
  throw new Error("Application configuration error. Please contact support.");
}
```

## The Root Cause

The issue is that when you use a relayer wallet to vote, the system correctly rejects the vote (you can't vote with the relayer wallet), but the error handling code is failing because of a reference to the CONTRACT_ADDRESS variable.

Our diagnostic script shows that:
1. Your Poll ID 2 is active until May 5, 2025
2. The creator has sufficient funds (0.03 MATIC)
3. The relayer wallet is authorized
4. The contract is correctly accessible

The voting failure is most likely because you're trying to vote with the same wallet that's running your relayer service (address: 0x26921bDA346AF373d25Ff8beB35F2C5294218528). The contract prevents this to ensure security and proper vote accounting.

## Solution:

**Use a different wallet to vote than the one running your relayer service.**

If you're still having issues after trying these fixes, please let me know! 