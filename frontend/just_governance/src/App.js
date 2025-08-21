import React, { useState } from "react";
import AIExplainPage from "./AIExplainPage";
import QuestionnairePage from "./QuestionnairePage";
import AIAskPage from "./AIAskPage";
import LoginPage from "./LoginPage";
import './App.css';

function App() {
  const [page, setPage] = useState("login");
  const [user, setUser] = useState(null);

  const handleLoginSuccess = (userData) => {
    setUser(userData);
    setPage("explain");
  };

  const handleLogout = () => {
    setUser(null);
    setPage("login");
  };

  // 如果用户未登录，显示登录页面
  if (!user) {
    return <LoginPage onLoginSuccess={handleLoginSuccess} />;
  }

  return (
    <div className="App">
      <nav style={{ margin: 20, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <button onClick={() => setPage("explain")}>AI Explanation</button>
          <button onClick={() => setPage("questionnaire")}>Questionnaire</button>
          <button onClick={() => setPage("ask")}>AI Q&A</button>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span>Welcome, {user.email}</span>
          <button onClick={handleLogout} style={{ background: '#f44336' }}>Logout</button>
        </div>
      </nav>
      {page === "explain" && <AIExplainPage />}
      {page === "questionnaire" && <QuestionnairePage moduleId="governance_basics" />}
      {page === "ask" && <AIAskPage />}
    </div>
  );
}

export default App;
