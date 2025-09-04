import React, { useEffect, useMemo, useState } from 'react';
import Header from '../components/Header';
import Sidebar from '../components/Sidebar';
import Modal from '../components/Modal';
import AssessmentModal from '../components/AssessmentModal';
import { dbApi } from '../lib/localDb';
import { findTopicById } from '../data/structure';
import { aiAsk } from '../lib/api';

// 统一的 Markdown 格式化组件
const FormattedMessage = ({ text, role }) => {
  if (!text) return '';
  
  // 处理行内 Markdown 格式的辅助函数
  const formatInlineMarkdown = (text) => {
    if (!text) return '';
    
    // 处理行内代码
    const parts = text.split(/(`[^`]+`)/);
    return parts.map((part, index) => {
      if (part.startsWith('`') && part.endsWith('`') && part.length > 2) {
        return (
          <code key={index} style={{
            background: role === 'user' ? 'rgba(255,255,255,0.2)' : 'rgba(107, 114, 128, 0.1)',
            color: role === 'user' ? 'rgba(255,255,255,0.9)' : '#dc2626',
            padding: '2px 6px',
            borderRadius: '4px',
            fontFamily: '"Fira Code", "Monaco", monospace',
            fontSize: '0.9em'
          }}>
            {part.slice(1, -1)}
          </code>
        );
      } else {
        // 处理加粗文本 **text**
        const boldParts = part.split(/(\*\*[^*]+\*\*)/);
        return boldParts.map((boldPart, boldIndex) => {
          if (boldPart.startsWith('**') && boldPart.endsWith('**') && boldPart.length > 4) {
            return <strong key={`${index}-${boldIndex}`}>{boldPart.slice(2, -2)}</strong>;
          } else {
            // 处理斜体文本 *text*
            const italicParts = boldPart.split(/(\*[^*]+\*)/);
            return italicParts.map((italicPart, italicIndex) => {
              if (italicPart.startsWith('*') && italicPart.endsWith('*') && italicPart.length > 2 && !italicPart.includes('**')) {
                return <em key={`${index}-${boldIndex}-${italicIndex}`}>{italicPart.slice(1, -1)}</em>;
              } else {
                return italicPart;
              }
            });
          }
        });
      }
    });
  };
  
  // 先处理代码块（多行）
  const codeBlockParts = text.split(/(```[\s\S]*?```)/);
  
  return (
    <div style={{ fontSize: '16px', lineHeight: '1.7' }}>
      {codeBlockParts.map((part, index) => {
        if (part.startsWith('```') && part.endsWith('```') && part.length > 6) {
          const code = part.slice(3, -3).trim();
          const lines = code.split('\n');
          const language = lines[0] && !lines[0].includes(' ') ? lines[0] : '';
          const codeContent = language ? lines.slice(1).join('\n') : code;
          
          return (
            <pre key={index} style={{
              background: role === 'user' ? 'rgba(255,255,255,0.15)' : '#1f2937',
              color: role === 'user' ? 'rgba(255,255,255,0.95)' : '#e5e7eb',
              padding: '16px',
              borderRadius: '8px',
              margin: '12px 0',
              overflow: 'auto',
              fontFamily: '"Fira Code", "Monaco", monospace',
              fontSize: '0.9em',
              lineHeight: '1.4',
              position: 'relative'
            }}>
              {language && (
                <div style={{
                  position: 'absolute',
                  top: '8px',
                  right: '12px',
                  fontSize: '11px',
                  color: role === 'user' ? 'rgba(255,255,255,0.7)' : '#9ca3af',
                  textTransform: 'uppercase',
                  fontWeight: 500
                }}>
                  {language}
                </div>
              )}
              <code>{codeContent}</code>
            </pre>
          );
        }
        
        // 处理段落和其他元素
        const lines = part.split('\n');
        return lines.map((line, lineIndex) => {
          // 处理标题
          if (line.startsWith('### ')) {
            return (
              <h3 key={`${index}-${lineIndex}`} style={{
                fontSize: '1.25em',
                fontWeight: 'bold',
                margin: '16px 0 8px 0',
                color: role === 'user' ? 'inherit' : '#1f2937'
              }}>
                {formatInlineMarkdown(line.slice(4))}
              </h3>
            );
          }
          if (line.startsWith('## ')) {
            return (
              <h2 key={`${index}-${lineIndex}`} style={{
                fontSize: '1.5em',
                fontWeight: 'bold',
                margin: '20px 0 10px 0',
                color: role === 'user' ? 'inherit' : '#1f2937'
              }}>
                {formatInlineMarkdown(line.slice(3))}
              </h2>
            );
          }
          if (line.startsWith('# ')) {
            return (
              <h1 key={`${index}-${lineIndex}`} style={{
                fontSize: '1.75em',
                fontWeight: 'bold',
                margin: '24px 0 12px 0',
                color: role === 'user' ? 'inherit' : '#1f2937'
              }}>
                {formatInlineMarkdown(line.slice(2))}
              </h1>
            );
          }
          
          // 处理引用
          if (line.startsWith('> ')) {
            return (
              <blockquote key={`${index}-${lineIndex}`} style={{
                borderLeft: role === 'user' ? '4px solid rgba(255,255,255,0.5)' : '4px solid #3b82f6',
                background: role === 'user' ? 'rgba(255,255,255,0.1)' : 'rgba(59, 130, 246, 0.05)',
                padding: '12px 16px',
                margin: '12px 0',
                fontStyle: 'italic',
                color: 'inherit'
              }}>
                {formatInlineMarkdown(line.slice(2))}
              </blockquote>
            );
          }
          
          // 处理列表项
          if (line.match(/^[\s]*[-*+]\s/)) {
            return (
              <div key={`${index}-${lineIndex}`} style={{
                display: 'flex',
                alignItems: 'flex-start',
                margin: '4px 0',
                paddingLeft: '16px'
              }}>
                <span style={{ 
                  marginRight: '8px', 
                  color: role === 'user' ? 'rgba(255,255,255,0.8)' : '#3b82f6'
                }}>•</span>
                <span>{formatInlineMarkdown(line.replace(/^[\s]*[-*+]\s/, ''))}</span>
              </div>
            );
          }
          
          // 处理有序列表
          if (line.match(/^[\s]*\d+\.\s/)) {
            const number = line.match(/^[\s]*(\d+)\./)[1];
            return (
              <div key={`${index}-${lineIndex}`} style={{
                display: 'flex',
                alignItems: 'flex-start',
                margin: '4px 0',
                paddingLeft: '16px'
              }}>
                <span style={{ 
                  marginRight: '8px', 
                  color: role === 'user' ? 'rgba(255,255,255,0.8)' : '#3b82f6',
                  fontWeight: 'bold' 
                }}>{number}.</span>
                <span>{formatInlineMarkdown(line.replace(/^[\s]*\d+\.\s/, ''))}</span>
              </div>
            );
          }
          
          // 空行处理
          if (line.trim() === '') {
            return <br key={`${index}-${lineIndex}`} />;
          }
          
          // 普通段落
          return (
            <p key={`${index}-${lineIndex}`} style={{ margin: '8px 0', lineHeight: '1.6' }}>
              {formatInlineMarkdown(line)}
            </p>
          );
        });
      })}
    </div>
  );
};

function GlobalChat({ email }) {
  const [list, setList] = useState(() => dbApi.globalConvs(email));
  const [currentId, setCurrentId] = useState(list[0]?.id || null);
  const current = useMemo(() => list.find(c => c.id === currentId) || null, [list, currentId]);
  const [input, setInput] = useState('');

  useEffect(() => { dbApi.saveGlobalConvs(email, list); }, [email, list]);

  // 迁移历史对话标题（一次性）
  useEffect(() => {
    const needsMigration = list.some(conv => 
      conv.title.includes('对话 #') || 
      (conv.title === 'New Conversation' && !conv.title.includes('#'))
    );
    if (needsMigration) {
      const migratedList = list.map((conv, index) => {
        if (conv.title.includes('对话 #') || (conv.title === 'New Conversation' && !conv.title.includes('#'))) {
          // 使用对话的创建时间或第一条消息时间
          const timestamp = conv.messages.length > 0 ? conv.messages[0].ts : conv.updatedAt;
          const date = new Date(timestamp || Date.now());
          const timeString = date.toLocaleString('en-US', {
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit',
            hour12: false
          });
          
          const firstUserMessage = conv.messages.find(m => m.role === 'user');
          const number = list.length - index;
          
          if (firstUserMessage) {
            const cleanMessage = firstUserMessage.text.trim().replace(/\n/g, ' ');
            const messageTitle = cleanMessage.length <= 30 ? cleanMessage : cleanMessage.substring(0, 27) + '...';
            return { ...conv, title: `#${number} ${messageTitle} - ${timeString}` };
          } else {
            return { ...conv, title: `#${number} New Conversation - ${timeString}` };
          }
        }
        return conv;
      });
      setList(migratedList);
    }
  }, [list, setList]);

  // 根据消息内容生成标题的辅助函数
  const generateTitleFromMessage = (message) => {
    const now = new Date();
    const timeString = now.toLocaleString('en-US', {
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false
    });
    
    // 计算下一个对话编号
    const existingNumbers = list
      .map(conv => {
        const match = conv.title.match(/#(\d+)/);
        return match ? parseInt(match[1]) : 0;
      })
      .filter(num => num > 0);
    
    const nextNumber = existingNumbers.length > 0 ? Math.max(...existingNumbers) + 1 : 1;
    
    if (!message || message.trim().length === 0) {
      return `#${nextNumber} New Conversation - ${timeString}`;
    }
    
    // 截取前30个字符作为标题内容
    const cleanMessage = message.trim().replace(/\n/g, ' ');
    const messageTitle = cleanMessage.length <= 30 ? cleanMessage : cleanMessage.substring(0, 27) + '...';
    
    return `#${nextNumber} ${messageTitle} - ${timeString}`;
  };

  const newConv = () => {
    const id = Math.random().toString(36).slice(2);
    
    // 生成带编号和时间的默认标题
    const now = new Date();
    const timeString = now.toLocaleString('en-US', {
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false
    });
    
    // 计算下一个对话编号
    const existingNumbers = list
      .map(conv => {
        const match = conv.title.match(/#(\d+)/);
        return match ? parseInt(match[1]) : 0;
      })
      .filter(num => num > 0);
    
    const nextNumber = existingNumbers.length > 0 ? Math.max(...existingNumbers) + 1 : 1;
    const title = `#${nextNumber} New Conversation - ${timeString}`;
    
    const c = { id, title, messages: [], updatedAt: Date.now() };
    setList(prev => [c, ...prev]);
    setCurrentId(id);
  };

  const send = async () => {
    if (!current) return;
    const text = input.trim();
    if (!text) return;
    
    // 检查是否是第一条消息，如果是则更新标题
    const isFirstMessage = current.messages.length === 0;
    const newTitle = isFirstMessage ? generateTitleFromMessage(text) : current.title;
    
    // 先添加用户消息，如果是第一条消息同时更新标题
    setList(prev => prev.map(c => c.id === current.id ? {
      ...c,
      title: newTitle,
      messages: [...c.messages, { role: 'user', text, ts: Date.now() }],
      updatedAt: Date.now()
    } : c));
    setInput('');
    
    try {
      // 调用后端API获取AI回复
      const response = await aiAsk(text, 'beginner');
      const aiReply = response.answer || 'Sorry, I could not process your question.';
      
      // 添加AI回复
      setList(prev => prev.map(c => c.id === current.id ? {
        ...c,
        messages: [...c.messages, { role: 'ai', text: aiReply, ts: Date.now() }],
        updatedAt: Date.now()
      } : c));
    } catch (error) {
      console.error('AI API call failed:', error);
      // 添加错误提示
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
        backdropFilter: 'blur(10px)'
      }}>
        <select 
          value={currentId || ''} 
          onChange={(e) => setCurrentId(e.target.value)}
          style={{
            padding: '8px 12px',
            border: '1px solid rgba(226, 232, 240, 0.8)',
            borderRadius: '8px',
            background: 'rgba(255, 255, 255, 0.9)',
            backdropFilter: 'blur(10px)',
            fontSize: '14px',
            color: '#374151',
            cursor: 'pointer',
            minWidth: '200px'
          }}
        >
          {list.map(c => <option key={c.id} value={c.id}>{c.title}</option>)}
        </select>
        <button 
          onClick={newConv}
          style={{
            padding: '8px 16px',
            background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
            color: 'white',
            border: 'none',
            borderRadius: '8px',
            cursor: 'pointer',
            fontSize: '14px',
            fontWeight: 600,
            transition: 'all 0.2s ease',
            boxShadow: '0 4px 12px rgba(16, 185, 129, 0.3)'
          }}
          onMouseOver={(e) => {
            e.target.style.transform = 'translateY(-1px)';
            e.target.style.boxShadow = '0 6px 16px rgba(16, 185, 129, 0.4)';
          }}
          onMouseOut={(e) => {
            e.target.style.transform = 'translateY(0)';
            e.target.style.boxShadow = '0 4px 12px rgba(16, 185, 129, 0.3)';
          }}
        >
          ➕ New Conversation
        </button>
        {current && (
          <details style={{ position: 'relative' }}>
            <summary style={{
              listStyle: 'none',
              cursor: 'pointer',
              padding: '8px 12px',
              background: 'rgba(255, 255, 255, 0.9)',
              backdropFilter: 'blur(10px)',
              border: '1px solid rgba(226, 232, 240, 0.8)',
              borderRadius: '8px',
              fontSize: '14px',
              color: '#6b7280'
            }}>
              ⋯ More
            </summary>
            <div style={{ 
              position: 'absolute', 
              background: 'rgba(255, 255, 255, 0.95)',
              backdropFilter: 'blur(20px)',
              border: '1px solid rgba(226, 232, 240, 0.8)', 
              padding: '8px', 
              borderRadius: '8px',
              boxShadow: '0 8px 32px rgba(0, 0, 0, 0.12)',
              zIndex: 10,
              minWidth: '150px'
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
                  color: '#374151',
                  borderRadius: '4px',
                  transition: 'background 0.2s ease'
                }}
                onMouseOver={(e) => e.target.style.background = 'rgba(0, 0, 0, 0.04)'}
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
      <div style={{ 
        padding: '20px', 
        overflow: 'auto',
        background: 'linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%)'
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
              Start a new conversation to begin your governance journey
            </p>
            <button 
              onClick={newConv}
              style={{
                padding: '12px 24px',
                background: 'linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)',
                color: 'white',
                border: 'none',
                borderRadius: '12px',
                cursor: 'pointer',
                fontSize: '16px',
                fontWeight: 600,
                transition: 'all 0.3s ease',
                boxShadow: '0 4px 12px rgba(37, 99, 235, 0.3)'
              }}
              onMouseOver={(e) => {
                e.target.style.transform = 'translateY(-2px)';
                e.target.style.boxShadow = '0 8px 20px rgba(37, 99, 235, 0.4)';
              }}
              onMouseOut={(e) => {
                e.target.style.transform = 'translateY(0)';
                e.target.style.boxShadow = '0 4px 12px rgba(37, 99, 235, 0.3)';
              }}
            >
              🚀 Start New Conversation
            </button>
          </div>
        )}
        {current && (
          <div style={{ maxWidth: '900px', margin: '0 auto' }}>
            {current.messages.map((m, i) => (
              <div key={i} style={{ 
                display: 'flex', 
                justifyContent: m.role === 'user' ? 'flex-end' : 'flex-start', 
                margin: '16px 0',
                animation: 'messageSlideIn 0.3s ease-out'
              }}>
                <div style={{ 
                  background: m.role === 'user' 
                    ? 'linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)' 
                    : 'linear-gradient(135deg, #ffffff 0%, #f8fafc 100%)',
                  color: m.role === 'user' ? '#fff' : '#111827', 
                  padding: '16px 20px', 
                  borderRadius: m.role === 'user' ? '20px 20px 6px 20px' : '20px 20px 20px 6px',
                  maxWidth: '80%',
                  boxShadow: m.role === 'user' 
                    ? '0 4px 12px rgba(37, 99, 235, 0.3)' 
                    : '0 2px 8px rgba(0, 0, 0, 0.08)',
                  border: m.role === 'user' ? 'none' : '1px solid rgba(226, 232, 240, 0.8)',
                  position: 'relative'
                }}>
                  {m.role === 'ai' && (
                    <div style={{
                      position: 'absolute',
                      top: '-8px',
                      left: '12px',
                      width: 0,
                      height: 0,
                      borderLeft: '8px solid transparent',
                      borderRight: '8px solid transparent',
                      borderBottom: '8px solid rgba(255, 255, 255, 0.9)'
                    }}></div>
                  )}
                  {m.role === 'user' && (
                    <div style={{
                      position: 'absolute',
                      top: '-8px',
                      right: '12px',
                      width: 0,
                      height: 0,
                      borderLeft: '8px solid transparent',
                      borderRight: '8px solid transparent',
                      borderBottom: '8px solid #1d4ed8'
                    }}></div>
                  )}
                  <FormattedMessage text={m.text} role={m.role} />
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
        backdropFilter: 'blur(10px)'
      }}>
        <textarea 
          rows={2} 
          style={{ 
            flex: 1,
            padding: '12px 16px',
            border: '1px solid rgba(226, 232, 240, 0.8)',
            borderRadius: '12px',
            background: 'rgba(255, 255, 255, 0.9)',
            backdropFilter: 'blur(10px)',
            fontSize: '15px',
            resize: 'none',
            outline: 'none',
            transition: 'border-color 0.2s ease, box-shadow 0.2s ease'
          }}
          value={input} 
          onChange={(e) => setInput(e.target.value)} 
          placeholder="Ask anything about governance..."
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

function TopicPage({ topicId, email }) {
  const found = findTopicById(topicId);
  const { section, module, topic } = found || {};
  const [tab, setTab] = useState('content'); // content | conversation | scenario
  const [chat, setChat] = useState(() => dbApi.topicChat(email, topicId));
  const [progress, setProgress] = useState(() => dbApi.topicProgress(email, topicId));

  useEffect(() => { dbApi.saveTopicChat(email, topicId, chat); }, [email, topicId, chat]);
  useEffect(() => { dbApi.saveTopicProgress(email, topicId, progress); }, [email, topicId, progress]);

  const send = (text) => {
    const aiReply = `Good point on ${topic.name}. Here's more to consider...`;
    setChat(c => ({ ...c, messages: [...c.messages, { role: 'user', text, ts: Date.now() }, { role: 'ai', text: aiReply, ts: Date.now() }], updatedAt: Date.now() }));
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
    <div style={{ height: 'calc(100vh - 56px)', overflow: 'auto' }}>
      <div style={{ position: 'sticky', top: 0, background: '#fff', zIndex: 1, borderBottom: '1px solid #eee' }}>
        <div style={{ padding: 12, color: '#334155' }}>
          {section?.name} / {module?.name} / {topic?.name}
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
        <div style={{ display: 'grid', gridTemplateRows: '1fr auto', height: 'calc(100% - 110px)' }}>
          <div style={{ padding: 16, overflow: 'auto' }}>
            {chat.messages.length === 0 && (
              <div style={{ color: '#64748b' }}>Try: "Explain the main risks in this topic"</div>
            )}
            {chat.messages.map((m, i) => (
              <div key={i} style={{ display: 'flex', justifyContent: m.role === 'user' ? 'flex-end' : 'flex-start', margin: '12px 0' }}>
                <div style={{ 
                  background: m.role === 'user' 
                    ? 'linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)' 
                    : 'linear-gradient(135deg, #f1f5f9 0%, #e2e8f0 100%)', 
                  color: m.role === 'user' ? '#fff' : '#111827', 
                  padding: '12px 16px', 
                  borderRadius: m.role === 'user' ? '18px 18px 4px 18px' : '18px 18px 18px 4px', 
                  maxWidth: '85%',
                  boxShadow: m.role === 'user' 
                    ? '0 3px 8px rgba(37, 99, 235, 0.25)' 
                    : '0 2px 6px rgba(0, 0, 0, 0.06)'
                }}>
                  <FormattedMessage text={m.text} role={m.role} />
                </div>
              </div>
            ))}
          </div>
          <div style={{ padding: 12, borderTop: '1px solid #eee', display: 'flex', gap: 8 }}>
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
  return (
    <>
      <textarea rows={2} style={{ flex: 1 }} value={text} onChange={(e) => setText(e.target.value)} placeholder="Ask within this topic..." />
      <button onClick={() => { if (text.trim()) { onSend(text.trim()); setText(''); } }}>Send</button>
    </>
  );
}

function ScenarioSim({ topic }) {
  const [history, setHistory] = useState([]);
  const [input, setInput] = useState('');
  const submit = () => {
    if (!input.trim()) return;
    const cont = `In the scenario of ${topic.name}, someone challenges your point. Consider acknowledging and reframing...`;
    setHistory(h => [...h, { you: input }, { ai: cont }]);
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
                <ul>
                  <li>Suggestion 1: Be concise and cite evidence</li>
                  <li>Suggestion 2: Invite collaboration</li>
                  <li>Suggestion 3: Close with a clear next step</li>
                </ul>
              </div>
            )}
          </div>
        ))}
      </div>
      <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
        <textarea rows={2} style={{ flex: 1 }} value={input} onChange={(e) => setInput(e.target.value)} placeholder="Your speech/action" />
        <button onClick={submit}>Run</button>
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

  return (
    <div>
      <Header
        user={user}
        onToggleSidebar={onToggleCollapsed}
        onStartAssessment={() => setShowAssessment(true)}
        onOpenOverview={() => setShowOverview(true)}
        onProfile={() => alert('Profile placeholder')}
        onSignOut={onSignOut}
      />
      <div style={{ display: 'grid', gridTemplateColumns: `${navUi.collapsed ? 56 : 280}px 1fr` }}>
        <Sidebar
          ui={navUi}
          onToggleCollapsed={onToggleCollapsed}
          onToggleSection={onToggleSection}
          onToggleModule={onToggleModule}
          onSelectTopic={onSelectTopic}
          currentTopicId={topicId}
          user={user}
        />
        <main style={{ background: '#f8fafc' }}>
          {!topicId ? (
            <GlobalChat email={user.email} />
          ) : (
            <TopicPage topicId={topicId} email={user.email} />
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
