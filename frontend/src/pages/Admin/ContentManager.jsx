// frontend/src/pages/Admin/ContentManager.jsx
/**
 * Content Manager - Manage topic content and resources
 */

import React, { useState, useEffect } from 'react';
import { adminApi } from '../../services/adminApi';
import './ContentManager.css';

const ContentManager = () => {
  const [topics, setTopics] = useState([]);
  const [selectedTopic, setSelectedTopic] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const [formData, setFormData] = useState({
    body_format: 'markdown',
    body_markdown: '',
    summary: '',
    resources: [{ title: '', url: '' }],
  });

  useEffect(() => {
    loadTopics();
  }, []);

  const loadTopics = async () => {
    try {
      const data = await adminApi.getTopics();
      setTopics(data);
    } catch (err) {
      console.error('Failed to load topics:', err);
      setError('Failed to load topics');
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (!selectedTopic) {
      setError('Please select a topic');
      return;
    }

    setIsLoading(true);

    try {
      // Filter out empty resources
      const validResources = formData.resources.filter(
        r => r.title.trim() && r.url.trim()
      );

      await adminApi.updateTopicContent(selectedTopic, {
        body_format: formData.body_format,
        body_markdown: formData.body_markdown || null,
        summary: formData.summary || null,
        resources: validResources.length > 0 ? validResources : null,
      });

      setSuccess('Content updated successfully!');
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      console.error('Failed to update content:', err);
      setError(err.message || 'Failed to update content');
    } finally {
      setIsLoading(false);
    }
  };

  const addResource = () => {
    setFormData({
      ...formData,
      resources: [...formData.resources, { title: '', url: '' }],
    });
  };

  const removeResource = (index) => {
    const newResources = formData.resources.filter((_, i) => i !== index);
    setFormData({ ...formData, resources: newResources });
  };

  const updateResource = (index, field, value) => {
    const newResources = [...formData.resources];
    newResources[index][field] = value;
    setFormData({ ...formData, resources: newResources });
  };

  return (
    <div className="content-manager">
      <div className="manager-header-section">
        <div>
          <h2>📝 Content Management</h2>
          <p>Create and edit topic content with Markdown</p>
        </div>
      </div>

      {error && <div className="alert alert-error">⚠️ {error}</div>}
      {success && <div className="alert alert-success">✅ {success}</div>}

      {topics.length === 0 && (
        <div className="alert alert-warning">
          ⚠️ Please create at least one topic first before adding content.
        </div>
      )}

      <form onSubmit={handleSubmit} className="content-form">
        <div className="form-group">
          <label htmlFor="topic">Select Topic *</label>
          <select
            id="topic"
            value={selectedTopic}
            onChange={(e) => setSelectedTopic(e.target.value)}
            required
          >
            <option value="">-- Select a topic --</option>
            {topics.map(topic => (
              <option key={topic.id} value={topic.id}>
                {topic.board} / {topic.module} / {topic.title}
              </option>
            ))}
          </select>
        </div>

        <div className="form-group">
          <label htmlFor="body_format">Content Format</label>
          <select
            id="body_format"
            value={formData.body_format}
            onChange={(e) => setFormData({ ...formData, body_format: e.target.value })}
          >
            <option value="markdown">Markdown</option>
            <option value="html">HTML</option>
            <option value="plain">Plain Text</option>
          </select>
        </div>

        <div className="form-group">
          <label htmlFor="summary">Summary</label>
          <textarea
            id="summary"
            value={formData.summary}
            onChange={(e) => setFormData({ ...formData, summary: e.target.value })}
            placeholder="Brief summary of the topic..."
            rows={3}
          />
          <small>A short description that will appear in the topic list</small>
        </div>

        <div className="form-group">
          <label htmlFor="body_markdown">Content Body</label>
          <textarea
            id="body_markdown"
            value={formData.body_markdown}
            onChange={(e) => setFormData({ ...formData, body_markdown: e.target.value })}
            placeholder="# Main Topic Title

## Introduction
Write your content here using Markdown...

## Key Points
- Point 1
- Point 2
- Point 3

## Conclusion
..."
            rows={20}
            className="markdown-editor"
          />
          <small>
            Use Markdown syntax for formatting. 
            <a href="https://www.markdownguide.org/basic-syntax/" target="_blank" rel="noopener noreferrer" style={{ marginLeft: '8px' }}>
              Learn Markdown
            </a>
          </small>
        </div>

        <div className="form-group">
          <label>Learning Resources</label>
          <div className="resources-list">
            {formData.resources.map((resource, index) => (
              <div key={index} className="resource-item">
                <div className="resource-inputs">
                  <input
                    type="text"
                    value={resource.title}
                    onChange={(e) => updateResource(index, 'title', e.target.value)}
                    placeholder="Resource title (e.g., Official Documentation)"
                  />
                  <input
                    type="url"
                    value={resource.url}
                    onChange={(e) => updateResource(index, 'url', e.target.value)}
                    placeholder="URL (e.g., https://example.com)"
                  />
                  <button
                    type="button"
                    onClick={() => removeResource(index)}
                    className="btn-remove"
                    disabled={formData.resources.length === 1}
                  >
                    ✕
                  </button>
                </div>
              </div>
            ))}
            <button
              type="button"
              onClick={addResource}
              className="btn btn-secondary"
            >
              + Add Resource
            </button>
          </div>
          <small>Add helpful links and resources for students</small>
        </div>

        <div className="form-actions">
          <button
            type="submit"
            className="btn btn-primary"
            disabled={isLoading || !selectedTopic}
          >
            {isLoading ? 'Saving...' : '✓ Save Content'}
          </button>
        </div>
      </form>

      <div className="markdown-preview-note">
        <h3>💡 Markdown Tips</h3>
        <ul>
          <li><code># Heading 1</code> - Main title</li>
          <li><code>## Heading 2</code> - Section title</li>
          <li><code>**bold text**</code> - Bold text</li>
          <li><code>*italic text*</code> - Italic text</li>
          <li><code>- Item</code> - Bullet list</li>
          <li><code>1. Item</code> - Numbered list</li>
          <li><code>[Link](url)</code> - Hyperlink</li>
          <li><code>`code`</code> - Inline code</li>
        </ul>
      </div>
    </div>
  );
};

export default ContentManager;
