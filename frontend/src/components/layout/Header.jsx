import React from 'react';
import { Link, useNavigate } from 'react-router-dom';

export default function Header({ onToggleSidebar, onStartAssessment, onOpenOverview, onProfile, onSignOut, user, currentTopicId, onBackToHome }) {
  const navigate = useNavigate();
  
  return (
    <header style={{
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      padding: '12px 20px', 
      background: 'linear-gradient(135deg, #ffffff 0%, #f8fafc 100%)',
      borderBottom: '1px solid rgba(226, 232, 240, 0.8)',
      boxShadow: '0 2px 8px rgba(0, 0, 0, 0.04)',
      backdropFilter: 'blur(10px)',
      position: 'sticky',
      top: 0,
      zIndex: 1000
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
        <button 
          onClick={onToggleSidebar} 
          aria-label="Toggle navigation" 
          style={{ 
            padding: '10px 12px',
            background: 'rgba(37, 99, 235, 0.1)',
            border: '1px solid rgba(37, 99, 235, 0.2)',
            borderRadius: '8px',
            color: '#2563eb',
            cursor: 'pointer',
            transition: 'all 0.2s ease',
            fontSize: '16px'
          }}
          onMouseOver={(e) => {
            e.target.style.background = 'rgba(37, 99, 235, 0.15)';
            e.target.style.transform = 'scale(1.05)';
          }}
          onMouseOut={(e) => {
            e.target.style.background = 'rgba(37, 99, 235, 0.1)';
            e.target.style.transform = 'scale(1)';
          }}
        >
          ☰
        </button>
        <Link 
          to="/" 
          style={{ 
            textDecoration: 'none', 
            fontWeight: 700, 
            fontSize: '18px',
            color: '#0f172a',
            cursor: 'pointer',
            background: 'linear-gradient(135deg, #0f172a 0%, #334155 100%)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            backgroundClip: 'text',
            transition: 'transform 0.2s ease'
          }}
          onMouseOver={(e) => e.target.style.transform = 'scale(1.02)'}
          onMouseOut={(e) => e.target.style.transform = 'scale(1)'}
        >
          Just Governance
        </Link>
        {currentTopicId && onBackToHome && (
          <button 
            onClick={onBackToHome}
            style={{
              background: 'rgba(34, 197, 94, 0.1)',
              border: '1px solid rgba(34, 197, 94, 0.2)',
              borderRadius: '6px',
              color: '#059669',
              cursor: 'pointer',
              padding: '6px 12px',
              fontSize: '14px',
              fontWeight: 500,
              transition: 'all 0.2s ease',
              display: 'flex',
              alignItems: 'center',
              gap: '4px'
            }}
            onMouseOver={(e) => {
              e.target.style.background = 'rgba(34, 197, 94, 0.15)';
              e.target.style.transform = 'translateY(-1px)';
            }}
            onMouseOut={(e) => {
              e.target.style.background = 'rgba(34, 197, 94, 0.1)';
              e.target.style.transform = 'translateY(0)';
            }}
            title="Back to Home"
          >
            ← Home
          </button>
        )}
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <button 
          onClick={() => navigate('/learning/topics')} 
          style={{ 
            background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
            color: '#fff', 
            border: 'none', 
            padding: '10px 16px', 
            borderRadius: '8px',
            fontWeight: 600,
            fontSize: '14px',
            cursor: 'pointer',
            transition: 'all 0.3s ease',
            boxShadow: '0 4px 12px rgba(16, 185, 129, 0.3)',
            position: 'relative',
            overflow: 'hidden'
          }}
          onMouseOver={(e) => {
            e.target.style.transform = 'translateY(-2px)';
            e.target.style.boxShadow = '0 8px 20px rgba(16, 185, 129, 0.4)';
          }}
          onMouseOut={(e) => {
            e.target.style.transform = 'translateY(0)';
            e.target.style.boxShadow = '0 4px 12px rgba(16, 185, 129, 0.3)';
          }}
        >
          📚 Learning Hub
        </button>
        <button 
          onClick={() => navigate('/admin')} 
          style={{ 
            background: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)',
            color: '#fff', 
            border: 'none', 
            padding: '10px 16px', 
            borderRadius: '8px',
            fontWeight: 600,
            fontSize: '14px',
            cursor: 'pointer',
            transition: 'all 0.3s ease',
            boxShadow: '0 4px 12px rgba(245, 158, 11, 0.3)',
            position: 'relative',
            overflow: 'hidden'
          }}
          onMouseOver={(e) => {
            e.target.style.transform = 'translateY(-2px)';
            e.target.style.boxShadow = '0 8px 20px rgba(245, 158, 11, 0.4)';
          }}
          onMouseOut={(e) => {
            e.target.style.transform = 'translateY(0)';
            e.target.style.boxShadow = '0 4px 12px rgba(245, 158, 11, 0.3)';
          }}
        >
          🔧 Admin
        </button>
        <button 
          onClick={onStartAssessment} 
          style={{ 
            background: 'linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)',
            color: '#fff', 
            border: 'none', 
            padding: '10px 16px', 
            borderRadius: '8px',
            fontWeight: 600,
            fontSize: '14px',
            cursor: 'pointer',
            transition: 'all 0.3s ease',
            boxShadow: '0 4px 12px rgba(37, 99, 235, 0.3)',
            position: 'relative',
            overflow: 'hidden'
          }}
          onMouseOver={(e) => {
            e.target.style.transform = 'translateY(-2px)';
            e.target.style.boxShadow = '0 8px 20px rgba(37, 99, 235, 0.4)';
          }}
          onMouseOut={(e) => {
            e.target.style.transform = 'translateY(0)';
            e.target.style.boxShadow = '0 4px 12px rgba(37, 99, 235, 0.3)';
          }}
        >
          Start your governance journey
        </button>
        <button 
          onClick={onOpenOverview} 
          title="Project Overview" 
          style={{ 
            padding: '10px 12px', 
            borderRadius: '8px', 
            border: '1px solid rgba(226, 232, 240, 0.8)', 
            background: 'rgba(255, 255, 255, 0.9)',
            backdropFilter: 'blur(10px)',
            cursor: 'pointer',
            transition: 'all 0.2s ease',
            fontSize: '16px'
          }}
          onMouseOver={(e) => {
            e.target.style.background = 'rgba(255, 255, 255, 1)';
            e.target.style.transform = 'translateY(-1px)';
            e.target.style.boxShadow = '0 4px 12px rgba(0, 0, 0, 0.08)';
          }}
          onMouseOut={(e) => {
            e.target.style.background = 'rgba(255, 255, 255, 0.9)';
            e.target.style.transform = 'translateY(0)';
            e.target.style.boxShadow = 'none';
          }}
        >
          ℹ️ Project Overview
        </button>
        <button 
          title="Notifications" 
          style={{ 
            padding: '10px 12px', 
            borderRadius: '8px', 
            border: '1px solid rgba(226, 232, 240, 0.8)', 
            background: 'rgba(255, 255, 255, 0.9)',
            backdropFilter: 'blur(10px)',
            cursor: 'pointer',
            transition: 'all 0.2s ease',
            fontSize: '16px',
            position: 'relative'
          }}
          onMouseOver={(e) => {
            e.target.style.background = 'rgba(255, 255, 255, 1)';
            e.target.style.transform = 'translateY(-1px)';
            e.target.style.boxShadow = '0 4px 12px rgba(0, 0, 0, 0.08)';
          }}
          onMouseOut={(e) => {
            e.target.style.background = 'rgba(255, 255, 255, 0.9)';
            e.target.style.transform = 'translateY(0)';
            e.target.style.boxShadow = 'none';
          }}
        >
          🔔
        </button>
        <div style={{ position: 'relative', zIndex: 1000 }}>
          <details>
            <summary style={{ 
              listStyle: 'none', 
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              padding: '8px 12px',
              borderRadius: '8px',
              transition: 'all 0.2s ease',
              background: 'rgba(255, 255, 255, 0.9)',
              backdropFilter: 'blur(10px)',
              border: '1px solid rgba(226, 232, 240, 0.8)'
            }}
            onMouseOver={(e) => {
              e.target.style.background = 'rgba(255, 255, 255, 1)';
              e.target.style.transform = 'translateY(-1px)';
              e.target.style.boxShadow = '0 4px 12px rgba(0, 0, 0, 0.08)';
            }}
            onMouseOut={(e) => {
              e.target.style.background = 'rgba(255, 255, 255, 0.9)';
              e.target.style.transform = 'translateY(0)';
              e.target.style.boxShadow = 'none';
            }}
            >
              <span style={{ 
                width: 32, 
                height: 32, 
                borderRadius: '50%', 
                background: 'linear-gradient(135deg, #e2e8f0 0%, #cbd5e1 100%)',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '14px',
                color: '#475569'
              }}>
                {(user?.name || user?.email || 'U')[0].toUpperCase()}
              </span>
              <span style={{ fontWeight: 500, color: '#0f172a' }}>{user?.name || user?.email}</span>
            </summary>
            <div style={{ 
              position: 'absolute', 
              right: 0, 
              top: '110%', 
              background: 'rgba(255, 255, 255, 0.95)',
              backdropFilter: 'blur(20px)',
              border: '1px solid rgba(226, 232, 240, 0.8)', 
              borderRadius: '12px', 
              minWidth: 220, 
              boxShadow: '0 8px 32px rgba(0, 0, 0, 0.12)',
              overflow: 'hidden',
              zIndex: 10001
            }}>
              <button 
                onClick={() => navigate('/profile')} 
                style={{ 
                  width: '100%', 
                  textAlign: 'left', 
                  padding: '12px 16px', 
                  border: 'none', 
                  background: 'transparent',
                  cursor: 'pointer',
                  transition: 'background 0.2s ease',
                  fontSize: '14px',
                  color: '#374151',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10
                }}
                onMouseOver={(e) => e.target.style.background = 'rgba(0, 0, 0, 0.04)'}
                onMouseOut={(e) => e.target.style.background = 'transparent'}
              >
                <span>👤</span> <span>View Profile</span>
              </button>
              <button 
                onClick={() => navigate('/settings')} 
                style={{ 
                  width: '100%', 
                  textAlign: 'left', 
                  padding: '12px 16px', 
                  border: 'none', 
                  background: 'transparent',
                  cursor: 'pointer',
                  transition: 'background 0.2s ease',
                  fontSize: '14px',
                  color: '#374151',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10
                }}
                onMouseOver={(e) => e.target.style.background = 'rgba(0, 0, 0, 0.04)'}
                onMouseOut={(e) => e.target.style.background = 'transparent'}
              >
                <span>⚙️</span> <span>Settings</span>
              </button>
              <Link 
                to="/welcome" 
                style={{ 
                  display: 'block', 
                  width: '100%', 
                  textAlign: 'left', 
                  padding: '12px 16px', 
                  textDecoration: 'none', 
                  color: '#374151',
                  transition: 'background 0.2s ease',
                  fontSize: '14px',
                  borderBottom: '1px solid rgba(226, 232, 240, 0.5)'
                }}
                onMouseOver={(e) => e.target.style.background = 'rgba(0, 0, 0, 0.04)'}
                onMouseOut={(e) => e.target.style.background = 'transparent'}
              >
                🎯 Getting Started
              </Link>
              <button 
                onClick={onSignOut} 
                style={{ 
                  width: '100%', 
                  textAlign: 'left', 
                  padding: '12px 16px', 
                  border: 'none', 
                  background: 'transparent', 
                  color: '#dc2626',
                  cursor: 'pointer',
                  transition: 'background 0.2s ease',
                  fontSize: '14px'
                }}
                onMouseOver={(e) => e.target.style.background = 'rgba(220, 38, 38, 0.08)'}
                onMouseOut={(e) => e.target.style.background = 'transparent'}
              >
                🚪 Sign Out
              </button>
            </div>
          </details>
        </div>
      </div>
    </header>
  );
}
