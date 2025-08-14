import React, { useState } from "react";
import { aiExplain } from "./api";

export default function AIExplainPage() {
  const [moduleId, setModuleId] = useState("");
  const [subtopic, setSubtopic] = useState("");
  const [knownPoints, setKnownPoints] = useState("");
  const [level, setLevel] = useState("beginner");
  const [result, setResult] = useState(null);

  const handleSubmit = async () => {
    const res = await aiExplain(moduleId, subtopic, knownPoints, level);
    setResult(res);
  };

  return (
    <div>
      <h2>AI 讲解</h2>
      <input placeholder="模块ID" value={moduleId} onChange={e => setModuleId(e.target.value)} />
      <input placeholder="子主题" value={subtopic} onChange={e => setSubtopic(e.target.value)} />
      <input placeholder="已知要点" value={knownPoints} onChange={e => setKnownPoints(e.target.value)} />
      <select value={level} onChange={e => setLevel(e.target.value)}>
        <option value="beginner">初级</option>
        <option value="intermediate">中级</option>
        <option value="advanced">高级</option>
      </select>
      <button onClick={handleSubmit}>获取讲解</button>
      {result && <pre>{JSON.stringify(result, null, 2)}</pre>}
    </div>
  );
}