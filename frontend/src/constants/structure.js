// Basic content structure for Sections -> Modules -> Topics
// This is mock data for frontend-only demo and can be replaced by backend-driven data later.

export const sections = [
  {
    id: 'core_skills',
    name: 'Core Skills',
    modules: [
      {
        id: 'finance_basics',
        name: 'Financial Basics',
        topics: [
          {
            id: 'cash_flow',
            name: 'Cash Flow Analysis',
            intro: 'Understand cash inflows and outflows, and how to analyze cash flow statements to gauge liquidity.',
            keyPoints: [
              'Operating vs. investing vs. financing cash flows',
              'Free cash flow (FCF) and its importance',
              'Cash conversion cycle basics'
            ],
            resources: [],
            scenario: false,
            quiz: {
              questions: [
                {
                  id: 'q1',
                  stem: 'Which activity category typically includes cash received from customers?',
                  options: ['Operating', 'Investing', 'Financing', 'Non-cash'],
                  answer: 0,
                  explanation: 'Customer receipts are part of operating cash flows.'
                },
                {
                  id: 'q2',
                  stem: 'Free Cash Flow (FCF) is generally computed as:',
                  options: [
                    'Operating CF + Net Income',
                    'Operating CF - CapEx',
                    'Net Income - Dividends',
                    'Cash + Cash Equivalents'
                  ],
                  answer: 1,
                  explanation: 'FCF is operating cash flow minus capital expenditures.'
                },
                {
                  id: 'q3',
                  stem: 'A shorter cash conversion cycle usually means:',
                  options: [
                    'Weaker liquidity',
                    'Better liquidity/efficiency',
                    'Higher inventory costs',
                    'Lower sales'
                  ],
                  answer: 1,
                  explanation: 'Shorter cycle implies faster cash recovery and better efficiency.'
                }
              ]
            }
          },
          {
            id: 'budgeting',
            name: 'Budgeting 101',
            intro: 'Learn how to build budgets and track variances to ensure financial discipline.',
            keyPoints: [
              'Top-down vs. bottom-up budgets',
              'Variance analysis basics',
              'Rolling forecast'
            ],
            resources: [],
            scenario: false,
            quiz: {
              questions: [
                {
                  id: 'q1',
                  stem: 'Which approach starts with high-level targets before detailing line items?',
                  options: ['Bottom-up', 'Top-down', 'Zero-based', 'Flexible'],
                  answer: 1,
                  explanation: 'Top-down begins with overall targets and cascades downward.'
                },
                {
                  id: 'q2',
                  stem: 'Variance analysis primarily compares:',
                  options: ['Actual vs. Budget', 'AR vs. AP', 'Cash vs. Accrual', 'Revenue vs. Profit'],
                  answer: 0,
                  explanation: 'Variance = actual minus budget to analyze deviations.'
                }
              ]
            }
          }
        ]
      },
      {
        id: 'governance_compliance',
        name: 'Governance & Compliance',
        topics: [
          {
            id: 'ethics_basics',
            name: 'Ethics Basics',
            intro: 'Understand core principles of ethics and compliance in governance.',
            keyPoints: ['Integrity', 'Transparency', 'Accountability'],
            resources: [],
            scenario: false,
            quiz: {
              questions: [
                {
                  id: 'q1',
                  stem: 'Which is NOT a typical governance principle?',
                  options: ['Accountability', 'Opacity', 'Fairness', 'Transparency'],
                  answer: 1,
                  explanation: 'Opacity contradicts transparency in good governance.'
                }
              ]
            }
          }
        ]
      }
    ]
  },
  {
    id: 'diversity_pathways',
    name: 'Diversity Pathways',
    modules: [
      {
        id: 'resources_young_women',
        name: 'Resources for Young Women',
        topics: [
          {
            id: 'mentorship',
            name: 'Mentorship Essentials',
            intro: 'Learn to find mentors and make the most of mentorship programs.',
            keyPoints: ['Setting goals', 'Scheduling', 'Feedback loops'],
            resources: [],
            scenario: true,
            quiz: {
              questions: [
                {
                  id: 'q1',
                  stem: 'A good mentorship goal should be:',
                  options: ['Vague and flexible', 'Specific and measurable', 'Short-term only', 'Hidden from mentor'],
                  answer: 1,
                  explanation: 'SMART goals help track progress and outcomes.'
                }
              ]
            }
          }
        ]
      }
    ]
  }
];

export function findTopicById(topicId) {
  for (const s of sections) {
    for (const m of s.modules) {
      for (const t of m.topics) {
        if (t.id === topicId) return { section: s, module: m, topic: t };
      }
    }
  }
  return null;
}
