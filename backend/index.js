import express from 'express';
import cors from 'cors';
import multer from 'multer';
import dotenv from 'dotenv';
import pdfParse from 'pdf-parse';
import mammoth from 'mammoth';
import mongoose from 'mongoose';

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

// Enhanced AI scoring function
const scoreAnswer = (question, answer, difficulty) => {
  if (!answer || answer.trim().length === 0) {
    return 0;
  }

  let baseScore = 30;
  const answerLength = answer.trim().length;
  
  // Length-based scoring
  if (answerLength > 20) baseScore += 20;
  if (answerLength > 50) baseScore += 15;
  if (answerLength > 100) baseScore += 10;
  
  // Difficulty-based scoring adjustments
  const difficultyMultiplier = {
    'easy': 1.0,
    'medium': 1.2,
    'hard': 1.5
  };
  
  // Keyword-based scoring (simple implementation)
  const keywords = {
    react: ['react', 'component', 'jsx', 'hook', 'state', 'props', 'virtual dom', 'lifecycle', 'rendering'],
    javascript: ['javascript', 'function', 'variable', 'scope', 'closure', 'async', 'promise', 'es6', 'arrow function'],
    general: ['performance', 'optimization', 'best practice', 'design pattern', 'architecture', 'testing']
  };
  
  let keywordScore = 0;
  const lowerAnswer = answer.toLowerCase();
  
  Object.values(keywords).flat().forEach(keyword => {
    if (lowerAnswer.includes(keyword)) {
      keywordScore += 5;
    }
  });
  
  const finalScore = Math.min(100, Math.round(
    (baseScore + keywordScore + Math.random() * 15) * difficultyMultiplier[difficulty]
  ));
  
  return finalScore;
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
    const { candidateInfo } = req.body;
    
    if (!candidateInfo || !candidateInfo.name || !candidateInfo.email || !candidateInfo.phone) {
      return res.status(400).json({ error: 'Missing required candidate information' });
    }

    // Generate random questions
    const questions = generateQuestions();
    
    res.json({
      success: true,
      questions: questions,
      candidateInfo: candidateInfo
    });
  } catch (error) {
    console.error('Start interview error:', error);
    res.status(500).json({ error: 'Failed to start interview' });
  }
});

app.post('/api/submit-answer', async (req, res) => {
  try {
    const { question, answer, candidateInfo } = req.body;
    
    // Enhanced AI scoring
    const score = scoreAnswer(question, answer, question.difficulty);
    
    res.json({
      success: true,
      score: score,
      feedback: `Answer evaluated. Score: ${score}/100`
    });
  } catch (error) {
    console.error('Submit answer error:', error);
    res.status(500).json({ error: 'Failed to submit answer' });
  }
});

app.post('/api/complete-interview', async (req, res) => {
  try {
    const { candidateInfo, answers, scores, questions } = req.body;
    
    const finalScore = Math.round(scores.reduce((sum, score) => sum + score, 0) / scores.length);
    const summary = generateAISummary(candidateInfo, answers, scores, questions);
    
    // Save candidate to database
    const candidateData = {
      name: candidateInfo.name,
      email: candidateInfo.email,
      phone: candidateInfo.phone,
      finalScore: finalScore,
      summary: summary,
      answers: answers,
      scores: scores,
      questions: questions || [],
      startedAt: new Date(),
      completedAt: new Date()
    };
    
    const savedCandidate = await saveCandidate(candidateData);
    
    res.json({
      success: true,
      finalScore: finalScore,
      summary: summary,
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

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
