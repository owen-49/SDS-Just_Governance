import React, { useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { useConversations, generateTitleFromMessage, createNewConversation } from '../../hooks/useConversations';
import { aiAsk } from '../../services/api';

const GlobalChat = ({ email }) => {
  const { list, setList, current, currentId, setCurrentId } = useConversations(email);
  const [input, setInput] = useState('');

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

    try {
      // Call AI API
      const aiResponse = await aiAsk({
        module_id: 'general',
        question: text,
        context: current.messages.slice(-5) // Last 5 messages for context
      });

      // Add AI response
      const aiMsg = { 
        role: 'assistant', 
        text: aiResponse.answer || 'Sorry, I couldn\'t generate a response.',
        timestamp: Date.now() 
      };
      
      setList(prev => prev.map(c => 
        c.id === currentId 
          ? { ...c, messages: [...c.messages, aiMsg], updatedAt: Date.now() }
          : c
      ));
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
                    marginBottom: '20px',
                    display: 'flex',
                    flexDirection: msg.role === 'user' ? 'row-reverse' : 'row'
                  }}>
                    <div style={{
                      maxWidth: '70%',
                      padding: '12px 16px',
                      borderRadius: '18px',
                      backgroundColor: msg.role === 'user' ? '#007bff' : '#f1f3f4',
                      color: msg.role === 'user' ? 'white' : '#333',
                      marginLeft: msg.role === 'user' ? '0' : '0',
                      marginRight: msg.role === 'user' ? '0' : '0'
                    }}>
                      {msg.role === 'assistant' ? (
                        <ReactMarkdown remarkPlugins={[remarkGfm]}>
                          {msg.text}
                        </ReactMarkdown>
                      ) : (
                        <div style={{ whiteSpace: 'pre-wrap' }}>{msg.text}</div>
                      )}
                    </div>
                  </div>
                ))
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
