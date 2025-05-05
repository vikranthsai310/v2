// Direct test script for submitting a vote to the relayer service
const fetch = require('node-fetch');

// Default relayer URL
const RELAYER_URL = process.env.RELAYER_URL || 'http://localhost:3002';

// The actual payload data from the browser (copy from your logs)
const actualPayload = {
  pollId: "0",
  candidateId: "0",
  voter: "0x26921bda346af373d25ff8beb35f2c5294218528",
  signature: "0x34a37c45b04264e3a4b885af651006072f39d9a4f63821435cf1166a7c2913c251459617e452e119687a580df60cbbd21a0bca4d916452d2312e3e78b56bd72d1b",
  merkleProof: []
};

async function testVote() {
  console.log(`Testing direct vote submission to: ${RELAYER_URL}`);
  console.log('Using actual payload from browser logs:', actualPayload);
  
  try {
    // First check if relayer is responding
    console.log('\nTesting basic relayer connectivity...');
    const echoRes = await fetch(`${RELAYER_URL}/echo`);
    if (echoRes.ok) {
      const echoData = await echoRes.json();
      console.log('Relayer is online and responding:', echoData);
    } else {
      console.error('Echo endpoint returned error:', echoRes.status);
      console.error('Response:', await echoRes.text());
    }
    
    // Now submit the vote
    console.log('\nSubmitting test vote with actual data...');
    const startTime = Date.now();
    const response = await fetch(`${RELAYER_URL}/submit-vote`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(actualPayload)
    });
    const endTime = Date.now();
    
    console.log(`Response received in ${endTime - startTime}ms`);
    console.log(`Status: ${response.status} ${response.statusText}`);
    
    try {
      const data = await response.json();
      console.log('Response data:', data);
      
      if (data.success && data.txHash) {
        console.log('\n✅ SUCCESS: Transaction hash:', data.txHash);
        console.log('You can view the transaction on the blockchain explorer:');
        console.log(`https://mumbai.polygonscan.com/tx/${data.txHash}`);
      } else {
        console.log('\n❌ FAILURE: Relayer returned error:', data.message);
      }
    } catch (err) {
      console.error('Error parsing response:', await response.text());
    }
    
  } catch (error) {
    console.error('Error connecting to relayer service:');
    console.error(error.message);
    console.log('\nPossible issues:');
    console.log('1. Relayer service is not running');
    console.log('2. Incorrect URL or port');
    console.log('3. Network connectivity issues');
  }
}

// Run the test
testVote(); 