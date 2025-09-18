import { apiFetch } from './http';

export interface AssessmentSubmitRequest {
  module_id: string;
  answers: any[];
}

export interface AssessmentSubmitResponse {
  score: number;
  breakdown?: any;
  advice?: string;
}

export async function submitAssessment(req: AssessmentSubmitRequest): Promise<AssessmentSubmitResponse> {
  return apiFetch<AssessmentSubmitResponse>('/api/v1/assessment/submit', {
    method: 'POST',
    body: JSON.stringify(req),
  });
}

export async function getAssessment(module_id: string) {
  return apiFetch(`/api/v1/assessment/${module_id}`);
}
