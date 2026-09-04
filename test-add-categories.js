const axios = require('axios');

async function testAddAllCategories() {
  const BASE_URL = 'http://localhost:5001/api/test';
  
  const testQuestions = [
    {
      testId: 'computer-networks',
      type: 'technology',
      technology: 'Computer Networks',
      question: 'Verification: What layer is IP protocol in OSI model?',
      options: ['Network Layer', 'Transport Layer', 'Data Link Layer', 'Application Layer'],
      correctAnswer: 0
    },
    {
      testId: 'problem-solving',
      type: 'technology',
      technology: 'Problem Solving',
      question: 'Verification: What is the average time complexity of Binary Search on a sorted array?',
      options: ['O(log n)', 'O(n)', 'O(1)', 'O(n^2)'],
      correctAnswer: 0
    },
    {
      testId: 'client-handling',
      type: 'technology',
      technology: 'Client Handling',
      question: 'Verification: How should urgent client tickets be addressed?',
      options: ['Prompt acknowledgment and active investigation', 'Ignore', 'Blame others', 'Delete ticket'],
      correctAnswer: 0
    }
  ];

  try {
    console.log('Testing adding 3 questions across categories via API...');
    const res = await axios.post(`${BASE_URL}/add-question`, {
      questions: testQuestions
    });

    console.log('✅ API Response Status:', res.status);
    console.log('✅ API Response Data:', res.data);

    if (res.data.success && res.data.addedCount === 3) {
      console.log('\n🎉 ALL 3 CATEGORIES (Computer Networks, Problem Solving, Client Handling) ADDED SUCCESSFULLY!');
    }
  } catch (err) {
    console.error('❌ API Error:', err.response?.data || err.message);
  }
}

testAddAllCategories();
