// Machine Round Technology Configurations & Tough Challenge Problem Bank

const DEFAULT_TECH_CONFIGS = [
  { technology: "Problem Solving (Dynamic Programming)", hasMachineRound: true, category: "Technical", durationMinutes: 35 },
  { technology: "Problem Solving (Recursion & Complexity)", hasMachineRound: true, category: "Technical", durationMinutes: 35 },
  { technology: "Problem Solving (Trees & Graphs)", hasMachineRound: true, category: "Technical", durationMinutes: 35 },
  { technology: "Problem Solving (DSA & Algorithms)", hasMachineRound: true, category: "Technical", durationMinutes: 35 },
  { technology: "React & Node.js (MERN)", hasMachineRound: true, category: "Technical", durationMinutes: 30 },
  { technology: "Next.js & Tailwind CSS", hasMachineRound: true, category: "Technical", durationMinutes: 30 },
  { technology: "Python & Django/FastAPI", hasMachineRound: true, category: "Technical", durationMinutes: 30 },
  { technology: "Java Spring Boot & Microservices", hasMachineRound: true, category: "Technical", durationMinutes: 35 },
  { technology: "Mobile App (Flutter / React Native)", hasMachineRound: true, category: "Technical", durationMinutes: 30 },
  { technology: "AI / ML & Data Science", hasMachineRound: true, category: "Technical", durationMinutes: 30 },
  { technology: "Core Technical", hasMachineRound: true, category: "Technical", durationMinutes: 30 },
  { technology: "UI/UX & Product Design", hasMachineRound: false, category: "Design", durationMinutes: 30 },
  { technology: "Sales & Business Development", hasMachineRound: false, category: "Non-Technical", durationMinutes: 30 },
  { technology: "Digital Marketing", hasMachineRound: false, category: "Non-Technical", durationMinutes: 30 },
  { technology: "Other", hasMachineRound: false, category: "General", durationMinutes: 30 }
];

const DEFAULT_CHALLENGES = [
  // ------------------ EXISTING STANDARD CHALLENGES ------------------
  {
    title: "Array Transformation & Target Pair Sum",
    technology: "React & Node.js (MERN)",
    difficulty: "Medium",
    timeMinutes: 30,
    solutionFunctionName: "twoSum",
    defaultLanguage: "javascript",
    description: `### Problem Description
Given an array of integers \`numbers\` and an integer \`target\`, return indices of the two numbers such that they add up to \`target\`.

You may assume that each input would have **exactly one solution**, and you may not use the same element twice.
You can return the answer in any order, or as a sorted array \`[index1, index2]\`.

### Example 1
- **Input:** \`numbers = [2, 7, 11, 15], target = 9\`
- **Output:** \`[0, 1]\`
- **Explanation:** Because \`numbers[0] + numbers[1] == 9\`, we return \`[0, 1]\`.

### Example 2
- **Input:** \`numbers = [3, 2, 4], target = 6\`
- **Output:** \`[1, 2]\`

### Constraints
- \`2 <= numbers.length <= 10^4\`
- \`-10^9 <= numbers[i] <= 10^9\`
- \`-10^9 <= target <= 10^9\`
- Only one valid answer exists.`,
    starterCodes: {
      javascript: `/**
 * @param {number[]} numbers
 * @param {number} target
 * @return {number[]}
 */
function twoSum(numbers, target) {
  // Write your code here
  
}`,
      python: `def twoSum(numbers, target):
    # Write your python code here
    pass`
    },
    testCases: [
      { input: JSON.stringify([[2, 7, 11, 15], 9]), expectedOutput: JSON.stringify([0, 1]), isHidden: false, explanation: "2 + 7 = 9" },
      { input: JSON.stringify([[3, 2, 4], 6]), expectedOutput: JSON.stringify([1, 2]), isHidden: false, explanation: "2 + 4 = 6" },
      { input: JSON.stringify([[3, 3], 6]), expectedOutput: JSON.stringify([0, 1]), isHidden: false, explanation: "3 + 3 = 6" },
      { input: JSON.stringify([[1, 5, 8, 12, 19], 20]), expectedOutput: JSON.stringify([0, 4]), isHidden: true, explanation: "1 + 19 = 20" },
      { input: JSON.stringify([[10, -2, 5, -8, 14], -10]), expectedOutput: JSON.stringify([1, 3]), isHidden: true, explanation: "-2 + -8 = -10" }
    ]
  },
  {
    title: "String Compression & Character Frequency Counter",
    technology: "Python & Django/FastAPI",
    difficulty: "Medium",
    timeMinutes: 30,
    solutionFunctionName: "compressString",
    defaultLanguage: "javascript",
    description: `### Problem Description
Implement a method to perform basic string compression using the counts of repeated characters.
For example, the string \`"aabcccccaaa"\` would become \`"a2b1c5a3"\`.

If the "compressed" string would not become smaller than the original string, your method should return the original string.
You can assume the string has only uppercase and lowercase letters (\`a-z\`, \`A-Z\`).

### Example 1
- **Input:** \`"aabcccccaaa"\`
- **Output:** \`"a2b1c5a3"\`

### Example 2
- **Input:** \`"abcdef"\`
- **Output:** \`"abcdef"\`
- **Explanation:** Compressed string \`"a1b1c1d1e1f1"\` is length 12, which is longer than original 6. Hence return original string.

### Constraints
- \`1 <= string.length <= 10^5\`
- Case sensitive (\`'A'\` is different from \`'a'\`).`,
    starterCodes: {
      javascript: `/**
 * @param {string} str
 * @return {string}
 */
function compressString(str) {
  // Write your code here
  
}`,
      python: `def compressString(s: str) -> str:
    # Write your python code here
    pass`
    },
    testCases: [
      { input: JSON.stringify(["aabcccccaaa"]), expectedOutput: JSON.stringify("a2b1c5a3"), isHidden: false, explanation: "Counts: a:2, b:1, c:5, a:3" },
      { input: JSON.stringify(["abcdef"]), expectedOutput: JSON.stringify("abcdef"), isHidden: false, explanation: "Original returned as compressed is longer" },
      { input: JSON.stringify(["WWWWWWWWWWWWBWWWWWWWWWWWWBBBWWWWWWWWWWWW"]), expectedOutput: JSON.stringify("W12B1W12B3W12"), isHidden: false },
      { input: JSON.stringify(["aabbcc"]), expectedOutput: JSON.stringify("aabbcc"), isHidden: true },
      { input: JSON.stringify(["aaaaaa"]), expectedOutput: JSON.stringify("a6"), isHidden: true }
    ]
  },
  {
    title: "Valid Parentheses & Bracket Sequence Validator",
    technology: "React & Node.js (MERN)",
    difficulty: "Easy",
    timeMinutes: 30,
    solutionFunctionName: "isValid",
    defaultLanguage: "javascript",
    description: `### Problem Description
Given a string \`s\` containing just the characters \`'('\`, \`')'\`, \`'{'\`, \`'}'\`, \`'['\` and \`']'\`, determine if the input string is valid.

An input string is valid if:
1. Open brackets must be closed by the same type of brackets.
2. Open brackets must be closed in the correct order.
3. Every close bracket has a corresponding open bracket of the same type.

### Example 1
- **Input:** \`s = "()[]{}"\`
- **Output:** \`true\`

### Example 2
- **Input:** \`s = "(]"\`
- **Output:** \`false\`

### Constraints
- \`1 <= s.length <= 10^4\`
- \`s\` consists of parentheses only \`'()[]{}'\`.`,
    starterCodes: {
      javascript: `/**
 * @param {string} s
 * @return {boolean}
 */
function isValid(s) {
  // Write your code here
  
}`,
      python: `def isValid(s: str) -> bool:
    # Write your python code here
    pass`
    },
    testCases: [
      { input: JSON.stringify(["()"]), expectedOutput: JSON.stringify(true), isHidden: false },
      { input: JSON.stringify(["()[]{}"]), expectedOutput: JSON.stringify(true), isHidden: false },
      { input: JSON.stringify(["(]"]), expectedOutput: JSON.stringify(false), isHidden: false },
      { input: JSON.stringify(["([{}])"]), expectedOutput: JSON.stringify(true), isHidden: true },
      { input: JSON.stringify(["[(])"]), expectedOutput: JSON.stringify(false), isHidden: true }
    ]
  },
  {
    title: "Longest Substring Without Repeating Characters",
    technology: "All",
    difficulty: "Medium",
    timeMinutes: 30,
    solutionFunctionName: "lengthOfLongestSubstring",
    defaultLanguage: "javascript",
    description: `### Problem Description
Given a string \`s\`, find the length of the **longest substring** without duplicate characters.

### Example 1
- **Input:** \`s = "abcabcbb"\`
- **Output:** \`3\`
- **Explanation:** The answer is \`"abc"\`, with the length of 3.

### Example 2
- **Input:** \`s = "bbbbb"\`
- **Output:** \`1\`
- **Explanation:** The answer is \`"b"\`, with the length of 1.

### Example 3
- **Input:** \`s = "pwwkew"\`
- **Output:** \`3\`
- **Explanation:** The answer is \`"wke"\`, with the length of 3. Notice that \`"pwke"\` is a subsequence and not a substring.`,
    starterCodes: {
      javascript: `/**
 * @param {string} s
 * @return {number}
 */
function lengthOfLongestSubstring(s) {
  // Write your code here
  
}`,
      python: `def lengthOfLongestSubstring(s: str) -> int:
    # Write your python code here
    pass`
    },
    testCases: [
      { input: JSON.stringify(["abcabcbb"]), expectedOutput: JSON.stringify(3), isHidden: false, explanation: "abc -> len 3" },
      { input: JSON.stringify(["bbbbb"]), expectedOutput: JSON.stringify(1), isHidden: false, explanation: "b -> len 1" },
      { input: JSON.stringify(["pwwkew"]), expectedOutput: JSON.stringify(3), isHidden: false, explanation: "wke -> len 3" },
      { input: JSON.stringify([""]), expectedOutput: JSON.stringify(0), isHidden: true, explanation: "Empty string length 0" },
      { input: JSON.stringify(["dvdf"]), expectedOutput: JSON.stringify(3), isHidden: true, explanation: "vdf -> len 3" }
    ]
  },

  // ------------------ TOUGHEST MACHINE ROUND CHALLENGES ------------------

  // 1. Dynamic Programming - Trapping Rain Water
  {
    title: "Trapping Rain Water Elevation Engine",
    technology: "Problem Solving (Dynamic Programming)",
    difficulty: "Hard",
    timeMinutes: 35,
    solutionFunctionName: "trap",
    defaultLanguage: "javascript",
    description: `### Problem Description
Given \`n\` non-negative integers representing an elevation map where the width of each bar is \`1\`, compute how much water it can trap after raining.

This is a premier machine coding problem frequently posed by Tier-1 tech giants. Your solution must optimize both time and memory overhead.

### Example 1
- **Input:** \`height = [0, 1, 0, 2, 1, 0, 1, 3, 2, 1, 2, 1]\`
- **Output:** \`6\`
- **Explanation:** 6 units of rain water are trapped between elevation bars.

### Example 2
- **Input:** \`height = [4, 2, 0, 3, 2, 5]\`
- **Output:** \`9\`

### Constraints
- \`n == height.length\`
- \`0 <= n <= 2 * 10^4\`
- \`0 <= height[i] <= 10^5\`
- **Target Complexity:** Time \`O(N)\`, Auxiliary Space \`O(1)\``,
    starterCodes: {
      javascript: `/**
 * @param {number[]} height
 * @return {number}
 */
function trap(height) {
  // Write your code here
  
}`,
      python: `def trap(height: list[int]) -> int:
    # Write your python code here
    pass`
    },
    testCases: [
      { input: JSON.stringify([[0, 1, 0, 2, 1, 0, 1, 3, 2, 1, 2, 1]]), expectedOutput: JSON.stringify(6), isHidden: false, explanation: "6 units of rain trapped" },
      { input: JSON.stringify([[4, 2, 0, 3, 2, 5]]), expectedOutput: JSON.stringify(9), isHidden: false, explanation: "9 units trapped in valley" },
      { input: JSON.stringify([[3, 0, 2, 0, 4]]), expectedOutput: JSON.stringify(7), isHidden: false },
      { input: JSON.stringify([[1, 2, 3, 4, 5]]), expectedOutput: JSON.stringify(0), isHidden: true, explanation: "Monotonically increasing elevation holds 0 water" },
      { input: JSON.stringify([[5, 4, 1, 2]]), expectedOutput: JSON.stringify(1), isHidden: true },
      { input: JSON.stringify([[]]), expectedOutput: JSON.stringify(0), isHidden: true }
    ]
  },

  // 2. Dynamic Programming - Edit Distance
  {
    title: "Edit Distance & Levenshtein Transformation",
    technology: "Problem Solving (Dynamic Programming)",
    difficulty: "Hard",
    timeMinutes: 35,
    solutionFunctionName: "minDistance",
    defaultLanguage: "javascript",
    description: `### Problem Description
Given two strings \`word1\` and \`word2\`, return the minimum number of operations required to convert \`word1\` to \`word2\`.

You have the following three operations permitted on a word:
1. **Insert** a character
2. **Delete** a character
3. **Replace** a character

### Example 1
- **Input:** \`word1 = "horse", word2 = "ros"\`
- **Output:** \`3\`
- **Explanation:** 
  1. \`horse\` -> \`rorse\` (replace 'h' with 'r')
  2. \`rorse\` -> \`rose\` (remove 'r')
  3. \`rose\` -> \`ros\` (remove 'e')

### Example 2
- **Input:** \`word1 = "intention", word2 = "execution"\`
- **Output:** \`5\`

### Constraints
- \`0 <= word1.length, word2.length <= 500\`
- \`word1\` and \`word2\` consist of lowercase English letters.
- **Target Complexity:** Time \`O(m * n)\`, Space \`O(m * n)\``,
    starterCodes: {
      javascript: `/**
 * @param {string} word1
 * @param {string} word2
 * @return {number}
 */
function minDistance(word1, word2) {
  // Write your code here
  
}`,
      python: `def minDistance(word1: str, word2: str) -> int:
    # Write your python code here
    pass`
    },
    testCases: [
      { input: JSON.stringify(["horse", "ros"]), expectedOutput: JSON.stringify(3), isHidden: false, explanation: "3 edit operations required" },
      { input: JSON.stringify(["intention", "execution"]), expectedOutput: JSON.stringify(5), isHidden: false },
      { input: JSON.stringify(["", "hello"]), expectedOutput: JSON.stringify(5), isHidden: false, explanation: "Inserting 5 characters into empty string" },
      { input: JSON.stringify(["algorithm", "altruistic"]), expectedOutput: JSON.stringify(6), isHidden: true },
      { input: JSON.stringify(["same", "same"]), expectedOutput: JSON.stringify(0), isHidden: true, explanation: "Identical strings require 0 edits" }
    ]
  },

  // 3. Dynamic Programming - Longest Valid Parentheses
  {
    title: "Longest Valid Parentheses Substring",
    technology: "Problem Solving (Dynamic Programming)",
    difficulty: "Hard",
    timeMinutes: 30,
    solutionFunctionName: "longestValidParentheses",
    defaultLanguage: "javascript",
    description: `### Problem Description
Given a string \`s\` containing just the characters \`'('\` and \`')'\`, return the length of the longest valid (well-formed and matched) parentheses substring.

### Example 1
- **Input:** \`s = "(()"\`
- **Output:** \`2\`
- **Explanation:** The longest valid parentheses substring is \`"()"\` of length 2.

### Example 2
- **Input:** \`s = ")()())"\`
- **Output:** \`4\`
- **Explanation:** The longest valid parentheses substring is \`"()()"\` of length 4.

### Example 3
- **Input:** \`s = ""\`
- **Output:** \`0\`

### Constraints
- \`0 <= s.length <= 3 * 10^4\`
- \`s[i]\` is either \`'('\` or \`')'\`.
- **Target Complexity:** Time \`O(N)\`, Space \`O(N)\` or \`O(1)\``,
    starterCodes: {
      javascript: `/**
 * @param {string} s
 * @return {number}
 */
function longestValidParentheses(s) {
  // Write your code here
  
}`,
      python: `def longestValidParentheses(s: str) -> int:
    # Write your python code here
    pass`
    },
    testCases: [
      { input: JSON.stringify(["(()"]), expectedOutput: JSON.stringify(2), isHidden: false },
      { input: JSON.stringify([")()())"]), expectedOutput: JSON.stringify(4), isHidden: false },
      { input: JSON.stringify(["()(()"]), expectedOutput: JSON.stringify(2), isHidden: false },
      { input: JSON.stringify(["((()))())"]), expectedOutput: JSON.stringify(8), isHidden: true },
      { input: JSON.stringify([")("]), expectedOutput: JSON.stringify(0), isHidden: true },
      { input: JSON.stringify(["()()()"]), expectedOutput: JSON.stringify(6), isHidden: true }
    ]
  },

  // 4. Trees & Graphs - Course Schedule II
  {
    title: "Course Schedule II: Topological Ordering & Cycle Detection",
    technology: "Problem Solving (Trees & Graphs)",
    difficulty: "Hard",
    timeMinutes: 35,
    solutionFunctionName: "findOrder",
    defaultLanguage: "javascript",
    description: `### Problem Description
There are a total of \`numCourses\` courses you have to take, labeled from \`0\` to \`numCourses - 1\`. You are given an array \`prerequisites\` where \`prerequisites[i] = [ai, bi]\` indicates that you must take course \`bi\` first if you want to take course \`ai\`.

- Return the ordering of courses you should take to finish all courses.
- If there are multiple valid answers, return any valid topological ordering.
- If it is impossible to finish all courses (due to a circular dependency/cycle), return an empty array \`[]\`.

### Example 1
- **Input:** \`numCourses = 2, prerequisites = [[1, 0]]\`
- **Output:** \`[0, 1]\`
- **Explanation:** There are a total of 2 courses to take. To take course 1 you must have finished course 0. So the correct course order is [0, 1].

### Example 2
- **Input:** \`numCourses = 4, prerequisites = [[1, 0], [2, 0], [3, 1], [3, 2]]\`
- **Output:** \`[0, 1, 2, 3]\` or \`[0, 2, 1, 3]\`

### Example 3
- **Input:** \`numCourses = 2, prerequisites = [[0, 1], [1, 0]]\`
- **Output:** \`[]\`
- **Explanation:** There is a cycle; you cannot take either course.

### Constraints
- \`1 <= numCourses <= 2000\`
- \`0 <= prerequisites.length <= numCourses * (numCourses - 1)\`
- All prerequisites pairs are distinct.`,
    starterCodes: {
      javascript: `/**
 * @param {number} numCourses
 * @param {number[][]} prerequisites
 * @return {number[]}
 */
function findOrder(numCourses, prerequisites) {
  // Write your code here
  
}`,
      python: `def findOrder(numCourses: int, prerequisites: list[list[int]]) -> list[int]:
    # Write your python code here
    pass`
    },
    testCases: [
      { input: JSON.stringify([2, [[1, 0]]]), expectedOutput: JSON.stringify([0, 1]), isHidden: false },
      { input: JSON.stringify([4, [[1, 0], [2, 0], [3, 1], [3, 2]]]), expectedOutput: JSON.stringify([0, 1, 2, 3]), isHidden: false },
      { input: JSON.stringify([2, [[0, 1], [1, 0]]]), expectedOutput: JSON.stringify([]), isHidden: false, explanation: "Cycle detected: returns []" },
      { input: JSON.stringify([1, []]), expectedOutput: JSON.stringify([0]), isHidden: true },
      { input: JSON.stringify([3, [[0, 1], [1, 2], [2, 0]]]), expectedOutput: JSON.stringify([]), isHidden: true }
    ]
  },

  // 5. Trees & Graphs - Word Ladder
  {
    title: "Word Ladder: Shortest Transformation Path",
    technology: "Problem Solving (Trees & Graphs)",
    difficulty: "Hard",
    timeMinutes: 35,
    solutionFunctionName: "ladderLength",
    defaultLanguage: "javascript",
    description: `### Problem Description
A transformation sequence from \`beginWord\` to \`endWord\` using a dictionary \`wordList\` is a sequence of words \`beginWord -> s1 -> s2 -> ... -> sk\` such that:
1. Every adjacent pair of words differs by a single letter.
2. Every \`si\` for \`1 <= i <= k\` is in \`wordList\`. Note that \`beginWord\` does not need to be in \`wordList\`.
3. \`sk == endWord\`.

Given two words, \`beginWord\` and \`endWord\`, and a dictionary \`wordList\`, return the number of words in the shortest transformation sequence from \`beginWord\` to \`endWord\`, or \`0\` if no such sequence exists.

### Example 1
- **Input:** \`beginWord = "hit", endWord = "cog", wordList = ["hot","dot","dog","lot","log","cog"]\`
- **Output:** \`5\`
- **Explanation:** One shortest transformation sequence is "hit" -> "hot" -> "dot" -> "dog" -> "cog", which is 5 words long.

### Example 2
- **Input:** \`beginWord = "hit", endWord = "cog", wordList = ["hot","dot","dog","lot","log"]\`
- **Output:** \`0\`
- **Explanation:** The endWord "cog" is not in wordList, therefore there is no valid transformation sequence.

### Constraints
- \`1 <= beginWord.length <= 10\`
- \`endWord.length == beginWord.length\`
- \`1 <= wordList.length <= 5000\`
- All words consist of lowercase English letters and have the same length.`,
    starterCodes: {
      javascript: `/**
 * @param {string} beginWord
 * @param {string} endWord
 * @param {string[]} wordList
 * @return {number}
 */
function ladderLength(beginWord, endWord, wordList) {
  // Write your code here
  
}`,
      python: `def ladderLength(beginWord: str, endWord: str, wordList: list[str]) -> int:
    # Write your python code here
    pass`
    },
    testCases: [
      { input: JSON.stringify(["hit", "cog", ["hot", "dot", "dog", "lot", "log", "cog"]]), expectedOutput: JSON.stringify(5), isHidden: false },
      { input: JSON.stringify(["hit", "cog", ["hot", "dot", "dog", "lot", "log"]]), expectedOutput: JSON.stringify(0), isHidden: false, explanation: "endWord not present in dictionary" },
      { input: JSON.stringify(["a", "c", ["a", "b", "c"]]), expectedOutput: JSON.stringify(2), isHidden: false },
      { input: JSON.stringify(["hot", "dog", ["hot", "dog"]]), expectedOutput: JSON.stringify(0), isHidden: true, explanation: "Differs by 2 characters" },
      { input: JSON.stringify(["lead", "gold", ["load", "goad", "gold", "lead", "good"]]), expectedOutput: JSON.stringify(4), isHidden: true }
    ]
  },

  // 6. Recursion & Complexity - Median of Two Sorted Arrays
  {
    title: "Median of Two Sorted Arrays in Logarithmic Time",
    technology: "Problem Solving (Recursion & Complexity)",
    difficulty: "Hard",
    timeMinutes: 40,
    solutionFunctionName: "findMedianSortedArrays",
    defaultLanguage: "javascript",
    description: `### Problem Description
Given two sorted arrays \`nums1\` and \`nums2\` of size \`m\` and \`n\` respectively, return the median of the two sorted arrays.

The overall run time complexity **must be \`O(log(m+n))\`**. Linear time solutions that merge arrays in \`O(m+n)\` will exceed strict execution limits.

### Example 1
- **Input:** \`nums1 = [1, 3], nums2 = [2]\`
- **Output:** \`2\`
- **Explanation:** Merged array = [1, 2, 3] and median is 2.

### Example 2
- **Input:** \`nums1 = [1, 2], nums2 = [3, 4]\`
- **Output:** \`2.5\`
- **Explanation:** Merged array = [1, 2, 3, 4] and median is (2 + 3) / 2 = 2.5.

### Constraints
- \`nums1.length == m\`, \`nums2.length == n\`
- \`0 <= m <= 1000\`, \`0 <= n <= 1000\`
- \`1 <= m + n <= 2000\`
- \`-10^6 <= nums1[i], nums2[i] <= 10^6\``,
    starterCodes: {
      javascript: `/**
 * @param {number[]} nums1
 * @param {number[]} nums2
 * @return {number}
 */
function findMedianSortedArrays(nums1, nums2) {
  // Write your code here
  
}`,
      python: `def findMedianSortedArrays(nums1: list[int], nums2: list[int]) -> float:
    # Write your python code here
    pass`
    },
    testCases: [
      { input: JSON.stringify([[1, 3], [2]]), expectedOutput: JSON.stringify(2), isHidden: false },
      { input: JSON.stringify([[1, 2], [3, 4]]), expectedOutput: JSON.stringify(2.5), isHidden: false },
      { input: JSON.stringify([[0, 0], [0, 0]]), expectedOutput: JSON.stringify(0), isHidden: false },
      { input: JSON.stringify([[], [1]]), expectedOutput: JSON.stringify(1), isHidden: true },
      { input: JSON.stringify([[2], []]), expectedOutput: JSON.stringify(2), isHidden: true },
      { input: JSON.stringify([[1, 3, 8, 9, 15], [7, 11, 18, 19, 21, 25]]), expectedOutput: JSON.stringify(11), isHidden: true }
    ]
  },

  // 7. Recursion & Complexity - N-Queens
  {
    title: "N-Queens Placement: Total Distinct Solutions",
    technology: "Problem Solving (Recursion & Complexity)",
    difficulty: "Hard",
    timeMinutes: 35,
    solutionFunctionName: "totalNQueens",
    defaultLanguage: "javascript",
    description: `### Problem Description
The **n-queens** puzzle is the problem of placing \`n\` queens on an \`n x n\` chessboard such that no two queens attack each other.
Two queens attack each other if they share the same row, column, or diagonal.

Given an integer \`n\`, return the number of distinct valid placements to the n-queens puzzle.

### Example 1
- **Input:** \`n = 4\`
- **Output:** \`2\`
- **Explanation:** There are two distinct solutions to the 4-queens puzzle.

### Example 2
- **Input:** \`n = 1\`
- **Output:** \`1\`

### Constraints
- \`1 <= n <= 10\`
- **Target Complexity:** Backtracking branch-and-bound with bitmasks or column/diagonal sets.`,
    starterCodes: {
      javascript: `/**
 * @param {number} n
 * @return {number}
 */
function totalNQueens(n) {
  // Write your code here
  
}`,
      python: `def totalNQueens(n: int) -> int:
    # Write your python code here
    pass`
    },
    testCases: [
      { input: JSON.stringify([4]), expectedOutput: JSON.stringify(2), isHidden: false },
      { input: JSON.stringify([1]), expectedOutput: JSON.stringify(1), isHidden: false },
      { input: JSON.stringify([5]), expectedOutput: JSON.stringify(10), isHidden: false },
      { input: JSON.stringify([6]), expectedOutput: JSON.stringify(4), isHidden: true },
      { input: JSON.stringify([8]), expectedOutput: JSON.stringify(92), isHidden: true, explanation: "Standard 8-queens problem" }
    ]
  },

  // 8. Full Stack / MERN - Sliding Window Maximum
  {
    title: "Sliding Window Maximum Monotonic Deque",
    technology: "React & Node.js (MERN)",
    difficulty: "Hard",
    timeMinutes: 35,
    solutionFunctionName: "maxSlidingWindow",
    defaultLanguage: "javascript",
    description: `### Problem Description
You are given an array of integers \`nums\`, and a sliding window of size \`k\` that moves from the left of the array to the right. You can only see the \`k\` numbers in the window at any instant. Each step moves the window right by one position.

Return the max sliding window array containing maximum elements at each step.
Your algorithm must achieve **\`O(N)\` linear time complexity**. Quadratic \`O(N * k)\` approaches will time out.

### Example 1
- **Input:** \`nums = [1, 3, -1, -3, 5, 3, 6, 7], k = 3\`
- **Output:** \`[3, 3, 5, 5, 6, 7]\`

### Example 2
- **Input:** \`nums = [1], k = 1\`
- **Output:** \`[1]\`

### Constraints
- \`1 <= nums.length <= 10^5\`
- \`-10^4 <= nums[i] <= 10^4\`
- \`1 <= k <= nums.length\``,
    starterCodes: {
      javascript: `/**
 * @param {number[]} nums
 * @param {number} k
 * @return {number[]}
 */
function maxSlidingWindow(nums, k) {
  // Write your code here
  
}`,
      python: `def maxSlidingWindow(nums: list[int], k: int) -> list[int]:
    # Write your python code here
    pass`
    },
    testCases: [
      { input: JSON.stringify([[1, 3, -1, -3, 5, 3, 6, 7], 3]), expectedOutput: JSON.stringify([3, 3, 5, 5, 6, 7]), isHidden: false },
      { input: JSON.stringify([[1], 1]), expectedOutput: JSON.stringify([1]), isHidden: false },
      { input: JSON.stringify([[1, -1], 1]), expectedOutput: JSON.stringify([1, -1]), isHidden: false },
      { input: JSON.stringify([[9, 11], 2]), expectedOutput: JSON.stringify([11]), isHidden: true },
      { input: JSON.stringify([[4, 3, 11, 4, 3, 8, 2, 9], 3]), expectedOutput: JSON.stringify([11, 11, 11, 8, 8, 9]), isHidden: true }
    ]
  },

  // 9. Full Stack / MERN - LRU Cache Engine
  {
    title: "LRU Cache Eviction Architecture & Operations",
    technology: "React & Node.js (MERN)",
    difficulty: "Hard",
    timeMinutes: 35,
    solutionFunctionName: "lruCacheOperations",
    defaultLanguage: "javascript",
    description: `### Problem Description
Implement a complete Least Recently Used (LRU) Cache operation simulator conforming to strict \`O(1)\` access requirements.

Given an integer \`capacity\` and a sequence of operations \`operations\`, execute each in sequence:
- \`["put", key, value]\`: Insert or update the key-value pair. If number of keys exceeds \`capacity\`, evict the least recently used key.
- \`["get", key]\`: Retrieve the value of \`key\` if present, otherwise return \`-1\`. Marks the key as most recently accessed.

Return an array containing all results produced by the \`"get"\` operations.

### Example 1
- **Input:** \`capacity = 2, operations = [["put", 1, 1], ["put", 2, 2], ["get", 1], ["put", 3, 3], ["get", 2], ["put", 4, 4], ["get", 1], ["get", 3], ["get", 4]]\`
- **Output:** \`[1, -1, -1, 3, 4]\`

### Constraints
- \`1 <= capacity <= 3000\`
- \`1 <= operations.length <= 10^4\`
- Average time per operation must be \`O(1)\`.`,
    starterCodes: {
      javascript: `/**
 * @param {number} capacity
 * @param {Array} operations
 * @return {number[]}
 */
function lruCacheOperations(capacity, operations) {
  // Write your code here
  
}`,
      python: `def lruCacheOperations(capacity: int, operations: list) -> list[int]:
    # Write your python code here
    pass`
    },
    testCases: [
      { input: JSON.stringify([2, [["put", 1, 1], ["put", 2, 2], ["get", 1], ["put", 3, 3], ["get", 2], ["put", 4, 4], ["get", 1], ["get", 3], ["get", 4]]]), expectedOutput: JSON.stringify([1, -1, -1, 3, 4]), isHidden: false },
      { input: JSON.stringify([1, [["put", 2, 1], ["get", 2], ["put", 3, 2], ["get", 2], ["get", 3]]]), expectedOutput: JSON.stringify([1, -1, 2]), isHidden: false },
      { input: JSON.stringify([2, [["get", 2]]]), expectedOutput: JSON.stringify([-1]), isHidden: false },
      { input: JSON.stringify([3, [["put", 1, 10], ["put", 2, 20], ["put", 3, 30], ["get", 1], ["put", 4, 40], ["get", 2], ["get", 3], ["get", 4]]]), expectedOutput: JSON.stringify([10, -1, 30, 40]), isHidden: true },
      { input: JSON.stringify([2, [["put", 2, 1], ["put", 1, 1], ["put", 2, 3], ["put", 4, 1], ["get", 1], ["get", 2]]]), expectedOutput: JSON.stringify([-1, 3]), isHidden: true }
    ]
  },

  // 10. Python - Meeting Rooms II
  {
    title: "Meeting Rooms II: Conference Room Resource Allocation",
    technology: "Python & Django/FastAPI",
    difficulty: "Hard",
    timeMinutes: 30,
    solutionFunctionName: "minMeetingRooms",
    defaultLanguage: "python",
    description: `### Problem Description
Given an array of meeting time intervals \`intervals\` where \`intervals[i] = [start_i, end_i]\`, return the minimum number of conference rooms required so that all meetings can proceed without overlap.

### Example 1
- **Input:** \`intervals = [[0, 30], [5, 10], [15, 20]]\`
- **Output:** \`2\`
- **Explanation:** Meeting 1 overlaps with meeting 2 and 3, requiring at least 2 distinct conference rooms.

### Example 2
- **Input:** \`intervals = [[7, 10], [2, 4]]\`
- **Output:** \`1\`

### Constraints
- \`1 <= intervals.length <= 10^4\`
- \`0 <= start_i < end_i <= 10^6\`
- **Target Complexity:** Time \`O(N log N)\``,
    starterCodes: {
      javascript: `/**
 * @param {number[][]} intervals
 * @return {number}
 */
function minMeetingRooms(intervals) {
  // Write your code here
  
}`,
      python: `def minMeetingRooms(intervals: list[list[int]]) -> int:
    # Write your python code here
    pass`
    },
    testCases: [
      { input: JSON.stringify([[[0, 30], [5, 10], [15, 20]]]), expectedOutput: JSON.stringify(2), isHidden: false },
      { input: JSON.stringify([[[7, 10], [2, 4]]]), expectedOutput: JSON.stringify(1), isHidden: false },
      { input: JSON.stringify([[[1, 5], [5, 10], [10, 15]]]), expectedOutput: JSON.stringify(1), isHidden: false, explanation: "Back-to-back meetings use the same room" },
      { input: JSON.stringify([[[1, 10], [2, 7], [3, 19], [8, 12], [10, 20], [11, 30]]]), expectedOutput: JSON.stringify(4), isHidden: true },
      { input: JSON.stringify([[]]), expectedOutput: JSON.stringify(0), isHidden: true }
    ]
  },

  // 11. Core Technical / Java - Expression Calculator
  {
    title: "Basic Calculator & Arithmetic Expression Evaluator",
    technology: "Java Spring Boot & Microservices",
    difficulty: "Hard",
    timeMinutes: 35,
    solutionFunctionName: "calculate",
    defaultLanguage: "javascript",
    description: `### Problem Description
Implement a mathematical expression parser and evaluator that computes the value of a string expression \`s\`.

The expression \`s\` contains:
- Non-negative integers
- Operators \`+\`, \`-\`, \`*\`, \`/\`
- Parentheses \`(\` and \`)\`
- Whitespace characters

Follow standard operator precedence (parentheses first, then multiplication/division, then addition/subtraction). Division should truncate toward zero (integer division).

### Example 1
- **Input:** \`s = "1 + 1"\`
- **Output:** \`2\`

### Example 2
- **Input:** \`s = " 6-4 / 2 "\`
- **Output:** \`4\`

### Example 3
- **Input:** \`s = "2*(5+5*2)/3+(6/2+8)"\`
- **Output:** \`21\`

### Constraints
- \`1 <= s.length <= 10^4\`
- \`s\` consists of digits, \`+\`, \`-\`, \`*\`, \`/\`, \`(\`, \`)\`, and spaces.
- The given expression is always syntactically valid.`,
    starterCodes: {
      javascript: `/**
 * @param {string} s
 * @return {number}
 */
function calculate(s) {
  // Write your code here
  
}`,
      python: `def calculate(s: str) -> int:
    # Write your python code here
    pass`
    },
    testCases: [
      { input: JSON.stringify(["1 + 1"]), expectedOutput: JSON.stringify(2), isHidden: false },
      { input: JSON.stringify([" 6-4 / 2 "]), expectedOutput: JSON.stringify(4), isHidden: false },
      { input: JSON.stringify(["2*(5+5*2)/3+(6/2+8)"]), expectedOutput: JSON.stringify(21), isHidden: false },
      { input: JSON.stringify(["(2+6* 3 +5- (3*14/7+2)*5)+3"]), expectedOutput: JSON.stringify(-12), isHidden: true },
      { input: JSON.stringify(["0"]), expectedOutput: JSON.stringify(0), isHidden: true }
    ]
  },

  // 12. Global / All - Merge k Sorted Arrays
  {
    title: "Merge k Sorted Arrays & Linked Streams",
    technology: "All",
    difficulty: "Hard",
    timeMinutes: 35,
    solutionFunctionName: "mergeKLists",
    defaultLanguage: "javascript",
    description: `### Problem Description
You are given an array of \`k\` sorted arrays \`lists\`, where each individual array is sorted in ascending order.

Merge all the sorted arrays into a single unified array sorted in ascending order and return it.
Your algorithm must be optimal, achieving **\`O(N log k)\`** time complexity (where \`N\` is total elements across all lists) using Divide & Conquer or a Min-Heap.

### Example 1
- **Input:** \`lists = [[1, 4, 5], [1, 3, 4], [2, 6]]\`
- **Output:** \`[1, 1, 2, 3, 4, 4, 5, 6]\`

### Example 2
- **Input:** \`lists = []\`
- **Output:** \`[]\`

### Example 3
- **Input:** \`lists = [[]]\`
- **Output:** \`[]\`

### Constraints
- \`k == lists.length\`
- \`0 <= k <= 10^4\`
- \`0 <= lists[i].length <= 500\`
- \`-10^4 <= lists[i][j] <= 10^4\`
- Total number of elements across all lists <= \`10^5\``,
    starterCodes: {
      javascript: `/**
 * @param {number[][]} lists
 * @return {number[]}
 */
function mergeKLists(lists) {
  // Write your code here
  
}`,
      python: `def mergeKLists(lists: list[list[int]]) -> list[int]:
    # Write your python code here
    pass`
    },
    testCases: [
      { input: JSON.stringify([[[1, 4, 5], [1, 3, 4], [2, 6]]]), expectedOutput: JSON.stringify([1, 1, 2, 3, 4, 4, 5, 6]), isHidden: false },
      { input: JSON.stringify([[]]), expectedOutput: JSON.stringify([]), isHidden: false },
      { input: JSON.stringify([[[]]]), expectedOutput: JSON.stringify([]), isHidden: false },
      { input: JSON.stringify([[[1, 10, 20], [2, 5, 15, 25], [30]]]), expectedOutput: JSON.stringify([1, 2, 5, 10, 15, 20, 25, 30]), isHidden: true },
      { input: JSON.stringify([[[-10, -5, 0], [-8, 2, 4], [-20, -1]]]), expectedOutput: JSON.stringify([-20, -10, -8, -5, -1, 0, 2, 4]), isHidden: true }
    ]
  }
];

module.exports = {
  DEFAULT_TECH_CONFIGS,
  DEFAULT_CHALLENGES
};
