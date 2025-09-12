// Consider changing this to an environment variable or relative path for production.
const API_BASE = "http://localhost:8000";

async function handleJSON(res, defaultErrMsg) {
  if (!res.ok) {
    let detail = "";
    try {
      detail = await res.text();
    } catch {
      /* ignore */
    }
    throw new Error(`${defaultErrMsg}: ${res.status} ${detail}`);
  }
  return res.json();
}

export async function getQuestionnaire(moduleId) {
  const res = await fetch(`${API_BASE}/assessment/${moduleId}`);
  return handleJSON(res, "Failed to load questionnaire");
}

export async function gradeAnswers(moduleId, answers) {
  const res = await fetch(`${API_BASE}/assessment/grade`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ module_id: moduleId, answers }),
  });
  return handleJSON(res, "Grading failed");
}

export async function aiExplain(moduleId, subtopic, knownPointsArray, level) {
  const res = await fetch(`${API_BASE}/ai/explain`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      module_id: moduleId,
      subtopic,
      known_points: knownPointsArray,
      level
    }),
  });
  return handleJSON(res, "AI explanation failed");
}

export async function aiAsk(params) {
  // Support both object parameter and legacy (question, level) format
  let question, level;
  if (typeof params === 'object' && params.question) {
    question = params.question;
    level = params.level || 'beginner';
  } else {
    question = params;
    level = arguments[1] || 'beginner';
  }

  const res = await fetch(`${API_BASE}/ai/ask`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ question, level }),
  });
  return handleJSON(res, "AI Q&A failed");
}