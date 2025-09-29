import React, { createContext, useContext, useReducer, useEffect } from 'react';

const InterviewContext = createContext();

const initialState = {
  candidateInfo: null,
  resumeData: null,
  missingFields: [],
  chatbotActive: false,
  interviewState: {
    isStarted: false,
    isComplete: false,
    isPaused: false,
    questions: [],
    currentQuestionIndex: 0,
    answers: [],
    scores: [],
    finalScore: null,
    summary: null,
    startedAt: null,
    completedAt: null
  },
  candidates: []
};

const interviewReducer = (state, action) => {
  switch (action.type) {
    case 'SET_RESUME_DATA':
      const { candidateInfo, missingFields } = action.payload;
      return {
        ...state,
        resumeData: candidateInfo,
        missingFields: missingFields,
        chatbotActive: missingFields.length > 0
      };
    
    case 'SET_CANDIDATE_INFO':
      return {
        ...state,
        candidateInfo: action.payload,
        chatbotActive: false,
        missingFields: []
      };
    
    case 'UPDATE_MISSING_FIELD':
      const { field, value } = action.payload;
      const updatedResumeData = { ...state.resumeData, [field]: value };
      const updatedMissingFields = state.missingFields.filter(f => f !== field);
      
      return {
        ...state,
        resumeData: updatedResumeData,
        missingFields: updatedMissingFields,
        chatbotActive: updatedMissingFields.length > 0
      };
    
    case 'START_INTERVIEW':
      return {
        ...state,
        candidateInfo: action.payload.candidateInfo,
        interviewState: {
          ...state.interviewState,
          isStarted: true,
          isPaused: false,
          questions: action.payload.questions,
          currentQuestionIndex: 0,
          answers: [],
          scores: [],
          startedAt: new Date().toISOString()
        }
      };
    
    case 'PAUSE_INTERVIEW':
      return {
        ...state,
        interviewState: {
          ...state.interviewState,
          isPaused: true
        }
      };
    
    case 'RESUME_INTERVIEW':
      return {
        ...state,
        interviewState: {
          ...state.interviewState,
          isPaused: false
        }
      };
    
    case 'SUBMIT_ANSWER':
      return {
        ...state,
        interviewState: {
          ...state.interviewState,
          answers: [...state.interviewState.answers, action.payload.answer],
          scores: [...state.interviewState.scores, action.payload.score]
        }
      };
    
    case 'TIMEOUT_ANSWER':
      // Mark answer as empty with zero score when time runs out
      return {
        ...state,
        interviewState: {
          ...state.interviewState,
          answers: [...state.interviewState.answers, ''],
          scores: [...state.interviewState.scores, 0]
        }
      };
    
    case 'NEXT_QUESTION':
      return {
        ...state,
        interviewState: {
          ...state.interviewState,
          currentQuestionIndex: state.interviewState.currentQuestionIndex + 1
        }
      };
    
    case 'COMPLETE_INTERVIEW':
      const newCandidate = {
        id: Date.now(),
        ...state.candidateInfo,
        finalScore: action.payload.finalScore,
        summary: action.payload.summary,
        answers: state.interviewState.answers,
        scores: state.interviewState.scores,
        questions: state.interviewState.questions,
        completedAt: new Date().toISOString(),
        startedAt: state.interviewState.startedAt
      };
      
      return {
        ...state,
        interviewState: {
          ...state.interviewState,
          isComplete: true,
          finalScore: action.payload.finalScore,
          summary: action.payload.summary,
          completedAt: new Date().toISOString()
        },
        candidates: [...state.candidates, newCandidate]
      };
    
    case 'RESET_INTERVIEW':
      return {
        ...initialState,
        candidates: state.candidates
      };
    
    case 'LOAD_SAVED_DATA':
      return {
        ...state,
        ...action.payload
      };
    
    case 'UPDATE_CANDIDATES':
      return {
        ...state,
        candidates: action.payload
      };
    
    default:
      return state;
  }
};

export const InterviewProvider = ({ children }) => {
  const [state, dispatch] = useReducer(interviewReducer, initialState);

  // Load data from localStorage on mount
  useEffect(() => {
    const savedData = localStorage.getItem('interviewData');
    if (savedData) {
      try {
        const parsedData = JSON.parse(savedData);
        dispatch({ type: 'LOAD_SAVED_DATA', payload: parsedData });
      } catch (error) {
        console.error('Failed to load saved data:', error);
      }
    }
  }, []);

  // Save data to localStorage whenever state changes
  useEffect(() => {
    localStorage.setItem('interviewData', JSON.stringify(state));
  }, [state]);

  const actions = {
    setResumeData: (candidateInfo) => {
      console.log('Setting resume data:', candidateInfo);
      const missingFields = [];
      if (!candidateInfo.name) missingFields.push('name');
      if (!candidateInfo.email) missingFields.push('email');
      if (!candidateInfo.phone) missingFields.push('phone');
      
      console.log('Missing fields:', missingFields);
      
      dispatch({ 
        type: 'SET_RESUME_DATA', 
        payload: { candidateInfo, missingFields } 
      });
    },
    
    setCandidateInfo: (candidateInfo) => {
      dispatch({ type: 'SET_CANDIDATE_INFO', payload: candidateInfo });
    },
    
    updateMissingField: (field, value) => {
      dispatch({ type: 'UPDATE_MISSING_FIELD', payload: { field, value } });
    },
    
    startInterview: (questions, candidateInfo) => {
      dispatch({ 
        type: 'START_INTERVIEW', 
        payload: { questions, candidateInfo } 
      });
    },
    
    pauseInterview: () => {
      dispatch({ type: 'PAUSE_INTERVIEW' });
    },
    
    resumeInterview: () => {
      dispatch({ type: 'RESUME_INTERVIEW' });
    },
    
    submitAnswer: (answer, score) => {
      dispatch({ 
        type: 'SUBMIT_ANSWER', 
        payload: { answer, score } 
      });
    },
    
    timeoutAnswer: () => {
      dispatch({ type: 'TIMEOUT_ANSWER' });
    },
    
    nextQuestion: () => {
      dispatch({ type: 'NEXT_QUESTION' });
    },
    
    completeInterview: (finalScore, summary) => {
      dispatch({ 
        type: 'COMPLETE_INTERVIEW', 
        payload: { finalScore, summary } 
      });
    },
    
    resetInterview: () => {
      // Clear localStorage completely
      localStorage.removeItem('interviewData');
      dispatch({ type: 'RESET_INTERVIEW' });
    },
    
    updateCandidates: (candidates) => {
      dispatch({ type: 'UPDATE_CANDIDATES', payload: candidates });
    }
  };

  return (
    <InterviewContext.Provider value={{ state, dispatch, actions }}>
      {children}
    </InterviewContext.Provider>
  );
};

export const useInterview = () => {
  const context = useContext(InterviewContext);
  if (!context) {
    throw new Error('useInterview must be used within an InterviewProvider');
  }
  return context;
};
