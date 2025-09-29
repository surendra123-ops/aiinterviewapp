import React, { useState } from 'react';
import { Card, Button, Input, Typography, Space, Tag } from 'antd';
import { SendOutlined } from '@ant-design/icons';

const { Title, Text } = Typography;
const { TextArea } = Input;

const QuestionCard = ({ question, timeLeft, answer, onAnswerChange, onSubmit, loading }) => {
  const getDifficultyColor = (difficulty) => {
    switch (difficulty) {
      case 'easy': return 'green';
      case 'medium': return 'orange';
      case 'hard': return 'red';
      default: return 'blue';
    }
  };

  // Format timer display (minutes:seconds)
  const formatTime = (seconds) => {
    if (isNaN(seconds) || seconds === undefined) return '0:00';
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  if (!question) return null;

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-start">
        <div className="flex-1">
          <div className="flex items-center space-x-2 mb-2">
            <Tag color={getDifficultyColor(question.difficulty)}>
              {question.difficulty.toUpperCase()}
            </Tag>
          </div>
          <Title level={4}>{question.question}</Title>
        </div>
      </div>

      <div className="space-y-4">
        <TextArea
          value={answer || ''}
          onChange={(e) => onAnswerChange(e.target.value)}
          placeholder="Type your answer here..."
          rows={6}
          disabled={timeLeft === 0}
        />
        
        <div className="flex justify-between items-center">
          <Text type="secondary">
            Time remaining: <Text strong style={{ fontFamily: 'monospace' }}>{formatTime(timeLeft)}</Text>
          </Text>
          <Button
            type="primary"
            icon={<SendOutlined />}
            onClick={onSubmit}
            loading={loading}
            disabled={!answer?.trim() || timeLeft === 0}
          >
            Submit Answer
          </Button>
        </div>
      </div>
    </div>
  );
};

export default QuestionCard;
