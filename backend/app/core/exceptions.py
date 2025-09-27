# -*- coding: utf-8 -*-
# 本文件用于定义全局异常处理器。全局异常处理器注册到 app 后，就能够被 ExceptionMiddleware 这个中间件调用。
# 完成两件事情：
#   1) 处理下游抛上来的四类异常，包装成统一响应传给上游。
#   2) 把异常信息记录日志（结构化日志；5xx 才打堆栈）。
#
# 统一响应壳（与全局规范保持一致）：
#   { "code": <业务码>, "message": <短标签>, "data": <负载或null>, "request_id": <uuid> }
#
# 重要边界：
#   - 字段级错误只走 422（RequestValidationError），并把字段列表放 data.errors 里；
#   - 3xx（含 304）不包壳，遵循 HTTP 规范直接返回；
#   - HTTPException.detail 只有是“安全字符串”才直用；结构化 detail 放 data.detail；敏感细节不直出。
#
# 业务层抛 BizError(http_status, code, message[, data]) 时，按给定值直接返回（不查表）。
# 框架/协议层 HTTPException(status_code=...) 时，按 “HTTP→默认业务码” 兜底映射。
#
# 参考文档：响应与异常（码表/规则/示例）。
from __future__ import annotations

import logging
from typing import Any, Optional

from fastapi import FastAPI, Request, HTTPException
from fastapi.exceptions import RequestValidationError
from starlette.responses import JSONResponse

# 复用已有的响应壳
from schemas.api_response import ok, fail

# 码表与映射（单一事实源）
from core.codes import BizCode, CODE_META, default_biz_for_http, label_for, CODE_TO_HTTP_HINT

logger = logging.getLogger(__name__)


# ---------------------------- 自定义业务异常 -----------------------------------
class BizError(Exception):
    """
    业务异常：统一携带 http_status + biz_code + message (+ data)
    例：raise BizError(409, BizCode.EMAIL_EXISTS, "email_exists")
    说明：message 建议用“稳定短标签”；若未提供，将按码表默认标签填充。
    """
    def __init__(self, http_status: int, code: int | BizCode, message: Optional[str] = None,
                 data: Optional[Any] = None, headers: dict[str, str] | None = None):
        self.http_status = int(http_status)
        self.code = int(code)
        self.message = message or label_for(self.code)
        self.data = data
        self.headers = headers  # NEW
        super().__init__(self.message)


# ------------------------ request_id 提取 ------------------------
def _rid(request: Request | None) -> Optional[str]:
    return getattr(getattr(request, "state", None), "request_id", None) if request else None


# ------------------------ 结构化错误日志 ------------------------
# level: 日志级别     request: 当前请求对象（携带信息）
# http_status: HTTP 状态码  code：业务码，比如 1001、2001、9001
# error_message: 错误短标签，比如 "email_exists"
# error_extra: dict | None = None,    # 可选：额外携带的错误信息，如字段校验错误
# exc: BaseException | None = None    # 可选：异常对象（用于记录堆栈；仅 5xx 打）
def _log_error(level: str, request: Request, http_status: int, code: int, error_message: str,
               error_extra: dict | None = None, exc: BaseException | None = None):
    payload = {
        "event": "api_error",
        "request_id": _rid(request),
        "path": str(request.url.path),
        "method": request.method,
        "http_status": http_status,
        "code": code,
        "error_message": error_message,
        **(error_extra or {}),  # ** 是字典解包运算
    }
    if level == "warning":
        logger.warning("", extra={"extra": payload})
    elif level == "info":
        logger.info("", extra={"extra": payload})
    else:
        # 仅在 error 级别时带堆栈（exc_info 是三元组：(exc_type, exc_value, traceback_obj)）
        logger.error("", extra={"extra": payload}, exc_info=exc)


# -----------------------------------具体处理器--------------------------------------------

# 1) 业务层异常处理：
async def handle_biz_error(request: Request, exc: BizError) -> JSONResponse:
    # 仅做一致性“提示性”校验：如果 code 的典型 http_hint 与传入 http 不一致，打告警日志（不强改）
    try:
        hint = CODE_TO_HTTP_HINT.get(BizCode(exc.code))
        if hint and hint != exc.http_status:
            logger.warning("", extra={"extra": {
                "event": "api_error_code_http_mismatch",
                "request_id": _rid(request),
                "code": exc.code, "expected_http": hint, "given_http": exc.http_status
            }})
    except Exception:
        pass

    _log_error("warning", request, exc.http_status, exc.code, exc.message)
    return fail(http_status=exc.http_status, code=exc.code, message=exc.message, data=exc.data, request=request)


# 2) 协议层 HTTP 异常处理（HTTPException）
# 情形： raise HTTPException(status_code=404, detail="user not found", headers={"X": "..."})
async def handle_http_exception(request: Request, exc: HTTPException) -> JSONResponse:
    http_status = exc.status_code
    code = int(default_biz_for_http(http_status))

    # message 的选择：
    # - detail 是“安全字符串”时直接透出（调试友好）；
    # - 否则用码表默认 label；若 detail 为结构化（dict/list），则放入 data.detail。
    if isinstance(exc.detail, str) and exc.detail:
        message = exc.detail
        data = None
    else:
        message = label_for(code)
        data = {"detail": exc.detail} if exc.detail not in (None, "") else None

    # 405 可带 Allow 提示，429/503 可配合 Retry-After（响应头由上游中间件设置）
    if isinstance(getattr(exc, "headers", None), dict):
        allow = exc.headers.get("Allow")
        if allow:
            data = (data or {}) | {"allow": [m.strip() for m in allow.split(",")]}

    _log_error("warning", request, http_status, code, message)
    return fail(http_status=http_status, code=code, message=message, data=data, request=request)


# 3) 字段层参数校验错误异常处理（422）
async def handle_validation_error(request: Request, exc: RequestValidationError) -> JSONResponse:
    http_status = 422
    code = int(BizCode.VALIDATION_ERROR)
    message = label_for(code)
    # Pydantic/FastAPI 的标准字段错误结构；前端据此逐字段渲染
    data = {"errors": exc.errors()}
    _log_error("warning", request, http_status, code, message, error_extra={"errors": data["errors"]})
    return fail(http_status=http_status, code=code, message=message, data=data, request=request)


# 4) 其他异常处理（500 兜底）
async def handle_unhandled_exception(request: Request, exc: Exception) -> JSONResponse:
    http_status = 500
    code = int(BizCode.INTERNAL_ERROR)
    message = label_for(code)
    _log_error("error", request, http_status, code, message, exc=exc)
    return fail(http_status=http_status, code=code, message=message, request=request)


# 注册异常处理器的入口：
def setup_exception_handlers(app: FastAPI) -> None:
    # 把异常类型 --> 处理函数的映射登记到 app 上。
    # ExceptionMiddleware 捕获异常时，会按映射查找匹配处理器。
    app.add_exception_handler(BizError, handle_biz_error)
    app.add_exception_handler(RequestValidationError, handle_validation_error)
    app.add_exception_handler(HTTPException, handle_http_exception)
    app.add_exception_handler(Exception, handle_unhandled_exception)
