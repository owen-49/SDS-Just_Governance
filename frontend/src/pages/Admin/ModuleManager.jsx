// frontend/src/pages/Admin/ModuleManager.jsx
/**
 * Module Manager - Create and manage learning modules
 */

import React, { useState, useEffect } from 'react';
import { adminApi } from '../../services/adminApi';
import './CommonManager.css';

const ModuleManager = () => {
  const [boards, setBoards] = useState([]);
  const [modules, setModules] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [showForm, setShowForm] = useState(false);

  const [formData, setFormData] = useState({
    board_id: '',
    name: '',
    sort_order: 0,
  });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      // Load boards and modules in parallel
      const [boardsData, modulesData] = await Promise.all([
        adminApi.getBoards(),
        adminApi.getModules(),
      ]);
      setBoards(boardsData);
      setModules(modulesData);
    } catch (err) {
      console.error('Failed to load data:', err);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (!formData.board_id) {
      setError('Please select a board');
      return;
    }

    if (!formData.name.trim()) {
      setError('Please enter a module name');
      return;
    }

    setIsLoading(true);

    try {
      await adminApi.createModule(formData);
      setSuccess('Module created successfully!');
      
      // Reset form
      setFormData({ board_id: '', name: '', sort_order: 0 });
      setShowForm(false);
      
      // Reload boards and modules
      await loadData();
      
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      console.error('Failed to create module:', err);
      setError(err.message || 'Failed to create module');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="manager-container">
      <div className="manager-header-section">
        <div>
          <h2>📖 Modules Management</h2>
          <p>Create and organize learning modules within boards</p>
        </div>
        <button
          className="btn btn-primary"
          onClick={() => setShowForm(!showForm)}
          disabled={boards.length === 0}
        >
          {showForm ? '✕ Cancel' : '+ New Module'}
        </button>
      </div>

      {boards.length === 0 && (
        <div className="alert alert-warning">
          ⚠️ Please create at least one board first before adding modules.
        </div>
      )}

      {error && <div className="alert alert-error">⚠️ {error}</div>}
      {success && <div className="alert alert-success">✅ {success}</div>}

      {showForm && (
        <form onSubmit={handleSubmit} className="manager-form">
          <div className="form-group">
            <label htmlFor="board_id">Select Board *</label>
            <select
              id="board_id"
              value={formData.board_id}
              onChange={(e) => setFormData({ ...formData, board_id: e.target.value })}
              required
            >
              <option value="">-- Select a board --</option>
              {boards.map(board => (
                <option key={board.id} value={board.id}>
                  {board.name}
                </option>
              ))}
            </select>
          </div>

          <div className="form-group">
            <label htmlFor="name">Module Name *</label>
            <input
              type="text"
              id="name"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              placeholder="e.g., Ethics & Compliance"
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

          <div className="form-actions">
            <button type="submit" className="btn btn-primary" disabled={isLoading}>
              {isLoading ? 'Creating...' : '✓ Create Module'}
            </button>
          </div>
        </form>
      )}

      <div className="items-list">
        <h3>Existing Modules ({modules.length})</h3>
        {modules.length === 0 ? (
          <div className="empty-state">
            <p>📭 No modules yet. Create your first module to get started!</p>
          </div>
        ) : (
          <div className="items-grid">
            {modules.map((module) => (
              <div key={module.module_id || module.id} className="item-card">
                <div className="item-header">
                  <h4>{module.name}</h4>
                  <span className="item-badge">#{module.sort_order}</span>
                </div>
                <div className="item-meta">
                  <span>📚 Board: {module.boardName}</span>
                  <span>🎯 Module ID: {(module.module_id || module.id)?.slice(0, 8)}...</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default ModuleManager;
