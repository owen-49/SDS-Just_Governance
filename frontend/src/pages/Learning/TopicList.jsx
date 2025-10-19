import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { learningApi } from '../../services/learning';
import './TopicList.css';

function TopicList() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [boards, setBoards] = useState([]);
  const [selectedBoard, setSelectedBoard] = useState(null);
  const [modules, setModules] = useState([]);
  const [selectedModule, setSelectedModule] = useState(null);
  const [topics, setTopics] = useState([]);

  // 加载所有董事会
  useEffect(() => {
    loadBoards();
  }, []);

  // 当选择董事会时，加载模块
  useEffect(() => {
    if (selectedBoard) {
      loadModules(selectedBoard);
    } else {
      setModules([]);
      setSelectedModule(null);
      setTopics([]);
    }
  }, [selectedBoard]);

  // 当选择模块时，加载主题
  useEffect(() => {
    if (selectedModule) {
      loadTopics(selectedModule);
    } else {
      setTopics([]);
    }
  }, [selectedModule]);

  async function loadBoards() {
    try {
      setLoading(true);
      const result = await learningApi.listBoards();
      setBoards(result?.items || []);
      // Auto-select first board
      if (result?.items?.length > 0) {
        setSelectedBoard(result.items[0].board_id);
      }
    } catch (err) {
      setError('Failed to load boards: ' + (err.message || 'Unknown error'));
      console.error('Load boards error:', err);
    } finally {
      setLoading(false);
    }
  }

  async function loadModules(boardId) {
    try {
      setLoading(true);
      const result = await learningApi.listModules(boardId);
      setModules(result?.items || []);
      // Auto-select first module
      if (result?.items?.length > 0) {
        setSelectedModule(result.items[0].module_id);
      } else {
        setSelectedModule(null);
        setTopics([]);
      }
    } catch (err) {
      setError('Failed to load modules: ' + (err.message || 'Unknown error'));
      console.error('Load modules error:', err);
    } finally {
      setLoading(false);
    }
  }

  async function loadTopics(moduleId) {
    try {
      setLoading(true);
      const result = await learningApi.listTopics(moduleId);
      setTopics(result?.items || []);
    } catch (err) {
      setError('Failed to load topics: ' + (err.message || 'Unknown error'));
      console.error('Load topics error:', err);
    } finally {
      setLoading(false);
    }
  }

  function getProgressColor(status) {
    switch (status) {
      case 'completed': return '#10b981';
      case 'in_progress': return '#3b82f6';
      case 'not_started': return '#9ca3af';
      default: return '#9ca3af';
    }
  }

  function getProgressText(status) {
    switch (status) {
      case 'completed': return 'Completed';
      case 'in_progress': return 'In Progress';
      case 'not_started': return 'Not Started';
      default: return 'Not Started';
    }
  }

  if (loading && boards.length === 0) {
    return (
      <div className="topic-list-container">
        <div className="loading-spinner">
          <div className="spinner"></div>
          <p>Loading...</p>
        </div>
      </div>
    );
  }

  if (error && boards.length === 0) {
    return (
      <div className="topic-list-container">
        <div className="error-message">
          <span className="error-icon">⚠️</span>
          <p>{error}</p>
          <button onClick={loadBoards} className="retry-button">
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="topic-list-container">
      {/* Navigation */}
      <div className="navigation-breadcrumb">
        <button 
          onClick={() => navigate('/')} 
          className="back-link"
          title="Back to Home"
        >
          ← Back to Home
        </button>
      </div>

      <header className="topic-list-header">
        <h1>📚 Learning Topics</h1>
        <p className="subtitle">Explore governance knowledge and enhance your expertise</p>
      </header>

      {/* Board Selector */}
      <div className="selector-section">
        <label className="selector-label">Select Board Type</label>
        <div className="board-selector">
          {boards.map(board => (
            <button
              key={board.board_id}
              className={`board-button ${selectedBoard === board.board_id ? 'active' : ''}`}
              onClick={() => setSelectedBoard(board.board_id)}
            >
              {board.name}
            </button>
          ))}
        </div>
      </div>

      {/* Module Selector */}
      {modules.length > 0 && (
        <div className="selector-section">
          <label className="selector-label">Select Learning Module</label>
          <div className="module-selector">
            {modules.map(module => (
              <button
                key={module.module_id}
                className={`module-button ${selectedModule === module.module_id ? 'active' : ''}`}
                onClick={() => setSelectedModule(module.module_id)}
              >
                {module.name}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Topics Grid */}
      {topics.length > 0 ? (
        <div className="topics-grid">
          {topics.map(topic => (
            <div
              key={topic.topic_id}
              className="topic-card"
              onClick={() => navigate(`/learning/topics/${topic.topic_id}`)}
            >
              <div className="topic-card-header">
                <h3 className="topic-name">{topic.name}</h3>
                <span 
                  className="topic-status"
                  style={{ backgroundColor: getProgressColor(topic.progress_status) }}
                >
                  {getProgressText(topic.progress_status)}
                </span>
              </div>

              <div className="topic-card-body">
                {topic.pass_threshold !== null && (
                  <div className="topic-info-row">
                    <span className="info-label">Pass Score:</span>
                    <span className="info-value">{(topic.pass_threshold * 100).toFixed(0)}%</span>
                  </div>
                )}

                {topic.best_score !== null && (
                  <div className="topic-info-row">
                    <span className="info-label">Best Score:</span>
                    <span className="info-value score-highlight">
                      {(topic.best_score * 100).toFixed(0)}%
                    </span>
                  </div>
                )}

                {topic.attempt_count > 0 && (
                  <div className="topic-info-row">
                    <span className="info-label">Attempts:</span>
                    <span className="info-value">{topic.attempt_count}</span>
                  </div>
                )}
              </div>

              <div className="topic-card-footer">
                <button className="view-button">
                  View Details →
                </button>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="empty-state">
          <span className="empty-icon">📖</span>
          <p className="empty-message">
            {selectedModule ? 'No topics available in this module' : 'Please select a module to view topics'}
          </p>
        </div>
      )}
    </div>
  );
}

export default TopicList;
