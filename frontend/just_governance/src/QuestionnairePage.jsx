import React, { useState, useEffect } from "react";
import { getQuestionnaire, gradeAnswers } from "./api";

export default function QuestionnairePage({ moduleId }) {
  const [questions, setQuestions] = useState([]);
  const [answers, setAnswers] = useState({});
  const [result, setResult] = useState(null);

  useEffect(() => {
    getQuestionnaire(moduleId).then(setQuestions);
  }, [moduleId]);

  const handleChange = (qid, value) => {
    setAnswers({ ...answers, [qid]: value });
  };

  const handleSubmit = async () => {
    const res = await gradeAnswers(moduleId, answers);
    setResult(res);
  };

  return (
    <div>
      <h2>问卷</h2>
      {questions.map(q => (
        <div key={q.id}>
          <p>{q.text}</p>
          <input
            value={answers[q.id] || ""}
            onChange={e => handleChange(q.id, e.target.value)}
          />
        </div>
      ))}
      <button onClick={handleSubmit}>提交</button>
      {result && <pre>{JSON.stringify(result, null, 2)}</pre>}
    </div>
  );
}