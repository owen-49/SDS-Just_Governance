import React, { useState } from "react";
import { aiAsk } from "./api";

export default function AIAskPage() {
  const [question, setQuestion] = useState("");
  const [level, setLevel] = useState("beginner");
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");

  const handleSubmit = async () => {
    setLoading(true);
    setErr("");
    try {
      const res = await aiAsk(question, level);
      setResult(res);
    } catch (e) {
      setErr(e.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <h2>AI Q&A</h2>
      <input
        placeholder="Enter your question"
        value={question}
        onChange={e => setQuestion(e.target.value)}
      />
      <select value={level} onChange={e => setLevel(e.target.value)}>
        <option value="beginner">Beginner</option>
        <option value="intermediate">Intermediate</option>
        <option value="advanced">Advanced</option>
      </select>
      <button onClick={handleSubmit} disabled={loading}>
        {loading ? "Asking..." : "Ask"}
      </button>
      {err && <p style={{ color: "red" }}>Error: {err}</p>}
      {result && <pre>{JSON.stringify(result, null, 2)}</pre>}
    </div>
  );
}