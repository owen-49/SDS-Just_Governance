import { request } from './http';

// Map backend unified response to plain values
function okData(body) {
  return body?.data ?? body;
}

export const onboardingApi = {
  // GET /api/v1/onboarding/survey
  async getSurvey() {
    const body = await request('/api/v1/onboarding/survey', {
      method: 'GET'
    });
    return okData(body);
  },

  // POST /api/v1/onboarding/survey/submit
  async submitSurvey(answers) {
    const body = await request('/api/v1/onboarding/survey/submit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ answers })
    });
    return okData(body);
  },

  // GET /api/v1/onboarding/survey/result
  async getResult() {
    const body = await request('/api/v1/onboarding/survey/result', {
      method: 'GET'
    });
    return okData(body);
  }
};

/**
 * 将前端问卷答案格式转换为后端期望的格式
 * 
 * 前端格式示例:
 * {
 *   q1: 'Very confident',
 *   q2: { 'Companies': 'Familiar', 'Not for profits': 'Not familiar', ... },
 *   q3: ['impact', 'learn_new_skills'],
 *   q3_other: '',
 *   ...
 * }
 * 
 * 后端期望格式:
 * [
 *   {
 *     question_number: 1,
 *     question_key: 'confidence_in_boards',
 *     question_type: 'single_choice',
 *     value: 'very_confident'
 *   },
 *   ...
 * ]
 */
export function transformAnswersToBackendFormat(frontendAnswers) {
  const backendAnswers = [];

  // Q1: Confidence in boards (single choice)
  if (frontendAnswers.q1) {
    backendAnswers.push({
      question_number: 1,
      question_key: 'confidence_in_boards',
      question_type: 'single_choice',
      value: frontendAnswers.q1 === 'Very confident' ? 'very_confident'
        : frontendAnswers.q1 === 'Somewhat confident' ? 'somewhat_confident'
        : 'not_confident'
    });
  }

  // Q2: Familiar terms (multi choice with nested structure)
  if (frontendAnswers.q2) {
    const familiarTerms = [];
    Object.entries(frontendAnswers.q2).forEach(([term, familiarity]) => {
      if (familiarity === 'Familiar') {
        const termValue = term.toLowerCase().replace(/ /g, '_');
        familiarTerms.push(termValue);
      }
    });
    backendAnswers.push({
      question_number: 2,
      question_key: 'familiar_terms',
      question_type: 'multi_choice',
      value: familiarTerms
    });
  }

  // Q3: Interest motivation (multi choice with max 2, may have text)
  if (frontendAnswers.q3) {
    const values = [...frontendAnswers.q3];
    let text = null;
    if (values.includes('Other') && frontendAnswers.q3_other) {
      text = frontendAnswers.q3_other;
    }
    backendAnswers.push({
      question_number: 3,
      question_key: 'interest_motivation',
      question_type: 'multi_choice',
      value: values,
      text: text
    });
  }

  // Q4: Legal familiarity (single choice)
  if (frontendAnswers.q4) {
    backendAnswers.push({
      question_number: 4,
      question_key: 'legal_familiarity',
      question_type: 'single_choice',
      value: frontendAnswers.q4 === 'Very familiar' ? 'very_familiar'
        : frontendAnswers.q4 === 'Somewhat familiar' ? 'somewhat_familiar'
        : 'not_familiar'
    });
  }

  // Q5: Governance idea (single choice)
  if (frontendAnswers.q5) {
    backendAnswers.push({
      question_number: 5,
      question_key: 'governance_idea',
      question_type: 'single_choice',
      value: frontendAnswers.q5 === 'Clear idea' ? 'clear_idea'
        : frontendAnswers.q5 === 'A rough idea' ? 'rough_idea'
        : 'not_sure'
    });
  }

  // Q6: Decision experience (single choice)
  if (frontendAnswers.q6) {
    backendAnswers.push({
      question_number: 6,
      question_key: 'decision_experience',
      question_type: 'single_choice',
      value: frontendAnswers.q6 === 'Yes, often' ? 'often'
        : frontendAnswers.q6 === 'Yes, a few times' ? 'few_times'
        : 'never'
    });
  }

  // Q7: Interest areas (multi choice, may have text)
  if (frontendAnswers.q7) {
    const values = [...frontendAnswers.q7];
    let text = null;
    if (values.includes('Other') && frontendAnswers.q7_other) {
      text = frontendAnswers.q7_other;
    }
    backendAnswers.push({
      question_number: 7,
      question_key: 'interest_areas',
      question_type: 'multi_choice',
      value: values,
      text: text
    });
  }

  // Q8: Financial experience (single choice)
  if (frontendAnswers.q8) {
    backendAnswers.push({
      question_number: 8,
      question_key: 'financial_experience',
      question_type: 'single_choice',
      value: frontendAnswers.q8.toLowerCase()
    });
  }

  // Q9: New terms (multi choice)
  if (frontendAnswers.q9) {
    backendAnswers.push({
      question_number: 9,
      question_key: 'new_terms',
      question_type: 'multi_choice',
      value: frontendAnswers.q9
    });
  }

  // Q10: Group comfort (single choice)
  if (frontendAnswers.q10) {
    backendAnswers.push({
      question_number: 10,
      question_key: 'group_comfort',
      question_type: 'single_choice',
      value: frontendAnswers.q10 === 'Very comfortable' ? 'very_comfortable'
        : frontendAnswers.q10 === 'Sometimes comfortable' ? 'sometimes_comfortable'
        : frontendAnswers.q10 === 'Not very comfortable' ? 'not_very_comfortable'
        : 'not_sure'
    });
  }

  // Q11: Learning interest (multi choice with max 2, may have text)
  if (frontendAnswers.q11) {
    const values = [...frontendAnswers.q11];
    let text = null;
    if (values.includes('Something else') && frontendAnswers.q11_other) {
      text = frontendAnswers.q11_other;
    }
    backendAnswers.push({
      question_number: 11,
      question_key: 'learning_interest',
      question_type: 'multi_choice',
      value: values,
      text: text
    });
  }

  // Q12: (Skipping as it's not in the backend definition - seems to be Q13 in frontend)
  
  // Q13: Training barriers (multi choice, may have text)
  if (frontendAnswers.q13) {
    const values = [...frontendAnswers.q13];
    let text = null;
    // Combine text from multiple sources
    const textParts = [];
    if (values.includes('Accessibility needs (please share)') && frontendAnswers.q13_accessibility) {
      textParts.push(`Accessibility: ${frontendAnswers.q13_accessibility}`);
    }
    if (values.includes('Other') && frontendAnswers.q13_other) {
      textParts.push(`Other: ${frontendAnswers.q13_other}`);
    }
    if (textParts.length > 0) {
      text = textParts.join('; ');
    }
    backendAnswers.push({
      question_number: 12,
      question_key: 'training_barriers',
      question_type: 'multi_choice',
      value: values,
      text: text
    });
  }

  return backendAnswers;
}
