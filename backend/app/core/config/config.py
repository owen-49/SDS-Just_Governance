# backend/app/core/config.py
# config.py:  read all environment variables from backend/.env
import os
from pathlib import Path

from dotenv import load_dotenv

# 1. 先找到 backend/.env 读取.env文件内容到系统环境变量
BACKEND_DIR = Path(__file__).resolve().parents[3]  # → backend/
ENV_FILE = BACKEND_DIR / ".env"
if ENV_FILE.exists():
    load_dotenv(dotenv_path=ENV_FILE, override=False)


def _default_sqlite_url(async_mode: bool) -> str:
    """Return a local SQLite connection string when nothing is configured."""

    default_path = (BACKEND_DIR / "app.db").resolve()
    scheme = "sqlite+aiosqlite" if async_mode else "sqlite"
    return f"{scheme}:///{default_path}"  # absolute path ensures consistent location


def _normalise_db_url(value: str | None, *, async_mode: bool) -> str:
    """Fallback to SQLite when DATABASE_URL is not provided."""

    if value:
        return value
    return _default_sqlite_url(async_mode)


def _ensure_env(name: str, value: str) -> str:
    """Expose the effective configuration back to environment variables."""

    if not os.getenv(name):
        os.environ[name] = value
    return value


# 2. 读取各项配置
OPENAI_API_KEY = os.getenv("OPENAI_API_KEY")
OPENAI_MODEL = os.getenv("OPENAI_MODEL", "gpt-4o")   # 默认为gpt-4o
DATABASE_URL_ASYNC = os.getenv("DATABASE_URL_ASYNC")
DATABASE_URL_SYNC = os.getenv("DATABASE_URL_SYNC")
DATABASE_URL_ASYNC = _ensure_env(
    "DATABASE_URL_ASYNC",
    _normalise_db_url(os.getenv("DATABASE_URL_ASYNC"), async_mode=True),
)
DATABASE_URL_SYNC = _ensure_env(
    "DATABASE_URL_SYNC",
    _normalise_db_url(os.getenv("DATABASE_URL_SYNC"), async_mode=False),
)
ENV = os.getenv("ENV", "dev")  # 默认为dev
        # prompts 目录：可以从环境变量读，如果没有的话就是backend/prompts
PROMPT_PATH = Path(os.getenv("PROMPTS_DIR") or (BACKEND_DIR / "static" / "prompts" / "default.json")).resolve()
QUESTION_PATH = Path(os.getenv("QUESTION_DIR") or (BACKEND_DIR / "static" / "questionnaires" / "questionnaires.json")).resolve()


def _split_env_list(value: str | None) -> list[str]:
    """Parse comma separated environment variables into a clean list."""

    if not value:
        return []
    return [item.strip() for item in value.split(",") if item.strip()]


DEFAULT_CORS_ORIGINS = [
    "http://localhost:3000",
    "http://127.0.0.1:3000",
    "http://0.0.0.0:3000",
    "http://localhost:5173",
    "http://127.0.0.1:5173",
    "http://0.0.0.0:5173",
]

CORS_ORIGINS = _split_env_list(os.getenv("CORS_ORIGINS")) or DEFAULT_CORS_ORIGINS

# def read_prompt(name: str) -> str:
#     # 例：read_prompt("questionnaire") 会读 backend/prompts/questionnaire.json
#     p = PROMPT_PATH / f"{name}.json"
#     return p.read_text(encoding="utf-8")


