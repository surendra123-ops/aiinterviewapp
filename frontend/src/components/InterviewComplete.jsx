import React, { useState, useEffect } from 'react';
import { useInterview } from '../context/InterviewContext';
import { Card, Button, Typography, Progress, Space, message, Collapse, Tag, List, Divider } from 'antd';
import { CheckCircleOutlined, ReloadOutlined, HomeOutlined, RobotOutlined, UserOutlined, BulbOutlined } from '@ant-design/icons';

const { Title, Text } = Typography;
const { Panel } = Collapse;

const InterviewComplete = () => {
  const { state, actions } = useInterview();
  const [countdown, setCountdown] = useState(300); // 5 minutes in seconds
  
  const { candidateInfo, finalScore, summary, answerFeedbacks } = state.interviewState;
  const { questions, answers, scores } = state.interviewState;

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
    <div className="max-w-6xl mx-auto">
      <Card className="text-center mb-6">
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

      {/* AI Feedback & Sample Answers Section */}
      <Card title="AI Feedback & Sample Answers" className="mb-6">
        <Collapse defaultActiveKey={['0']}>
          {questions.map((question, index) => {
            const answer = answers[index] || 'No answer provided';
            const score = scores[index] || 0;
            const feedback = answerFeedbacks[index] || { 
              feedback: 'No feedback available', 
              suggestions: [],
              sampleAnswer: 'No sample answer available'
            };
            
            return (
              <Panel 
                header={
                  <div className="flex justify-between items-center">
                    <span>
                      <Text strong>Q{index + 1}: {question.question}</Text>
                      <Tag color="blue" className="ml-2">{question.difficulty}</Tag>
                      <Tag color="green" className="ml-1">{question.category}</Tag>
                    </span>
                    <Tag color={score >= 80 ? 'green' : score >= 60 ? 'orange' : 'red'}>
                      {score}/100
                    </Tag>
                  </div>
                } 
                key={index}
              >
                <div className="space-y-6">
                  {/* User Answer */}
                  <div>
                    <Title level={5}>
                      <UserOutlined className="mr-2" />
                      Your Answer:
                    </Title>
                    <div className="bg-gray-50 p-4 rounded-lg border-l-4 border-gray-400">
                      <Text>{answer}</Text>
                    </div>
                  </div>

                  {/* AI Feedback */}
                  <div>
                    <Title level={5}>
                      <RobotOutlined className="mr-2" />
                      AI Feedback:
                    </Title>
                    <div className="bg-blue-50 p-4 rounded-lg border-l-4 border-blue-400">
                      <Text>{feedback.feedback}</Text>
                    </div>
                  </div>

                  {/* Sample Answer */}
                  <div>
                    <Title level={5}>
                      <BulbOutlined className="mr-2" />
                      Sample Answer:
                    </Title>
                    <div className="bg-green-50 p-4 rounded-lg border-l-4 border-green-400">
                      <Text>{feedback.sampleAnswer}</Text>
                    </div>
                  </div>

                  {/* Suggestions */}
                  {feedback.suggestions && feedback.suggestions.length > 0 && (
                    <div>
                      <Title level={5}>Suggestions for Improvement:</Title>
                      <List
                        size="small"
                        dataSource={feedback.suggestions}
                        renderItem={(item) => (
                          <List.Item>
                            <Text>• {item}</Text>
                          </List.Item>
                        )}
                      />
                    </div>
                  )}
                </div>
              </Panel>
            );
          })}
        </Collapse>
      </Card>
    </div>
  );
};

export default InterviewComplete;
