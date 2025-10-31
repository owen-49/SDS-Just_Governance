# backend/app/core/middleware/access_log.py
    # 中间件：访问日志
    # 作用：让每个HTTP请求都能被记录，输出一条访问日志

from __future__ import annotations
import logging, time
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.types import ASGIApp

_access_logger = logging.getLogger("app.access")    # 新声明一个app.access日志器对象

class AccessLogMiddleware(BaseHTTPMiddleware):
    def __init__(self, app: ASGIApp):
        super().__init__(app)

    # 核心逻辑：
    async def dispatch(self, request: Request, call_next):
        # 用高精度时间戳记录开始时间：
        start = time.perf_counter()

        # 从请求对象request中获取request.state.request_id：
            # 说明：request_id 是上游中间件request_id注入的，用于串联整条请求链日志。
        rid = getattr(getattr(request, "state", None), "request_id", None)

        try:
            # 调用下游（即下一个中间件或视图函数，往里走）
            response = await call_next(request)
            # 得到下游的响应
            return response

        # 无论内层是否出现异常，本次请求都会记录日志：
        finally:
            # 计算本次请求响应总耗时
            latency_ms = int((time.perf_counter() - start) * 1000)

            # 如果response存在，取它的HTTP状态码。
            status = getattr(locals().get("response", None), "status_code", 0)

            # 写一条访问日志
            _access_logger.info(
                "",
                extra={
                    "extra": {
                        "event": "access",  # 事件： 访问
                        "request_id": rid,      # 请求id： 由之前的中间件注入
                        "method": request.method,   # 请求方法：GET/POST/PUT/DELETE
                        "path": request.url.path,   # 请求URL路径
                        "status": status,           # HTTP响应状态码
                        "latency_ms": latency_ms,       # 响应总耗时
                        "client_ip": request.client.host if request.client else None,      #
                        "user_agent": request.headers.get("user-agent"),    #
                    }
                },
            )




