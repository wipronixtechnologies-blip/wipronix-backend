// Test file for the add question API
// Run this after starting your backend server to test the API

const axios = require('axios');

const BASE_URL = 'http://localhost:5000/api/test';

// Test data for adding questions
const testQuestions = {
  questions: [
    {
      testId: 'test123',
      type: 'aptitude',
      question: 'What is the capital of France?',
      options: ['London', 'Berlin', 'Paris', 'Madrid'],
      correctAnswer: 2
    },
    {
      testId: 'test123',
      type: 'technology',
      technology: 'MERN Stack',
      question: 'What is React?',
      options: ['Database', 'Programming Language', 'JavaScript Library', 'Operating System'],
      correctAnswer: 2
    },
    {
      testId: 'test456',
      type: 'aptitude',
      question: '2 + 2 = ?',
      options: ['3', '4', '5', '6'],
      correctAnswer: 1
    },
    {
      testId: 'test456',
      type: 'technology',
      technology: 'AI / ML',
      question: 'What is machine learning?',
      options: [
        'A type of hardware',
        'A subset of AI that enables computers to learn',
        'A programming language',
        'A database system'
      ],
      correctAnswer: 1
    }
  ]
};

async function testAddQuestionAPI() {
  try {
    console.log('🧪 Testing Add Question API...\n');

    // Test 1: Add multiple questions
    console.log('📝 Test 1: Adding multiple questions');
    const response = await axios.post(`${BASE_URL}/add-question`, testQuestions);
    
    console.log('✅ Success! Response:');
    console.log(JSON.stringify(response.data, null, 2));
    console.log('');

    // Test 2: Test validation - missing required fields
    console.log('📝 Test 2: Testing validation - missing required fields');
    const invalidQuestion = {
      questions: [
        {
          testId: 'test123',
          // Missing type
          question: 'This should fail validation',
          options: ['A', 'B', 'C', 'D'],
          correctAnswer: 0
        }
      ]
    };

    try {
      await axios.post(`${BASE_URL}/add-question`, invalidQuestion);
    } catch (error) {
      console.log('✅ Validation working correctly! Error response:');
      console.log(JSON.stringify(error.response.data, null, 2));
    }
    console.log('');

    // Test 3: Test validation - technology required for tech questions
    console.log('📝 Test 3: Testing validation - technology required for tech questions');
    const invalidTechQuestion = {
      questions: [
        {
          testId: 'test123',
          type: 'technology',
          // Missing technology field
          question: 'This should also fail',
          options: ['A', 'B', 'C', 'D'],
          correctAnswer: 0
        }
      ]
    };

    try {
      await axios.post(`${BASE_URL}/add-question`, invalidTechQuestion);
    } catch (error) {
      console.log('✅ Technology validation working correctly! Error response:');
      console.log(JSON.stringify(error.response.data, null, 2));
    }
    console.log('');

    console.log('🎉 All tests completed!');

  } catch (error) {
    console.error('❌ Test failed:', error.message);
    if (error.response) {
      console.error('Response data:', error.response.data);
    }
  }
}

// Run the tests
testAddQuestionAPI();

// Alternative: Test with curl commands
console.log('\n📋 Alternative: Use these curl commands to test:');
console.log(`
# Add questions
curl -X POST http://localhost:5000/api/test/add-question \\
  -H "Content-Type: application/json" \\
  -d '${JSON.stringify(testQuestions, null, 2)}'

# Test validation error
curl -X POST http://localhost:5000/api/test/add-question \\
  -H "Content-Type: application/json" \\
  -d '{
    "questions": [{
      "testId": "test123",
      "question": "Missing type",
      "options": ["A", "B", "C", "D"],
      "correctAnswer": 0
    }]
  }'
`);
