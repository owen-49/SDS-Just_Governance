// frontend/src/pages/Admin/QuestionManager.jsx
/**
 * Question Manager - Create and manage quiz questions
 */

import React, { useState, useEffect } from 'react';
import { DocumentLayout } from '../../components/layout';
import { adminApi } from '../../services/adminApi';
import './QuestionManager.css';

const QuestionManager = () => {
  const [topics, setTopics] = useState([]);
  const [selectedTopic, setSelectedTopic] = useState('');
  const [questions, setQuestions] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Form state
  const [formData, setFormData] = useState({
    stem: '',
    qtype: 'single',
    choices: [
      { id: 'A', label: '' },
      { id: 'B', label: '' },
      { id: 'C', label: '' },
      { id: 'D', label: '' },
    ],
    correct_options: [],
    explanation: '',
    is_active: true,
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

    if (!formData.stem.trim()) {
      setError('Please enter a question stem');
      return;
    }

    if (formData.correct_options.length === 0) {
      setError('Please select at least one correct answer');
      return;
    }

    if (formData.qtype === 'single' && formData.correct_options.length !== 1) {
      setError('Single choice questions must have exactly one correct answer');
      return;
    }

    if (formData.qtype === 'multi' && formData.correct_options.length < 2) {
      setError('Multiple choice questions require at least two correct answers');
      return;
    }

    setIsLoading(true);

    try {
      // Filter out empty choices
      const validChoices = formData.choices.filter(c => c.label.trim());
      
      await adminApi.createQuestion(selectedTopic, {
        ...formData,
        choices: validChoices,
      });

      setSuccess('Question created successfully!');
      
      // Reset form
      setFormData({
        stem: '',
        qtype: 'single',
        choices: [
          { id: 'A', label: '' },
          { id: 'B', label: '' },
          { id: 'C', label: '' },
          { id: 'D', label: '' },
        ],
        correct_options: [],
        explanation: '',
        is_active: true,
      });

      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      console.error('Failed to create question:', err);
      setError(err.message || 'Failed to create question');
    } finally {
      setIsLoading(false);
    }
  };

  const handleChoiceChange = (index, value) => {
    const newChoices = [...formData.choices];
    newChoices[index].label = value;
    setFormData({ ...formData, choices: newChoices });
  };

  const handleCorrectOptionToggle = (choiceId) => {
    const newCorrectOptions = formData.correct_options.includes(choiceId)
      ? formData.correct_options.filter(id => id !== choiceId)
      : [...formData.correct_options, choiceId];
    
    setFormData({ ...formData, correct_options: newCorrectOptions });
  };

  return (
    <DocumentLayout title="Question Manager">
      <div className="question-manager">
        <div className="manager-header">
          <h1>❓ Question Manager</h1>
          <p>Create and manage quiz questions for topics</p>
        </div>

        {error && (
          <div className="alert alert-error">
            ⚠️ {error}
          </div>
        )}

        {success && (
          <div className="alert alert-success">
            ✅ {success}
          </div>
        )}

        <form onSubmit={handleSubmit} className="question-form">
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
            <label htmlFor="qtype">Question Type *</label>
            <select
              id="qtype"
              value={formData.qtype}
              onChange={(e) => setFormData({ ...formData, qtype: e.target.value })}
              required
            >
              <option value="single">Single Choice</option>
              <option value="multi">Multiple Choice</option>
              <option value="short">Short Answer</option>
            </select>
          </div>

          <div className="form-group">
            <label htmlFor="stem">Question Stem *</label>
            <textarea
              id="stem"
              value={formData.stem}
              onChange={(e) => setFormData({ ...formData, stem: e.target.value })}
              placeholder="Enter the question text..."
              rows={4}
              required
            />
          </div>

          {(formData.qtype === 'single' || formData.qtype === 'multi') && (
            <div className="form-group">
              <label>Answer Choices</label>
              {formData.choices.map((choice, index) => (
                <div key={choice.id} className="choice-input">
                  <div className="choice-header">
                    <span className="choice-id">{choice.id}</span>
                    <input
                      type="checkbox"
                      checked={formData.correct_options.includes(choice.id)}
                      onChange={() => handleCorrectOptionToggle(choice.id)}
                      title="Mark as correct answer"
                    />
                    <label className="correct-label">Correct</label>
                  </div>
                  <input
                    type="text"
                    value={choice.label}
                    onChange={(e) => handleChoiceChange(index, e.target.value)}
                    placeholder={`Choice ${choice.id}...`}
                  />
                </div>
              ))}
            </div>
          )}

          <div className="form-group">
            <label htmlFor="explanation">Explanation (Optional)</label>
            <textarea
              id="explanation"
              value={formData.explanation}
              onChange={(e) => setFormData({ ...formData, explanation: e.target.value })}
              placeholder="Explain the correct answer..."
              rows={3}
            />
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
            <button
              type="submit"
              className="btn btn-primary"
              disabled={isLoading}
            >
              {isLoading ? 'Creating...' : '✓ Create Question'}
            </button>
          </div>
        </form>
      </div>
    </DocumentLayout>
  );
};

export default QuestionManager;
