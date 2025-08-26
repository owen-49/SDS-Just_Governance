import React, { useEffect, useMemo, useState } from 'react';
import Header from '../components/Header';
import Sidebar from '../components/Sidebar';
import Modal from '../components/Modal';
import AssessmentModal from '../components/AssessmentModal';
import { dbApi } from '../lib/localDb';
import { findTopicById } from '../data/structure';

function GlobalChat({ email }) {
  const [list, setList] = useState(() => dbApi.globalConvs(email));
  const [currentId, setCurrentId] = useState(list[0]?.id || null);
  const current = useMemo(() => list.find(c => c.id === currentId) || null, [list, currentId]);
  const [input, setInput] = useState('');

  useEffect(() => { dbApi.saveGlobalConvs(email, list); }, [email, list]);

  const newConv = () => {
    const id = Math.random().toString(36).slice(2);
    const c = { id, title: 'New Conversation', messages: [], updatedAt: Date.now() };
    setList(prev => [c, ...prev]);
    setCurrentId(id);
  };

  const send = () => {
    if (!current) return;
    const text = input.trim();
    if (!text) return;
    const aiReply = `Thanks for your question: "${text}". Here's a brief suggestion...`;
    setList(prev => prev.map(c => c.id === current.id ? {
      ...c,
      messages: [...c.messages, { role: 'user', text, ts: Date.now() }, { role: 'ai', text: aiReply, ts: Date.now() }],
      updatedAt: Date.now()
    } : c));
    setInput('');
  };

  return (
    <div style={{ display: 'grid', gridTemplateRows: 'auto 1fr auto', height: 'calc(100vh - 56px)' }}>
      <div style={{ padding: 8, borderBottom: '1px solid #eee', display: 'flex', gap: 8, alignItems: 'center' }}>
        <select value={currentId || ''} onChange={(e) => setCurrentId(e.target.value)}>
          {list.map(c => <option key={c.id} value={c.id}>{c.title}</option>)}
        </select>
        <button onClick={newConv}>New Conversation</button>
        {current && (
          <details>
            <summary>More</summary>
            <div style={{ position: 'absolute', background: '#fff', border: '1px solid #eee', padding: 8 }}>
              <button onClick={() => {
                const title = prompt('Rename conversation', current.title) || current.title;
                setList(prev => prev.map(c => c.id === current.id ? { ...c, title } : c));
              }}>Rename</button>
              <button onClick={() => {
                if (window.confirm('Delete this conversation?')) {
                  setList(prev => prev.filter(c => c.id !== current.id));
                  setCurrentId(null);
                }
              }}>Delete</button>
            </div>
          </details>
        )}
      </div>
      <div style={{ padding: 16, overflow: 'auto' }}>
        {!current && (
          <div style={{ textAlign: 'center', color: '#64748b', marginTop: 60 }}>
            <p>No conversations yet.</p>
            <button onClick={newConv}>Start New Conversation</button>
          </div>
        )}
        {current && (
          <div style={{ maxWidth: 800, margin: '0 auto' }}>
            {current.messages.map((m, i) => (
              <div key={i} style={{ display: 'flex', justifyContent: m.role === 'user' ? 'flex-end' : 'flex-start', margin: '8px 0' }}>
                <div style={{ background: m.role === 'user' ? '#2563eb' : '#e2e8f0', color: m.role === 'user' ? '#fff' : '#111827', padding: '8px 12px', borderRadius: 12, maxWidth: '75%' }}>
                  {m.text}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
      <div style={{ padding: 12, borderTop: '1px solid #eee', display: 'flex', gap: 8 }}>
        <textarea rows={2} style={{ flex: 1 }} value={input} onChange={(e) => setInput(e.target.value)} placeholder="Ask anything..." />
        <button onClick={send}>Send</button>
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
              <div key={i} style={{ display: 'flex', justifyContent: m.role === 'user' ? 'flex-end' : 'flex-start', margin: '8px 0' }}>
                <div style={{ background: m.role === 'user' ? '#2563eb' : '#e2e8f0', color: m.role === 'user' ? '#fff' : '#111827', padding: '8px 12px', borderRadius: 12, maxWidth: '75%' }}>
                  {m.text}
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
