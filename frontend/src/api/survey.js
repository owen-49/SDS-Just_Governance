import { apiFetch } from './http';

// 提交问卷
export async function submitOnboardingSurvey(req) {
  return apiFetch('/api/v1/surveys/onboarding', {
    method: 'POST',
    body: JSON.stringify(req),
  });
}
