# backend/app/deps/auth.py
from __future__ import annotations
from fastapi import Depends, HTTPException, Request
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.ext.asyncio import AsyncSession

from core.db import get_db
from core.security import decode_access_token
from core.exceptions import BizError
from core.codes import BizCode

# 用于提取 Authorization: Bearer <token> 的 Header
security = HTTPBearer(auto_error=False)

    # cred 是通过 HTTPBearer提取到的 access token结构体，内部包含 .credentials（存的是字符串形式的 token）。
async def get_current_user(request: Request, db: AsyncSession = Depends(get_db), cred: HTTPAuthorizationCredentials = Depends(security)):
    # 步骤一：检查Access Token是否存在
    if not cred or not cred.credentials:
        # 缺凭证 → 401 + 1001
        raise HTTPException(status_code=401, detail="unauthenticated", headers={"WWW-Authenticate": "Bearer"})

    # 步骤二：解码 JWT
    token = cred.credentials
    try:
        payload = decode_access_token(token)
    except Exception as e:
        # 区分过期/非法（ExpiredSignatureError/InvalidTokenError）
        name = e.__class__.__name__.lower()
        if "expired" in name:
            # 情况1：过期 → 401 + 1003
            raise BizError(401, BizCode.TOKEN_EXPIRED, "token_expired",
                           headers={"WWW-Authenticate": 'Bearer error="invalid_token", error_description="expired"'})
        else:
            # 情况2：非法 → 401 + 1004
            raise BizError(401, BizCode.TOKEN_INVALID, "token_invalid",
                           headers={"WWW-Authenticate": 'Bearer error="invalid_token"'})

    # 步骤三：如果JWT校验成功，从 payload 中提取用户 ID
    user_id = payload.get("sub")
    if not user_id:
        raise HTTPException(401, "unauthenticated", headers={"WWW-Authenticate": "Bearer"})

    # 步骤四：加载用户对象
    from repositories.users import get_user_by_id
    user = await get_user_by_id(db, user_id)
    if not user or not getattr(user, "is_active", True):    # 若用户不存在或已经账号已注销：仍然返回401 + 1001（未授权）
        raise HTTPException(401, "unauthenticated", headers={"WWW-Authenticate": "Bearer"})
    return user
