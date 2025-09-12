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
    setUser(userData);
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
