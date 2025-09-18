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

// Auth API
export async function register(email, password, name) {
  const res = await fetch(`${API_BASE}/api/v1/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password, name }),
  });
  return handleJSON(res, 'Register failed');
}

export async function login(email, password) {
  const res = await fetch(`${API_BASE}/api/v1/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  return handleJSON(res, 'Login failed');
}

export async function me(token) {
  const res = await fetch(`${API_BASE}/api/v1/auth/me`, {
    method: 'GET',
    headers: { 'Authorization': `Bearer ${token}` },
  });
  return handleJSON(res, 'Get user info failed');
}

export async function verifyEmail(token) {
  const res = await fetch(`${API_BASE}/api/v1/auth/verify-email?token=${encodeURIComponent(token)}`);
  return handleJSON(res, 'Email verification failed');
}

export async function resendVerification(email) {
  const res = await fetch(`${API_BASE}/api/v1/auth/resend-verification`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email }),
  });
  return handleJSON(res, 'Resend verification failed');
}

export async function forgotPassword(email) {
  const res = await fetch(`${API_BASE}/api/v1/auth/forgot-password`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email }),
  });
  return handleJSON(res, 'Forgot password failed');
}

export async function resetPassword(token, newPassword) {
  const res = await fetch(`${API_BASE}/api/v1/auth/reset-password`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ token, new_password: newPassword }),
  });
  return handleJSON(res, 'Reset password failed');
}