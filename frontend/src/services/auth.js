import { request, setAccessToken, getAccessToken } from './http';

// Map backend unified response to plain values
function okData(body) {
  return body?.data ?? body;
}

export const authApi = {
  // POST /api/v1/auth/register
  async register({ email, password, name }) {
    const body = await request('/api/v1/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password, name })
    });
    return okData(body);
  },

  // POST /api/v1/auth/verify-email/resend
  async resendVerify({ email }) {
    const body = await request('/api/v1/auth/verify-email/resend', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email })
    });
    return okData(body);
  },

  // GET /api/v1/auth/verify-email?token=...
  async verifyByToken(token) {
    const body = await request(`/api/v1/auth/verify-email?token=${encodeURIComponent(token)}`, {
      method: 'GET'
    });
    return okData(body);
  },

  // POST /api/v1/auth/login
  async login({ email, password }) {
    const body = await request('/api/v1/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password })
    });
    const at = body?.data?.access_token || body?.access_token;
    if (at) setAccessToken(at);
    const showIntro = body?.data?.show_intro ?? false;
    return { access_token: at, show_intro: showIntro };
  },

  // POST /api/v1/auth/refresh (auto-called by http on 401/1003)
  async refresh() {
    const body = await request('/api/v1/auth/refresh', { method: 'POST' });
    const at = body?.data?.access_token || body?.access_token;
    if (at) setAccessToken(at);
    return at;
  },

  // GET /api/v1/auth/me
  async me() {
    const body = await request('/api/v1/auth/me', { method: 'GET' });
    return okData(body);
  },

  // POST /api/v1/auth/logout
  async logout() {
    try {
      await request('/api/v1/auth/logout', { method: 'POST' });
    } catch { /* ignore network errors for logout */ }
    setAccessToken(null);
  }
};

export function getAuthHeader() {
  const at = getAccessToken();
  return at ? { Authorization: `Bearer ${at}` } : {};
}
