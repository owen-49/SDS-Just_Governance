// Lightweight HTTP client with token memory, 401 refresh, 422 passthrough

const API_BASE = process.env.REACT_APP_API_BASE || "http://localhost:8000";

let accessToken = null;
let onUnauthorized = null;

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
  let res = await doFetch(input, init);
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
      // 刷新失败，视作未授权
      onUnauthorized?.();
    } else if (code === 1004 || code === 1001) {
      // token_invalid 或 unauthenticated - 不尝试刷新，直接清理状态
      onUnauthorized?.();
    } else {
      // 其他401情况（未认证等）按未授权处理
      onUnauthorized?.();
    }

    const err = new Error('unauthorized');
    err.status = 401;
    err.body = errorBody;
    err.retryAfter = retryAfter;
    throw err;
  }

  if (res.status === 422) {
    const err = new Error('validation_error');
    err.status = 422;
    err.body = errorBody;
    throw err;
  }

  if (res.status === 409) {
    const err = new Error('conflict');
    err.status = 409;
    err.body = errorBody;
    throw err;
  }

  if (res.status === 429) {
    const err = new Error('rate_limited');
    err.status = 429;
    err.body = errorBody;
    err.retryAfter = retryAfter;
    throw err;
  }

  if (res.status >= 500 && res.status < 600) {
    const err = new Error('server_error');
    err.status = res.status;
    err.body = errorBody;
    err.retryAfter = retryAfter;
    throw err;
  }

  const err = new Error('http_error');
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
