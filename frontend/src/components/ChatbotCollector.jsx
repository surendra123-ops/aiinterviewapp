import React, { useState, useEffect } from 'react';
import { Card, Input, Button, Typography, Space, Avatar, message, Alert } from 'antd';
import { RobotOutlined, UserOutlined, SendOutlined, CheckCircleOutlined } from '@ant-design/icons';

const { Text } = Typography;

const ChatbotCollector = ({ missingFields, resumeData, onFieldUpdate, onComplete }) => {
  const [currentFieldIndex, setCurrentFieldIndex] = useState(0);
  const [inputValue, setInputValue] = useState('');
  const [chatHistory, setChatHistory] = useState([]);
  const [isCompleted, setIsCompleted] = useState(false);

  const fieldPrompts = {
    name: "Hi! I noticed your name wasn't found in the resume. Could you please tell me your full name?",
    email: "Great! Now I need your email address to proceed with the interview.",
    phone: "Perfect! Finally, could you provide your phone number?"
  };

  const fieldValidation = {
    name: (value) => {
      const trimmed = value.trim();
      return trimmed.length >= 2 && /^[a-zA-Z\s\.]+$/.test(trimmed);
    },
    email: (value) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim()),
    phone: (value) => /^[\+]?[\d\s\-\(\)]{10,}$/.test(value.trim())
  };

  const fieldExamples = {
    name: "e.g., John Smith",
    email: "e.g., john.smith@email.com",
    phone: "e.g., +1-555-123-4567"
  };

  const fieldLabels = {
    name: "full name",
    email: "email address", 
    phone: "phone number"
  };

  // Get current field with safety check
  const currentField = missingFields && missingFields.length > 0 ? missingFields[currentFieldIndex] : null;

  // Reset currentFieldIndex if it's out of bounds
  useEffect(() => {
    if (missingFields && missingFields.length > 0 && currentFieldIndex >= missingFields.length) {
      setCurrentFieldIndex(0);
    }
  }, [missingFields, currentFieldIndex]);

  // Initialize chat history when component mounts or when currentField changes
  useEffect(() => {
    if (missingFields && missingFields.length > 0 && currentField) {
      setChatHistory([
        {
          type: 'bot',
          message: fieldPrompts[currentField],
          timestamp: new Date()
        }
      ]);
    }
  }, [currentField]);

  const handleSubmit = () => {
    if (!inputValue.trim()) {
      message.warning('Please provide a valid response');
      return;
    }

    if (!currentField) {
      message.error('No field to update');
      return;
    }

    const isValid = fieldValidation[currentField](inputValue.trim());
    
    if (!isValid) {
      let errorMessage = 'Please provide a valid ';
      if (currentField === 'email') errorMessage += 'email address (e.g., john@example.com)';
      else if (currentField === 'phone') errorMessage += 'phone number (e.g., +1-555-123-4567)';
      else errorMessage += 'name (e.g., John Smith)';
      
      message.error(errorMessage);
      return;
    }

    // Add user message to chat
    const newChatHistory = [
      ...chatHistory,
      {
        type: 'user',
        message: inputValue.trim(),
        timestamp: new Date()
      }
    ];

    // Update the field
    onFieldUpdate(currentField, inputValue.trim());

    // Move to next field or complete
    const nextIndex = currentFieldIndex + 1;
    if (nextIndex < missingFields.length) {
      // There are more fields to collect
      const nextField = missingFields[nextIndex];
      const botResponse = {
        type: 'bot',
        message: fieldPrompts[nextField],
        timestamp: new Date()
      };
      
      setChatHistory([...newChatHistory, botResponse]);
      setCurrentFieldIndex(nextIndex);
      setInputValue('');
    } else {
      // All fields collected
      const completionMessage = {
        type: 'bot',
        message: "Perfect! I have all the information I need. Let's start your interview now!",
        timestamp: new Date()
      };
      
      setChatHistory([...newChatHistory, completionMessage]);
      setIsCompleted(true);
      setInputValue('');
      
      setTimeout(() => {
        onComplete();
      }, 1500);
    }
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter') {
      handleSubmit();
    }
  };

  // Safety checks
  if (!missingFields || missingFields.length === 0) {
    return null;
  }

  if (!currentField) {
    console.log('Debug info:', { missingFields, currentFieldIndex, currentField });
    return (
      <div className="max-w-2xl mx-auto">
        <Card title="Interview Assistant">
          <Alert
            message="Error"
            description="Unable to determine missing field. Please refresh the page."
            type="error"
            showIcon
          />
        </Card>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto">
      <Card title="Interview Assistant" className="mb-4">
        <Alert
          message="Missing Information"
          description={`We need to collect ${missingFields.length} more piece${missingFields.length > 1 ? 's' : ''} of information before starting your interview.`}
          type="info"
          showIcon
          className="mb-4"
        />
        
        <div className="space-y-4 max-h-96 overflow-y-auto mb-4">
          {chatHistory.map((chat, index) => (
            <div
              key={index}
              className={`flex ${chat.type === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              <div
                className={`flex items-start space-x-2 max-w-xs ${
                  chat.type === 'user' ? 'flex-row-reverse space-x-reverse' : ''
                }`}
              >
                <Avatar
                  icon={chat.type === 'bot' ? <RobotOutlined /> : <UserOutlined />}
                  className={chat.type === 'bot' ? 'bg-blue-500' : 'bg-green-500'}
                />
                <div
                  className={`px-3 py-2 rounded-lg ${
                    chat.type === 'bot'
                      ? 'bg-gray-100 text-gray-800'
                      : 'bg-blue-500 text-white'
                  }`}
                >
                  <Text className={chat.type === 'user' ? 'text-white' : ''}>
                    {chat.message}
                  </Text>
                </div>
              </div>
            </div>
          ))}
        </div>

        {!isCompleted && (
          <div className="space-y-2">
            <Space.Compact style={{ width: '100%' }}>
              <Input
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                onKeyPress={handleKeyPress}
                placeholder={`Enter your ${fieldLabels[currentField] || currentField}...`}
                disabled={isCompleted}
              />
              <Button
                type="primary"
                icon={<SendOutlined />}
                onClick={handleSubmit}
                disabled={isCompleted}
              >
                Send
              </Button>
            </Space.Compact>
            <Text type="secondary" className="text-sm">
              {fieldExamples[currentField] || `Please enter your ${fieldLabels[currentField] || currentField}`}
            </Text>
          </div>
        )}

        {isCompleted && (
          <div className="text-center py-4">
            <CheckCircleOutlined style={{ fontSize: '24px', color: '#52c41a' }} />
            <div className="mt-2">
              <Text type="success">All information collected successfully!</Text>
            </div>
          </div>
        )}
      </Card>
    </div>
  );
};

export default ChatbotCollector;
