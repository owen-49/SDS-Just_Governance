# Just Governance Project

## Backend setup

1. Copy the sample environment file and adjust secrets as needed:
   ```bash
   cp backend/.env.example backend/.env
   ```
2. Start the PostgreSQL database (requires Docker):
   ```bash
   docker compose up -d postgres
   ```
3. Install Python dependencies (one-time setup):
   ```bash
   python -m venv .venv
   source .venv/bin/activate
   pip install -r backend/requirements/dev.txt
   ```
4. Apply the database migrations:
   ```bash
   cd backend
   alembic upgrade head
   ```
5. Launch the API:
   ```bash
   uvicorn app.main:app --reload --app-dir backend
   ```

The application expects a PostgreSQL database. Connection strings are read from
`backend/.env` via the `DATABASE_URL_SYNC` and `DATABASE_URL_ASYNC` variables.
