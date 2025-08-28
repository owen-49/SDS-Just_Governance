import React from 'react';

export default function Header({ onToggleSidebar, onStartAssessment, onOpenOverview, onProfile, onSignOut, user }) {
  return (
    <header style={{
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      padding: '10px 16px', background: '#fff', borderBottom: '1px solid #eee'
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <button onClick={onToggleSidebar} aria-label="Toggle navigation" style={{ padding: '8px 10px' }}>☰</button>
        <div onClick={() => window.dispatchEvent(new CustomEvent('jg:goHome'))} style={{ cursor: 'pointer', fontWeight: 700 }}>
          Just Governance
        </div>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <button onClick={onStartAssessment} style={{ background: '#2563eb', color: '#fff', border: 'none', padding: '8px 12px', borderRadius: 6 }}>Start your governance journey</button>
        <button onClick={onOpenOverview} title="Project Overview" style={{ padding: '8px 12px', borderRadius: 6, border: '1px solid #ddd', background: '#fff' }}>ℹ️ Project Overview</button>
        <button title="Notifications" style={{ padding: '8px 12px', borderRadius: 6, border: '1px solid #ddd', background: '#fff' }}>🔔</button>
        <div style={{ position: 'relative' }}>
          <details>
            <summary style={{ listStyle: 'none', cursor: 'pointer' }}>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                <span style={{ width: 28, height: 28, borderRadius: '50%', background: '#ddd', display: 'inline-block' }} />
                <span>{user?.name || user?.email}</span>
              </span>
            </summary>
            <div style={{ position: 'absolute', right: 0, top: '110%', background: '#fff', border: '1px solid #eee', borderRadius: 8, minWidth: 200, boxShadow: '0 6px 24px rgba(0,0,0,0.08)' }}>
              <button onClick={onProfile} style={{ width: '100%', textAlign: 'left', padding: 10, border: 'none', background: 'transparent' }}>Profile & Settings</button>
              <button onClick={onSignOut} style={{ width: '100%', textAlign: 'left', padding: 10, border: 'none', background: 'transparent', color: '#b91c1c' }}>Sign Out</button>
            </div>
          </details>
        </div>
      </div>
    </header>
  );
}
