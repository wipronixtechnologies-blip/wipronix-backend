const axios = require('axios');

async function testSubmitAnswer() {
  try {
    console.log('Testing POST /api/test/answer endpoint...');
    
    // Test data similar to what the frontend sends
    const testData = {
      studentId: 'test-student-123',
      testId: 'APTITUDE-001',
      questionIndex: 0,
      selectedOption: 'A'
    };

    console.log('Sending request with data:', testData);

    const response = await axios.post('https://backend-wipronix-1-sjs2.onrender.com/api/test/answer', testData, {
      headers: {
        'Content-Type': 'application/json',
      },
      timeout: 10000
    });

    console.log('✅ SUCCESS! Response:');
    console.log('Status:', response.status);
    console.log('Data:', JSON.stringify(response.data, null, 2));

  } catch (error) {
    console.error('❌ ERROR:');
    
    if (error.response) {
      console.log('Status:', error.response.status);
      console.log('Data:', JSON.stringify(error.response.data, null, 2));
    } else if (error.request) {
      console.log('No response received:', error.request);
    } else {
      console.log('Error:', error.message);
    }
  }
}

// Run the test
testSubmitAnswer();
