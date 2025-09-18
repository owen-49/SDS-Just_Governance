# backend/app/core/config.py
# config.py:  read all environment variables from backend/.env
import os
from pathlib import Path
from dotenv import load_dotenv

# 1. 找到 backend/app/.env 并加载
APP_DIR = Path(__file__).resolve().parents[1]  # → backend/app/
ENV_FILE = APP_DIR / ".env"
if ENV_FILE.exists():
    load_dotenv(dotenv_path=ENV_FILE, override=False)

# 2. 读取各项配置
OPENAI_API_KEY = os.getenv("OPENAI_API_KEY")
OPENAI_MODEL = os.getenv("OPENAI_MODEL", "gpt-4o")   # 默认为gpt-4o
DATABASE_URL = os.getenv("DATABASE_URL")
ENV = os.getenv("ENV", "dev")  # 默认为dev
        # prompts 目录：可以从环境变量读，如果没有的话就是backend/prompts
BACKEND_DIR = APP_DIR.parent  # → backend/
PROMPT_PATH = Path(os.getenv("PROMPTS_DIR") or (BACKEND_DIR / "prompts" / "default.json")).resolve()
QUESTION_PATH = Path(os.getenv("QUESTION_DIR") or (BACKEND_DIR / "questionnaires" / "questionnaires.json")).resolve()

# def read_prompt(name: str) -> str:
#     # 例：read_prompt("questionnaire") 会读 backend/prompts/questionnaire.json
#     p = PROMPT_PATH / f"{name}.json"
#     return p.read_text(encoding="utf-8")


