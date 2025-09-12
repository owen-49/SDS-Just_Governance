import React, { useEffect, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Header, Sidebar } from '../components/layout';
import { Modal } from '../components/ui';
import { AssessmentModal, GlobalChat } from '../components/features';
import { dbApi } from '../services/localDb';
import { findTopicById } from '../constants/structure';
import { aiAsk } from '../services/api';

// TopicPage Component - handles individual topic views
function TopicPage({ topicId, email, onBack }) {
  const found = findTopicById(topicId);
  const { section, module, topic } = found || {};
  const [tab, setTab] = useState('content');
  const [chat, setChat] = useState(() => dbApi.topicChat(email, topicId));
  const [progress, setProgress] = useState(() => dbApi.topicProgress(email, topicId));

  useEffect(() => { 
    dbApi.saveTopicChat(email, topicId, chat); 
  }, [email, topicId, chat]);

  useEffect(() => { 
    dbApi.saveTopicProgress(email, topicId, progress); 
  }, [email, topicId, progress]);

  if (!topic) {
    return (
      <div style={{ padding: 40, textAlign: 'center' }}>
        <h2>Topic not found</h2>
        <button onClick={onBack} style={{ padding: '8px 16px', marginTop: 20 }}>
          ← Back to Home
        </button>
      </div>
    );
  }

  const markComplete = () => {
    setProgress(prev => ({ ...prev, completed: true, completedAt: Date.now() }));
  };

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
          
          {progress.completed && (
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
          {topic.name}
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
        {tab === 'content' && (
          <div style={{ padding: 40, maxWidth: 800, margin: '0 auto' }}>
            <ReactMarkdown remarkPlugins={[remarkGfm]}>
              {topic.content || `# ${topic.name}\n\n${topic.intro || 'Content for this topic is being developed.'}\n\n${topic.keyPoints ? `## Key Points\n${topic.keyPoints.map(point => `- ${point}`).join('\n')}` : ''}`}
            </ReactMarkdown>
            
            {!progress.completed && (
              <div style={{ marginTop: 40, padding: 20, backgroundColor: '#f0f9ff', borderRadius: 8 }}>
                <button
                  onClick={markComplete}
                  style={{
                    backgroundColor: '#3b82f6',
                    color: 'white',
                    border: 'none',
                    padding: '12px 24px',
                    borderRadius: '8px',
                    fontSize: '14px',
                    fontWeight: '600',
                    cursor: 'pointer'
                  }}
                >
                  Mark as Complete
                </button>
              </div>
            )}
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

  const send = async () => {
    const text = input.trim();
    if (!text) return;

    const userMsg = { role: 'user', text, timestamp: Date.now() };
    setChat(prev => ({ ...prev, messages: [...prev.messages, userMsg] }));
    setInput('');

    try {
      const response = await aiAsk({
        module_id: topicId,
        question: text,
        context: chat.messages.slice(-5)
      });
      
      const aiMsg = { 
        role: 'assistant', 
        text: response.answer || 'I need more information to help you with this topic.',
        timestamp: Date.now() 
      };
      
      setChat(prev => ({ ...prev, messages: [...prev.messages, aiMsg] }));
    } catch (error) {
      console.error('Topic AI request failed:', error);
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
        {chat.messages.length === 0 ? (
          <div style={{ textAlign: 'center', marginTop: 100, color: '#6b7280' }}>
            <div style={{ fontSize: '48px', marginBottom: 20 }}>💬</div>
            <h3>Ask questions about this topic</h3>
            <p>Get personalized explanations and dive deeper into the concepts.</p>
          </div>
        ) : (
          chat.messages.map((msg, idx) => (
            <div key={idx} style={{ 
              marginBottom: 20,
              display: 'flex',
              flexDirection: msg.role === 'user' ? 'row-reverse' : 'row'
            }}>
              <div style={{
                maxWidth: '70%',
                padding: '12px 16px',
                borderRadius: '16px',
                backgroundColor: msg.role === 'user' ? '#3b82f6' : '#f1f3f4',
                color: msg.role === 'user' ? 'white' : '#333'
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
            {!topicId ? (
              <GlobalChat email={user.email} />
            ) : (
              <TopicPage 
                topicId={topicId} 
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
