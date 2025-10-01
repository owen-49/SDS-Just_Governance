# backend/app/core/middleware/request_id.py
from uuid import uuid4
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.types import ASGIApp
from starlette.requests import Request

HEADER_NAME = "X-Request-Id"

class RequestIDMiddleware(BaseHTTPMiddleware):
    """
    统一生成/透传 request_id：
    - 读取请求头 X-Request-Id（有则透传，无则生成）
    - 写入 request.state.request_id 供业务/日志使用
    - 写回响应头 X-Request-Id
    """
    def __init__(self, app: ASGIApp):
        super().__init__(app)

    async def dispatch(self, request: Request, call_next):
        rid = request.headers.get(HEADER_NAME) or str(uuid4())
        request.state.request_id = rid
        response = await call_next(request)
        response.headers[HEADER_NAME] = rid
        return response
