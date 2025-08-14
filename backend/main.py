# backend/main.py
from fastapi import FastAPI
from api.chat import router as chat_router
from api.assessment import router as assessment_router

app = FastAPI(title="Just Governance API", version="0.1.0")

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
app.include_router(chat_router, prefix="/ai")
app.include_router(assessment_router)
