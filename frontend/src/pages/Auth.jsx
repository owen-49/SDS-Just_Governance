import React, { useState } from 'react';
import '../styles/auth.css';
import {
  register as apiRegister,
  login as apiLogin,
  me as apiMe,
  verifyEmail as apiVerifyEmail,
  resendVerification as apiResendVerification,
  forgotPassword as apiForgotPassword,
  resetPassword as apiResetPassword
} from '../api/auth.js';

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
  const [stage, setStage] = useState('auth'); // auth | forgot | reset | verify | oauth_profile | oauth_bind
  const [banner, setBanner] = useState('');
  const [verify, setVerify] = useState({ email: '', token: '' });
  const [oauthCtx, setOauthCtx] = useState(null); // { provider, provider_account_id, email?, user? }

  const handleInputChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));
  };

  const onLogin = async (e) => {
    e.preventDefault();
    const { loginEmail, loginPassword } = formData;
    if (!loginEmail || !loginPassword) return setBanner('Please enter email and password');
    try {
      const res = await apiLogin(loginEmail, loginPassword);
      
      // 检查响应格式
      if (res.code === 0) {
        // 登录成功，保存 token
        localStorage.setItem('access_token', res.data.access_token);
        setBanner('Login successful');
        
        // 检查是否首次登录需要显示介绍
        if (res.data.show_intro) {
          setBanner('Welcome! Showing project introduction...');
          // TODO: 显示项目简介modal
        }
        
        onLoginSuccess?.(res.data.user);
      } else {
        // Handle various error cases
        if (res.code === 3001) {
          setBanner('Account not found');
        } else if (res.code === 2001) {
          setBanner('Incorrect password');
        } else if (res.code === 4001) {
          setBanner('Email not verified, please verify your email first');
          // 可以显示重新发送验证邮件的选项
        } else {
          setBanner(res.message || 'Login failed');
        }
      }
    } catch (err) {
      setBanner(err.message || 'Login failed');
    }
  };

  const onRegister = async (e) => {
    e.preventDefault();
    const { regEmail, regPassword, regConfirm, regName, regTerms } = formData;
    if (!regEmail || !regPassword || !regConfirm) return setBanner('Please fill all required fields');
    if (regPassword !== regConfirm) return setBanner('Passwords do not match');
    if (regPassword.length < 8) return setBanner('Password must be at least 8 characters');
    if (!regTerms) return setBanner('Please accept the terms');
    
    try {
      const res = await apiRegister(regEmail, regPassword, regName);
      
      if (res.code === 0) {
        // 注册成功
        setVerify({ email: regEmail, token: '' });
        setBanner('Registration successful · A verification link has been sent to your email');
        setStage('verify');
      } else {
        // 处理错误情况
        if (res.code === 4001 && res.message === 'email already exists') {
          setBanner('This email is already registered. Please go to Sign In.');
          setActiveTab('login');
        } else if (res.code === 2001) {
          setBanner('Please check your input: ' + res.message);
        } else {
          setBanner(res.message || 'Registration failed');
        }
      }
    } catch (err) {
      setBanner(err.message || 'Registration failed');
    }
  };

  const onResendVerify = async () => {
    const email = verify.email || formData.regEmail || formData.loginEmail;
    if (!email) return setBanner('Enter your email then resend');
    try {
      const res = await apiResendVerification(email);
      if (res.code === 0) {
        setBanner('Verification email resent successfully');
      } else if (res.code === 3001) {
        setBanner('User not found');
      } else if (res.code === 4001) {
        setBanner('Email already verified');
      } else {
        setBanner(res.message || 'Resend verification failed');
      }
    } catch (err) {
      setBanner(err.message || 'Resend verification failed');
    }
  };

  const onDoVerify = async () => {
    if (!verify.token) return setBanner('Please enter the verification token from your email');
    try {
      const res = await apiVerifyEmail(verify.token);
      if (res.code === 0) {
        setBanner('Email verified successfully! You can now login.');
        setActiveTab('login');
        setStage('auth');
      } else if (res.code === 3001) {
        setBanner('Verification link not found');
      } else if (res.code === 4001) {
        setBanner('Verification link expired or already used · Please resend verification email');
      } else {
        setBanner(res.message || 'Verification failed');
      }
    } catch (err) {
      setBanner(err.message || 'Verification failed');
    }
  };

  const onForgot = async (e) => {
    e.preventDefault();
    if (!formData.forgotEmail) return setBanner('Please enter email');
    try {
      const res = await apiForgotPassword(formData.forgotEmail);
      if (res.code === 0) {
        setBanner('Reset instructions sent to your email if the account exists');
        setFormData(f => ({ ...f, resetEmail: formData.forgotEmail, resetToken: '' }));
        setStage('reset');
      } else {
        setBanner(res.message || 'Failed to send reset email');
      }
    } catch (err) {
      setBanner(err.message || 'Failed to send reset email');
    }
  };

  const onReset = async (e) => {
    e.preventDefault();
    const { resetToken, resetPassword1, resetPassword2 } = formData;
    if (!resetToken) return setBanner('Please enter the reset token from your email');
    if (!resetPassword1 || !resetPassword2) return setBanner('Enter new password');
    if (resetPassword1 !== resetPassword2) return setBanner('Passwords do not match');
    if (resetPassword1.length < 8) return setBanner('Password must be at least 8 characters');
    
    try {
      const res = await apiResetPassword(resetToken, resetPassword1);
      if (res.code === 0) {
        setBanner('Password reset successfully! You can now login with your new password.');
        setStage('auth');
        setActiveTab('login');
      } else if (res.code === 3001) {
        setBanner('Reset link not found');
      } else if (res.code === 4001) {
        setBanner('Reset link expired or already used · Please request a new reset email');
      } else {
        setBanner(res.message || 'Reset failed');
      }
    } catch (err) {
      setBanner(err.message || 'Reset failed');
    }
  };

  // Quick test login
  const onQuickTestLogin = async () => {
    try {
      // First create test user
      const createRes = await fetch(`${process.env.REACT_APP_API_BASE_URL || 'http://localhost:8000'}/api/v1/auth/create-test-user`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });
      const createData = await createRes.json();
      
      // Then login with test user
      const res = await apiLogin('test@example.com', '123456');
      
      if (res.code === 0) {
        localStorage.setItem('access_token', res.data.access_token);
        setBanner('Test user login successful!');
        if (res.data.show_intro) {
          setBanner('Welcome! Showing project introduction...');
        }
        onLoginSuccess?.(res.data.user);
      } else {
        setBanner(res.message || 'Test login failed');
      }
    } catch (err) {
      setBanner(err.message || 'Test login failed');
    }
  };

  // TODO: 第三方登录相关功能未实现，以下为占位处理
  const ThirdPartyButtons = () => (
    <div className="third-party-buttons">
      {['Google', 'Microsoft', 'LinkedIn', 'Apple'].map(p => (
        <button key={p} className="third-party-btn" onClick={() => {
          setBanner('Third-party login not implemented yet');
        }}>{p}</button>
      ))}
    </div>
  );

  return (
    <div className="login-container">
      <div className="login-form-container">
        <h2>Sign In / Sign Up</h2>
        {banner && (
          <div className={`banner ${
            banner.includes('Please') || 
            banner.includes('Incorrect') || 
            banner.includes('not found') || 
            banner.includes('expired') || 
            banner.includes('not completed') || 
            banner.includes('failed') || 
            banner.includes('Missing') || 
            banner.includes('do not match') || 
            banner.includes('already registered') || 
            banner.includes('accept the terms')
              ? 'error' 
              : banner.includes('successfully') || 
                banner.includes('verified') || 
                banner.includes('resent') || 
                banner.includes('sent')
              ? 'success' 
              : ''
          }`}>
            {banner}
          </div>
        )}

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
                
                {/* Quick test login */}
                <div style={{ margin: '12px 0', padding: '16px', background: 'linear-gradient(135deg, #f0fdf4 0%, #dcfce7 100%)', border: '1px solid #22c55e', borderRadius: '12px' }}>
                  <div style={{ fontSize: '13px', color: '#15803d', marginBottom: '12px', fontWeight: 600 }}>Quick Test Login:</div>
                  <button 
                    type="button" 
                    onClick={onQuickTestLogin}
                    className="test-login-btn"
                    style={{ backgroundColor: '#22c55e', color: 'white', border: 'none', padding: '8px 16px', borderRadius: '6px', cursor: 'pointer', fontSize: '13px' }}
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

        {/* Third-party: Complete profile */}
        {stage === 'oauth_profile' && (
          <div className="form">
            <div>Complete Profile</div>
            <div style={{ fontSize: 12, color: '#475569', margin: '6px 0' }}>Signed in with {oauthCtx?.provider}. Please confirm your name and accept the terms.</div>
            <input type="text" name="regName" value={formData.regName} onChange={handleInputChange} placeholder="Name" />
            <label className="checkbox-label">
              <input type="checkbox" name="regTerms" checked={formData.regTerms} onChange={handleInputChange} />
              I accept the terms
            </label>
            <button onClick={() => {
              if (!formData.regTerms) return setBanner('Please accept the terms');
              // TODO: updateUserProfile 功能未实现
              onLoginSuccess?.(oauthCtx?.user);
            }}>Continue</button>
            <div className="link"><a href="#back" onClick={(e)=>{e.preventDefault(); setStage('auth'); setBanner('');}}>Back</a></div>
          </div>
        )}

        {/* Third-party: Account binding */}
        {stage === 'oauth_bind' && (
          <div className="form">
            <div>Account Binding</div>
            <div style={{ fontSize: 12, color: '#475569', margin: '6px 0' }}>Bind your {oauthCtx?.provider} account to an existing local account.</div>
            <input type="email" name="loginEmail" value={formData.loginEmail || oauthCtx?.email || ''} onChange={handleInputChange} placeholder="Email" />
            <input type="password" name="loginPassword" value={formData.loginPassword} onChange={handleInputChange} placeholder="Password" />
            <button onClick={() => {
              setBanner('账号绑定功能未实现');
            }}>Bind & Continue</button>
            <div className="link"><a href="#back" onClick={(e)=>{e.preventDefault(); setStage('auth'); setBanner('');}}>Back</a></div>
          </div>
        )}

        {stage === 'forgot' && (
          <form onSubmit={onForgot} className="form">
            <input type="email" name="forgotEmail" value={formData.forgotEmail} onChange={handleInputChange} placeholder="Enter your email" required />
            <button type="submit">Send reset email</button>
            <div className="link">
              <a href="#back" onClick={(e) => { e.preventDefault(); setStage('auth'); }}>Back</a>
            </div>
          </form>
        )}
        <div className="footer">
          <a href="/terms" style={{ textDecoration: 'underline', color: '#2563eb' }}>Terms of Service</a> | <a href="/privacy" style={{ textDecoration: 'underline', color: '#2563eb' }}>Privacy Policy</a>
        </div>
      </div>
    </div>
  );
};

export default LoginPage;
