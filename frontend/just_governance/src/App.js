import React, { useState } from "react";
import AIExplainPage from "./AIExplainPage";
import QuestionnairePage from "./QuestionnairePage";
import AIAskPage from "./AIAskPage";
import './App.css';

function App() {
  const [page, setPage] = useState("explain"); // 默认显示AI讲解

  return (
    <div className="App">
      <nav style={{ margin: 20 }}>
        <button onClick={() => setPage("explain")}>AI讲解</button>
        <button onClick={() => setPage("questionnaire")}>问卷</button>
        <button onClick={() => setPage("ask")}>AI问答</button>
      </nav>
      {page === "explain" && <AIExplainPage />}
      {page === "questionnaire" && <QuestionnairePage moduleId="governance_basics" />}
      {page === "ask" && <AIAskPage />}
    </div>
  );
}

export default App;
