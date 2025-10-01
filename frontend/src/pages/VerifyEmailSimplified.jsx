import React, { useEffect, useState } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { authService } from '../services/authSimplified';

export default function VerifyEmailSimplified() {
  const [params] = useSearchParams();
  const [status, setStatus] = useState('loading');
  const [message, setMessage] = useState('');
  const [email, setEmail] = useState('');
  
  const token = params.get('token') || '';

  useEffect(() => {
    const verifyToken = async () => {
      if (!token) {
        setStatus('error');
        setMessage('Invalid verification link');
        return;
      }

      try {
        await authService.verifyEmail(token);
        setStatus('success');
        setMessage('Email verified successfully! You can now sign in.');
      } catch (error) {
        setStatus('error');
        const code = error?.body?.code;
        
        switch (code) {
          case 1003:
            setMessage('Verification link has expired');
            break;
          case 1004:
            setMessage('Invalid verification link');
            break;
          case 1005:
            setMessage('This link has been revoked. Please use the latest link.');
            break;
          default:
            setMessage('Verification failed. Please try again.');
        }
      }
    };

    verifyToken();
  }, [token]);

  const handleResend = async (e) => {
    e.preventDefault();
    if (!email) {
      setMessage('Please enter your email address');
      return;
    }

    try {
      await authService.resendVerification(email);
      setMessage('New verification email sent! Please check your inbox.');
    } catch {
      setMessage('Failed to send verification email. Please try again.');
    }
  };

  return (
    <div className="login-container">
      <div className="login-form-container">
        <h2>Email Verification</h2>
        
        <div className={`banner ${status === 'success' ? 'success' : status === 'error' ? 'error' : ''}`}>
          {status === 'loading' ? 'Verifying your email...' : message}
        </div>

        {status === 'error' && (
          <form className="form" onSubmit={handleResend}>
            <p>Enter your email to resend verification:</p>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Enter your email"
              required
            />
            <button type="submit">Resend Verification Email</button>
          </form>
        )}

        <div className="link">
          <Link to="/login">Back to Sign In</Link>
        </div>
      </div>
    </div>
  );
}
