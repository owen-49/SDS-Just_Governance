import { apiFetch } from './http';

export interface Board {
  board_id: string;
  name: string;
  description?: string;
  created_at: string;
}

export async function getBoardList(page = 1, size = 20) {
  return apiFetch<{ items: Board[]; page: number; size: number; total: number }>(`/api/v1/boards?page=${page}&size=${size}`);
}

export async function getBoardDetail(board_id: string) {
  return apiFetch<Board>(`/api/v1/boards/${board_id}`);
}

export async function createBoard(data: { name: string; description?: string }) {
  return apiFetch<Board>('/api/v1/boards', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}
