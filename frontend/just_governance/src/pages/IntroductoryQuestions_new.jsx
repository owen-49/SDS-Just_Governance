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
    q10: '',
    q11: [],
    q11_other: '',
    q12: '',
    q13: [],
    q13_other: ''
  });
  const [limitMsg, setLimitMsg] = useState('');
  const [savedAt, setSavedAt] = useState(null);
  const [score, setScore] = useState(null);

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

  const calculateScore = () => {
    let totalScore = 0;
    
    // Q1 scoring
    if (answers.q1 === 'Not at all confident') totalScore += 1;
    else if (answers.q1 === 'Somewhat confident') totalScore += 2;
    else if (answers.q1 === 'Very confident') totalScore += 3;
    
    // Q2 scoring - 1 point for each familiar term
    const q2Familiar = Object.values(answers.q2).filter(val => val === 'Familiar').length;
    totalScore += q2Familiar;
    
    // Q4 scoring
    if (answers.q4 === 'Not familiar at all') totalScore += 1;
    else if (answers.q4 === 'Somewhat familiar') totalScore += 2;
    else if (answers.q4 === 'Very familiar') totalScore += 3;
    
    // Q5 scoring
    if (answers.q5 === 'Not sure yet') totalScore += 1;
    else if (answers.q5 === 'A rough idea') totalScore += 2;
    else if (answers.q5 === 'Clear idea') totalScore += 3;
    
    // Q6 scoring
    if (answers.q6 === 'No, never') totalScore += 1;
    else if (answers.q6 === 'Yes, a few times') totalScore += 2;
    else if (answers.q6 === 'Yes, often') totalScore += 3;
    
    // Q8 scoring
    if (answers.q8 === 'Never') totalScore += 1;
    else if (answers.q8 === 'Occasionally') totalScore += 2;
    else if (answers.q8 === 'Often') totalScore += 3;
    
    // Q9 scoring
    const unfamiliarTerms = answers.q9.length;
    if (unfamiliarTerms === 0) totalScore += 3;
    else if (unfamiliarTerms <= 3) totalScore += 2;
    else totalScore += 1;
    
    // Q10 scoring
    if (answers.q10 === 'Not very comfortable' || answers.q10 === 'Not sure') totalScore += 1;
    else if (answers.q10 === 'Sometimes comfortable') totalScore += 2;
    else if (answers.q10 === 'Very comfortable') totalScore += 3;
    
    // Q12 scoring
    if (answers.q12 === 'Not interested') totalScore += 1;
    else if (answers.q12 === 'Somewhat interested' || answers.q12 === 'Not sure yet') totalScore += 2;
    else if (answers.q12 === 'Very interested') totalScore += 3;
    
    return totalScore;
  };

  const getScoreCategory = (score) => {
    if (score <= 14) return 'New to Governance';
    else if (score <= 21) return 'Developing Understanding';
    else return 'Strong Understanding';
  };

  const onSubmit = (e) => {
    e.preventDefault();
    const finalScore = calculateScore();
    setScore(finalScore);
    
    const res = dbApi.saveIntroQuestionnaire({ ...answers, score: finalScore });
    if (res.ok) {
      setSavedAt(res.record.created_at);
      alert(`Thank you! Your responses have been recorded. Your score: ${finalScore}/30 - ${getScoreCategory(finalScore)}`);
    } else if (res.code === 'not_logged_in') {
      alert('Please sign in before submitting.');
    } else {
      alert('Failed to save. Please try again.');
    }
  };

  return (
    <DocumentLayout 
      title="Welcome to Just Governance - Introductory Questionnaire" 
      lastUpdated="September 4, 2025"
    >
      {savedAt && (
        <div style={{ background:'#ecfeff', border:'1px solid #67e8f9', color:'#155e75', padding:12, borderRadius:6, marginBottom:20 }}>
          Last saved: {new Date(savedAt).toLocaleString()}
          {score && <div style={{ marginTop: 8, fontWeight: 'bold' }}>
            Your Score: {score}/30 - {getScoreCategory(score)}
          </div>}
        </div>
      )}

      <div style={{ fontSize: '16px', lineHeight: '1.6', marginBottom: '24px' }}>
        <p><strong>Welcome to Just Governance.</strong> Our goal is to provide training on what boards do, how they work and what the responsibilities of the people on them (directors) are.</p>
        
        <p>To help us provide the best program for you, please answer the following questions as best you can. We understand that everyone comes to governance training with their own experiences and backgrounds and one of our goals is to make sure we provide training that is best for you. So please answer the questions truthfully.</p>
      </div>

      {limitMsg && (
        <div style={{ color:'#dc2626', background:'#fef2f2', border:'1px solid #fecaca', padding:8, borderRadius:6, marginBottom:12 }}>
          {limitMsg}
        </div>
      )}

      <form onSubmit={onSubmit}>
        {/* Question 1 */}
        <div style={{ marginBottom: '32px', padding: '20px', background: '#f8fafc', borderRadius: '8px' }}>
          <h3 style={{ color: '#1e293b', marginBottom: '16px' }}>
            1. Boards are some of the least understood decision making structures in society. How confident do you feel in knowing what boards do?
          </h3>
          {['Not at all confident', 'Somewhat confident', 'Very confident'].map(option => (
            <label key={option} style={{ display: 'block', margin: '8px 0', cursor: 'pointer' }}>
              <input
                type="radio"
                name="q1"
                value={option}
                checked={answers.q1 === option}
                onChange={(e) => handleRadio('q1', e.target.value)}
                style={{ marginRight: '8px' }}
              />
              {option}
            </label>
          ))}
        </div>

        {/* Question 2 */}
        <div style={{ marginBottom: '32px', padding: '20px', background: '#f8fafc', borderRadius: '8px' }}>
          <h3 style={{ color: '#1e293b', marginBottom: '16px' }}>
            2. Most boards exist as part of incorporated bodies such as companies, not for profit organisations, community organisations and social enterprises. Which of these terms are you familiar with and which not?
          </h3>
          {Object.keys(answers.q2).map(term => (
            <div key={term} style={{ marginBottom: '12px' }}>
              <strong style={{ display: 'block', marginBottom: '8px' }}>{term}</strong>
              {['Familiar', 'Not familiar'].map(option => (
                <label key={option} style={{ display: 'inline-block', margin: '0 16px 0 0', cursor: 'pointer' }}>
                  <input
                    type="radio"
                    name={`q2_${term}`}
                    value={option}
                    checked={answers.q2[term] === option}
                    onChange={(e) => handleNestedRadio('q2', term, e.target.value)}
                    style={{ marginRight: '4px' }}
                  />
                  {option}
                </label>
              ))}
            </div>
          ))}
        </div>

        {/* Question 3 */}
        <div style={{ marginBottom: '32px', padding: '20px', background: '#f8fafc', borderRadius: '8px' }}>
          <h3 style={{ color: '#1e293b', marginBottom: '16px' }}>
            3. What interests you most about learning about what boards do? (choose up to 2)
          </h3>
          {[
            'Making a difference on an issue I care about',
            'Getting a board role',
            'Learning new skills',
            'Understanding how key decisions get made',
            'Meeting people and building networks',
            'Furthering my career'
          ].map(option => (
            <label key={option} style={{ display: 'block', margin: '8px 0', cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={answers.q3.includes(option)}
                onChange={() => handleCheckbox('q3', option, 2)}
                style={{ marginRight: '8px' }}
              />
              {option}
            </label>
          ))}
          <div style={{ marginTop: '12px' }}>
            <label style={{ display: 'block', marginBottom: '8px' }}>
              Other:
              <input
                type="text"
                value={answers.q3_other}
                onChange={(e) => handleInput('q3_other', e.target.value)}
                style={{ marginLeft: '8px', padding: '4px 8px', border: '1px solid #d1d5db', borderRadius: '4px' }}
              />
            </label>
          </div>
        </div>

        {/* Question 4 */}
        <div style={{ marginBottom: '32px', padding: '20px', background: '#f8fafc', borderRadius: '8px' }}>
          <h3 style={{ color: '#1e293b', marginBottom: '16px' }}>
            4. The rules that boards must follow come from state and federal laws, case law and best practice. How familiar are you with Australia's legal system including the difference between legislation and case law?
          </h3>
          {['Not familiar at all', 'Somewhat familiar', 'Very familiar'].map(option => (
            <label key={option} style={{ display: 'block', margin: '8px 0', cursor: 'pointer' }}>
              <input
                type="radio"
                name="q4"
                value={option}
                checked={answers.q4 === option}
                onChange={(e) => handleRadio('q4', e.target.value)}
                style={{ marginRight: '8px' }}
              />
              {option}
            </label>
          ))}
        </div>

        {/* Question 5 */}
        <div style={{ marginBottom: '32px', padding: '20px', background: '#f8fafc', borderRadius: '8px' }}>
          <h3 style={{ color: '#1e293b', marginBottom: '16px' }}>
            5. When you hear the word "governance" what comes to mind?
          </h3>
          {['Not sure yet', 'A rough idea', 'Clear idea'].map(option => (
            <label key={option} style={{ display: 'block', margin: '8px 0', cursor: 'pointer' }}>
              <input
                type="radio"
                name="q5"
                value={option}
                checked={answers.q5 === option}
                onChange={(e) => handleRadio('q5', e.target.value)}
                style={{ marginRight: '8px' }}
              />
              {option}
            </label>
          ))}
        </div>

        {/* Question 6 */}
        <div style={{ marginBottom: '32px', padding: '20px', background: '#f8fafc', borderRadius: '8px' }}>
          <h3 style={{ color: '#1e293b', marginBottom: '16px' }}>
            6. Have you ever been part of a group responsible for making decisions for other people (e.g., a committee in a workplace, community group, sports club, or school)?
          </h3>
          {['No, never', 'Yes, a few times', 'Yes, often'].map(option => (
            <label key={option} style={{ display: 'block', margin: '8px 0', cursor: 'pointer' }}>
              <input
                type="radio"
                name="q6"
                value={option}
                checked={answers.q6 === option}
                onChange={(e) => handleRadio('q6', e.target.value)}
                style={{ marginRight: '8px' }}
              />
              {option}
            </label>
          ))}
        </div>

        {/* Question 7 */}
        <div style={{ marginBottom: '32px', padding: '20px', background: '#f8fafc', borderRadius: '8px' }}>
          <h3 style={{ color: '#1e293b', marginBottom: '16px' }}>
            7. Which areas interest you most?
          </h3>
          {[
            'Community and social justice',
            'Sport and recreation',
            'Arts and culture',
            'Health',
            'Housing and homelessness',
            'Gender',
            "Women's safety",
            'Environment'
          ].map(option => (
            <label key={option} style={{ display: 'block', margin: '8px 0', cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={answers.q7.includes(option)}
                onChange={() => handleCheckbox('q7', option)}
                style={{ marginRight: '8px' }}
              />
              {option}
            </label>
          ))}
          <div style={{ marginTop: '12px' }}>
            <label style={{ display: 'block', marginBottom: '8px' }}>
              Other:
              <input
                type="text"
                value={answers.q7_other}
                onChange={(e) => handleInput('q7_other', e.target.value)}
                style={{ marginLeft: '8px', padding: '4px 8px', border: '1px solid #d1d5db', borderRadius: '4px' }}
              />
            </label>
          </div>
        </div>

        {/* Question 8 */}
        <div style={{ marginBottom: '32px', padding: '20px', background: '#f8fafc', borderRadius: '8px' }}>
          <h3 style={{ color: '#1e293b', marginBottom: '16px' }}>
            8. Many boards look at money matters. Have you ever read any basic financial documents (like budgets, annual reports or profit and loss statements)?
          </h3>
          {['Never', 'Occasionally', 'Often'].map(option => (
            <label key={option} style={{ display: 'block', margin: '8px 0', cursor: 'pointer' }}>
              <input
                type="radio"
                name="q8"
                value={option}
                checked={answers.q8 === option}
                onChange={(e) => handleRadio('q8', e.target.value)}
                style={{ marginRight: '8px' }}
              />
              {option}
            </label>
          ))}
        </div>

        {/* Question 9 */}
        <div style={{ marginBottom: '32px', padding: '20px', background: '#f8fafc', borderRadius: '8px' }}>
          <h3 style={{ color: '#1e293b', marginBottom: '16px' }}>
            9. Which of these words are new to you?
          </h3>
          {[
            'Constitution',
            'Director',
            'Nominee',
            'Conflict of interest',
            'Agenda',
            'Minutes',
            'Fiduciary duties'
          ].map(option => (
            <label key={option} style={{ display: 'block', margin: '8px 0', cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={answers.q9.includes(option)}
                onChange={() => handleCheckbox('q9', option)}
                style={{ marginRight: '8px' }}
              />
              {option}
            </label>
          ))}
        </div>

        {/* Question 10 */}
        <div style={{ marginBottom: '32px', padding: '20px', background: '#f8fafc', borderRadius: '8px' }}>
          <h3 style={{ color: '#1e293b', marginBottom: '16px' }}>
            10. How comfortable do you feel speaking up in a group?
          </h3>
          {['Not very comfortable', 'Not sure', 'Sometimes comfortable', 'Very comfortable'].map(option => (
            <label key={option} style={{ display: 'block', margin: '8px 0', cursor: 'pointer' }}>
              <input
                type="radio"
                name="q10"
                value={option}
                checked={answers.q10 === option}
                onChange={(e) => handleRadio('q10', e.target.value)}
                style={{ marginRight: '8px' }}
              />
              {option}
            </label>
          ))}
        </div>

        {/* Question 11 */}
        <div style={{ marginBottom: '32px', padding: '20px', background: '#f8fafc', borderRadius: '8px' }}>
          <h3 style={{ color: '#1e293b', marginBottom: '16px' }}>
            11. Which of these do you most want to learn more about? (choose up to 2)
          </h3>
          {[
            'What boards actually do',
            'How board decisions are made',
            'The legal duties and responsibilities of board members',
            'How to get on a board',
            'The different types of boards in Australia',
            'When a board is needed and how to set one up'
          ].map(option => (
            <label key={option} style={{ display: 'block', margin: '8px 0', cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={answers.q11.includes(option)}
                onChange={() => handleCheckbox('q11', option, 2)}
                style={{ marginRight: '8px' }}
              />
              {option}
            </label>
          ))}
          <div style={{ marginTop: '12px' }}>
            <label style={{ display: 'block', marginBottom: '8px' }}>
              Something else:
              <input
                type="text"
                value={answers.q11_other}
                onChange={(e) => handleInput('q11_other', e.target.value)}
                style={{ marginLeft: '8px', padding: '4px 8px', border: '1px solid #d1d5db', borderRadius: '4px' }}
              />
            </label>
          </div>
        </div>

        {/* Question 12 */}
        <div style={{ marginBottom: '32px', padding: '20px', background: '#f8fafc', borderRadius: '8px' }}>
          <h3 style={{ color: '#1e293b', marginBottom: '16px' }}>
            12. Thinking about the future, how interested are you in being part of a board or committee?
          </h3>
          {['Not interested', 'Not sure yet', 'Somewhat interested', 'Very interested'].map(option => (
            <label key={option} style={{ display: 'block', margin: '8px 0', cursor: 'pointer' }}>
              <input
                type="radio"
                name="q12"
                value={option}
                checked={answers.q12 === option}
                onChange={(e) => handleRadio('q12', e.target.value)}
                style={{ marginRight: '8px' }}
              />
              {option}
            </label>
          ))}
        </div>

        {/* Question 13 */}
        <div style={{ marginBottom: '32px', padding: '20px', background: '#f8fafc', borderRadius: '8px' }}>
          <h3 style={{ color: '#1e293b', marginBottom: '16px' }}>
            13. Is there anything that might make it difficult for you to fully take part in this training?
          </h3>
          {[
            "Confidence or feeling unsure about what I know and don't know",
            'Time or family commitments',
            'Access to internet or computer',
            'Accessibility needs (please share)',
            'Nothing comes to mind'
          ].map(option => (
            <label key={option} style={{ display: 'block', margin: '8px 0', cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={answers.q13.includes(option)}
                onChange={() => handleCheckbox('q13', option)}
                style={{ marginRight: '8px' }}
              />
              {option}
            </label>
          ))}
          <div style={{ marginTop: '12px' }}>
            <label style={{ display: 'block', marginBottom: '8px' }}>
              Other:
              <input
                type="text"
                value={answers.q13_other}
                onChange={(e) => handleInput('q13_other', e.target.value)}
                style={{ marginLeft: '8px', padding: '4px 8px', border: '1px solid #d1d5db', borderRadius: '4px' }}
              />
            </label>
          </div>
        </div>

        <div style={{ 
          background: '#f0f9ff', 
          border: '1px solid #0ea5e9', 
          borderRadius: '8px', 
          padding: '20px', 
          marginBottom: '24px' 
        }}>
          <h3 style={{ color: '#0c4a6e', marginBottom: '16px' }}>Scoring Guide</h3>
          <div style={{ fontSize: '14px', lineHeight: '1.6' }}>
            <p><strong>New to Governance (Score: 9–14)</strong></p>
            <p style={{ marginLeft: '16px', marginBottom: '12px' }}>
              Limited or no familiarity with governance concepts. Likely to need extra support, plain-language explanations, and confidence-building.
            </p>
            
            <p><strong>Developing Understanding (Score: 15–21)</strong></p>
            <p style={{ marginLeft: '16px', marginBottom: '12px' }}>
              Has some experience or partial knowledge. Ready to deepen skills with guided learning.
            </p>
            
            <p><strong>Strong Understanding (Score: 22–30)</strong></p>
            <p style={{ marginLeft: '16px' }}>
              Already confident with governance concepts. Could contribute actively in discussions and might benefit from advanced materials.
            </p>
          </div>
        </div>

        <button 
          type="submit" 
          style={{
            background: 'linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)',
            color: 'white',
            border: 'none',
            padding: '12px 24px',
            borderRadius: '8px',
            fontSize: '16px',
            fontWeight: '600',
            cursor: 'pointer',
            boxShadow: '0 4px 12px rgba(37, 99, 235, 0.3)'
          }}
        >
          Submit Questionnaire
        </button>
      </form>
    </DocumentLayout>
  );
};

export default IntroductoryQuestions;
