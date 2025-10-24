// frontend/src/pages/Assessment/GlobalAssessment.jsx
/**
 * Global Assessment Page
 * Comprehensive governance knowledge assessment with AI-powered recommendations
 */

import React, { useState, useEffect } from 'react';
import { DocumentLayout } from '../../components/layout';
import { assessmentApi, getErrorMessage } from '../../services/assessmentApi';

const GlobalAssessment = () => {
  // State management
  const [stage, setStage] = useState('intro'); // 'intro' | 'taking' | 'result'
  const [sessionId, setSessionId] = useState(null);
  const [questions, setQuestions] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [answers, setAnswers] = useState({});
  const [progress, setProgress] = useState({ total: 0, answered: 0, last_question_index: 0 });
  const [result, setResult] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [difficulty, setDifficulty] = useState('mixed');
  const [questionCount, setQuestionCount] = useState(5);
  const [availableQuestions, setAvailableQuestions] = useState(null);
  const [minQuestions, setMinQuestions] = useState(5);
  const [maxQuestions, setMaxQuestions] = useState(50);
  const lastUpdatedLabel = new Date().toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  useEffect(() => {
    const fetchAvailability = async () => {
      try {
        const availability = await assessmentApi.getGlobalAvailability();
        const total = availability?.available_total ?? 0;
        const maxCountRaw = availability?.max_count ?? total ?? 0;
        const safeMax = Math.max(1, Math.min(maxCountRaw, 50));
        const safeMin = Math.max(1, Math.min(5, safeMax));
        const defaultCount = availability?.default_count ?? Math.min(20, safeMax);

        setAvailableQuestions(total);
        setMaxQuestions(safeMax);
        setMinQuestions(safeMin);
        setQuestionCount((prev) => {
          const desired = defaultCount || prev || safeMin;
          return Math.min(Math.max(desired, safeMin), safeMax);
        });
      } catch (err) {
        console.error('Failed to load assessment availability:', err);
      }
    };

    fetchAvailability();
  }, []);

  // Start assessment
  const handleStart = async () => {
    setError('');
    setIsLoading(true);

    if (questionCount > maxQuestions) {
      setError(`Only ${maxQuestions} questions are currently available. Please select ${maxQuestions} or fewer.`);
      setIsLoading(false);
      return;
    }

    if (questionCount < minQuestions) {
      setError(`Please choose at least ${minQuestions} question${minQuestions === 1 ? '' : 's'}.`);
      setIsLoading(false);
      return;
    }

    if (availableQuestions !== null && availableQuestions === 0) {
      setError('No active questions are available. Please add questions before starting the assessment.');
      setIsLoading(false);
      return;
    }

    try {
      const response = await assessmentApi.startGlobalAssessment({
        difficulty,
        count: questionCount
      });
      const payload = response?.items ? response : response?.data ?? response ?? {};
      const items = Array.isArray(payload?.items) ? payload.items : [];
      const progressPayload = payload?.progress ?? {
        total: items.length,
        answered: 0,
        last_question_index: 0
      };
      
      setSessionId(payload?.session_id || null);
      setQuestions(items);
      setProgress(progressPayload);
      
      setStage('taking');
      setCurrentIndex(Math.min(progressPayload.last_question_index ?? 0, Math.max(items.length - 1, 0)));
    } catch (err) {
      console.error('Failed to start assessment:', err);
      
      if (err.status === 409 && err.body?.message === 'unfinished_assessment_exists') {
        setError(`You have an unfinished assessment. Please complete or discard it first.`);
      } else if (err.status === 400 && err.body?.message === 'insufficient_questions') {
        const data = err.body?.data || {};
        setError(`Not enough questions available (${data.actual}/${data.required}). Please try with fewer questions.`);
      } else {
        setError(getErrorMessage(err));
      }
    } finally {
      setIsLoading(false);
    }
  };

  // Auto-save answer
  const handleAnswerChange = async (itemId, answer) => {
    setAnswers(prev => ({ ...prev, [itemId]: answer }));
    
    if (sessionId) {
      setIsSaving(true);
      try {
        const response = await assessmentApi.saveAnswer(sessionId, itemId, answer);
        setProgress(response.progress || progress);
      } catch (err) {
        console.error('Failed to save answer:', err);
      } finally {
        setIsSaving(false);
      }
    }
  };

  // Navigation
  const handleNext = () => {
    if (currentIndex < questions.length - 1) setCurrentIndex(currentIndex + 1);
  };

  const handlePrevious = () => {
    if (currentIndex > 0) setCurrentIndex(currentIndex - 1);
  };

  const handleJumpToQuestion = (index) => {
    setCurrentIndex(index);
  };

  // Submit assessment
  const handleSubmit = async (force = false) => {
    if (!sessionId) return;
    
    const unansweredCount = questions.length - Object.keys(answers).length;
    if (unansweredCount > 0 && !force) {
      const confirmed = window.confirm(
        `You have ${unansweredCount} unanswered question(s). Submit anyway? Unanswered questions will be scored as 0.`
      );
      if (!confirmed) return;
    }
    
    setError('');
    setIsLoading(true);
    
    try {
      const response = await assessmentApi.submitAssessment(sessionId, force || unansweredCount > 0);
      const payload = response?.session_id ? response : response?.data ?? response ?? {};
      setResult(payload);
      setStage('result');
    } catch (err) {
      console.error('Failed to submit assessment:', err);
      
      if (err.status === 422 && err.body?.message === 'missing_answers') {
        const missingOrders = err.body?.data?.missing_orders || [];
        setError(`Please answer questions: ${missingOrders.join(', ')}`);
      } else if (err.status === 409 && err.body?.message === 'assessment_already_submitted') {
        setError('This assessment has already been submitted.');
        setStage('result');
      } else {
        setError(getErrorMessage(err));
      }
    } finally {
      setIsLoading(false);
    }
  };

  // Restart
  const handleRestart = () => {
    setStage('intro');
    setSessionId(null);
    setQuestions([]);
    setAnswers({});
    setResult(null);
    setCurrentIndex(0);
    setProgress({ total: 0, answered: 0, last_question_index: 0 });
    setError('');
  };

  // Render question
  const renderQuestion = () => {
    if (questions.length === 0) return null;
    
    const question = questions[currentIndex];
    if (!question) return null;
    
    const { item_id, order_no, snapshot } = question;
    const { qtype, stem, choices } = snapshot;
    const currentAnswer = answers[item_id] || '';

    return (
      <div style={{ marginBottom: '24px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
          <h3 style={{ margin: 0, color: '#1e293b' }}>
            Question {order_no} of {questions.length}
          </h3>
          {isSaving && <span style={{ fontSize: '14px', color: '#6b7280' }}>Saving...</span>}
        </div>

        <p style={{ fontSize: '18px', lineHeight: '1.6', marginBottom: '24px', color: '#334155' }}>
          {stem}
        </p>

        <div>
          {qtype === 'single' && choices && (
            <div>
              {(Array.isArray(choices) ? choices : []).map((choice, idx) => {
                const choiceId = choice.id || choice.label || `opt-${idx}`;
                const choiceLabel = choice.label || choice;
                
                return (
                  <label 
                    key={choiceId}
                    style={{ 
                      display: 'block', 
                      padding: '12px 16px',
                      marginBottom: '8px',
                      border: '2px solid',
                      borderColor: currentAnswer === choiceId ? '#3b82f6' : '#e2e8f0',
                      borderRadius: '8px',
                      cursor: 'pointer',
                      backgroundColor: currentAnswer === choiceId ? '#eff6ff' : 'white',
                      transition: 'all 0.2s'
                    }}
                  >
                    <input
                      type="radio"
                      name={`question-${item_id}`}
                      value={choiceId}
                      checked={currentAnswer === choiceId}
                      onChange={(e) => handleAnswerChange(item_id, e.target.value)}
                      style={{ marginRight: '12px' }}
                    />
                    {choiceLabel}
                  </label>
                );
              })}
            </div>
          )}

          {qtype === 'multi' && choices && (
            <div>
              {(Array.isArray(choices) ? choices : []).map((choice, idx) => {
                const choiceId = choice.id || choice.label || `opt-${idx}`;
                const choiceLabel = choice.label || choice;
                const selectedOptions = currentAnswer ? currentAnswer.split(',') : [];
                const isChecked = selectedOptions.includes(choiceId);
                
                return (
                  <label 
                    key={choiceId}
                    style={{ 
                      display: 'block', 
                      padding: '12px 16px',
                      marginBottom: '8px',
                      border: '2px solid',
                      borderColor: isChecked ? '#3b82f6' : '#e2e8f0',
                      borderRadius: '8px',
                      cursor: 'pointer',
                      backgroundColor: isChecked ? '#eff6ff' : 'white',
                      transition: 'all 0.2s'
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={isChecked}
                      onChange={(e) => {
                        const newSelected = e.target.checked
                          ? [...selectedOptions, choiceId]
                          : selectedOptions.filter(id => id !== choiceId);
                        handleAnswerChange(item_id, newSelected.sort().join(','));
                      }}
                      style={{ marginRight: '12px' }}
                    />
                    {choiceLabel}
                  </label>
                );
              })}
            </div>
          )}

          {qtype === 'short' && (
            <textarea
              value={currentAnswer}
              onChange={(e) => handleAnswerChange(item_id, e.target.value)}
              placeholder="Type your answer here..."
              rows={6}
              style={{
                width: '100%',
                padding: '12px',
                border: '2px solid #e2e8f0',
                borderRadius: '8px',
                fontSize: '16px',
                lineHeight: '1.5',
                resize: 'vertical'
              }}
            />
          )}
        </div>
      </div>
    );
  };

  // Intro stage
  if (stage === 'intro') {
    return (
      <DocumentLayout title="Global Governance Assessment" lastUpdated={lastUpdatedLabel}>
        <div style={{ maxWidth: '800px', margin: '0 auto' }}>
          <div style={{ background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)', color: 'white', padding: '40px', borderRadius: '16px', marginBottom: '32px' }}>
            <h1 style={{ fontSize: '32px', fontWeight: 'bold', marginBottom: '16px' }}>
              📊 Comprehensive Governance Assessment
            </h1>
            <p style={{ fontSize: '18px', lineHeight: '1.6', opacity: 0.95 }}>
              Test your knowledge across all governance topics. Get personalized AI-powered recommendations based on your performance.
            </p>
          </div>

          <div style={{ background: 'white', padding: '32px', borderRadius: '12px', boxShadow: '0 4px 16px rgba(0, 0, 0, 0.08)', marginBottom: '24px' }}>
            <h3 style={{ marginBottom: '24px', color: '#1e293b' }}>Assessment Settings</h3>
            
            <div style={{ marginBottom: '24px' }}>
              <label style={{ display: 'block', marginBottom: '8px', fontWeight: '600' }}>
                Difficulty Level
              </label>
              <select
                value={difficulty}
                onChange={(e) => setDifficulty(e.target.value)}
                style={{ width: '100%', padding: '12px', border: '2px solid #e2e8f0', borderRadius: '8px', fontSize: '16px' }}
              >
                <option value="mixed">Mixed (Recommended)</option>
                <option value="beginner">Beginner</option>
                <option value="intermediate">Intermediate</option>
                <option value="advanced">Advanced</option>
              </select>
            </div>

            <div style={{ marginBottom: '24px' }}>
              <label style={{ display: 'block', marginBottom: '8px', fontWeight: '600' }}>
                Number of Questions: {questionCount}
              </label>
              {availableQuestions !== null && (
                <p style={{ marginTop: 0, marginBottom: '8px', color: '#6b7280', fontSize: '14px' }}>
                  Available questions: {availableQuestions}
                </p>
              )}
              <input
                type="range"
                min={minQuestions}
                max={maxQuestions}
                value={questionCount}
                onChange={(e) => {
                  const value = parseInt(e.target.value, 10);
                  if (Number.isNaN(value)) return;
                  setQuestionCount(Math.min(Math.max(value, minQuestions), maxQuestions));
                }}
                style={{ width: '100%' }}
                disabled={maxQuestions <= minQuestions}
              />
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '14px', color: '#6b7280' }}>
                <span>{minQuestions} question{minQuestions === 1 ? '' : 's'}</span>
                <span>{maxQuestions} question{maxQuestions === 1 ? '' : 's'}</span>
              </div>
            </div>

            {error && (
              <div style={{ background: '#fef2f2', border: '1px solid #fecaca', color: '#dc2626', padding: '12px', borderRadius: '8px', marginBottom: '16px' }}>
                {error}
              </div>
            )}

            <button
              onClick={handleStart}
              disabled={isLoading || (availableQuestions !== null && availableQuestions === 0)}
              style={{
                width: '100%',
                padding: '16px',
                background: (isLoading || (availableQuestions !== null && availableQuestions === 0))
                  ? '#9ca3af'
                  : 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)',
                color: 'white',
                border: 'none',
                borderRadius: '8px',
                fontSize: '18px',
                fontWeight: '600',
                cursor: (isLoading || (availableQuestions !== null && availableQuestions === 0)) ? 'not-allowed' : 'pointer',
                boxShadow: '0 4px 12px rgba(59, 130, 246, 0.3)'
              }}
            >
              {isLoading ? 'Starting Assessment...' : 'Start Assessment'}
            </button>
          </div>

          <div style={{ background: '#f0f9ff', border: '1px solid #bae6fd', padding: '20px', borderRadius: '8px' }}>
            <h4 style={{ color: '#0c4a6e', marginBottom: '12px' }}>What to Expect</h4>
            <ul style={{ color: '#075985', lineHeight: '1.8', margin: 0 }}>
              <li>Answers are automatically saved as you go</li>
              <li>Navigate between questions freely</li>
              <li>Review and change answers before submitting</li>
              <li>Receive instant results with AI recommendations</li>
            </ul>
          </div>
        </div>
      </DocumentLayout>
    );
  }

  // Taking stage
  if (stage === 'taking') {
    const answeredCount = Object.keys(answers).length;
    const progressPercent = questions.length > 0 ? (answeredCount / questions.length) * 100 : 0;

    return (
      <DocumentLayout title="Taking Assessment" lastUpdated={lastUpdatedLabel}>
        <div style={{ maxWidth: '900px', margin: '0 auto' }}>
          <div style={{ background: 'white', padding: '20px', borderRadius: '12px', boxShadow: '0 2px 8px rgba(0, 0, 0, 0.05)', marginBottom: '24px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '12px' }}>
              <span style={{ fontWeight: '600', color: '#1e293b' }}>
                Progress: {answeredCount} / {questions.length} answered
              </span>
              <span style={{ color: '#6b7280' }}>{Math.round(progressPercent)}%</span>
            </div>
            <div style={{ width: '100%', height: '8px', background: '#e2e8f0', borderRadius: '4px', overflow: 'hidden' }}>
              <div style={{ width: `${progressPercent}%`, height: '100%', background: 'linear-gradient(90deg, #3b82f6 0%, #2563eb 100%)', transition: 'width 0.3s ease' }} />
            </div>
          </div>

          {error && (
            <div style={{ background: '#fef2f2', border: '1px solid #fecaca', color: '#dc2626', padding: '12px', borderRadius: '8px', marginBottom: '16px' }}>
              {error}
            </div>
          )}

          <div style={{ background: 'white', padding: '32px', borderRadius: '12px', boxShadow: '0 4px 16px rgba(0, 0, 0, 0.08)', marginBottom: '24px' }}>
            {renderQuestion()}

            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '32px' }}>
              <button
                onClick={handlePrevious}
                disabled={currentIndex === 0}
                style={{
                  padding: '12px 24px',
                  background: currentIndex === 0 ? '#f3f4f6' : 'white',
                  color: currentIndex === 0 ? '#9ca3af' : '#3b82f6',
                  border: '2px solid #e2e8f0',
                  borderRadius: '8px',
                  fontSize: '16px',
                  fontWeight: '600',
                  cursor: currentIndex === 0 ? 'not-allowed' : 'pointer'
                }}
              >
                ← Previous
              </button>

              {currentIndex === questions.length - 1 ? (
                <button
                  onClick={() => handleSubmit(false)}
                  disabled={isLoading}
                  style={{
                    padding: '12px 32px',
                    background: isLoading ? '#9ca3af' : 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                    color: 'white',
                    border: 'none',
                    borderRadius: '8px',
                    fontSize: '16px',
                    fontWeight: '600',
                    cursor: isLoading ? 'not-allowed' : 'pointer',
                    boxShadow: '0 4px 12px rgba(16, 185, 129, 0.3)'
                  }}
                >
                  {isLoading ? 'Submitting...' : 'Submit Assessment'}
                </button>
              ) : (
                <button
                  onClick={handleNext}
                  style={{
                    padding: '12px 24px',
                    background: 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)',
                    color: 'white',
                    border: 'none',
                    borderRadius: '8px',
                    fontSize: '16px',
                    fontWeight: '600',
                    cursor: 'pointer',
                    boxShadow: '0 4px 12px rgba(59, 130, 246, 0.3)'
                  }}
                >
                  Next →
                </button>
              )}
            </div>
          </div>

          <div style={{ background: 'white', padding: '24px', borderRadius: '12px', boxShadow: '0 2px 8px rgba(0, 0, 0, 0.05)' }}>
            <h4 style={{ marginBottom: '16px', color: '#1e293b' }}>Quick Navigation</h4>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(50px, 1fr))', gap: '8px' }}>
              {questions.map((q, idx) => {
                const isAnswered = answers[q.item_id];
                const isCurrent = idx === currentIndex;
                
                return (
                  <button
                    key={q.item_id}
                    onClick={() => handleJumpToQuestion(idx)}
                    style={{
                      padding: '12px',
                      background: isCurrent ? '#3b82f6' : isAnswered ? '#10b981' : 'white',
                      color: (isCurrent || isAnswered) ? 'white' : '#6b7280',
                      border: '2px solid',
                      borderColor: (isCurrent || isAnswered) ? 'transparent' : '#e2e8f0',
                      borderRadius: '8px',
                      fontSize: '14px',
                      fontWeight: '600',
                      cursor: 'pointer'
                    }}
                  >
                    {idx + 1}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </DocumentLayout>
    );
  }

  // Result stage
  if (stage === 'result' && result) {
    const { total_score, ai_summary, ai_recommendation } = result;
    const numericScore = Number(total_score ?? 0);
    const scoreDisplay = Number.isFinite(numericScore) ? Math.round(numericScore) : 0;

    return (
      <DocumentLayout title="Assessment Results" lastUpdated={lastUpdatedLabel}>
        <div style={{ maxWidth: '900px', margin: '0 auto' }}>
          <div style={{ background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)', color: 'white', padding: '48px', borderRadius: '16px', textAlign: 'center', marginBottom: '32px', boxShadow: '0 8px 32px rgba(16, 185, 129, 0.2)' }}>
            <h1 style={{ fontSize: '48px', fontWeight: 'bold', marginBottom: '8px' }}>
              {scoreDisplay}%
            </h1>
            <p style={{ fontSize: '20px', opacity: 0.95 }}>Your Assessment Score</p>
          </div>

          {ai_summary && (
            <div style={{ background: 'white', padding: '32px', borderRadius: '12px', boxShadow: '0 4px 16px rgba(0, 0, 0, 0.08)', marginBottom: '24px' }}>
              <h3 style={{ color: '#1e293b', marginBottom: '16px' }}>📝 Performance Summary</h3>
              <p style={{ lineHeight: '1.8', color: '#475569' }}>{ai_summary}</p>
            </div>
          )}

          {ai_recommendation && (
            <div style={{ background: 'white', padding: '32px', borderRadius: '12px', boxShadow: '0 4px 16px rgba(0, 0, 0, 0.08)', marginBottom: '24px' }}>
              <h3 style={{ color: '#1e293b', marginBottom: '16px' }}>💡 Personalized Recommendations</h3>
              
              {ai_recommendation.level && (
                <div style={{ marginBottom: '20px' }}>
                  <strong style={{ color: '#6b7280' }}>Your Level:</strong>{' '}
                  <span style={{ display: 'inline-block', padding: '4px 12px', background: '#eff6ff', color: '#1e40af', borderRadius: '6px', fontWeight: '600', marginLeft: '8px' }}>
                    {ai_recommendation.level.charAt(0).toUpperCase() + ai_recommendation.level.slice(1)}
                  </span>
                </div>
              )}

              {ai_recommendation.focus_topics && ai_recommendation.focus_topics.length > 0 && (
                <div style={{ marginBottom: '20px' }}>
                  <strong style={{ display: 'block', marginBottom: '8px', color: '#6b7280' }}>Focus Topics:</strong>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                    {ai_recommendation.focus_topics.map((topic, idx) => (
                      <span key={idx} style={{ padding: '6px 12px', background: '#fef3c7', color: '#92400e', borderRadius: '6px', fontSize: '14px' }}>
                        {topic}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {ai_recommendation.suggested_actions && ai_recommendation.suggested_actions.length > 0 && (
                <div>
                  <strong style={{ display: 'block', marginBottom: '12px', color: '#6b7280' }}>Suggested Actions:</strong>
                  <ul style={{ margin: 0, paddingLeft: '20px', color: '#475569', lineHeight: '1.8' }}>
                    {ai_recommendation.suggested_actions.map((action, idx) => (
                      <li key={idx}>{action}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}

          <div style={{ display: 'flex', gap: '16px', justifyContent: 'center' }}>
            <button
              onClick={handleRestart}
              style={{
                padding: '14px 32px',
                background: 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)',
                color: 'white',
                border: 'none',
                borderRadius: '8px',
                fontSize: '16px',
                fontWeight: '600',
                cursor: 'pointer',
                boxShadow: '0 4px 12px rgba(59, 130, 246, 0.3)'
              }}
            >
              Take Another Assessment
            </button>
            
            <button
              onClick={() => window.location.href = '/assessments/history'}
              style={{
                padding: '14px 32px',
                background: 'white',
                color: '#3b82f6',
                border: '2px solid #3b82f6',
                borderRadius: '8px',
                fontSize: '16px',
                fontWeight: '600',
                cursor: 'pointer'
              }}
            >
              View History
            </button>
          </div>
        </div>
      </DocumentLayout>
    );
  }

  return null;
};

export default GlobalAssessment;
