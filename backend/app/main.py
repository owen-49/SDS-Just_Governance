import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from api.old_routes.chat import router as chat_router
from api.old_routes.assessment import router as assessment_router
from core.exceptions.exceptions import setup_exception_handlers
from core.logging.logging_config import setup_logging
from middleware.access_log import AccessLogMiddleware
from middleware.request_id import RequestIDMiddleware

from api.routes.auth import router as auth_router  # 导入auth模块中的router对象


setup_logging(fmt = "pretty")                 # 先初始化日志

@asynccontextmanager
async def lifespan(app: FastAPI):
    setup_logging(fmt="pretty")   # 这里执行一次（在 uvicorn 完成自己的配置之后）
    logging.getLogger(__name__).info("logging configured (lifespan)")
    yield
app = FastAPI(title="Just Governance API", version="0.1.0")


# 中间件顺序：Request-ID → 访问日志
app.add_middleware(RequestIDMiddleware)
app.add_middleware(AccessLogMiddleware)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],  # 根据需要添加其他前端地址
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# 全局异常处理（兜底 + 统一响应）
setup_exception_handlers(app)

# ✅ 根路由：欢迎信息 + 文档入口
@app.get("/")
def root():
    return {
        "status": "ok",
        "service": "Just Governance API",
        "docs": "http://127.0.0.1:8000/docs",
        "redoc": "http://127.0.0.1:8000/redoc",
        "healthz": "http://127.0.0.1:8000/healthz"
    }

# 健康检查（可选）
@app.get("/healthz")
def healthz():
    return {"status": "ok"}

app.include_router(chat_router, prefix="/ai")
app.include_router(assessment_router)

app.include_router(auth_router,prefix="/api/v1")
