// frontend/src/components/Admin/AdminLoadingState.jsx
/**
 * Admin Loading State Component
 * Displays loading indicators during data fetching
 */

import React from 'react';
import './AdminLoadingState.css';

export const AdminLoadingState = ({ isLoading, message = '加载中...' }) => {
  if (!isLoading) return null;

  return (
    <div className="admin-loading-overlay">
      <div className="admin-loading-spinner">
        <div className="spinner"></div>
        <p>{message}</p>
      </div>
    </div>
  );
};

export const AdminLoadingSkeleton = ({ count = 3 }) => (
  <div className="admin-loading-skeleton">
    {Array.from({ length: count }).map((_, i) => (
      <div key={i} className="skeleton-card">
        <div className="skeleton-header"></div>
        <div className="skeleton-content"></div>
      </div>
    ))}
  </div>
);
