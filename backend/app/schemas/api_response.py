# backend/app/schemas/api_response.py
from typing import Any, Optional
from pydantic import BaseModel
from fastapi import Request
from fastapi.responses import JSONResponse

# 业务码：先放最小集，后续再扩展即可
CODE_OK = 0
CODE_UNAUTHORIZED = 1001        # 未授权
CODE_FORBIDDEN = 1002           # 禁止访问
CODE_VALIDATION_ERROR = 2001    # 参数校验失败
CODE_NOT_FOUND = 3001       # 资源未找到
CODE_CONFLICT = 4001        # 冲突
CODE_RATE_LIMITED = 8001        # 速率限制
CODE_INTERNAL_ERROR = 9001      # 服务器内部错误


class ApiResponse(BaseModel):
    code: int = CODE_OK     # 业务码
    message: str = "ok"     # 信息
    data: Optional[Any] = None      # 数据
    request_id: Optional[str] = None        # request_id


def _get_rid(request: Request | None) -> Optional[str]:
    return getattr(getattr(request, "state", None), "request_id", None) if request else None

def ok(
    data: Any = None,
    message: str = "ok",
    request: Request | None = None,
    status_code: int = 200,
) -> JSONResponse:
    """
    统一成功返回。status_code 按语义传（默认 200）。
    """
    payload = ApiResponse(code=CODE_OK, message=message, data=data, request_id=_get_rid(request)).model_dump()
    return JSONResponse(status_code=status_code, content=payload)

def fail(
    *,
    http_status: int,
    code: int,
    message: str,
    request: Request | None = None,
    data: Any = None,
) -> JSONResponse:
    """
    统一失败返回。http_status 是 HTTP 层；code 是业务码。
    """
    payload = ApiResponse(code=code, message=message, data=data, request_id=_get_rid(request)).model_dump()
    return JSONResponse(status_code=http_status, content=payload)
