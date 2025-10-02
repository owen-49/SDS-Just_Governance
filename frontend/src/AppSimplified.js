import React, { useEffect, useState } from "react";
import { BrowserRouter as Router, Routes, Route, Navigate } from "react-router-dom";
import AuthPage from "./pages/AuthSimplified";
import './styles/app.css';
import Home from './pages/Home';
import TermsAndConditions from './pages/TermsAndConditions';
import PrivacyPolicy from './pages/PrivacyPolicy';
import IntroductoryQuestions from './pages/IntroductoryQuestions';
import VerifyEmail from './pages/VerifyEmail';
import { authService } from './services/authSimplified';

const USE_AUTH_V1 = process.env.REACT_APP_USE_AUTH_V1 === 'true';

function App() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const initAuth = async () => {
      if (!USE_AUTH_V1) {
        setLoading(false);
        return;
      }
      
      try {
        await authService.refresh();
        const userData = await authService.me();
        setUser(userData);
      } catch {
        // 未登录或刷新失败
      } finally {
        setLoading(false);
      }
    };

    initAuth();
  }, []);

  const handleLogin = (userData) => setUser(userData);
  
  const handleLogout = async () => {
    try {
      await authService.logout();
    } catch {
      // 忽略登出错误
    }
    setUser(null);
  };

  if (loading) {
    return <div className="App" style={{ padding: 24 }}>Loading...</div>;
  }

  return (
    <Router>
      <div className="App">
        <Routes>
          <Route path="/terms" element={<TermsAndConditions />} />
          <Route path="/privacy" element={<PrivacyPolicy />} />
          <Route path="/verify-email" element={<VerifyEmail />} />
          
          <Route 
            path="/login" 
            element={user ? <Navigate to="/" replace /> : <AuthPage onLoginSuccess={handleLogin} />} 
          />
          
          <Route 
            path="/" 
            element={user ? <Home user={user} onSignOut={handleLogout} /> : <Navigate to="/login" replace />} 
          />
          
          <Route 
            path="/welcome" 
            element={user ? <IntroductoryQuestions /> : <Navigate to="/login" replace />} 
          />
          
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </div>
    </Router>
  );
}

export default App;
