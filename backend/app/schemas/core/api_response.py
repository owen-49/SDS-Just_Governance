<<<<<<< Updated upstream
# backend/app/schemas/api_response.py
from typing import Any, Optional
from pydantic import BaseModel
=======
from typing import Any, Optional, Generic, TypeVar

>>>>>>> Stashed changes
from fastapi import Request
from fastapi.encoders import jsonable_encoder
from fastapi.responses import JSONResponse
from pydantic import BaseModel

from app.core.exceptions.codes import BizCode

<<<<<<< Updated upstream

class ApiResponse(BaseModel):
    code: int = BizCode.OK     # 业务码
    message: str = "ok"     # 信息
    data: Optional[Any] = None      # 数据
    request_id: Optional[str] = None        # request_id
=======
T = TypeVar("T")


class ApiResponse(BaseModel, Generic[T]):
    """Unified envelope for API responses."""

    code: int = BizCode.OK
    message: str = "ok"
    data: Optional[T] = None
    request_id: Optional[str] = None
>>>>>>> Stashed changes


def _get_rid(request: Request | None) -> Optional[str]:
    if request and hasattr(request, "state"):
        return getattr(request.state, "request_id", None)
    return None


def ok(
    data: Any = None,
    message: str = "ok",
    request: Request | None = None,
    request_id: str | None = None,
    status_code: int = 200,
    headers: dict[str, str] | None = None,
) -> JSONResponse:
    """Return a successful JSON response."""
    rid = request_id if request_id is not None else _get_rid(request)
    payload = jsonable_encoder(
        ApiResponse(code=BizCode.OK, message=message, data=data, request_id=rid)
    )
    return JSONResponse(status_code=status_code, content=payload, headers=headers)


def fail(
    *,
    http_status: int = 400,
    code: int,
    message: str,
    request: Request | None = None,
    request_id: str | None = None,
    data: Any = None,
    headers: dict[str, str] | None = None,
) -> JSONResponse:
    """Return an error JSON response with business error code."""
    rid = request_id if request_id is not None else _get_rid(request)
    payload = jsonable_encoder(
        ApiResponse(code=code, message=message, data=data, request_id=rid)
    )
    return JSONResponse(status_code=http_status, content=payload, headers=headers)
