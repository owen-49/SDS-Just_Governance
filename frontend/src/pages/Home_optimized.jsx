import React, { useEffect, useMemo, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import Header from '../components/Header';
import Sidebar from '../components/Sidebar';
import Modal from '../components/Modal';
import AssessmentModal from '../components/AssessmentModal';
import GlobalChat from '../components/GlobalChat';
import { dbApi } from '../lib/localDb';
import { findTopicById } from '../data/structure';
import { aiAsk } from '../lib/api';

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
    <div style={{ height: '100vh', display: 'flex', flexDirection: 'column', backgroundColor: '#fff' }}>
      {/* Topic Header */}
      <div style={{ 
        padding: '20px 24px', 
        borderBottom: '1px solid #e5e7eb',
        backgroundColor: '#f8f9fa'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 12 }}>
          <button 
            onClick={onBack}
            style={{
              background: 'none',
              border: '1px solid #d1d5db',
              borderRadius: '6px',
              padding: '8px 12px',
              cursor: 'pointer',
              fontSize: '14px',
              color: '#374151'
            }}
          >
            ← Back
          </button>
          <div>
            <div style={{ fontSize: '12px', color: '#6b7280', marginBottom: 4 }}>
              {section?.title} → {module?.title}
            </div>
            <h1 style={{ fontSize: '24px', fontWeight: '600', margin: 0, color: '#111827' }}>
              {topic.title}
            </h1>
          </div>
          {progress.completed && (
            <span style={{
              backgroundColor: '#10b981',
              color: 'white',
              padding: '4px 8px',
              borderRadius: '12px',
              fontSize: '12px',
              fontWeight: '500'
            }}>
              ✓ Completed
            </span>
          )}
        </div>

        {/* Tab Navigation */}
        <div style={{ display: 'flex', gap: 8 }}>
          {['content', 'conversation', 'scenario'].map(t => (
            <button
              key={t}
              onClick={() => setTab(t)}
              style={{
                padding: '8px 16px',
                backgroundColor: tab === t ? '#3b82f6' : 'transparent',
                color: tab === t ? 'white' : '#6b7280',
                border: '1px solid #d1d5db',
                borderRadius: '6px',
                cursor: 'pointer',
                fontSize: '14px',
                fontWeight: '500',
                textTransform: 'capitalize'
              }}
            >
              {t}
            </button>
          ))}
        </div>
      </div>

      {/* Tab Content */}
      <div style={{ flex: 1, overflow: 'auto' }}>
        {tab === 'content' && (
          <div style={{ padding: 40, maxWidth: 800, margin: '0 auto' }}>
            <ReactMarkdown remarkPlugins={[remarkGfm]}>
              {topic.content || `# ${topic.title}\n\nContent for this topic is being developed.`}
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
        question: text,
        level: 'beginner',
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

      <div style={{ padding: 20, borderTop: '1px solid #e5e7eb' }}>
        <div style={{ display: 'flex', gap: 12 }}>
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
              padding: 12,
              border: '1px solid #d1d5db',
              borderRadius: 8,
              resize: 'none',
              fontSize: 14,
              fontFamily: 'inherit'
            }}
            rows={1}
          />
          <button 
            onClick={send}
            disabled={!input.trim()}
            style={{
              padding: '12px 20px',
              backgroundColor: input.trim() ? '#3b82f6' : '#ccc',
              color: 'white',
              border: 'none',
              borderRadius: 8,
              cursor: input.trim() ? 'pointer' : 'not-allowed',
              fontSize: 14
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
export default function Home({ user }) {
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
          onShowOverview={() => setShowOverview(true)}
          onShowAssessment={() => setShowAssessment(true)}
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
