# backend/app/core/middleware/access_log.py
from __future__ import annotations
import logging, time
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.types import ASGIApp

_access_logger = logging.getLogger("app.access")

class AccessLogMiddleware(BaseHTTPMiddleware):
    """
    每次请求输出一条结构化访问日志。
    - 依赖 RequestIDMiddleware 提前写好的 request.state.request_id
    """
    def __init__(self, app: ASGIApp):
        super().__init__(app)

    async def dispatch(self, request: Request, call_next):
        start = time.perf_counter()
        rid = getattr(getattr(request, "state", None), "request_id", None)

        try:
            response = await call_next(request)
            return response
        finally:
            latency_ms = int((time.perf_counter() - start) * 1000)
            status = getattr(locals().get("response", None), "status_code", 0)

            # 结构化日志；不要把 Authorization 等敏感头写入日志
            _access_logger.info(
                "",
                extra={
                    "extra": {
                        "event": "access",
                        "request_id": rid,
                        "method": request.method,
                        "path": request.url.path,
                        "status": status,
                        "latency_ms": latency_ms,
                        "client_ip": request.client.host if request.client else None,
                        "user_agent": request.headers.get("user-agent"),
                    }
                },
            )
