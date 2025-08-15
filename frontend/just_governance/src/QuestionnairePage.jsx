import React, { useState, useEffect } from "react";
import { getQuestionnaire, gradeAnswers } from "./api";

export default function QuestionnairePage({ moduleId }) {
  const [questions, setQuestions] = useState([]);
  const [answers, setAnswers] = useState({});
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [grading, setGrading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError("");
    getQuestionnaire(moduleId)
      .then(qs => {
        if (active) setQuestions(qs);
      })
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
    return () => { active = false; };
  }, [moduleId]);

  const handleChange = (qid, value) => {
    setAnswers(prev => ({ ...prev, [qid]: value }));
  };

  const handleSubmit = async () => {
    setGrading(true);
    setError("");
    setResult(null);
    try {
      const res = await gradeAnswers(moduleId, answers);
      setResult(res);
    } catch (e) {
      setError(e.message);
    } finally {
      setGrading(false);
    }
  };

  return (
    <div>
      <h2>Questionnaire</h2>
      {loading && <p>Loading...</p>}
      {error && <p style={{color: 'red'}}>Error: {error}</p>}
      {!loading && questions.map(q => (
        <div key={q.id} style={{ marginBottom: 12 }}>
          <p>{q.question}</p>
          <input
            value={answers[q.id] || ""}
            onChange={e => handleChange(q.id, e.target.value)}
            placeholder="Your answer"
          />
        </div>
      ))}
      <button onClick={handleSubmit} disabled={grading || loading || !questions.length}>
        {grading ? "Grading..." : "Submit"}
      </button>
      {result && (
        <div style={{ marginTop: 16 }}>
          <h3>Result</h3>
          <pre>{JSON.stringify(result, null, 2)}</pre>
        </div>
      )}
    </div>
  );
}