import React, { useState, useEffect } from 'react';

export default function Settings({ user, onBack, onSignOut }) {
  const [settings, setSettings] = useState({
    emailNotifications: true,
    progressReminders: true,
    weeklyDigest: false,
    darkMode: false,
    language: 'en',
    timezone: 'UTC',
    privacy: {
      profileVisible: true,
      shareProgress: false,
    }
  });

  const [activeTab, setActiveTab] = useState('notifications');

  // Apply dark mode to body
  useEffect(() => {
    if (settings.darkMode) {
      document.body.classList.add('dark-mode');
    } else {
      document.body.classList.remove('dark-mode');
    }
  }, [settings.darkMode]);

  const handleToggle = (category, field) => {
    if (category) {
      setSettings(prev => ({
        ...prev,
        [category]: {
          ...prev[category],
          [field]: !prev[category][field]
        }
      }));
    } else {
      setSettings(prev => ({
        ...prev,
        [field]: !prev[field]
      }));
    }
  };

  const handleSelectChange = (field, value) => {
    setSettings(prev => ({ ...prev, [field]: value }));
  };

  const handleSaveSettings = () => {
    // TODO: 调用API保存设置
    console.log('Saving settings:', settings);
    alert('Settings saved successfully!');
  };

  const handleResetSettings = () => {
    if (window.confirm('Are you sure you want to reset all settings to defaults?')) {
      const defaultSettings = {
        emailNotifications: true,
        progressReminders: true,
        weeklyDigest: false,
        darkMode: false,
        language: 'en',
        timezone: 'UTC',
        privacy: {
          profileVisible: true,
          shareProgress: false,
        }
      };
      setSettings(defaultSettings);
      // Also clear from localStorage
      try {
        localStorage.removeItem('userSettings');
        alert('✅ Settings reset to defaults!');
      } catch (error) {
        console.error('Failed to reset settings:', error);
      }
    }
  };

  const tabs = [
    { key: 'notifications', label: 'Notifications', icon: '🔔' },
    { key: 'preferences', label: 'Preferences', icon: '⚙️' },
    { key: 'privacy', label: 'Privacy', icon: '🔒' },
    { key: 'account', label: 'Account', icon: '👤' },
  ];

  // Dark mode colors
  const isDark = settings.darkMode;
  const colors = {
    bg: isDark ? 'linear-gradient(135deg, #0f172a 0%, #1e293b 100%)' : 'linear-gradient(135deg, #f8fafc 0%, #e2e8f0 100%)',
    cardBg: isDark ? '#1e293b' : '#ffffff',
    text: isDark ? '#f1f5f9' : '#0f172a',
    textSecondary: isDark ? '#94a3b8' : '#64748b',
    border: isDark ? 'rgba(148, 163, 184, 0.2)' : 'rgba(226, 232, 240, 0.8)',
    hoverBg: isDark ? 'rgba(148, 163, 184, 0.1)' : 'rgba(100, 116, 139, 0.1)',
    itemBg: isDark ? '#334155' : '#f8fafc',
  };

  return (
    <div style={{ 
      minHeight: '100vh', 
      background: colors.bg,
      padding: 'clamp(20px, 5vw, 40px)',
      transition: 'background 0.3s ease'
    }}>
      <div style={{ 
        maxWidth: 900, 
        margin: '0 auto',
        display: 'flex',
        flexDirection: 'column',
        gap: 'clamp(16px, 3vw, 24px)'
      }}>
        {/* Header */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: 16
        }}>
          <div>
            <h1 style={{ 
              margin: 0, 
              fontSize: 'clamp(28px, 6vw, 36px)', 
              fontWeight: 700,
              color: colors.text,
              transition: 'color 0.3s ease'
            }}>
              Settings
            </h1>
            <p style={{ 
              margin: '8px 0 0', 
              color: colors.textSecondary,
              fontSize: 'clamp(14px, 2vw, 16px)',
              transition: 'color 0.3s ease'
            }}>
              Customize your learning experience
            </p>
          </div>
          {onBack && (
            <button
              onClick={onBack}
              style={{
                padding: '10px 20px',
                background: colors.hoverBg,
                border: `1px solid ${colors.border}`,
                borderRadius: 8,
                color: colors.text,
                cursor: 'pointer',
                fontSize: 14,
                fontWeight: 500,
                transition: 'all 0.2s ease'
              }}
            >
              ← Back
            </button>
          )}
        </div>

        {/* Tabs */}
        <div style={{
          background: colors.cardBg,
          borderRadius: 'clamp(16px, 3vw, 20px)',
          padding: 'clamp(12px, 2vw, 16px)',
          boxShadow: isDark 
            ? '0 4px 12px rgba(0, 0, 0, 0.3)'
            : '0 4px 12px rgba(15, 23, 42, 0.06)',
          overflowX: 'auto',
          WebkitOverflowScrolling: 'touch',
          transition: 'all 0.3s ease'
        }}>
          <div style={{ 
            display: 'flex', 
            gap: 'clamp(4px, 1vw, 8px)',
            minWidth: 'fit-content'
          }}>
            {tabs.map(tab => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                style={{
                  padding: 'clamp(10px, 2vw, 12px) clamp(14px, 3vw, 18px)',
                  background: activeTab === tab.key
                    ? 'linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)'
                    : 'transparent',
                  color: activeTab === tab.key 
                    ? '#ffffff' 
                    : colors.textSecondary,
                  border: 'none',
                  borderRadius: 10,
                  cursor: 'pointer',
                  fontSize: 'clamp(13px, 2vw, 14px)',
                  fontWeight: 600,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  transition: 'all 0.2s ease',
                  boxShadow: activeTab === tab.key ? '0 4px 12px rgba(37, 99, 235, 0.3)' : 'none',
                  whiteSpace: 'nowrap'
                }}
              >
                <span>{tab.icon}</span>
                <span>{tab.label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Content */}
        <div style={{
          background: colors.cardBg,
          borderRadius: 'clamp(16px, 3vw, 24px)',
          padding: 'clamp(24px, 5vw, 32px)',
          boxShadow: isDark
            ? '0 10px 40px rgba(0, 0, 0, 0.3)'
            : '0 10px 40px rgba(15, 23, 42, 0.1)',
          transition: 'all 0.3s ease'
        }}>
          {/* Notifications Tab */}
          {activeTab === 'notifications' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
              <h2 style={{ 
                margin: 0, 
                fontSize: 'clamp(20px, 4vw, 24px)',
                color: colors.text
              }}>
                Notification Preferences
              </h2>
              
              <ToggleOption
                label="Email Notifications"
                description="Receive updates about your learning progress via email"
                checked={settings.emailNotifications}
                onChange={() => handleToggle(null, 'emailNotifications')}
                isDark={isDark}
              />
              
              <ToggleOption
                label="Progress Reminders"
                description="Get reminded to continue your learning journey"
                checked={settings.progressReminders}
                onChange={() => handleToggle(null, 'progressReminders')}
                isDark={isDark}
              />
              
              <ToggleOption
                label="Weekly Digest"
                description="Receive a weekly summary of your progress"
                checked={settings.weeklyDigest}
                onChange={() => handleToggle(null, 'weeklyDigest')}
                isDark={isDark}
              />
            </div>
          )}

          {/* Preferences Tab */}
          {activeTab === 'preferences' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
              <h2 style={{ 
                margin: 0, 
                fontSize: 'clamp(20px, 4vw, 24px)',
                color: colors.text
              }}>
                General Preferences
              </h2>

              <ToggleOption
                label="Dark Mode 🌙"
                description="Switch to a darker color scheme"
                checked={settings.darkMode}
                onChange={() => handleToggle(null, 'darkMode')}
                isDark={isDark}
              />

              <SelectOption
                label="Language"
                description="Choose your preferred language"
                value={settings.language}
                options={[
                  { value: 'en', label: 'English' },
                  { value: 'zh', label: '中文' },
                  { value: 'es', label: 'Español' },
                  { value: 'fr', label: 'Français' },
                ]}
                onChange={(value) => handleSelectChange('language', value)}
                isDark={isDark}
              />

              <SelectOption
                label="Timezone"
                description="Set your local timezone for accurate scheduling"
                value={settings.timezone}
                options={[
                  { value: 'UTC', label: 'UTC (Coordinated Universal Time)' },
                  { value: 'America/New_York', label: 'EST (Eastern Time)' },
                  { value: 'America/Los_Angeles', label: 'PST (Pacific Time)' },
                  { value: 'Europe/London', label: 'GMT (London)' },
                  { value: 'Asia/Shanghai', label: 'CST (China Standard Time)' },
                ]}
                onChange={(value) => handleSelectChange('timezone', value)}
                isDark={isDark}
              />
            </div>
          )}

          {/* Privacy Tab */}
          {activeTab === 'privacy' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
              <h2 style={{ 
                margin: 0, 
                fontSize: 'clamp(20px, 4vw, 24px)',
                color: colors.text
              }}>
                Privacy & Data
              </h2>

              <ToggleOption
                label="Profile Visibility"
                description="Make your profile visible to other learners"
                checked={settings.privacy.profileVisible}
                onChange={() => handleToggle('privacy', 'profileVisible')}
                isDark={isDark}
              />

              <ToggleOption
                label="Share Learning Progress"
                description="Allow others to see your learning achievements"
                checked={settings.privacy.shareProgress}
                onChange={() => handleToggle('privacy', 'shareProgress')}
                isDark={isDark}
              />

              <div style={{
                marginTop: 16,
                padding: 'clamp(16px, 3vw, 20px)',
                background: isDark ? 'rgba(251, 191, 36, 0.1)' : '#fef3c7',
                borderRadius: 12,
                borderLeft: '4px solid #f59e0b'
              }}>
                <h4 style={{ 
                  margin: '0 0 8px', 
                  color: isDark ? '#fbbf24' : '#92400e',
                  fontSize: 'clamp(14px, 2vw, 16px)' 
                }}>
                  Data Privacy
                </h4>
                <p style={{ 
                  margin: 0, 
                  color: isDark ? '#fcd34d' : '#78350f',
                  fontSize: 'clamp(13px, 2vw, 14px)',
                  lineHeight: 1.6 
                }}>
                  We take your privacy seriously. You can request a copy of your data or permanent deletion at any time.
                </p>
              </div>
            </div>
          )}

          {/* Account Tab */}
          {activeTab === 'account' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
              <h2 style={{ 
                margin: 0, 
                fontSize: 'clamp(20px, 4vw, 24px)',
                color: colors.text
              }}>
                Account Management
              </h2>

              <div style={{
                padding: 'clamp(16px, 3vw, 20px)',
                background: colors.itemBg,
                borderRadius: 12,
                border: `1px solid ${colors.border}`
              }}>
                <div style={{ marginBottom: 12 }}>
                  <span style={{ 
                    fontSize: 'clamp(12px, 2vw, 13px)', 
                    color: colors.textSecondary,
                    textTransform: 'uppercase',
                    letterSpacing: '0.5px'
                  }}>
                    Account Email
                  </span>
                </div>
                <div style={{ 
                  fontSize: 'clamp(14px, 2vw, 16px)', 
                  color: colors.text,
                  fontWeight: 500 
                }}>
                  {user?.email || 'Not available'}
                </div>
              </div>

              <div style={{
                padding: 'clamp(16px, 3vw, 20px)',
                background: colors.itemBg,
                borderRadius: 12,
                border: `1px solid ${colors.border}`
              }}>
                <h4 style={{ 
                  margin: '0 0 12px', 
                  color: colors.text,
                  fontSize: 'clamp(14px, 2vw, 16px)',
                  fontWeight: 600
                }}>
                  Password
                </h4>
                <p style={{ 
                  margin: '0 0 16px', 
                  color: colors.textSecondary,
                  fontSize: 'clamp(13px, 2vw, 14px)' 
                }}>
                  Change your password to keep your account secure
                </p>
                <button
                  disabled
                  style={{
                    padding: '10px 20px',
                    background: colors.hoverBg,
                    color: colors.textSecondary,
                    border: `1px solid ${colors.border}`,
                    borderRadius: 8,
                    cursor: 'not-allowed',
                    fontSize: 'clamp(13px, 2vw, 14px)',
                    fontWeight: 500,
                    opacity: 0.6
                  }}
                >
                  Change Password (Coming soon)
                </button>
              </div>

              <div style={{
                marginTop: 16,
                padding: 'clamp(16px, 3vw, 20px)',
                background: isDark ? 'rgba(239, 68, 68, 0.1)' : '#fef2f2',
                borderRadius: 12,
                borderLeft: '4px solid #ef4444',
                textAlign: 'center'
              }}>
                <h4 style={{ 
                  margin: '0 0 8px', 
                  color: isDark ? '#f87171' : '#991b1b',
                  fontSize: 'clamp(14px, 2vw, 16px)' 
                }}>
                  Danger Zone
                </h4>
                <p style={{ 
                  margin: '0 0 16px', 
                  color: isDark ? '#fca5a5' : '#7f1d1d',
                  fontSize: 'clamp(13px, 2vw, 14px)',
                  lineHeight: 1.6 
                }}>
                  These actions are permanent and cannot be undone.
                </p>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, justifyContent: 'center' }}>
                  <button
                    style={{
                      padding: '10px 20px',
                      background: 'transparent',
                      color: '#dc2626',
                      border: '2px solid #dc2626',
                      borderRadius: 8,
                      cursor: 'pointer',
                      fontSize: 'clamp(13px, 2vw, 14px)',
                      fontWeight: 500,
                      transition: 'all 0.2s ease'
                    }}
                    onClick={() => {
                      if (window.confirm('Are you sure you want to delete all your learning data? This cannot be undone.')) {
                        alert('Data deletion feature coming soon!');
                      }
                    }}
                  >
                    Delete All Learning Data
                  </button>
                  <button
                    style={{
                      padding: '10px 20px',
                      background: '#dc2626',
                      color: 'white',
                      border: 'none',
                      borderRadius: 8,
                      cursor: 'pointer',
                      fontSize: 'clamp(13px, 2vw, 14px)',
                      fontWeight: 500,
                      transition: 'all 0.2s ease'
                    }}
                    onClick={() => {
                      if (window.confirm('Are you sure you want to delete your account? This action is permanent and cannot be undone.')) {
                        alert('Account deletion feature coming soon!');
                      }
                    }}
                  >
                    Delete Account
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Action Buttons */}
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: 12
        }}>
          <button
            onClick={handleResetSettings}
            style={{
              padding: '12px 24px',
              background: 'transparent',
              color: colors.textSecondary,
              border: `2px solid ${colors.border}`,
              borderRadius: 10,
              cursor: 'pointer',
              fontSize: 'clamp(14px, 2vw, 15px)',
              fontWeight: 500,
              transition: 'all 0.2s ease'
            }}
          >
            Reset to Defaults
          </button>
          <button
            onClick={handleSaveSettings}
            style={{
              padding: '12px 32px',
              background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
              color: 'white',
              border: 'none',
              borderRadius: 10,
              cursor: 'pointer',
              fontSize: 'clamp(14px, 2vw, 15px)',
              fontWeight: 600,
              boxShadow: '0 6px 16px rgba(16, 185, 129, 0.3)',
              transition: 'all 0.2s ease'
            }}
          >
            💾 Save Changes
          </button>
        </div>
      </div>
    </div>
  );
}

// Toggle Option Component
function ToggleOption({ label, description, checked, onChange, disabled = false, isDark = false }) {
  const colors = {
    bg: isDark ? '#334155' : '#f8fafc',
    text: isDark ? '#f1f5f9' : '#0f172a',
    textSecondary: isDark ? '#94a3b8' : '#64748b',
    border: isDark ? 'rgba(148, 163, 184, 0.2)' : '#e2e8f0',
  };

  return (
    <div style={{
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      padding: 'clamp(16px, 3vw, 20px)',
      background: colors.bg,
      borderRadius: 12,
      border: `1px solid ${colors.border}`,
      opacity: disabled ? 0.6 : 1,
      cursor: disabled ? 'not-allowed' : 'default',
      transition: 'all 0.3s ease'
    }}>
      <div style={{ flex: 1, marginRight: 16 }}>
        <h4 style={{ 
          margin: '0 0 4px', 
          fontSize: 'clamp(14px, 2vw, 16px)',
          color: colors.text,
          fontWeight: 600
        }}>
          {label}
        </h4>
        <p style={{ 
          margin: 0, 
          fontSize: 'clamp(12px, 2vw, 14px)',
          color: colors.textSecondary,
          lineHeight: 1.5 
        }}>
          {description}
        </p>
      </div>
      <label style={{ 
        position: 'relative', 
        display: 'inline-block', 
        width: 52, 
        height: 28,
        flexShrink: 0
      }}>
        <input
          type="checkbox"
          checked={checked}
          onChange={onChange}
          disabled={disabled}
          style={{ opacity: 0, width: 0, height: 0 }}
        />
        <span style={{
          position: 'absolute',
          cursor: disabled ? 'not-allowed' : 'pointer',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: checked ? '#10b981' : '#cbd5e1',
          transition: '0.3s',
          borderRadius: 28,
          boxShadow: checked ? '0 2px 8px rgba(16, 185, 129, 0.3)' : 'none'
        }}>
          <span style={{
            position: 'absolute',
            content: '""',
            height: 20,
            width: 20,
            left: checked ? 28 : 4,
            bottom: 4,
            background: 'white',
            transition: '0.3s',
            borderRadius: '50%',
            boxShadow: '0 2px 4px rgba(0, 0, 0, 0.2)'
          }} />
        </span>
      </label>
    </div>
  );
}

// Select Option Component
function SelectOption({ label, description, value, options, onChange, isDark = false }) {
  const colors = {
    bg: isDark ? '#334155' : '#f8fafc',
    text: isDark ? '#f1f5f9' : '#0f172a',
    textSecondary: isDark ? '#94a3b8' : '#64748b',
    border: isDark ? 'rgba(148, 163, 184, 0.2)' : '#e2e8f0',
    selectBg: isDark ? '#1e293b' : 'white',
  };

  return (
    <div style={{
      padding: 'clamp(16px, 3vw, 20px)',
      background: colors.bg,
      borderRadius: 12,
      border: `1px solid ${colors.border}`,
      transition: 'all 0.3s ease'
    }}>
      <h4 style={{ 
        margin: '0 0 4px', 
        fontSize: 'clamp(14px, 2vw, 16px)',
        color: colors.text,
        fontWeight: 600
      }}>
        {label}
      </h4>
      <p style={{ 
        margin: '0 0 12px', 
        fontSize: 'clamp(12px, 2vw, 14px)',
        color: colors.textSecondary,
        lineHeight: 1.5 
      }}>
        {description}
      </p>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        style={{
          width: '100%',
          padding: '10px 12px',
          border: `2px solid ${colors.border}`,
          borderRadius: 8,
          fontSize: 'clamp(14px, 2vw, 15px)',
          background: colors.selectBg,
          color: colors.text,
          cursor: 'pointer',
          outline: 'none',
          transition: 'border-color 0.2s ease',
          fontFamily: 'inherit'
        }}
        onFocus={(e) => e.target.style.borderColor = '#3b82f6'}
        onBlur={(e) => e.target.style.borderColor = colors.border}
      >
        {options.map(option => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </div>
  );
}
