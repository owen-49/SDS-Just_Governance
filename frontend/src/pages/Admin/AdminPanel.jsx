// frontend/src/pages/Admin/AdminPanel.jsx
/**
 * Admin Panel - Main dashboard for admin operations
 */

import React, { useState } from 'react';
import { DocumentLayout } from '../../components/layout';
import BoardManager from './BoardManager';
import ModuleManager from './ModuleManager';
import TopicManager from './TopicManager';
import QuestionManager from './QuestionManager';
import ContentManager from './ContentManager';
import DocumentManager from './DocumentManager';
import './AdminPanel.css';

const AdminPanel = () => {
  const [activeTab, setActiveTab] = useState('boards');

  const tabs = [
    { id: 'boards', label: '📚 Boards Management', component: 'boards' },
    { id: 'modules', label: '📖 Modules Management', component: 'modules' },
    { id: 'topics', label: '🎯 Topics Management', component: 'topics' },
    { id: 'questions', label: '❓ Questions Management', component: 'questions' },
    { id: 'content', label: '📝 Content Management', component: 'content' },
    { id: 'documents', label: '📄 Documents Management', component: 'documents' },
  ];

  return (
    <DocumentLayout title="Admin Panel">
      <div className="admin-panel">
        <div className="admin-header">
          <h1>🔧 Admin Management Panel</h1>
          <p className="admin-subtitle">Manage learning content, topics, and questions</p>
        </div>

        <div className="admin-tabs">
          {tabs.map(tab => (
            <button
              key={tab.id}
              className={`admin-tab ${activeTab === tab.id ? 'active' : ''}`}
              onClick={() => setActiveTab(tab.id)}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className="admin-content">
          {activeTab === 'boards' && <BoardManager />}
          {activeTab === 'modules' && <ModuleManager />}
          {activeTab === 'topics' && <TopicManager />}
          {activeTab === 'questions' && <QuestionManager />}
          {activeTab === 'content' && <ContentManager />}
          {activeTab === 'documents' && <DocumentManager />}
        </div>
      </div>
    </DocumentLayout>
  );
};

export default AdminPanel;
