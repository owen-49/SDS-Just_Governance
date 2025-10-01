// 简化的HTTP客户端
const API_BASE = process.env.REACT_APP_API_BASE || "http://localhost:8000";

let accessToken = null;
let onUnauthorized = null;

export const http = {
  setToken: (token) => { accessToken = token; },
  getToken: () => accessToken,
  setUnauthorizedHandler: (handler) => { onUnauthorized = handler; },

  async request(url, options = {}) {
    const fullUrl = url.startsWith('http') ? url : `${API_BASE}${url}`;
    const headers = new Headers(options.headers || {});
    
    // 自动设置headers
    if (!headers.has('Content-Type') && options.body && typeof options.body === 'string') {
      headers.set('Content-Type', 'application/json');
    }
    if (accessToken && !headers.has('Authorization')) {
      headers.set('Authorization', `Bearer ${accessToken}`);
    }

    const config = {
      ...options,
      headers,
      credentials: 'include'
    };

    try {
      let response = await fetch(fullUrl, config);
      
      // 处理401自动刷新
      if (response.status === 401 && !url.includes('/auth/refresh')) {
        const body = await response.json();
        if (body?.code === 1003) { // token_expired
          const refreshResult = await this.refreshToken();
          if (refreshResult.success) {
            // 重试原请求
            headers.set('Authorization', `Bearer ${accessToken}`);
            response = await fetch(fullUrl, { ...config, headers });
          } else {
            onUnauthorized?.();
            throw new Error('Token refresh failed');
          }
        } else {
          onUnauthorized?.();
          throw new Error('Authentication failed');
        }
      }

      const result = await response.json();
      
      if (!response.ok) {
        const error = new Error(result.message || 'Request failed');
        error.status = response.status;
        error.body = result;
        throw error;
      }

      return result;
    } catch (error) {
      if (!error.status) {
        error.status = 0; // Network error
      }
      throw error;
    }
  },

  async refreshToken() {
    try {
      const response = await fetch(`${API_BASE}/api/v1/auth/refresh`, {
        method: 'POST',
        credentials: 'include'
      });
      
      if (response.ok) {
        const data = await response.json();
        const token = data?.data?.access_token || data?.access_token;
        if (token) {
          this.setToken(token);
          return { success: true, token };
        }
      }
      return { success: false };
    } catch {
      return { success: false };
    }
  }
};

// 导出便捷函数
export const { request, setToken, getToken, setUnauthorizedHandler } = http;
export { http as default };
