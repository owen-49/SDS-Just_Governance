// Lightweight HTTP client with token memory, 401 refresh, 422 passthrough

const API_BASE = process.env.REACT_APP_API_BASE || "http://localhost:8000";

let accessToken = null;
let onUnauthorized = null;

// 友好的错误消息映射
const ERROR_MESSAGES = {
  network_error: 'Network connection failed. Please check your internet connection.',
  server_error: 'Server is temporarily unavailable. Please try again later.',
  unauthorized: 'Your session has expired. Please sign in again.',
  validation_error: 'Invalid request. Please check your input.',
  conflict: 'This action conflicts with existing data.',
  rate_limited: 'Too many requests. Please wait a moment.',
  not_found: 'The requested resource was not found.',
};

export function setAccessToken(token) {
  accessToken = token || null;
}

export function getAccessToken() {
  return accessToken;
}

export function setUnauthorizedHandler(handler) {
  onUnauthorized = typeof handler === 'function' ? handler : null;
}

async function parseBody(res) {
  const ct = res.headers.get('content-type') || '';
  if (ct.includes('application/json')) {
    try { return await res.json(); } catch { return null; }
  }
  try { return await res.text(); } catch { return null; }
}

function parseRetryAfter(res) {
  const ra = res.headers.get('Retry-After');
  if (!ra) return undefined;
  const n = Number(ra);
  return Number.isFinite(n) ? n : undefined;
}

async function doFetch(input, init = {}) {
  const url = input.startsWith('http') ? input : `${API_BASE}${input}`;
  const headers = new Headers(init.headers || {});
  if (!headers.has('Content-Type') && init.body && typeof init.body === 'string') {
    headers.set('Content-Type', 'application/json');
  }
  if (accessToken && !headers.has('Authorization')) {
    headers.set('Authorization', `Bearer ${accessToken}`);
  }
  const res = await fetch(url, { ...init, headers, credentials: 'include' });
  return res;
}

async function refreshTokenOnce() {
  try {
    const res = await doFetch('/api/v1/auth/refresh', { method: 'POST' });
    const body = await parseBody(res);
    if (!res.ok) return { ok: false, body, status: res.status };
    const token = body?.data?.access_token || body?.access_token;
    if (token) setAccessToken(token);
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e };
  }
}

export async function request(input, init = {}) {
  let res;
  
  try {
    res = await doFetch(input, init);
  } catch (e) {
    // 网络错误
    const err = new Error(ERROR_MESSAGES.network_error);
    err.type = 'network_error';
    err.originalError = e;
    throw err;
  }
  
  if (res.ok) return parseBody(res);

  const errorBody = await parseBody(res);
  const retryAfter = parseRetryAfter(res);

  if (res.status === 401) {
    const code = errorBody?.code;

    if (code === 1003) { // token_expired
      const r = await refreshTokenOnce();
      if (r.ok) {
        res = await doFetch(input, init);
        if (res.ok) return parseBody(res);
      }
      onUnauthorized?.();
    } else {
      onUnauthorized?.();
    }

    const err = new Error(ERROR_MESSAGES.unauthorized);
    err.status = 401;
    err.body = errorBody;
    err.retryAfter = retryAfter;
    throw err;
  }

  if (res.status === 404) {
    const err = new Error(errorBody?.message || ERROR_MESSAGES.not_found);
    err.status = 404;
    err.body = errorBody;
    throw err;
  }

  if (res.status === 422) {
    const err = new Error(errorBody?.message || ERROR_MESSAGES.validation_error);
    err.status = 422;
    err.body = errorBody;
    throw err;
  }

  if (res.status === 409) {
    const err = new Error(errorBody?.message || ERROR_MESSAGES.conflict);
    err.status = 409;
    err.body = errorBody;
    throw err;
  }

  if (res.status === 429) {
    const err = new Error(ERROR_MESSAGES.rate_limited);
    err.status = 429;
    err.body = errorBody;
    err.retryAfter = retryAfter;
    throw err;
  }

  if (res.status >= 500) {
    // 尝试从 body 中获取更详细的错误信息
    const detailMessage = errorBody?.detail || errorBody?.message;
    const err = new Error(detailMessage || ERROR_MESSAGES.server_error);
    err.status = res.status;
    err.body = errorBody;
    err.retryAfter = retryAfter;
    throw err;
  }

  const err = new Error(errorBody?.message || 'Request failed');
  err.status = res.status;
  err.body = errorBody;
  err.retryAfter = retryAfter;
  throw err;
}

export const http = {
  API_BASE,
  request,
  setAccessToken,
  getAccessToken,
  setUnauthorizedHandler,
};
