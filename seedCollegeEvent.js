const mongoose = require("mongoose");
require("dotenv").config();

const EventTest = require("./models/EventTest.model");
const Question = require("./models/Question.model");

const MONGO_URI = process.env.MONGODB_URI || process.env.MONGO_URI || "mongodb://localhost:27017/wipronix";

const questionBank = [
  // ==========================================
  // SECTION 1: TECHNOLOGY (10 Questions Target)
  // ==========================================
  {
    testId: "GLOBAL",
    eventCode: "GLOBAL",
    type: "technology",
    technology: "General Technical",
    question: "Which data structure follows the LIFO (Last In First Out) principle?",
    options: ["Queue", "Stack", "Array", "Linked List"],
    correctAnswer: 1
  },
  {
    testId: "GLOBAL",
    eventCode: "GLOBAL",
    type: "technology",
    technology: "General Technical",
    question: "What is the time complexity of searching an element in a balanced Binary Search Tree?",
    options: ["O(1)", "O(n)", "O(log n)", "O(n log n)"],
    correctAnswer: 2
  },
  {
    testId: "GLOBAL",
    eventCode: "GLOBAL",
    type: "technology",
    technology: "General Technical",
    question: "Which keyword in JavaScript is used to declare a block-scoped variable that cannot be reassigned?",
    options: ["var", "let", "const", "static"],
    correctAnswer: 2
  },
  {
    testId: "GLOBAL",
    eventCode: "GLOBAL",
    type: "technology",
    technology: "General Technical",
    question: "In SQL, which clause is used to filter records returned by a GROUP BY clause?",
    options: ["WHERE", "ORDER BY", "HAVING", "FILTER"],
    correctAnswer: 2
  },
  {
    testId: "GLOBAL",
    eventCode: "GLOBAL",
    type: "technology",
    technology: "General Technical",
    question: "What does the ACID property stand for in database transaction management?",
    options: [
      "Atomicity, Consistency, Isolation, Durability",
      "Accuracy, Concurrency, Indexing, Data",
      "Action, Control, Integrity, Distribution",
      "Automatic, Centralized, Isolated, Direct"
    ],
    correctAnswer: 0
  },
  {
    testId: "GLOBAL",
    eventCode: "GLOBAL",
    type: "technology",
    technology: "React & Node.js (MERN)",
    question: "Which React hook is used to perform side effects like data fetching or DOM subscriptions?",
    options: ["useState", "useContext", "useEffect", "useMemo"],
    correctAnswer: 2
  },
  {
    testId: "GLOBAL",
    eventCode: "GLOBAL",
    type: "technology",
    technology: "React & Node.js (MERN)",
    question: "In Node.js with Express, what middleware is standardly used to parse incoming JSON request bodies?",
    options: ["express.json()", "bodyParser.raw()", "express.urlencoded()", "json.parse()"],
    correctAnswer: 0
  },
  {
    testId: "GLOBAL",
    eventCode: "GLOBAL",
    type: "technology",
    technology: "React & Node.js (MERN)",
    question: "What is the primary advantage of Virtual DOM in modern UI libraries like React?",
    options: [
      "Direct hardware acceleration",
      "Batching and minimizing expensive real DOM manipulations",
      "Eliminating the need for JavaScript",
      "Automatically compiling JSX into WebAssembly"
    ],
    correctAnswer: 1
  },
  {
    testId: "GLOBAL",
    eventCode: "GLOBAL",
    type: "technology",
    technology: "Python & Django/FastAPI",
    question: "In Python, which built-in function returns both the index and value when looping over an iterable?",
    options: ["range()", "enumerate()", "zip()", "iterate()"],
    correctAnswer: 1
  },
  {
    testId: "GLOBAL",
    eventCode: "GLOBAL",
    type: "technology",
    technology: "Python & Django/FastAPI",
    question: "What is the purpose of the '__init__.py' file in a Python directory?",
    options: [
      "It compiles bytecode",
      "It marks the directory as a Python package namespace",
      "It acts as the program entry point",
      "It handles database migrations"
    ],
    correctAnswer: 1
  },
  {
    testId: "GLOBAL",
    eventCode: "GLOBAL",
    type: "technology",
    technology: "Java Spring Boot & Microservices",
    question: "In Java Spring Boot, which annotation marks a class as a RESTful web service controller?",
    options: ["@Service", "@RestController", "@Repository", "@Component"],
    correctAnswer: 1
  },
  {
    testId: "GLOBAL",
    eventCode: "GLOBAL",
    type: "technology",
    technology: "Java Spring Boot & Microservices",
    question: "Which garbage collector algorithm in modern JVM is designed for low latency and large heap memory?",
    options: ["Serial GC", "Parallel GC", "ZGC / G1GC", "CMS GC"],
    correctAnswer: 2
  },
  {
    testId: "GLOBAL",
    eventCode: "GLOBAL",
    type: "technology",
    technology: "AI / ML & Data Science",
    question: "Which loss function is standardly used for multi-class classification neural networks?",
    options: ["Mean Squared Error", "Categorical Cross-Entropy", "Hinge Loss", "Binary Cross-Entropy"],
    correctAnswer: 1
  },
  {
    testId: "GLOBAL",
    eventCode: "GLOBAL",
    type: "technology",
    technology: "General Technical",
    question: "Which HTTP method should be used for idempotent updates to an existing resource in REST APIs?",
    options: ["POST", "PUT", "PATCH", "CONNECT"],
    correctAnswer: 1
  },
  {
    testId: "GLOBAL",
    eventCode: "GLOBAL",
    type: "technology",
    technology: "General Technical",
    question: "What is the function of an index in a relational database?",
    options: [
      "To encrypt table data",
      "To speed up data retrieval operations at the cost of write performance",
      "To automatically generate primary keys",
      "To create table backups"
    ],
    correctAnswer: 1
  },

  // ==========================================
  // SECTION 2: APTITUDE (5 Questions Target)
  // ==========================================
  {
    testId: "GLOBAL",
    eventCode: "GLOBAL",
    type: "aptitude",
    technology: "Aptitude",
    question: "If 3 men or 5 women can do a piece of work in 20 days, how long will 6 men and 10 women take?",
    options: ["5 days", "6 days", "8 days", "10 days"],
    correctAnswer: 0
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
    type: "aptitude",
    technology: "Aptitude",
    question: "A train 150m long is running at a speed of 54 km/h. How many seconds will it take to cross an electric pole?",
    options: ["8 seconds", "10 seconds", "12 seconds", "15 seconds"],
    correctAnswer: 1
  },
  {
    testId: "GLOBAL",
    eventCode: "GLOBAL",
    type: "aptitude",
    technology: "Aptitude",
    question: "A merchant buys an item for Rs. 400 and sells it for Rs. 500. What is the profit percentage?",
    options: ["20%", "25%", "30%", "15%"],
    correctAnswer: 1
  },
  {
    testId: "GLOBAL",
    eventCode: "GLOBAL",
    type: "aptitude",
    technology: "Aptitude",
    question: "If pipe A fills a tank in 4 hours and pipe B empties it in 6 hours, how long will it take to fill the tank if both are opened together?",
    options: ["10 hours", "12 hours", "8 hours", "14 hours"],
    correctAnswer: 1
  },
  {
    testId: "GLOBAL",
    eventCode: "GLOBAL",
    type: "aptitude",
    technology: "Aptitude",
    question: "The average age of a class of 30 students is 15 years. If the teacher's age is included, the average increases by 1 year. What is the teacher's age?",
    options: ["44 years", "46 years", "48 years", "50 years"],
    correctAnswer: 1
  },
  {
    testId: "GLOBAL",
    eventCode: "GLOBAL",
    type: "aptitude",
    technology: "Aptitude",
    question: "In a certain code language, 'ROSE' is coded as '6821' and 'CHAIR' is coded as '73456'. What will 'SEARCH' be coded as?",
    options: ["214673", "214763", "214637", "216473"],
    correctAnswer: 0
  },
  {
    testId: "GLOBAL",
    eventCode: "GLOBAL",
    type: "aptitude",
    technology: "Aptitude",
    question: "Two cards are drawn from a pack of 52 cards without replacement. What is the probability that both are Kings?",
    options: ["1/221", "1/169", "1/52", "4/221"],
    correctAnswer: 0
  },

  // ==========================================
  // SECTION 3: COMPUTER NETWORKS (5 Questions Target)
  // ==========================================
  {
    testId: "GLOBAL",
    eventCode: "GLOBAL",
    type: "technology",
    technology: "Computer Networks",
    question: "Which layer of the OSI model is responsible for end-to-end communication, flow control, and error recovery?",
    options: ["Network Layer", "Transport Layer", "Data Link Layer", "Session Layer"],
    correctAnswer: 1
  },
  {
    testId: "GLOBAL",
    eventCode: "GLOBAL",
    type: "technology",
    technology: "Computer Networks",
    question: "What is the primary difference between TCP and UDP protocols?",
    options: [
      "TCP is connection-oriented and reliable, while UDP is connectionless and faster",
      "TCP is used only in LAN, while UDP is used in WAN",
      "UDP ensures error-free packet delivery, while TCP does not",
      "TCP operates at Layer 3, while UDP operates at Layer 7"
    ],
    correctAnswer: 0
  },
  {
    testId: "GLOBAL",
    eventCode: "GLOBAL",
    type: "technology",
    technology: "Computer Networks",
    question: "What is the standard port number used for secure HTTPS web traffic?",
    options: ["80", "443", "8080", "22"],
    correctAnswer: 1
  },
  {
    testId: "GLOBAL",
    eventCode: "GLOBAL",
    type: "technology",
    technology: "Computer Networks",
    question: "Which protocol automatically assigns dynamic IP addresses to host devices on a network?",
    options: ["DNS", "DHCP", "ARP", "ICMP"],
    correctAnswer: 1
  },
  {
    testId: "GLOBAL",
    eventCode: "GLOBAL",
    type: "technology",
    technology: "Computer Networks",
    question: "What does the subnet mask '255.255.255.0' (/24) signify regarding host addresses in an IPv4 network?",
    options: [
      "256 usable host addresses",
      "254 usable host addresses",
      "512 usable host addresses",
      "128 usable host addresses"
    ],
    correctAnswer: 1
  },
  {
    testId: "GLOBAL",
    eventCode: "GLOBAL",
    type: "technology",
    technology: "Computer Networks",
    question: "Which protocol translates a human-readable domain name (like www.google.com) into an IP address?",
    options: ["DNS (Domain Name System)", "NAT (Network Address Translation)", "FTP (File Transfer Protocol)", "SNMP"],
    correctAnswer: 0
  },
  {
    testId: "GLOBAL",
    eventCode: "GLOBAL",
    type: "technology",
    technology: "Computer Networks",
    question: "What is the purpose of the ARP (Address Resolution Protocol) in local networks?",
    options: [
      "Resolving an IP address to a physical MAC address",
      "Encrypting packet payloads",
      "Managing routing tables between autonomous systems",
      "Testing network latency"
    ],
    correctAnswer: 0
  },
  {
    testId: "GLOBAL",
    eventCode: "GLOBAL",
    type: "technology",
    technology: "Computer Networks",
    question: "What is a 3-way handshake in TCP connection establishment?",
    options: [
      "SYN -> SYN-ACK -> ACK",
      "ACK -> SYN -> FIN",
      "HELLO -> ACCEPT -> CONNECT",
      "REQUEST -> RESPONSE -> CLOSE"
    ],
    correctAnswer: 0
  },

  // ==========================================
  // SECTION 4: PROBLEM SOLVING (Technology, DSA & Algorithms - 5 Questions Target)
  // ==========================================
  {
    testId: "GLOBAL",
    eventCode: "GLOBAL",
    type: "technology",
    technology: "Problem Solving (DSA & Algorithms)",
    question: "What is the time complexity of finding a pair of numbers in a sorted array that sum to a target value using the Two-Pointers technique?",
    options: ["O(n)", "O(n^2)", "O(log n)", "O(n log n)"],
    correctAnswer: 0
  },
  {
    testId: "GLOBAL",
    eventCode: "GLOBAL",
    type: "technology",
    technology: "Problem Solving (Data Structures)",
    question: "You need to detect a cycle in a singly linked list with O(1) auxiliary space. Which algorithm is optimal?",
    options: [
      "Floyd's Tortoise and Hare (Slow & Fast Pointer)",
      "Hash Set visited node tracking",
      "Binary Search on node memory",
      "Dijkstra's Shortest Path Algorithm"
    ],
    correctAnswer: 0
  },
  {
    testId: "GLOBAL",
    eventCode: "GLOBAL",
    type: "technology",
    technology: "Problem Solving (Data Structures)",
    question: "Which data structure is most optimal for evaluating and validating balanced parentheses strings like '{[()]}'?",
    options: ["Stack (LIFO)", "Queue (FIFO)", "Priority Queue", "Binary Search Tree"],
    correctAnswer: 0
  },
  {
    testId: "GLOBAL",
    eventCode: "GLOBAL",
    type: "technology",
    technology: "Problem Solving (Dynamic Programming)",
    question: "In Dynamic Programming problems with optimal substructure and overlapping subproblems, what is the primary role of 'Memoization'?",
    options: [
      "Caching computed subproblem results in memory to avoid duplicate computations",
      "Converting recursion into iterative loops",
      "Compressing memory footprint",
      "Parallelizing code execution across threads"
    ],
    correctAnswer: 0
  },
  {
    testId: "GLOBAL",
    eventCode: "GLOBAL",
    type: "technology",
    technology: "Problem Solving (Algorithms & Bitwise)",
    question: "In an array of size N containing numbers from 1 to N with one missing and one duplicate number, which method achieves O(N) time and O(1) extra space?",
    options: [
      "XOR bitwise manipulation or Mathematical sum formulas",
      "Nested loops comparison",
      "Sorting the array with QuickSort",
      "Creating an N-sized Hash Table"
    ],
    correctAnswer: 0
  },
  {
    testId: "GLOBAL",
    eventCode: "GLOBAL",
    type: "technology",
    technology: "Problem Solving (Algorithm Complexity)",
    question: "What is the worst-case time complexity of QuickSort when the pivot chosen is always the extreme (smallest or largest) element?",
    options: ["O(n^2)", "O(n log n)", "O(n)", "O(log n)"],
    correctAnswer: 0
  },
  {
    testId: "GLOBAL",
    eventCode: "GLOBAL",
    type: "technology",
    technology: "Problem Solving (Trees & Graphs)",
    question: "Which tree traversal technique visits all nodes level-by-level using a Queue data structure?",
    options: [
      "Breadth-First Search (BFS) / Level-Order Traversal",
      "Pre-order Traversal (DFS)",
      "In-order Traversal",
      "Post-order Traversal"
    ],
    correctAnswer: 0
  },
  {
    testId: "GLOBAL",
    eventCode: "GLOBAL",
    type: "technology",
    technology: "Problem Solving (Recursion & Complexity)",
    question: "What is the time complexity of a naive recursive Fibonacci calculation without memoization: fib(n) = fib(n-1) + fib(n-2)?",
    options: ["O(2^n) Exponential", "O(n) Linear", "O(n^2) Quadratic", "O(log n) Logarithmic"],
    correctAnswer: 0
  },

  // ==========================================
  // SECTION 5: CLIENT HANDLING (5 Questions Target)
  // ==========================================
  {
    testId: "GLOBAL",
    eventCode: "GLOBAL",
    type: "technology",
    technology: "Client Handling",
    question: "A client reports an urgent production bug with high frustration. What is your immediate and best first response?",
    options: [
      "Acknowledge the issue promptly, empathize, confirm you are actively investigating, and provide an expected ETA for the next update",
      "Explain to the client that it was not your code that caused the failure",
      "Ignore the message until you have completely resolved the issue",
      "Tell the client that bugs are normal in software engineering"
    ],
    correctAnswer: 0
  },
  {
    testId: "GLOBAL",
    eventCode: "GLOBAL",
    type: "technology",
    technology: "Client Handling",
    question: "A client asks to add several major new features right before the agreed deadline. How should you handle this?",
    options: [
      "Acknowledge the request, assess timeline & cost impact, and offer to deliver core scope first with new features in Phase 2",
      "Refuse angrily and cancel the contract",
      "Approve all changes without discussing budget or timeline adjustments",
      "Secretly work overtime without documenting the scope expansion"
    ],
    correctAnswer: 0
  },
  {
    testId: "GLOBAL",
    eventCode: "GLOBAL",
    type: "technology",
    technology: "Client Handling",
    question: "Due to unexpected third-party API downtime, you realize a milestone deadline will be delayed by 2 days. What should you do?",
    options: [
      "Inform the client proactively with a clear explanation of root cause and the revised delivery plan before the deadline arrives",
      "Wait until the deadline has passed and then explain if the client asks",
      "Falsely mark the milestone as completed to avoid complaints",
      "Blame the third party and refuse further accountability"
    ],
    correctAnswer: 0
  },
  {
    testId: "GLOBAL",
    eventCode: "GLOBAL",
    type: "technology",
    technology: "Client Handling",
    question: "When gathering software requirements from a non-technical client, what is the best practice?",
    options: [
      "Listen actively, ask clarifying questions in plain business language, and document agreed user stories/wireframes for confirmation",
      "Use heavy technical jargon to prove your domain expertise",
      "Assume the technical requirements yourself without confirming with the client",
      "Ask the client to write their own technical specification document"
    ],
    correctAnswer: 0
  },
  {
    testId: "GLOBAL",
    eventCode: "GLOBAL",
    type: "technology",
    technology: "Client Handling",
    question: "A client insists on a software design approach that you know has critical security vulnerabilities. How should you proceed?",
    options: [
      "Respectfully present the concrete security risks, provide safer industry-standard alternatives, and explain the benefits to their business",
      "Silently build the insecure architecture because 'the client is always right'",
      "Mock the client's lack of technical knowledge in an email",
      "Refuse to work on the project without giving any explanation"
    ],
    correctAnswer: 0
  },
  {
    testId: "GLOBAL",
    eventCode: "GLOBAL",
    type: "technology",
    technology: "Client Handling",
    question: "What is the primary purpose of conducting a Sprint Demo / Client Review meeting?",
    options: [
      "To showcase working deliverables, gather timely client feedback, and ensure alignment with business expectations",
      "To criticize team members in front of the client",
      "To negotiate personal bonus packages",
      "To deliver a final invoice without reviewing progress"
    ],
    correctAnswer: 0
  },
  {
    testId: "GLOBAL",
    eventCode: "GLOBAL",
    type: "technology",
    technology: "Client Handling",
    question: "How should you document key decisions and action items agreed upon in a client meeting?",
    options: [
      "Send a concise 'Meeting Minutes' email summarizing decisions, action items, assignees, and deadlines within 24 hours",
      "Rely solely on verbal memory",
      "Write notes on personal paper and keep them private",
      "Ask the client to write and circulate the summary"
    ],
    correctAnswer: 0
  }
];

async function seed() {
  try {
    console.log("Connecting to MongoDB Atlas...");
    await mongoose.connect(MONGO_URI);
    console.log("Connected!");

    // Clean up old questions
    await Question.deleteMany({});
    console.log("Cleared old question collection.");

    // Insert fresh 30-question bank across all 5 sections
    await Question.insertMany(questionBank);
    console.log(`✅ Successfully seeded ${questionBank.length} questions into MongoDB Question collection!`);

    // Helper functions matching startTest.js
    const isApt = q => q.type === 'aptitude' || /aptitude|quant|reasoning/i.test(q.technology || '');
    const isCN = q => /network|networking/i.test(q.technology || '') || q.type === 'computer-network';
    const isPS = q => /problem\s*solving|dsa|algorithm|logic/i.test(q.technology || '') || q.type === 'problem-solving';
    const isCH = q => /client|customer/i.test(q.technology || '') || q.type === 'client-handling';
    const isTech = q => !isApt(q) && !isCN(q) && !isPS(q) && !isCH(q);

    console.log(`📊 Question Distribution in Database:`);
    console.log(`- Technology: ${questionBank.filter(isTech).length}`);
    console.log(`- Aptitude: ${questionBank.filter(isApt).length}`);
    console.log(`- Computer Networks: ${questionBank.filter(isCN).length}`);
    console.log(`- Problem Solving: ${questionBank.filter(isPS).length}`);
    console.log(`- Client Handling: ${questionBank.filter(isCH).length}`);
    console.log(`- Total: ${questionBank.length}`);

    process.exit(0);
  } catch (err) {
    console.error("Seed error:", err.message);
    process.exit(1);
  }
}

seed();
