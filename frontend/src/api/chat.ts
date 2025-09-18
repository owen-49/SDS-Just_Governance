import { apiFetch } from './http';

export interface ChatAskRequest {
  question: string;
  level?: string;
}

export interface ChatAskResponse {
  answer: string;
}

export async function aiAsk(req: ChatAskRequest): Promise<ChatAskResponse> {
  return apiFetch<ChatAskResponse>('/api/ai/ask', {
    method: 'POST',
    body: JSON.stringify(req),
  });
}

export interface ExplainRequest {
  module_id: string;
  subtopic: string;
  known_points?: string[];
  level?: string;
}

export interface ExplainResponse {
  outline: string[];
  explanation: string;
  checklist: string[];
}

export async function aiExplain(req: ExplainRequest): Promise<ExplainResponse> {
  return apiFetch<ExplainResponse>('/api/ai/explain', {
    method: 'POST',
    body: JSON.stringify(req),
  });
}
