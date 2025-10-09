import React, { useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { useConversations, generateTitleFromMessage, createNewConversation } from '../../hooks/useConversations';
import { aiAsk } from '../../services/api';

const GlobalChat = ({ email }) => {
  const { list, setList, current, currentId, setCurrentId } = useConversations(email);
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [currentTypingText, setCurrentTypingText] = useState('');

  const newConv = () => {
    createNewConversation(setList, setCurrentId);
  };

  const send = async () => {
    if (!current) return;
    const text = input.trim();
    if (!text) return;

    // Update conversation title based on first message
    if (current.messages.length === 0) {
      const newTitle = generateTitleFromMessage(text);
      setList(prev => prev.map(c => 
        c.id === currentId ? { ...c, title: newTitle } : c
      ));
    }

    // Add user message
    const userMsg = { role: 'user', text, timestamp: Date.now() };
    setList(prev => prev.map(c => 
      c.id === currentId 
        ? { ...c, messages: [...c.messages, userMsg], updatedAt: Date.now() }
        : c
    ));
    setInput('');

    // Show "AI is thinking..." prompt
    setIsTyping(true);
    setCurrentTypingText('');

    try {
      // Call AI API
      const aiResponse = await aiAsk({
        module_id: 'general',
        question: text,
        context: current.messages.slice(-5) // Last 5 messages for context
      });

      const fullText = aiResponse.answer || 'Sorry, I couldn\'t generate a response.';
      
      // 打字机效果 - 逐字显示
      let currentIndex = 0;
      const typeNextChar = () => {
        if (currentIndex < fullText.length) {
          setCurrentTypingText(fullText.substring(0, currentIndex + 1));
          currentIndex++;
          setTimeout(typeNextChar, 20); // 每个字符20ms
        } else {
          // 打字完成,添加到消息列表
          const aiMsg = { 
            role: 'assistant', 
            text: fullText,
            timestamp: Date.now() 
          };
          
          setList(prev => prev.map(c => 
            c.id === currentId 
              ? { ...c, messages: [...c.messages, aiMsg], updatedAt: Date.now() }
              : c
          ));
          setIsTyping(false);
          setCurrentTypingText('');
        }
      };
      
      typeNextChar();
    } catch (error) {
      console.error('AI request failed:', error);
      const errorMsg = { 
        role: 'assistant', 
        text: 'Sorry, I encountered an error while processing your request.',
        timestamp: Date.now() 
      };
      
      setList(prev => prev.map(c => 
        c.id === currentId 
          ? { ...c, messages: [...c.messages, errorMsg], updatedAt: Date.now() }
          : c
      ));
      setIsTyping(false);
      setCurrentTypingText('');
    }
  };

  const deleteConv = (convId) => {
    setList(prev => {
      const updated = prev.filter(c => c.id !== convId);
      if (convId === currentId && updated.length > 0) {
        setCurrentId(updated[0].id);
      } else if (updated.length === 0) {
        setCurrentId(null);
      }
      return updated;
    });
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      send();
    }
  };

  return (
    <div style={{ display: 'flex', height: '100vh', fontFamily: 'system-ui, sans-serif' }}>
      {/* Conversation List Sidebar */}
      <div style={{ 
        width: '300px', 
        backgroundColor: '#f8f9fa', 
        borderRight: '1px solid #e9ecef',
        display: 'flex',
        flexDirection: 'column'
      }}>
        <div style={{ 
          padding: '20px', 
          borderBottom: '1px solid #e9ecef',
          backgroundColor: '#fff'
        }}>
          <button 
            onClick={newConv}
            style={{
              width: '100%',
              padding: '12px',
              backgroundColor: '#007bff',
              color: 'white',
              border: 'none',
              borderRadius: '8px',
              fontSize: '14px',
              fontWeight: '500',
              cursor: 'pointer',
              transition: 'background-color 0.2s'
            }}
            onMouseOver={(e) => e.target.style.backgroundColor = '#0056b3'}
            onMouseOut={(e) => e.target.style.backgroundColor = '#007bff'}
          >
            + New Conversation
          </button>
        </div>
        
        <div style={{ flex: 1, overflowY: 'auto', padding: '10px' }}>
          {list.map(conv => (
            <div
              key={conv.id}
              onClick={() => setCurrentId(conv.id)}
              style={{
                padding: '12px',
                marginBottom: '8px',
                backgroundColor: conv.id === currentId ? '#e3f2fd' : 'white',
                border: `1px solid ${conv.id === currentId ? '#2196f3' : '#e9ecef'}`,
                borderRadius: '8px',
                cursor: 'pointer',
                fontSize: '14px',
                lineHeight: '1.4',
                position: 'relative',
                transition: 'all 0.2s'
              }}
              onMouseOver={(e) => {
                if (conv.id !== currentId) {
                  e.target.style.backgroundColor = '#f5f5f5';
                }
              }}
              onMouseOut={(e) => {
                if (conv.id !== currentId) {
                  e.target.style.backgroundColor = 'white';
                }
              }}
            >
              <div style={{ 
                fontWeight: '500', 
                color: '#333',
                marginBottom: '4px',
                paddingRight: '20px'
              }}>
                {conv.title}
              </div>
              <div style={{ 
                fontSize: '12px', 
                color: '#666',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between'
              }}>
                <span>{conv.messages.length} messages</span>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    deleteConv(conv.id);
                  }}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: '#dc3545',
                    cursor: 'pointer',
                    padding: '2px 4px',
                    borderRadius: '4px',
                    fontSize: '12px'
                  }}
                  title="Delete conversation"
                >
                  🗑️
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Chat Area */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
        {current ? (
          <>
            {/* Messages */}
            <div style={{ 
              flex: 1, 
              padding: '20px', 
              overflowY: 'auto',
              backgroundColor: '#fff'
            }}>
              {current.messages.length === 0 ? (
                <div style={{ 
                  textAlign: 'center', 
                  color: '#666', 
                  marginTop: '100px',
                  fontSize: '16px'
                }}>
                  <div style={{ fontSize: '48px', marginBottom: '20px' }}>💬</div>
                  <div>Start a conversation with AI</div>
                  <div style={{ fontSize: '14px', marginTop: '8px' }}>
                    Ask questions about governance, compliance, or any topic
                  </div>
                </div>
              ) : (
                current.messages.map((msg, idx) => (
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
                ))
              )}
              
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
            </div>

            {/* Input Area */}
            <div style={{ 
              padding: '24px', 
              borderTop: '1px solid #e9ecef',
              backgroundColor: '#fff'
            }}>
              <div style={{ display: 'flex', gap: '16px', alignItems: 'flex-end' }}>
                <textarea
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyPress={handleKeyPress}
                  placeholder="Ask me anything about governance..."
                  style={{
                    flex: 1,
                    padding: '18px 24px',
                    border: '2px solid #e9ecef',
                    borderRadius: '20px',
                    resize: 'none',
                    fontSize: '16px',
                    fontFamily: 'inherit',
                    outline: 'none',
                    minHeight: '60px',
                    maxHeight: '160px',
                    lineHeight: '1.4',
                    transition: 'border-color 0.2s ease, box-shadow 0.2s ease'
                  }}
                  rows={2}
                  onFocus={(e) => {
                    e.target.style.borderColor = '#007bff';
                    e.target.style.boxShadow = '0 0 0 3px rgba(0, 123, 255, 0.1)';
                  }}
                  onBlur={(e) => {
                    e.target.style.borderColor = '#e9ecef';
                    e.target.style.boxShadow = 'none';
                  }}
                />
                <button 
                  onClick={send}
                  disabled={!input.trim()}
                  style={{
                    padding: '18px 28px',
                    backgroundColor: input.trim() ? '#007bff' : '#ccc',
                    color: 'white',
                    border: 'none',
                    borderRadius: '20px',
                    cursor: input.trim() ? 'pointer' : 'not-allowed',
                    fontSize: '16px',
                    fontWeight: '600',
                    minWidth: '90px',
                    height: '60px',
                    boxShadow: input.trim() ? '0 4px 12px rgba(0, 123, 255, 0.3)' : 'none',
                    transition: 'all 0.2s ease'
                  }}
                  onMouseOver={(e) => {
                    if (input.trim()) {
                      e.target.style.backgroundColor = '#0056b3';
                      e.target.style.transform = 'translateY(-1px)';
                    }
                  }}
                  onMouseOut={(e) => {
                    if (input.trim()) {
                      e.target.style.backgroundColor = '#007bff';
                      e.target.style.transform = 'translateY(0)';
                    }
                  }}
                >
                  Send
                </button>
              </div>
            </div>
          </>
        ) : (
          <div style={{ 
            flex: 1, 
            display: 'flex', 
            alignItems: 'center', 
            justifyContent: 'center',
            backgroundColor: '#fff'
          }}>
            <div style={{ textAlign: 'center', color: '#666' }}>
              <div style={{ fontSize: '48px', marginBottom: '20px' }}>💬</div>
              <div style={{ fontSize: '18px', marginBottom: '10px' }}>Welcome to AI Chat</div>
              <div style={{ fontSize: '14px' }}>Create a new conversation to get started</div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default GlobalChat;
