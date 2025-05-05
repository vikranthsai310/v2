// Debug script for testing relayer service with a sample vote payload
const fetch = require('node-fetch');

// Default relayer URL
const RELAYER_URL = process.env.RELAYER_URL || 'http://localhost:3002';

// Sample test payload (will not actually process on blockchain but tests API communication)
const testPayload = {
  pollId: "1",
  candidateId: "0",
  voter: "0x0000000000000000000000000000000000000000",
  signature: "0x0000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000",
  merkleProof: []
};

async function makeRequest(endpoint, payload) {
  try {
    console.log(`Making request to ${endpoint}...`);
    const response = await fetch(`${RELAYER_URL}/${endpoint}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    
    const responseText = await response.text();
    
    console.log(`Response status: ${response.status}`);
    
    try {
      // Try to parse as JSON
      const data = JSON.parse(responseText);
      console.log('Response data:', JSON.stringify(data, null, 2));
      return { success: true, data };
    } catch (err) {
      // If not JSON, show raw text
      console.log('Response text:', responseText);
      return { success: false, text: responseText };
    }
  } catch (error) {
    console.error(`Error connecting to ${endpoint}:`, error.message);
    return { success: false, error: error.message };
  }
}

async function testRelayer() {
  console.log(`\n======= RELAYER DEBUG TEST =======`);
  console.log(`Testing relayer at: ${RELAYER_URL}`);
  console.log(`Using test payload:`, JSON.stringify(testPayload, null, 2));
  console.log(`\n`);
  
  // First, check status endpoint
  console.log(`\n----- TESTING STATUS ENDPOINT -----`);
  try {
    const statusResponse = await fetch(`${RELAYER_URL}/status`);
    const statusData = await statusResponse.json();
    console.log('Status endpoint response:', JSON.stringify(statusData, null, 2));
  } catch (error) {
    console.error('Status endpoint error:', error.message);
  }
  
  // Test debug endpoint
  console.log(`\n----- TESTING DEBUG ENDPOINT -----`);
  await makeRequest('debug', testPayload);
  
  // Test submit-vote endpoint
  console.log(`\n----- TESTING SUBMIT-VOTE ENDPOINT -----`);
  await makeRequest('submit-vote', testPayload);
  
  console.log(`\n======= TEST COMPLETE =======`);
}

// Run the test
testRelayer(); 