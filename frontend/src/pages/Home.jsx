import React, { useEffect, useMemo, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Header, Sidebar } from '../components/layout';
import { Modal } from '../components/ui';
import { AssessmentModal, GlobalChat } from '../components/features';
import { dbApi } from '../services/localDb';
import { sections as fallbackSections } from '../constants/structure';
import { aiAsk } from '../services/api';
import { learningApi } from '../services/learning';
import { globalResources } from '../constants/globalResources';

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
    let cancelled = false;
    setLoading(true);
    setError(null);

    (async () => {
      try {
        const [detail, progressData, contentData] = await Promise.all([
          learningApi.getTopicDetail(topicId).catch(err => {
            if (err?.status === 404) return null;
            throw err;
          }),
          learningApi.getTopicProgress(topicId).catch(err => {
            if (err?.status === 404) return null;
            throw err;
          }),
          learningApi.getTopicContent(topicId).catch(err => {
            if (err?.status === 404) return null;
            throw err;
          })
        ]);

        if (cancelled) return;

        if (detail?.topic) {
          setTopicMeta(prev => {
            const normalized = learningApi.normalizeTopic(detail.topic) || {};
            return {
              ...(prev || {}),
              ...normalized,
              raw: detail.topic,
            };
          });
        }

        setProgress(mergeProgress(detail?.progress_summary, progressData));

        if (contentData) {
          const resources = learningApi.normalizeResourceList(contentData.resources);
          setContent({
            body: contentData.body_markdown || '',
            summary: contentData.summary || '',
            resources,
          });
        } else {
          setContent(null);
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
        /* ignore */
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
        const threshold = err?.body?.data?.pass_threshold;
        setCompleteError(
          threshold !== undefined
            ? `Score below required threshold (${Math.round(Number(threshold) * 100)}%). Please review the material and try again.`
            : 'Score below required threshold. Please review the material and try again.'
        );
      } else if (err?.body?.message) {
        setCompleteError(err.body.message);
      } else {
        setCompleteError('Failed to mark topic complete. Please try again later.');
      }
    } finally {
      setCompleting(false);
    }
  };

  const errorMessage = error?.body?.message || error?.message;

  if (!topicData && loading) {
    return (
      <div style={{ padding: 40 }}>
        <p>Loading topic…</p>
      </div>
    );
  }

  if (!topicData) {
    return (
      <div style={{ padding: 40, textAlign: 'center' }}>
        <h2>Topic not found</h2>
        <button onClick={onBack} style={{ padding: '8px 16px', marginTop: 20 }}>
          ← Back to Home
        </button>
      </div>
    );
  }

  return (
    <div style={{ height: '100vh', display: 'flex', flexDirection: 'column', backgroundColor: '#f8fafc' }}>
      {/* Topic Header */}
      <div style={{ 
        background: 'linear-gradient(135deg, #ffffff 0%, #f8fafc 100%)',
        borderBottom: '1px solid rgba(226, 232, 240, 0.8)',
        boxShadow: '0 2px 8px rgba(0, 0, 0, 0.04)',
        padding: '24px 32px'
      }}>
        {/* Top Row: Back Button + Breadcrumb + Status */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            <button 
              onClick={onBack}
              style={{
                background: 'rgba(34, 197, 94, 0.1)',
                border: '1px solid rgba(34, 197, 94, 0.2)',
                borderRadius: '8px',
                padding: '10px 16px',
                cursor: 'pointer',
                fontSize: '14px',
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
              fontSize: '14px', 
              color: '#64748b',
              fontWeight: '500'
            }}>
              <span>{section?.name}</span>
              <span style={{ color: '#cbd5e1' }}>→</span>
              <span>{module?.name}</span>
            </div>
          </div>
          
          {completed && (
            <div style={{
              background: 'linear-gradient(135def, #10b981, #059669)',
              color: 'white',
              padding: '6px 12px',
              borderRadius: '16px',
              fontSize: '12px',
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
          fontSize: '32px', 
          fontWeight: '700', 
          margin: '0 0 20px 0', 
          background: 'linear-gradient(135deg, #0f172a 0%, #334155 100%)',
          WebkitBackgroundClip: 'text',
          WebkitTextFillColor: 'transparent',
          backgroundClip: 'text',
          lineHeight: '1.2'
        }}>
          {topicData.name}
        </h1>

        {/* Tab Navigation */}
        <div style={{ display: 'flex', gap: 8 }}>
          {[
            { key: 'content', label: 'Content', icon: '📖' },
            { key: 'conversation', label: 'Discussion', icon: '💬' },
            { key: 'scenario', label: 'Practice', icon: '🎯' }
          ].map(({ key, label, icon }) => (
            <button
              key={key}
              onClick={() => setTab(key)}
              style={{
                padding: '10px 16px',
                background: tab === key 
                  ? 'linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)' 
                  : 'rgba(37, 99, 235, 0.1)',
                color: tab === key ? 'white' : '#2563eb',
                border: tab === key 
                  ? 'none' 
                  : '1px solid rgba(37, 99, 235, 0.2)',
                borderRadius: '8px',
                cursor: 'pointer',
                fontSize: '14px',
                fontWeight: '600',
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                transition: 'all 0.2s ease',
                boxShadow: tab === key ? '0 4px 12px rgba(37, 99, 235, 0.3)' : 'none'
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
            padding: '12px 40px',
            margin: '0 auto',
            maxWidth: 960,
            color: '#991b1b',
            background: '#fee2e2',
            borderBottom: '1px solid #fecaca'
          }}>
            {errorMessage || 'We could not load the latest topic data. Showing cached information.'}
          </div>
        )}

        {tab === 'content' && (
          <div style={{
            padding: '36px 40px',
            maxWidth: 960,
            margin: '0 auto',
            display: 'flex',
            flexDirection: 'column',
            gap: 24
          }}>
            <section style={{
              background: 'linear-gradient(135deg, #1d4ed8 0%, #0ea5e9 100%)',
              color: '#f8fafc',
              padding: '32px',
              borderRadius: 24,
              boxShadow: '0 16px 36px rgba(14,165,233,0.25)',
              position: 'relative',
              overflow: 'hidden'
            }}>
              <div style={{ position: 'absolute', inset: 0, opacity: 0.1, background: 'radial-gradient(circle at top right, #ffffff 0%, transparent 60%)' }} />
              <div style={{ position: 'relative', display: 'flex', flexDirection: 'column', gap: 24 }}>
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
                      {section.name}
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
                      {module.name}
                    </span>
                  )}
                </div>
                <div>
                  <h2 style={{
                    margin: 0,
                    fontSize: 32,
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
                    fontSize: 16,
                    color: 'rgba(248,250,252,0.9)'
                  }}>
                    {topicData?.intro || content?.summary || 'Content for this topic is being developed.'}
                  </p>
                </div>
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
                  gap: 16
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

            <section style={{
              backgroundColor: '#ffffff',
              borderRadius: 20,
              padding: 28,
              boxShadow: '0 12px 30px rgba(15,23,42,0.08)'
            }}>
              <div style={{ marginBottom: 16 }}>
                <h3 style={{ margin: 0, fontSize: 22, color: '#0f172a' }}>Detailed content</h3>
                <p style={{ margin: '6px 0 0', color: '#64748b', fontSize: 14 }}>Review the foundational concepts before moving into discussion or practice.</p>
              </div>
              <div className="ai-message-content">
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
                  <h3 style={{ margin: 0, fontSize: 22 }}>Key takeaways</h3>
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
                  <h3 style={{ margin: 0, fontSize: 22, color: '#0f172a' }}>Apply what you learn</h3>
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
                <h3 style={{ margin: 0, fontSize: 22, color: '#0f172a' }}>Supporting resources</h3>
                <p style={{ margin: '6px 0 0', color: '#64748b', fontSize: 14 }}>Continue your exploration with curated reads and references.</p>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {/* 主题特定的资源 */}
                {resources.map((resource, idx) => (
                  <a
                    key={`topic-resource-${idx}`}
                    href={resource.url || '#'}
                    target="_blank"
                    rel="noreferrer"
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      padding: '16px 18px',
                      borderRadius: 14,
                      border: '1px solid #e2e8f0',
                      textDecoration: 'none',
                      color: '#0f172a',
                      transition: 'transform 0.2s ease, box-shadow 0.2s ease',
                      boxShadow: '0 6px 14px rgba(15,23,42,0.06)'
                    }}
                    onMouseOver={(e) => {
                      e.currentTarget.style.transform = 'translateY(-2px)';
                      e.currentTarget.style.boxShadow = '0 12px 24px rgba(15,23,42,0.12)';
                    }}
                    onMouseOut={(e) => {
                      e.currentTarget.style.transform = 'translateY(0)';
                      e.currentTarget.style.boxShadow = '0 6px 14px rgba(15,23,42,0.06)';
                    }}
                  >
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                      <span style={{ fontWeight: 600, fontSize: 15 }}>{resource.title || 'Resource link'}</span>
                      <span style={{ fontSize: 13, color: '#64748b' }}>{resource.source || 'External reference'}</span>
                    </div>
                    <span style={{ fontSize: 18, color: '#2563eb' }}>↗</span>
                  </a>
                ))}
                
                {/* 全局资源 - 从配置文件读取 */}
                {globalResources.map((resource, idx) => (
                  <a
                    key={`global-resource-${idx}`}
                    href={resource.url}
                    target="_blank"
                    rel="noreferrer"
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      padding: '16px 18px',
                      borderRadius: 14,
                      border: '1px solid #e2e8f0',
                      textDecoration: 'none',
                      color: '#0f172a',
                      transition: 'transform 0.2s ease, box-shadow 0.2s ease',
                      boxShadow: '0 6px 14px rgba(15,23,42,0.06)'
                    }}
                    onMouseOver={(e) => {
                      e.currentTarget.style.transform = 'translateY(-2px)';
                      e.currentTarget.style.boxShadow = '0 12px 24px rgba(15,23,42,0.12)';
                    }}
                    onMouseOut={(e) => {
                      e.currentTarget.style.transform = 'translateY(0)';
                      e.currentTarget.style.boxShadow = '0 6px 14px rgba(15,23,42,0.06)';
                    }}
                  >
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                      <span style={{ fontWeight: 600, fontSize: 15 }}>{resource.title}</span>
                      <span style={{ fontSize: 13, color: '#64748b' }}>{resource.source}</span>
                    </div>
                    <span style={{ fontSize: 18, color: '#2563eb' }}>↗</span>
                  </a>
                ))}
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
                    <h3 style={{ margin: 0, fontSize: 22, color: '#0f172a' }}>Progress tracker</h3>
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

      <div style={{ padding: '24px 20px', borderTop: '1px solid #e5e7eb', backgroundColor: '#fff' }}>
        <div style={{ display: 'flex', gap: 16, alignItems: 'flex-end' }}>
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
              flex: 1,
              padding: '16px 20px',
              border: '2px solid #e5e7eb',
              borderRadius: '16px',
              resize: 'none',
              fontSize: '16px',
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
              padding: '16px 24px',
              backgroundColor: input.trim() ? '#3b82f6' : '#ccc',
              color: 'white',
              border: 'none',
              borderRadius: '12px',
              cursor: input.trim() ? 'pointer' : 'not-allowed',
              fontSize: '16px',
              fontWeight: '600',
              height: '56px',
              boxShadow: input.trim() ? '0 2px 8px rgba(59, 130, 246, 0.3)' : 'none',
              transition: 'all 0.2s ease'
            }}
          >
            Send
          </button>
        </div>
      </div>
    </div>
  );
}

// ScenarioSim Component - handles scenario simulations
function ScenarioSim({ topic }) {
  const [started, setStarted] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);
  const [decisions, setDecisions] = useState([]);

  const scenarios = [
    {
      title: "Board Meeting Challenge",
      description: "Navigate a complex board decision scenario",
      steps: [
        {
          situation: "The board is divided on a major strategic decision...",
          options: ["Call for more data", "Push for immediate vote", "Suggest compromise"]
        }
      ]
    }
  ];

  const scenario = scenarios[0];

  if (!started) {
    return (
      <div style={{ padding: 40, textAlign: 'center', maxWidth: 600, margin: '0 auto' }}>
        <h2>Interactive Scenario</h2>
        <div style={{ 
          padding: 24, 
          backgroundColor: '#f0f9ff', 
          borderRadius: 12, 
          marginBottom: 24 
        }}>
          <h3>{scenario.title}</h3>
          <p>{scenario.description}</p>
        </div>
        <button
          onClick={() => setStarted(true)}
          style={{
            backgroundColor: '#3b82f6',
            color: 'white',
            border: 'none',
            padding: '12px 24px',
            borderRadius: 8,
            fontSize: 16,
            fontWeight: '600',
            cursor: 'pointer'
          }}
        >
          Start Scenario
        </button>
      </div>
    );
  }

  const step = scenario.steps[currentStep];

  return (
    <div style={{ padding: 40, maxWidth: 800, margin: '0 auto' }}>
      <div style={{ marginBottom: 24 }}>
        <div style={{ fontSize: 12, color: '#6b7280' }}>
          Step {currentStep + 1} of {scenario.steps.length}
        </div>
        <h2>{scenario.title}</h2>
      </div>

      <div style={{ 
        padding: 24, 
        backgroundColor: '#f8f9fa', 
        borderRadius: 12, 
        marginBottom: 24 
      }}>
        <p style={{ fontSize: 16, lineHeight: 1.6 }}>{step.situation}</p>
      </div>

      <div style={{ marginBottom: 24 }}>
        <h3>What would you do?</h3>
        {step.options.map((option, idx) => (
          <button
            key={idx}
            onClick={() => {
              setDecisions([...decisions, option]);
              if (currentStep < scenario.steps.length - 1) {
                setCurrentStep(currentStep + 1);
              }
            }}
            style={{
              display: 'block',
              width: '100%',
              padding: 16,
              marginBottom: 12,
              backgroundColor: 'white',
              border: '2px solid #e5e7eb',
              borderRadius: 8,
              textAlign: 'left',
              cursor: 'pointer',
              fontSize: 14,
              transition: 'border-color 0.2s'
            }}
            onMouseOver={(e) => e.target.style.borderColor = '#3b82f6'}
            onMouseOut={(e) => e.target.style.borderColor = '#e5e7eb'}
          >
            {option}
          </button>
        ))}
      </div>
    </div>
  );
}

// Main Home Component
export default function Home({ user, onSignOut }) {
  const [structure, setStructure] = useState(() => fallbackSections);
  const [structureSource, setStructureSource] = useState('local');
  const [structureLoading, setStructureLoading] = useState(true);
  const [structureError, setStructureError] = useState(null);
  const [topicsIndex, setTopicsIndex] = useState(() => buildTopicIndex(fallbackSections));
  const [topicId, setTopicId] = useState(null);
  const [showOverview, setShowOverview] = useState(false);
  const [showAssessment, setShowAssessment] = useState(false);
  const [navUi, setNavUi] = useState({
    collapsed: false,
    sectionsOpen: {},
    modulesOpen: {}
  });

  const onSelectTopic = (id) => setTopicId(id);
  const onBackToHome = () => setTopicId(null);
  
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

    async function loadStructure() {
      setStructureLoading(true);
      try {
        const remote = await learningApi.fetchStructure();
        if (cancelled) return;
        if (remote && remote.length > 0) {
          setStructure(remote);
          setTopicsIndex(buildTopicIndex(remote));
          setStructureSource('api');
          setStructureError(null);
        } else {
          setStructure(fallbackSections);
          setTopicsIndex(buildTopicIndex(fallbackSections));
          setStructureSource('local');
        }
      } catch (err) {
        if (!cancelled) {
          console.error('Failed to load learning structure', err);
          setStructureError(err);
          setStructure(fallbackSections);
          setTopicsIndex(buildTopicIndex(fallbackSections));
          setStructureSource('local');
        }
      } finally {
        if (!cancelled) {
          setStructureLoading(false);
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
          onStartAssessment={() => setShowAssessment(true)}
          onToggleSidebar={onToggleCollapsed}
          onBackToHome={onBackToHome}
          onSignOut={onSignOut}
          onProfile={() => console.log('Profile clicked')}
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

      <AssessmentModal 
        open={showAssessment} 
        onClose={() => setShowAssessment(false)} 
        onSubmit={(res) => {
          dbApi.addAssessmentRecord(user.email, { 
            score: res.score, 
            breakdown: [], 
            advice: 'Focus on core modules' 
          });
        }} 
      />
    </div>
  );
}
