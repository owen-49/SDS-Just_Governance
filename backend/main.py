from fastapi import FastAPI
from api.chat import router as chat_router

app = FastAPI(title="Just Governance API", version="0.1.0")

@app.get("/")
def root():
    return {"status": "ok", "message": "Just Governance API running"}


# AI 路由
app.include_router(chat_router, prefix="/ai")
