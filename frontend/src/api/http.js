// 统一 API 请求封装
const API_BASE_URL = process.env.REACT_APP_API_BASE || 'http://localhost:8000';

export async function apiFetch(url, options = {}) {
  const defaultHeaders = {
    'Content-Type': 'application/json',
  };
  const opts = {
    credentials: 'include',
    ...options,
    headers: {
      ...defaultHeaders,
      ...(options.headers || {})
    }
  };
  const fullUrl = url.startsWith('http') ? url : `${API_BASE_URL}${url}`;
  const res = await fetch(fullUrl, opts);
  if (!res.ok) {
    let msg = '请求失败';
    try { msg = (await res.json()).message || msg; } catch {}
    throw new Error(msg);
  }
  try {
    return await res.json();
  } catch {
    return {};
  }
}
