# Onboarding Survey API

- Base: `http://127.0.0.1:8000`
- Version: `/api/v1`
- Auth: Bearer JWT in header `Authorization: Bearer <token>`
- Envelope: every response uses `{ code, message, data, request_id }`

## Schemas

- `AnswerItem`
  - `question_number` number
  - `question_key` string
  - `question_type` enum: `single_choice | multi_choice | text`
  - `value` any (string for single; string[] for multi)
  - `text` string|null (optional free text when option has text input)
- `SubmitPayload`
  - `answers` AnswerItem[] (min length 1)
- `SubmitResult`
  - `score` number
  - `level` enum: `new | developing | strong`

## Question Keys & Allowed Values

- Q1 `confidence_in_boards` single: `not_confident | somewhat_confident | very_confident`
- Q2 `familiar_terms` multi: `incorporated_bodies | companies | not_for_profits | community_orgs | social_enterprises`
- Q3 `interest_motivation` multi (max 2): `impact | get_board_role | learn_new_skills | understand_decisions | meet_and_network | further_career | other` (+optional `text`)
- Q4 `legal_familiarity` single: `not_familiar | somewhat_familiar | very_familiar`
- Q5 `governance_idea` single: `not_sure | rough_idea | clear_idea`
- Q6 `decision_experience` single: `never | few_times | often`
- Q7 `interest_areas` multi: `social_justice | sport | arts | health | housing | gender | womens_safety | environment | other` (+optional `text`)
- Q8 `financial_experience` single: `never | occasionally | often`
- Q9 `new_terms` multi: `constitution | director | nominee | conflict_of_interest | agenda | minutes | fiduciary_duties`
- Q10 `group_comfort` single: `very_comfortable | sometimes_comfortable | not_very_comfortable | not_sure`
- Q11 `learning_interest` multi (max 2): `what_boards_do | decision_process | legal_duties | join_board | board_types | setup_board | other` (+optional `text`)
- Q12 `training_barriers` multi: `confidence | time_commitments | internet_access | accessibility_needs | other | none` (+optional `text`)

Notes:
- Use these backend values (snake_case), not UI labels.
- Include `text` only when the selected option defines `has_text_input`.

## Endpoints

### GET `/api/v1/onboarding/survey`
- Auth: none
- Resp 200 data: the survey definition (version, title, questions with options)
- Example:
```
GET /api/v1/onboarding/survey
-> { "code":0, "message":"ok", "data": { "version":1, "title":"...", "questions":[ ... ] }, "request_id":"..." }
```

### POST `/api/v1/onboarding/survey/submit`
- Auth: required (Bearer)
- Body: `SubmitPayload`
- Resp 200 data: `{ "score": 7, "level": "developing" }`
- Errors:
  - 401 code=1001 unauthenticated
  - 409 code=4001 already_submitted (user has submitted)
  - 409 code=4001 user_not_found_or_inactive (invalid user FK)
  - 409 code=4001 duplicate_question_key (same key twice)
  - 422 code=2001 validation_error (schema mismatch)
  - 400 code=4001 integrity_error (other DB constraints)

Minimal body (good for first test):
```json
{
  "answers": [
    {"question_number":1,"question_key":"confidence_in_boards","question_type":"single_choice","value":"very_confident"},
    {"question_number":4,"question_key":"legal_familiarity","question_type":"single_choice","value":"somewhat_familiar"},
    {"question_number":5,"question_key":"governance_idea","question_type":"single_choice","value":"rough_idea"}
  ]
}
```

Full body (12 questions):
```json
{
  "answers": [
    {"question_number":1, "question_key":"confidence_in_boards", "question_type":"single_choice", "value":"very_confident"},
    {"question_number":2, "question_key":"familiar_terms", "question_type":"multi_choice", "value":["companies","not_for_profits","community_orgs"]},
    {"question_number":3, "question_key":"interest_motivation", "question_type":"multi_choice", "value":["impact","other"], "text":"I want to contribute to my community"},
    {"question_number":4, "question_key":"legal_familiarity", "question_type":"single_choice", "value":"somewhat_familiar"},
    {"question_number":5, "question_key":"governance_idea", "question_type":"single_choice", "value":"rough_idea"},
    {"question_number":6, "question_key":"decision_experience", "question_type":"single_choice", "value":"few_times"},
    {"question_number":7, "question_key":"interest_areas", "question_type":"multi_choice", "value":["environment","other"], "text":"Local community gardens"},
    {"question_number":8, "question_key":"financial_experience", "question_type":"single_choice", "value":"occasionally"},
    {"question_number":9, "question_key":"new_terms", "question_type":"multi_choice", "value":["fiduciary_duties","nominee"]},
    {"question_number":10, "question_key":"group_comfort", "question_type":"single_choice", "value":"sometimes_comfortable"},
    {"question_number":11, "question_key":"learning_interest", "question_type":"multi_choice", "value":["legal_duties","join_board"]},
    {"question_number":12, "question_key":"training_barriers", "question_type":"multi_choice", "value":["time_commitments","accessibility_needs","other"], "text":"Accessibility: limited evening time; Other: commute distance"}
  ]
}
```

### GET `/api/v1/onboarding/survey/result`
- Auth: required
- Resp 200 data:
```json
{ "submitted_at": "2025-10-17T14:37:16.377658+00:00", "score": 7, "level": "developing" }
```
- Errors:
  - 404 code=3001 not_found (user not yet submitted)
  - 401 code=1001 unauthenticated

## cURL Snippets

- Submit:
```
curl -X POST "http://127.0.0.1:8000/api/v1/onboarding/survey/submit" \
  -H "Authorization: Bearer <ACCESS_TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{ "answers": [ {"question_number":1, "question_key":"confidence_in_boards", "question_type":"single_choice", "value":"very_confident"} ] }'
```

- Result:
```
curl -H "Authorization: Bearer <ACCESS_TOKEN>" \
  "http://127.0.0.1:8000/api/v1/onboarding/survey/result"
```

## Frontend Tips

- Map envelope: `data = body.data`.
- Transform UI selections to backend values (snake_case) before submit.
- For multi-choice with `max_select`, enforce limit on the client (Q3/Q11 up to 2).
- Include `text` only when option requires additional input.

