// frontend/src/pages/Assessment/TopicQuiz.jsx
/**
 * Topic Quiz Page
 * Topic-specific knowledge quiz with instant grading
 */

import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { DocumentLayout } from '../../components/layout';
import { assessmentApi, getErrorMessage } from '../../services/assessmentApi';

const TopicQuiz = () => {
  const { topicId } = useParams();
  const navigate = useNavigate();
  
  const [stage, setStage] = useState('loading'); // 'loading' | 'pending' | 'taking' | 'result'
  const [quizData, setQuizData] = useState(null);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [answers, setAnswers] = useState({});
  const [result, setResult] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  // Load quiz on mount
  useEffect(() => {
    loadQuiz();
  }, [topicId]);

  const normalizeQuizData = (resp) => {
    const questions = Array.isArray(resp?.questions)
      ? resp.questions
      : Array.isArray(resp?.items)
        ? resp.items
        : [];
    return { ...resp, questions };
  };

  const loadQuiz = async () => {
    setError('');
    setIsLoading(true);
    
    try {
      const response = await assessmentApi.getPendingQuiz(topicId);
      const normalized = normalizeQuizData(response);
      setQuizData(normalized);
      setStage(normalized.quiz_state === 'pending' ? 'pending' : 'taking');
    } catch (err) {
      console.error('Failed to load quiz:', err);
      const errorMessage = getErrorMessage(err);
      
      // 检查是否是"unfinished assessment"错误
      if (err.body?.message?.includes('unfinished') || errorMessage.includes('unfinished')) {
        setError(`You have an unfinished quiz for this topic. Please complete it or wait for it to be cleared before starting a new one.`);
      } else {
        setError(errorMessage);
      }
      setStage('error');
    } finally {
      setIsLoading(false);
    }
  };

  // Start quiz
  const handleStart = () => {
    if (quizData) {
      setStage('taking');
      setCurrentIndex(0);
    }
  };

  // Answer change
  const handleAnswerChange = (itemId, answer) => {
    setAnswers(prev => ({ ...prev, [itemId]: answer }));
  };

  // Navigation
  const handleNext = () => {
    if (quizData && Array.isArray(quizData.questions) && currentIndex < quizData.questions.length - 1) {
      setCurrentIndex(currentIndex + 1);
    }
  };

  const handlePrevious = () => {
    if (currentIndex > 0) {
      setCurrentIndex(currentIndex - 1);
    }
  };

  // Submit quiz
  const handleSubmit = async () => {
    if (!quizData) return;
    
    const unansweredCount = quizData.questions.length - Object.keys(answers).length;
    if (unansweredCount > 0) {
      const confirmed = window.confirm(
        `You have ${unansweredCount} unanswered question(s). Submit anyway?`
      );
      if (!confirmed) return;
    }
    
    setError('');
    setIsLoading(true);
    
    try {
      // 转换答案格式为数组: { item_id: answer } => [{ order_no, item_id, answer }]
      const answersArray = quizData.questions.map((question) => ({
        order_no: question.order_no,
        item_id: question.item_id,
        answer: answers[question.item_id] || ''
      })).filter(item => item.answer !== ''); // 只提交已回答的题目
      
      const response = await assessmentApi.submitTopicQuiz(topicId, answersArray);
      setResult(response);
      setStage('result');
    } catch (err) {
      console.error('Failed to submit quiz:', err);
      setError(getErrorMessage(err));
    } finally {
      setIsLoading(false);
    }
  };

  // Render question
  const renderQuestion = () => {
    if (!quizData || !quizData.questions || quizData.questions.length === 0) return null;
    
    const question = quizData.questions[currentIndex];
    if (!question) return null;
    
    const { item_id, order_no, snapshot } = question;
    const { qtype, stem, choices } = snapshot;
    const currentAnswer = answers[item_id] || '';

    return (
      <div style={{ marginBottom: '24px' }}>
        <h3 style={{ marginBottom: '16px', color: '#1e293b' }}>
          Question {order_no} of {quizData.questions.length}
        </h3>

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
                      borderColor: currentAnswer === choiceId ? '#8b5cf6' : '#e2e8f0',
                      borderRadius: '8px',
                      cursor: 'pointer',
                      backgroundColor: currentAnswer === choiceId ? '#f5f3ff' : 'white',
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
                      borderColor: isChecked ? '#8b5cf6' : '#e2e8f0',
                      borderRadius: '8px',
                      cursor: 'pointer',
                      backgroundColor: isChecked ? '#f5f3ff' : 'white',
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

  // Loading state
  if (stage === 'loading') {
    return (
      <DocumentLayout title="Loading Quiz..." lastUpdated="October 18, 2025">
        <div style={{ textAlign: 'center', padding: '60px' }}>
          <div style={{ fontSize: '48px', marginBottom: '16px' }}>⏳</div>
          <p style={{ fontSize: '18px', color: '#6b7280' }}>Loading your quiz...</p>
        </div>
      </DocumentLayout>
    );
  }

  // Error state
  if (stage === 'error') {
    return (
      <DocumentLayout title="Quiz Error" lastUpdated="October 18, 2025">
        <div style={{ maxWidth: '600px', margin: '0 auto', textAlign: 'center', padding: '60px' }}>
          <div style={{ fontSize: '64px', marginBottom: '24px' }}>❌</div>
          <h2 style={{ marginBottom: '16px', color: '#dc2626' }}>Failed to Load Quiz</h2>
          <p style={{ marginBottom: '24px', color: '#6b7280' }}>{error || 'An unexpected error occurred.'}</p>
          <button
            onClick={() => navigate(-1)}
            style={{
              padding: '12px 24px',
              background: 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)',
              color: 'white',
              border: 'none',
              borderRadius: '8px',
              fontSize: '16px',
              fontWeight: '600',
              cursor: 'pointer'
            }}
          >
            Go Back
          </button>
        </div>
      </DocumentLayout>
    );
  }

  // Pending state
  if (stage === 'pending' && quizData) {
    return (
      <DocumentLayout title="Topic Quiz" lastUpdated="October 18, 2025">
        <div style={{ maxWidth: '700px', margin: '0 auto' }}>
          <div style={{ background: 'linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%)', color: 'white', padding: '40px', borderRadius: '16px', marginBottom: '32px' }}>
            <h1 style={{ fontSize: '32px', fontWeight: 'bold', marginBottom: '16px' }}>
              📚 Topic Quiz Ready
            </h1>
            <p style={{ fontSize: '18px', opacity: 0.95 }}>
              Test your knowledge on this specific topic with {quizData.questions?.length || 0} questions.
            </p>
          </div>

          <div style={{ background: 'white', padding: '32px', borderRadius: '12px', boxShadow: '0 4px 16px rgba(0, 0, 0, 0.08)', marginBottom: '24px' }}>
            <h3 style={{ marginBottom: '16px', color: '#1e293b' }}>Quiz Information</h3>
            <ul style={{ lineHeight: '1.8', color: '#475569', margin: 0 }}>
              <li><strong>Questions:</strong> {quizData.questions?.length || 0}</li>
              <li><strong>Status:</strong> <span style={{ color: '#f59e0b', fontWeight: '600' }}>Pending</span></li>
              <li><strong>Auto-graded:</strong> Instant results after submission</li>
            </ul>
          </div>

          <button
            onClick={handleStart}
            style={{
              width: '100%',
              padding: '16px',
              background: 'linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%)',
              color: 'white',
              border: 'none',
              borderRadius: '8px',
              fontSize: '18px',
              fontWeight: '600',
              cursor: 'pointer',
              boxShadow: '0 4px 12px rgba(139, 92, 246, 0.3)'
            }}
          >
            Start Quiz
          </button>
        </div>
      </DocumentLayout>
    );
  }

  // Taking stage
  if (stage === 'taking' && quizData) {
    const total = Array.isArray(quizData.questions) ? quizData.questions.length : 0;
    const answeredCount = Object.keys(answers).length;
    const progressPercent = total > 0 ? (answeredCount / total) * 100 : 0;

    return (
      <DocumentLayout title="Taking Quiz" lastUpdated="October 18, 2025">
        <div style={{ maxWidth: '800px', margin: '0 auto' }}>
          <div style={{ background: 'white', padding: '20px', borderRadius: '12px', boxShadow: '0 2px 8px rgba(0, 0, 0, 0.05)', marginBottom: '24px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '12px' }}>
              <span style={{ fontWeight: '600', color: '#1e293b' }}>
                Progress: {answeredCount} / {total} answered
              </span>
              <span style={{ color: '#6b7280' }}>{Math.round(progressPercent)}%</span>
            </div>
            <div style={{ width: '100%', height: '8px', background: '#e2e8f0', borderRadius: '4px', overflow: 'hidden' }}>
              <div style={{ width: `${progressPercent}%`, height: '100%', background: 'linear-gradient(90deg, #8b5cf6 0%, #7c3aed 100%)', transition: 'width 0.3s ease' }} />
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
                  color: currentIndex === 0 ? '#9ca3af' : '#8b5cf6',
                  border: '2px solid #e2e8f0',
                  borderRadius: '8px',
                  fontSize: '16px',
                  fontWeight: '600',
                  cursor: currentIndex === 0 ? 'not-allowed' : 'pointer'
                }}
              >
                ← Previous
              </button>

              {currentIndex === Math.max(0, total - 1) ? (
                <button
                  onClick={handleSubmit}
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
                  {isLoading ? 'Submitting...' : 'Submit Quiz'}
                </button>
              ) : (
                <button
                  onClick={handleNext}
                  style={{
                    padding: '12px 24px',
                    background: 'linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%)',
                    color: 'white',
                    border: 'none',
                    borderRadius: '8px',
                    fontSize: '16px',
                    fontWeight: '600',
                    cursor: 'pointer',
                    boxShadow: '0 4px 12px rgba(139, 92, 246, 0.3)'
                  }}
                >
                  Next →
                </button>
              )}
            </div>
          </div>

          <div style={{ background: 'white', padding: '24px', borderRadius: '12px', boxShadow: '0 2px 8px rgba(0, 0, 0, 0.05)' }}>
            <h4 style={{ marginBottom: '16px', color: '#1e293b' }}>Question Navigator</h4>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(50px, 1fr))', gap: '8px' }}>
              {(quizData.questions || []).map((q, idx) => {
                const isAnswered = answers[q.item_id];
                const isCurrent = idx === currentIndex;
                
                return (
                  <button
                    key={q.item_id}
                    onClick={() => setCurrentIndex(idx)}
                    style={{
                      padding: '12px',
                      background: isCurrent ? '#8b5cf6' : isAnswered ? '#10b981' : 'white',
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
    const { total_score, correct_count, total_count } = result;

    return (
      <DocumentLayout title="Quiz Results" lastUpdated="October 18, 2025">
        <div style={{ maxWidth: '700px', margin: '0 auto' }}>
          <div style={{ background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)', color: 'white', padding: '48px', borderRadius: '16px', textAlign: 'center', marginBottom: '32px', boxShadow: '0 8px 32px rgba(16, 185, 129, 0.2)' }}>
            <h1 style={{ fontSize: '48px', fontWeight: 'bold', marginBottom: '8px' }}>
              {Math.round(total_score)}%
            </h1>
            <p style={{ fontSize: '20px', opacity: 0.95 }}>
              {correct_count} / {total_count} Correct
            </p>
          </div>

          <div style={{ background: 'white', padding: '32px', borderRadius: '12px', boxShadow: '0 4px 16px rgba(0, 0, 0, 0.08)', marginBottom: '24px', textAlign: 'center' }}>
            <div style={{ fontSize: '64px', marginBottom: '16px' }}>
              {total_score >= 80 ? '🎉' : total_score >= 60 ? '👍' : '💪'}
            </div>
            <h3 style={{ marginBottom: '12px', color: '#1e293b' }}>
              {total_score >= 80 ? 'Excellent!' : total_score >= 60 ? 'Good Job!' : 'Keep Learning!'}
            </h3>
            <p style={{ color: '#6b7280', lineHeight: '1.6' }}>
              {total_score >= 80 
                ? 'You have a strong understanding of this topic.'
                : total_score >= 60
                ? 'You have a good grasp of the basics. Review the challenging areas.'
                : 'Consider reviewing this topic more thoroughly to strengthen your knowledge.'
              }
            </p>
          </div>

          <div style={{ display: 'flex', gap: '16px', justifyContent: 'center' }}>
            <button
              onClick={() => navigate(`/topics/${topicId}`)}
              style={{
                padding: '14px 32px',
                background: 'linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%)',
                color: 'white',
                border: 'none',
                borderRadius: '8px',
                fontSize: '16px',
                fontWeight: '600',
                cursor: 'pointer',
                boxShadow: '0 4px 12px rgba(139, 92, 246, 0.3)'
              }}
            >
              Back to Topic
            </button>
            
            <button
              onClick={() => navigate('/assessments/history')}
              style={{
                padding: '14px 32px',
                background: 'white',
                color: '#8b5cf6',
                border: '2px solid #8b5cf6',
                borderRadius: '8px',
                fontSize: '16px',
                fontWeight: '600',
                cursor: 'pointer'
              }}
            >
              View All Results
            </button>
          </div>
        </div>
      </DocumentLayout>
    );
  }

  return null;
};

export default TopicQuiz;
