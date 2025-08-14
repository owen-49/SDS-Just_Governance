import React, { useState } from "react";
import { aiAsk } from "./api";

export default function AIAskPage() {
  const [question, setQuestion] = useState("");
  const [level, setLevel] = useState("beginner");
  const [result, setResult] = useState(null);

  const handleSubmit = async () => {
    const res = await aiAsk(question, level);
    setResult(res);
  };

  return (
    <div>
      <h2>AI 问答</h2>
      <input
        placeholder="请输入你的问题"
        value={question}
        onChange={e => setQuestion(e.target.value)}
      />
      <select value={level} onChange={e => setLevel(e.target.value)}>
        <option value="beginner">初级</option>
        <option value="intermediate">中级</option>
        <option value="advanced">高级</option>
      </select>
      <button onClick={handleSubmit}>提问</button>
      {result && <pre>{JSON.stringify(result, null, 2)}</pre>}
    </div>
  );
}