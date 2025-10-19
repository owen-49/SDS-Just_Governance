// frontend/src/pages/Admin/AdminPanelEnhanced.jsx
/**
 * Enhanced Admin Panel with better UX
 * Supports dynamic data loading, caching, and improved notifications
 */

import React, { useState, useCallback } from 'react';
import { DocumentLayout } from '../../components/layout';
import { AdminLoadingState } from '../../components/Admin/AdminLoadingState';
import { AdminNotification } from '../../components/Admin/AdminNotification';
import BoardManager from './BoardManager';
import ModuleManager from './ModuleManager';
import TopicManager from './TopicManager';
import QuestionManager from './QuestionManager';
import ContentManager from './ContentManager';
import DocumentManager from './DocumentManager';
import './AdminPanel.css';

const AdminPanelEnhanced = () => {
  const [activeTab, setActiveTab] = useState('boards');
  const [isLoadingData, setIsLoadingData] = useState(false);
  const [notification, setNotification] = useState(null);

  const tabs = [
    { id: 'boards', label: '📚 Boards', description: 'Manage learning boards' },
    { id: 'modules', label: '📖 Modules', description: 'Manage learning modules' },
    { id: 'topics', label: '🎯 Topics', description: 'Manage learning topics' },
    { id: 'questions', label: '❓ Questions', description: 'Manage quiz questions' },
    { id: 'content', label: '📝 Content', description: 'Manage topic content' },
    { id: 'documents', label: '📄 Documents', description: 'Manage RAG documents' },
  ];

  const showNotification = useCallback((type, message, duration = 3000) => {
    setNotification({ type, message, duration });
  }, []);

  const renderTabContent = () => {
    const commonProps = {
      onLoadingChange: setIsLoadingData,
      onNotification: showNotification,
    };

    switch (activeTab) {
      case 'boards':
        return <BoardManager {...commonProps} />;
      case 'modules':
        return <ModuleManager {...commonProps} />;
      case 'topics':
        return <TopicManager {...commonProps} />;
      case 'questions':
        return <QuestionManager {...commonProps} />;
      case 'content':
        return <ContentManager {...commonProps} />;
      case 'documents':
        return <DocumentManager {...commonProps} />;
      default:
        return null;
    }
  };

  return (
    <DocumentLayout title="Admin Panel">
      <div className="admin-panel-enhanced">
        <AdminLoadingState isLoading={isLoadingData} message="加载中..." />
        
        {notification && (
          <AdminNotification
            type={notification.type}
            message={notification.message}
            duration={notification.duration}
            onClose={() => setNotification(null)}
          />
        )}

        <div className="admin-header">
          <div>
            <h1>🔧 Admin Management Panel</h1>
            <p className="admin-subtitle">Manage all learning content, topics, questions and more</p>
          </div>
        </div>

        <div className="admin-tabs-wrapper">
          <nav className="admin-tabs-nav">
            {tabs.map(tab => (
              <button
                key={tab.id}
                className={`admin-tab ${activeTab === tab.id ? 'active' : ''}`}
                onClick={() => setActiveTab(tab.id)}
                title={tab.description}
              >
                {tab.label}
              </button>
            ))}
          </nav>
        </div>

        <div className="admin-content-wrapper">
          {renderTabContent()}
        </div>
      </div>
    </DocumentLayout>
  );
};

export default AdminPanelEnhanced;
