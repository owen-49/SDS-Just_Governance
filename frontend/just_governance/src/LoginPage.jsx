import React, { useState } from 'react';
import './LoginPage.css';

const LoginPage = ({ onLoginSuccess }) => {
  const [activeTab, setActiveTab] = useState('login');
  const [formData, setFormData] = useState({
    loginEmail: '',
    loginPassword: '',
    regEmail: '',
    regPassword: '',
    regConfirm: '',
    regName: '',
    regTerms: false
  });

  const handleInputChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));
  };

  const validateLogin = (e) => {
    e.preventDefault();
    const { loginEmail, loginPassword } = formData;

    if (!loginEmail.trim() || !loginPassword.trim()) {
      alert("Please enter email and password");
      return;
    }

    // 模拟异常分支
    if (loginEmail === "nouser@test.com") {
      alert("Account does not exist, please register first");
    } else if (loginPassword !== "123456") {
      alert("Incorrect password, please try again or click forgot password");
    } else if (loginEmail === "unverified@test.com") {
      alert("Email not verified, please complete email verification first");
    } else {
      alert("Login successful!");
      // 调用父组件的登录成功回调
      if (onLoginSuccess) {
        onLoginSuccess({ email: loginEmail });
      }
    }
  };

  const validateRegister = (e) => {
    e.preventDefault();
    const { regEmail, regPassword, regConfirm, regTerms } = formData;

    if (!regEmail.trim() || !regPassword.trim() || !regConfirm.trim()) {
      alert("Please fill in complete information");
      return;
    }
    if (regPassword !== regConfirm) {
      alert("Passwords do not match");
      return;
    }
    if (!regTerms) {
      alert("Please agree to the terms of service");
      return;
    }

    // 模拟邮箱已注册
    if (regEmail === "exist@test.com") {
      alert("This email is already registered, please log in directly");
      setActiveTab('login');
      return;
    }

    alert("Registration successful! Please verify your email");
  };

  return (
    <div className="login-container">
      <div className="login-form-container">
        <h2>Login / Register</h2>
        
        <div className="tabs">
          <div 
            className={`tab ${activeTab === 'login' ? 'active' : ''}`}
            onClick={() => setActiveTab('login')}
          >
            Login
          </div>
          <div 
            className={`tab ${activeTab === 'register' ? 'active' : ''}`}
            onClick={() => setActiveTab('register')}
          >
            Register
          </div>
        </div>

        {/* 登录表单 */}
        {activeTab === 'login' && (
          <form onSubmit={validateLogin} className="form">
            <input
              type="email"
              name="loginEmail"
              value={formData.loginEmail}
              onChange={handleInputChange}
              placeholder="Email"
              required
            />
            <input
              type="password"
              name="loginPassword"
              value={formData.loginPassword}
              onChange={handleInputChange}
              placeholder="Password"
              required
            />
            <button type="submit">Login</button>
            <div className="link">
              <a href="#forgot">Forgot password?</a>
            </div>
          </form>
        )}

        {/* 注册表单 */}
        {activeTab === 'register' && (
          <form onSubmit={validateRegister} className="form">
            <input
              type="email"
              name="regEmail"
              value={formData.regEmail}
              onChange={handleInputChange}
              placeholder="Email"
              required
            />
            <input
              type="password"
              name="regPassword"
              value={formData.regPassword}
              onChange={handleInputChange}
              placeholder="Password"
              required
            />
            <input
              type="password"
              name="regConfirm"
              value={formData.regConfirm}
              onChange={handleInputChange}
              placeholder="Confirm Password"
              required
            />
            <input
              type="text"
              name="regName"
              value={formData.regName}
              onChange={handleInputChange}
              placeholder="Name (Optional)"
            />
            <label className="checkbox-label">
              <input
                type="checkbox"
                name="regTerms"
                checked={formData.regTerms}
                onChange={handleInputChange}
              />
              I agree to the terms of service
            </label>
            <button type="submit">Register</button>
          </form>
        )}

        {/* 底部 */}
        <div className="footer">
          <a href="#terms">Terms of Service</a> | <a href="#privacy">Privacy Policy</a>
        </div>
      </div>
    </div>
  );
};

export default LoginPage;
