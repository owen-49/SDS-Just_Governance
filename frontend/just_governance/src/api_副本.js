const API_BASE = "http://172.19.123.100:8000";
export async function getQuestionnaire(moduleId) {
  const res = await fetch(`${API_BASE}/assessment/${moduleId}`);
  if (!res.ok) throw new Error("加载问卷失败");
  return res.json();
}

export async function gradeAnswers(moduleId, answers) {
  const res = await fetch(`${API_BASE}/assessment/grade`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ module_id: moduleId, answers }),
  });
  if (!res.ok) throw new Error("评分失败");
  return res.json();
}

export async function aiExplain(moduleId, subtopic, knownPoints, level) {
  const res = await fetch(`${API_BASE}/ai/explain`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ module_id: moduleId, subtopic, known_points: knownPoints, level }),
  });
  if (!res.ok) throw new Error("AI 讲解失败");
  return res.json();
}

export async function aiAsk(question, level) {
  const res = await fetch(`${API_BASE}/ai/ask`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ question, level }),
  });
  if (!res.ok) throw new Error("AI 问答失败");
  return res.json();
}