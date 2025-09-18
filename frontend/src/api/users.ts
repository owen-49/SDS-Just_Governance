import { apiFetch } from './http';

export interface User {
  user_id: string;
  email: string;
  name: string;
  avatar_url?: string | null;
  email_verified?: boolean;
}

// 获取当前用户信息
export async function getCurrentUser(): Promise<User> {
  return apiFetch<User>('/api/v1/auth/me');
}

// 获取用户详情
export async function getUserDetail(user_id: string): Promise<User> {
  return apiFetch<User>(`/api/v1/users/${user_id}`);
}

// 用户列表（分页）
export interface UserListResp {
  items: User[];
  page: number;
  size: number;
  total: number;
}
export async function getUserList(page = 1, size = 20): Promise<UserListResp> {
  return apiFetch<UserListResp>(`/api/v1/users?page=${page}&size=${size}`);
}
