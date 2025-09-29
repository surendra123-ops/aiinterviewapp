import React, { useState, useEffect } from 'react';
import { useInterview } from '../context/InterviewContext';
import { Card, Button, Typography, Progress, Space, message } from 'antd';
import { CheckCircleOutlined, ReloadOutlined, HomeOutlined } from '@ant-design/icons';

const { Title, Text } = Typography;

const InterviewComplete = () => {
  const { state, actions } = useInterview();
  const [countdown, setCountdown] = useState(300); // 5 minutes in seconds
  
  const { candidateInfo, finalScore, summary } = state.interviewState;

  const getScoreColor = (score) => {
    if (score >= 80) return '#52c41a';
    if (score >= 60) return '#faad14';
    return '#ff4d4f';
  };

  const getScoreText = (score) => {
    if (score >= 80) return 'Excellent';
    if (score >= 60) return 'Good';
    return 'Needs Improvement';
  };

  const handleStartNew = () => {
    actions.resetInterview();
    message.success('Starting new interview...');
  };

  const handleReturnHome = () => {
    // Clear localStorage to reset all form data
    localStorage.removeItem('interviewData');
    // Reset the interview state
    actions.resetInterview();
    message.success('Returning to home page...');
  };

  // Auto-redirect countdown
  useEffect(() => {
    if (countdown > 0) {
      const timer = setTimeout(() => {
        setCountdown(countdown - 1);
      }, 1000);
      return () => clearTimeout(timer);
    } else {
      // Auto-redirect after 5 minutes
      message.info('Automatically returning to home page...');
      handleReturnHome();
    }
  }, [countdown]);

  // Format countdown timer
  const formatCountdown = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="max-w-4xl mx-auto">
      <Card className="text-center">
        <div className="mb-8">
          <CheckCircleOutlined style={{ fontSize: '64px', color: '#52c41a' }} />
          <Title level={2} className="mt-4">Interview Completed!</Title>
          <Text type="secondary" className="text-lg">
            Thank you for completing the interview, {candidateInfo?.name}
          </Text>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-8">
          <Card>
            <Title level={4}>Your Score</Title>
            <div className="text-center">
              <Progress
                type="circle"
                percent={finalScore}
                strokeColor={getScoreColor(finalScore)}
                format={() => `${finalScore}/100`}
                size={120}
              />
              <div className="mt-4">
                <Text strong style={{ color: getScoreColor(finalScore) }}>
                  {getScoreText(finalScore)}
                </Text>
              </div>
            </div>
          </Card>

          <Card>
            <Title level={4}>AI Summary</Title>
            <div className="text-left">
              <Text>{summary}</Text>
            </div>
          </Card>
        </div>

        <div className="space-y-4 mb-6">
          <Text type="secondary">
            Your interview results have been saved and are now available in the Interviewer Dashboard.
          </Text>
          
          <div className="bg-blue-50 p-4 rounded-lg">
            <Text type="secondary" className="block mb-2">
              Auto-redirect in: <Text strong style={{ fontFamily: 'monospace' }}>
                {formatCountdown(countdown)}
              </Text>
            </Text>
            <Text type="secondary" className="text-sm">
              You will be automatically redirected to the home page after 5 minutes.
            </Text>
          </div>
        </div>
        
        <Space size="large">
          <Button type="primary" icon={<HomeOutlined />} onClick={handleReturnHome}>
            Return Home Now
          </Button>
          <Button icon={<ReloadOutlined />} onClick={handleStartNew}>
            Start New Interview
          </Button>
        </Space>
      </Card>
    </div>
  );
};

export default InterviewComplete;
