import React, { useState, useEffect } from 'react';
import { useInterview } from '../context/InterviewContext';
import { 
  Card, 
  Table, 
  Button, 
  Input, 
  Typography, 
  Tag, 
  Modal, 
  Descriptions, 
  Progress, 
  Empty,
  message,
  Space,
  Select,
  Spin,
  Divider,
  List,
  Collapse
} from 'antd';
import { 
  SearchOutlined, 
  EyeOutlined, 
  UserOutlined,
  SortAscendingOutlined,
  SortDescendingOutlined,
  ReloadOutlined,
  RobotOutlined,
  BulbOutlined,
  ThunderboltOutlined
} from '@ant-design/icons';

const { Title, Text } = Typography;
const { Search } = Input;
const { Option } = Select;
const { Panel } = Collapse;

const InterviewerTab = () => {
  const { state, dispatch, actions } = useInterview();
  const [searchText, setSearchText] = useState('');
  const [selectedCandidate, setSelectedCandidate] = useState(null);
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [sortOrder, setSortOrder] = useState('desc'); // 'asc' or 'desc'
  const [loading, setLoading] = useState(false);
  const [candidates, setCandidates] = useState([]);
  const [llmAnswers, setLlmAnswers] = useState({});
  const [loadingLlmAnswer, setLoadingLlmAnswer] = useState({});

  // Fetch candidates from backend
  const fetchCandidates = async () => {
    setLoading(true);
    try {
      const response = await fetch('http://localhost:3001/api/candidates');
      const data = await response.json();
      
      if (data.success) {
        setCandidates(data.candidates);
        // Also update local state for compatibility
        if (data.candidates.length > 0) {
          dispatch({ 
            type: 'LOAD_SAVED_DATA', 
            payload: { 
              ...state, 
              candidates: data.candidates 
            } 
          });
        }
      } else {
        message.error('Failed to fetch candidates');
      }
    } catch (error) {
      console.error('Fetch candidates error:', error);
      message.error('Failed to fetch candidates');
    } finally {
      setLoading(false);
    }
  };

  // Load candidates on component mount
  useEffect(() => {
    fetchCandidates();
  }, []);

  const columns = [
    {
      title: 'Name',
      dataIndex: 'name',
      key: 'name',
      sorter: (a, b) => a.name.localeCompare(b.name),
    },
    {
      title: 'Email',
      dataIndex: 'email',
      key: 'email',
    },
    {
      title: 'Phone',
      dataIndex: 'phone',
      key: 'phone',
    },
    {
      title: 'Score',
      dataIndex: 'finalScore',
      key: 'finalScore',
      render: (score) => (
        <Tag color={score >= 80 ? 'green' : score >= 60 ? 'orange' : 'red'}>
          {score}/100
        </Tag>
      ),
      sorter: (a, b) => a.finalScore - b.finalScore,
      defaultSortOrder: 'descend',
    },
    {
      title: 'Completed',
      dataIndex: 'completedAt',
      key: 'completedAt',
      render: (date) => new Date(date).toLocaleDateString(),
      sorter: (a, b) => new Date(a.completedAt) - new Date(b.completedAt),
    },
    {
      title: 'Actions',
      key: 'actions',
      render: (_, record) => (
        <Button 
          type="link" 
          icon={<EyeOutlined />} 
          onClick={() => handleViewCandidate(record)}
        >
          View Details
        </Button>
      ),
    },
  ];

  const handleViewCandidate = (candidate) => {
    setSelectedCandidate(candidate);
    setIsModalVisible(true);
  };

  const filteredCandidates = candidates.filter(candidate =>
    candidate.name.toLowerCase().includes(searchText.toLowerCase()) ||
    candidate.email.toLowerCase().includes(searchText.toLowerCase())
  );

  // Sort candidates by score (highest first by default)
  const sortedCandidates = [...filteredCandidates].sort((a, b) => {
    if (sortOrder === 'desc') {
      return b.finalScore - a.finalScore;
    } else {
      return a.finalScore - b.finalScore;
    }
  });

  // Group candidates by email to show previous results
  const groupedCandidates = sortedCandidates.reduce((acc, candidate) => {
    if (!acc[candidate.email]) {
      acc[candidate.email] = [];
    }
    acc[candidate.email].push(candidate);
    return acc;
  }, {});

  const generateLlmAnswer = async (question, questionIndex) => {
    setLoadingLlmAnswer(prev => ({ ...prev, [questionIndex]: true }));
    
    try {
      const response = await fetch('http://localhost:3001/api/generate-llm-answer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question }),
      });

      const data = await response.json();
      
      if (data.success) {
        setLlmAnswers(prev => ({ ...prev, [questionIndex]: data.llmAnswer }));
        message.success('Correct answer generated!');
      } else {
        message.error('Failed to generate correct answer');
      }
    } catch (error) {
      console.error('Generate correct answer error:', error);
      message.error('Failed to generate correct answer');
    } finally {
      setLoadingLlmAnswer(prev => ({ ...prev, [questionIndex]: false }));
    }
  };

  return (
    <div className="py-8">
      <div className="mb-6">
        <div className="flex justify-between items-center mb-4">
          <Title level={2}>Interview Dashboard</Title>
          <Button 
            icon={<ReloadOutlined />} 
            onClick={fetchCandidates}
            loading={loading}
          >
            Refresh
          </Button>
        </div>
        
        <div className="flex justify-between items-center mb-4">
          <Search
            placeholder="Search candidates..."
            allowClear
            style={{ width: 300 }}
            onChange={(e) => setSearchText(e.target.value)}
            prefix={<SearchOutlined />}
          />
          <div className="flex items-center space-x-4">
            <Text strong>Total Candidates: {candidates.length}</Text>
            <Select
              value={sortOrder}
              onChange={setSortOrder}
              style={{ width: 120 }}
              suffixIcon={sortOrder === 'desc' ? <SortDescendingOutlined /> : <SortAscendingOutlined />}
            >
              <Option value="desc">Highest First</Option>
              <Option value="asc">Lowest First</Option>
            </Select>
          </div>
        </div>
      </div>

      <Card>
        {loading ? (
          <div className="text-center py-8">
            <Spin size="large" />
            <div className="mt-4">Loading candidates...</div>
          </div>
        ) : candidates.length === 0 ? (
          <Empty
            image={<UserOutlined style={{ fontSize: '64px', color: '#d9d9d9' }} />}
            description={
              <div className="text-center">
                <Title level={4}>No Candidates Yet</Title>
                <Text type="secondary">
                  Candidates will appear here after they complete their interviews.
                  <br />
                  Switch to the "Interviewee" tab to start an interview.
                </Text>
              </div>
            }
          />
        ) : (
          <div className="space-y-6">
            {Object.entries(groupedCandidates).map(([email, userCandidates]) => (
              <div key={email}>
                <div className="mb-4">
                  <Title level={4}>
                    {userCandidates[0].name} ({email})
                  </Title>
                  <Text type="secondary">
                    {userCandidates.length} interview{userCandidates.length > 1 ? 's' : ''} completed
                  </Text>
                </div>
                
                <Table
                  columns={columns}
                  dataSource={userCandidates}
                  rowKey="_id"
                  pagination={false}
                  size="small"
                  className="mb-6"
                />
                
                <Divider />
              </div>
            ))}
          </div>
        )}
      </Card>

      <Modal
        title="Candidate Details"
        open={isModalVisible}
        onCancel={() => setIsModalVisible(false)}
        footer={[
          <Button key="close" onClick={() => setIsModalVisible(false)}>
            Close
          </Button>
        ]}
        width={1200}
        style={{ top: 20 }}
      >
        {selectedCandidate && (
          <div>
            <Descriptions bordered column={2}>
              <Descriptions.Item label="Name" span={2}>
                {selectedCandidate.name}
              </Descriptions.Item>
              <Descriptions.Item label="Email">
                {selectedCandidate.email}
              </Descriptions.Item>
              <Descriptions.Item label="Phone">
                {selectedCandidate.phone}
              </Descriptions.Item>
              <Descriptions.Item label="Final Score" span={2}>
                <Progress 
                  percent={selectedCandidate.finalScore} 
                  status={selectedCandidate.finalScore >= 80 ? 'success' : 
                          selectedCandidate.finalScore >= 60 ? 'normal' : 'exception'}
                />
              </Descriptions.Item>
              <Descriptions.Item label="Completed At" span={2}>
                {new Date(selectedCandidate.completedAt).toLocaleString()}
              </Descriptions.Item>
            </Descriptions>

            <div className="mt-6">
              <Title level={4}>Interview Summary</Title>
              <Text>{selectedCandidate.summary}</Text>
            </div>

            <div className="mt-6">
              <Title level={4}>Question & Answer Analysis</Title>
              <Collapse defaultActiveKey={['0']}>
                {selectedCandidate.questions && selectedCandidate.questions.map((question, index) => {
                  const answer = selectedCandidate.answers[index] || 'No answer provided';
                  const score = selectedCandidate.scores[index] || 0;
                  const feedback = selectedCandidate.answerFeedbacks && selectedCandidate.answerFeedbacks[index] 
                    ? selectedCandidate.answerFeedbacks[index] 
                    : { 
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
                      <div className="space-y-4">
                        {/* Candidate's Answer */}
                        <div>
                          <Title level={5}>
                            <UserOutlined className="mr-2" />
                            Candidate's Answer:
                          </Title>
                          <div className="bg-gray-50 p-3 rounded-lg border-l-4 border-gray-400">
                            <Text>{answer}</Text>
                          </div>
                        </div>

                        {/* AI Feedback */}
                        <div>
                          <Title level={5}>
                            <RobotOutlined className="mr-2" />
                            AI Feedback:
                          </Title>
                          <div className="bg-blue-50 p-3 rounded-lg border-l-4 border-blue-400">
                            <Text>{feedback.feedback}</Text>
                          </div>
                        </div>

                        {/* Correct Answer */}
                        <div>
                          <div className="flex justify-between items-center mb-2">
                            <Title level={5}>
                              <ThunderboltOutlined className="mr-2" />
                              Correct Answer:
                            </Title>
                            <Button
                              type="primary"
                              size="small"
                              icon={<RobotOutlined />}
                              loading={loadingLlmAnswer[index]}
                              onClick={() => generateLlmAnswer(question, index)}
                            >
                              Generate Correct Answer
                            </Button>
                          </div>
                          {llmAnswers[index] ? (
                            <div className="bg-purple-50 p-3 rounded-lg border-l-4 border-purple-400">
                              <Text>{llmAnswers[index]}</Text>
                            </div>
                          ) : (
                            <div className="bg-gray-50 p-3 rounded-lg border-l-4 border-gray-300 text-center">
                              <Text type="secondary">Click "Generate Correct Answer" to see the expected response</Text>
                            </div>
                          )}
                        </div>

                        {/* Sample Answer */}
                        <div>
                          <Title level={5}>
                            <BulbOutlined className="mr-2" />
                            Sample Answer:
                          </Title>
                          <div className="bg-green-50 p-3 rounded-lg border-l-4 border-green-400">
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
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
};

export default InterviewerTab;
