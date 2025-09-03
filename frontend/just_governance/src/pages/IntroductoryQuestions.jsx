import React, { useState, useEffect } from 'react';
import DocumentLayout from '../components/DocumentLayout';
import { dbApi } from '../lib/localDb';

const IntroductoryQuestions = () => {
  const [answers, setAnswers] = useState({
    q1: '',
    q2: {
      'Incorporated bodies': '',
      'Companies': '',
      'Not for profits': '',
      'Community organisations': '',
      'Social enterprises': ''
    },
    q3: [],
    q3_other: '',
    q4: '',
    q5: '',
    q6: '',
    q7: [],
    q7_other: '',
    q8: '',
    q9: [],
    q10a: '',
    q10b: [],
    q10b_other: '',
    q11: '',
    q12: [],
    q12_other: ''
  });
  const [limitMsg, setLimitMsg] = useState('');
  const [savedAt, setSavedAt] = useState(null);

  useEffect(() => {
    const rec = dbApi.getLatestIntroQuestionnaire();
    if (rec?.data) {
      setAnswers(prev => ({ ...prev, ...rec.data }));
      setSavedAt(rec.created_at);
    }
  }, []);

  const handleRadio = (key, value) => {
    setAnswers(prev => ({ ...prev, [key]: value }));
  };

  const handleNestedRadio = (parentKey, itemKey, value) => {
    setAnswers(prev => ({
      ...prev,
      [parentKey]: {
        ...prev[parentKey],
        [itemKey]: value
      }
    }));
  };

  const handleCheckbox = (key, option, maxSelections) => {
    setAnswers(prev => {
      const list = new Set(prev[key]);
      if (list.has(option)) {
        list.delete(option);
        setLimitMsg('');
      } else {
        if (maxSelections && list.size >= maxSelections) {
          setLimitMsg(`You can select up to ${maxSelections} options for this question.`);
          return prev;
        }
        list.add(option);
        setLimitMsg('');
      }
      return { ...prev, [key]: Array.from(list) };
    });
  };

  const handleInput = (key, value) => {
    setAnswers(prev => ({ ...prev, [key]: value }));
  };

  const onSubmit = (e) => {
    e.preventDefault();
    const res = dbApi.saveIntroQuestionnaire(answers);
    if (res.ok) {
      setSavedAt(res.record.created_at);
      alert('Thank you! Your responses have been recorded.');
    } else if (res.code === 'not_logged_in') {
      alert('Please sign in before submitting.');
    } else {
      alert('Failed to save. Please try again.');
    }
  };

  return (
    <DocumentLayout 
      title="Welcome to Just Governance - Introductory Questionnaire" 
      lastUpdated="September 3, 2025"
    >
      {savedAt && (
        <div style={{ background:'#ecfeff', border:'1px solid #67e8f9', color:'#155e75', padding:8, borderRadius:6, marginBottom:12 }}>
          Last saved: {new Date(savedAt).toLocaleString()}
        </div>
      )}
      <div className="intro-questions">
        <div className="intro-text">
          <p>
            Welcome to Just Governance. Our goal is to provide training on what boards to, how they work and what the responsibilities of the people on them (directors) are.
          </p>
          <p>
            To help us provide the best program for you, please answer the following questions as best you can. We understand that everyone comes to governance training with their own experiences and backgrounds and one of our goals is to make sure we provide training that is best for you. So please answer the questions truthfully 
          </p>
        </div>

        <form onSubmit={onSubmit} className="questionnaire-form">
          {/* 1 */}
          <fieldset className="question">
            <legend>1. Boards are some of the least understood decision making structures in society. How confident to you feel in knowing what boards do?</legend>
            <label className="option">
              <input type="radio" name="q1" value="Somewhat confident" checked={answers.q1 === 'Somewhat confident'} onChange={(e) => handleRadio('q1', e.target.value)} />
              <span>Somewhat confident</span>
            </label>
            <label className="option">
              <input type="radio" name="q1" value="Very confident" checked={answers.q1 === 'Very confident'} onChange={(e) => handleRadio('q1', e.target.value)} />
              <span>Very confident</span>
            </label>
            <label className="option">
              <input type="radio" name="q1" value="Not at all confident" checked={answers.q1 === 'Not at all confident'} onChange={(e) => handleRadio('q1', e.target.value)} />
              <span>Not at all confident</span>
            </label>
          </fieldset>

          {/* 2 */}
          <fieldset className="question">
            <legend>2. Most boards exist as part of incorporated bodies such as companies, not for profit organisations, community organisations and social enterprises. Which of these terms are you familiar with and which not?</legend>
            {['Incorporated bodies', 'Companies', 'Not for profits', 'Community organisations', 'Social enterprises'].map(term => (
              <div key={term} className="matrix-row">
                <div className="matrix-label">{term}</div>
                <div className="matrix-options">
                  <label>
                    <input type="radio" name={`q2_${term}`} value="Familiar" checked={answers.q2[term] === 'Familiar'} onChange={(e) => handleNestedRadio('q2', term, e.target.value)} /> Familiar
                  </label>
                  <label>
                    <input type="radio" name={`q2_${term}`} value="Not familiar" checked={answers.q2[term] === 'Not familiar'} onChange={(e) => handleNestedRadio('q2', term, e.target.value)} /> Not familiar
                  </label>
                </div>
              </div>
            ))}
          </fieldset>

          {/* 3 (up to 2) */}
          <fieldset className="question">
            <legend>3. What interests you most about learning about what boards do? (choose up to 2)</legend>
            {[
              'Making a difference on an issue I care about',
              'Getting a board role',
              'Learning new skills',
              'Understanding how key decisions get made',
              'Meeting people and building networks',
              'Furthering my career',
              'Other: _______'
            ].map(opt => (
              <label key={opt} className="option">
                <input
                  type="checkbox"
                  checked={answers.q3.includes(opt)}
                  onChange={() => handleCheckbox('q3', opt, 2)}
                />
                <span>{opt}</span>
              </label>
            ))}
            {answers.q3.includes('Other: _______') && (
              <input
                type="text"
                className="other-input"
                placeholder="Please specify"
                value={answers.q3_other}
                onChange={(e) => handleInput('q3_other', e.target.value)}
              />
            )}
            {limitMsg && <div className="limit-msg">{limitMsg}</div>}
          </fieldset>

          {/* 4 */}
          <fieldset className="question">
            <legend>4. The rules that boards must follow come from state and federal laws, case law and best practice. How familiar are you with Australia’s legal system including the difference between legislation and case law?</legend>
            {['Very familiar', 'Somewhat familiar', 'Not familiar at all'].map(opt => (
              <label key={opt} className="option">
                <input type="radio" name="q4" value={opt} checked={answers.q4 === opt} onChange={(e) => handleRadio('q4', e.target.value)} />
                <span>{opt}</span>
              </label>
            ))}
          </fieldset>

          {/* 5 */}
          <fieldset className="question">
            <legend>5. When you hear the word “governance” what comes to mind?</legend>
            {['Clear idea', 'A rough idea', 'Not sure yet'].map(opt => (
              <label key={opt} className="option">
                <input type="radio" name="q5" value={opt} checked={answers.q5 === opt} onChange={(e) => handleRadio('q5', e.target.value)} />
                <span>{opt}</span>
              </label>
            ))}
          </fieldset>

          {/* 6 */}
          <fieldset className="question">
            <legend>6. Have you ever been part of a group responsible for making decisions for other people (e.g., a committee in a workplace, community group, sports club, or school)?</legend>
            {['Yes, often', 'Yes, a few times', 'No, never'].map(opt => (
              <label key={opt} className="option">
                <input type="radio" name="q6" value={opt} checked={answers.q6 === opt} onChange={(e) => handleRadio('q6', e.target.value)} />
                <span>{opt}</span>
              </label>
            ))}
          </fieldset>

          {/* 7 */}
          <fieldset className="question">
            <legend>7. Which areas interest you most?</legend>
            {[
              'Community and social justice',
              'Sport and recreation',
              'Arts and culture',
              'Health',
              'Housing and homelessness',
              'Gender',
              'Women’s safety',
              'Environment',
              'Other: _______'
            ].map(opt => (
              <label key={opt} className="option">
                <input
                  type="checkbox"
                  checked={answers.q7.includes(opt)}
                  onChange={() => handleCheckbox('q7', opt)}
                />
                <span>{opt}</span>
              </label>
            ))}
            {answers.q7.includes('Other: _______') && (
              <input
                type="text"
                className="other-input"
                placeholder="Please specify"
                value={answers.q7_other}
                onChange={(e) => handleInput('q7_other', e.target.value)}
              />
            )}
          </fieldset>

          {/* 8 */}
          <fieldset className="question">
            <legend>8. Many boards look at money matters. Have you ever read any basic financial documents (like budgets, annual reports or profit and loss statements)?</legend>
            {['Never', 'Occasionally', 'Often'].map(opt => (
              <label key={opt} className="option">
                <input type="radio" name="q8" value={opt} checked={answers.q8 === opt} onChange={(e) => handleRadio('q8', e.target.value)} />
                <span>{opt}</span>
              </label>
            ))}
          </fieldset>

          {/* 9 */}
          <fieldset className="question">
            <legend>9. Which of these words are new to you?</legend>
            {[
              'Constitution',
              'Director',
              'Nominee',
              'Conflict of interest',
              'Agenda',
              'Minutes',
              'Fiduciary duties'
            ].map(opt => (
              <label key={opt} className="option">
                <input
                  type="checkbox"
                  checked={answers.q9.includes(opt)}
                  onChange={() => handleCheckbox('q9', opt)}
                />
                <span>{opt}</span>
              </label>
            ))}
          </fieldset>

          {/* 10a */}
          <fieldset className="question">
            <legend>10. How comfortable do you feel speaking up in a group?</legend>
            {['Very comfortable', 'Sometimes comfortable', 'Not very comfortable', 'Not sure'].map(opt => (
              <label key={opt} className="option">
                <input type="radio" name="q10a" value={opt} checked={answers.q10a === opt} onChange={(e) => handleRadio('q10a', e.target.value)} />
                <span>{opt}</span>
              </label>
            ))}
          </fieldset>

          {/* 10b (up to 2) */}
          <fieldset className="question">
            <legend>10. Which of these do you most want to learn more about? (choose up to 2)</legend>
            {[
              'What boards actually do',
              'How board decisions are made',
              'The legal duties and responsibilities of board members',
              'How to get on a board',
              'The different types of boards in Australia',
              'When a board is neede and how to set one up',
              'Something else: _______'
            ].map(opt => (
              <label key={opt} className="option">
                <input
                  type="checkbox"
                  checked={answers.q10b.includes(opt)}
                  onChange={() => handleCheckbox('q10b', opt, 2)}
                />
                <span>{opt}</span>
              </label>
            ))}
            {answers.q10b.includes('Something else: _______') && (
              <input
                type="text"
                className="other-input"
                placeholder="Please specify"
                value={answers.q10b_other}
                onChange={(e) => handleInput('q10b_other', e.target.value)}
              />
            )}
            {limitMsg && <div className="limit-msg">{limitMsg}</div>}
          </fieldset>

          {/* 11 */}
          <fieldset className="question">
            <legend>11. Thinking about the future, how interested are you in being part of a board or committee?</legend>
            {['Very interested', 'Somewhat interested', 'Not sure yet', 'Not interested'].map(opt => (
              <label key={opt} className="option">
                <input type="radio" name="q11" value={opt} checked={answers.q11 === opt} onChange={(e) => handleRadio('q11', e.target.value)} />
                <span>{opt}</span>
              </label>
            ))}
          </fieldset>

          {/* 12 */}
          <fieldset className="question">
            <legend>12. Is there anything that might make it difficult for you to fully take part in this training?</legend>
            {[
              'Confidence or feeling unsure about what I know and don’t know',
              'Time or family commitments',
              'Access to internet or computer',
              'Accessibility needs (please share)',
              'Other: _______',
              'Nothing comes to mind'
            ].map(opt => (
              <label key={opt} className="option">
                <input
                  type="checkbox"
                  checked={answers.q12.includes(opt)}
                  onChange={() => handleCheckbox('q12', opt)}
                />
                <span>{opt}</span>
              </label>
            ))}
            {answers.q12.includes('Other: _______') && (
              <input
                type="text"
                className="other-input"
                placeholder="Please specify"
                value={answers.q12_other}
                onChange={(e) => handleInput('q12_other', e.target.value)}
              />
            )}
          </fieldset>

          <div className="actions">
            <button type="submit" className="submit">Submit</button>
          </div>
        </form>
      </div>

      <style>{`
        .intro-questions { max-width: 900px; margin: 0 auto; }
        .intro-text { background: #f8f9fa; padding: 16px 20px; border-radius: 8px; margin-bottom: 24px; }
        .questionnaire-form { display: flex; flex-direction: column; gap: 24px; }
        fieldset.question { border: 1px solid #e5e7eb; padding: 16px 20px; border-radius: 8px; }
        fieldset.question legend { font-weight: 600; padding: 0 6px; }
        .option { display: flex; align-items: center; gap: 8px; margin: 8px 0; }
        .option input[type='radio'], .option input[type='checkbox'] { transform: translateY(1px); }
        .matrix-row { display: flex; align-items: center; gap: 16px; padding: 8px 0; border-bottom: 1px dashed #eee; }
        .matrix-row:last-child { border-bottom: none; }
        .matrix-label { flex: 1; }
        .matrix-options { display: flex; gap: 16px; }
        .other-input { display: block; margin-top: 8px; padding: 8px 10px; width: 100%; max-width: 420px; border: 1px solid #d1d5db; border-radius: 6px; }
        .limit-msg { color: #c2410c; font-size: 0.9rem; margin-top: 6px; }
        .actions { display: flex; justify-content: flex-end; }
        .submit { background: #0d6efd; color: #fff; border: none; padding: 10px 16px; border-radius: 6px; cursor: pointer; }
        .submit:hover { background: #0b5ed7; }
      `}</style>
    </DocumentLayout>
  );
};

export default IntroductoryQuestions;
