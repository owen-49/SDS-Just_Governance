# backend/app/core/exceptions.py
from __future__ import annotations
import logging
from typing import Any, Optional
from fastapi import FastAPI, Request, HTTPException
from fastapi.exceptions import RequestValidationError
from starlette.responses import JSONResponse

# 复用已有的响应壳与业务码常量
from app.schemas.api_response import (
    ok, fail,
    CODE_OK,
    CODE_UNAUTHORIZED,
    CODE_FORBIDDEN,
    CODE_VALIDATION_ERROR,
    CODE_NOT_FOUND,
    CODE_CONFLICT,
    CODE_RATE_LIMITED,
    CODE_INTERNAL_ERROR,
)

logger = logging.getLogger(__name__)


# ─────────────────────────────
# 自定义业务异常（路由里直接 raise）
# ─────────────────────────────
class BizError(Exception):
    """
    业务异常：统一携带 http_status + biz_code + message (+ data)
    例：raise BizError(409, CODE_CONFLICT, "email already exists")
    """
    def __init__(self, http_status: int, code: int, message: str, data: Optional[Any] = None):
        self.http_status = http_status
        self.code = code
        self.message = message
        self.data = data
        super().__init__(message)

# ─────────────────────────────
# HTTP → 业务码 映射
# ─────────────────────────────
_HTTP_TO_BIZ = {
    401: CODE_UNAUTHORIZED, #  "未认证“
            # 客户端尚未提供有效凭证或已过期；常带 WWW-Authenticate。动作：引导登录/刷新令牌。

    403: CODE_FORBIDDEN,    # ”已认证但无权限“
             # 登录了，但没权限访问此资源/操作。动作：提示无权限/引导申请或切换账号。

    404: CODE_NOT_FOUND,    # ”资源不存在“或”不提供资源
             # 路由不存在或资源不存在（也可用于“不想暴露资源是否存在”）。动作：提示不存在/返回上一页。

    409: CODE_CONFLICT,
            #
    422: CODE_VALIDATION_ERROR, # 参数校验错误

    429: CODE_RATE_LIMITED,
            # 触发限流。若有 Retry-After（秒或日期），前端可据此倒计时/禁用按钮。动作：提示稍后再试。

    400: CODE_VALIDATION_ERROR,  # 常见为参数/语义错误
}

def _map_http_to_biz(http_status: int) -> int:
    if http_status in _HTTP_TO_BIZ:
        return _HTTP_TO_BIZ[http_status]
    if http_status >= 500:
        return CODE_INTERNAL_ERROR
    # 兜底：其它 4xx 默认按校验/请求错误处理
    if 400 <= http_status < 500:
        return CODE_VALIDATION_ERROR
    return CODE_INTERNAL_ERROR

def _rid(request: Request) -> Optional[str]:
    return getattr(getattr(request, "state", None), "request_id", None)


# level: 日志级别     request: 当前请求对象（携带信息）   http_status: HTTP状态码  code：业务码，比如 1001、2001、9001
# message: 错误信息，比如 "email already exists"
# extra: dict | None = None,    # 可选：额外携带的错误信息，如字段校验错误
# exc: BaseException | None = None  # 可选：异常对象（用于记录堆栈）
def _log_error(level: str, request: Request, http_status: int, code: int, message: str, extra: dict | None = None, exc: BaseException | None = None):
    payload = {
        "event": "api_error",
        "request_id": _rid(request),
        "path": str(request.url.path),
        "method": request.method,
        "http_status": http_status,
        "code": code,
        "message": message,
        **(extra or {}),
    }
    if level == "warning":
        logger.warning(payload)
    elif level == "info":
        logger.info(payload)
    else:
        # error 默认带堆栈（未知异常/500）
        logger.exception(payload if exc else str(payload))


# ─────────────────────────────
# 具体处理器
# ─────────────────────────────
async def handle_biz_error(request: Request, exc: BizError) -> JSONResponse:
    _log_error("warning", request, exc.http_status, exc.code, exc.message)
    return fail(http_status=exc.http_status, code=exc.code, message=exc.message, data=exc.data, request=request)



    # 情形： raise HTTPException(status_code=404, detail="user not found")
async def handle_http_exception(request: Request, exc: HTTPException) -> JSONResponse:
    http_status = exc.status_code       # status_code是在抛异常的时候设置的，因为HTTPException规定必须传status_code
    #   根据status_code状态码得到业务错误code
    code = _map_http_to_biz(http_status)
    #   exc.detail可以是任意类型（string,dict,list)，只有是字符串的时候才直接当作message透出。
    message = exc.detail if isinstance(exc.detail, str) else "http_error"
    #   输出日志：包括请求信息、http响应码，code响应码，错误信息message
    _log_error("warning", request, http_status, code, message)

    #
    return fail(http_status=http_status, code=code, message=message, request=request)


    # 参数校验错误
async def handle_validation_error(request: Request, exc: RequestValidationError) -> JSONResponse:
    http_status = 422
    code = CODE_VALIDATION_ERROR
    message = "validation_error"
    data = {"errors": exc.errors()}
    _log_error("warning", request, http_status, code, message, extra={"errors": data["errors"]})
    return fail(http_status=http_status, code=code, message=message, data=data, request=request)

async def handle_unhandled_exception(request: Request, exc: Exception) -> JSONResponse:
    http_status = 500
    code = CODE_INTERNAL_ERROR
    message = "internal_error"
    _log_error("error", request, http_status, code, message, exc=exc)
    return fail(http_status=http_status, code=code, message=message, request=request)


# ─────────────────────────────
# 对外注册入口
# ─────────────────────────────
def setup_exception_handlers(app: FastAPI) -> None:
    """
    在应用启动时调用一次，把全局异常接住并统一为规范响应。
    """
    app.add_exception_handler(BizError, handle_biz_error)
    app.add_exception_handler(RequestValidationError, handle_validation_error)
    app.add_exception_handler(HTTPException, handle_http_exception)
    app.add_exception_handler(Exception, handle_unhandled_exception)
