// frontend/src/components/Admin/AdminNotification.jsx
/**
 * Admin Notification Component
 * Enhanced error and success notifications
 */

import React, { useEffect, useState } from 'react';
import './AdminNotification.css';

export const AdminNotification = ({ 
  type = 'success', 
  message, 
  duration = 3000,
  onClose 
}) => {
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    if (!message) {
      setVisible(false);
      return;
    }

    setVisible(true);
    const timer = setTimeout(() => {
      setVisible(false);
      onClose?.();
    }, duration);

    return () => clearTimeout(timer);
  }, [message, duration, onClose]);

  if (!visible || !message) return null;

  const icons = {
    success: '✅',
    error: '❌',
    warning: '⚠️',
    info: 'ℹ️',
  };

  return (
    <div className={`admin-notification admin-notification-${type}`}>
      <span className="notification-icon">{icons[type]}</span>
      <span className="notification-message">{message}</span>
      <button 
        className="notification-close" 
        onClick={() => setVisible(false)}
      >
        ✕
      </button>
    </div>
  );
};

export const AdminNotificationContainer = ({ notifications = [] }) => (
  <div className="admin-notification-container">
    {notifications.map((notif) => (
      <AdminNotification key={notif.id} {...notif} />
    ))}
  </div>
);
