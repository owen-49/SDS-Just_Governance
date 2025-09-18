from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from api.chat import router as chat_router
from api.assessment import router as assessment_router
from api.auth import router as auth_router

app = FastAPI(title="Just Governance API", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],  # 根据需要添加其他前端地址
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

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

# AI 路由
app.include_router(auth_router, prefix="/api/v1/auth")
app.include_router(chat_router, prefix="/ai")
app.include_router(assessment_router)
