// frontend/src/pages/Assessment/AssessmentHistory.jsx
/**
 * Assessment History Page
 * View past assessments with pagination and filtering
 */

import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { DocumentLayout } from '../../components/layout';
import { assessmentApi, getErrorMessage } from '../../services/assessmentApi';

const AssessmentHistory = () => {
  const navigate = useNavigate();
  
  const [assessments, setAssessments] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, limit: 10, total: 0, total_pages: 0, has_next: false });
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const lastUpdatedLabel = new Date().toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
  const totalPagesDisplay =
    pagination.total_pages ||
    Math.ceil((pagination.total || 0) / (pagination.limit || 1)) ||
    1;

  useEffect(() => {
    loadHistory(pagination.page);
  }, []);

  const loadHistory = async (page = 1) => {
    setError('');
    setIsLoading(true);
    
    try {
      const response = await assessmentApi.getAssessmentHistory(page, pagination.limit);
      const items = response?.items || [];
      const rawPagination = response?.pagination || {};
      const currentPage = rawPagination.page ?? page;
      const currentLimit = rawPagination.limit ?? pagination.limit;
      const totalItems = rawPagination.total ?? items.length;
      const totalPages = rawPagination.total_pages ?? Math.max(1, Math.ceil(totalItems / currentLimit));
      const hasNext = rawPagination.has_next ?? currentPage < totalPages;

      setAssessments(items);
      setPagination({
        page: currentPage,
        limit: currentLimit,
        total: totalItems,
        total_pages: totalPages,
        has_next: hasNext,
      });
    } catch (err) {
      console.error('Failed to load history:', err);
      setError(getErrorMessage(err));
    } finally {
      setIsLoading(false);
    }
  };

  const handlePageChange = (newPage) => {
    loadHistory(newPage);
  };

  const handleViewDetail = (sessionId) => {
    navigate(`/assessments/${sessionId}`);
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

  const getKindColor = (kind) => {
    switch (kind) {
      case 'global': return { bg: '#eff6ff', text: '#1e40af' };
      case 'topic_quiz': return { bg: '#f5f3ff', text: '#6b21a8' };
      default: return { bg: '#f3f4f6', text: '#4b5563' };
    }
  };

  const getScoreColor = (score) => {
    if (score >= 80) return '#10b981';
    if (score >= 60) return '#f59e0b';
    return '#ef4444';
  };

  if (isLoading && assessments.length === 0) {
    return (
      <DocumentLayout title="Assessment History" lastUpdated={lastUpdatedLabel}>
        <div style={{ textAlign: 'center', padding: '60px' }}>
          <div style={{ fontSize: '48px', marginBottom: '16px' }}>⏳</div>
          <p style={{ fontSize: '18px', color: '#6b7280' }}>Loading your assessment history...</p>
        </div>
      </DocumentLayout>
    );
  }

  return (
    <DocumentLayout title="Assessment History" lastUpdated={lastUpdatedLabel}>
      <div style={{ maxWidth: '1000px', margin: '0 auto' }}>
        <div style={{ background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)', color: 'white', padding: '40px', borderRadius: '16px', marginBottom: '32px' }}>
          <h1 style={{ fontSize: '32px', fontWeight: 'bold', marginBottom: '8px' }}>
            📊 Assessment History
          </h1>
          <p style={{ fontSize: '18px', opacity: 0.95 }}>
            Review your past assessments and track your progress
          </p>
        </div>

        {error && (
          <div style={{ background: '#fef2f2', border: '1px solid #fecaca', color: '#dc2626', padding: '16px', borderRadius: '8px', marginBottom: '24px' }}>
            <strong>Error:</strong> {error}
          </div>
        )}

        {assessments.length === 0 && !isLoading ? (
          <div style={{ background: 'white', padding: '60px', borderRadius: '12px', textAlign: 'center', boxShadow: '0 4px 16px rgba(0, 0, 0, 0.08)' }}>
            <div style={{ fontSize: '64px', marginBottom: '16px' }}>📝</div>
            <h3 style={{ marginBottom: '12px', color: '#1e293b' }}>No Assessments Yet</h3>
            <p style={{ marginBottom: '24px', color: '#6b7280' }}>
              Start your first assessment to see your results here
            </p>
            <button
              onClick={() => navigate('/assessments/global')}
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
              Start Global Assessment
            </button>
          </div>
        ) : (
          <>
            <div style={{ background: 'white', borderRadius: '12px', boxShadow: '0 4px 16px rgba(0, 0, 0, 0.08)', overflow: 'hidden' }}>
              {assessments.map((assessment) => {
                const kindColor = getKindColor(assessment.kind);
                const scoreColor = getScoreColor(assessment.total_score || 0);
                
                return (
                  <div 
                    key={assessment.session_id}
                    style={{ 
                      borderBottom: '1px solid #e2e8f0',
                      padding: '24px',
                      transition: 'background 0.2s',
                      cursor: 'pointer'
                    }}
                    onClick={() => handleViewDetail(assessment.session_id)}
                    onMouseEnter={(e) => e.currentTarget.style.background = '#f9fafb'}
                    onMouseLeave={(e) => e.currentTarget.style.background = 'white'}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px' }}>
                      <div style={{ flex: 1 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '8px' }}>
                          <span 
                            style={{ 
                              display: 'inline-block',
                              padding: '4px 12px',
                              background: kindColor.bg,
                              color: kindColor.text,
                              borderRadius: '6px',
                              fontSize: '14px',
                              fontWeight: '600'
                            }}
                          >
                            {getKindLabel(assessment.kind)}
                          </span>
                          
                          {assessment.status === 'completed' && (
                            <span style={{ fontSize: '20px', fontWeight: 'bold', color: scoreColor }}>
                              {Math.round(assessment.total_score || 0)}%
                            </span>
                          )}
                          
                          {assessment.status === 'pending' && (
                            <span style={{ color: '#f59e0b', fontSize: '14px', fontWeight: '600' }}>
                              ⏳ In Progress
                            </span>
                          )}
                        </div>
                        
                        <div style={{ color: '#6b7280', fontSize: '14px', marginBottom: '4px' }}>
                          <strong>Submitted:</strong> {formatDate(assessment.submitted_at)}
                        </div>
                        
                        {assessment.kind === 'topic_quiz' && assessment.topic_title && (
                          <div style={{ color: '#6b7280', fontSize: '14px' }}>
                            <strong>Topic:</strong> {assessment.topic_title}
                          </div>
                        )}
                      </div>
                      
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleViewDetail(assessment.session_id);
                        }}
                        style={{
                          padding: '8px 16px',
                          background: 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)',
                          color: 'white',
                          border: 'none',
                          borderRadius: '6px',
                          fontSize: '14px',
                          fontWeight: '600',
                          cursor: 'pointer'
                        }}
                      >
                        View Details →
                      </button>
                    </div>
                    
                    {assessment.ai_summary && (
                      <div style={{ 
                        background: '#f9fafb', 
                        padding: '12px', 
                        borderRadius: '6px', 
                        fontSize: '14px', 
                        color: '#475569',
                        lineHeight: '1.6',
                        marginTop: '12px'
                      }}>
                        {assessment.ai_summary.length > 150 
                          ? `${assessment.ai_summary.substring(0, 150)}...` 
                          : assessment.ai_summary
                        }
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Pagination */}
            {pagination.total > pagination.limit && (
              <div style={{ 
                display: 'flex', 
                justifyContent: 'center', 
                alignItems: 'center', 
                gap: '16px', 
                marginTop: '32px' 
              }}>
                <button
                  onClick={() => handlePageChange(pagination.page - 1)}
                  disabled={pagination.page === 1 || isLoading}
                  style={{
                    padding: '10px 20px',
                    background: (pagination.page === 1 || isLoading) ? '#f3f4f6' : 'white',
                    color: (pagination.page === 1 || isLoading) ? '#9ca3af' : '#3b82f6',
                    border: '2px solid #e2e8f0',
                    borderRadius: '8px',
                    fontSize: '14px',
                    fontWeight: '600',
                    cursor: (pagination.page === 1 || isLoading) ? 'not-allowed' : 'pointer'
                  }}
                >
                  ← Previous
                </button>
                
                <span style={{ color: '#6b7280', fontSize: '14px' }}>
                  Page {pagination.page} of {totalPagesDisplay}
                </span>
                
                <button
                  onClick={() => handlePageChange(pagination.page + 1)}
                  disabled={!pagination.has_next || isLoading}
                  style={{
                    padding: '10px 20px',
                    background: (!pagination.has_next || isLoading) ? '#f3f4f6' : 'white',
                    color: (!pagination.has_next || isLoading) ? '#9ca3af' : '#3b82f6',
                    border: '2px solid #e2e8f0',
                    borderRadius: '8px',
                    fontSize: '14px',
                    fontWeight: '600',
                    cursor: (!pagination.has_next || isLoading) ? 'not-allowed' : 'pointer'
                  }}
                >
                  Next →
                </button>
              </div>
            )}

            <div style={{ textAlign: 'center', marginTop: '32px' }}>
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
                + Take New Assessment
              </button>
            </div>
          </>
        )}
      </div>
    </DocumentLayout>
  );
};

export default AssessmentHistory;
