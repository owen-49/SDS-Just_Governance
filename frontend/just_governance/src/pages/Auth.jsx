import React, { useState } from 'react';
import '../styles/auth.css';
import { dbApi } from '../lib/localDb';

const LoginPage = ({ onLoginSuccess }) => {
  const [activeTab, setActiveTab] = useState('login');
  const [formData, setFormData] = useState({
    loginEmail: '',
    loginPassword: '',
    regEmail: '',
    regPassword: '',
    regConfirm: '',
    regName: '',
    regTerms: false,
    forgotEmail: '',
    resetEmail: '',
    resetToken: '',
    resetPassword1: '',
    resetPassword2: ''
  });
  const [stage, setStage] = useState('auth'); // auth | forgot | reset | verify
  const [banner, setBanner] = useState('');

  const handleInputChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));
  };

  const onLogin = (e) => {
    e.preventDefault();
    const { loginEmail, loginPassword } = formData;
    if (!loginEmail || !loginPassword) return setBanner('Please enter email and password');
    const res = dbApi.login(loginEmail, loginPassword);
    if (!res.ok) {
      if (res.code === 'no_account') setBanner('Account not found · Go to Sign Up');
      else if (res.code === 'wrong_password') setBanner('Incorrect password · Forgot Password?');
      else if (res.code === 'unverified') setBanner('Please verify your email first');
      return;
    }
    onLoginSuccess?.(res.user);
  };

  const onRegister = (e) => {
    e.preventDefault();
    const { regEmail, regPassword, regConfirm, regName, regTerms } = formData;
    if (!regEmail || !regPassword || !regConfirm) return setBanner('Please fill all required fields');
    if (regPassword !== regConfirm) return setBanner('Passwords do not match');
    if (!regTerms) return setBanner('Please accept the terms');
    const res = dbApi.register(regEmail, regPassword, regName);
    if (!res.ok && res.code === 'exists') {
      setBanner('This email is already registered. Go to Sign In.');
      setActiveTab('login');
      return;
    }
    // 自动登录新注册的用户
    setBanner('Account created successfully!');
    const loginRes = dbApi.login(regEmail, regPassword);
    if (loginRes.ok) {
      onLoginSuccess?.(loginRes.user);
    }
  };

  const onResendVerify = () => {
    const email = formData.regEmail || formData.loginEmail;
    if (!email) return setBanner('Enter your email then resend');
    dbApi.resendVerification(email);
    setBanner('Verification email resent');
  };

  const onDoVerify = () => {
    const email = formData.regEmail || formData.loginEmail;
    if (!email) return setBanner('Missing email to verify');
    const r = dbApi.verifyEmail(email);
    if (!r.ok) return setBanner('Link expired · Resend verification email');
    setBanner('Email verified');
    const login = dbApi.login(email, (formData.regPassword || formData.loginPassword));
    if (login.ok) onLoginSuccess?.(login.user);
  };

  const onForgot = (e) => {
    e.preventDefault();
    if (!formData.forgotEmail) return setBanner('Please enter email');
    const { token } = dbApi.forgotPassword(formData.forgotEmail);
    setBanner('Reset email sent');
    setFormData(f => ({ ...f, resetEmail: formData.forgotEmail, resetToken: token }));
    setStage('reset');
  };

  const onReset = (e) => {
    e.preventDefault();
    const { resetEmail, resetToken, resetPassword1, resetPassword2 } = formData;
    if (!resetPassword1 || !resetPassword2) return setBanner('Enter new password');
    if (resetPassword1 !== resetPassword2) return setBanner('Passwords do not match');
    const r = dbApi.resetPassword(resetEmail, resetToken, resetPassword1);
    if (!r.ok) return setBanner('Reset link expired · Resend');
    setBanner('Password reset successfully');
    setStage('auth');
    setActiveTab('login');
  };

  const ThirdPartyButtons = () => (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8, marginTop: 8 }}>
      {['Google', 'Microsoft', 'LinkedIn', 'Apple'].map(p => (
        <button key={p} onClick={() => setBanner('Authorization not completed')} style={{ padding: 8, border: '1px solid #ddd', borderRadius: 6, background: '#fff' }}>{p}</button>
      ))}
    </div>
  );

  return (
    <div className="login-container">
      <div className="login-form-container">
        <h2>Sign In / Sign Up</h2>
        {banner && <div style={{ background: '#fff7ed', border: '1px solid #fed7aa', color: '#7c2d12', padding: 8, borderRadius: 6, marginBottom: 8 }}>{banner}</div>}

        {stage === 'auth' && (
          <>
            <div className="tabs">
              <div 
                className={`tab ${activeTab === 'login' ? 'active' : ''}`}
                onClick={() => setActiveTab('login')}
              >
                Sign In
              </div>
              <div 
                className={`tab ${activeTab === 'register' ? 'active' : ''}`}
                onClick={() => setActiveTab('register')}
              >
                Sign Up
              </div>
            </div>

            {activeTab === 'login' && (
              <form onSubmit={onLogin} className="form">
                <input type="email" name="loginEmail" value={formData.loginEmail} onChange={handleInputChange} placeholder="Email" required />
                <input type="password" name="loginPassword" value={formData.loginPassword} onChange={handleInputChange} placeholder="Password" required />
                <button type="submit">Sign In</button>
                
                {/* 快速测试登录 */}
                <div style={{ margin: '10px 0', padding: '10px', background: '#f0f9ff', border: '1px solid #0ea5e9', borderRadius: '6px' }}>
                  <div style={{ fontSize: '12px', color: '#0369a1', marginBottom: '8px' }}>Quick Test Login:</div>
                  <button 
                    type="button" 
                    onClick={() => {
                      dbApi.createTestAccounts();
                      setFormData(prev => ({ ...prev, loginEmail: 'test@example.com', loginPassword: '123456' }));
                      const res = dbApi.login('test@example.com', '123456');
                      if (res.ok) onLoginSuccess?.(res.user);
                    }}
                    style={{ width: '100%', padding: '8px', background: '#0ea5e9', color: 'white', border: 'none', borderRadius: '4px', fontSize: '12px' }}
                  >
                    Use Test Account (test@example.com / 123456)
                  </button>
                </div>
                
                <div className="link">
                  <a href="#forgot" onClick={(e) => { e.preventDefault(); setStage('forgot'); }}>Forgot Password?</a>
                </div>
                <ThirdPartyButtons />
              </form>
            )}

            {activeTab === 'register' && (
              <form onSubmit={onRegister} className="form">
                <input type="email" name="regEmail" value={formData.regEmail} onChange={handleInputChange} placeholder="Email" required />
                <input type="password" name="regPassword" value={formData.regPassword} onChange={handleInputChange} placeholder="Password" required />
                <input type="password" name="regConfirm" value={formData.regConfirm} onChange={handleInputChange} placeholder="Confirm Password" required />
                <input type="text" name="regName" value={formData.regName} onChange={handleInputChange} placeholder="Name (Yes please)" />
                <label className="checkbox-label">
                  <input type="checkbox" name="regTerms" checked={formData.regTerms} onChange={handleInputChange} />
                  I accept the terms
                </label>
                <button type="submit">Create account</button>
              </form>
            )}
          </>
        )}

        {stage === 'forgot' && (
          <form onSubmit={onForgot} className="form">
            <input type="email" name="forgotEmail" value={formData.forgotEmail} onChange={handleInputChange} placeholder="Enter your email" required />
            <button type="submit">Send reset email</button>
            <div className="link">
              <a href="#back" onClick={(e) => { e.preventDefault(); setStage('auth'); }}>Back to Sign In</a>
            </div>
          </form>
        )}

        {stage === 'reset' && (
          <form onSubmit={onReset} className="form">
            <input type="email" name="resetEmail" value={formData.resetEmail} onChange={handleInputChange} placeholder="Email" required />
            <input type="text" name="resetToken" value={formData.resetToken} onChange={handleInputChange} placeholder="Reset token (from email link)" required />
            <input type="password" name="resetPassword1" value={formData.resetPassword1} onChange={handleInputChange} placeholder="New password" required />
            <input type="password" name="resetPassword2" value={formData.resetPassword2} onChange={handleInputChange} placeholder="Confirm new password" required />
            <button type="submit">Set new password</button>
            <div className="link">
              <a href="#back" onClick={(e) => { e.preventDefault(); setStage('auth'); }}>Back to Sign In</a>
            </div>
          </form>
        )}

        {stage === 'verify' && (
          <div className="form">
            <div>Verify your email</div>
            <button onClick={onDoVerify}>Click verification link (simulate)</button>
            <button onClick={onResendVerify}>Resend verification email</button>
            <div className="link">
              <a href="#back" onClick={(e) => { e.preventDefault(); setStage('auth'); }}>Back to Sign In</a>
            </div>
          </div>
        )}

        <div className="footer">
          <a href="#terms">Terms of Service</a> | <a href="#privacy">Privacy Policy</a>
        </div>
      </div>
    </div>
  );
};

export default LoginPage;
