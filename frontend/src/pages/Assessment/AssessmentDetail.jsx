// frontend/src/pages/Assessment/AssessmentDetail.jsx
/**
 * Assessment Detail Page
 * View detailed results with all questions and answers
 */

import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { DocumentLayout } from '../../components/layout';
import { assessmentApi, getErrorMessage } from '../../services/assessmentApi';

const AssessmentDetail = () => {
  const { sessionId } = useParams();
  const navigate = useNavigate();
  
  const [detail, setDetail] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    loadDetail();
  }, [sessionId]);

  const loadDetail = async () => {
    setError('');
    setIsLoading(true);
    
    try {
      const response = await assessmentApi.getAssessmentDetail(sessionId);
      setDetail(response);
    } catch (err) {
      console.error('Failed to load detail:', err);
      setError(getErrorMessage(err));
    } finally {
      setIsLoading(false);
    }
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    try {
      const date = new Date(dateString);
      return date.toLocaleDateString('en-US', { 
        year: 'numeric', 
        month: 'short', 
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch {
      return dateString;
    }
  };

  const getKindLabel = (kind) => {
    switch (kind) {
      case 'global': return 'Global Assessment';
      case 'topic_quiz': return 'Topic Quiz';
      default: return kind;
    }
  };

  const renderAnswer = (item, response) => {
    const { qtype, choices } = item.snapshot;
    const userAnswer = response?.answer || '';
    const isCorrect = response?.is_correct;

    if (qtype === 'single' && choices) {
      return (
        <div style={{ marginTop: '16px' }}>
          {(Array.isArray(choices) ? choices : []).map((choice, idx) => {
            const choiceId = choice.id || choice.label || `opt-${idx}`;
            const choiceLabel = choice.label || choice;
            const isSelected = userAnswer === choiceId;
            
            return (
              <div 
                key={choiceId}
                style={{ 
                  padding: '12px 16px',
                  marginBottom: '8px',
                  border: '2px solid',
                  borderColor: isSelected ? (isCorrect ? '#10b981' : '#ef4444') : '#e2e8f0',
                  borderRadius: '8px',
                  background: isSelected ? (isCorrect ? '#f0fdf4' : '#fef2f2') : 'white',
                  opacity: isSelected ? 1 : 0.7
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  {isSelected && (isCorrect ? '✅' : '❌')}
                  <span>{choiceLabel}</span>
                </div>
              </div>
            );
          })}
        </div>
      );
    }

    if (qtype === 'multi' && choices) {
      const selectedOptions = userAnswer ? userAnswer.split(',') : [];
      
      return (
        <div style={{ marginTop: '16px' }}>
          {(Array.isArray(choices) ? choices : []).map((choice, idx) => {
            const choiceId = choice.id || choice.label || `opt-${idx}`;
            const choiceLabel = choice.label || choice;
            const isSelected = selectedOptions.includes(choiceId);
            
            return (
              <div 
                key={choiceId}
                style={{ 
                  padding: '12px 16px',
                  marginBottom: '8px',
                  border: '2px solid',
                  borderColor: isSelected ? (isCorrect ? '#10b981' : '#ef4444') : '#e2e8f0',
                  borderRadius: '8px',
                  background: isSelected ? (isCorrect ? '#f0fdf4' : '#fef2f2') : 'white',
                  opacity: isSelected ? 1 : 0.7
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  {isSelected && (isCorrect ? '✅' : '❌')}
                  <span>{choiceLabel}</span>
                </div>
              </div>
            );
          })}
        </div>
      );
    }

    if (qtype === 'short') {
      return (
        <div style={{ marginTop: '16px' }}>
          <div style={{ 
            padding: '16px',
            background: isCorrect ? '#f0fdf4' : '#fef2f2',
            border: '2px solid',
            borderColor: isCorrect ? '#10b981' : '#ef4444',
            borderRadius: '8px'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
              {isCorrect ? '✅' : '❌'}
              <strong>Your Answer:</strong>
            </div>
            <p style={{ margin: 0, color: '#1e293b', whiteSpace: 'pre-wrap' }}>
              {userAnswer || '<No answer provided>'}
            </p>
          </div>
        </div>
      );
    }

    return null;
  };

  if (isLoading) {
    return (
      <DocumentLayout title="Loading Results..." lastUpdated="October 18, 2025">
        <div style={{ textAlign: 'center', padding: '60px' }}>
          <div style={{ fontSize: '48px', marginBottom: '16px' }}>⏳</div>
          <p style={{ fontSize: '18px', color: '#6b7280' }}>Loading assessment details...</p>
        </div>
      </DocumentLayout>
    );
  }

  if (error || !detail) {
    return (
      <DocumentLayout title="Error" lastUpdated="October 18, 2025">
        <div style={{ maxWidth: '600px', margin: '0 auto', textAlign: 'center', padding: '60px' }}>
          <div style={{ fontSize: '64px', marginBottom: '24px' }}>❌</div>
          <h2 style={{ marginBottom: '16px', color: '#dc2626' }}>Failed to Load Details</h2>
          <p style={{ marginBottom: '24px', color: '#6b7280' }}>{error || 'Assessment not found.'}</p>
          <button
            onClick={() => navigate('/assessments/history')}
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
            Back to History
          </button>
        </div>
      </DocumentLayout>
    );
  }

  const { session, items_with_responses } = detail;
  const correctCount = items_with_responses?.filter(r => r.response?.is_correct).length || 0;
  const totalCount = items_with_responses?.length || 0;

  return (
    <DocumentLayout title="Assessment Details" lastUpdated="October 18, 2025">
      <div style={{ maxWidth: '900px', margin: '0 auto' }}>
        {/* Header */}
        <div style={{ background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)', color: 'white', padding: '40px', borderRadius: '16px', marginBottom: '32px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <h1 style={{ fontSize: '32px', fontWeight: 'bold', marginBottom: '8px' }}>
                {getKindLabel(session.kind)}
              </h1>
              <p style={{ fontSize: '16px', opacity: 0.9, marginBottom: '16px' }}>
                Submitted: {formatDate(session.submitted_at)}
              </p>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: '48px', fontWeight: 'bold', marginBottom: '4px' }}>
                {Math.round(session.total_score || 0)}%
              </div>
              <div style={{ fontSize: '16px', opacity: 0.9 }}>
                {correctCount} / {totalCount} Correct
              </div>
            </div>
          </div>
        </div>

        {/* AI Summary */}
        {session.ai_summary && (
          <div style={{ background: 'white', padding: '32px', borderRadius: '12px', boxShadow: '0 4px 16px rgba(0, 0, 0, 0.08)', marginBottom: '24px' }}>
            <h3 style={{ color: '#1e293b', marginBottom: '16px' }}>📝 Performance Summary</h3>
            <p style={{ lineHeight: '1.8', color: '#475569', margin: 0 }}>{session.ai_summary}</p>
          </div>
        )}

        {/* AI Recommendations */}
        {session.ai_recommendation && (
          <div style={{ background: 'white', padding: '32px', borderRadius: '12px', boxShadow: '0 4px 16px rgba(0, 0, 0, 0.08)', marginBottom: '32px' }}>
            <h3 style={{ color: '#1e293b', marginBottom: '16px' }}>💡 Personalized Recommendations</h3>
            
            {session.ai_recommendation.level && (
              <div style={{ marginBottom: '20px' }}>
                <strong style={{ color: '#6b7280' }}>Level:</strong>{' '}
                <span style={{ display: 'inline-block', padding: '4px 12px', background: '#eff6ff', color: '#1e40af', borderRadius: '6px', fontWeight: '600', marginLeft: '8px' }}>
                  {session.ai_recommendation.level.charAt(0).toUpperCase() + session.ai_recommendation.level.slice(1)}
                </span>
              </div>
            )}

            {session.ai_recommendation.focus_topics && session.ai_recommendation.focus_topics.length > 0 && (
              <div style={{ marginBottom: '20px' }}>
                <strong style={{ display: 'block', marginBottom: '8px', color: '#6b7280' }}>Focus Topics:</strong>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                  {session.ai_recommendation.focus_topics.map((topic, idx) => (
                    <span key={idx} style={{ padding: '6px 12px', background: '#fef3c7', color: '#92400e', borderRadius: '6px', fontSize: '14px' }}>
                      {topic}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {session.ai_recommendation.suggested_actions && session.ai_recommendation.suggested_actions.length > 0 && (
              <div>
                <strong style={{ display: 'block', marginBottom: '12px', color: '#6b7280' }}>Suggested Actions:</strong>
                <ul style={{ margin: 0, paddingLeft: '20px', color: '#475569', lineHeight: '1.8' }}>
                  {session.ai_recommendation.suggested_actions.map((action, idx) => (
                    <li key={idx}>{action}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}

        {/* Questions & Answers */}
        <div style={{ marginBottom: '32px' }}>
          <h2 style={{ fontSize: '24px', fontWeight: 'bold', color: '#1e293b', marginBottom: '20px' }}>
            📋 All Questions & Answers
          </h2>
          
          {items_with_responses?.map((item, idx) => {
            const isCorrect = item.response?.is_correct;
            
            return (
              <div 
                key={item.item_id}
                style={{ 
                  background: 'white', 
                  padding: '32px', 
                  borderRadius: '12px', 
                  boxShadow: '0 2px 8px rgba(0, 0, 0, 0.05)', 
                  marginBottom: '16px',
                  borderLeft: '4px solid',
                  borderLeftColor: isCorrect ? '#10b981' : '#ef4444'
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px' }}>
                  <h4 style={{ margin: 0, color: '#1e293b' }}>
                    Question {item.order_no}
                  </h4>
                  <div style={{ 
                    padding: '4px 12px', 
                    background: isCorrect ? '#f0fdf4' : '#fef2f2',
                    color: isCorrect ? '#059669' : '#dc2626',
                    borderRadius: '6px',
                    fontSize: '14px',
                    fontWeight: '600'
                  }}>
                    {isCorrect ? '✅ Correct' : '❌ Incorrect'}
                  </div>
                </div>
                
                <p style={{ fontSize: '18px', lineHeight: '1.6', color: '#334155', marginBottom: '8px' }}>
                  {item.snapshot.stem}
                </p>
                
                {renderAnswer(item, item.response)}
              </div>
            );
          })}
        </div>

        {/* Actions */}
        <div style={{ display: 'flex', gap: '16px', justifyContent: 'center', marginBottom: '40px' }}>
          <button
            onClick={() => navigate('/assessments/history')}
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
            Back to History
          </button>
          
          <button
            onClick={() => navigate('/assessments/global')}
            style={{
              padding: '14px 32px',
              background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
              color: 'white',
              border: 'none',
              borderRadius: '8px',
              fontSize: '16px',
              fontWeight: '600',
              cursor: 'pointer',
              boxShadow: '0 4px 12px rgba(16, 185, 129, 0.3)'
            }}
          >
            Take New Assessment
          </button>
        </div>
      </div>
    </DocumentLayout>
  );
};

export default AssessmentDetail;
