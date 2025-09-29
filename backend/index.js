import express from 'express';
import cors from 'cors';
import multer from 'multer';
import dotenv from 'dotenv';
import pdfParse from 'pdf-parse';
import mammoth from 'mammoth';
import mongoose from 'mongoose';
import { GoogleGenerativeAI } from '@google/generative-ai';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

// MongoDB connection
const connectDB = async () => {
  try {
    if (process.env.MONGODB_URI) {
      await mongoose.connect(process.env.MONGODB_URI);
      console.log('MongoDB connected successfully');
    } else {
      console.log('MongoDB URI not provided, using in-memory storage');
    }
  } catch (error) {
    console.error('MongoDB connection error:', error);
    console.log('Falling back to in-memory storage');
  }
};

// Connect to MongoDB
connectDB();

// Candidate Schema
const candidateSchema = new mongoose.Schema({
  name: { type: String, required: true },
  email: { type: String, required: true },
  phone: { type: String, required: true },
  finalScore: { type: Number, required: true },
  summary: { type: String, required: true },
  answers: [{ type: String }],
  scores: [{ type: Number }],
  questions: [{
    id: String,
    question: String,
    category: String,
    difficulty: String,
    timeLimit: Number
  }],
  completedAt: { type: Date, default: Date.now },
  startedAt: { type: Date, required: true }
});

const Candidate = mongoose.model('Candidate', candidateSchema);

// In-memory storage fallback
let inMemoryCandidates = [];

// Initialize Gemini AI
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const model = genAI.getGenerativeModel({ model: "gemini-pro" });

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// Configure multer for file uploads (PDF and DOCX support)
const storage = multer.memoryStorage();
const upload = multer({ 
  storage: storage,
  fileFilter: (req, file, cb) => {
    if (file.mimetype === 'application/pdf' || 
        file.mimetype === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
      cb(null, true);
    } else {
      cb(new Error('Only PDF and DOCX files are allowed'), false);
    }
  }
});

// Enhanced resume parsing function with better formatting
const parseResumeContent = async (filename, fileBuffer, mimetype) => {
  let textContent = '';
  
  try {
    if (mimetype === 'application/pdf') {
      const pdfData = await pdfParse(fileBuffer);
      textContent = pdfData.text;
    } else if (mimetype === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
      const docxData = await mammoth.extractRawText({ buffer: fileBuffer });
      textContent = docxData.value;
    }
  } catch (error) {
    console.error('Error parsing file:', error);
    // Fallback to filename-based extraction
    return parseResumeFromFilename(filename);
  }

  // Clean and normalize the text content
  textContent = textContent.replace(/\s+/g, ' ').trim();
  
  console.log('Parsed text content:', textContent.substring(0, 200) + '...');

  // Extract information using improved regex patterns
  const extractedData = {
    name: null,
    email: null,
    phone: null
  };

  // Extract name with more strict patterns to ensure chatbot testing
  const namePatterns = [
    // Look for "Name:" or similar labels
    /(?:name|full\s*name|applicant|contact\s*name)[\s:]*([a-zA-Z\s\.]{2,50})/i,
    // Look for capitalized words at the beginning
    /^([A-Z][a-z]+(?:\s+[A-Z][a-z]+){1,3})/m,
    // Look for name patterns with titles
    /(?:Mr\.|Ms\.|Mrs\.|Dr\.)\s*([A-Z][a-z]+(?:\s+[A-Z][a-z]+){1,2})/i,
    // Look for names in contact sections
    /(?:contact|about|profile)[\s\S]*?([A-Z][a-z]+(?:\s+[A-Z][a-z]+){1,3})/i
  ];
  
  for (const pattern of namePatterns) {
    const match = textContent.match(pattern);
    if (match && match[1]) {
      const name = match[1].trim();
      // More strict validation - only accept names that look very realistic
      if (name.split(/\s+/).length >= 2 && name.split(/\s+/).length <= 4 && 
          /^[A-Z][a-z]+(\s+[A-Z][a-z]+)+$/.test(name)) {
        extractedData.name = name;
        console.log('Found name:', name);
        break;
      }
    }
  }

  // Extract email with better validation
  const emailPatterns = [
    // Standard email pattern
    /([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/g,
    // Email with spaces around it
    /\s([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})\s/g
  ];
  
  for (const pattern of emailPatterns) {
    const matches = textContent.match(pattern);
    if (matches) {
      // Take the first valid email
      for (const match of matches) {
        const email = match.trim();
        if (email.includes('@') && email.includes('.') && !email.includes(' ')) {
          extractedData.email = email;
          console.log('Found email:', email);
          break;
        }
      }
      if (extractedData.email) break;
    }
  }

  // Extract phone number with better patterns
  const phonePatterns = [
    // US format with parentheses
    /(\(?[0-9]{3}\)?[-.\s]?[0-9]{3}[-.\s]?[0-9]{4})/g,
    // International format
    /(\+?[0-9]{1,3}[-.\s]?[0-9]{3,4}[-.\s]?[0-9]{3,4}[-.\s]?[0-9]{3,4})/g,
    // Phone with labels
    /(?:phone|tel|mobile|cell)[\s:]*([+\-\s\(\)0-9]{10,})/gi
  ];
  
  for (const pattern of phonePatterns) {
    const matches = textContent.match(pattern);
    if (matches) {
      // Take the first valid phone number
      for (const match of matches) {
        const phone = match.replace(/[^\d\+\-\(\)\s]/g, '').trim();
        if (phone.length >= 10 && phone.length <= 15) {
          extractedData.phone = phone;
          console.log('Found phone:', phone);
          break;
        }
      }
      if (extractedData.phone) break;
    }
  }

  // If no data extracted, fallback to filename-based extraction
  if (!extractedData.name && !extractedData.email && !extractedData.phone) {
    console.log('No data extracted, using fallback');
    return parseResumeFromFilename(filename);
  }

  console.log('Final extracted data:', extractedData);
  return extractedData;
};

// Enhanced fallback function with better formatting
const parseResumeFromFilename = (filename) => {
  const extractedData = {
    name: null,
    email: null,
    phone: null
  };

  console.log('Using fallback parsing for filename:', filename);

  // Remove file extension and clean filename
  const cleanFilename = filename.replace(/\.(pdf|docx)$/i, '').trim();
  
  // Try to extract name from filename (common patterns)
  const namePatterns = [
    // FirstName_LastName format
    /^([A-Z][a-z]+)[_\-\s]+([A-Z][a-z]+)$/,
    // LastName_FirstName format
    /^([A-Z][a-z]+)[_\-\s]+([A-Z][a-z]+)$/,
    // FirstNameLastName format
    /^([A-Z][a-z]+)([A-Z][a-z]+)$/
  ];

  for (const pattern of namePatterns) {
    const match = cleanFilename.match(pattern);
    if (match) {
      if (match.length === 3) {
        extractedData.name = `${match[1]} ${match[2]}`;
      }
      break;
    }
  }

  // If still no name, use the clean filename as name
  if (!extractedData.name && cleanFilename.length > 0) {
    extractedData.name = cleanFilename.replace(/[_\-\s]+/g, ' ');
  }

  // Generate realistic email based on name
  if (extractedData.name) {
    const nameParts = extractedData.name.toLowerCase().split(/\s+/);
    if (nameParts.length >= 2) {
      extractedData.email = `${nameParts[0]}.${nameParts[nameParts.length - 1]}@email.com`;
    }
  }

  // Generate a placeholder phone number
  extractedData.phone = '+1-555-0000';

  console.log('Fallback extracted data:', extractedData);
  return extractedData;
};

// Question pools with more variety
const questionPools = {
  easy: [
    { question: "What is React and what are its main features?", category: "React Basics" },
    { question: "Explain the difference between let, const, and var in JavaScript.", category: "JavaScript Fundamentals" },
    { question: "What is the purpose of useEffect in React?", category: "React Hooks" },
    { question: "How do you handle events in React?", category: "React Events" },
    { question: "What is the difference between == and === in JavaScript?", category: "JavaScript Operators" },
    { question: "What is JSX in React?", category: "React Basics" },
    { question: "How do you create a component in React?", category: "React Components" },
    { question: "What is the virtual DOM in React?", category: "React Architecture" },
    { question: "How do you pass data between components in React?", category: "React Props" },
    { question: "What is state in React?", category: "React State" }
  ],
  medium: [
    { question: "Explain the React component lifecycle methods.", category: "React Lifecycle" },
    { question: "How do you manage state in React applications?", category: "State Management" },
    { question: "What is the difference between props and state?", category: "React Concepts" },
    { question: "How do you handle forms in React?", category: "React Forms" },
    { question: "Explain the concept of virtual DOM in React.", category: "React Architecture" },
    { question: "What are React Hooks and why are they useful?", category: "React Hooks" },
    { question: "How do you handle API calls in React?", category: "React API Integration" },
    { question: "What is the difference between functional and class components?", category: "React Components" },
    { question: "How do you implement conditional rendering in React?", category: "React Rendering" },
    { question: "What is the purpose of keys in React lists?", category: "React Lists" }
  ],
  hard: [
    { question: "How do you optimize React application performance?", category: "Performance Optimization" },
    { question: "Explain the difference between controlled and uncontrolled components.", category: "Advanced React" },
    { question: "How do you implement error boundaries in React?", category: "Error Handling" },
    { question: "What is the difference between useCallback and useMemo?", category: "React Optimization" },
    { question: "How do you handle authentication in React applications?", category: "Authentication" },
    { question: "Explain React Context and when to use it.", category: "State Management" },
    { question: "How do you implement code splitting in React?", category: "Performance Optimization" },
    { question: "What is the difference between useReducer and useState?", category: "React Hooks" },
    { question: "How do you implement custom hooks in React?", category: "Custom Hooks" },
    { question: "Explain React Suspense and concurrent features.", category: "Advanced React" }
  ]
};

// Generate random questions
const generateQuestions = () => {
  const questions = [];
  
  // 2 Easy questions
  for (let i = 0; i < 2; i++) {
    const randomIndex = Math.floor(Math.random() * questionPools.easy.length);
    const questionData = questionPools.easy[randomIndex];
    questions.push({
      id: `easy_${i + 1}`,
      question: questionData.question,
      category: questionData.category,
      difficulty: 'easy',
      timeLimit: 20
    });
  }
  
  // 2 Medium questions
  for (let i = 0; i < 2; i++) {
    const randomIndex = Math.floor(Math.random() * questionPools.medium.length);
    const questionData = questionPools.medium[randomIndex];
    questions.push({
      id: `medium_${i + 1}`,
      question: questionData.question,
      category: questionData.category,
      difficulty: 'medium',
      timeLimit: 60
    });
  }
  
  // 2 Hard questions
  for (let i = 0; i < 2; i++) {
    const randomIndex = Math.floor(Math.random() * questionPools.hard.length);
    const questionData = questionPools.hard[randomIndex];
    questions.push({
      id: `hard_${i + 1}`,
      question: questionData.question,
      category: questionData.category,
      difficulty: 'hard',
      timeLimit: 120
    });
  }
  
  return questions;
};

// Generate sample answers for each question
const generateSampleAnswer = (question, difficulty) => {
  const sampleAnswers = {
    // Easy questions
    "What is React and what are its main features?": "React is a JavaScript library for building user interfaces, particularly web applications. Its main features include: 1) Component-based architecture - allows building reusable UI components, 2) Virtual DOM - improves performance by minimizing direct DOM manipulation, 3) JSX - syntax extension that allows writing HTML-like code in JavaScript, 4) Unidirectional data flow - makes the application more predictable and easier to debug, 5) Rich ecosystem - with tools like React Router, Redux, and many third-party libraries.",
    
    "Explain the difference between let, const, and var in JavaScript.": "The main differences are: 1) **Scope**: var is function-scoped, while let and const are block-scoped. 2) **Hoisting**: var declarations are hoisted and initialized with undefined, let and const are hoisted but not initialized (temporal dead zone). 3) **Reassignment**: var and let can be reassigned, const cannot be reassigned after declaration. 4) **Redeclaration**: var can be redeclared in the same scope, let and const cannot. 5) **Best Practice**: Use const by default, let when you need to reassign, avoid var.",
    
    "What is the purpose of useEffect in React?": "useEffect is a React Hook that allows you to perform side effects in functional components. Its purposes include: 1) **Data fetching** - making API calls when component mounts or data changes, 2) **Setting up subscriptions** - connecting to external data sources, 3) **Manual DOM manipulation** - updating document title, adding event listeners, 4) **Cleanup** - removing event listeners, canceling API requests when component unmounts. The hook takes a function and an optional dependency array to control when the effect runs.",
    
    // Medium questions
    "Explain the React component lifecycle methods.": "React class components have several lifecycle methods: 1) **Mounting**: componentDidMount() - called after component is rendered to DOM, 2) **Updating**: componentDidUpdate() - called after component updates, componentWillReceiveProps() - called when new props are received, 3) **Unmounting**: componentWillUnmount() - called before component is removed from DOM, 4) **Error Handling**: componentDidCatch() - catches errors in child components. In functional components, useEffect replaces these methods with dependency arrays controlling when effects run.",
    
    "How do you manage state in React applications?": "State management approaches include: 1) **Local State**: useState hook for component-specific state, 2) **Context API**: for sharing state across multiple components without prop drilling, 3) **External Libraries**: Redux for complex applications with predictable state updates, 4) **Custom Hooks**: for reusable stateful logic, 5) **Server State**: libraries like React Query for API data. Choose based on application complexity - start with local state and useState, move to Context for moderate complexity, consider Redux for large applications.",
    
    "What is the difference between props and state?": "Props and state are both ways to store data in React: 1) **Props**: immutable data passed from parent to child components, cannot be modified by child, used for configuration and communication, 2) **State**: mutable data owned by the component, can be updated using setState or useState, triggers re-renders when changed, 3) **Key Difference**: Props flow down, state stays local. Props are like function parameters, state is like component's internal memory. Use props for data that doesn't change, state for data that can change and affects rendering.",
    
    // Hard questions
    "How do you optimize React application performance?": "Performance optimization strategies include: 1) **Code Splitting**: Use React.lazy() and Suspense for route-based splitting, 2) **Memoization**: React.memo() for component memoization, useMemo() for expensive calculations, useCallback() for function memoization, 3) **Virtualization**: For large lists using react-window or react-virtualized, 4) **Bundle Optimization**: Tree shaking, minification, compression, 5) **State Management**: Keep state as local as possible, avoid unnecessary re-renders, 6) **Profiling**: Use React DevTools Profiler to identify bottlenecks, 7) **Server-Side Rendering**: Use Next.js for better initial load performance.",
    
    "Explain the difference between controlled and uncontrolled components.": "Controlled vs Uncontrolled components: 1) **Controlled**: Form data is handled by React state, input value is controlled by component state, onChange handlers update state, React controls the form behavior, better for validation and complex interactions, 2) **Uncontrolled**: Form data is handled by DOM, use refs to access input values, defaultValue sets initial value, DOM controls the form behavior, simpler for basic forms, 3) **When to use**: Controlled for dynamic validation, complex state management, uncontrolled for simple forms or when integrating with non-React code.",
    
    "How do you implement error boundaries in React?": "Error boundaries catch JavaScript errors in child components: 1) **Class Component**: Create a class component that implements componentDidCatch(error, errorInfo) and render() methods, 2) **Usage**: Wrap components that might throw errors, 3) **Limitations**: Only catch errors in render methods, lifecycle methods, and constructors, not in event handlers, async code, or during server-side rendering, 4) **Implementation**: class ErrorBoundary extends React.Component { componentDidCatch(error, errorInfo) { logError(error, errorInfo); } render() { return this.state.hasError ? <h1>Something went wrong</h1> : this.props.children; } }",
    
    "What is the difference between useCallback and useMemo?": "useCallback and useMemo are optimization hooks: 1) **useCallback**: Returns a memoized callback function, prevents child re-renders when passing functions as props, use when passing functions to child components, 2) **useMemo**: Returns a memoized value, prevents expensive calculations on every render, use for expensive computations, 3) **Syntax**: useCallback(fn, deps) vs useMemo(() => fn(), deps), 4) **When to use**: useCallback for function references, useMemo for computed values, 5) **Dependencies**: Both take dependency arrays - only re-run when dependencies change, 6) **Performance**: Use sparingly, only when you have performance issues, as they add overhead."
  };

  // Return specific sample answer if available, otherwise generate a generic one
  if (sampleAnswers[question.question]) {
    return sampleAnswers[question.question];
  }

  // Generate generic sample answer based on difficulty and category
  const genericAnswers = {
    easy: `A good answer for this ${question.category} question would include: 1) A clear definition of the main concept, 2) Key features or characteristics, 3) Simple examples or use cases, 4) Basic benefits or importance. For this question about ${question.question.toLowerCase()}, you should explain the fundamental concept clearly and provide a practical example.`,
    
    medium: `An effective answer for this ${question.category} question should cover: 1) Detailed explanation of the concept, 2) Comparison with related concepts, 3) Real-world examples or scenarios, 4) Best practices or common patterns, 5) Potential challenges or considerations. For this question, demonstrate understanding through examples and show how this concept applies in actual development scenarios.`,
    
    hard: `A comprehensive answer for this advanced ${question.category} question should include: 1) Deep technical understanding, 2) Multiple approaches or strategies, 3) Performance implications, 4) Trade-offs and alternatives, 5) Real-world implementation examples, 6) Common pitfalls to avoid. For this complex question, show expertise by discussing various approaches, their pros and cons, and when to use each approach in different scenarios.`
  };

  return genericAnswers[difficulty] || genericAnswers.medium;
};

// Generate AI feedback for individual answers
const generateAnswerFeedback = (question, answer, score, difficulty, aiFeedback = null, sampleAnswer = null) => {
  if (aiFeedback && sampleAnswer) {
    return {
      feedback: aiFeedback,
      suggestions: generateSuggestions(score, difficulty),
      sampleAnswer: sampleAnswer
    };
  }
  
  if (!answer || answer.trim().length === 0) {
    return {
      feedback: "No answer provided within the time limit. Consider reviewing the fundamental concepts related to this topic.",
      suggestions: ["Review basic concepts", "Practice time management", "Study related materials"],
      sampleAnswer: generateSampleAnswer(question, difficulty)
    };
  }

  const answerLength = answer.trim().length;
  let feedback = "";
  let suggestions = [];

  // Generate feedback based on score and content
  if (score >= 80) {
    feedback = `Excellent answer! Your response demonstrates strong understanding of ${question.category.toLowerCase()}. `;
    if (answerLength > 100) {
      feedback += "You provided comprehensive details and showed deep knowledge of the topic.";
    } else {
      feedback += "Your answer was concise yet covered the key points effectively.";
    }
    suggestions = ["Continue building on this knowledge", "Share your expertise with others", "Explore advanced topics"];
  } else if (score >= 60) {
    feedback = `Good response! You showed solid understanding of ${question.category.toLowerCase()}. `;
    if (answerLength > 50) {
      feedback += "Your answer covered the main points well, though there's room for more depth.";
    } else {
      feedback += "Consider expanding your answer with more details and examples.";
    }
    suggestions = ["Review related concepts", "Practice explaining concepts in detail", "Study real-world examples"];
  } else if (score >= 40) {
    feedback = `Your answer shows some understanding but needs improvement in ${question.category.toLowerCase()}. `;
    feedback += "Consider studying the fundamental concepts more thoroughly.";
    suggestions = ["Review basic concepts", "Practice with examples", "Seek additional learning resources"];
  } else {
    feedback = `This area needs significant improvement. Focus on learning the basic concepts of ${question.category.toLowerCase()}. `;
    feedback += "Consider starting with foundational materials.";
    suggestions = ["Study fundamental concepts", "Practice basic examples", "Consider additional training"];
  }

  // Add difficulty-specific feedback
  if (difficulty === 'easy') {
    feedback += " This was a basic question - mastering these fundamentals is crucial for your development journey.";
  } else if (difficulty === 'medium') {
    feedback += " This was an intermediate question - building on your basics with more complex scenarios.";
  } else if (difficulty === 'hard') {
    feedback += " This was an advanced question - these concepts require deep understanding and practical experience.";
  }

  return {
    feedback: feedback.trim(),
    suggestions: suggestions,
    sampleAnswer: generateSampleAnswer(question, difficulty)
  };
};

// Enhanced AI scoring function with feedback generation
const scoreAnswer = async (question, answer, difficulty) => {
  if (!answer || answer.trim().length === 0) {
    return {
      score: 0,
      feedback: generateAnswerFeedback(question, answer, 0, difficulty)
    };
  }

  try {
    const prompt = `
    You are an expert technical interviewer evaluating a candidate's answer for a ${difficulty} level ${question.category} question.
    
    Question: ${question.question}
    Candidate's Answer: ${answer}
    
    Please provide:
    1. A score from 0-100 based on technical accuracy, completeness, and clarity
    2. Detailed feedback explaining strengths and areas for improvement
    3. A sample answer that demonstrates the expected response
    
    Respond in JSON format:
    {
      "score": <number>,
      "feedback": "<detailed feedback>",
      "sampleAnswer": "<sample answer>"
    }
    `;

    const result = await model.generateContent(prompt);
    const response = await result.response;
    const text = response.text();
    
    // Parse the JSON response
    const aiResponse = JSON.parse(text);
    
    return {
      score: aiResponse.score,
      feedback: generateAnswerFeedback(question, answer, aiResponse.score, difficulty, aiResponse.feedback, aiResponse.sampleAnswer)
    };
  } catch (error) {
    console.error('Gemini API error:', error);
    // Fallback to original scoring
    return {
      score: Math.floor(Math.random() * 40) + 30,
      feedback: generateAnswerFeedback(question, answer, 50, difficulty)
    };
  }
};

// Generate AI summary
const generateAISummary = (candidateInfo, answers, scores, questions) => {
  const avgScore = Math.round(scores.reduce((sum, score) => sum + score, 0) / scores.length);
  
  const strengths = [];
  const improvements = [];
  
  // Analyze performance by difficulty
  const easyScores = scores.slice(0, 2);
  const mediumScores = scores.slice(2, 4);
  const hardScores = scores.slice(4, 6);
  
  const easyAvg = easyScores.reduce((sum, score) => sum + score, 0) / easyScores.length;
  const mediumAvg = mediumScores.reduce((sum, score) => sum + score, 0) / mediumScores.length;
  const hardAvg = hardScores.reduce((sum, score) => sum + score, 0) / hardScores.length;
  
  if (easyAvg >= 80) strengths.push("strong fundamental knowledge");
  if (mediumAvg >= 75) strengths.push("good intermediate-level understanding");
  if (hardAvg >= 70) strengths.push("solid advanced concepts grasp");
  
  if (easyAvg < 60) improvements.push("basic concepts need reinforcement");
  if (mediumAvg < 60) improvements.push("intermediate topics require more study");
  if (hardAvg < 50) improvements.push("advanced concepts need significant improvement");
  
  const performanceLevel = avgScore >= 80 ? "Excellent" : avgScore >= 60 ? "Good" : "Needs Improvement";
  
  return `${candidateInfo.name} demonstrated ${performanceLevel.toLowerCase()} performance with an overall score of ${avgScore}/100. ${
    strengths.length > 0 ? `Strengths include ${strengths.join(', ')}.` : ''
  } ${
    improvements.length > 0 ? `Areas for improvement: ${improvements.join(', ')}.` : ''
  } The candidate shows ${avgScore >= 70 ? 'strong potential' : 'room for growth'} for a full-stack developer role.`;
};

// Save candidate to database or memory
const saveCandidate = async (candidateData) => {
  try {
    if (mongoose.connection.readyState === 1) {
      // MongoDB is connected
      const candidate = new Candidate(candidateData);
      await candidate.save();
      return candidate;
    } else {
      // Fallback to in-memory storage
      const candidate = { ...candidateData, _id: Date.now().toString() };
      inMemoryCandidates.push(candidate);
      return candidate;
    }
  } catch (error) {
    console.error('Error saving candidate:', error);
    throw error;
  }
};

// Get all candidates from database or memory
const getCandidates = async () => {
  try {
    if (mongoose.connection.readyState === 1) {
      // MongoDB is connected
      return await Candidate.find().sort({ finalScore: -1 });
    } else {
      // Fallback to in-memory storage
      return inMemoryCandidates.sort((a, b) => b.finalScore - a.finalScore);
    }
  } catch (error) {
    console.error('Error fetching candidates:', error);
    return inMemoryCandidates.sort((a, b) => b.finalScore - a.finalScore);
  }
};

// Routes
app.post('/api/upload-resume', upload.single('resume'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    console.log('Resume file received:', req.file.originalname);
    
    // Parse resume content with actual file parsing
    const extractedData = await parseResumeContent(
      req.file.originalname, 
      req.file.buffer, 
      req.file.mimetype
    );
    
    res.json({
      success: true,
      candidateInfo: extractedData,
      message: 'Resume processed successfully. Please verify and complete any missing information.'
    });
  } catch (error) {
    console.error('Upload error:', error);
    res.status(500).json({ error: 'Failed to process resume' });
  }
});

app.post('/api/start-interview', async (req, res) => {
  try {
    console.log('Start interview request received:', req.body);
    
    const { candidateInfo } = req.body;
    
    if (!candidateInfo || !candidateInfo.name || !candidateInfo.email || !candidateInfo.phone) {
      console.log('Missing candidate information:', candidateInfo);
      return res.status(400).json({ error: 'Missing required candidate information' });
    }

    console.log('Generating questions...');
    // Generate random questions
    const questions = generateQuestions();
    console.log('Generated questions:', questions.length);
    
    const response = {
      success: true,
      questions: questions,
      candidateInfo: candidateInfo
    };
    
    console.log('Sending response:', response);
    res.json(response);
  } catch (error) {
    console.error('Start interview error:', error);
    res.status(500).json({ error: 'Failed to start interview' });
  }
});

app.post('/api/submit-answer', async (req, res) => {
  try {
    console.log('Submit answer request received:', req.body);
    
    const { question, answer, candidateInfo } = req.body;
    
    if (!question) {
      return res.status(400).json({ error: 'Question is required' });
    }
    
    if (!candidateInfo) {
      return res.status(400).json({ error: 'Candidate info is required' });
    }
    
    // Use Gemini AI for scoring
    const result = await scoreAnswer(question, answer, question.difficulty);
    
    console.log('Scoring result:', result);
    
    res.json({
      success: true,
      score: result.score,
      feedback: result.feedback,
      message: `Answer evaluated. Score: ${result.score}/100`
    });
  } catch (error) {
    console.error('Submit answer error:', error);
    res.status(500).json({ 
      error: 'Failed to submit answer',
      details: error.message 
    });
  }
});

// Update the complete interview route to include sample answers
app.post('/api/complete-interview', async (req, res) => {
  try {
    const { candidateInfo, answers, scores, questions } = req.body;
    
    const finalScore = Math.round(scores.reduce((sum, score) => sum + score, 0) / scores.length);
    
    // Generate feedback for each answer (including sample answers)
    const answerFeedbacks = answers.map((answer, index) => {
      const question = questions[index];
      const score = scores[index];
      return generateAnswerFeedback(question, answer, score, question.difficulty);
    });
    
    const summary = generateAISummary(candidateInfo, answers, scores, questions);
    
    // Save candidate to database with feedback and sample answers
    const candidateData = {
      name: candidateInfo.name,
      email: candidateInfo.email,
      phone: candidateInfo.phone,
      finalScore: finalScore,
      summary: summary,
      answers: answers,
      scores: scores,
      questions: questions,
      answerFeedbacks: answerFeedbacks,
      startedAt: new Date(),
      completedAt: new Date()
    };
    
    const savedCandidate = await saveCandidate(candidateData);
    
    res.json({
      success: true,
      finalScore: finalScore,
      summary: summary,
      answerFeedbacks: answerFeedbacks,
      candidateId: savedCandidate._id
    });
  } catch (error) {
    console.error('Complete interview error:', error);
    res.status(500).json({ error: 'Failed to complete interview' });
  }
});

// New route to get all candidates
app.get('/api/candidates', async (req, res) => {
  try {
    const candidates = await getCandidates();
    res.json({
      success: true,
      candidates: candidates
    });
  } catch (error) {
    console.error('Get candidates error:', error);
    res.status(500).json({ error: 'Failed to fetch candidates' });
  }
});

// Generate LLM answer for a question
app.post('/api/generate-llm-answer', async (req, res) => {
  try {
    const { question } = req.body;
    
    if (!question) {
      return res.status(400).json({ error: 'Question is required' });
    }
    
    const prompt = `
    You are an expert technical interviewer. Please provide a comprehensive, well-structured answer to this ${question.difficulty} level ${question.category} question.
    
    Question: ${question.question}
    
    Please provide a detailed answer that includes:
    1. Clear explanation of the concept
    2. Practical examples or use cases
    3. Best practices or important considerations
    4. Code examples if applicable
    
    Make the answer educational and comprehensive, suitable for someone learning or reviewing this topic.
    `;

    const result = await model.generateContent(prompt);
    const response = await result.response;
    const llmAnswer = response.text();
    
    res.json({
      success: true,
      llmAnswer: llmAnswer,
      message: 'Correct answer generated successfully'
    });
  } catch (error) {
    console.error('Generate LLM answer error:', error);
    res.status(500).json({ 
      error: 'Failed to generate LLM answer',
      details: error.message 
    });
  }
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
