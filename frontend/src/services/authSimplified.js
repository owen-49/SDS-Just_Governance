import { request, setAccessToken, getAccessToken } from './http';

export const authService = {
  // 统一的认证方法
  async authenticate(action, data) {
    const endpoints = {
      login: '/api/v1/auth/login',
      register: '/api/v1/auth/register',
      refresh: '/api/v1/auth/refresh',
      me: '/api/v1/auth/me',
      logout: '/api/v1/auth/logout',
      verify: '/api/v1/auth/verify-email',
      resend: '/api/v1/auth/verify-email/resend'
    };

    const endpoint = endpoints[action];
    if (!endpoint) throw new Error(`Unknown action: ${action}`);

    const options = {
      method: action === 'me' ? 'GET' : 'POST',
      headers: { 'Content-Type': 'application/json' }
    };

    if (action === 'verify' && data?.token) {
      const response = await request(`${endpoint}?token=${encodeURIComponent(data.token)}`, {
        method: 'GET'
      });
      return response?.data ?? response;
    }

    if (data && action !== 'refresh' && action !== 'logout' && action !== 'me') {
      options.body = JSON.stringify(data);
    }

    const response = await request(endpoint, options);
    
    // 处理token
    if ((action === 'login' || action === 'refresh') && response?.data?.access_token) {
      setAccessToken(response.data.access_token);
    }
    
    if (action === 'logout') {
      setAccessToken(null);
    }

    return response?.data ?? response;
  },

  // 便捷方法
  login: (email, password) => authService.authenticate('login', { email, password }),
  register: (email, password, name) => authService.authenticate('register', { email, password, name }),
  refresh: () => authService.authenticate('refresh'),
  me: () => authService.authenticate('me'),
  logout: () => authService.authenticate('logout'),
  verifyEmail: (token) => authService.authenticate('verify', { token }),
  resendVerification: (email) => authService.authenticate('resend', { email }),

  // Token管理
  getToken: getAccessToken,
  setToken: setAccessToken
};
