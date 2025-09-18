import React, { useEffect, useState } from "react";
import { BrowserRouter as Router, Routes, Route, Navigate } from "react-router-dom";
import LoginPage from "./pages/Auth";
import './styles/app.css';
import Home from './pages/Home';
import TermsAndConditions from './pages/TermsAndConditions';
import PrivacyPolicy from './pages/PrivacyPolicy';
import IntroductoryQuestions from './pages/IntroductoryQuestions';
import { dbApi } from './services/localDb';

function App() {
  const [user, setUser] = useState(null);

  useEffect(() => {
    const cu = dbApi.currentUser();
    if (cu) setUser(cu);
  }, []);

  const handleLoginSuccess = (userData) => {
    // 同时更新 React 状态和 dbApi localStorage
    setUser(userData);
    
    // 为了兼容现有的 dbApi，我们需要在 localStorage 中创建用户记录和会话
    const db = JSON.parse(localStorage.getItem('jg_local_db_v1') || '{}');
    if (!db.users) db.users = [];
    if (!db.sessions) db.sessions = {};
    
    // 检查用户是否已存在，如果不存在则创建
    let existingUser = db.users.find(u => u.email === userData.email);
    if (!existingUser) {
      existingUser = {
        id: userData.user_id || userData.id, // 新API格式使用 user_id
        email: userData.email,
        name: userData.name || userData.email.split('@')[0],
        email_verified_at: new Date().toISOString(),
        first_login_at: new Date().toISOString(),
        projectOverviewSeen: false,
        avatar_url: userData.avatar_url || null,
        password_hash: 'backend_managed' // 占位符，实际密码由后端管理
      };
      db.users.push(existingUser);
    }
    
    // 设置当前用户会话
    db.sessions.currentUserId = existingUser.id;
    db.sessions.currentUserEmail = existingUser.email;
    
    localStorage.setItem('jg_local_db_v1', JSON.stringify(db));
  };

  const handleLogout = () => {
    dbApi.logout();
    setUser(null);
  };

  return (
    <Router>
      <div className="App">
        <Routes>
          {/* Documentation page is always accessible */}
          <Route path="/terms" element={<TermsAndConditions />} />
          <Route path="/privacy" element={<PrivacyPolicy />} />
          {/* Login page: redirect to home if already logged in */}
          <Route path="/login" element={user ? <Navigate to="/" replace /> : <LoginPage onLoginSuccess={handleLoginSuccess} />} />
          {/* Home and other pages require login */}
          <Route path="/" element={user ? <Home user={user} onSignOut={handleLogout} /> : <Navigate to="/login" replace />} />
          <Route path="/welcome" element={user ? <IntroductoryQuestions /> : <Navigate to="/login" replace />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </div>
    </Router>
  );
}

export default App;
