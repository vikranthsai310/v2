// Simple script to check relayer service status
const fetch = require('node-fetch');

// Default relayer URL
const RELAYER_URL = process.env.RELAYER_URL || 'http://localhost:3002';

async function checkRelayerStatus() {
  console.log(`Checking relayer status at: ${RELAYER_URL}`);
  
  try {
    // Make request to status endpoint
    const response = await fetch(`${RELAYER_URL}/status`, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' }
    });
    
    if (!response.ok) {
      console.error(`Error: Got status ${response.status} from relayer service`);
      console.log('Response:', await response.text());
      return;
    }
    
    // Parse the result
    const result = await response.json();
    
    console.log('\n==== Relayer Service Status ====');
    console.log(`Status: ${result.success ? 'ONLINE' : 'OFFLINE'}`);
    
    if (result.success) {
      console.log(`Address: ${result.address}`);
      console.log(`Authorized: ${result.authorized ? 'YES' : 'NO'}`);
      console.log(`Balance: ${result.balance} MATIC`);
      
      // Check if balance is low
      if (parseFloat(result.balance) < 0.01) {
        console.log('\n⚠️ WARNING: Relayer balance is low! Add more MATIC to continue processing votes.');
      }
      
      // Check if unauthorized
      if (!result.authorized) {
        console.log('\n⚠️ WARNING: Relayer is not authorized! It cannot submit votes until authorized.');
      }
    }
    
    console.log('\nNetwork Details:');
    console.log(`URL: ${RELAYER_URL}`);
    
  } catch (error) {
    console.error('Error connecting to relayer service:');
    console.error(error.message);
    console.log('\nPossible issues:');
    console.log('1. Relayer service is not running');
    console.log('2. Incorrect URL or port');
    console.log('3. Network connectivity issues');
    console.log('4. CORS policy blocking the request');
    console.log('\nMake sure the relayer service is running at:', RELAYER_URL);
  }
}

// Run the check
checkRelayerStatus(); 