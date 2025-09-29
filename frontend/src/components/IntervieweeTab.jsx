import React, { useState, useEffect, useRef } from 'react';
import { useInterview } from '../context/InterviewContext';
import { Card, Upload, Button, Input, Form, message, Progress, Typography, Space, Spin } from 'antd';
import { UploadOutlined, SendOutlined, ClockCircleOutlined } from '@ant-design/icons';
import { useTimer } from '../hooks/useTimer';
import QuestionCard from './QuestionCard';
import InterviewComplete from './InterviewComplete';
import ChatbotCollector from './ChatbotCollector';

const { Title, Text } = Typography;

const IntervieweeTab = () => {
  const { state, dispatch, actions } = useInterview();
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const [currentAnswer, setCurrentAnswer] = useState('');
  const timeoutHandledRef = useRef(false);

  const { timeLeft, isRunning, hasExpired, startTimer, stopTimer, resetTimer } = useTimer();

  // Handle resume upload
  const handleResumeUpload = async (file) => {
    setLoading(true);
    try {
      const formData = new FormData();
      formData.append('resume', file);

      const response = await fetch('http://localhost:3001/api/upload-resume', {
        method: 'POST',
        body: formData,
      });

      const data = await response.json();
      
      console.log('Resume upload response:', data);
      
      if (data.success) {
        actions.setResumeData(data.candidateInfo);
        message.success(data.message);
        
        // Pre-fill form with extracted data
        form.setFieldsValue(data.candidateInfo);
      } else {
        message.error('Failed to upload resume');
      }
    } catch (error) {
      console.error('Upload error:', error);
      message.error('Failed to upload resume');
    } finally {
      setLoading(false);
    }
    return false;
  };

  // Handle missing field updates from chatbot
  const handleFieldUpdate = (field, value) => {
    actions.updateMissingField(field, value);
    form.setFieldValue(field, value);
  };

  // Handle chatbot completion
  const handleChatbotComplete = () => {
    const completeInfo = {
      ...state.resumeData,
      // Ensure all fields are present
      name: state.resumeData.name,
      email: state.resumeData.email,
      phone: state.resumeData.phone
    };
    
    form.setFieldsValue(completeInfo);
    message.success('Information collected! You can now start the interview.');
  };

  // Start interview
  const handleStartInterview = async () => {
    try {
      const values = await form.validateFields();
      
      setLoading(true);
      const response = await fetch('http://localhost:3001/api/start-interview', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ candidateInfo: values }),
      });

      const data = await response.json();
      
      if (data.success) {
        actions.startInterview(data.questions, values);
        message.success('Interview started!');
      } else {
        message.error('Failed to start interview');
      }
    } catch (error) {
      console.error('Start interview error:', error);
      message.error('Failed to start interview');
    } finally {
      setLoading(false);
    }
  };

  // Submit answer
  const handleSubmitAnswer = async () => {
    if (!currentAnswer.trim()) {
      message.warning('Please provide an answer');
      return;
    }

    const currentQuestion = state.interviewState.questions[state.interviewState.currentQuestionIndex];
    
    try {
      setLoading(true);
      const response = await fetch('http://localhost:3001/api/submit-answer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          question: currentQuestion,
          answer: currentAnswer,
          candidateInfo: state.candidateInfo
        }),
      });

      const data = await response.json();
      
      if (data.success) {
        actions.submitAnswer(currentAnswer, data.score);
        setCurrentAnswer('');
        
        if (state.interviewState.currentQuestionIndex < state.interviewState.questions.length - 1) {
          actions.nextQuestion();
        } else {
          // Complete interview
          const completeResponse = await fetch('http://localhost:3001/api/complete-interview', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              candidateInfo: state.candidateInfo,
              answers: [...state.interviewState.answers, currentAnswer],
              scores: [...state.interviewState.scores, data.score],
              questions: state.interviewState.questions
            }),
          });
          
          const completeData = await completeResponse.json();
          if (completeData.success) {
            actions.completeInterview(completeData.finalScore, completeData.summary);
          }
        }
      }
    } catch (error) {
      console.error('Submit answer error:', error);
      message.error('Failed to submit answer');
    } finally {
      setLoading(false);
    }
  };

  // Handle timer completion - mark zero and move to next question
  useEffect(() => {
    if (hasExpired && state.interviewState.isStarted && !state.interviewState.isComplete && !timeoutHandledRef.current) {
      console.log('Timer expired, handling timeout...');
      timeoutHandledRef.current = true; // Prevent multiple executions
      
      // Mark answer as empty with zero score when time runs out
      actions.timeoutAnswer();
      setCurrentAnswer('');
      
      if (state.interviewState.currentQuestionIndex < state.interviewState.questions.length - 1) {
        actions.nextQuestion();
        message.warning('Time\'s up! Moving to next question.');
      } else {
        // Complete interview with timeout
        setTimeout(async () => {
          try {
            const completeResponse = await fetch('http://localhost:3001/api/complete-interview', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                candidateInfo: state.candidateInfo,
                answers: state.interviewState.answers,
                scores: state.interviewState.scores,
                questions: state.interviewState.questions
              }),
            });
            
            const completeData = await completeResponse.json();
            if (completeData.success) {
              actions.completeInterview(completeData.finalScore, completeData.summary);
            }
          } catch (error) {
            console.error('Complete interview error:', error);
          }
        }, 100); // Small delay to ensure state is updated
        
        message.warning('Time\'s up! Interview completed.');
      }
    }
  }, [hasExpired, state.interviewState.isStarted, state.interviewState.isComplete, state.interviewState.currentQuestionIndex]);

  // Start timer when question changes
  useEffect(() => {
    if (state.interviewState.isStarted && !state.interviewState.isComplete) {
      const currentQuestion = state.interviewState.questions[state.interviewState.currentQuestionIndex];
      if (currentQuestion) {
        console.log(`Starting timer for question ${state.interviewState.currentQuestionIndex + 1}, time limit: ${currentQuestion.timeLimit}s`);
        resetTimer(currentQuestion.timeLimit);
        startTimer(currentQuestion.timeLimit);
        timeoutHandledRef.current = false; // Reset the flag for the new question
      }
    }
  }, [state.interviewState.currentQuestionIndex, state.interviewState.isStarted, state.interviewState.isComplete]);

  // Format timer display
  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  if (state.interviewState.isComplete) {
    return <InterviewComplete />;
  }

  if (state.interviewState.isStarted) {
    const currentQuestion = state.interviewState.questions[state.interviewState.currentQuestionIndex];
    const progress = ((state.interviewState.currentQuestionIndex + 1) / state.interviewState.questions.length) * 100;

    return (
      <div className="max-w-4xl mx-auto p-6">
        <Card>
          <div className="mb-4">
            <Title level={3}>Interview in Progress</Title>
            <Progress percent={progress} />
            <div className="flex justify-between items-center mt-2">
              <Text>Question {state.interviewState.currentQuestionIndex + 1} of {state.interviewState.questions.length}</Text>
              <div className="flex items-center space-x-2">
                <ClockCircleOutlined />
                <Text strong style={{ fontFamily: 'monospace', color: timeLeft <= 10 ? '#ff4d4f' : '#000' }}>
                  {formatTime(timeLeft)}
                </Text>
              </div>
            </div>
          </div>

          {currentQuestion && (
            <QuestionCard
              question={currentQuestion}
              timeLeft={timeLeft}
              answer={currentAnswer}
              onAnswerChange={setCurrentAnswer}
              onSubmit={handleSubmitAnswer}
              loading={loading}
            />
          )}
        </Card>
      </div>
    );
  }

  // Show chatbot if there are missing fields
  if (state.chatbotActive && state.missingFields.length > 0) {
    return (
      <div className="max-w-2xl mx-auto p-6">
        <ChatbotCollector
          missingFields={state.missingFields}
          resumeData={state.resumeData}
          onFieldUpdate={handleFieldUpdate}
          onComplete={handleChatbotComplete}
        />
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto p-6">
      <Card>
        <Title level={2}>Start Your Interview</Title>
        <Text type="secondary" className="block mb-6">
          Upload your resume and we'll extract your information to get started with the interview process.
        </Text>
        
        <Form form={form} layout="vertical" onFinish={handleStartInterview}>
          <Form.Item label="Upload Resume (PDF or DOCX)">
            <Upload
              beforeUpload={handleResumeUpload}
              accept=".pdf,.docx"
              showUploadList={false}
            >
              <Button icon={<UploadOutlined />} loading={loading} className="w-full">
                Upload Resume
              </Button>
            </Upload>
            <Text type="secondary" className="block mt-2">
              Supported formats: PDF, DOCX. We'll extract your name, email, and phone number.
            </Text>
          </Form.Item>

          <Form.Item
            name="name"
            label="Full Name"
            rules={[{ required: true, message: 'Please enter your name' }]}
          >
            <Input placeholder="Enter your full name" />
          </Form.Item>

          <Form.Item
            name="email"
            label="Email"
            rules={[
              { required: true, message: 'Please enter your email' },
              { type: 'email', message: 'Please enter a valid email' }
            ]}
          >
            <Input placeholder="Enter your email" />
          </Form.Item>

          <Form.Item
            name="phone"
            label="Phone Number"
            rules={[{ required: true, message: 'Please enter your phone number' }]}
          >
            <Input placeholder="Enter your phone number" />
          </Form.Item>

          <Form.Item>
            <Button 
              type="primary" 
              htmlType="submit" 
              loading={loading}
              className="w-full"
              size="large"
            >
              Start Interview
            </Button>
          </Form.Item>
        </Form>
      </Card>
    </div>
  );
};

export default IntervieweeTab;
