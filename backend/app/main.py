import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.old_routes.assessment import router as assessment_router
from app.api.old_routes.chat import router as chat_router
from app.api.routes.auth import router as auth_router
from app.api.routes.learning import router as learning_router
from app.api.routes.onboarding import router as onboarding_router
from app.core.config.config import CORS_ORIGINS
from app.core.exceptions.exceptions import setup_exception_handlers
from app.core.logging.logging_config import setup_logging
from app.middleware.access_log import AccessLogMiddleware
from app.middleware.request_id import RequestIDMiddleware


@asynccontextmanager
async def lifespan(app: FastAPI):
    # ---- startup ----
    setup_logging(fmt="pretty")
    logging.getLogger(__name__).info("logging configured (lifespan)")
    try:
        yield
    finally:
        # ---- shutdown ----
        # 在此处做资源清理，如关闭会话、连接池等
        logging.getLogger(__name__).info("shutdown complete")


app = FastAPI(title="Just Governance API", version="0.1.0", lifespan=lifespan)

# middlewares
app.add_middleware(RequestIDMiddleware)
app.add_middleware(AccessLogMiddleware)
_cors_allow_origins = [origin for origin in CORS_ORIGINS if origin != "*"]
_cors_allow_origin_regex = None
_cors_allow_credentials = True

if "*" in CORS_ORIGINS and not _cors_allow_origins:
    # Allow all origins without credentials when wildcard is explicitly requested.
    _cors_allow_origin_regex = ".*"
    _cors_allow_credentials = False

app.add_middleware(
    CORSMiddleware,
    allow_origins=_cors_allow_origins,
    allow_origin_regex=_cors_allow_origin_regex,
    allow_credentials=_cors_allow_credentials,
    allow_methods=["*"],
    allow_headers=["*"],
)

setup_exception_handlers(app)

@app.get("/")
def root():
    return {
        "status": "ok",
        "service": "Just Governance API",
        "docs": "http://127.0.0.1:8000/docs",
        "redoc": "http://127.0.0.1:8000/redoc",
        "healthz": "http://127.0.0.1:8000/healthz",
    }

@app.get("/healthz")
def healthz():
    return {"status": "ok"}

# routers
app.include_router(chat_router, prefix="/ai")
app.include_router(assessment_router)
app.include_router(auth_router, prefix="/api/v1")
app.include_router(onboarding_router)
app.include_router(learning_router)
