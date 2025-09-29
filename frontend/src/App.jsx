import React from 'react';
import { InterviewProvider } from './context/InterviewContext';
import { Tabs } from 'antd';
import IntervieweeTab from './components/IntervieweeTab';
import InterviewerTab from './components/InterviewerTab';
import WelcomeBackModal from './components/WelcomeBackModal';
import './App.css';

const App = () => {
  return (
    <InterviewProvider>
      <div className="min-h-screen bg-gray-50">
        <div className="container mx-auto px-4 py-8">
          <div className="bg-white rounded-lg shadow-lg">
            <div className="p-6 border-b">
              <h1 className="text-3xl font-bold text-center text-gray-800">
                AI Interview Assistant
              </h1>
            </div>
            
            <Tabs
              defaultActiveKey="interviewee"
              items={[
                {
                  key: 'interviewee',
                  label: 'Interviewee',
                  children: <IntervieweeTab />
                },
                {
                  key: 'interviewer',
                  label: 'Interviewer Dashboard',
                  children: <InterviewerTab />
                }
              ]}
              className="p-6"
            />
          </div>
        </div>
        
        <WelcomeBackModal />
      </div>
    </InterviewProvider>
  );
};

export default App;