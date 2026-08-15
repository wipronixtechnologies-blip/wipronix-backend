const mongoose = require("mongoose");
require("dotenv").config();

const EventTest = require("./models/EventTest.model");
const Question = require("./models/Question.model");

const MONGO_URI = process.env.MONGODB_URI || process.env.MONGO_URI || "mongodb://localhost:27017/wipronix";

const questionBank = [
  {
    testId: "GLOBAL",
    eventCode: "GLOBAL",
    type: "technology",
    technology: "General Technical & Aptitude",
    question: "Which data structure follows the LIFO (Last In First Out) principle?",
    options: ["Queue", "Stack", "Array", "Linked List"],
    correctAnswer: 1
  },
  {
    testId: "GLOBAL",
    eventCode: "GLOBAL",
    type: "technology",
    technology: "General Technical & Aptitude",
    question: "What is the time complexity of searching an element in a balanced Binary Search Tree?",
    options: ["O(1)", "O(n)", "O(log n)", "O(n log n)"],
    correctAnswer: 2
  },
  {
    testId: "GLOBAL",
    eventCode: "GLOBAL",
    type: "technology",
    technology: "General Technical & Aptitude",
    question: "Which keyword in JavaScript is used to declare a block-scoped variable that cannot be reassigned?",
    options: ["var", "let", "const", "static"],
    correctAnswer: 2
  },
  {
    testId: "GLOBAL",
    eventCode: "GLOBAL",
    type: "technology",
    technology: "General Technical & Aptitude",
    question: "In HTTP protocols, which status code represents 'Internal Server Error'?",
    options: ["200", "404", "403", "500"],
    correctAnswer: 3
  },
  {
    testId: "GLOBAL",
    eventCode: "GLOBAL",
    type: "aptitude",
    technology: "Aptitude",
    question: "If 3 men or 5 women can do a work in 20 days, how long will 6 men and 10 women take?",
    options: ["5 days", "6 days", "8 days", "10 days"],
    correctAnswer: 0
  },
  {
    testId: "GLOBAL",
    eventCode: "GLOBAL",
    type: "technology",
    technology: "General Technical & Aptitude",
    question: "Which HTML tag is used to embed JavaScript code into an HTML page?",
    options: ["<javascript>", "<script>", "<js>", "<code>"],
    correctAnswer: 1
  },
  {
    testId: "GLOBAL",
    eventCode: "GLOBAL",
    type: "technology",
    technology: "General Technical & Aptitude",
    question: "What does CSS stand for?",
    options: ["Creative Style Sheets", "Cascading Style Sheets", "Computer Style System", "Colorful Style Sheet"],
    correctAnswer: 1
  },
  {
    testId: "GLOBAL",
    eventCode: "GLOBAL",
    type: "technology",
    technology: "General Technical & Aptitude",
    question: "Which command in Git creates a new branch and switches to it immediately?",
    options: ["git branch <name>", "git checkout -b <name>", "git merge <name>", "git push <name>"],
    correctAnswer: 1
  },
  {
    testId: "GLOBAL",
    eventCode: "GLOBAL",
    type: "aptitude",
    technology: "Aptitude",
    question: "Find the next number in the series: 3, 7, 15, 31, 63, ?",
    options: ["125", "127", "129", "131"],
    correctAnswer: 1
  },
  {
    testId: "GLOBAL",
    eventCode: "GLOBAL",
    type: "technology",
    technology: "General Technical & Aptitude",
    question: "In SQL, which clause is used to filter records returned by a GROUP BY clause?",
    options: ["WHERE", "ORDER BY", "HAVING", "FILTER"],
    correctAnswer: 2
  },
  {
    testId: "GLOBAL",
    eventCode: "GLOBAL",
    type: "technology",
    technology: "General Technical & Aptitude",
    question: "What is the default port number for React Vite development server?",
    options: ["3000", "5173", "8080", "5000"],
    correctAnswer: 1
  },
  {
    testId: "GLOBAL",
    eventCode: "GLOBAL",
    type: "technology",
    technology: "General Technical & Aptitude",
    question: "Which hook in React is used for managing component side effects?",
    options: ["useState", "useContext", "useEffect", "useReducer"],
    correctAnswer: 2
  },
  {
    testId: "GLOBAL",
    eventCode: "GLOBAL",
    type: "aptitude",
    technology: "Aptitude",
    question: "Solve: If 5 pipes can fill a tank in 1 hour, how long will 3 pipes take to fill the same tank?",
    options: ["100 mins", "90 mins", "80 mins", "75 mins"],
    correctAnswer: 0
  },
  {
    testId: "GLOBAL",
    eventCode: "GLOBAL",
    type: "technology",
    technology: "General Technical & Aptitude",
    question: "Which of the following is NOT a NoSQL database?",
    options: ["MongoDB", "PostgreSQL", "Cassandra", "Redis"],
    correctAnswer: 1
  },
  {
    testId: "GLOBAL",
    eventCode: "GLOBAL",
    type: "technology",
    technology: "General Technical & Aptitude",
    question: "What is the main function of the operating system kernel?",
    options: ["UI Design", "Resource Management & Hardware Abstraction", "Compiling Code", "Web Browsing"],
    correctAnswer: 1
  },
  {
    testId: "GLOBAL",
    eventCode: "GLOBAL",
    type: "technology",
    technology: "General Technical & Aptitude",
    question: "In Python, which built-in function returns the number of items in an object?",
    options: ["count()", "size()", "len()", "length()"],
    correctAnswer: 2
  },
  {
    testId: "GLOBAL",
    eventCode: "GLOBAL",
    type: "aptitude",
    technology: "Aptitude",
    question: "A train 150m long is running at 54 km/h. How many seconds will it take to cross a pole?",
    options: ["8 sec", "10 sec", "12 sec", "15 sec"],
    correctAnswer: 1
  },
  {
    testId: "GLOBAL",
    eventCode: "GLOBAL",
    type: "technology",
    technology: "General Technical & Aptitude",
    question: "Which method converts a JavaScript object into a JSON string?",
    options: ["JSON.parse()", "JSON.stringify()", "JSON.convert()", "Object.toJSON()"],
    correctAnswer: 1
  },
  {
    testId: "GLOBAL",
    eventCode: "GLOBAL",
    type: "technology",
    technology: "General Technical & Aptitude",
    question: "What does API stand for in software engineering?",
    options: ["Application Programming Interface", "Automated Process Integration", "Applied Program Protocol", "Advanced Programming System"],
    correctAnswer: 0
  },
  {
    testId: "GLOBAL",
    eventCode: "GLOBAL",
    type: "technology",
    technology: "General Technical & Aptitude",
    question: "Which sorting algorithm has the best average-case time complexity of O(n log n)?",
    options: ["Bubble Sort", "Selection Sort", "Merge Sort", "Insertion Sort"],
    correctAnswer: 2
  },
  {
    testId: "GLOBAL",
    eventCode: "GLOBAL",
    type: "technology",
    technology: "MernStack",
    question: "Which hook in React is used to manage state in a functional component?",
    options: ["useEffect", "useState", "useContext", "useReducer"],
    correctAnswer: 1
  },
  {
    testId: "GLOBAL",
    eventCode: "GLOBAL",
    type: "technology",
    technology: "MernStack",
    question: "What does Express.js handle in the MERN architecture?",
    options: ["Database querying", "Backend routing & server middleware", "Frontend DOM manipulation", "State management"],
    correctAnswer: 1
  },
  {
    testId: "GLOBAL",
    eventCode: "GLOBAL",
    type: "technology",
    technology: "PythonWebDevelopment",
    question: "In Python, which keyword is used to create a function?",
    options: ["func", "function", "def", "create"],
    correctAnswer: 2
  },
  {
    testId: "GLOBAL",
    eventCode: "GLOBAL",
    type: "aptitude",
    technology: "Aptitude",
    question: "A man buys an article for Rs. 27.50 and sells it for Rs. 28.60. Find his gain percentage.",
    options: ["4%", "5%", "6%", "8%"],
    correctAnswer: 0
  }
];

async function seed() {
  try {
    console.log("Connecting to MongoDB Atlas...");
    await mongoose.connect(MONGO_URI);
    console.log("Connected!");

    // Clean up old questions with corrupted 6 options
    await Question.deleteMany({});
    console.log("Cleared old question collection.");

    // Insert fresh 4-option question bank
    await Question.insertMany(questionBank);
    console.log(`✅ Successfully seeded ${questionBank.length} questions into MongoDB Question collection!`);

    process.exit(0);
  } catch (err) {
    console.error("Seed error:", err.message);
    process.exit(1);
  }
}

seed();
