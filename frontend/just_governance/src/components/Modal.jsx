import React from 'react';

export default function Modal({ open, onClose, children, width = 800 }) {
  if (!open) return null;
  return (
    <div role="dialog" aria-modal="true" style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50 }} onClick={onClose}>
      <div style={{ width, maxWidth: '95vw', maxHeight: '90vh', overflow: 'auto', background: '#fff', borderRadius: 12, boxShadow: '0 10px 40px rgba(0,0,0,0.2)', position: 'relative' }} onClick={e => e.stopPropagation()}>
        <button aria-label="Close" onClick={onClose} style={{ position: 'absolute', top: 8, right: 8, width: 36, height: 36, borderRadius: 8, border: '1px solid #eee', background: '#fff' }}>×</button>
        {children}
      </div>
    </div>
  );
}
