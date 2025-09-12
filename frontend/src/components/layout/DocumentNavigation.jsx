import React from 'react';
import { Link } from 'react-router-dom';

const DocumentNavigation = () => {
  return (
    <nav style={{
      background: '#fff',
      borderBottom: '1px solid #dee2e6',
      padding: '10px 20px',
      position: 'sticky',
      top: 0,
      zIndex: 100,
      boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
    }}>
      <div style={{
        maxWidth: '800px',
        margin: '0 auto',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between'
      }}>
        <Link 
          to="/"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            textDecoration: 'none',
            color: '#007bff',
            fontWeight: '600',
            fontSize: '14px'
          }}
        >
          ← Back to Home
        </Link>
        
        <div style={{ display: 'flex', gap: '15px', fontSize: '14px' }}>
          <Link 
            to="/welcome" 
            style={{ 
              textDecoration: 'none', 
              color: '#6c757d',
              padding: '5px 10px',
              borderRadius: '4px',
              transition: 'background-color 0.2s'
            }}
            onMouseOver={(e) => e.target.style.backgroundColor = '#f8f9fa'}
            onMouseOut={(e) => e.target.style.backgroundColor = 'transparent'}
          >
            Getting Started
          </Link>
          <Link 
            to="/terms" 
            style={{ 
              textDecoration: 'none', 
              color: '#6c757d',
              padding: '5px 10px',
              borderRadius: '4px',
              transition: 'background-color 0.2s'
            }}
            onMouseOver={(e) => e.target.style.backgroundColor = '#f8f9fa'}
            onMouseOut={(e) => e.target.style.backgroundColor = 'transparent'}
          >
            Terms of Service
          </Link>
          <Link 
            to="/privacy" 
            style={{ 
              textDecoration: 'none', 
              color: '#6c757d',
              padding: '5px 10px',
              borderRadius: '4px',
              transition: 'background-color 0.2s'
            }}
            onMouseOver={(e) => e.target.style.backgroundColor = '#f8f9fa'}
            onMouseOut={(e) => e.target.style.backgroundColor = 'transparent'}
          >
            Privacy Policy
          </Link>
        </div>
      </div>
    </nav>
  );
};

export default DocumentNavigation;
