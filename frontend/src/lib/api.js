import { request } from '../services/http';

// Re-export request for other modules
export { request } from '../services/http';

// Consider changing this to an environment variable or relative path for production.
// const API_BASE = "http://localhost:8000";

// async function handleJSON(res, defaultErrMsg) {
//   if (!res.ok) {
//     let detail = "";
//     try {
//       detail = await res.text();
//     } catch {
//       /* ignore */
//     }
//     throw new Error(`${defaultErrMsg}: ${res.status} ${detail}`);
//   }
//   return res.json();
// }

export async function getQuestionnaire(moduleId) {
  const body = await request(`/assessment/${moduleId}`);
  return body;
}

export async function gradeAnswers(moduleId, answers) {
  const body = await request(`/assessment/grade`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ module_id: moduleId, answers })
  });
  return body;
}

export async function aiExplain(moduleId, subtopic, knownPointsArray, level) {
  const body = await request(`/ai/explain`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ module_id: moduleId, subtopic, known_points: knownPointsArray, level })
  });
  return body;
}

export async function aiAsk(params) {
  let question, level;
  if (typeof params === 'object' && params?.question) {
    question = params.question;
    level = params.level || 'beginner';
  } else {
    question = params;
    level = arguments[1] || 'beginner';
  }
  const body = await request(`/ai/ask`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ question, level })
  });
  return body;
}