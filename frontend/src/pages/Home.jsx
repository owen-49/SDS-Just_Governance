import React, { useEffect, useMemo, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { useNavigate } from 'react-router-dom';
import { Header, Sidebar } from '../components/layout';
import { Modal } from '../components/ui';
import { GlobalChat } from '../components/features';
import { dbApi } from '../services/localDb';
import { sections as fallbackSections } from '../constants/structure';
import { aiAsk } from '../services/api';
import { learningApi } from '../services/learning';

function buildTopicIndex(structure) {
  const index = {};
  structure.forEach((section) => {
    (section.modules || []).forEach((module) => {
      (module.topics || []).forEach((topic) => {
        index[topic.id] = { section, module, topic };
      });
    });
  });
  return index;
}

// TopicPage Component - handles individual topic views
function TopicPage({ topicId, topicRef, source, email, onBack }) {
  const { section, module, topic } = topicRef || {};
  const isApiSource = source === 'api';
  const createEmptyProgress = learningApi.createEmptyProgress;
  const mergeProgress = learningApi.mergeProgress;
  const [tab, setTab] = useState('content');
  const [chat, setChat] = useState(() => dbApi.topicChat(email, topicId));
  const [progress, setProgress] = useState(() => (isApiSource ? createEmptyProgress() : dbApi.topicProgress(email, topicId)));
  const [topicMeta, setTopicMeta] = useState(topic || null);
  const [content, setContent] = useState(null);
  const [loading, setLoading] = useState(isApiSource);
  const [error, setError] = useState(null);
  const [completeError, setCompleteError] = useState(null);
  const [completing, setCompleting] = useState(false);
  const [ragQuery, setRagQuery] = useState('');
  const [ragResults, setRagResults] = useState([]);
  const [ragLoading, setRagLoading] = useState(false);
  const [ragError, setRagError] = useState(null);
  const [quizData, setQuizData] = useState(null);
  const [quizAnswers, setQuizAnswers] = useState({});
  const [quizLoading, setQuizLoading] = useState(false);
  const [quizError, setQuizError] = useState(null);
  const [quizResult, setQuizResult] = useState(null);

  useEffect(() => {
    setChat(dbApi.topicChat(email, topicId));
  }, [email, topicId]);

  useEffect(() => {
    setTopicMeta(topic || null);
  }, [topic]);

  useEffect(() => {
    setContent(null);
    setError(null);
    setCompleteError(null);
    if (isApiSource) {
      setProgress(createEmptyProgress());
    } else {
      setProgress(dbApi.topicProgress(email, topicId));
    }
    setRagQuery('');
    setRagResults([]);
    setRagError(null);
    setQuizData(null);
    setQuizAnswers({});
    setQuizError(null);
    setQuizResult(null);
  }, [topicId, email, isApiSource]);

  useEffect(() => {
    dbApi.saveTopicChat(email, topicId, chat);
  }, [email, topicId, chat]);

  useEffect(() => {
    if (!isApiSource) {
      dbApi.saveTopicProgress(email, topicId, progress);
    }
  }, [email, topicId, progress, isApiSource]);

  useEffect(() => {
    if (isApiSource) return;
    setProgress(prev => ({
      ...prev,
      lastVisitedAt: Date.now()
    }));
  }, [topicId, isApiSource]);

  useEffect(() => {
    if (!isApiSource || !topicId) return;
    if (progress.quizState !== 'pending' || quizData || quizLoading) return;

    let cancelled = false;
    setQuizLoading(true);
    setQuizError(null);

    (async () => {
      try {
        const data = await learningApi.startTopicQuiz(topicId);
        if (cancelled) return;
        setQuizData(data);
        setQuizAnswers({});
        if (data?.progress) {
          setProgress(prev => mergeProgress(prev, data.progress));
        }
      } catch (err) {
        if (!cancelled) {
          setQuizError(err?.body?.message || err?.message || 'Unable to load quiz.');
        }
      } finally {
        if (!cancelled) {
          setQuizLoading(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [isApiSource, topicId, progress.quizState, quizData, quizLoading, mergeProgress]);

  useEffect(() => {
    if (!isApiSource || !topicId) return;
    let cancelled = false;
    setLoading(true);
    setError(null);

    (async () => {
      try {
        // 使用 allSettled 避免单个请求失败影响其他请求
        const results = await Promise.allSettled([
          learningApi.getTopicDetail(topicId),
          learningApi.getTopicProgress(topicId),
          learningApi.getTopicContent(topicId)
        ]);

        if (cancelled) return;

        const [detailResult, progressResult, contentResult] = results;
        
        // 处理 detail
        if (detailResult.status === 'fulfilled' && detailResult.value?.topic) {
          setTopicMeta(prev => {
            const normalized = learningApi.normalizeTopic(detailResult.value.topic) || {};
            return {
              ...(prev || {}),
              ...normalized,
              raw: detailResult.value.topic,
            };
          });
        }

        // 处理 progress
        const detail = detailResult.status === 'fulfilled' ? detailResult.value : null;
        const progressData = progressResult.status === 'fulfilled' ? progressResult.value : null;
        setProgress(mergeProgress(detail?.progress_summary, progressData));

        // 处理 content
        if (contentResult.status === 'fulfilled' && contentResult.value) {
          const resources = learningApi.normalizeResourceList(contentResult.value.resources);
          setContent({
            body: contentResult.value.body_markdown || '',
            summary: contentResult.value.summary || '',
            resources,
          });
        } else {
          setContent(null);
        }
        
        // 如果所有请求都失败，设置错误
        if (results.every(r => r.status === 'rejected')) {
          setError(results[0].reason);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err);
          setProgress(createEmptyProgress());
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }

      // 访问记录 - 独立处理，失败不影响主流程
      try {
        await learningApi.visitTopic(topicId);
        if (!cancelled) {
          setProgress(prev => ({
            ...prev,
            status: prev.status === 'not_started' ? 'in_progress' : prev.status,
            lastVisitedAt: new Date().toISOString(),
          }));
        }
      } catch {
        // 静默失败
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [topicId, isApiSource]);

  const topicData = topicMeta || topic || null;

  const formatDateTime = (value) => {
    if (!value) return '—';
    const date = typeof value === 'number' ? new Date(value) : new Date(value);
    if (Number.isNaN(date.getTime())) return '—';
    return date.toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const formatScore = (score) => {
    if (score === null || score === undefined) return 'Not attempted yet';
    if (typeof score === 'number') {
      if (score <= 1) return `${Math.round(score * 100)}%`;
      if (score <= 100) return `${Math.round(score)}%`;
    }
    return String(score);
  };

  const keyPoints = useMemo(() => {
    if (!isApiSource) return topicData?.keyPoints || [];
    if (!content?.summary) return [];
    if (Array.isArray(content.summary)) return content.summary;
    if (typeof content.summary === 'string') {
      return content.summary
        .split(/\n+/)
        .map(line => line.replace(/^[-*]\s*/, '').trim())
        .filter(Boolean);
    }
    return [];
  }, [isApiSource, content, topicData]);

  const approxMinutes = useMemo(() => {
    const baseText = [
      content?.body,
      content?.summary,
      topicData?.content,
      topicData?.intro
    ]
      .filter(Boolean)
      .join(' ')
      .trim();
    const wordCount = baseText ? baseText.split(/\s+/).filter(Boolean).length : 0;
    const readingMinutes = Math.ceil(wordCount / 180) || 3;
    const keyPointBonus = keyPoints.length * 2;
    return Math.min(30, Math.max(5, readingMinutes + keyPointBonus));
  }, [content, topicData, keyPoints]);

  const contentMarkdown = useMemo(() => {
    if (content?.body) return content.body;
    if (topicData?.content) return topicData.content;
    const sections = [];
    const overview = content?.summary || topicData?.intro;
    if (overview) sections.push(`### Overview\n${overview}`);
    if (keyPoints.length) {
      sections.push(`### Key Points\n${keyPoints.map(point => `- ${point}`).join('\n')}`);
    }
    return sections.join('\n\n') || `Content for ${topicData?.name || 'this topic'} is being developed.`;
  }, [content, topicData, keyPoints]);

  const resources = useMemo(() => {
    if (isApiSource) {
      return Array.isArray(content?.resources) ? content.resources : [];
    }
    return Array.isArray(topicData?.resources) ? topicData.resources : [];
  }, [content, isApiSource, topicData]);

  const scoreValue = isApiSource
    ? (progress.lastScore ?? progress.bestScore)
    : progress.lastScore;

  const scoreLabel = formatScore(scoreValue);
  const lastVisitedLabel = formatDateTime(progress.lastVisitedAt);
  const completedAtLabel = formatDateTime(progress.completedAt);
  const passThresholdLabel = (() => {
    const value = topicData?.passThreshold;
    if (value === null || value === undefined) return '—';
    const numeric = Number(value);
    if (!Number.isFinite(numeric)) return '—';
    return `${Math.round(numeric * 100)}%`;
  })();

  const completed = isApiSource
    ? progress.markedComplete || progress.status === 'completed'
    : Boolean(progress.completed);

  const status = isApiSource
    ? (completed ? 'Completed' : progress.status === 'in_progress' ? 'In progress' : 'Not started')
    : completed
      ? 'Completed'
      : progress.lastScore !== null && progress.lastScore !== undefined
        ? 'In progress'
        : 'Not started';

  const statusColor = status === 'Completed'
    ? '#10b981'
    : status === 'In progress'
      ? '#2563eb'
      : '#64748b';

  const isEligibleForQuiz = isApiSource ? progress.status !== 'not_started' : Boolean(progress.eligible);

  const markComplete = async () => {
    if (!topicData) return;
    if (!isApiSource) {
      setProgress(prev => ({ ...prev, completed: true, completedAt: Date.now() }));
      return;
    }

    setCompleting(true);
    setCompleteError(null);
    try {
      const result = await learningApi.completeTopic(topicId);
      setProgress(prev => ({
        ...prev,
        status: 'completed',
        markedComplete: true,
        completedAt: result?.completed_at || new Date().toISOString(),
      }));
    } catch (err) {
      if (err?.status === 409) {
        const message = err?.body?.message;
        if (message?.includes('already_marked_complete')) {
          setCompleteError('This topic is already marked as complete.');
        } else {
          const threshold = err?.body?.data?.pass_threshold;
          setCompleteError(
            threshold !== undefined
              ? `Your score (${scoreLabel}) is below the required threshold (${Math.round(Number(threshold) * 100)}%). Please complete the quiz first.`
              : 'Please complete the quiz before marking this topic as complete.'
          );
        }
      } else if (err?.status === 404) {
        setCompleteError('This topic no longer exists.');
      } else {
        setCompleteError(err.message || 'Failed to mark topic complete. Please try again.');
      }
    } finally {
      setCompleting(false);
    }
  };

  const handleRagSubmit = async (event) => {
    event?.preventDefault();
    const query = ragQuery.trim();
    if (!query) {
      setRagResults([]);
      return;
    }
    setRagLoading(true);
    setRagError(null);
    try {
      const result = await learningApi.searchTopicRag(topicId, query, { limit: 5 });
      setRagResults(result?.results ?? []);
    } catch (err) {
      setRagError(err?.body?.message || err?.message || 'Unable to search supporting materials.');
    } finally {
      setRagLoading(false);
    }
  };

  const handleStartQuiz = async () => {
    if (!topicId) return;
    setQuizLoading(true);
    setQuizError(null);
    setQuizResult(null);
    try {
      const data = await learningApi.startTopicQuiz(topicId);
      setQuizData(data);
      setQuizAnswers({});
      if (data?.progress) {
        setProgress(prev => mergeProgress(prev, data.progress));
      }
    } catch (err) {
      setQuizError(err?.body?.message || err?.message || 'Unable to start the quiz.');
    } finally {
      setQuizLoading(false);
    }
  };

  const handleOptionChange = (question, optionId) => {
    const key = question.item_id;
    setQuizAnswers(prev => {
      if (question.qtype === 'multi') {
        const current = Array.isArray(prev[key]) ? prev[key] : [];
        const next = current.includes(optionId)
          ? current.filter(value => value !== optionId)
          : [...current, optionId];
        return { ...prev, [key]: next };
      }
      return { ...prev, [key]: optionId };
    });
  };

  const isOptionSelected = (question, optionId) => {
    const value = quizAnswers[question.item_id];
    if (question.qtype === 'multi') {
      return Array.isArray(value) && value.includes(optionId);
    }
    return value === optionId;
  };

  const allQuestionsAnswered = quizData
    ? quizData.questions.every(question => {
        const value = quizAnswers[question.item_id];
        if (question.qtype === 'multi') {
          return Array.isArray(value) && value.length > 0;
        }
        return typeof value === 'string' && value;
      })
    : false;

  const handleSubmitQuiz = async () => {
    if (!quizData) return;
    setQuizLoading(true);
    setQuizError(null);
    try {
      const result = await learningApi.submitTopicQuiz(topicId, quizData.quiz_session_id, quizAnswers);
      setQuizResult(result);
      setQuizData(null);
      setQuizAnswers({});
      if (result?.progress) {
        setProgress(prev => mergeProgress(prev, result.progress));
      }
    } catch (err) {
      setQuizError(err?.body?.message || err?.message || 'Unable to submit the quiz.');
    } finally {
      setQuizLoading(false);
    }
  };

  const errorMessage = error?.body?.message || error?.message;

  if (!topicData && loading) {
    return (
      <div style={{ 
        padding: 40, 
        display: 'flex', 
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '400px',
        gap: 16
      }}>
        <div style={{ 
          width: 48, 
          height: 48, 
          border: '4px solid #e5e7eb',
          borderTopColor: '#3b82f6',
          borderRadius: '50%',
          animation: 'spin 1s linear infinite'
        }} />
        <p style={{ color: '#6b7280', fontSize: 14 }}>Loading topic content...</p>
      </div>
    );
  }

  if (!topicData) {
    return (
      <div style={{ 
        padding: 40, 
        textAlign: 'center',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '400px',
        gap: 16
      }}>
        <div style={{ fontSize: 48, opacity: 0.5 }}>📚</div>
        <h2 style={{ margin: 0, color: '#1f2937' }}>Topic not found</h2>
        <p style={{ margin: '8px 0', color: '#6b7280' }}>
          {error ? 'Unable to load this topic. It may have been removed or you may not have access.' : 'This topic doesn\'t exist.'}
        </p>
        <button 
          onClick={onBack} 
          style={{ 
            padding: '10px 20px', 
            marginTop: 12,
            background: '#3b82f6',
            color: 'white',
            border: 'none',
            borderRadius: 8,
            cursor: 'pointer',
            fontSize: 14,
            fontWeight: 500
          }}
        >
          ← Back to Home
        </button>
      </div>
    );
  }

  return (
    <div style={{ height: '100vh', display: 'flex', flexDirection: 'column', backgroundColor: '#f8fafc' }}>
      {/* Topic Header - 响应式优化 */}
      <div style={{ 
        background: 'linear-gradient(135deg, #ffffff 0%, #f8fafc 100%)',
        borderBottom: '1px solid rgba(226, 232, 240, 0.8)',
        boxShadow: '0 2px 8px rgba(0, 0, 0, 0.04)',
        padding: 'clamp(16px, 4vw, 24px) clamp(16px, 4vw, 32px)'
      }}>
        {/* Top Row: Back Button + Breadcrumb + Status */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 'clamp(12px, 3vw, 20px)', flexWrap: 'wrap', gap: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 'clamp(8px, 2vw, 16px)', flexWrap: 'wrap' }}>
            <button 
              onClick={onBack}
              style={{
                background: 'rgba(34, 197, 94, 0.1)',
                border: '1px solid rgba(34, 197, 94, 0.2)',
                borderRadius: '8px',
                padding: '10px 16px',
                cursor: 'pointer',
                fontSize: 'clamp(13px, 2vw, 14px)',
                color: '#059669',
                fontWeight: '500',
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                transition: 'all 0.2s ease'
              }}
              onMouseOver={(e) => {
                e.target.style.background = 'rgba(34, 197, 94, 0.15)';
                e.target.style.transform = 'translateY(-1px)';
              }}
              onMouseOut={(e) => {
                e.target.style.background = 'rgba(34, 197, 94, 0.1)';
                e.target.style.transform = 'translateY(0)';
              }}
            >
              <span>←</span>
              <span>Back</span>
            </button>
            
            {/* Breadcrumb */}
            <div style={{ 
              display: 'flex', 
              alignItems: 'center', 
              gap: 8,
              fontSize: 'clamp(12px, 2vw, 14px)', 
              color: '#64748b',
              fontWeight: '500',
              flexWrap: 'wrap'
            }}>
              <span>{section?.name?.replace(/^📚\s*/, '')}</span>
              <span style={{ color: '#cbd5e1' }}>→</span>
              <span>{module?.name?.replace(/^📦\s*/, '')}</span>
            </div>
          </div>
          
          {completed && (
            <div style={{
              background: 'linear-gradient(135deg, #10b981, #059669)',
              color: 'white',
              padding: '6px 12px',
              borderRadius: '16px',
              fontSize: 'clamp(11px, 2vw, 12px)',
              fontWeight: '600',
              display: 'flex',
              alignItems: 'center',
              gap: 4,
              boxShadow: '0 2px 8px rgba(16, 185, 129, 0.2)'
            }}>
              <span>✓</span>
              <span>Completed</span>
            </div>
          )}
        </div>

        {/* Title */}
        <h1 style={{ 
          fontSize: 'clamp(24px, 5vw, 32px)', 
          fontWeight: '700', 
          margin: '0 0 clamp(12px, 3vw, 20px) 0', 
          background: 'linear-gradient(135deg, #0f172a 0%, #334155 100%)',
          WebkitBackgroundClip: 'text',
          WebkitTextFillColor: 'transparent',
          backgroundClip: 'text',
          lineHeight: '1.2'
        }}>
          {topicData.name}
        </h1>

        {/* Tab Navigation - 移动端可横向滚动 */}
        <div style={{ display: 'flex', gap: 'clamp(4px, 1vw, 8px)', overflowX: 'auto', WebkitOverflowScrolling: 'touch', paddingBottom: 4 }}>
          {[
            { key: 'content', label: 'Content', icon: '📖' },
            { key: 'conversation', label: 'Discussion', icon: '💬' },
            { key: 'scenario', label: 'Practice', icon: '🎯' }
          ].map(({ key, label, icon }) => (
            <button
              key={key}
              onClick={() => setTab(key)}
              style={{
                padding: 'clamp(8px, 2vw, 10px) clamp(12px, 3vw, 16px)',
                background: tab === key 
                  ? 'linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)' 
                  : 'rgba(37, 99, 235, 0.1)',
                color: tab === key ? 'white' : '#2563eb',
                border: tab === key 
                  ? 'none' 
                  : '1px solid rgba(37, 99, 235, 0.2)',
                borderRadius: '8px',
                cursor: 'pointer',
                fontSize: 'clamp(12px, 2vw, 14px)',
                fontWeight: '600',
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                transition: 'all 0.2s ease',
                boxShadow: tab === key ? '0 4px 12px rgba(37, 99, 235, 0.3)' : 'none',
                whiteSpace: 'nowrap',
                flexShrink: 0
              }}
              onMouseOver={(e) => {
                if (tab !== key) {
                  e.target.style.background = 'rgba(37, 99, 235, 0.15)';
                  e.target.style.transform = 'scale(1.05)';
                }
              }}
              onMouseOut={(e) => {
                if (tab !== key) {
                  e.target.style.background = 'rgba(37, 99, 235, 0.1)';
                  e.target.style.transform = 'scale(1)';
                }
              }}
            >
              <span>{icon}</span>
              <span>{label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Tab Content */}
      <div style={{ flex: 1, overflow: 'auto' }}>
        {error && (
          <div style={{
            padding: '16px 40px',
            margin: '0 auto',
            maxWidth: 960,
            color: '#991b1b',
            background: '#fee2e2',
            borderBottom: '1px solid #fecaca',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 16
          }}>
            <div style={{ flex: 1 }}>
              <strong style={{ display: 'block', marginBottom: 4 }}>Unable to load complete topic data</strong>
              <span style={{ fontSize: 14 }}>{errorMessage || 'Showing cached or partial information.'}</span>
            </div>
            {error?.type === 'network_error' && (
              <button
                onClick={() => window.location.reload()}
                style={{
                  padding: '8px 16px',
                  background: '#dc2626',
                  color: 'white',
                  border: 'none',
                  borderRadius: 6,
                  cursor: 'pointer',
                  fontSize: 13,
                  fontWeight: 500,
                  whiteSpace: 'nowrap'
                }}
              >
                Retry
              </button>
            )}
          </div>
        )}

        {tab === 'content' && (
          <div style={{
            padding: 'clamp(20px, 5vw, 36px) clamp(16px, 5vw, 40px)',
            maxWidth: 960,
            margin: '0 auto',
            display: 'flex',
            flexDirection: 'column',
            gap: 'clamp(16px, 3vw, 24px)',
            width: '100%',
            boxSizing: 'border-box'
          }}>
            <section style={{
              background: 'linear-gradient(135deg, #1d4ed8 0%, #0ea5e9 100%)',
              color: '#f8fafc',
              padding: 'clamp(20px, 5vw, 32px)',
              borderRadius: 'clamp(16px, 3vw, 24px)',
              boxShadow: '0 16px 36px rgba(14,165,233,0.25)',
              position: 'relative',
              overflow: 'hidden'
            }}>
              <div style={{ position: 'absolute', inset: 0, opacity: 0.1, background: 'radial-gradient(circle at top right, #ffffff 0%, transparent 60%)' }} />
              <div style={{ position: 'relative', display: 'flex', flexDirection: 'column', gap: 'clamp(16px, 3vw, 24px)' }}>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12 }}>
                  {section?.name && (
                    <span style={{
                      backgroundColor: 'rgba(15, 23, 42, 0.25)',
                      borderRadius: 999,
                      padding: '6px 12px',
                      fontSize: 12,
                      letterSpacing: 0.4,
                      textTransform: 'uppercase'
                    }}>
                      {section.name.replace(/^📚\s*/, '')}
                    </span>
                  )}
                  {module?.name && (
                    <span style={{
                      backgroundColor: 'rgba(15, 23, 42, 0.18)',
                      borderRadius: 999,
                      padding: '6px 12px',
                      fontSize: 12,
                      letterSpacing: 0.4,
                      textTransform: 'uppercase'
                    }}>
                      {module.name.replace(/^📦\s*/, '')}
                    </span>
                  )}
                </div>
                <div>
                  <h2 style={{
                    margin: 0,
                    fontSize: 'clamp(24px, 5vw, 32px)',
                    fontWeight: 700,
                    letterSpacing: -0.5
                  }}>
                    {topicData.name}
                  </h2>
                  <p style={{
                    marginTop: 12,
                    marginBottom: 0,
                    maxWidth: 640,
                    lineHeight: 1.6,
                    fontSize: 'clamp(14px, 3vw, 16px)',
                    color: 'rgba(248,250,252,0.9)'
                  }}>
                    {topicData?.intro || content?.summary || 'Content for this topic is being developed.'}
                  </p>
                </div>
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
                  gap: 'clamp(12px, 2vw, 16px)'
                }}>
                  <div style={{
                    backgroundColor: 'rgba(15, 23, 42, 0.28)',
                    borderRadius: 16,
                    padding: '16px 18px'
                  }}>
                    <div style={{ fontSize: 12, opacity: 0.8, textTransform: 'uppercase', letterSpacing: 0.6 }}>Focus area</div>
                    <div style={{ fontSize: 18, fontWeight: 600, marginTop: 6 }}>{module?.name || 'Governance Essentials'}</div>
                  </div>
                  <div style={{
                    backgroundColor: 'rgba(15, 23, 42, 0.22)',
                    borderRadius: 16,
                    padding: '16px 18px'
                  }}>
                    <div style={{ fontSize: 12, opacity: 0.8, textTransform: 'uppercase', letterSpacing: 0.6 }}>Time investment</div>
                    <div style={{ fontSize: 18, fontWeight: 600, marginTop: 6 }}>{approxMinutes} min</div>
                  </div>
                  <div style={{
                    backgroundColor: 'rgba(15, 23, 42, 0.22)',
                    borderRadius: 16,
                    padding: '16px 18px'
                  }}>
                    <div style={{ fontSize: 12, opacity: 0.8, textTransform: 'uppercase', letterSpacing: 0.6 }}>Learning status</div>
                    <div style={{
                      marginTop: 6,
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 8,
                      fontWeight: 600,
                      fontSize: 16
                    }}>
                      <span style={{
                        display: 'inline-block',
                        width: 10,
                        height: 10,
                        borderRadius: '50%',
                        backgroundColor: statusColor
                      }} />
                      <span>{status}</span>
                    </div>
                  </div>
                </div>
              </div>
            </section>

            {isApiSource && (
              <section style={{
                backgroundColor: '#ffffff',
                borderRadius: 20,
                padding: 28,
                boxShadow: '0 12px 30px rgba(15,23,42,0.08)'
              }}>
                <div style={{ marginBottom: 16 }}>
                  <h3 style={{ margin: 0, fontSize: 22, color: '#0f172a', textAlign: 'left' }}>Topic knowledge base</h3>
                  <p style={{ margin: '6px 0 0', color: '#64748b', fontSize: 14 }}>
                    Search curated evidence tied to this topic to strengthen your understanding.
                  </p>
                </div>
                <form
                  onSubmit={handleRagSubmit}
                  style={{ display: 'flex', flexWrap: 'wrap', gap: 12, marginBottom: 16 }}
                >
                  <input
                    type="text"
                    value={ragQuery}
                    onChange={(event) => setRagQuery(event.target.value)}
                    placeholder="e.g. stakeholder transparency"
                    style={{
                      flex: '1 1 260px',
                      padding: '12px 16px',
                      borderRadius: 12,
                      border: '1px solid #dbeafe',
                      fontSize: 14,
                      background: '#f8fafc',
                    }}
                  />
                  <button
                    type="submit"
                    disabled={ragLoading}
                    style={{
                      padding: '12px 18px',
                      borderRadius: 12,
                      border: 'none',
                      background: ragLoading ? '#93c5fd' : '#2563eb',
                      color: '#fff',
                      fontWeight: 600,
                      cursor: ragLoading ? 'not-allowed' : 'pointer',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 8,
                    }}
                  >
                    {ragLoading ? 'Searching…' : 'Search'}
                  </button>
                </form>
                {ragError && (
                  <div
                    style={{
                      marginBottom: 12,
                      padding: '12px 16px',
                      borderRadius: 12,
                      background: '#fee2e2',
                      color: '#991b1b',
                      fontSize: 13,
                    }}
                  >
                    {ragError}
                  </div>
                )}
                {ragLoading ? (
                  <div style={{ color: '#64748b', fontSize: 14 }}>Gathering the most relevant passages…</div>
                ) : ragResults.length > 0 ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                    {ragResults.map((result, idx) => (
                      <div
                        key={result.chunk_id || idx}
                        style={{
                          border: '1px solid #e2e8f0',
                          borderRadius: 16,
                          padding: 20,
                          background: '#f8fafc',
                          boxShadow: '0 6px 18px rgba(15,23,42,0.08)'
                        }}
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 12, flexWrap: 'wrap' }}>
                          <div style={{ fontWeight: 600, color: '#0f172a' }}>
                            {result.document_title || `Supporting detail #${(result.chunk_index ?? idx) + 1}`}
                          </div>
                          <span style={{ fontSize: 12, color: '#64748b' }}>
                            Match score {(Math.min(1, Math.max(0, result.score || 0)) * 100).toFixed(1)}%
                          </span>
                        </div>
                        <p style={{ margin: '10px 0 0', lineHeight: 1.6, color: '#334155' }}>{result.content}</p>
                        {result.source && (
                          <a
                            href={result.source}
                            target="_blank"
                            rel="noreferrer"
                            style={{
                              marginTop: 12,
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: 6,
                              fontSize: 13,
                              color: '#1d4ed8',
                              textDecoration: 'none'
                            }}
                          >
                            View source ↗
                          </a>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <p style={{ margin: 0, color: '#94a3b8', fontSize: 14 }}>
                    {ragQuery ? 'No supporting passages matched this prompt yet.' : 'Ask a question or search a keyword to surface context-rich references.'}
                  </p>
                )}
              </section>
            )}

            {isApiSource && (
              <section style={{
                backgroundColor: '#ffffff',
                borderRadius: 20,
                padding: 28,
                boxShadow: '0 12px 30px rgba(15,23,42,0.08)'
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 16 }}>
                  <div>
                    <h3 style={{ margin: 0, fontSize: 22, color: '#0f172a', textAlign: 'left' }}>Topic quiz</h3>
                    <p style={{ margin: '6px 0 0', color: '#64748b', fontSize: 14 }}>
                      Earn at least {passThresholdLabel} to mark the topic as complete.
                    </p>
                  </div>
                  <div style={{ fontSize: 13, color: '#475569', fontWeight: 600 }}>
                    Best score: {formatScore(progress.bestScore)} · Attempts: {progress.attemptCount}
                  </div>
                </div>

                {quizError && (
                  <div style={{
                    marginTop: 12,
                    padding: '12px 16px',
                    borderRadius: 12,
                    background: '#fee2e2',
                    color: '#991b1b',
                    fontSize: 13,
                  }}>
                    {quizError}
                  </div>
                )}

                {quizResult && (
                  <div style={{
                    marginTop: 16,
                    padding: '16px 18px',
                    borderRadius: 16,
                    background: quizResult.passed ? '#ecfdf5' : '#fef2f2',
                    border: `1px solid ${quizResult.passed ? 'rgba(16,185,129,0.3)' : 'rgba(248,113,113,0.3)'}`,
                    color: quizResult.passed ? '#047857' : '#b91c1c',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 6,
                    fontSize: 14,
                  }}>
                    <strong>Latest attempt: {formatScore(quizResult.score)}</strong>
                    <span>
                      {quizResult.passed
                        ? 'Great work! You reached the required threshold.'
                        : 'Keep practising—review the topic and try again.'}
                    </span>
                    <span style={{ fontSize: 12, color: quizResult.passed ? '#059669' : '#b45309' }}>
                      Best score so far: {formatScore(quizResult.best_score)} · Attempts: {quizResult.attempt_count}
                    </span>
                  </div>
                )}

                {quizData ? (
                  <div style={{ marginTop: 20, display: 'flex', flexDirection: 'column', gap: 18 }}>
                    {quizData.questions.map((question) => (
                      <div
                        key={question.item_id}
                        style={{
                          border: '1px solid #e2e8f0',
                          borderRadius: 18,
                          padding: 20,
                          background: '#f8fafc',
                        }}
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 16, flexWrap: 'wrap' }}>
                          <h4 style={{ margin: 0, fontSize: 18, color: '#0f172a' }}>Question {question.order}</h4>
                          <span style={{ fontSize: 12, color: '#94a3b8' }}>
                            {question.qtype === 'multi' ? 'Select all that apply' : 'Choose one answer'}
                          </span>
                        </div>
                        <p style={{ margin: '10px 0 16px', color: '#334155', lineHeight: 1.6 }}>{question.stem}</p>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                          {(question.choices || []).map((choice) => (
                            <label
                              key={choice.id}
                              style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: 10,
                                padding: '12px 14px',
                                borderRadius: 12,
                                border: isOptionSelected(question, choice.id) ? '2px solid #2563eb' : '1px solid #e2e8f0',
                                background: isOptionSelected(question, choice.id) ? 'rgba(37,99,235,0.08)' : '#fff',
                                cursor: quizLoading ? 'not-allowed' : 'pointer',
                              }}
                            >
                              <input
                                type={question.qtype === 'multi' ? 'checkbox' : 'radio'}
                                name={`quiz-${question.item_id}`}
                                value={choice.id}
                                checked={isOptionSelected(question, choice.id)}
                                onChange={() => handleOptionChange(question, choice.id)}
                                disabled={quizLoading}
                                style={{ width: 16, height: 16 }}
                              />
                              <span style={{ fontSize: 14, color: '#0f172a' }}>
                                {choice.label || choice.title || choice.text || choice.id}
                              </span>
                            </label>
                          ))}
                        </div>
                      </div>
                    ))}

                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
                      <span style={{ fontSize: 13, color: '#64748b' }}>
                        {allQuestionsAnswered ? 'Ready when you are!' : 'Answer every question to enable submission.'}
                      </span>
                      <div style={{ display: 'flex', gap: 12 }}>
                        <button
                          type="button"
                          onClick={() => {
                            setQuizData(null);
                            setQuizAnswers({});
                          }}
                          disabled={quizLoading}
                          style={{
                            padding: '10px 16px',
                            borderRadius: 10,
                            border: '1px solid #cbd5f5',
                            background: '#fff',
                            color: '#1e3a8a',
                            fontWeight: 600,
                            cursor: quizLoading ? 'not-allowed' : 'pointer',
                          }}
                        >
                          Cancel
                        </button>
                        <button
                          type="button"
                          onClick={handleSubmitQuiz}
                          disabled={quizLoading || !allQuestionsAnswered}
                          style={{
                            padding: '10px 18px',
                            borderRadius: 10,
                            border: 'none',
                            background: quizLoading || !allQuestionsAnswered ? '#93c5fd' : '#2563eb',
                            color: '#fff',
                            fontWeight: 600,
                            cursor: quizLoading || !allQuestionsAnswered ? 'not-allowed' : 'pointer',
                          }}
                        >
                          {quizLoading ? 'Submitting…' : 'Submit quiz'}
                        </button>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div style={{
                    marginTop: 24,
                    background: 'linear-gradient(135deg, #eff6ff 0%, #dbeafe 100%)',
                    borderRadius: 20,
                    padding: '28px 32px',
                    border: '2px solid #bfdbfe',
                    position: 'relative',
                    overflow: 'hidden'
                  }}>
                    {/* 装饰性背景 */}
                    <div style={{
                      position: 'absolute',
                      top: -50,
                      right: -50,
                      width: 200,
                      height: 200,
                      background: 'radial-gradient(circle, rgba(59,130,246,0.15) 0%, transparent 70%)',
                      borderRadius: '50%',
                      pointerEvents: 'none'
                    }} />
                    
                    <div style={{ 
                      display: 'flex', 
                      alignItems: 'center', 
                      gap: 20, 
                      flexWrap: 'wrap',
                      position: 'relative',
                      zIndex: 1
                    }}>
                      {/* 图标 */}
                      <div style={{
                        width: 56,
                        height: 56,
                        borderRadius: 16,
                        background: 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: 28,
                        boxShadow: '0 8px 20px rgba(59,130,246,0.3)',
                        flexShrink: 0
                      }}>
                        📝
                      </div>
                      
                      {/* 文字内容 */}
                      <div style={{ flex: 1, minWidth: 280 }}>
                        <h4 style={{ 
                          margin: '0 0 8px 0', 
                          fontSize: 18, 
                          fontWeight: 700, 
                          color: '#0f172a',
                          letterSpacing: -0.2
                        }}>
                          {isEligibleForQuiz ? 'Ready to test your knowledge?' : 'Quiz locked'}
                        </h4>
                        <p style={{ 
                          margin: 0, 
                          fontSize: 14, 
                          color: '#475569',
                          lineHeight: 1.6
                        }}>
                          {isEligibleForQuiz
                            ? 'Take the short quiz to lock in your learning. You can retry as many times as you like.'
                            : 'Review the topic content first, then come back for a quick knowledge check.'}
                        </p>
                      </div>
                      
                      {/* 按钮 */}
                      <button
                        type="button"
                        onClick={handleStartQuiz}
                        disabled={!isEligibleForQuiz || quizLoading}
                        style={{
                          padding: '14px 28px',
                          borderRadius: 12,
                          border: 'none',
                          background: !isEligibleForQuiz || quizLoading 
                            ? 'linear-gradient(135deg, #cbd5e1 0%, #94a3b8 100%)' 
                            : 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)',
                          color: '#fff',
                          fontSize: 15,
                          fontWeight: 700,
                          cursor: !isEligibleForQuiz || quizLoading ? 'not-allowed' : 'pointer',
                          boxShadow: !isEligibleForQuiz || quizLoading 
                            ? 'none' 
                            : '0 8px 20px rgba(37,99,235,0.35)',
                          transition: 'all 0.3s ease',
                          display: 'flex',
                          alignItems: 'center',
                          gap: 8,
                          whiteSpace: 'nowrap',
                          letterSpacing: 0.3
                        }}
                        onMouseOver={(e) => {
                          if (isEligibleForQuiz && !quizLoading) {
                            e.currentTarget.style.transform = 'translateY(-2px)';
                            e.currentTarget.style.boxShadow = '0 12px 28px rgba(37,99,235,0.45)';
                          }
                        }}
                        onMouseOut={(e) => {
                          if (isEligibleForQuiz && !quizLoading) {
                            e.currentTarget.style.transform = 'translateY(0)';
                            e.currentTarget.style.boxShadow = '0 8px 20px rgba(37,99,235,0.35)';
                          }
                        }}
                      >
                        <span style={{ fontSize: 18 }}>
                          {progress.quizState === 'pending' ? '▶️' : '🚀'}
                        </span>
                        <span>
                          {progress.quizState === 'pending' ? 'Resume Quiz' : 'Start Quiz'}
                        </span>
                      </button>
                    </div>
                  </div>
                )}
              </section>
            )}

            <section style={{
              background: 'linear-gradient(135deg, #ffffff 0%, #f8fafc 100%)',
              borderRadius: 24,
              padding: 32,
              boxShadow: '0 12px 30px rgba(15,23,42,0.08)',
              border: '1px solid rgba(226, 232, 240, 0.8)',
              position: 'relative',
              overflow: 'hidden'
            }}>
              {/* 装饰性背景元素 */}
              <div style={{
                position: 'absolute',
                top: -100,
                right: -100,
                width: 300,
                height: 300,
                background: 'radial-gradient(circle, rgba(37,99,235,0.08) 0%, transparent 70%)',
                borderRadius: '50%',
                pointerEvents: 'none'
              }} />
              
              <div style={{ 
                marginBottom: 24, 
                position: 'relative',
                paddingBottom: 16,
                borderBottom: '2px solid #e2e8f0'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 }}>
                  <div style={{
                    width: 40,
                    height: 40,
                    borderRadius: 12,
                    background: 'linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: 20,
                    boxShadow: '0 4px 12px rgba(37,99,235,0.25)'
                  }}>
                    📖
                  </div>
                  <h3 style={{ 
                    margin: 0, 
                    fontSize: 24, 
                    color: '#0f172a', 
                    textAlign: 'left',
                    fontWeight: 700,
                    letterSpacing: -0.3
                  }}>
                    Detailed content
                  </h3>
                </div>
                <p style={{ 
                  margin: '0 0 0 52px', 
                  color: '#64748b', 
                  fontSize: 15,
                  lineHeight: 1.6
                }}>
                  Review the foundational concepts before moving into discussion or practice.
                </p>
              </div>
              
              <div 
                className="ai-message-content" 
                style={{
                  position: 'relative',
                  background: '#ffffff',
                  borderRadius: 16,
                  padding: '28px 32px',
                  boxShadow: '0 4px 16px rgba(15,23,42,0.04)',
                  border: '1px solid #f1f5f9',
                  lineHeight: 1.8,
                  fontSize: 16,
                  color: '#1e293b'
                }}
              >
                <ReactMarkdown remarkPlugins={[remarkGfm]}>
                  {contentMarkdown}
                </ReactMarkdown>
              </div>
            </section>

            {keyPoints.length > 0 && (
              <section style={{
                backgroundColor: '#0f172a',
                color: '#e2e8f0',
                borderRadius: 20,
                padding: 28,
                boxShadow: '0 18px 35px rgba(15,23,42,0.35)'
              }}>
                <div style={{ marginBottom: 20 }}>
                  <h3 style={{ margin: 0, fontSize: 22, textAlign: 'left' }}>Key takeaways</h3>
                  <p style={{ margin: '8px 0 0', fontSize: 14, color: 'rgba(226,232,240,0.75)' }}>Focus on these core points to unlock the next modules.</p>
                </div>
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
                  gap: 16
                }}>
                  {keyPoints.map((point, idx) => (
                    <div
                      key={idx}
                      style={{
                        backgroundColor: 'rgba(15, 23, 42, 0.55)',
                        border: '1px solid rgba(148,163,184,0.25)',
                        borderRadius: 16,
                        padding: 18,
                        display: 'flex',
                        flexDirection: 'column',
                        gap: 10,
                        minHeight: 120
                      }}
                    >
                      <span style={{ fontSize: 24, opacity: 0.75 }}>⭐</span>
                      <p style={{ margin: 0, lineHeight: 1.6, fontSize: 15 }}>{point}</p>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {(topicData?.quiz || topicData?.scenario) && (
              <section style={{
                backgroundColor: '#ffffff',
                borderRadius: 20,
                padding: 28,
                boxShadow: '0 12px 30px rgba(15,23,42,0.08)'
              }}>
                <div style={{ marginBottom: 16 }}>
                  <h3 style={{ margin: 0, fontSize: 22, color: '#0f172a', textAlign: 'left' }}>Apply what you learn</h3>
                  <p style={{ margin: '6px 0 0', color: '#64748b', fontSize: 14 }}>Reinforce understanding with quick checks and scenario-based practice.</p>
                </div>
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
                  gap: 16
                }}>
                  {topicData?.quiz && (
                    <div style={{
                      border: '1px solid #e2e8f0',
                      borderRadius: 16,
                      padding: 20,
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 12,
                      background: 'linear-gradient(135deg, #eff6ff 0%, #ffffff 60%)'
                    }}>
                      <div style={{ fontSize: 26 }}>📝</div>
                      <div>
                        <h4 style={{ margin: '0 0 6px', fontSize: 16, color: '#0f172a' }}>Quick knowledge check</h4>
                        <p style={{ margin: 0, fontSize: 14, color: '#475569' }}>
                          {topicData.quiz.questions?.length || 0} curated questions • {isEligibleForQuiz ? 'Ready when you are' : 'Unlock after reviewing content'}
                        </p>
                      </div>
                      <div style={{ fontSize: 13, color: '#1d4ed8', fontWeight: 600 }}>Quiz experience coming soon</div>
                    </div>
                  )}
                  {topicData?.scenario && (
                    <div style={{
                      border: '1px solid #e2e8f0',
                      borderRadius: 16,
                      padding: 20,
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 12,
                      background: 'linear-gradient(135deg, #ecfdf5 0%, #ffffff 60%)'
                    }}>
                      <div style={{ fontSize: 26 }}>🎯</div>
                      <div>
                        <h4 style={{ margin: '0 0 6px', fontSize: 16, color: '#0f172a' }}>Scenario simulation</h4>
                        <p style={{ margin: 0, fontSize: 14, color: '#475569' }}>Practice decision-making in a safe environment to build boardroom confidence.</p>
                      </div>
                      <div style={{ fontSize: 13, color: '#059669', fontWeight: 600 }}>Interactive practice available in the Practice tab</div>
                    </div>
                  )}
                </div>
              </section>
            )}

            <section style={{
              backgroundColor: '#ffffff',
              borderRadius: 20,
              padding: 28,
              boxShadow: '0 12px 30px rgba(15,23,42,0.08)'
            }}>
              <div style={{ marginBottom: 16 }}>
                <h3 style={{ margin: 0, fontSize: 22, color: '#0f172a', textAlign: 'left' }}>Supporting resources</h3>
                <p style={{ margin: '6px 0 0', color: '#64748b', fontSize: 14 }}>Continue your exploration with curated reads and references.</p>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {/* 主题特定的资源 */}
                {resources.length > 0 ? resources.map((resource, idx) => {
                  // 根据资源类型选择图标和颜色
                  const getResourceIcon = (type) => {
                    const iconMap = {
                      'video': { icon: '🎥', color: '#dc2626', bg: '#fee2e2' },
                      'pdf': { icon: '📄', color: '#ea580c', bg: '#ffedd5' },
                      'webpage': { icon: '🌐', color: '#2563eb', bg: '#dbeafe' },
                      'article': { icon: '📰', color: '#7c3aed', bg: '#ede9fe' },
                      'book': { icon: '📚', color: '#059669', bg: '#d1fae5' },
                    };
                    return iconMap[type?.toLowerCase()] || { icon: '📎', color: '#64748b', bg: '#f1f5f9' };
                  };
                  
                  const { icon, color, bg } = getResourceIcon(resource.type);
                  
                  return (
                    <a
                      key={`topic-resource-${idx}`}
                      href={resource.url || '#'}
                      target="_blank"
                      rel="noreferrer"
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        padding: '18px 20px',
                        borderRadius: 16,
                        border: '1px solid #e2e8f0',
                        textDecoration: 'none',
                        color: '#0f172a',
                        transition: 'all 0.3s ease',
                        boxShadow: '0 4px 12px rgba(15,23,42,0.06)',
                        background: 'linear-gradient(135deg, #ffffff 0%, #f8fafc 100%)'
                      }}
                      onMouseOver={(e) => {
                        e.currentTarget.style.transform = 'translateY(-3px)';
                        e.currentTarget.style.boxShadow = '0 12px 28px rgba(37,99,235,0.15)';
                        e.currentTarget.style.borderColor = '#2563eb';
                      }}
                      onMouseOut={(e) => {
                        e.currentTarget.style.transform = 'translateY(0)';
                        e.currentTarget.style.boxShadow = '0 4px 12px rgba(15,23,42,0.06)';
                        e.currentTarget.style.borderColor = '#e2e8f0';
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: 14, flex: 1 }}>
                        <div style={{ 
                          fontSize: 24, 
                          width: 48, 
                          height: 48, 
                          display: 'flex', 
                          alignItems: 'center', 
                          justifyContent: 'center',
                          borderRadius: 12,
                          backgroundColor: bg,
                          flexShrink: 0
                        }}>
                          {icon}
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                          <span style={{ fontWeight: 600, fontSize: 15, color: '#0f172a' }}>
                            {resource.title || 'Resource link'}
                          </span>
                          <span style={{ fontSize: 13, color: '#64748b', display: 'flex', alignItems: 'center', gap: 6 }}>
                            <span style={{ 
                              padding: '2px 8px', 
                              borderRadius: 6, 
                              backgroundColor: bg,
                              color: color,
                              fontSize: 11,
                              fontWeight: 600,
                              textTransform: 'uppercase',
                              letterSpacing: 0.3
                            }}>
                              {resource.type || 'Link'}
                            </span>
                            {resource.source && <span>• {resource.source}</span>}
                          </span>
                        </div>
                      </div>
                      <span style={{ 
                        fontSize: 20, 
                        color: '#2563eb',
                        transition: 'transform 0.3s ease',
                        flexShrink: 0
                      }}>
                        ↗
                      </span>
                    </a>
                  );
                }) : (
                  <div style={{
                    padding: '24px',
                    textAlign: 'center',
                    color: '#94a3b8',
                    fontSize: 14,
                    borderRadius: 12,
                    border: '1px dashed #e2e8f0',
                    background: '#f8fafc'
                  }}>
                    📚 No additional resources available for this topic yet
                  </div>
                )}
              </div>
            </section>

            <section style={{
              backgroundColor: '#ffffff',
              borderRadius: 20,
              padding: 28,
              boxShadow: '0 12px 30px rgba(15,23,42,0.08)'
            }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 16, flexWrap: 'wrap' }}>
                  <div>
                    <h3 style={{ margin: 0, fontSize: 22, color: '#0f172a', textAlign: 'left' }}>Progress tracker</h3>
                    <p style={{ margin: '6px 0 0', color: '#64748b', fontSize: 14 }}>Keep tabs on your learning momentum.</p>
                  </div>
                  <span style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 8,
                    borderRadius: 999,
                    padding: '6px 14px',
                    backgroundColor: `${statusColor}1a`,
                    color: statusColor,
                    fontWeight: 600,
                    fontSize: 13
                  }}>
                    <span style={{
                      display: 'inline-block',
                      width: 8,
                      height: 8,
                      borderRadius: '50%',
                      backgroundColor: statusColor
                    }} />
                    {status}
                  </span>
                </div>

                <div style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                  gap: 16
                }}>
                  <div style={{
                    border: '1px solid #e2e8f0',
                    borderRadius: 16,
                    padding: 18,
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 8
                  }}>
                    <span style={{ fontSize: 12, textTransform: 'uppercase', letterSpacing: 0.6, color: '#94a3b8' }}>Last visited</span>
                    <span style={{ fontSize: 16, fontWeight: 600, color: '#0f172a' }}>{lastVisitedLabel}</span>
                  </div>
                  <div style={{
                    border: '1px solid #e2e8f0',
                    borderRadius: 16,
                    padding: 18,
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 8
                  }}>
                    <span style={{ fontSize: 12, textTransform: 'uppercase', letterSpacing: 0.6, color: '#94a3b8' }}>Quiz readiness</span>
                    <span style={{ fontSize: 16, fontWeight: 600, color: '#0f172a' }}>{scoreLabel}</span>
                    {isEligibleForQuiz && (
                      <span style={{ fontSize: 12, color: '#10b981' }}>Eligible for quiz retake</span>
                    )}
                  </div>
                  <div style={{
                    border: '1px solid #e2e8f0',
                    borderRadius: 16,
                    padding: 18,
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 8
                  }}>
                    <span style={{ fontSize: 12, textTransform: 'uppercase', letterSpacing: 0.6, color: '#94a3b8' }}>Completion</span>
                    <span style={{ fontSize: 16, fontWeight: 600, color: '#0f172a' }}>{completed ? completedAtLabel : 'Pending your review'}</span>
                  </div>
                  {isApiSource && topicData?.passThreshold !== undefined && topicData?.passThreshold !== null && (
                    <div style={{
                      border: '1px solid #e2e8f0',
                      borderRadius: 16,
                      padding: 18,
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 8
                    }}>
                      <span style={{ fontSize: 12, textTransform: 'uppercase', letterSpacing: 0.6, color: '#94a3b8' }}>Pass threshold</span>
                      <span style={{ fontSize: 16, fontWeight: 600, color: '#0f172a' }}>{passThresholdLabel}</span>
                    </div>
                  )}
                </div>

                {!completed ? (
                  <div style={{
                    display: 'flex',
                    flexWrap: 'wrap',
                    gap: 16,
                    alignItems: 'center'
                  }}>
                    <button
                      onClick={markComplete}
                      disabled={completing}
                      style={{
                        background: completing ? 'rgba(37, 99, 235, 0.5)' : 'linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)',
                        color: '#fff',
                        border: 'none',
                        borderRadius: 12,
                        padding: '12px 24px',
                        fontSize: 15,
                        fontWeight: 600,
                        cursor: completing ? 'not-allowed' : 'pointer',
                        boxShadow: '0 12px 24px rgba(37,99,235,0.35)',
                        transition: 'transform 0.2s ease, box-shadow 0.2s ease'
                      }}
                      onMouseOver={(e) => {
                        if (!completing) {
                          e.currentTarget.style.transform = 'translateY(-2px)';
                          e.currentTarget.style.boxShadow = '0 16px 32px rgba(37,99,235,0.4)';
                        }
                      }}
                      onMouseOut={(e) => {
                        e.currentTarget.style.transform = 'translateY(0)';
                        e.currentTarget.style.boxShadow = '0 12px 24px rgba(37,99,235,0.35)';
                      }}
                    >
                      {completing ? 'Marking…' : 'Mark topic as complete'}
                    </button>
                    <span style={{ fontSize: 13, color: '#64748b' }}>Marking complete helps personalize your learning recommendations.</span>
                    {completeError && (
                      <span style={{ fontSize: 13, color: '#dc2626' }}>{completeError}</span>
                    )}
                  </div>
                ) : (
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 12,
                    background: '#ecfdf5',
                    borderRadius: 14,
                    padding: '12px 16px',
                    border: '1px solid rgba(16,185,129,0.2)',
                    color: '#047857'
                  }}>
                    <span style={{ fontSize: 20 }}>🎉</span>
                    <span>Great job! You completed this theme on {completedAtLabel === '—' ? 'your last visit' : completedAtLabel}.</span>
                  </div>
                )}
              </div>
            </section>
          </div>
        )}

        {tab === 'conversation' && (
          <TopicChat topicId={topicId} email={email} chat={chat} setChat={setChat} />
        )}

        {tab === 'scenario' && (
          <ScenarioSim topic={topic} />
        )}
      </div>
    </div>
  );
}

// TopicChat Component - handles topic-specific conversations
function TopicChat({ topicId, email, chat, setChat }) {
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [currentTypingText, setCurrentTypingText] = useState('');

  const send = async () => {
    const text = input.trim();
    if (!text) return;

    const userMsg = { role: 'user', text, timestamp: Date.now() };
    setChat(prev => ({ ...prev, messages: [...prev.messages, userMsg] }));
    setInput('');

    // Show "AI is thinking..." prompt
    setIsTyping(true);
    setCurrentTypingText('');

    try {
      const response = await aiAsk({
        module_id: topicId,
        question: text,
        context: chat.messages.slice(-5)
      });
      
      const fullText = response.answer || 'I need more information to help you with this topic.';
      
      // 打字机效果 - 逐字显示
      let currentIndex = 0;
      const typingSpeed = 20; // 每个字符的延迟(ms)
      
      const typeNextChar = () => {
        if (currentIndex < fullText.length) {
          setCurrentTypingText(fullText.slice(0, currentIndex + 1));
          currentIndex++;
          setTimeout(typeNextChar, typingSpeed);
        } else {
          // 打字完成,添加到正式消息列表
          setIsTyping(false);
          const aiMsg = { 
            role: 'assistant', 
            text: fullText,
            timestamp: Date.now() 
          };
          setChat(prev => ({ ...prev, messages: [...prev.messages, aiMsg] }));
          setCurrentTypingText('');
        }
      };
      
      typeNextChar();
      
    } catch (error) {
      console.error('Topic AI request failed:', error);
      setIsTyping(false);
      const errorMsg = { 
        role: 'assistant', 
        text: 'I apologize, but I encountered an error. Please try again.',
        timestamp: Date.now() 
      };
      setChat(prev => ({ ...prev, messages: [...prev.messages, errorMsg] }));
    }
  };

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <div style={{ flex: 1, padding: 24, overflowY: 'auto' }}>
        {chat.messages.length === 0 && !isTyping ? (
          <div style={{ textAlign: 'center', marginTop: 100, color: '#6b7280' }}>
            <div style={{ fontSize: '48px', marginBottom: 20 }}>💬</div>
            <h3>Ask questions about this topic</h3>
            <p>Get personalized explanations and dive deeper into the concepts.</p>
          </div>
        ) : (
          <>
            {chat.messages.map((msg, idx) => (
              <div key={idx} style={{ 
                marginBottom: 24,
                display: 'flex',
                flexDirection: msg.role === 'user' ? 'row-reverse' : 'row',
                gap: '12px',
                alignItems: 'flex-start',
                animation: 'fadeInUp 0.3s ease-out'
              }}>
                {/* 头像 */}
                <div style={{
                  width: '36px',
                  height: '36px',
                  borderRadius: '50%',
                  backgroundColor: msg.role === 'user' ? '#3b82f6' : '#10b981',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '18px',
                  flexShrink: 0,
                  boxShadow: '0 2px 8px rgba(0,0,0,0.1)'
                }}>
                  {msg.role === 'user' ? '👤' : '🤖'}
                </div>
                
                {/* 消息气泡 */}
                <div style={{
                  maxWidth: '70%',
                  padding: '16px 20px',
                  borderRadius: msg.role === 'user' ? '20px 20px 4px 20px' : '20px 20px 20px 4px',
                  backgroundColor: msg.role === 'user' ? '#3b82f6' : '#ffffff',
                  color: msg.role === 'user' ? 'white' : '#1f2937',
                  boxShadow: msg.role === 'user' 
                    ? '0 4px 12px rgba(59, 130, 246, 0.3)' 
                    : '0 2px 12px rgba(0, 0, 0, 0.08)',
                  border: msg.role === 'assistant' ? '1px solid #e5e7eb' : 'none',
                  position: 'relative'
                }}>
                  {msg.role === 'assistant' ? (
                    <div className="ai-message-content">
                      <ReactMarkdown remarkPlugins={[remarkGfm]}>
                        {msg.text}
                      </ReactMarkdown>
                    </div>
                  ) : (
                    <div style={{ whiteSpace: 'pre-wrap', lineHeight: '1.6' }}>{msg.text}</div>
                  )}
                  
                  {/* 时间戳 */}
                  <div style={{
                    fontSize: '11px',
                    marginTop: '8px',
                    opacity: 0.6,
                    textAlign: msg.role === 'user' ? 'right' : 'left'
                  }}>
                    {new Date(msg.timestamp).toLocaleTimeString('en-US', { 
                      hour: '2-digit', 
                      minute: '2-digit' 
                    })}
                  </div>
                </div>
              </div>
            ))}
            
            {/* 正在打字的消息 */}
            {isTyping && (
              <div style={{ 
                marginBottom: 24,
                display: 'flex',
                flexDirection: 'row',
                gap: '12px',
                alignItems: 'flex-start',
                animation: 'fadeInUp 0.3s ease-out'
              }}>
                {/* AI 头像 */}
                <div style={{
                  width: '36px',
                  height: '36px',
                  borderRadius: '50%',
                  backgroundColor: '#10b981',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '18px',
                  flexShrink: 0,
                  boxShadow: '0 2px 8px rgba(16, 185, 129, 0.3)',
                  animation: 'pulse 2s ease-in-out infinite'
                }}>
                  🤖
                </div>
                
                {/* 打字消息气泡 */}
                <div style={{
                  maxWidth: '70%',
                  padding: '16px 20px',
                  borderRadius: '20px 20px 20px 4px',
                  backgroundColor: '#ffffff',
                  color: '#1f2937',
                  boxShadow: '0 2px 12px rgba(0, 0, 0, 0.08)',
                  border: '1px solid #e5e7eb',
                  position: 'relative',
                  minHeight: '60px'
                }}>
                  {currentTypingText ? (
                    <div className="ai-message-content">
                      <ReactMarkdown remarkPlugins={[remarkGfm]}>
                        {currentTypingText}
                      </ReactMarkdown>
                      <span className="typing-cursor">▊</span>
                    </div>
                  ) : (
                    <div style={{ 
                      display: 'flex', 
                      alignItems: 'center', 
                      gap: 8,
                      color: '#6b7280',
                      fontSize: '14px'
                    }}>
                      <div className="thinking-spinner"></div>
                      <span>AI is thinking</span>
                      <span className="thinking-dots">
                        <span>.</span>
                        <span>.</span>
                        <span>.</span>
                      </span>
                    </div>
                  )}
                </div>
              </div>
            )}
          </>
        )}
      </div>

      <div style={{ padding: 'clamp(16px, 4vw, 24px) clamp(12px, 3vw, 20px)', borderTop: '1px solid #e5e7eb', backgroundColor: '#fff' }}>
        <div style={{ display: 'flex', gap: 'clamp(8px, 2vw, 16px)', alignItems: 'flex-end', flexWrap: 'wrap' }}>
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyPress={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                send();
              }
            }}
            placeholder="Ask about this topic..."
            style={{
              flex: '1 1 200px',
              padding: 'clamp(12px, 3vw, 16px) clamp(16px, 3vw, 20px)',
              border: '2px solid #e5e7eb',
              borderRadius: '16px',
              resize: 'none',
              fontSize: 'clamp(14px, 3vw, 16px)',
              fontFamily: 'inherit',
              lineHeight: '1.4',
              minHeight: '56px',
              maxHeight: '140px',
              outline: 'none',
              transition: 'border-color 0.2s ease'
            }}
            rows={2}
            onFocus={(e) => e.target.style.borderColor = '#3b82f6'}
            onBlur={(e) => e.target.style.borderColor = '#e5e7eb'}
          />
          <button 
            onClick={send}
            disabled={!input.trim()}
            style={{
              padding: 'clamp(12px, 3vw, 16px) clamp(16px, 4vw, 24px)',
              backgroundColor: input.trim() ? '#3b82f6' : '#ccc',
              color: 'white',
              border: 'none',
              borderRadius: '12px',
              cursor: input.trim() ? 'pointer' : 'not-allowed',
              fontSize: 'clamp(14px, 3vw, 16px)',
              fontWeight: '600',
              minHeight: '56px',
              boxShadow: input.trim() ? '0 2px 8px rgba(59, 130, 246, 0.3)' : 'none',
              transition: 'all 0.2s ease',
              whiteSpace: 'nowrap'
            }}
          >
            Send
          </button>
        </div>
      </div>
    </div>
  );
}

// ScenarioSim Component - handles topic quiz practice
function ScenarioSim({ topic }) {
  const { startTopicQuiz, submitTopicQuiz } = learningApi;
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [quizSession, setQuizSession] = useState(null);
  const [questions, setQuestions] = useState([]);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [answers, setAnswers] = useState({});
  const [submitted, setSubmitted] = useState(false);
  const [result, setResult] = useState(null);

  const startQuiz = async () => {
    console.log('🎯 startQuiz called');
    console.log('🎯 topic object:', topic);
    console.log('🎯 topic.id:', topic?.id);
    
    setLoading(true);
    setError(null);
    
    try {
      console.log('🚀 Starting quiz for topic:', topic.id);
      const data = await startTopicQuiz(topic.id, { limit: 5 });
      console.log('✅ Quiz data received:', data);
      setQuizSession(data.quiz_session_id);
      setQuestions(data.questions || []);
      setCurrentQuestionIndex(0);
      setAnswers({});
      setSubmitted(false);
      setResult(null);
    } catch (err) {
      console.error('❌ Failed to start quiz - Full error:', err);
      console.error('❌ Error status:', err.status);
      console.error('❌ Error body:', err.body);
      console.error('❌ Error message:', err.message);
      console.error('❌ Error stack:', err.stack);
      
      // 提取错误信息
      let errorMessage = 'Failed to load practice questions. Please try again.';
      
      if (err.status === 409 && err.body) {
        const bodyMessage = err.body?.message || err.body?.data?.message || '';
        
        // 检查是否是未完成评测的错误
        if (bodyMessage.includes('unfinished_assessment') || bodyMessage.includes('unfinished assessment')) {
          errorMessage = '⚠️ You have an unfinished quiz. Please go to the Quiz page to continue or complete it first, then come back to start a new one.';
          console.log('⚠️ 409 error - unfinished assessment');
        } else if (err.body.data?.available !== undefined) {
          // 题目不足的情况
          const available = err.body.data.available || 0;
          const required = err.body.data.required || 5;
          errorMessage = `Not enough practice questions available for this topic yet. Found ${available} questions, but ${required} are needed. We're working on adding more content!`;
          console.log('⚠️ 409 error - insufficient questions:', { available, required });
        } else {
          // 其他409错误
          errorMessage = bodyMessage || 'There is a conflict with your quiz status. Please refresh the page and try again.';
          console.log('⚠️ 409 error - other conflict:', bodyMessage);
        }
      } else if (err.status === 401) {
        errorMessage = 'Authentication required. Please log in again.';
        console.log('⚠️ 401 error - unauthorized');
      } else if (err.status === 404) {
        errorMessage = 'Quiz endpoint not found. Please contact support.';
        console.log('⚠️ 404 error - not found');
      } else if (err.body?.message) {
        errorMessage = err.body.message;
        console.log('⚠️ Using error body message:', errorMessage);
      } else if (err.message) {
        errorMessage = err.message;
        console.log('⚠️ Using error message:', errorMessage);
      }
      
      console.log('📝 Setting error state to:', errorMessage);
      setError(errorMessage);
      console.log('📝 Error state set complete');
    } finally {
      console.log('🏁 Finally block - setting loading to false');
      setLoading(false);
    }
  };

  const handleAnswer = (itemId, value) => {
    setAnswers(prev => ({
      ...prev,
      [itemId]: value
    }));
  };

  const handleSubmit = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await submitTopicQuiz(topic.id, quizSession, answers);
      setResult(data);
      setSubmitted(true);
    } catch (err) {
      console.error('Failed to submit quiz:', err);
      setError(err.message || 'Failed to submit answers. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const resetQuiz = () => {
    setQuizSession(null);
    setQuestions([]);
    setCurrentQuestionIndex(0);
    setAnswers({});
    setSubmitted(false);
    setResult(null);
    setError(null);
  };

  // 未开始状态
  if (!quizSession) {
    console.log('🔍 ScenarioSim render - not started state');
    console.log('🔍 error state:', error);
    console.log('🔍 loading state:', loading);
    
    return (
      <div style={{ padding: 40, textAlign: 'center', maxWidth: 600, margin: '0 auto' }}>
        <div style={{ fontSize: '48px', marginBottom: 20 }}>🎯</div>
        <h2 style={{ marginBottom: 16 }}>Practice Quiz</h2>
        <p style={{ color: '#64748b', marginBottom: 32, lineHeight: 1.6 }}>
          Test your understanding with interactive practice questions. 
          Answer all questions to see your score and get feedback.
        </p>
        {error && (
          <div style={{
            padding: '20px 24px',
            marginBottom: 24,
            backgroundColor: '#fef3c7',
            color: '#92400e',
            borderRadius: 12,
            border: '2px solid #fbbf24',
            textAlign: 'left',
            lineHeight: 1.6
          }}>
            <div style={{ 
              display: 'flex', 
              alignItems: 'flex-start', 
              gap: 12 
            }}>
              <span style={{ fontSize: 24, flexShrink: 0 }}>⚠️</span>
              <div>
                <div style={{ fontWeight: 600, marginBottom: 8, fontSize: 15 }}>
                  Unable to Start Quiz
                </div>
                <div style={{ fontSize: 14 }}>
                  {error}
                </div>
              </div>
            </div>
          </div>
        )}
        {!error && (
          <div style={{ 
            padding: '12px', 
            marginBottom: 16, 
            backgroundColor: '#e0f2fe', 
            color: '#0369a1',
            borderRadius: 8,
            fontSize: 13 
          }}>
            Debug: No error set yet. Click button to start quiz.
          </div>
        )}
        <button
          onClick={() => {
            console.log('🖱️ Start Practice Quiz button clicked');
            startQuiz();
          }}
          disabled={loading}
          style={{
            backgroundColor: loading ? '#94a3b8' : '#3b82f6',
            color: 'white',
            border: 'none',
            padding: '12px 32px',
            borderRadius: 8,
            fontSize: 16,
            fontWeight: '600',
            cursor: loading ? 'not-allowed' : 'pointer',
            transition: 'all 0.2s'
          }}
          onMouseOver={(e) => {
            if (!loading) e.target.style.backgroundColor = '#2563eb';
          }}
          onMouseOut={(e) => {
            if (!loading) e.target.style.backgroundColor = '#3b82f6';
          }}
        >
          {loading ? 'Loading...' : 'Start Practice Quiz'}
        </button>
      </div>
    );
  }

  // 已提交 - 显示结果
  if (submitted && result) {
    const passed = result.passed;
    const scorePercent = Math.round(result.score * 100);
    
    return (
      <div style={{ padding: 40, maxWidth: 800, margin: '0 auto' }}>
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <div style={{ 
            fontSize: '64px', 
            marginBottom: 16,
            animation: 'fadeInUp 0.5s ease-out'
          }}>
            {passed ? '🎉' : '📚'}
          </div>
          <h2 style={{ marginBottom: 8 }}>
            {passed ? 'Great Job!' : 'Keep Practicing!'}
          </h2>
          <p style={{ color: '#64748b', fontSize: 14 }}>
            You answered {result.correct_count} out of {result.total_questions} questions correctly
          </p>
        </div>

        <div style={{
          padding: 24,
          backgroundColor: passed ? '#f0fdf4' : '#fef3c7',
          border: `2px solid ${passed ? '#86efac' : '#fcd34d'}`,
          borderRadius: 12,
          marginBottom: 24
        }}>
          <div style={{ 
            fontSize: 48, 
            fontWeight: 'bold', 
            color: passed ? '#16a34a' : '#d97706',
            textAlign: 'center',
            marginBottom: 8
          }}>
            {scorePercent}%
          </div>
          <div style={{ textAlign: 'center', color: '#64748b', fontSize: 14 }}>
            {passed ? 
              `You passed! (Threshold: ${Math.round((result.pass_threshold || 0) * 100)}%)` : 
              `Pass threshold: ${Math.round((result.pass_threshold || 0) * 100)}%`
            }
          </div>
        </div>

        {result.best_score !== null && result.attempt_count > 1 && (
          <div style={{ 
            padding: 16, 
            backgroundColor: '#f1f5f9', 
            borderRadius: 8,
            marginBottom: 24,
            textAlign: 'center'
          }}>
            <div style={{ fontSize: 13, color: '#64748b' }}>
              Best Score: {Math.round(result.best_score * 100)}% 
              {' · '}
              Attempt #{result.attempt_count}
            </div>
          </div>
        )}

        <div style={{ display: 'flex', gap: 12, justifyContent: 'center' }}>
          <button
            onClick={resetQuiz}
            style={{
              padding: '12px 24px',
              backgroundColor: 'white',
              color: '#3b82f6',
              border: '2px solid #3b82f6',
              borderRadius: 8,
              fontSize: 14,
              fontWeight: '600',
              cursor: 'pointer'
            }}
            onMouseOver={(e) => {
              e.target.style.backgroundColor = '#eff6ff';
            }}
            onMouseOut={(e) => {
              e.target.style.backgroundColor = 'white';
            }}
          >
            Try Again
          </button>
        </div>
      </div>
    );
  }

  // 答题中
  if (questions.length === 0) {
    return (
      <div style={{ padding: 40, textAlign: 'center' }}>
        <p style={{ color: '#64748b' }}>No practice questions available for this topic yet.</p>
        <button
          onClick={resetQuiz}
          style={{
            marginTop: 16,
            padding: '8px 16px',
            backgroundColor: '#3b82f6',
            color: 'white',
            border: 'none',
            borderRadius: 6,
            cursor: 'pointer'
          }}
        >
          Back
        </button>
      </div>
    );
  }

  const currentQuestion = questions[currentQuestionIndex];
  const currentAnswer = answers[currentQuestion.item_id];
  const isLastQuestion = currentQuestionIndex === questions.length - 1;
  const allAnswered = questions.every(q => answers[q.item_id] !== undefined);

  return (
    <div style={{ padding: 40, maxWidth: 800, margin: '0 auto' }}>
      {/* Progress */}
      <div style={{ marginBottom: 24 }}>
        <div style={{ 
          display: 'flex', 
          justifyContent: 'space-between', 
          alignItems: 'center',
          marginBottom: 8
        }}>
          <div style={{ fontSize: 13, color: '#64748b', fontWeight: 500 }}>
            Question {currentQuestionIndex + 1} of {questions.length}
          </div>
          <div style={{ fontSize: 13, color: '#64748b' }}>
            {Object.keys(answers).length} / {questions.length} answered
          </div>
        </div>
        <div style={{ 
          width: '100%', 
          height: 6, 
          backgroundColor: '#e2e8f0', 
          borderRadius: 3,
          overflow: 'hidden'
        }}>
          <div style={{ 
            width: `${((currentQuestionIndex + 1) / questions.length) * 100}%`,
            height: '100%',
            backgroundColor: '#3b82f6',
            transition: 'width 0.3s ease'
          }} />
        </div>
      </div>

      {/* Question */}
      <div style={{ 
        padding: 24, 
        backgroundColor: '#f8fafc', 
        borderRadius: 12, 
        marginBottom: 24,
        border: '1px solid #e2e8f0'
      }}>
        <div style={{ 
          fontSize: 12, 
          color: '#64748b', 
          marginBottom: 8,
          textTransform: 'uppercase',
          fontWeight: 600
        }}>
          {currentQuestion.qtype === 'single' ? 'Single Choice' : 
           currentQuestion.qtype === 'multi' ? 'Multiple Choice' : 'Short Answer'}
        </div>
        <p style={{ fontSize: 16, lineHeight: 1.6, margin: 0, color: '#1e293b' }}>
          {currentQuestion.stem}
        </p>
      </div>

      {/* Answer Options */}
      <div style={{ marginBottom: 24 }}>
        {currentQuestion.qtype === 'single' && currentQuestion.choices && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {currentQuestion.choices.map((choice) => {
              const isSelected = currentAnswer === choice.id;
              return (
                <button
                  key={choice.id}
                  onClick={() => handleAnswer(currentQuestion.item_id, choice.id)}
                  style={{
                    padding: 16,
                    backgroundColor: isSelected ? '#eff6ff' : 'white',
                    border: `2px solid ${isSelected ? '#3b82f6' : '#e2e8f0'}`,
                    borderRadius: 8,
                    textAlign: 'left',
                    cursor: 'pointer',
                    fontSize: 14,
                    transition: 'all 0.2s',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 12
                  }}
                  onMouseOver={(e) => {
                    if (!isSelected) e.currentTarget.style.borderColor = '#cbd5e1';
                  }}
                  onMouseOut={(e) => {
                    if (!isSelected) e.currentTarget.style.borderColor = '#e2e8f0';
                  }}
                >
                  <div style={{
                    width: 20,
                    height: 20,
                    borderRadius: '50%',
                    border: `2px solid ${isSelected ? '#3b82f6' : '#cbd5e1'}`,
                    backgroundColor: isSelected ? '#3b82f6' : 'transparent',
                    flexShrink: 0,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                  }}>
                    {isSelected && (
                      <div style={{
                        width: 8,
                        height: 8,
                        borderRadius: '50%',
                        backgroundColor: 'white'
                      }} />
                    )}
                  </div>
                  <span style={{ color: '#1e293b' }}>{choice.label}</span>
                </button>
              );
            })}
          </div>
        )}

        {currentQuestion.qtype === 'multi' && currentQuestion.choices && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {currentQuestion.choices.map((choice) => {
              const selectedOptions = currentAnswer ? currentAnswer.split(',') : [];
              const isSelected = selectedOptions.includes(choice.id);
              return (
                <button
                  key={choice.id}
                  onClick={() => {
                    const current = currentAnswer ? currentAnswer.split(',') : [];
                    const updated = isSelected
                      ? current.filter(id => id !== choice.id)
                      : [...current, choice.id];
                    handleAnswer(currentQuestion.item_id, updated.sort().join(','));
                  }}
                  style={{
                    padding: 16,
                    backgroundColor: isSelected ? '#eff6ff' : 'white',
                    border: `2px solid ${isSelected ? '#3b82f6' : '#e2e8f0'}`,
                    borderRadius: 8,
                    textAlign: 'left',
                    cursor: 'pointer',
                    fontSize: 14,
                    transition: 'all 0.2s',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 12
                  }}
                >
                  <div style={{
                    width: 20,
                    height: 20,
                    borderRadius: 4,
                    border: `2px solid ${isSelected ? '#3b82f6' : '#cbd5e1'}`,
                    backgroundColor: isSelected ? '#3b82f6' : 'transparent',
                    flexShrink: 0,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                  }}>
                    {isSelected && (
                      <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                        <path d="M10 3L4.5 8.5L2 6" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                    )}
                  </div>
                  <span style={{ color: '#1e293b' }}>{choice.label}</span>
                </button>
              );
            })}
          </div>
        )}

        {currentQuestion.qtype === 'short' && (
          <textarea
            value={currentAnswer || ''}
            onChange={(e) => handleAnswer(currentQuestion.item_id, e.target.value)}
            placeholder="Type your answer here..."
            style={{
              width: '100%',
              minHeight: 120,
              padding: 16,
              border: '2px solid #e2e8f0',
              borderRadius: 8,
              fontSize: 14,
              fontFamily: 'inherit',
              resize: 'vertical',
              boxSizing: 'border-box'
            }}
          />
        )}
      </div>

      {/* Navigation */}
      <div style={{ 
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'center',
        paddingTop: 24,
        borderTop: '1px solid #e2e8f0'
      }}>
        <button
          onClick={() => setCurrentQuestionIndex(prev => Math.max(0, prev - 1))}
          disabled={currentQuestionIndex === 0}
          style={{
            padding: '10px 20px',
            backgroundColor: 'white',
            color: currentQuestionIndex === 0 ? '#cbd5e1' : '#64748b',
            border: '1px solid #e2e8f0',
            borderRadius: 6,
            fontSize: 14,
            fontWeight: '500',
            cursor: currentQuestionIndex === 0 ? 'not-allowed' : 'pointer'
          }}
        >
          ← Previous
        </button>

        {!isLastQuestion ? (
          <button
            onClick={() => setCurrentQuestionIndex(prev => Math.min(questions.length - 1, prev + 1))}
            style={{
              padding: '10px 20px',
              backgroundColor: '#3b82f6',
              color: 'white',
              border: 'none',
              borderRadius: 6,
              fontSize: 14,
              fontWeight: '600',
              cursor: 'pointer'
            }}
            onMouseOver={(e) => e.target.style.backgroundColor = '#2563eb'}
            onMouseOut={(e) => e.target.style.backgroundColor = '#3b82f6'}
          >
            Next →
          </button>
        ) : (
          <button
            onClick={handleSubmit}
            disabled={!allAnswered || loading}
            style={{
              padding: '10px 24px',
              backgroundColor: !allAnswered || loading ? '#cbd5e1' : '#10b981',
              color: 'white',
              border: 'none',
              borderRadius: 6,
              fontSize: 14,
              fontWeight: '600',
              cursor: !allAnswered || loading ? 'not-allowed' : 'pointer'
            }}
            onMouseOver={(e) => {
              if (allAnswered && !loading) e.target.style.backgroundColor = '#059669';
            }}
            onMouseOut={(e) => {
              if (allAnswered && !loading) e.target.style.backgroundColor = '#10b981';
            }}
          >
            {loading ? 'Submitting...' : 'Submit Quiz'}
          </button>
        )}
      </div>

      {error && (
        <div style={{
          marginTop: 16,
          padding: 12,
          backgroundColor: '#fee2e2',
          color: '#991b1b',
          borderRadius: 6,
          fontSize: 13
        }}>
          {error}
        </div>
      )}
    </div>
  );
}

// Main Home Component
export default function Home({ user, onSignOut }) {
  const navigate = useNavigate();
  const [structure, setStructure] = useState(() => fallbackSections);
  const [structureSource, setStructureSource] = useState('local');
  const [structureLoading, setStructureLoading] = useState(true);
  const [structureError, setStructureError] = useState(null);
  const [topicsIndex, setTopicsIndex] = useState(() => buildTopicIndex(fallbackSections));
  const [topicId, setTopicId] = useState(null);
  const [showOverview, setShowOverview] = useState(false);
  const [navUi, setNavUi] = useState({
    collapsed: false,
    sectionsOpen: {},
    modulesOpen: {}
  });

  const onSelectTopic = (id) => setTopicId(id);
  const onBackToHome = () => setTopicId(null);
  const onStartAssessment = () => navigate('/assessments/global');
  
  const onToggleCollapsed = () => {
    setNavUi(prev => ({ ...prev, collapsed: !prev.collapsed }));
  };
  
  const onToggleSection = (sectionId) => {
    setNavUi(prev => ({
      ...prev,
      sectionsOpen: { ...prev.sectionsOpen, [sectionId]: !prev.sectionsOpen[sectionId] }
    }));
  };
  
  const onToggleModule = (moduleId) => {
    setNavUi(prev => ({
      ...prev,
      modulesOpen: { ...prev.modulesOpen, [moduleId]: !prev.modulesOpen[moduleId] }
    }));
  };

  useEffect(() => {
    let cancelled = false;
    let retryCount = 0;
    const maxRetries = 2;

    async function loadStructure() {
      setStructureLoading(true);
      
      while (retryCount <= maxRetries && !cancelled) {
        try {
          const remote = await learningApi.fetchStructure();
          if (cancelled) return;
          
          if (remote && remote.length > 0) {
            setStructure(remote);
            setTopicsIndex(buildTopicIndex(remote));
            setStructureSource('api');
            setStructureError(null);
            return;
          } else {
            setStructure(fallbackSections);
            setTopicsIndex(buildTopicIndex(fallbackSections));
            setStructureSource('local');
            return;
          }
        } catch (err) {
          retryCount++;
          if (retryCount > maxRetries && !cancelled) {
            console.error('Failed to load learning structure after retries', err);
            setStructureError(err);
            setStructure(fallbackSections);
            setTopicsIndex(buildTopicIndex(fallbackSections));
            setStructureSource('local');
          } else if (!cancelled) {
            // 等待后重试
            await new Promise(resolve => setTimeout(resolve, 1000 * retryCount));
          }
        } finally {
          if (cancelled || retryCount > maxRetries) {
            setStructureLoading(false);
          }
        }
      }
    }

    loadStructure();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (topicId && !topicsIndex[topicId]) {
      setTopicId(null);
    }
  }, [topicId, topicsIndex]);

  const structureErrorMessage = structureError?.body?.message || structureError?.message;

  const currentTopicRef = topicId ? topicsIndex[topicId] : null;

  return (
    <div style={{ display: 'flex', height: '100vh', fontFamily: 'system-ui, sans-serif' }}>
      <div style={{ display: 'flex', flexDirection: 'column', flex: 1 }}>
        <Header 
          user={user}
          onOpenOverview={() => setShowOverview(true)}
          onToggleSidebar={onToggleCollapsed}
          onBackToHome={onBackToHome}
          onSignOut={onSignOut}
          onProfile={() => console.log('Profile clicked')}
          onStartAssessment={onStartAssessment}
          currentTopicId={topicId}
        />
        
        <div style={{ display: 'flex', flex: 1 }}>
          <Sidebar
            sections={structure}
            loading={structureLoading}
            ui={navUi}
            onToggleCollapsed={onToggleCollapsed}
            onToggleSection={onToggleSection}
            onToggleModule={onToggleModule}
            onSelectTopic={onSelectTopic}
            currentTopicId={topicId}
            user={user}
          />
          
          <main style={{
            background: '#f8fafc',
            overflow: 'hidden',
            position: 'relative',
            flex: 1
          }}>
            {structureSource !== 'api' && structureError && (
              <div style={{
                padding: '12px 24px',
                background: '#fff7ed',
                color: '#9a3412',
                borderBottom: '1px solid #fed7aa'
              }}>
                {structureErrorMessage || 'Unable to reach the learning service. Showing local demo content.'}
              </div>
            )}
            {!topicId ? (
              <GlobalChat email={user.email} />
            ) : (
              <TopicPage
                topicId={topicId}
                topicRef={currentTopicRef}
                source={structureSource}
                email={user.email}
                onBack={onBackToHome}
              />
            )}
          </main>
        </div>
      </div>

      <Modal open={showOverview} onClose={() => setShowOverview(false)} width={800}>
        <div style={{ padding: 24 }}>
          <h2>Project Overview</h2>
          <p>Goals: Build equitable governance literacy. Audience: young women and minority groups.</p>
          <ul>
            <li>Assessment</li>
            <li>Learning Path</li>
            <li>Topic Chat</li>
          </ul>
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
            <button 
              onClick={() => setShowOverview(false)} 
              style={{ 
                padding: '8px 12px', 
                background: '#111827', 
                color: '#fff', 
                border: 'none', 
                borderRadius: 6 
              }}
            >
              Get Started
            </button>
            <button 
              onClick={() => setShowOverview(false)} 
              style={{ padding: '8px 12px' }}
            >
              Maybe later
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
