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
        setBanner('Email verified successfully. Please log in.');
      } catch (e) {
        setStatus('error');
        const code = e?.body?.code;
        if (code === 1003) setBanner('Link expired. Please resend.');
        else if (code === 1004) setBanner('Invalid link. Please resend verification email.');
        else if (code === 1005) setBanner('This link has been revoked. Please use the latest link.');
        else setBanner('Verification failed. Please try again.');
      }
    })();
  }, [token]);

  const resend = async (e) => {
    e.preventDefault();
    if (!email) return setBanner('Please enter your email before resending.');
    try {
      await authApi.resendVerify({ email });
      setBanner('Verification email sent. Please check your inbox.');
    } catch (e) {
      if (e.status === 429) setBanner('Too many requests. Please try again later.'); 
      else setBanner('Failed to send. Please try again.');
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
            <button onClick={() => navigate('/login')}>Go to Login</button>
          </div>
        )}

        {status === 'error' && (
          <form onSubmit={resend} className="form">
            <input type="email" placeholder="Enter your email to resend verification" value={email} onChange={(e)=>setEmail(e.target.value)} required />
            <button type="submit">Resend Verification Email</button>
            <div className="link" style={{ marginTop: 8 }}>
              <Link to="/login">Back to Login</Link>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
