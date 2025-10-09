import React, { useEffect, useState } from "react";
import { BrowserRouter as Router, Routes, Route, Navigate } from "react-router-dom";
import LoginPage from "./pages/Auth";
import './styles/app.css';
import Home from './pages/Home';
import Profile from './pages/Profile';
import Settings from './pages/Settings';
import TermsAndConditions from './pages/TermsAndConditions';
import PrivacyPolicy from './pages/PrivacyPolicy';
import IntroductoryQuestions from './pages/IntroductoryQuestions';
import { authApi } from './services/auth';
import VerifyEmail from './pages/VerifyEmail';

const USE_AUTH_V1 = process.env.REACT_APP_USE_AUTH_V1 === 'true';

function App() {
  const [user, setUser] = useState(null);
  const [booted, setBooted] = useState(false);

  useEffect(() => {
    (async () => {
      if (!USE_AUTH_V1) {
        setBooted(true);
        return;
      }
      try {
        await authApi.refresh();
        const me = await authApi.me();
        setUser(me);
      } catch {
        // 未登录或刷新失败
      } finally {
        setBooted(true);
      }
    })();
  }, []);

  const handleLoginSuccess = (userData) => {
    setUser(userData);
  };

  const handleLogout = async () => {
    if (USE_AUTH_V1) await authApi.logout();
    setUser(null);
  };

  if (!booted) {
    return <div className="App" style={{ padding: 24 }}>Loading...</div>;
  }

  return (
    <Router>
      <div className="App">
        <Routes>
          {/* Documentation page is always accessible */}
          <Route path="/terms" element={<TermsAndConditions />} />
          <Route path="/privacy" element={<PrivacyPolicy />} />
          <Route path="/verify-email" element={<VerifyEmail />} />
          
          {/* Login page: redirect to home if already logged in */}
          <Route path="/login" element={user ? <Navigate to="/" replace /> : <LoginPage onLoginSuccess={handleLoginSuccess} />} />
          
          {/* Protected pages require login */}
          <Route path="/" element={user ? <Home user={user} onSignOut={handleLogout} /> : <Navigate to="/login" replace />} />
          <Route path="/profile" element={user ? <Profile user={user} onBack={() => window.history.back()} /> : <Navigate to="/login" replace />} />
          <Route path="/settings" element={user ? <Settings user={user} onBack={() => window.history.back()} onSignOut={handleLogout} /> : <Navigate to="/login" replace />} />
          <Route path="/welcome" element={user ? <IntroductoryQuestions /> : <Navigate to="/login" replace />} />
          
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </div>
    </Router>
  );
}

export default App;
