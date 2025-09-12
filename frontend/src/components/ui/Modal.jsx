import React from 'react';

export default function Modal({ open, onClose, children, width = 800 }) {
  if (!open) return null;
  return (
    <div 
      role="dialog" 
      aria-modal="true" 
      style={{ 
        position: 'fixed', 
        inset: 0, 
        background: 'rgba(0, 0, 0, 0.6)',
        backdropFilter: 'blur(8px)',
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'center', 
        zIndex: 50,
        animation: 'modalFadeIn 0.3s ease-out'
      }} 
      onClick={onClose}
    >
      <div 
        style={{ 
          width, 
          maxWidth: '95vw', 
          maxHeight: '90vh', 
          overflow: 'auto', 
          background: 'rgba(255, 255, 255, 0.98)',
          backdropFilter: 'blur(20px)',
          borderRadius: '16px', 
          boxShadow: '0 20px 60px rgba(0, 0, 0, 0.25), 0 0 0 1px rgba(255, 255, 255, 0.1)',
          position: 'relative',
          border: '1px solid rgba(255, 255, 255, 0.2)',
          animation: 'modalSlideIn 0.4s ease-out'
        }} 
        onClick={e => e.stopPropagation()}
      >
        <button 
          aria-label="Close" 
          onClick={onClose} 
          style={{ 
            position: 'absolute', 
            top: 16, 
            right: 16, 
            width: 40, 
            height: 40, 
            borderRadius: '12px', 
            border: '1px solid rgba(226, 232, 240, 0.8)', 
            background: 'rgba(255, 255, 255, 0.9)',
            backdropFilter: 'blur(10px)',
            cursor: 'pointer',
            fontSize: '20px',
            fontWeight: '300',
            color: '#64748b',
            transition: 'all 0.2s ease',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}
          onMouseOver={(e) => {
            e.target.style.background = 'rgba(255, 255, 255, 1)';
            e.target.style.transform = 'scale(1.05)';
            e.target.style.color = '#374151';
          }}
          onMouseOut={(e) => {
            e.target.style.background = 'rgba(255, 255, 255, 0.9)';
            e.target.style.transform = 'scale(1)';
            e.target.style.color = '#64748b';
          }}
        >
          ✕
        </button>
        {children}
      </div>
    </div>
  );
}
