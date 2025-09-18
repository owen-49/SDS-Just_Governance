import { apiFetch } from './http';

export interface SurveySubmitItem {
  key: string;
  value?: string;
  values?: string[];
  text?: string;
}

export interface SurveySubmitRequest {
  user_id: string;
  answers: SurveySubmitItem[];
}

export interface SurveySubmitResponse {
  survey_id: string;
}

// 提交问卷
export async function submitOnboardingSurvey(req: SurveySubmitRequest): Promise<SurveySubmitResponse> {
  return apiFetch<SurveySubmitResponse>('/api/v1/surveys/onboarding', {
    method: 'POST',
    body: JSON.stringify(req),
  });
}
