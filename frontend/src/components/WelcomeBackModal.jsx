import React from 'react';
import { useInterview } from '../context/InterviewContext';
import { Modal, Button, Typography, Space, Progress } from 'antd';
import { ReloadOutlined, PlayCircleOutlined } from '@ant-design/icons';

const { Title, Text } = Typography;

const WelcomeBackModal = () => {
  const { state, dispatch, actions } = useInterview();
  
  // Temporarily disable the modal - always return null
  return null;
  
  // Check if there's an incomplete interview
  const hasIncompleteInterview = state.interviewState.isStarted && 
                                 !state.interviewState.isComplete &&
                                 state.candidateInfo;

  const progress = hasIncompleteInterview 
    ? ((state.interviewState.currentQuestionIndex + 1) / state.interviewState.questions.length) * 100
    : 0;

  const handleContinue = () => {
    actions.resumeInterview();
  };

  const handleStartNew = () => {
    // Clear localStorage and reset everything
    localStorage.removeItem('interviewData');
    actions.resetInterview();
  };

  if (!hasIncompleteInterview) {
    return null;
  }

  return (
    <Modal
      title="Welcome Back!"
      open={hasIncompleteInterview}
      closable={false}
      footer={null}
      centered
    >
      <div className="text-center space-y-4">
        <Title level={4}>You have an incomplete interview</Title>
        <Text type="secondary">
          Hi {state.candidateInfo?.name}! You were in the middle of an interview.
        </Text>
        
        <div className="my-4">
          <Progress 
            percent={progress} 
            format={() => `${state.interviewState.currentQuestionIndex + 1}/${state.interviewState.questions.length}`}
          />
          <Text type="secondary">
            Question {state.interviewState.currentQuestionIndex + 1} of {state.interviewState.questions.length}
          </Text>
        </div>
        
        <Text type="secondary">
          Would you like to continue where you left off or start a new interview?
        </Text>
        
        <div className="mt-6">
          <Space>
            <Button 
              type="primary" 
              onClick={handleContinue}
              icon={<PlayCircleOutlined />}
            >
              Continue Interview
            </Button>
            <Button 
              onClick={handleStartNew} 
              icon={<ReloadOutlined />}
            >
              Start New
            </Button>
          </Space>
        </div>
      </div>
    </Modal>
  );
};

export default WelcomeBackModal;
