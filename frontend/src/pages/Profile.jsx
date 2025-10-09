import React, { useState } from 'react';

export default function Profile({ user, onBack }) {
  const [isEditing, setIsEditing] = useState(false);
  const [formData, setFormData] = useState({
    name: user?.name || user?.email?.split('@')[0] || 'User',
    email: user?.email || '',
    bio: user?.bio || '',
    organization: user?.organization || '',
    role: user?.role || '',
    location: user?.location || '',
  });

  const handleChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleSave = () => {
    // TODO: 调用API保存用户信息
    console.log('Saving profile:', formData);
    setIsEditing(false);
    // 这里可以调用后端API更新用户信息
  };

  const handleCancel = () => {
    setFormData({
      name: user?.name || user?.email?.split('@')[0] || 'User',
      email: user?.email || '',
      bio: user?.bio || '',
      organization: user?.organization || '',
      role: user?.role || '',
      location: user?.location || '',
    });
    setIsEditing(false);
  };

  return (
    <div style={{ 
      minHeight: '100vh', 
      background: 'linear-gradient(135deg, #f8fafc 0%, #e2e8f0 100%)',
      padding: 'clamp(20px, 5vw, 40px)'
    }}>
      <div style={{ 
        maxWidth: 800, 
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
              background: 'linear-gradient(135deg, #0f172a 0%, #334155 100%)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              backgroundClip: 'text'
            }}>
              My Profile
            </h1>
            <p style={{ 
              margin: '8px 0 0', 
              color: '#64748b',
              fontSize: 'clamp(14px, 2vw, 16px)' 
            }}>
              Manage your personal information and preferences
            </p>
          </div>
          {onBack && (
            <button
              onClick={onBack}
              style={{
                padding: '10px 20px',
                background: 'rgba(100, 116, 139, 0.1)',
                border: '1px solid rgba(100, 116, 139, 0.2)',
                borderRadius: 8,
                color: '#475569',
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

        {/* Profile Card */}
        <div style={{
          background: '#ffffff',
          borderRadius: 'clamp(16px, 3vw, 24px)',
          boxShadow: '0 10px 40px rgba(15, 23, 42, 0.1)',
          overflow: 'hidden'
        }}>
          {/* Avatar Section */}
          <div style={{
            background: 'linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)',
            padding: 'clamp(32px, 6vw, 48px)',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: 16
          }}>
            <div style={{
              width: 'clamp(80px, 15vw, 120px)',
              height: 'clamp(80px, 15vw, 120px)',
              borderRadius: '50%',
              background: '#ffffff',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 'clamp(32px, 7vw, 48px)',
              fontWeight: 700,
              color: '#2563eb',
              boxShadow: '0 8px 24px rgba(0, 0, 0, 0.15)'
            }}>
              {formData.name.charAt(0).toUpperCase()}
            </div>
            <div style={{ textAlign: 'center', color: '#ffffff' }}>
              <h2 style={{ 
                margin: 0, 
                fontSize: 'clamp(20px, 4vw, 28px)',
                fontWeight: 600 
              }}>
                {formData.name}
              </h2>
              <p style={{ 
                margin: '8px 0 0', 
                fontSize: 'clamp(13px, 2vw, 15px)',
                opacity: 0.9 
              }}>
                {formData.email}
              </p>
            </div>
          </div>

          {/* Profile Information */}
          <div style={{ padding: 'clamp(24px, 5vw, 32px)' }}>
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: 'clamp(20px, 4vw, 28px)'
            }}>
              <h3 style={{ 
                margin: 0, 
                fontSize: 'clamp(18px, 3vw, 22px)',
                color: '#0f172a' 
              }}>
                Personal Information
              </h3>
              {!isEditing ? (
                <button
                  onClick={() => setIsEditing(true)}
                  style={{
                    padding: '8px 16px',
                    background: 'linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)',
                    color: 'white',
                    border: 'none',
                    borderRadius: 8,
                    cursor: 'pointer',
                    fontSize: 14,
                    fontWeight: 500,
                    boxShadow: '0 4px 12px rgba(37, 99, 235, 0.3)',
                    transition: 'all 0.2s ease'
                  }}
                >
                  ✏️ Edit
                </button>
              ) : (
                <div style={{ display: 'flex', gap: 8 }}>
                  <button
                    onClick={handleCancel}
                    style={{
                      padding: '8px 16px',
                      background: 'transparent',
                      color: '#64748b',
                      border: '1px solid #e2e8f0',
                      borderRadius: 8,
                      cursor: 'pointer',
                      fontSize: 14,
                      fontWeight: 500,
                      transition: 'all 0.2s ease'
                    }}
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleSave}
                    style={{
                      padding: '8px 16px',
                      background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                      color: 'white',
                      border: 'none',
                      borderRadius: 8,
                      cursor: 'pointer',
                      fontSize: 14,
                      fontWeight: 500,
                      boxShadow: '0 4px 12px rgba(16, 185, 129, 0.3)',
                      transition: 'all 0.2s ease'
                    }}
                  >
                    💾 Save
                  </button>
                </div>
              )}
            </div>

            <div style={{
              display: 'grid',
              gap: 'clamp(16px, 3vw, 20px)'
            }}>
              {/* Name */}
              <div>
                <label style={{
                  display: 'block',
                  fontSize: 'clamp(12px, 2vw, 14px)',
                  fontWeight: 600,
                  color: '#475569',
                  marginBottom: 8,
                  textTransform: 'uppercase',
                  letterSpacing: '0.5px'
                }}>
                  Full Name
                </label>
                {isEditing ? (
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => handleChange('name', e.target.value)}
                    style={{
                      width: '100%',
                      padding: '12px 16px',
                      border: '2px solid #e2e8f0',
                      borderRadius: 10,
                      fontSize: 'clamp(14px, 2vw, 16px)',
                      outline: 'none',
                      transition: 'border-color 0.2s ease',
                      fontFamily: 'inherit',
                      boxSizing: 'border-box'
                    }}
                    onFocus={(e) => e.target.style.borderColor = '#3b82f6'}
                    onBlur={(e) => e.target.style.borderColor = '#e2e8f0'}
                  />
                ) : (
                  <p style={{
                    margin: 0,
                    padding: '12px 16px',
                    background: '#f8fafc',
                    borderRadius: 10,
                    color: '#0f172a',
                    fontSize: 'clamp(14px, 2vw, 16px)'
                  }}>
                    {formData.name || '—'}
                  </p>
                )}
              </div>

              {/* Email */}
              <div>
                <label style={{
                  display: 'block',
                  fontSize: 'clamp(12px, 2vw, 14px)',
                  fontWeight: 600,
                  color: '#475569',
                  marginBottom: 8,
                  textTransform: 'uppercase',
                  letterSpacing: '0.5px'
                }}>
                  Email Address
                </label>
                <p style={{
                  margin: 0,
                  padding: '12px 16px',
                  background: '#f8fafc',
                  borderRadius: 10,
                  color: '#64748b',
                  fontSize: 'clamp(14px, 2vw, 16px)',
                  fontStyle: 'italic'
                }}>
                  {formData.email} <span style={{ fontSize: 12 }}>(Cannot be changed)</span>
                </p>
              </div>

              {/* Organization */}
              <div>
                <label style={{
                  display: 'block',
                  fontSize: 'clamp(12px, 2vw, 14px)',
                  fontWeight: 600,
                  color: '#475569',
                  marginBottom: 8,
                  textTransform: 'uppercase',
                  letterSpacing: '0.5px'
                }}>
                  Organization
                </label>
                {isEditing ? (
                  <input
                    type="text"
                    value={formData.organization}
                    onChange={(e) => handleChange('organization', e.target.value)}
                    placeholder="Your company or institution"
                    style={{
                      width: '100%',
                      padding: '12px 16px',
                      border: '2px solid #e2e8f0',
                      borderRadius: 10,
                      fontSize: 'clamp(14px, 2vw, 16px)',
                      outline: 'none',
                      transition: 'border-color 0.2s ease',
                      fontFamily: 'inherit',
                      boxSizing: 'border-box'
                    }}
                    onFocus={(e) => e.target.style.borderColor = '#3b82f6'}
                    onBlur={(e) => e.target.style.borderColor = '#e2e8f0'}
                  />
                ) : (
                  <p style={{
                    margin: 0,
                    padding: '12px 16px',
                    background: '#f8fafc',
                    borderRadius: 10,
                    color: '#0f172a',
                    fontSize: 'clamp(14px, 2vw, 16px)'
                  }}>
                    {formData.organization || '—'}
                  </p>
                )}
              </div>

              {/* Role */}
              <div>
                <label style={{
                  display: 'block',
                  fontSize: 'clamp(12px, 2vw, 14px)',
                  fontWeight: 600,
                  color: '#475569',
                  marginBottom: 8,
                  textTransform: 'uppercase',
                  letterSpacing: '0.5px'
                }}>
                  Role/Position
                </label>
                {isEditing ? (
                  <input
                    type="text"
                    value={formData.role}
                    onChange={(e) => handleChange('role', e.target.value)}
                    placeholder="Your job title or role"
                    style={{
                      width: '100%',
                      padding: '12px 16px',
                      border: '2px solid #e2e8f0',
                      borderRadius: 10,
                      fontSize: 'clamp(14px, 2vw, 16px)',
                      outline: 'none',
                      transition: 'border-color 0.2s ease',
                      fontFamily: 'inherit',
                      boxSizing: 'border-box'
                    }}
                    onFocus={(e) => e.target.style.borderColor = '#3b82f6'}
                    onBlur={(e) => e.target.style.borderColor = '#e2e8f0'}
                  />
                ) : (
                  <p style={{
                    margin: 0,
                    padding: '12px 16px',
                    background: '#f8fafc',
                    borderRadius: 10,
                    color: '#0f172a',
                    fontSize: 'clamp(14px, 2vw, 16px)'
                  }}>
                    {formData.role || '—'}
                  </p>
                )}
              </div>

              {/* Location */}
              <div>
                <label style={{
                  display: 'block',
                  fontSize: 'clamp(12px, 2vw, 14px)',
                  fontWeight: 600,
                  color: '#475569',
                  marginBottom: 8,
                  textTransform: 'uppercase',
                  letterSpacing: '0.5px'
                }}>
                  Location
                </label>
                {isEditing ? (
                  <input
                    type="text"
                    value={formData.location}
                    onChange={(e) => handleChange('location', e.target.value)}
                    placeholder="City, Country"
                    style={{
                      width: '100%',
                      padding: '12px 16px',
                      border: '2px solid #e2e8f0',
                      borderRadius: 10,
                      fontSize: 'clamp(14px, 2vw, 16px)',
                      outline: 'none',
                      transition: 'border-color 0.2s ease',
                      fontFamily: 'inherit',
                      boxSizing: 'border-box'
                    }}
                    onFocus={(e) => e.target.style.borderColor = '#3b82f6'}
                    onBlur={(e) => e.target.style.borderColor = '#e2e8f0'}
                  />
                ) : (
                  <p style={{
                    margin: 0,
                    padding: '12px 16px',
                    background: '#f8fafc',
                    borderRadius: 10,
                    color: '#0f172a',
                    fontSize: 'clamp(14px, 2vw, 16px)'
                  }}>
                    {formData.location || '—'}
                  </p>
                )}
              </div>

              {/* Bio */}
              <div>
                <label style={{
                  display: 'block',
                  fontSize: 'clamp(12px, 2vw, 14px)',
                  fontWeight: 600,
                  color: '#475569',
                  marginBottom: 8,
                  textTransform: 'uppercase',
                  letterSpacing: '0.5px'
                }}>
                  Bio
                </label>
                {isEditing ? (
                  <textarea
                    value={formData.bio}
                    onChange={(e) => handleChange('bio', e.target.value)}
                    placeholder="Tell us about yourself..."
                    rows={4}
                    style={{
                      width: '100%',
                      padding: '12px 16px',
                      border: '2px solid #e2e8f0',
                      borderRadius: 10,
                      fontSize: 'clamp(14px, 2vw, 16px)',
                      outline: 'none',
                      transition: 'border-color 0.2s ease',
                      fontFamily: 'inherit',
                      resize: 'vertical',
                      boxSizing: 'border-box'
                    }}
                    onFocus={(e) => e.target.style.borderColor = '#3b82f6'}
                    onBlur={(e) => e.target.style.borderColor = '#e2e8f0'}
                  />
                ) : (
                  <p style={{
                    margin: 0,
                    padding: '12px 16px',
                    background: '#f8fafc',
                    borderRadius: 10,
                    color: '#0f172a',
                    fontSize: 'clamp(14px, 2vw, 16px)',
                    lineHeight: 1.6,
                    minHeight: 80
                  }}>
                    {formData.bio || '—'}
                  </p>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Learning Stats */}
        <div style={{
          background: '#ffffff',
          borderRadius: 'clamp(16px, 3vw, 24px)',
          padding: 'clamp(24px, 5vw, 32px)',
          boxShadow: '0 10px 40px rgba(15, 23, 42, 0.1)'
        }}>
          <h3 style={{ 
            margin: '0 0 20px', 
            fontSize: 'clamp(18px, 3vw, 22px)',
            color: '#0f172a' 
          }}>
            Learning Progress
          </h3>
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
            gap: 'clamp(12px, 2vw, 16px)'
          }}>
            <div style={{
              padding: 'clamp(16px, 3vw, 20px)',
              background: 'linear-gradient(135deg, #eff6ff 0%, #dbeafe 100%)',
              borderRadius: 12,
              textAlign: 'center'
            }}>
              <div style={{ fontSize: 'clamp(24px, 5vw, 32px)', fontWeight: 700, color: '#2563eb' }}>
                12
              </div>
              <div style={{ fontSize: 'clamp(12px, 2vw, 14px)', color: '#475569', marginTop: 4 }}>
                Topics Completed
              </div>
            </div>
            <div style={{
              padding: 'clamp(16px, 3vw, 20px)',
              background: 'linear-gradient(135deg, #ecfdf5 0%, #d1fae5 100%)',
              borderRadius: 12,
              textAlign: 'center'
            }}>
              <div style={{ fontSize: 'clamp(24px, 5vw, 32px)', fontWeight: 700, color: '#10b981' }}>
                85%
              </div>
              <div style={{ fontSize: 'clamp(12px, 2vw, 14px)', color: '#475569', marginTop: 4 }}>
                Avg Quiz Score
              </div>
            </div>
            <div style={{
              padding: 'clamp(16px, 3vw, 20px)',
              background: 'linear-gradient(135deg, #fef3c7 0%, #fde68a 100%)',
              borderRadius: 12,
              textAlign: 'center'
            }}>
              <div style={{ fontSize: 'clamp(24px, 5vw, 32px)', fontWeight: 700, color: '#f59e0b' }}>
                7
              </div>
              <div style={{ fontSize: 'clamp(12px, 2vw, 14px)', color: '#475569', marginTop: 4 }}>
                Days Streak
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
