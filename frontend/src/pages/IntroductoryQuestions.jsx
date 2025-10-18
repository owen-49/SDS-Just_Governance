import React, { useState, useEffect } from 'react';
import { DocumentLayout } from '../components/layout';
import { onboardingApi, transformAnswersToBackendFormat } from '../services/onboarding';

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
  const [level, setLevel] = useState(null); // 'new', 'developing', 'strong'
  const [showResults, setShowResults] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');

  // 页面加载时尝试从后端获取已保存的问卷结果
  useEffect(() => {
    const loadSurveyResult = async () => {
      try {
        const result = await onboardingApi.getResult();
        if (result) {
          setScore(result.score);
          setLevel(result.level);
          setSavedAt(result.submitted_at);
          setShowResults(true);
        }
      } catch (error) {
        // 404 表示未提交过，这是正常情况
        if (error.status !== 404) {
          console.error('Failed to load survey result from backend:', error);
        }
      }
    };
    loadSurveyResult();
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

  const getScoreCategory = (score, backendLevel = null) => {
    // 使用后端返回的 level
    if (backendLevel) {
      if (backendLevel === 'strong') return 'Strong Understanding';
      if (backendLevel === 'developing') return 'Developing Understanding';
      if (backendLevel === 'new') return 'New to Governance';
    }
    
    // 降级：如果没有后端level，使用分数判断
    if (score <= 14) return 'New to Governance';
    else if (score <= 21) return 'Developing Understanding';
    else return 'Strong Understanding';
  };

  const getDetailedRecommendations = (score) => {
    const category = getScoreCategory(score);
    
    if (category === 'New to Governance') {
      return {
        title: 'New to Governance',
        description: 'Limited or no familiarity with governance concepts. You\'ll benefit from foundational training with extra support.',
        recommendations: [
          'Start with basic governance concepts and terminology',
          'Take advantage of plain-language explanations and examples',
          'Don\'t hesitate to ask questions during training sessions',
          'Consider pairing with a more experienced participant as a learning buddy',
          'Focus on building confidence through practice scenarios'
        ],
        nextSteps: [
          'Complete Module 1: "What is Governance?" as your starting point',
          'Review the governance glossary before each session',
          'Attend optional Q&A sessions for additional support'
        ]
      };
    } else if (category === 'Developing Understanding') {
      return {
        title: 'Developing Understanding',
        description: 'You have some experience or partial knowledge. You\'re ready to deepen your skills with guided learning.',
        recommendations: [
          'Build on your existing knowledge with intermediate concepts',
          'Participate actively in group discussions and case studies',
          'Focus on practical applications of governance principles',
          'Connect new learning to your previous experiences',
          'Take on leadership roles in group exercises'
        ],
        nextSteps: [
          'Start with Module 2: "Board Roles and Responsibilities"',
          'Consider volunteering for practice scenarios',
          'Join peer discussion groups to share experiences'
        ]
      };
    } else {
      return {
        title: 'Strong Understanding',
        description: 'You\'re already confident with governance concepts. You could contribute actively and might benefit from advanced materials.',
        recommendations: [
          'Focus on advanced governance topics and current best practices',
          'Mentor others who are new to governance',
          'Contribute your experience to group discussions',
          'Explore specialized areas like risk management or strategic planning',
          'Consider pursuing board positions in organizations you care about'
        ],
        nextSteps: [
          'Jump to Module 4: "Advanced Governance Practices"',
          'Consider becoming a peer mentor',
          'Explore real board opportunities in your community'
        ]
      };
    }
  };

  const onSubmit = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);
    setSubmitError('');
    
    try {
      // 转换答案格式为后端期望的格式
      const backendAnswers = transformAnswersToBackendFormat(answers);
      
      // 提交到后端
      const result = await onboardingApi.submitSurvey(backendAnswers);
      
      // 更新前端状态
      setScore(result.score);
      setLevel(result.level);
      setSavedAt(new Date().toISOString());
      setShowResults(true);
      
      // 滚动到结果区域
      setTimeout(() => {
        const resultsElement = document.getElementById('results-section');
        if (resultsElement) {
          resultsElement.scrollIntoView({ behavior: 'smooth' });
        }
      }, 100);
      
    } catch (error) {
      console.error('Failed to submit survey:', error);
      
      // 根据API文档处理不同错误码
      if (error.status === 401) {
        // 401 code=1001 unauthenticated
        setSubmitError('⚠️ Please sign in first to submit the questionnaire.');
        setTimeout(() => {
          window.location.href = '/login';
        }, 2000);
      } else if (error.status === 409) {
        // 409 code=4001 already_submitted / user_not_found_or_inactive / duplicate_question_key
        const message = error.body?.message;
        if (message === 'already_submitted') {
          setSubmitError('You have already submitted this questionnaire.');
          setShowResults(true);
          // 尝试获取之前的结果
          try {
            const result = await onboardingApi.getResult();
            if (result) {
              setScore(result.score);
              setLevel(result.level);
              setSavedAt(result.submitted_at);
            }
          } catch (e) {
            console.error('Failed to fetch previous result:', e);
          }
        } else if (message === 'duplicate_question_key') {
          setSubmitError('Error: Duplicate questions detected. Please check your answers and try again.');
        } else {
          setSubmitError('Unable to submit: ' + (message || 'Conflict error'));
        }
      } else if (error.status === 422) {
        // 422 code=2001 validation_error
        setSubmitError('Validation error: Please check all required fields are filled correctly.');
        console.error('Validation errors:', error.body?.data?.errors);
      } else if (error.status === 400) {
        // 400 code=4001 integrity_error
        setSubmitError('Database error: Please try again or contact support.');
      } else {
        // 其他错误
        setSubmitError('Failed to submit. Please check your connection and try again.');
      }
    } finally {
      setIsSubmitting(false);
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
            Your Score: {score}/30 - {getScoreCategory(score, level)}
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

      {submitError && (
        <div style={{ 
          color: submitError.includes('saved locally') || submitError.includes('already submitted') ? '#d97706' : '#dc2626', 
          background: submitError.includes('saved locally') || submitError.includes('already submitted') ? '#fef3c7' : '#fef2f2', 
          border: submitError.includes('saved locally') || submitError.includes('already submitted') ? '1px solid #fcd34d' : '1px solid #fecaca', 
          padding: 12, 
          borderRadius: 6, 
          marginBottom: 12 
        }}>
          {submitError}
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
          disabled={isSubmitting}
          style={{
            background: isSubmitting 
              ? 'linear-gradient(135deg, #94a3b8 0%, #64748b 100%)' 
              : 'linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)',
            color: 'white',
            border: 'none',
            padding: '12px 24px',
            borderRadius: '8px',
            fontSize: '16px',
            fontWeight: '600',
            cursor: isSubmitting ? 'not-allowed' : 'pointer',
            boxShadow: '0 4px 12px rgba(37, 99, 235, 0.3)',
            opacity: isSubmitting ? 0.7 : 1
          }}
        >
          {isSubmitting ? 'Submitting...' : 'Submit Questionnaire'}
        </button>
      </form>

      {/* Results Section */}
      {showResults && score !== null && (
        <div id="results-section" style={{ 
          marginTop: '40px', 
          padding: '32px', 
          background: 'linear-gradient(135deg, #f0f9ff 0%, #e0f2fe 100%)',
          borderRadius: '16px',
          border: '2px solid #0ea5e9',
          boxShadow: '0 8px 32px rgba(14, 165, 233, 0.15)'
        }}>
          <div style={{ textAlign: 'center', marginBottom: '32px' }}>
            <h2 style={{ 
              color: '#0c4a6e', 
              fontSize: '28px', 
              fontWeight: '700',
              marginBottom: '8px' 
            }}>
              🎉 Assessment Complete!
            </h2>
            <p style={{ fontSize: '18px', color: '#0369a1', marginBottom: '16px' }}>
              Thank you for completing the Just Governance questionnaire.
            </p>
            
            <div style={{
              display: 'inline-block',
              background: 'linear-gradient(135deg, #1e40af 0%, #1d4ed8 100%)',
              color: 'white',
              padding: '16px 32px',
              borderRadius: '12px',
              fontSize: '24px',
              fontWeight: '700',
              boxShadow: '0 6px 20px rgba(30, 64, 175, 0.3)',
              marginBottom: '24px'
            }}>
              Your Score: {score}/30
            </div>
          </div>

          {(() => {
            const recommendations = getDetailedRecommendations(score);
            const displayLevel = getScoreCategory(score, level);
            return (
              <div>
                <div style={{
                  background: 'white',
                  padding: '24px',
                  borderRadius: '12px',
                  marginBottom: '24px',
                  boxShadow: '0 4px 16px rgba(0, 0, 0, 0.08)'
                }}>
                  <h3 style={{ 
                    color: '#1e40af', 
                    fontSize: '22px', 
                    fontWeight: '600',
                    marginBottom: '12px',
                    display: 'flex',
                    alignItems: 'center'
                  }}>
                    📊 Your Assessment Level: {displayLevel}
                  </h3>
                  <p style={{ 
                    fontSize: '16px', 
                    lineHeight: '1.6', 
                    color: '#475569',
                    marginBottom: '0'
                  }}>
                    {recommendations.description}
                  </p>
                </div>

                <div style={{
                  background: 'white',
                  padding: '24px',
                  borderRadius: '12px',
                  marginBottom: '24px',
                  boxShadow: '0 4px 16px rgba(0, 0, 0, 0.08)'
                }}>
                  <h4 style={{ 
                    color: '#1e40af', 
                    fontSize: '18px', 
                    fontWeight: '600',
                    marginBottom: '16px',
                    display: 'flex',
                    alignItems: 'center'
                  }}>
                    💡 Personalized Recommendations
                  </h4>
                  <ul style={{ 
                    listStyle: 'none', 
                    padding: '0',
                    margin: '0'
                  }}>
                    {recommendations.recommendations.map((rec, index) => (
                      <li key={index} style={{
                        padding: '8px 0',
                        borderBottom: index < recommendations.recommendations.length - 1 ? '1px solid #e2e8f0' : 'none',
                        display: 'flex',
                        alignItems: 'flex-start'
                      }}>
                        <span style={{ 
                          color: '#10b981', 
                          marginRight: '12px',
                          fontSize: '16px',
                          marginTop: '2px'
                        }}>
                          ✓
                        </span>
                        <span style={{ 
                          fontSize: '15px', 
                          lineHeight: '1.5',
                          color: '#475569'
                        }}>
                          {rec}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>

                <div style={{
                  background: 'white',
                  padding: '24px',
                  borderRadius: '12px',
                  boxShadow: '0 4px 16px rgba(0, 0, 0, 0.08)'
                }}>
                  <h4 style={{ 
                    color: '#1e40af', 
                    fontSize: '18px', 
                    fontWeight: '600',
                    marginBottom: '16px',
                    display: 'flex',
                    alignItems: 'center'
                  }}>
                    🚀 Next Steps
                  </h4>
                  <ol style={{ 
                    padding: '0 0 0 20px',
                    margin: '0'
                  }}>
                    {recommendations.nextSteps.map((step, index) => (
                      <li key={index} style={{
                        padding: '8px 0',
                        fontSize: '15px',
                        lineHeight: '1.5',
                        color: '#475569'
                      }}>
                        {step}
                      </li>
                    ))}
                  </ol>
                </div>

                <div style={{
                  textAlign: 'center',
                  marginTop: '32px',
                  padding: '20px',
                  background: 'rgba(59, 130, 246, 0.1)',
                  borderRadius: '12px',
                  border: '1px solid rgba(59, 130, 246, 0.2)'
                }}>
                  <h4 style={{ 
                    color: '#1e40af', 
                    fontSize: '18px', 
                    fontWeight: '600',
                    marginBottom: '12px'
                  }}>
                    Ready to Begin Your Governance Journey?
                  </h4>
                  <p style={{ 
                    fontSize: '15px', 
                    color: '#475569',
                    marginBottom: '20px',
                    lineHeight: '1.5'
                  }}>
                    Your personalized learning path has been created based on your assessment results.
                    Start exploring the governance modules that match your current level and interests.
                  </p>
                  <button
                    onClick={() => {
                      // Navigate to appropriate module or dashboard
                      window.location.href = '/modules';
                    }}
                    style={{
                      background: 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)',
                      color: 'white',
                      border: 'none',
                      padding: '12px 24px',
                      borderRadius: '8px',
                      fontSize: '16px',
                      fontWeight: '600',
                      cursor: 'pointer',
                      boxShadow: '0 4px 12px rgba(59, 130, 246, 0.3)',
                      marginRight: '12px'
                    }}
                  >
                    Start Learning
                  </button>
                  <button
                    onClick={() => {
                      setShowResults(false);
                      window.scrollTo({ top: 0, behavior: 'smooth' });
                    }}
                    style={{
                      background: 'transparent',
                      color: '#3b82f6',
                      border: '2px solid #3b82f6',
                      padding: '10px 24px',
                      borderRadius: '8px',
                      fontSize: '16px',
                      fontWeight: '600',
                      cursor: 'pointer'
                    }}
                  >
                    Retake Assessment
                  </button>
                </div>
              </div>
            );
          })()}
        </div>
      )}
    </DocumentLayout>
  );
};

export default IntroductoryQuestions;
