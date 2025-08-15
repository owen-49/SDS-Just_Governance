import React, { useState } from "react";
import { aiExplain } from "./api";

export default function AIExplainPage() {
  const [moduleId, setModuleId] = useState("");
  const [subtopic, setSubtopic] = useState("");
  const [knownPoints, setKnownPoints] = useState("");
  const [level, setLevel] = useState("beginner");
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");

  const handleSubmit = async () => {
    setLoading(true);
    setErr("");
    try {
      // Convert to array for backend (commas / semicolons / newlines)
      const kpArray = knownPoints
        .split(/[，,;；\n]/)
        .map(s => s.trim())
        .filter(Boolean);
      const res = await aiExplain(moduleId, subtopic, kpArray, level);
      setResult(res);
    } catch (e) {
      setErr(e.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <h2>AI Explanation</h2>
      <input
        placeholder="Module ID"
        value={moduleId}
        onChange={e => setModuleId(e.target.value)}
      />
      <input
        placeholder="Subtopic"
        value={subtopic}
        onChange={e => setSubtopic(e.target.value)}
      />
      <input
        placeholder="Known Points (comma separated)"
        value={knownPoints}
        onChange={e => setKnownPoints(e.target.value)}
      />
      <select value={level} onChange={e => setLevel(e.target.value)}>
        <option value="beginner">Beginner</option>
        <option value="intermediate">Intermediate</option>
        <option value="advanced">Advanced</option>
      </select>
      <button onClick={handleSubmit} disabled={loading}>
        {loading ? "Loading..." : "Get Explanation"}
      </button>
      {err && <p style={{ color: "red" }}>Error: {err}</p>}
      {result && <pre>{JSON.stringify(result, null, 2)}</pre>}
    </div>
  );
}