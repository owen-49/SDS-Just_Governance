// frontend/src/pages/Admin/BoardManager.jsx
/**
 * Board Manager - Create and manage learning boards
 */

import React, { useState, useEffect } from 'react';
import { adminApi } from '../../services/adminApi';
import './CommonManager.css';

const BoardManager = () => {
  const [boards, setBoards] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [showForm, setShowForm] = useState(false);

  const [formData, setFormData] = useState({
    name: '',
    sort_order: 0,
  });

  useEffect(() => {
    loadBoards();
  }, []);

  const loadBoards = async () => {
    try {
      const data = await adminApi.getBoards();
      setBoards(data);
    } catch (err) {
      console.error('Failed to load boards:', err);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (!formData.name.trim()) {
      setError('Please enter a board name');
      return;
    }

    setIsLoading(true);

    try {
      await adminApi.createBoard(formData);
      setSuccess('Board created successfully!');
      
      // Reset form
      setFormData({ name: '', sort_order: 0 });
      setShowForm(false);
      
      // Reload boards
      await loadBoards();
      
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      console.error('Failed to create board:', err);
      setError(err.message || 'Failed to create board');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="manager-container">
      <div className="manager-header-section">
        <div>
          <h2>📚 Boards Management</h2>
          <p>Create and organize learning boards</p>
        </div>
        <button
          className="btn btn-primary"
          onClick={() => setShowForm(!showForm)}
        >
          {showForm ? '✕ Cancel' : '+ New Board'}
        </button>
      </div>

      {error && <div className="alert alert-error">⚠️ {error}</div>}
      {success && <div className="alert alert-success">✅ {success}</div>}

      {showForm && (
        <form onSubmit={handleSubmit} className="manager-form">
          <div className="form-group">
            <label htmlFor="name">Board Name *</label>
            <input
              type="text"
              id="name"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              placeholder="e.g., Corporate Governance"
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
              {isLoading ? 'Creating...' : '✓ Create Board'}
            </button>
          </div>
        </form>
      )}

      <div className="items-list">
        <h3>Existing Boards ({boards.length})</h3>
        {boards.length === 0 ? (
          <div className="empty-state">
            <p>📭 No boards yet. Create your first board to get started!</p>
          </div>
        ) : (
          <div className="items-grid">
            {boards.map((board) => (
              <div key={board.board_id || board.id} className="item-card">
                <div className="item-header">
                  <h4>{board.name}</h4>
                  <span className="item-badge">#{board.sort_order}</span>
                </div>
                <div className="item-meta">
                  <span>🆔 Board ID: {(board.board_id || board.id)?.slice(0, 8)}...</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default BoardManager;
