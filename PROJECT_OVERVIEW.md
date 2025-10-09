# Just Governance Platform Overview

## High-level architecture
- **Backend** – A FastAPI application that configures structured logging, request ID and access log middleware, flexible CORS rules, and mounts routers for AI assistance, assessments, authentication, onboarding, and learning content under a unified lifespan hook.【F:backend/app/main.py†L1-L76】
- **Frontend** – A React single-page application that guards routes with authentication, renders policy pages, and drives the learning experience after refreshing/bootstrapping the user session via REST APIs.【F:frontend/src/App.js†L1-L66】
- **Shared assets** – Domain models, prompts, and questionnaires are stored in the backend while the frontend ships demo data, global resources, and local storage mocks to support offline exploration.【F:backend/app/models/__init__.py†L1-L21】【F:backend/app/core/config/config.py†L1-L42】【F:frontend/src/services/localDb.js†L1-L200】

## Backend services
### Configuration and infrastructure
Environment variables are loaded from `backend/.env`, exposing OpenAI credentials, database URLs, and prompt/questionnaire locations so the app can run across environments with minimal changes. Default CORS origins cover local development ports to simplify SPA integration.【F:backend/app/core/config/config.py†L1-L42】

### Authentication and session management
The `/api/v1/auth` router handles the complete lifecycle: registering new accounts with hashed passwords, issuing access and rotating refresh tokens during login, persisting sessions, refreshing them with rotation safeguards, and clearing credentials on logout. Cookies are scoped with secure defaults to protect refresh tokens.【F:backend/app/api/routes/auth.py†L26-L200】

### Learning content APIs
REST endpoints expose curriculum metadata. Consumers can paginate boards, modules, and active topics, with consistent sorting and validation. Topic detail requests merge normalized metadata, progress summaries, and markdown bodies before returning an API response wrapper.【F:backend/app/api/routes/learning.py†L1-L200】

### Onboarding survey
A versioned onboarding questionnaire is embedded directly in the API layer, covering confidence, motivations, barriers, and learning interests. Submissions are deduplicated per user, scored, and persisted through repository helpers before the request commits.【F:backend/app/api/routes/onboarding.py†L13-L200】

### AI-assisted learning
Legacy AI endpoints provide topic explanations and free-form Q&A by templating prompts, calling OpenAI chat completions, and normalizing responses. Prompt templates are cached and validated so both structured (outline/checklist) and fallback plain-text replies are supported.【F:backend/app/api/old_routes/chat.py†L1-L43】【F:backend/app/services/old/gpt_call.py†L1-L95】

## Frontend application
### Routing and authentication flow
The React app bootstraps by attempting a refresh/me call pair when `REACT_APP_USE_AUTH_V1` is enabled. Authenticated users see the home dashboard and introductory questions, while unauthenticated visitors are redirected to the login form. Legal documents stay publicly accessible.【F:frontend/src/App.js†L12-L66】

### Home learning workspace
`Home.jsx` composes layout, markdown rendering, assessments, and AI chat widgets. It indexes curriculum structures, syncs per-topic chats and progress with a local store, and hydrates server data (detail, progress, content, visit tracking) via the learning API. Markdown summaries become key points while metadata drives status calculations for learners.【F:frontend/src/pages/Home.jsx†L1-L200】

### Client services
- `authApi` wraps REST calls for register/login/refresh/me/logout while caching the bearer token for subsequent requests.【F:frontend/src/services/auth.js†L1-L80】
- `dbApi` offers a localStorage-backed mock backend for demos, covering user accounts, verification tokens, navigation state, conversations, and quiz records.【F:frontend/src/services/localDb.js†L1-L200】
- `api.js` exposes helper functions for assessments and AI questions against the FastAPI endpoints.【F:frontend/src/services/api.js†L1-L57】

## Suggested next steps
- Connect the backend to a real database and migrate off the local mock store for production reliability.【F:frontend/src/services/localDb.js†L27-L200】
- Harden AI endpoints by moving them out of `old_routes` and aligning prompt management with the latest OpenAI SDK usage patterns.【F:backend/app/api/old_routes/chat.py†L1-L43】【F:backend/app/services/old/gpt_call.py†L1-L95】
- Expand documentation for running migrations and seeding boards/topics to help new contributors reproduce the learning catalogue.【F:backend/app/api/routes/learning.py†L69-L200】
