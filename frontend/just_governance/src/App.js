import React, { useState } from "react";
import AIExplainPage from "./AIExplainPage";
import QuestionnairePage from "./QuestionnairePage";
import AIAskPage from "./AIAskPage";
import './App.css';

function App() {
  const [page, setPage] = useState("explain");

  return (
    <div className="App">
      <nav style={{ margin: 20 }}>
        <button onClick={() => setPage("explain")}>AI Explanation</button>
        <button onClick={() => setPage("questionnaire")}>Questionnaire</button>
        <button onClick={() => setPage("ask")}>AI Q&A</button>
      </nav>
      {page === "explain" && <AIExplainPage />}
      {page === "questionnaire" && <QuestionnairePage moduleId="governance_basics" />}
      {page === "ask" && <AIAskPage />}
    </div>
  );
}

export default App;
