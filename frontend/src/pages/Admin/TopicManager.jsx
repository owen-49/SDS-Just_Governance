// frontend/src/pages/Admin/TopicManager.jsx
/**
 * Topic Manager - Create and manage learning topics
 */

import React, { useState, useEffect } from 'react';
import { adminApi } from '../../services/adminApi';
import './CommonManager.css';

const TopicManager = () => {
  const [boards, setBoards] = useState([]);
  const [modules, setModules] = useState([]);
  const [topics, setTopics] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [showForm, setShowForm] = useState(false);

  const [formData, setFormData] = useState({
    module_id: '',
    name: '',
    sort_order: 0,
    pass_threshold: 0.8,
    is_active: true,
  });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [boardsData, modulesData, topicsData] = await Promise.all([
        adminApi.getBoards(),
        adminApi.getModules(),
        adminApi.getTopics(),
      ]);
      setBoards(boardsData);
      setModules(modulesData);
      setTopics(topicsData);
    } catch (err) {
      console.error('Failed to load data:', err);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (!formData.module_id) {
      setError('Please select a module');
      return;
    }

    if (!formData.name.trim()) {
      setError('Please enter a topic name');
      return;
    }

    setIsLoading(true);

    try {
      await adminApi.createTopic(formData);
      setSuccess('Topic created successfully!');
      
      // Reset form
      setFormData({
        module_id: '',
        name: '',
        sort_order: 0,
        pass_threshold: 0.8,
        is_active: true,
      });
      setShowForm(false);
      
      // Reload data
      await loadData();
      
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      console.error('Failed to create topic:', err);
      setError(err.message || 'Failed to create topic');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="manager-container">
      <div className="manager-header-section">
        <div>
          <h2>🎯 Topics Management</h2>
          <p>Create and organize learning topics within modules</p>
        </div>
        <button
          className="btn btn-primary"
          onClick={() => setShowForm(!showForm)}
          disabled={modules.length === 0}
        >
          {showForm ? '✕ Cancel' : '+ New Topic'}
        </button>
      </div>

      {modules.length === 0 && (
        <div className="alert alert-warning">
          ⚠️ Please create at least one module first before adding topics.
        </div>
      )}

      {error && <div className="alert alert-error">⚠️ {error}</div>}
      {success && <div className="alert alert-success">✅ {success}</div>}

      {showForm && (
        <form onSubmit={handleSubmit} className="manager-form">
          <div className="form-group">
            <label htmlFor="module_id">Select Module *</label>
            <select
              id="module_id"
              value={formData.module_id}
              onChange={(e) => setFormData({ ...formData, module_id: e.target.value })}
              required
            >
              <option value="">-- Select a module --</option>
              {modules.map(module => (
                <option key={module.module_id} value={module.module_id}>
                  {module.boardName} / {module.name}
                </option>
              ))}
            </select>
          </div>

          <div className="form-group">
            <label htmlFor="name">Topic Name *</label>
            <input
              type="text"
              id="name"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              placeholder="e.g., Code of Conduct"
              required
            />
          </div>

          <div className="form-group">
            <label htmlFor="sort_order">Sort Order</label>
            <input
              type="number"
              id="sort_order"
              value={formData.sort_order}
              onChange={(e) => setFormData({ ...formData, sort_order: parseInt(e.target.value) })}
              min="0"
            />
            <small>Lower numbers appear first</small>
          </div>

          <div className="form-group">
            <label htmlFor="pass_threshold">Pass Threshold (%)</label>
            <input
              type="number"
              id="pass_threshold"
              value={formData.pass_threshold * 100}
              onChange={(e) => setFormData({ ...formData, pass_threshold: parseFloat(e.target.value) / 100 })}
              min="0"
              max="100"
              step="5"
            />
            <small>Students need this score to pass the quiz</small>
          </div>

          <div className="form-group checkbox-group">
            <label>
              <input
                type="checkbox"
                checked={formData.is_active}
                onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
              />
              Active (visible to students)
            </label>
          </div>

          <div className="form-actions">
            <button type="submit" className="btn btn-primary" disabled={isLoading}>
              {isLoading ? 'Creating...' : '✓ Create Topic'}
            </button>
          </div>
        </form>
      )}

      <div className="items-list">
        <h3>Existing Topics ({topics.length})</h3>
        {topics.length === 0 ? (
          <div className="empty-state">
            <p>📭 No topics yet. Create your first topic to get started!</p>
          </div>
        ) : (
          <div className="items-grid">
            {topics.map((topic) => (
              <div key={topic.id} className="item-card">
                <div className="item-header">
                  <h4>{topic.title}</h4>
                  <span className={`status-badge ${topic.is_active ? 'active' : 'inactive'}`}>
                    {topic.is_active ? '✓ Active' : '✕ Inactive'}
                  </span>
                </div>
                <div className="item-meta">
                  <span>📚 {topic.board}</span>
                  <span>📖 {topic.module}</span>
                  <span>🎯 Pass: {(topic.pass_threshold * 100).toFixed(0)}%</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default TopicManager;
