# backend/app/schemas/api_response.py
from typing import Any, Optional
from pydantic import BaseModel
from fastapi import Request
from fastapi.responses import JSONResponse

from app.core.exceptions.codes import BizCode


class ApiResponse(BaseModel):
    code: int = BizCode.OK     # 业务码
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
    headers: dict[str, str] | None = None,   # NEW: 可选响应头
) -> JSONResponse:
    """
    统一成功返回。status_code 按语义传（默认 200）。
    """
    payload = ApiResponse(code=BizCode.OK, message=message, data=data, request_id=_get_rid(request)).model_dump()
    return JSONResponse(status_code=status_code, content=payload, headers=headers)

def fail(
    *,
    http_status: int,
    code: int,
    message: str,
    request: Request | None = None,
    data: Any = None,
    headers: dict[str, str] | None = None,  # NEW: 可选响应头
) -> JSONResponse:
    """
    统一失败返回。http_status 是 HTTP 层；code 是业务码。
    """
    payload = ApiResponse(code=code, message=message, data=data, request_id=_get_rid(request)).model_dump()
    return JSONResponse(status_code=http_status, content=payload, headers=headers)
