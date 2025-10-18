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
    const termMap = {
      'Incorporated bodies': 'incorporated_bodies',
      'Companies': 'companies',
      'Not for profits': 'not_for_profits',
      'Community organisations': 'community_orgs',
      'Social enterprises': 'social_enterprises'
    };
    const familiarTerms = [];
    Object.entries(frontendAnswers.q2).forEach(([term, familiarity]) => {
      if (familiarity === 'Familiar') {
        const termValue = termMap[term] || term.toLowerCase().replace(/ /g, '_');
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
    const valueMap = {
      'Making a difference on an issue I care about': 'impact',
      'Getting a board role': 'get_board_role',
      'Learning new skills': 'learn_new_skills',
      'Understanding how key decisions get made': 'understand_decisions',
      'Meeting people and building networks': 'meet_and_network',
      'Furthering my career': 'further_career',
      'Other': 'other'
    };
    const values = frontendAnswers.q3.map(v => valueMap[v] || v.toLowerCase().replace(/ /g, '_'));
    let text = null;
    if (frontendAnswers.q3_other && frontendAnswers.q3_other.trim()) {
      text = frontendAnswers.q3_other;
    }
    backendAnswers.push({
      question_number: 3,
      question_key: 'interest_motivation',
      question_type: 'multi_choice',
      value: values,
      ...(text && { text })
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
    const valueMap = {
      'Community and social justice': 'social_justice',
      'Sport and recreation': 'sport',
      'Arts and culture': 'arts',
      'Health': 'health',
      'Housing and homelessness': 'housing',
      'Gender': 'gender',
      'Women\'s safety': 'womens_safety',
      'Environment': 'environment',
      'Other': 'other'
    };
    const values = frontendAnswers.q7.map(v => valueMap[v] || v.toLowerCase().replace(/ /g, '_'));
    let text = null;
    if (frontendAnswers.q7_other && frontendAnswers.q7_other.trim()) {
      text = frontendAnswers.q7_other;
    }
    backendAnswers.push({
      question_number: 7,
      question_key: 'interest_areas',
      question_type: 'multi_choice',
      value: values,
      ...(text && { text })
    });
  }

  // Q8: Financial experience (single choice)
  if (frontendAnswers.q8) {
    const valueMap = {
      'Never': 'never',
      'Occasionally': 'occasionally',
      'Often': 'often'
    };
    backendAnswers.push({
      question_number: 8,
      question_key: 'financial_experience',
      question_type: 'single_choice',
      value: valueMap[frontendAnswers.q8] || frontendAnswers.q8.toLowerCase()
    });
  }

  // Q9: New terms (multi choice)
  if (frontendAnswers.q9) {
    const valueMap = {
      'Constitution': 'constitution',
      'Director': 'director',
      'Nominee': 'nominee',
      'Conflict of interest': 'conflict_of_interest',
      'Agenda': 'agenda',
      'Minutes': 'minutes',
      'Fiduciary duties': 'fiduciary_duties'
    };
    const values = frontendAnswers.q9.map(v => valueMap[v] || v.toLowerCase().replace(/ /g, '_'));
    backendAnswers.push({
      question_number: 9,
      question_key: 'new_terms',
      question_type: 'multi_choice',
      value: values
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
    const valueMap = {
      'What boards actually do': 'what_boards_do',
      'How board decisions are made': 'decision_process',
      'The legal duties and responsibilities of board members': 'legal_duties',
      'How to get on a board': 'join_board',
      'The different types of boards in Australia': 'board_types',
      'When a board is needed and how to set one up': 'setup_board',
      'Something else': 'other',
      'Other': 'other'
    };
    const values = frontendAnswers.q11.map(v => valueMap[v] || v.toLowerCase().replace(/ /g, '_'));
    let text = null;
    if (frontendAnswers.q11_other && frontendAnswers.q11_other.trim()) {
      text = frontendAnswers.q11_other;
    }
    backendAnswers.push({
      question_number: 11,
      question_key: 'learning_interest',
      question_type: 'multi_choice',
      value: values,
      ...(text && { text })
    });
  }

  // Q12: (Previously Q13) Training barriers (multi choice, may have text)
  if (frontendAnswers.q13) {
    const valueMap = {
      "Confidence or feeling unsure about what I know and don't know": 'confidence',
      'Time or family commitments': 'time_commitments',
      'Access to internet or computer': 'internet_access',
      'Accessibility needs (please share)': 'accessibility_needs',
      'Other': 'other',
      'Nothing comes to mind': 'none'
    };
    const values = frontendAnswers.q13.map(v => valueMap[v] || v.toLowerCase().replace(/ /g, '_'));
    
    // Combine text from multiple sources
    const textParts = [];
    if (values.includes('accessibility_needs') && frontendAnswers.q13_accessibility) {
      textParts.push(`Accessibility: ${frontendAnswers.q13_accessibility}`);
    }
    if (values.includes('other') && frontendAnswers.q13_other && frontendAnswers.q13_other.trim()) {
      textParts.push(`Other: ${frontendAnswers.q13_other}`);
    }
    const text = textParts.length > 0 ? textParts.join('; ') : null;
    
    backendAnswers.push({
      question_number: 12,
      question_key: 'training_barriers',
      question_type: 'multi_choice',
      value: values,
      ...(text && { text })
    });
  }

  return backendAnswers;
}
