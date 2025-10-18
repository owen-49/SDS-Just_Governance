import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { learningApi } from '../../services/learning';
import ReactMarkdown from 'react-markdown';
import './TopicDetail.css';

function TopicDetail() {
  const { topicId } = useParams();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [topic, setTopic] = useState(null);
  const [content, setContent] = useState(null);
  const [progress, setProgress] = useState(null);
  const [activeTab, setActiveTab] = useState('content'); // content, quiz, rag

  useEffect(() => {
    loadTopicData();
    // 记录访问
    learningApi.visitTopic(topicId).catch(err => {
      console.warn('Visit topic failed:', err);
    });
  }, [topicId]);

  async function loadTopicData() {
    try {
      setLoading(true);
      setError(null);

      const [detailResult, contentResult] = await Promise.all([
        learningApi.getTopicDetail(topicId),
        learningApi.getTopicContent(topicId)
      ]);

      setTopic(detailResult?.topic);
      setProgress(detailResult?.progress_summary);
      setContent(contentResult);
    } catch (err) {
      setError('Failed to load topic data: ' + (err.message || 'Unknown error'));
      console.error('Load topic data error:', err);
    } finally {
      setLoading(false);
    }
  }

  async function handleStartQuiz() {
    try {
      navigate(`/learning/topics/${topicId}/quiz`);
    } catch (err) {
      console.error('Start quiz error:', err);
      alert('Failed to start quiz: ' + (err.message || 'Unknown error'));
    }
  }

  async function handleMarkComplete() {
    if (!window.confirm('Confirm marking this topic as complete?')) {
      return;
    }

    try {
      await learningApi.completeTopic(topicId);
      alert('Congratulations on completing this topic!');
      await loadTopicData();
    } catch (err) {
      console.error('Mark complete error:', err);
      const msg = err.response?.data?.message || err.message || 'Unknown error';
      alert('Failed to mark complete: ' + msg);
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

  function canMarkComplete() {
    if (!progress || !topic) return false;
    if (progress.marked_complete) return false;
    
    const threshold = topic.pass_threshold || 0;
    const bestScore = progress.best_score || 0;
    
    return bestScore >= threshold;
  }

  if (loading) {
    return (
      <div className="topic-detail-container">
        <div className="loading-spinner">
          <div className="spinner"></div>
          <p>Loading...</p>
        </div>
      </div>
    );
  }

  if (error || !topic) {
    return (
      <div className="topic-detail-container">
        <div className="error-message">
          <span className="error-icon">⚠️</span>
          <p>{error || 'Topic not found'}</p>
          <button onClick={() => navigate('/learning/topics')} className="back-button">
            Back to List
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="topic-detail-container">
      {/* Header */}
      <header className="topic-detail-header">
        <button onClick={() => navigate('/learning/topics')} className="back-link">
          ← Back to List
        </button>
        
        <div className="header-content">
          <div className="header-left">
            <h1 className="topic-title">{topic.name}</h1>
            <span 
              className="topic-status-badge"
              style={{ backgroundColor: getProgressColor(progress?.progress_status) }}
            >
              {getProgressText(progress?.progress_status)}
            </span>
          </div>

          <div className="header-actions">
            <button onClick={handleStartQuiz} className="quiz-button">
              📝 Start Quiz
            </button>
            {canMarkComplete() && (
              <button onClick={handleMarkComplete} className="complete-button">
                ✓ Mark Complete
              </button>
            )}
          </div>
        </div>
      </header>

      {/* Progress Stats */}
      {progress && (
        <div className="progress-stats">
          {progress.best_score !== null && (
            <div className="stat-card">
              <div className="stat-label">Best Score</div>
              <div className="stat-value score">{(progress.best_score * 100).toFixed(0)}%</div>
            </div>
          )}

          {progress.last_score !== null && (
            <div className="stat-card">
              <div className="stat-label">Recent Score</div>
              <div className="stat-value">{(progress.last_score * 100).toFixed(0)}%</div>
            </div>
          )}

          {topic.pass_threshold !== null && (
            <div className="stat-card">
              <div className="stat-label">Pass Score</div>
              <div className="stat-value">{(topic.pass_threshold * 100).toFixed(0)}%</div>
            </div>
          )}

          {progress.attempt_count > 0 && (
            <div className="stat-card">
              <div className="stat-label">Attempts</div>
              <div className="stat-value">{progress.attempt_count}</div>
            </div>
          )}
        </div>
      )}

      {/* Tabs */}
      <div className="tabs-container">
        <button
          className={`tab-button ${activeTab === 'content' ? 'active' : ''}`}
          onClick={() => setActiveTab('content')}
        >
          📖 Content
        </button>
        <button
          className={`tab-button ${activeTab === 'quiz' ? 'active' : ''}`}
          onClick={() => setActiveTab('quiz')}
        >
          📝 Quiz
        </button>
        <button
          className={`tab-button ${activeTab === 'rag' ? 'active' : ''}`}
          onClick={() => setActiveTab('rag')}
        >
          💬 AI Q&A
        </button>
      </div>

      {/* Content Area */}
      <div className="content-area">
        {activeTab === 'content' && (
          <div className="content-tab">
            {content?.summary && (
              <div className="summary-box">
                <h3>📌 Summary</h3>
                <p>{content.summary}</p>
              </div>
            )}

            {content?.body_markdown && (
              <div className="markdown-content">
                <ReactMarkdown>{content.body_markdown}</ReactMarkdown>
              </div>
            )}

            {content?.resources && content.resources.length > 0 && (
              <div className="resources-box">
                <h3>🔗 Resources</h3>
                <ul className="resources-list">
                  {content.resources.map((resource, idx) => (
                    <li key={idx}>
                      <a href={resource.url} target="_blank" rel="noopener noreferrer">
                        {resource.title}
                      </a>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}

        {activeTab === 'quiz' && (
          <div className="quiz-tab">
            <div className="quiz-intro">
              <h2>Ready to Take the Quiz</h2>
              <p>Complete the quiz to test your understanding of this topic</p>
              
              <div className="quiz-info">
                {topic.pass_threshold && (
                  <div className="quiz-info-item">
                    <span className="info-icon">🎯</span>
                    <span>Pass Score: {(topic.pass_threshold * 100).toFixed(0)}%</span>
                  </div>
                )}
                {progress?.attempt_count > 0 && (
                  <div className="quiz-info-item">
                    <span className="info-icon">📊</span>
                    <span>Attempted {progress.attempt_count} times</span>
                  </div>
                )}
                {progress?.best_score !== null && (
                  <div className="quiz-info-item">
                    <span className="info-icon">⭐</span>
                    <span>Best Score: {(progress.best_score * 100).toFixed(0)}%</span>
                  </div>
                )}
              </div>

              <button onClick={handleStartQuiz} className="start-quiz-button">
                Start Quiz →
              </button>
            </div>
          </div>
        )}

        {activeTab === 'rag' && (
          <div className="rag-tab">
            <TopicRAGSearch topicId={topicId} />
          </div>
        )}
      </div>
    </div>
  );
}

// RAG 智能问答组件
function TopicRAGSearch({ topicId }) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  async function handleSearch(e) {
    e.preventDefault();
    if (!query.trim()) return;

    try {
      setLoading(true);
      setError(null);
      const data = await learningApi.searchTopicRag(topicId, query.trim());
      setResults(data?.results || []);
    } catch (err) {
      setError('Search failed: ' + (err.message || 'Unknown error'));
      console.error('RAG search error:', err);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="rag-search-container">
      <div className="rag-intro">
        <h2>💬 AI Q&A</h2>
        <p>Ask questions and get answers from the learning materials</p>
      </div>

      <form onSubmit={handleSearch} className="rag-search-form">
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="e.g., What is the fiduciary duty of a board?"
          className="rag-search-input"
          disabled={loading}
        />
        <button type="submit" className="rag-search-button" disabled={loading || !query.trim()}>
          {loading ? 'Searching...' : 'Search'}
        </button>
      </form>

      {error && (
        <div className="rag-error">
          <span className="error-icon">⚠️</span>
          <span>{error}</span>
        </div>
      )}

      {results.length > 0 && (
        <div className="rag-results">
          <h3>Search Results ({results.length})</h3>
          {results.map((result, idx) => (
            <div key={idx} className="rag-result-card">
              <div className="result-meta">
                <span className="result-score">Relevance: {(result.score * 100).toFixed(0)}%</span>
                {result.chunk_index !== null && (
                  <span className="result-chunk">Paragraph {result.chunk_index + 1}</span>
                )}
              </div>
              <p className="result-text">{result.text}</p>
            </div>
          ))}
        </div>
      )}

      {!loading && results.length === 0 && query && (
        <div className="rag-empty">
          <span className="empty-icon">🔍</span>
          <p>No relevant content found, please try another question</p>
        </div>
      )}
    </div>
  );
}

export default TopicDetail;
