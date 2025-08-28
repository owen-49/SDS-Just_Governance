import React, { useEffect, useState } from "react";
import LoginPage from "./pages/Auth";
import './styles/app.css';
import Home from './pages/Home';
import { dbApi } from './lib/localDb';

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

  if (!user) {
    return <LoginPage onLoginSuccess={handleLoginSuccess} />;
  }

  return (
    <div className="App">
      <Home user={user} onSignOut={handleLogout} />
    </div>
  );
}

export default App;
