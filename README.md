# AI Interview Assistant

A React-based AI-powered interview assistant that provides two main functionalities:
- **Interviewee Tab**: Complete timed interviews with AI-generated questions
- **Interviewer Tab**: Dashboard to view and analyze candidate performance

## Features

### Core Functionality
- ✅ Resume upload (PDF/DOCX) with automatic information extraction
- ✅ Missing field collection via chatbot interface
- ✅ Timed interview with 6 questions (2 Easy, 2 Medium, 2 Hard)
- ✅ AI-powered scoring and summary generation
- ✅ Local storage persistence
- ✅ Two-tab interface (Interviewee & Interviewer)
- ✅ Candidate dashboard with search and sorting

### Interview Flow
- **Easy Questions**: 20 seconds each
- **Medium Questions**: 60 seconds each  
- **Hard Questions**: 120 seconds each
- Automatic timeout handling
- Real-time scoring and feedback

### Interviewer Dashboard
- Candidate list sorted by score (highest first)
- Search functionality
- Detailed candidate profiles
- Question-by-question analysis
- Performance statistics

## Setup Instructions

### Prerequisites
- Node.js (v16 or higher)
- npm or yarn

### Backend Setup
```bash
cd backend
npm install
npm start
```

The backend will run on `http://localhost:3001`

### Frontend Setup
```bash
cd frontend
npm install
npm run dev
```

The frontend will run on `http://localhost:5173`

## Usage

1. **Start Interview**:
   - Upload a resume (PDF or DOCX)
   - Complete any missing information via chatbot
   - Begin the timed interview

2. **Complete Interview**:
   - Answer 6 questions within time limits
   - Receive AI-generated score and summary
   - Results saved automatically

3. **View Results**:
   - Switch to Interviewer tab
   - View all candidates sorted by performance
   - Click "View Details" for comprehensive analysis

## Technical Stack

### Frontend
- React 18
- Ant Design (UI components)
- Context API (state management)
- Local Storage (persistence)
- Tailwind CSS (styling)

### Backend
- Express.js
- Multer (file uploads)
- pdf-parse (PDF parsing)
- mammoth (DOCX parsing)
- CORS enabled

## File Structure
