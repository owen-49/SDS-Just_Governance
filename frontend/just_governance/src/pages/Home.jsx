import React, { useEffect, useMemo, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import Header from '../components/Header';
import Sidebar from '../components/Sidebar';
import Modal from '../components/Modal';
import AssessmentModal from '../components/AssessmentModal';
import { dbApi } from '../lib/localDb';
import { findTopicById } from '../data/structure';
import { aiAsk } from '../lib/api';

function GlobalChat({ email }) {
  const [list, setList] = useState(() => dbApi.globalConvs(email));
  const [currentId, setCurrentId] = useState(list[0]?.id || null);
  const current = useMemo(() => list.find(c => c.id === currentId) || null, [list, currentId]);
  const [input, setInput] = useState('');

  useEffect(() => { dbApi.saveGlobalConvs(email, list); }, [email, list]);

  // Migrate historical conversation titles (one-time operation)
  useEffect(() => {
    const needsMigration = list.some(conv => 
      conv.title.includes('Conversation #') || 
      conv.title.includes('#') ||
      (conv.title === 'New Conversation' && !conv.title.includes('💬'))
    );
    if (needsMigration) {
      const migratedList = list.map((conv) => {
        if (conv.title.includes('Conversation #') || conv.title.includes('#') || (conv.title === 'New Conversation' && !conv.title.includes('💬'))) {
          const firstUserMessage = conv.messages.find(m => m.role === 'user');
          
          if (firstUserMessage) {
            const cleanMessage = firstUserMessage.text.trim().replace(/\n/g, ' ');
            const messageTitle = cleanMessage.length <= 40 ? cleanMessage : cleanMessage.substring(0, 37) + '...';
            return { ...conv, title: `💭 ${messageTitle}` };
          } else {
            // Use conversation creation time
            const timestamp = conv.updatedAt || Date.now();
            const date = new Date(timestamp);
            const timeString = date.toLocaleString('en-US', {
              month: 'short',
              day: 'numeric',
              hour: '2-digit',
              minute: '2-digit',
              hour12: false
            });
            return { ...conv, title: `💬 New Conversation · ${timeString}` };
          }
        }
        return conv;
      });
      setList(migratedList);
    }
  }, [list, setList]);

  // Helper function to generate title based on message content
  const generateTitleFromMessage = (message) => {
    const now = new Date();
    const timeString = now.toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false
    });
    
    if (!message || message.trim().length === 0) {
      return `💬 New Conversation · ${timeString}`;
    }
    
    // Extract first 40 characters as title content
    const cleanMessage = message.trim().replace(/\n/g, ' ');
    const messageTitle = cleanMessage.length <= 40 ? cleanMessage : cleanMessage.substring(0, 37) + '...';
    
    return `💭 ${messageTitle}`;
  };

  const newConv = () => {
    const id = Math.random().toString(36).slice(2);
    
    // Generate beautiful default title
    const now = new Date();
    const timeString = now.toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false
    });
    
    const title = `💬 New Conversation · ${timeString}`;
    
    const c = { id, title, messages: [], updatedAt: Date.now() };
    setList(prev => [c, ...prev]);
    setCurrentId(id);
  };

  const send = async () => {
    if (!current) return;
    const text = input.trim();
    if (!text) return;
    
    // Check if this is the first message, update title if so
    const isFirstMessage = current.messages.length === 0;
    const newTitle = isFirstMessage ? generateTitleFromMessage(text) : current.title;
    
    // First add user message, update title if it's the first message
    setList(prev => prev.map(c => c.id === current.id ? {
      ...c,
      title: newTitle,
      messages: [...c.messages, { role: 'user', text, ts: Date.now() }],
      updatedAt: Date.now()
    } : c));
    setInput('');
    
    try {
      // Call backend API to get AI response
      const response = await aiAsk(text, 'beginner');
      const aiReply = response.answer || 'Sorry, I could not process your question.';
      
      // Add AI response
      setList(prev => prev.map(c => c.id === current.id ? {
        ...c,
        messages: [...c.messages, { role: 'ai', text: aiReply, ts: Date.now() }],
        updatedAt: Date.now()
      } : c));
    } catch (error) {
      console.error('AI API call failed:', error);
      // Add error message
      setList(prev => prev.map(c => c.id === current.id ? {
        ...c,
        messages: [...c.messages, { role: 'ai', text: 'Sorry, I encountered an error while processing your question. Please try again.', ts: Date.now() }],
        updatedAt: Date.now()
      } : c));
    }
  };

  return (
    <div style={{ 
      display: 'grid', 
      gridTemplateRows: 'auto 1fr auto', 
      height: 'calc(100vh - 56px)',
      background: 'linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%)'
    }}>
      <div style={{ 
        padding: '16px 20px', 
        borderBottom: '1px solid rgba(226, 232, 240, 0.8)', 
        display: 'flex', 
        gap: 12, 
        alignItems: 'center',
        background: 'rgba(255, 255, 255, 0.8)',
        backdropFilter: 'blur(10px)',
        position: 'relative',
        zIndex: 200
      }}>
        <select 
          value={currentId || ''} 
          onChange={(e) => setCurrentId(e.target.value)}
          style={{
            padding: '10px 16px',
            border: '1px solid rgba(226, 232, 240, 0.8)',
            borderRadius: '12px',
            background: 'rgba(255, 255, 255, 0.95)',
            backdropFilter: 'blur(15px)',
            fontSize: '15px',
            color: '#374151',
            cursor: 'pointer',
            minWidth: '280px',
            fontWeight: 500,
            boxShadow: '0 4px 12px rgba(0, 0, 0, 0.08)',
            transition: 'all 0.2s ease'
          }}
          onFocus={(e) => {
            e.target.style.borderColor = '#22c55e';
            e.target.style.boxShadow = '0 0 0 3px rgba(34, 197, 94, 0.15), 0 4px 12px rgba(0, 0, 0, 0.08)';
          }}
          onBlur={(e) => {
            e.target.style.borderColor = 'rgba(226, 232, 240, 0.8)';
            e.target.style.boxShadow = '0 4px 12px rgba(0, 0, 0, 0.08)';
          }}
        >
          {list.map(c => <option key={c.id} value={c.id}>{c.title}</option>)}
        </select>
        <button 
          onClick={newConv}
          style={{
            padding: '10px 20px',
            background: 'linear-gradient(135deg, #22c55e 0%, #16a34a 100%)',
            color: 'white',
            border: 'none',
            borderRadius: '12px',
            cursor: 'pointer',
            fontSize: '15px',
            fontWeight: 600,
            transition: 'all 0.2s ease',
            boxShadow: '0 4px 12px rgba(34, 197, 94, 0.3)',
            display: 'flex',
            alignItems: 'center',
            gap: '8px'
          }}
          onMouseOver={(e) => {
            e.target.style.transform = 'translateY(-1px)';
            e.target.style.boxShadow = '0 6px 16px rgba(34, 197, 94, 0.4)';
          }}
          onMouseOut={(e) => {
            e.target.style.transform = 'translateY(0)';
            e.target.style.boxShadow = '0 4px 12px rgba(34, 197, 94, 0.3)';
          }}
        >
          <span>💬</span> New Conversation
        </button>
        {current && (
          <details style={{ position: 'relative', display: 'inline-block', zIndex: 1000 }}>
            <summary style={{
              listStyle: 'none',
              cursor: 'pointer',
              padding: '8px 12px',
              background: 'rgba(0, 0, 0, 0.9)',
              backdropFilter: 'blur(10px)',
              border: '1px solid rgba(34, 197, 94, 0.3)',
              borderRadius: '8px',
              fontSize: '14px',
              color: '#ffffff'
            }}>
              ⋯ More
            </summary>
            <div style={{ 
              position: 'absolute', 
              background: 'rgba(0, 0, 0, 0.95)',
              backdropFilter: 'blur(20px)',
              border: '1px solid rgba(34, 197, 94, 0.3)', 
              padding: '8px', 
              borderRadius: '8px',
              boxShadow: '0 8px 32px rgba(0, 0, 0, 0.5)',
              zIndex: 1001,
              minWidth: '150px',
              right: 0,
              top: '100%',
              marginTop: '4px'
            }}>
              <button 
                onClick={() => {
                  const title = prompt('Rename conversation', current.title) || current.title;
                  setList(prev => prev.map(c => c.id === current.id ? { ...c, title } : c));
                }}
                style={{
                  width: '100%',
                  textAlign: 'left',
                  padding: '8px 12px',
                  border: 'none',
                  background: 'transparent',
                  cursor: 'pointer',
                  fontSize: '14px',
                  color: '#ffffff',
                  borderRadius: '4px',
                  transition: 'background 0.2s ease'
                }}
                onMouseOver={(e) => e.target.style.background = 'rgba(34, 197, 94, 0.2)'}
                onMouseOut={(e) => e.target.style.background = 'transparent'}
              >
                ✏️ Rename
              </button>
              <button 
                onClick={() => {
                  if (window.confirm('Delete this conversation?')) {
                    setList(prev => prev.filter(c => c.id !== current.id));
                    setCurrentId(null);
                  }
                }}
                style={{
                  width: '100%',
                  textAlign: 'left',
                  padding: '8px 12px',
                  border: 'none',
                  background: 'transparent',
                  cursor: 'pointer',
                  fontSize: '14px',
                  color: '#dc2626',
                  borderRadius: '4px',
                  transition: 'background 0.2s ease'
                }}
                onMouseOver={(e) => e.target.style.background = 'rgba(220, 38, 38, 0.08)'}
                onMouseOut={(e) => e.target.style.background = 'transparent'}
              >
                🗑️ Delete
              </button>
            </div>
          </details>
        )}
      </div>
      <div className="scroll-container" style={{ 
        padding: '20px', 
        overflow: 'auto',
        background: 'linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%)',
        scrollBehavior: 'smooth',
        height: '100%',
        position: 'relative',
        zIndex: 1
      }}>
        {!current && (
          <div style={{ 
            textAlign: 'center', 
            color: '#64748b', 
            marginTop: 80,
            padding: '40px 20px'
          }}>
            <div style={{
              fontSize: '48px',
              marginBottom: '16px',
              opacity: 0.6
            }}>
              💬
            </div>
            <h3 style={{ 
              margin: '0 0 12px 0', 
              color: '#374151',
              fontSize: '20px',
              fontWeight: 600
            }}>
              No conversations yet
            </h3>
            <p style={{ margin: '0 0 24px 0', fontSize: '16px' }}>
              Start a new conversation to explore governance knowledge
            </p>
            <button 
              onClick={newConv}
              style={{
                padding: '12px 24px',
                background: 'linear-gradient(135deg, #22c55e 0%, #16a34a 100%)',
                color: 'white',
                border: 'none',
                borderRadius: '12px',
                cursor: 'pointer',
                fontSize: '16px',
                fontWeight: 600,
                transition: 'all 0.3s ease',
                boxShadow: '0 4px 12px rgba(34, 197, 94, 0.3)',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '8px'
              }}
              onMouseOver={(e) => {
                e.target.style.transform = 'translateY(-2px)';
                e.target.style.boxShadow = '0 8px 20px rgba(34, 197, 94, 0.4)';
              }}
              onMouseOut={(e) => {
                e.target.style.transform = 'translateY(0)';
                e.target.style.boxShadow = '0 4px 12px rgba(34, 197, 94, 0.3)';
              }}
            >
              🚀 Start New Conversation
            </button>
          </div>
        )}
        {current && (
          <div style={{ 
            maxWidth: '900px', 
            margin: '0 auto', 
            padding: '0 20px',
            paddingBottom: '20px'
          }}>
            {current.messages.map((m, i) => (
              <div key={i} className="chat-message" style={{ 
                display: 'flex', 
                justifyContent: m.role === 'user' ? 'flex-end' : 'flex-start',
                margin: '24px 0',
                animation: 'messageSlideIn 0.3s ease-out'
              }}>
                {/* Message Content */}
                <div style={{ 
                  maxWidth: '75%',
                  minWidth: 0
                }}>
                  {/* Header with role and timestamp */}
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    marginBottom: '8px',
                    justifyContent: m.role === 'user' ? 'flex-end' : 'flex-start'
                  }}>
                    <span style={{
                      fontWeight: '600',
                      fontSize: '14px',
                      color: '#374151'
                    }}>
                      {m.role === 'user' ? 'You' : 'AI Assistant'}
                    </span>
                    <span style={{
                      fontSize: '12px',
                      color: '#9ca3af'
                    }}>
                      {new Date(m.ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                  
                  {/* Message bubble */}
                  <div style={{ 
                    background: m.role === 'user' 
                      ? 'linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)' 
                      : 'linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%)',
                    color: m.role === 'user' ? 'white' : '#111827',
                    padding: '16px 20px',
                    borderRadius: '12px',
                    position: 'relative',
                    boxShadow: m.role === 'user' 
                      ? '0 4px 12px rgba(37, 99, 235, 0.3)' 
                      : '0 2px 8px rgba(0, 0, 0, 0.08)',
                    border: m.role === 'user' ? 'none' : '1px solid #e2e8f0'
                  }}>
                    
                    <div className="markdown-content" style={{
                      fontSize: '15px',
                      lineHeight: '1.6',
                      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif'
                    }}>
                      <ReactMarkdown 
                        remarkPlugins={[remarkGfm]}
                        components={{
                          p: ({children}) => <p style={{margin: '0 0 12px 0'}}>{children}</p>,
                          h1: ({children}) => <h1 style={{fontSize: '20px', fontWeight: '700', margin: '0 0 12px 0'}}>{children}</h1>,
                          h2: ({children}) => <h2 style={{fontSize: '18px', fontWeight: '600', margin: '16px 0 8px 0'}}>{children}</h2>,
                          h3: ({children}) => <h3 style={{fontSize: '16px', fontWeight: '600', margin: '12px 0 6px 0'}}>{children}</h3>,
                          ul: ({children}) => <ul style={{margin: '8px 0', paddingLeft: '20px'}}>{children}</ul>,
                          ol: ({children}) => <ol style={{margin: '8px 0', paddingLeft: '20px'}}>{children}</ol>,
                          li: ({children}) => <li style={{margin: '4px 0'}}>{children}</li>,
                          code: ({children}) => <code style={{
                            background: m.role === 'user' ? 'rgba(255, 255, 255, 0.2)' : '#f1f5f9',
                            padding: '3px 6px',
                            borderRadius: '4px',
                            fontSize: '14px',
                            fontFamily: 'ui-monospace, SFMono-Regular, "SF Mono", "Cascadia Code", "Roboto Mono", Menlo, Monaco, Consolas, monospace',
                            color: m.role === 'user' ? 'rgba(255, 255, 255, 0.9)' : '#1f2937',
                            border: m.role === 'user' ? '1px solid rgba(255, 255, 255, 0.3)' : '1px solid #e2e8f0'
                          }}>{children}</code>,
                          pre: ({children}) => <pre style={{
                            background: '#1f2937',
                            color: '#f9fafb',
                            padding: '16px',
                            borderRadius: '8px',
                            margin: '12px 0',
                            overflow: 'auto',
                            fontSize: '14px',
                            fontFamily: 'ui-monospace, SFMono-Regular, "SF Mono", "Cascadia Code", "Roboto Mono", Menlo, Monaco, Consolas, monospace',
                            boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)'
                          }}>{children}</pre>,
                          blockquote: ({children}) => <blockquote style={{
                            borderLeft: m.role === 'user' ? '4px solid rgba(255, 255, 255, 0.5)' : '4px solid #3b82f6',
                            paddingLeft: '16px',
                            margin: '12px 0',
                            fontStyle: 'italic',
                            color: m.role === 'user' ? 'rgba(255, 255, 255, 0.9)' : '#6b7280',
                            background: m.role === 'user' ? 'rgba(255, 255, 255, 0.1)' : '#f8fafc',
                            padding: '12px 16px',
                            borderRadius: '0 8px 8px 0'
                          }}>{children}</blockquote>,
                          table: ({children}) => <table style={{
                            borderCollapse: 'collapse',
                            width: '100%',
                            margin: '16px 0',
                            boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)',
                            borderRadius: '8px',
                            overflow: 'hidden'
                          }}>{children}</table>,
                          th: ({children}) => <th style={{
                            background: m.role === 'user' ? 'rgba(255, 255, 255, 0.2)' : '#f8fafc',
                            padding: '12px',
                            textAlign: 'left',
                            fontWeight: '600',
                            color: m.role === 'user' ? 'white' : '#374151',
                            borderBottom: '2px solid #e2e8f0'
                          }}>{children}</th>,
                          td: ({children}) => <td style={{
                            padding: '12px',
                            borderBottom: '1px solid #e2e8f0',
                            color: m.role === 'user' ? 'rgba(255, 255, 255, 0.9)' : '#111827'
                          }}>{children}</td>
                        }}
                      >
                        {m.text}
                      </ReactMarkdown>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
      <div style={{ 
        padding: '16px 20px', 
        borderTop: '1px solid rgba(226, 232, 240, 0.8)', 
        display: 'flex', 
        gap: 12,
        background: 'rgba(255, 255, 255, 0.9)',
        backdropFilter: 'blur(10px)',
        position: 'relative',
        zIndex: 100
      }}>
        <textarea 
          rows={4} 
          style={{ 
            flex: 1,
            padding: '16px 20px',
            border: '1px solid rgba(226, 232, 240, 0.8)',
            borderRadius: '12px',
            background: 'rgba(255, 255, 255, 0.9)',
            backdropFilter: 'blur(10px)',
            fontSize: '15px',
            lineHeight: '1.5',
            resize: 'none',
            outline: 'none',
            transition: 'border-color 0.2s ease, box-shadow 0.2s ease'
          }}
          value={input} 
          onChange={(e) => setInput(e.target.value)} 
          placeholder="Ask anything about governance..."
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              send();
            }
          }}
          onFocus={(e) => {
            e.target.style.borderColor = '#2563eb';
            e.target.style.boxShadow = '0 0 0 3px rgba(37, 99, 235, 0.15)';
          }}
          onBlur={(e) => {
            e.target.style.borderColor = 'rgba(226, 232, 240, 0.8)';
            e.target.style.boxShadow = 'none';
          }}
        />
        <button 
          onClick={send}
          disabled={!input.trim()}
          style={{
            padding: '12px 20px',
            background: input.trim() 
              ? 'linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)' 
              : 'rgba(156, 163, 175, 0.5)',
            color: 'white',
            border: 'none',
            borderRadius: '12px',
            cursor: input.trim() ? 'pointer' : 'not-allowed',
            fontSize: '15px',
            fontWeight: 600,
            transition: 'all 0.2s ease',
            boxShadow: input.trim() ? '0 4px 12px rgba(37, 99, 235, 0.3)' : 'none'
          }}
          onMouseOver={(e) => {
            if (input.trim()) {
              e.target.style.transform = 'translateY(-1px)';
              e.target.style.boxShadow = '0 6px 16px rgba(37, 99, 235, 0.4)';
            }
          }}
          onMouseOut={(e) => {
            if (input.trim()) {
              e.target.style.transform = 'translateY(0)';
              e.target.style.boxShadow = '0 4px 12px rgba(37, 99, 235, 0.3)';
            }
          }}
        >
          📤 Send
        </button>
      </div>
    </div>
  );
}

function TopicPage({ topicId, email, onBack }) {
  const found = findTopicById(topicId);
  const { section, module, topic } = found || {};
  const [tab, setTab] = useState('content'); // content | conversation | scenario
  const [chat, setChat] = useState(() => dbApi.topicChat(email, topicId));
  const [progress, setProgress] = useState(() => dbApi.topicProgress(email, topicId));

  useEffect(() => { dbApi.saveTopicChat(email, topicId, chat); }, [email, topicId, chat]);
  useEffect(() => { dbApi.saveTopicProgress(email, topicId, progress); }, [email, topicId, progress]);

  const send = async (text) => {
    // Add user message first
    setChat(c => ({ ...c, messages: [...c.messages, { role: 'user', text, ts: Date.now() }], updatedAt: Date.now() }));
    
    try {
      // Call backend AI API with topic context
      const contextualPrompt = `In the context of the topic "${topic.name}", please answer: ${text}`;
      const response = await aiAsk(contextualPrompt, 'beginner');
      const aiReply = response.answer || 'Sorry, I could not process your question.';
      
      // Add AI response
      setChat(c => ({ ...c, messages: [...c.messages, { role: 'ai', text: aiReply, ts: Date.now() }], updatedAt: Date.now() }));
    } catch (error) {
      console.error('AI API call failed:', error);
      // Add error message
      setChat(c => ({ ...c, messages: [...c.messages, { role: 'ai', text: 'Sorry, I encountered an error while processing your question. Please try again.', ts: Date.now() }], updatedAt: Date.now() }));
    }
  };

  const QuizCard = () => {
    const [open, setOpen] = useState(false);
    const [answers, setAnswers] = useState({});
    const [result, setResult] = useState(null);
    const qs = topic.quiz?.questions || [];
    const total = qs.length;

    const submit = () => {
      let score = 0; const details = [];
      qs.forEach(q => {
        const a = answers[q.id];
        const ok = a === q.answer;
        score += (ok ? 1 : 0) * (100 / total);
        details.push({ id: q.id, ok, your: a, answer: q.answer, exp: q.explanation });
      });
      const finalScore = Math.round(score);
      setResult({ score: finalScore, details });
      setProgress(p => ({ ...p, lastScore: finalScore, eligible: finalScore >= 80 }));
    };

    return (
      <div style={{ border: '1px solid #e5e7eb', borderRadius: 12, marginTop: 16 }}>
        <div style={{ padding: 12, display: 'flex', justifyContent: 'space-between', background: '#fafafa', borderBottom: '1px solid #eee' }}>
          <div>Topic quiz ({total} questions)</div>
          <button onClick={() => setOpen(o => !o)}>{open ? 'Collapse' : 'Start'}</button>
        </div>
        {open && (
          <div style={{ padding: 12 }}>
            {qs.map((q, i) => (
              <div key={q.id} style={{ marginBottom: 12 }}>
                <div style={{ fontWeight: 600 }}>Q{i + 1}. {q.stem}</div>
                <div>
                  {q.options.map((op, idx) => (
                    <label key={idx} style={{ display: 'block', margin: '6px 0' }}>
                      <input type="radio" name={q.id} checked={answers[q.id] === idx} onChange={() => setAnswers(a => ({ ...a, [q.id]: idx }))} /> {op}
                    </label>
                  ))}
                </div>
              </div>
            ))}
            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <button onClick={submit}>Submit</button>
            </div>
            {result && (
              <div style={{ marginTop: 12 }}>
                <div>Total: {result.score}%</div>
                {result.score >= 80 ? (
                  <div style={{ color: '#16a34a' }}>Great! You may mark this topic as Completed.</div>
                ) : (
                  <div>
                    <div style={{ color: '#b91c1c' }}>Below threshold. Suggested: review key points and try again.</div>
                    <button onClick={() => { setAnswers({}); setResult(null); }}>Try again</button>
                  </div>
                )}
                <div style={{ marginTop: 8 }}>
                  {result.details.map((d, idx) => (
                    <div key={idx} style={{ borderTop: '1px dashed #e5e7eb', paddingTop: 8, marginTop: 8 }}>
                      <div>Q{idx + 1}: {d.ok ? 'Correct' : 'Incorrect'}</div>
                      <div>Your answer: {JSON.stringify(d.your)} — Correct: {JSON.stringify(d.answer)}</div>
                      <div>Explanation: {d.exp}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="scroll-container" style={{ 
      height: 'calc(100vh - 56px)', 
      overflow: 'auto',
      position: 'relative'
    }}>
      <div style={{ position: 'sticky', top: 0, background: '#fff', zIndex: 300, borderBottom: '1px solid #eee', boxShadow: '0 2px 4px rgba(0, 0, 0, 0.1)' }}>
        <div style={{ padding: 12, color: '#334155', display: 'flex', alignItems: 'center', gap: 8 }}>
          {onBack && (
            <button 
              onClick={onBack}
              style={{
                background: 'none',
                border: 'none',
                color: '#3b82f6',
                cursor: 'pointer',
                padding: '4px 8px',
                borderRadius: '4px',
                fontSize: '14px',
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
                transition: 'background-color 0.2s'
              }}
              onMouseOver={(e) => e.target.style.backgroundColor = '#eff6ff'}
              onMouseOut={(e) => e.target.style.backgroundColor = 'transparent'}
              title="Back to Home"
            >
              ← Back
            </button>
          )}
          <span>{section?.name} / {module?.name} / {topic?.name}</span>
        </div>
        <div style={{ padding: '0 12px 12px', display: 'flex', alignItems: 'center', gap: 8 }}>
          <h2 style={{ margin: '6px 0' }}>{topic?.name}</h2>
          <span style={{ padding: '2px 8px', borderRadius: 999, background: progress.completed ? '#16a34a' : '#e5e7eb', color: progress.completed ? '#fff' : '#111827' }}>{progress.completed ? 'Completed' : 'Not Completed'}</span>
          {progress.eligible && !progress.completed && (
            <button onClick={() => setProgress(p => ({ ...p, completed: true }))} style={{ marginLeft: 'auto' }}>Mark as Completed</button>
          )}
          {progress.completed && (
            <button onClick={() => { if (window.confirm('Unmark as completed?')) setProgress(p => ({ ...p, completed: false })); }}>Unmark</button>
          )}
        </div>
        <div style={{ display: 'flex', gap: 8, padding: '0 12px 12px' }}>
          <button onClick={() => setTab('content')} style={{ background: tab === 'content' ? '#111827' : '#e5e7eb', color: tab === 'content' ? '#fff' : '#111827', borderRadius: 6, padding: '6px 10px' }}>Content</button>
          <button onClick={() => setTab('conversation')} style={{ background: tab === 'conversation' ? '#111827' : '#e5e7eb', color: tab === 'conversation' ? '#fff' : '#111827', borderRadius: 6, padding: '6px 10px' }}>Conversation</button>
          {topic?.scenario && (
            <button onClick={() => setTab('scenario')} style={{ background: tab === 'scenario' ? '#111827' : '#e5e7eb', color: tab === 'scenario' ? '#fff' : '#111827', borderRadius: 6, padding: '6px 10px' }}>Scenario Simulation</button>
          )}
        </div>
      </div>
      {tab === 'content' && (
        <div style={{ padding: 16, maxWidth: 840 }}>
          <p style={{ color: '#334155' }}>{topic.intro}</p>
          <div style={{ marginTop: 12 }}>
            <h3>Key points</h3>
            <ul>
              {topic.keyPoints.map((kp, i) => <li key={i}>{kp}</li>)}
            </ul>
          </div>
          {topic.resources?.length > 0 && (
            <div style={{ marginTop: 12 }}>
              <h3>Recommended resources</h3>
              <ul>
                {topic.resources.map((r, i) => (
                  <li key={i}><a href={r.url} target="_blank" rel="noreferrer">{r.title}</a> — {r.source}</li>
                ))}
              </ul>
            </div>
          )}
          <QuizCard />
        </div>
      )}
      {tab === 'conversation' && (
        <div style={{ display: 'grid', gridTemplateRows: '1fr auto', height: 'calc(100% - 120px)', minHeight: '400px' }}>
          <div className="scroll-container" style={{ 
            padding: '16px 20px', 
            overflow: 'auto',
            scrollBehavior: 'smooth',
            maxHeight: '100%',
            position: 'relative',
            zIndex: 1
          }}>
            {chat.messages.length === 0 && (
              <div style={{ 
                color: '#64748b', 
                textAlign: 'center', 
                padding: '40px 20px',
                fontSize: '15px',
                background: 'linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%)',
                borderRadius: '12px',
                border: '1px solid #e2e8f0'
              }}>
                💡 Try: "Explain the main risks in this topic"
              </div>
            )}
            {chat.messages.map((m, i) => (
              <div key={i} className="chat-message" style={{ 
                display: 'flex', 
                justifyContent: m.role === 'user' ? 'flex-end' : 'flex-start',
                margin: '20px 0'
              }}>
                {/* Message Content */}
                <div style={{ 
                  maxWidth: '80%',
                  minWidth: 0
                }}>
                  {/* Header with role and timestamp */}
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    marginBottom: '6px',
                    justifyContent: m.role === 'user' ? 'flex-end' : 'flex-start'
                  }}>
                    <span style={{
                      fontWeight: '600',
                      fontSize: '13px',
                      color: '#374151'
                    }}>
                      {m.role === 'user' ? 'You' : 'AI Assistant'}
                    </span>
                    <span style={{
                      fontSize: '11px',
                      color: '#9ca3af'
                    }}>
                      {new Date(m.ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                  
                  {/* Message bubble */}
                  <div style={{ 
                    background: m.role === 'user' 
                      ? 'linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)' 
                      : 'linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%)',
                    color: m.role === 'user' ? 'white' : '#111827',
                    padding: '12px 16px',
                    borderRadius: '12px',
                    position: 'relative',
                    boxShadow: m.role === 'user' 
                      ? '0 3px 8px rgba(37, 99, 235, 0.25)' 
                      : '0 2px 6px rgba(0, 0, 0, 0.06)',
                    border: m.role === 'user' ? 'none' : '1px solid #e2e8f0'
                  }}>
                    
                    <div className="markdown-content" style={{
                      fontSize: '14px',
                      lineHeight: '1.6',
                      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif'
                    }}>
                      <ReactMarkdown 
                        remarkPlugins={[remarkGfm]}
                        components={{
                          p: ({children}) => <p style={{margin: '0 0 8px 0'}}>{children}</p>,
                          h1: ({children}) => <h1 style={{fontSize: '18px', fontWeight: '700', margin: '0 0 8px 0'}}>{children}</h1>,
                          h2: ({children}) => <h2 style={{fontSize: '16px', fontWeight: '600', margin: '12px 0 6px 0'}}>{children}</h2>,
                          h3: ({children}) => <h3 style={{fontSize: '15px', fontWeight: '600', margin: '10px 0 4px 0'}}>{children}</h3>,
                          ul: ({children}) => <ul style={{margin: '6px 0', paddingLeft: '18px'}}>{children}</ul>,
                          ol: ({children}) => <ol style={{margin: '6px 0', paddingLeft: '18px'}}>{children}</ol>,
                          li: ({children}) => <li style={{margin: '2px 0'}}>{children}</li>,
                          code: ({children}) => <code style={{
                            background: m.role === 'user' ? 'rgba(255, 255, 255, 0.2)' : '#f1f5f9',
                            padding: '2px 4px',
                            borderRadius: '3px',
                            fontSize: '13px',
                            fontFamily: 'ui-monospace, SFMono-Regular, "SF Mono", "Cascadia Code", "Roboto Mono", Menlo, Monaco, Consolas, monospace',
                            color: m.role === 'user' ? 'rgba(255, 255, 255, 0.9)' : '#1f2937',
                            border: m.role === 'user' ? '1px solid rgba(255, 255, 255, 0.3)' : '1px solid #e2e8f0'
                          }}>{children}</code>,
                          pre: ({children}) => <pre style={{
                            background: '#1f2937',
                            color: '#f9fafb',
                            padding: '12px',
                            borderRadius: '6px',
                            margin: '8px 0',
                            overflow: 'auto',
                            fontSize: '13px',
                            fontFamily: 'ui-monospace, SFMono-Regular, "SF Mono", "Cascadia Code", "Roboto Mono", Menlo, Monaco, Consolas, monospace',
                            boxShadow: '0 2px 4px rgba(0, 0, 0, 0.1)'
                          }}>{children}</pre>
                        }}
                      >
                        {m.text}
                      </ReactMarkdown>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
          <div style={{ 
            padding: 12, 
            borderTop: '1px solid #eee', 
            display: 'flex', 
            gap: 8,
            background: 'rgba(255, 255, 255, 0.95)',
            backdropFilter: 'blur(10px)',
            position: 'sticky',
            bottom: 0,
            zIndex: 50
          }}>
            <TopicInput onSend={send} />
          </div>
        </div>
      )}
      {tab === 'scenario' && (
        <ScenarioSim topic={topic} onSend={(text) => {/* no-op persistent */}} />
      )}
    </div>
  );
}

function TopicInput({ onSend }) {
  const [text, setText] = useState('');
  
  const handleSend = () => {
    if (text.trim()) { 
      onSend(text.trim()); 
      setText(''); 
    }
  };
  
  return (
    <>
      <textarea 
        rows={3} 
        style={{ 
          flex: 1,
          padding: '12px 16px',
          border: '1px solid #e5e7eb',
          borderRadius: '8px',
          fontSize: '14px',
          lineHeight: '1.5',
          resize: 'none',
          outline: 'none',
          transition: 'border-color 0.2s ease'
        }} 
        value={text} 
        onChange={(e) => setText(e.target.value)} 
        placeholder="Ask within this topic..."
        onKeyDown={(e) => {
          if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSend();
          }
        }}
        onFocus={(e) => {
          e.target.style.borderColor = '#2563eb';
        }}
        onBlur={(e) => {
          e.target.style.borderColor = '#e5e7eb';
        }}
      />
      <button 
        onClick={handleSend}
        style={{
          padding: '12px 20px',
          background: text.trim() ? '#2563eb' : '#e5e7eb',
          color: text.trim() ? 'white' : '#9ca3af',
          border: 'none',
          borderRadius: '8px',
          cursor: text.trim() ? 'pointer' : 'not-allowed',
          fontSize: '14px',
          fontWeight: 600,
          transition: 'all 0.2s ease'
        }}
        disabled={!text.trim()}
      >
        Send
      </button>
    </>
  );
}

function ScenarioSim({ topic }) {
  const [history, setHistory] = useState([]);
  const [input, setInput] = useState('');
  
  const submit = async () => {
    if (!input.trim()) return;
    
    // Add user input to history first
    setHistory(h => [...h, { you: input }]);
    
    try {
      // Call AI API for scenario-based response
      const scenarioPrompt = `In a governance scenario simulation for "${topic.name}", a participant says: "${input}". Please provide constructive feedback and specific suggestions for improvement in their communication and approach.`;
      const response = await aiAsk(scenarioPrompt, 'beginner');
      const aiReply = response.answer || 'Good response. Consider these general suggestions for improvement.';
      
      // Add AI response to history
      setHistory(h => [...h, { ai: aiReply }]);
    } catch (error) {
      console.error('AI API call failed:', error);
      // Add fallback response
      const fallbackReply = `In the scenario of ${topic.name}, consider these suggestions:
• Be concise and cite evidence
• Invite collaboration from stakeholders  
• Close with a clear next step`;
      setHistory(h => [...h, { ai: fallbackReply }]);
    }
    
    setInput('');
  };
  
  return (
    <div style={{ padding: 16 }}>
      <div style={{ color: '#334155', marginBottom: 12 }}>Scenario description: Practice in-situ responses and get improvement suggestions.</div>
      <div>
        {history.map((h, i) => (
          <div key={i} style={{ margin: '8px 0' }}>
            {'you' in h ? (
              <div><strong>You:</strong> {h.you}</div>
            ) : (
              <div>
                <strong>AI:</strong> {h.ai}
              </div>
            )}
          </div>
        ))}
      </div>
      <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
        <textarea 
          rows={3} 
          style={{ 
            flex: 1,
            padding: '12px 16px',
            border: '1px solid #e5e7eb',
            borderRadius: '8px',
            fontSize: '14px',
            lineHeight: '1.5',
            resize: 'none',
            outline: 'none'
          }} 
          value={input} 
          onChange={(e) => setInput(e.target.value)} 
          placeholder="Your speech/action"
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              submit();
            }
          }}
        />
        <button 
          onClick={submit}
          style={{
            padding: '12px 20px',
            background: input.trim() ? '#2563eb' : '#e5e7eb',
            color: input.trim() ? 'white' : '#9ca3af',
            border: 'none',
            borderRadius: '8px',
            cursor: input.trim() ? 'pointer' : 'not-allowed',
            fontSize: '14px',
            fontWeight: 600
          }}
          disabled={!input.trim()}
        >
          Run
        </button>
      </div>
      <div style={{ marginTop: 8, display: 'flex', gap: 8 }}>
        <button onClick={() => setHistory([])}>Restart</button>
        <button onClick={() => setHistory([])}>Another scenario</button>
      </div>
    </div>
  );
}

export default function Home({ user, onSignOut }) {
  const [navUi, setNavUi] = useState(() => dbApi.navUi(user.email));
  const [topicId, setTopicId] = useState(null);
  const [showOverview, setShowOverview] = useState(false);
  const [showAssessment, setShowAssessment] = useState(false);

  useEffect(() => {
    const listener = () => setTopicId(null);
    window.addEventListener('jg:goHome', listener);
    return () => window.removeEventListener('jg:goHome', listener);
  }, []);

  useEffect(() => { dbApi.saveNavUi(user.email, navUi); }, [user.email, navUi]);

  useEffect(() => {
    const cu = dbApi.currentUser();
    if (cu && !cu.projectOverviewSeen) {
      setShowOverview(true);
      dbApi.setProjectOverviewSeen(cu.email);
    }
  }, []);

  const onToggleCollapsed = () => setNavUi(ui => ({ ...ui, collapsed: !ui.collapsed }));
  const onToggleSection = (id) => setNavUi(ui => ({ ...ui, expanded: { ...ui.expanded, [id]: !ui.expanded[id] } }));
  const onToggleModule = (id) => setNavUi(ui => ({ ...ui, expanded: { ...ui.expanded, [id]: !ui.expanded[id] } }));

  const onSelectTopic = (_s, _m, tp) => setTopicId(tp.id);
  
  const onBackToHome = () => setTopicId(null);

  // Add keyboard shortcut for going back (Escape key)
  useEffect(() => {
    const handleKeyDown = (event) => {
      if (event.key === 'Escape' && topicId) {
        onBackToHome();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [topicId]);

  return (
    <div>
      <Header
        user={user}
        onToggleSidebar={onToggleCollapsed}
        onStartAssessment={() => setShowAssessment(true)}
        onOpenOverview={() => setShowOverview(true)}
        onProfile={() => alert('Profile placeholder')}
        onSignOut={onSignOut}
        currentTopicId={topicId}
        onBackToHome={onBackToHome}
      />
      <div style={{ 
        display: 'grid', 
        gridTemplateColumns: `${navUi.collapsed ? 56 : 280}px 1fr`,
        height: 'calc(100vh - 56px)',
        overflow: 'hidden'
      }}>
        <Sidebar
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
          position: 'relative'
        }}>
          {!topicId ? (
            <GlobalChat email={user.email} />
          ) : (
            <TopicPage topicId={topicId} email={user.email} onBack={onBackToHome} />
          )}
        </main>
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
            <button onClick={() => setShowOverview(false)} style={{ padding: '8px 12px', background: '#111827', color: '#fff', border: 'none', borderRadius: 6 }}>Get Started</button>
            <button onClick={() => setShowOverview(false)} style={{ padding: '8px 12px' }}>Maybe later</button>
          </div>
        </div>
      </Modal>

      <AssessmentModal open={showAssessment} onClose={() => setShowAssessment(false)} onSubmit={(res) => {
        dbApi.addAssessmentRecord(user.email, { score: res.score, breakdown: [], advice: 'Focus on core modules' });
      }} />
    </div>
  );
}
