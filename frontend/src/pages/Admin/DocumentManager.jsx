// frontend/src/pages/Admin/DocumentManager.jsx
/**
 * Document Manager - Upload and manage RAG documents
 */

import React, { useState, useEffect } from 'react';
import { adminApi } from '../../services/adminApi';
import './DocumentManager.css';

const DocumentManager = () => {
  const [topics, setTopics] = useState([]);
  const [selectedTopic, setSelectedTopic] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const [formData, setFormData] = useState({
    title: '',
    source: '',
    metadata: {},
    chunks: [{ content: '', chunk_index: null }],
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

    // Validate chunks
    const validChunks = formData.chunks.filter(c => c.content.trim());
    if (validChunks.length === 0) {
      setError('Please add at least one content chunk');
      return;
    }

    setIsLoading(true);

    try {
      await adminApi.uploadDocument(selectedTopic, {
        title: formData.title || null,
        source: formData.source || null,
        metadata: Object.keys(formData.metadata).length > 0 ? formData.metadata : null,
        chunks: validChunks.map((chunk, index) => ({
          content: chunk.content,
          chunk_index: chunk.chunk_index !== null ? chunk.chunk_index : index,
        })),
      });

      setSuccess('Document uploaded successfully! RAG embeddings are being generated.');
      
      // Reset form
      setFormData({
        title: '',
        source: '',
        metadata: {},
        chunks: [{ content: '', chunk_index: null }],
      });

      setTimeout(() => setSuccess(''), 5000);
    } catch (err) {
      console.error('Failed to upload document:', err);
      setError(err.message || 'Failed to upload document');
    } finally {
      setIsLoading(false);
    }
  };

  const addChunk = () => {
    setFormData({
      ...formData,
      chunks: [...formData.chunks, { content: '', chunk_index: null }],
    });
  };

  const removeChunk = (index) => {
    const newChunks = formData.chunks.filter((_, i) => i !== index);
    setFormData({ ...formData, chunks: newChunks });
  };

  const updateChunk = (index, field, value) => {
    const newChunks = [...formData.chunks];
    newChunks[index][field] = field === 'chunk_index' ? (value ? parseInt(value) : null) : value;
    setFormData({ ...formData, chunks: newChunks });
  };

  const handleFileUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setError('');
    
    try {
      const text = await file.text();
      
      // Auto-split into chunks (roughly 500 characters each)
      const chunkSize = 500;
      const chunks = [];
      
      for (let i = 0; i < text.length; i += chunkSize) {
        chunks.push({
          content: text.slice(i, i + chunkSize),
          chunk_index: chunks.length,
        });
      }

      setFormData({
        ...formData,
        title: formData.title || file.name,
        chunks: chunks.length > 0 ? chunks : [{ content: '', chunk_index: null }],
      });

      setSuccess(`File loaded! Split into ${chunks.length} chunks.`);
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      console.error('Failed to read file:', err);
      setError('Failed to read file. Please try again.');
    }
  };

  return (
    <div className="document-manager">
      <div className="manager-header-section">
        <div>
          <h2>📄 Documents Management</h2>
          <p>Upload documents for AI-powered Q&A (RAG)</p>
        </div>
      </div>

      {error && <div className="alert alert-error">⚠️ {error}</div>}
      {success && <div className="alert alert-success">✅ {success}</div>}

      {topics.length === 0 && (
        <div className="alert alert-warning">
          ⚠️ Please create at least one topic first before uploading documents.
        </div>
      )}

      <form onSubmit={handleSubmit} className="document-form">
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
          <label htmlFor="file-upload">Quick Upload Text File</label>
          <input
            type="file"
            id="file-upload"
            accept=".txt,.md,.html,.json"
            onChange={handleFileUpload}
            className="file-input"
          />
          <small>Upload a text file to auto-split into chunks (supports .txt, .md, .html, .json)</small>
        </div>

        <div className="form-group">
          <label htmlFor="title">Document Title</label>
          <input
            type="text"
            id="title"
            value={formData.title}
            onChange={(e) => setFormData({ ...formData, title: e.target.value })}
            placeholder="e.g., Corporate Governance Guidelines"
          />
        </div>

        <div className="form-group">
          <label htmlFor="source">Source / URL</label>
          <input
            type="text"
            id="source"
            value={formData.source}
            onChange={(e) => setFormData({ ...formData, source: e.target.value })}
            placeholder="e.g., https://example.com/doc.pdf"
          />
          <small>Optional: Link to the original document</small>
        </div>

        <div className="form-group">
          <label>Document Chunks *</label>
          <p className="chunks-help">
            💡 Split your document into smaller chunks (paragraphs/sections) for better AI retrieval.
            Each chunk should be 200-1000 characters.
          </p>
          <div className="chunks-list">
            {formData.chunks.map((chunk, index) => (
              <div key={index} className="chunk-item">
                <div className="chunk-header">
                  <span className="chunk-number">Chunk #{index + 1}</span>
                  <input
                    type="number"
                    value={chunk.chunk_index ?? ''}
                    onChange={(e) => updateChunk(index, 'chunk_index', e.target.value)}
                    placeholder="Auto"
                    className="chunk-index-input"
                    min="0"
                  />
                  <button
                    type="button"
                    onClick={() => removeChunk(index)}
                    className="btn-remove-chunk"
                    disabled={formData.chunks.length === 1}
                  >
                    ✕ Remove
                  </button>
                </div>
                <textarea
                  value={chunk.content}
                  onChange={(e) => updateChunk(index, 'content', e.target.value)}
                  placeholder="Paste a section or paragraph of your document here...

Example:
'Corporate governance refers to the system of rules, practices, and processes by which a company is directed and controlled. It essentially involves balancing the interests of stakeholders, such as shareholders, management, customers, suppliers, financiers, government and the community.'"
                  rows={8}
                  className="chunk-textarea"
                />
                <small className="char-count">
                  {chunk.content.length} characters
                  {chunk.content.length < 100 && ' (too short)'}
                  {chunk.content.length > 1000 && ' (consider splitting)'}
                </small>
              </div>
            ))}
            <button
              type="button"
              onClick={addChunk}
              className="btn btn-secondary"
            >
              + Add Chunk
            </button>
          </div>
        </div>

        <div className="form-actions">
          <button
            type="submit"
            className="btn btn-primary"
            disabled={isLoading || !selectedTopic}
          >
            {isLoading ? 'Uploading & Generating Embeddings...' : '✓ Upload Document'}
          </button>
        </div>
      </form>

      <div className="rag-info">
        <h3>🤖 About RAG (Retrieval-Augmented Generation)</h3>
        <p>
          When you upload documents, the system creates AI embeddings for each chunk.
          Students can then ask questions, and the AI will find relevant chunks to answer accurately.
        </p>
        <ul>
          <li>✅ Better answers based on your specific content</li>
          <li>✅ Reduces AI hallucinations</li>
          <li>✅ Provides source citations</li>
          <li>✅ Works with any text content</li>
        </ul>
      </div>
    </div>
  );
};

export default DocumentManager;
