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

  const onLogin = (e) => {
    e.preventDefault();
    const { loginEmail, loginPassword } = formData;
    if (!loginEmail || !loginPassword) return setBanner('Please enter email and password');
    const res = dbApi.login(loginEmail, loginPassword);
    if (!res.ok) {
      if (res.code === 'no_account') setBanner('Account not found · Go to Sign Up');
      else if (res.code === 'wrong_password') setBanner('Incorrect password · Forgot Password?');
      else if (res.code === 'unverified') {
        setBanner('Please verify your email first');
        // Send verification email and navigate to verification page
        const r = dbApi.createEmailVerificationToken(loginEmail);
        if (r.ok) {
          setVerify({ email: loginEmail, token: r.token });
          setStage('verify');
        }
      }
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
    // Registration successful → send verification email and redirect to verification page
    const r = dbApi.createEmailVerificationToken(regEmail);
    if (r.ok) setVerify({ email: regEmail, token: r.token });
    setBanner('Verify your email · A verification link has been sent');
    setStage('verify');
  };

  const onResendVerify = () => {
    const email = verify.email || formData.regEmail || formData.loginEmail;
    if (!email) return setBanner('Enter your email then resend');
    const r = dbApi.createEmailVerificationToken(email);
    if (r.ok) setVerify({ email, token: r.token });
    setBanner('Verification email resent');
  };

  const onDoVerify = () => {
    if (!verify.token || !verify.email) return setBanner('Missing verification link');
    const r = dbApi.consumeEmailVerificationToken(verify.token);
    if (!r.ok) return setBanner('Link expired · Resend verification email');
    setBanner('Email verified');
    const tryPwd = formData.regPassword || formData.loginPassword || '';
    if (tryPwd) {
      const login = dbApi.login(verify.email, tryPwd);
      if (login.ok) return onLoginSuccess?.(login.user);
    }
    setActiveTab('login');
    setStage('auth');
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
    <div className="third-party-buttons">
      {['Google', 'Microsoft', 'LinkedIn', 'Apple'].map(p => (
        <button key={p} className="third-party-btn" onClick={() => {
          try {
            const provider = p.toLowerCase();
            const provider_account_id = Math.random().toString(36).slice(2);
            const res = dbApi.oauthFindOrCreate(provider, provider_account_id, {});
            if (res.ok && res.isNew) {
              // First authorization: complete profile, don't redirect immediately
              setOauthCtx({ provider, provider_account_id, email: res.user.email, user: res.user });
              setStage('oauth_profile');
              setBanner('Complete your profile to continue');
            } else if (res.ok) {
              onLoginSuccess?.(res.user);
            } else if (res.code === 'bind_required') {
              // Need to bind to existing local account
              setOauthCtx({ provider, provider_account_id, email: res.email });
              setStage('oauth_bind');
              setBanner('Account Binding required');
            } else {
              setBanner('Authorization not completed');
            }
          } catch {
            setBanner('Authorization not completed');
          }
        }} >{p}</button>
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
                    onClick={() => {
                      const res = dbApi.createTestAccountsAndLogin();
                      if (res.ok) onLoginSuccess?.(res.user);
                    }}
                    className="test-login-btn"
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
              if (oauthCtx?.user?.id) {
                const upd = dbApi.updateUserProfile(oauthCtx.user.id, { name: formData.regName });
                if (upd.ok) return onLoginSuccess?.(upd.user);
              }
              // Fallback: continue directly
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
              const r = dbApi.oauthBind(formData.loginEmail || oauthCtx?.email, formData.loginPassword, oauthCtx?.provider, oauthCtx?.provider_account_id);
              if (r.ok) onLoginSuccess?.(r.user); else if (r.code === 'wrong_password') setBanner('Incorrect password'); else setBanner('Binding failed');
            }}>Bind & Continue</button>
            <div className="link"><a href="#back" onClick={(e)=>{e.preventDefault(); setStage('auth'); setBanner('');}}>Back</a></div>
          </div>
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
            <div style={{ fontSize: 12, color: '#475569', margin: '6px 0' }}>We sent a verification link to {verify.email || formData.regEmail || formData.loginEmail}.</div>
            <button onClick={onDoVerify}>Click verification link (simulate)</button>
            <button onClick={onResendVerify}>Resend verification email</button>
            <div className="link">
              <a href="#back" onClick={(e) => { e.preventDefault(); setStage('auth'); }}>Back</a>
            </div>
          </div>
        )}

        <div className="footer">
          <a href="/terms" style={{ textDecoration: 'underline', color: '#2563eb' }}>Terms of Service</a> | <a href="/privacy" style={{ textDecoration: 'underline', color: '#2563eb' }}>Privacy Policy</a>
        </div>
      </div>
    </div>
  );
};

export default LoginPage;
