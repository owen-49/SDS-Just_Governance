import React, { useEffect, useState } from 'react';
import { useSearchParams, Link, useNavigate } from 'react-router-dom';
import { authApi } from '../services/auth';

export default function VerifyEmail() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const token = params.get('token') || '';
  const [status, setStatus] = useState('loading'); // loading | success | error
  const [banner, setBanner] = useState('');
  const [email, setEmail] = useState('');

  useEffect(() => {
    (async () => {
      if (!token) {
        setStatus('error');
        setBanner('Invalid link. Please resend verification email.');
        return;
      }
      try {
        await authApi.verifyByToken(token);
        setStatus('success');
        setBanner('Email verified successfully! You can now login to your account.');
        
        // 3秒后自动跳转到登录页
        setTimeout(() => {
          navigate('/auth?tab=login');
        }, 3000);
      } catch (e) {
        setStatus('error');
        const code = e?.body?.code;
        if (code === 1003) setBanner('Verification link has expired. Please request a new verification email.');
        else if (code === 1004) setBanner('Invalid verification link. Please request a new verification email.');
        else if (code === 1005) setBanner('This verification link has been revoked. Please use the latest verification email.');
        else setBanner('Verification failed. Please try again or request a new verification email.');
      }
    })();
  }, [token, navigate]);

  const resend = async (e) => {
    e.preventDefault();
    if (!email) return setBanner('Please enter your email before resending.');
    try {
      const result = await authApi.resendVerify({ email });
      
      // 根据API文档处理不同的响应消息
      if (result?.message === 'already_verified') {
        setBanner('Your account is already verified. Please go to login.');
        setTimeout(() => {
          navigate('/auth?tab=login');
        }, 2000);
      } else {
        setBanner('Verification email sent. Please check your inbox.');
        if (result?.expires_in_hours) {
          console.log(`Verification link expires in ${result.expires_in_hours} hours`);
        }
      }
    } catch (e) {
      if (e.status === 429) {
        const retryAfter = e.retryAfter || 60;
        setBanner(`Too many requests. Try again in ${retryAfter} seconds.`);
      } else {
        setBanner('Failed to send verification email. Please try again.');
      }
    }
  };

  return (
    <div className="login-container">
      <div className="login-form-container">
        <h2>Email Verification</h2>
        {banner && (
          <div className={`banner ${status === 'success' ? 'success' : (status === 'error' ? 'error' : '')}`}>{banner}</div>
        )}

        {status === 'loading' && <div>Verifying, please wait...</div>}

        {status === 'success' && (
          <div className="form">
            <button onClick={() => navigate('/auth?tab=login')}>Go to Login</button>
            <p style={{ marginTop: '1rem', color: '#666', fontSize: '0.9rem' }}>
              You will be automatically redirected to the login page in 3 seconds...
            </p>
          </div>
        )}

        {status === 'error' && (
          <form onSubmit={resend} className="form">
            <input type="email" placeholder="Enter your email to resend verification" value={email} onChange={(e)=>setEmail(e.target.value)} required />
            <button type="submit">Resend Verification Email</button>
            <div className="link" style={{ marginTop: 8 }}>
              <Link to="/auth?tab=login">Back to Login</Link>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
