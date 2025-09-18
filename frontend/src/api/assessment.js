import { apiFetch } from './http';

export async function submitAssessment(req) {
  return apiFetch('/api/v1/assessment/submit', {
    method: 'POST',
    body: JSON.stringify(req),
  });
}

export async function getAssessment(module_id) {
  return apiFetch(`/api/v1/assessment/${module_id}`);
}
