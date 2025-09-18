// 全局统一请求封装，自动处理 code/message、token、request_id、错误抛出
export async function apiFetch<T>(path: string, init: RequestInit = {}): Promise<T> {
  const res = await fetch(`${import.meta.env.VITE_API_BASE || 'http://localhost:8000'}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${localStorage.getItem("access_token") ?? ""}`,
      ...(init.headers || {})
    }
  });

  const payload = await res.json().catch(() => ({}));
  if (!res.ok || payload.code !== 0) {
    const msg = payload?.message || res.statusText;
    throw Object.assign(new Error(msg), { status: res.status, code: payload?.code, request_id: payload?.request_id });
  }
  return payload.data as T;
}
