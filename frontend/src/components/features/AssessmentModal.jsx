import React, { useMemo, useState } from 'react';
import { Modal } from '../ui';

function sampleQuestions() {
  // Simplified mixed question types for demo
  return [
    { id: '1', type: 'single', stem: 'Governance ensures...', options: ['Accountability', 'Chaos', 'Opacity', 'None'], answer: [0] },
    { id: '2', type: 'multi', stem: 'Select principles of good governance', options: ['Transparency', 'Fairness', 'Opacity', 'Integrity'], answer: [0,1,3] },
    { id: '3', type: 'short', stem: 'In 2-3 sentences, describe why accountability matters.', keyPoints: ['roles', 'responsibility', 'impact'] }
  ];
}

export default function AssessmentModal({ open, onClose, onSubmit, user }) {
  const qs = useMemo(sampleQuestions, []);
  const [answers, setAnswers] = useState({});
  const [stage, setStage] = useState('intro'); // intro | answer | result
  const [marked, setMarked] = useState({});

  const total = qs.length;
  const progress = Object.keys(answers).length;

  const computeScore = () => {
    let score = 0, detail = [];
    qs.forEach(q => {
      let correct = false;
      if (q.type === 'single') {
        const a = answers[q.id];
        correct = a !== undefined && q.answer[0] === a;
      } else if (q.type === 'multi') {
        const a = answers[q.id] || [];
        const setA = new Set(a);
        const setAns = new Set(q.answer);
        const inter = [...setA].filter(x => setAns.has(x)).length;
        const union = new Set([...setA, ...setAns]).size;
        correct = inter === setAns.size && setA.size === setAns.size;
        // partial credit
        score += (inter / union) * (100 / total);
        detail.push({ id: q.id, correct: inter === setAns.size && setA.size === setAns.size, your: a, answer: q.answer, exp: 'Select all that apply' });
        return;
      } else if (q.type === 'short') {
        const text = (answers[q.id] || '').toLowerCase();
        let pts = 0;
        q.keyPoints.forEach(k => { if (text.includes(k)) pts += 1; });
        score += (pts / q.keyPoints.length) * (100 / total);
        detail.push({ id: q.id, correct: pts >= Math.ceil(q.keyPoints.length * 0.6), your: answers[q.id], answer: '—', exp: 'Coverage of key points' });
        return;
      }
      if (q.type !== 'multi' && q.type !== 'short') {
        score += (correct ? 1 : 0) * (100 / total);
        detail.push({ id: q.id, correct, your: answers[q.id], answer: q.answer, exp: 'Single choice' });
      }
    });
    return { score: Math.round(score), detail };
  };

  const handleSubmit = () => {
    const res = computeScore();
    onSubmit?.(res);
    setStage('result');
  };

  return (
    <Modal open={open} onClose={onClose} width={1000}>
      {stage === 'intro' && (
        <div style={{ padding: 24 }}>
          <h2>Your governance journey — Assessment</h2>
          <p>20 questions · ~15 minutes · Coverage: Core Skills + Communication & Influence</p>
          <ul>
            <li>Single/multiple choice and short answer</li>
            <li>Autosave each response · You can review before submitting</li>
            <li>Closing will discard this attempt</li>
          </ul>
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
            <button onClick={onClose} style={{ padding: '8px 12px' }}>Cancel</button>
            <button onClick={() => setStage('answer')} style={{ padding: '8px 12px', background: '#2563eb', color: '#fff', border: 'none', borderRadius: 6 }}>Start</button>
          </div>
        </div>
      )}
      {stage === 'answer' && (
        <div style={{ display: 'grid', gridTemplateRows: 'auto 1fr auto', height: '80vh' }}>
          <div style={{ padding: 12, borderBottom: '1px solid #eee', display: 'flex', justifyContent: 'space-between' }}>
            <div>Progress: {progress}/{total}</div>
            <button onClick={() => { if (window.confirm('Exiting will discard this attempt. Are you sure?')) onClose(); }}>Exit</button>
          </div>
          <div style={{ overflow: 'auto', padding: 16 }}>
            {qs.map((q, idx) => (
              <div key={q.id} style={{ marginBottom: 16, border: '1px solid #eee', borderRadius: 8 }}>
                <div style={{ padding: 12, background: '#fafafa', borderBottom: '1px solid #eee' }}>
                  <strong>Q{idx + 1}.</strong> {q.stem}
                </div>
                <div style={{ padding: 12 }}>
                  {q.type === 'single' && (
                    <div>
                      {q.options.map((op, i) => (
                        <label key={i} style={{ display: 'block', margin: '6px 0' }}>
                          <input type="radio" name={q.id} checked={answers[q.id] === i} onChange={() => setAnswers(a => ({ ...a, [q.id]: i }))} /> {op}
                        </label>
                      ))}
                    </div>
                  )}
                  {q.type === 'multi' && (
                    <div>
                      {q.options.map((op, i) => (
                        <label key={i} style={{ display: 'block', margin: '6px 0' }}>
                          <input type="checkbox" checked={(answers[q.id] || []).includes(i)} onChange={(e) => {
                            setAnswers(a => {
                              const arr = new Set(a[q.id] || []);
                              if (e.target.checked) arr.add(i); else arr.delete(i);
                              return { ...a, [q.id]: [...arr] };
                            });
                          }} /> {op}
                        </label>
                      ))}
                    </div>
                  )}
                  {q.type === 'short' && (
                    <textarea rows={4} style={{ width: '100%' }} value={answers[q.id] || ''} onChange={(e) => setAnswers(a => ({ ...a, [q.id]: e.target.value }))} placeholder="50–200 words suggested" />
                  )}
                </div>
                <div style={{ padding: 12, borderTop: '1px solid #eee', display: 'flex', justifyContent: 'space-between' }}>
                  <label>
                    <input type="checkbox" checked={!!marked[q.id]} onChange={(e) => setMarked(m => ({ ...m, [q.id]: e.target.checked }))} /> Mark for review
                  </label>
                </div>
              </div>
            ))}
          </div>
          <div style={{ padding: 12, borderTop: '1px solid #eee', display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
            <button onClick={handleSubmit} disabled={progress < total} style={{ padding: '8px 12px', background: '#2563eb', color: '#fff', border: 'none', borderRadius: 6 }}>Submit</button>
          </div>
        </div>
      )}
      {stage === 'result' && (
        <ResultPanel answers={answers} qs={qs} onClose={onClose} />
      )}
    </Modal>
  );
}

function ResultPanel({ qs, answers, onClose }) {
  const total = qs.length;
  let score = 0;
  const detail = [];
  qs.forEach(q => {
    if (q.type === 'single') {
      const a = answers[q.id];
      const ok = a !== undefined && q.answer[0] === a;
      score += (ok ? 1 : 0) * (100 / total);
      detail.push({ id: q.id, correct: ok, your: a, answer: q.answer, exp: 'Single choice' });
    } else if (q.type === 'multi') {
      const a = answers[q.id] || [];
      const setA = new Set(a);
      const setAns = new Set(q.answer);
      const inter = [...setA].filter(x => setAns.has(x)).length;
      const union = new Set([...setA, ...setAns]).size;
      const ok = inter === setAns.size && setA.size === setAns.size;
      score += (inter / union) * (100 / total);
      detail.push({ id: q.id, correct: ok, your: a, answer: q.answer, exp: 'Select all that apply' });
    } else if (q.type === 'short') {
      const text = (answers[q.id] || '').toLowerCase();
      let pts = 0;
      q.keyPoints.forEach(k => { if (text.includes(k)) pts += 1; });
      score += (pts / q.keyPoints.length) * (100 / total);
      detail.push({ id: q.id, correct: pts >= Math.ceil(q.keyPoints.length * 0.6), your: answers[q.id], answer: '—', exp: 'Coverage of key points' });
    }
  });
  const finalScore = Math.round(score);
  const tier = finalScore >= 80 ? 'A' : finalScore >= 60 ? 'B' : 'C';

  return (
    <div style={{ padding: 24 }}>
      <h2>Results</h2>
      <p>Total score: <strong>{finalScore}</strong> — Tier {tier}</p>
      <div style={{ marginTop: 12 }}>
        {detail.map((d, i) => (
          <div key={i} style={{ border: '1px solid #eee', borderRadius: 8, margin: '8px 0' }}>
            <div style={{ padding: 8, background: '#fafafa', borderBottom: '1px solid #eee' }}>Q{i + 1}</div>
            <div style={{ padding: 8 }}>
              <div>Correct: {d.correct ? 'Yes' : 'No'}</div>
              <div>Your answer: {JSON.stringify(d.your)}</div>
              <div>Correct answer: {JSON.stringify(d.answer)}</div>
              <div>Explanation: {d.exp}</div>
            </div>
          </div>
        ))}
      </div>
      <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
        <button onClick={onClose}>Close</button>
      </div>
    </div>
  );
}
