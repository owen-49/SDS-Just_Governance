import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.old_routes.assessment import router as assessment_router
from app.api.old_routes.chat import router as chat_router
from app.api.routes.auth import router as auth_router
from app.api.routes.learning import router as learning_router
from app.api.routes.onboarding import router as onboarding_router
from app.core.exceptions.exceptions import setup_exception_handlers
from app.core.logging.logging_config import setup_logging
from app.middleware.access_log import AccessLogMiddleware
from app.middleware.request_id import RequestIDMiddleware

setup_logging(fmt="pretty")


@asynccontextmanager
def lifespan(app: FastAPI):
    setup_logging(fmt="pretty")
    logging.getLogger(__name__).info("logging configured (lifespan)")
    yield


app = FastAPI(title="Just Governance API", version="0.1.0", lifespan=lifespan)

app.add_middleware(RequestIDMiddleware)
app.add_middleware(AccessLogMiddleware)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=True,
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


app.include_router(chat_router, prefix="/ai")
app.include_router(assessment_router)
app.include_router(auth_router, prefix="/api/v1")
app.include_router(onboarding_router)
app.include_router(learning_router)
