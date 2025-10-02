# backend/app/api/routes/auth.py
from __future__ import annotations
import uuid
from datetime import datetime, timezone
from fastapi import APIRouter, Request, Response, Depends, Cookie, HTTPException, BackgroundTasks, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, update

from core.db.db import get_db
from core.tools.email_verify import gen_email_token_pair, build_verify_link, send_verification_email, EMAIL_TOKEN_TTL_HOURS, \
    hash_email_token
from repositories.auth.email_tokens import revoke_unusued_tokens_of_user, create_email_token, get_token_by_hash
from schemas.core.api_response import ok
from schemas.auth.auth import RegisterIn, LoginIn, TokenOut, ResendIn
from core.tools.security import (
    hash_password, verify_password, create_access_token,
    new_refresh_token_pair, hash_refresh_token, refresh_expiry_from_now
)
from core.exceptions.exceptions import BizError
from core.exceptions.exceptions import BizCode
from models import User
from models import UserSession
from deps.auth import get_current_user


router = APIRouter(prefix="/auth", tags=["auth"])

REFRESH_COOKIE_NAME = "refresh_token"

# 字典常量，用于统一设置刷新 token Cookie 的属性（安全性配置）
COOKIE_KW = dict(
    httponly=True, secure=True, samesite="lax", path="/", max_age=None  # max_age 由 expires 控制
)

# 作用：把 refresh token安全地设置到浏览器的 Cookie 中
def set_refresh_cookie(resp: Response, token_with_jti: str, expires: datetime):
    resp.set_cookie(REFRESH_COOKIE_NAME, token_with_jti, expires=expires, **COOKIE_KW)

def clear_refresh_cookie(resp: Response):
    resp.delete_cookie(REFRESH_COOKIE_NAME, path="/")


async def get_client_meta(request: Request):
    return request.headers.get("user-agent", ""), request.client.host if request.client else None

# 一、邮箱注册
@router.post("/register")
async def register(payload: RegisterIn, db: AsyncSession = Depends(get_db)):
    # 第一步：判断邮箱是否已经存在
    result = await db.execute(select(User).where(User.email == payload.email))
    existing = result.scalar_one_or_none()

    if existing:
        # 如果已存在账号：
        if existing.email_verified_at:
            # 情况1）已验证：不重复创建，返回 409
            raise BizError(409,BizCode.EMAIL_EXISTS,"email_exists")
        else:
            # 情况2） 未验证：不重复创建，直接返回“registered”
            return ok(data={
                "user_id": str(existing.id),
                "email": existing.email,
                "need_verify": True
            })

    # 第二步：创建新的用户对象
    user = User(
        id=uuid.uuid4(),
        email=str(payload.email),
        password_hash=hash_password(payload.password),
        name=payload.name,
        is_active=True,
    )
    db.add(user)
    await db.commit()
    return ok(data={"user_id": str(user.id), "email": user.email, "need_verify": True})

# 二、登录，成功后返回 access_token并通过 Cookie 设置 refresh_token，并记录登录 session（UserSession）。
@router.post("/login", response_model=TokenOut)
async def login(payload: LoginIn, request: Request, db: AsyncSession = Depends(get_db)):
    # 第一步：查询用户并验证密码
    q = await db.execute(select(User).where(User.email == payload.email))
    user = q.scalar_one_or_none()
    if not user or not verify_password(payload.password, user.password_hash or ""):
        # 避免暴露账户存在性
        raise HTTPException(401, "unauthenticated", headers={"WWW-Authenticate": "Bearer"})

    # 第二步：生成 Token（access + refresh）
    access = create_access_token(str(user.id))
    plain_refresh, refresh_hash, jti = new_refresh_token_pair()

    # 第三步：创建 Session 记录（UserSession）
    session = UserSession(
        user_id=user.id,
        jti=jti,
        family_id=uuid.uuid4(),
        refresh_token_hash=refresh_hash,
        issued_at=datetime.now(timezone.utc),
        expires_at=refresh_expiry_from_now(),
        user_agent=request.headers.get("user-agent"),
        ip_address=request.client.host if request.client else None,
    )

    # 第四步：保存 Session到数据库
    db.add(session)

    # 如果是第一次登录，记录登录时间
    if user.first_login_at is None:
        user.first_login_at = datetime.now(timezone.utc)

    await db.commit()

    # 第五步：构建响应
    resp = ok(data=TokenOut(access_token=access).model_dump())
    set_refresh_cookie(resp, plain_refresh, session.expires_at)
    return resp


# 三、JWT Refresh Token 轮转（Rotation）机制
#     这是一个 JWT 刷新接口，作用是：
#     客户端 access token过期后，自动调用 /refresh，用 cookie 中的 refresh_token来换一个新的 access_token（并设置新的 refresh_token）
@router.post("/refresh", response_model=TokenOut)
async def refresh(
    db: AsyncSession = Depends(get_db),
    refresh_cookie: str | None = Cookie(default=None, alias=REFRESH_COOKIE_NAME)
):
    # 第一步：检查Cookie中是否有refresh_cookie
    if not refresh_cookie:
        raise HTTPException(401, "unauthenticated", headers={"WWW-Authenticate": "Bearer"})

    # 第二步：取出token前面的jti部分
    try:
        jti, _ = refresh_cookie.split(".", 1)
    except ValueError:
        raise BizError(401, BizCode.TOKEN_INVALID, "token_invalid",
                       headers={"WWW-Authenticate": 'Bearer error="invalid_token"'})

    # 第三步：根据jti查找对应token
    refresh_hash = hash_refresh_token(refresh_cookie)
    q = await db.execute(select(UserSession).where(UserSession.jti == jti))
    sess = q.scalar_one_or_none()

    # 情况1) 找不到对应token，或者jti对上了，但是哈希值对不上（说明明文部分是伪造或者篡改的），返回TOKEN_INVALID
    if not sess or sess.refresh_token_hash != refresh_hash:
        raise BizError(401, BizCode.TOKEN_INVALID, "token_invalid",
                       headers={"WWW-Authenticate": 'Bearer error="invalid_token"'})

    # 情况2) 如果这个Token已作废，此次是非法复用，表明token可能已经泄露，直接吊销整个家族。返回TOKEN_INVALID
    if sess.revoked_at is not None:
        await db.execute(
            update(UserSession)
            .where(UserSession.family_id == sess.family_id, UserSession.revoked_at.is_(None))
            .values(revoked_at=datetime.now(timezone.utc))
        )
        await db.commit()
        raise BizError(401, BizCode.TOKEN_REVOKED, "token_revoked")

    # 情况3) 如果token已经过期了，返回TOKEN_EXPIRED
    if datetime.now(timezone.utc) > sess.expires_at:
        raise BizError(401, BizCode.TOKEN_EXPIRED, "token_expired",
                       headers={"WWW-Authenticate": 'Bearer error="invalid_token", error_description="expired"'})

    # 第四步：轮转：为UserSession表生成新 refresh_token，作废旧的refresh_token，并通过replaced_by_id字段将它们链接起来
    new_plain, new_hash, new_jti = new_refresh_token_pair()
    new_sess = UserSession(
        user_id=sess.user_id,
        jti=new_jti,
        family_id=sess.family_id,
        refresh_token_hash=new_hash,
        issued_at=datetime.now(timezone.utc),
        expires_at=refresh_expiry_from_now(),
        user_agent=str(sess.user_agent),
        ip_address=str(sess.ip_address),
    )
    db.add(new_sess)
    sess.revoked_at = datetime.now(timezone.utc)
    sess.replaced_by_id = new_sess.id
    await db.commit()

    # 第五步：构造返回resp（access_token放响应体，refresh_token放cookie）
    access = create_access_token(str(sess.user_id))
    resp = ok(data=TokenOut(access_token=access).model_dump())
    set_refresh_cookie(resp, new_plain, new_sess.expires_at)
    return resp


# 注销用户: 吊销当前 refresh token 并清除浏览器中的 refresh cookie
@router.post("/logout")
async def logout(
    response: Response,
    db: AsyncSession = Depends(get_db),
    refresh_cookie: str | None = Cookie(default=None, alias=REFRESH_COOKIE_NAME)
):
    # 第一步：数据库中作废refresh_token
    if refresh_cookie:
        try:
            jti, _ = refresh_cookie.split(".", 1)
        except ValueError:
            jti = None
        if jti:
            await db.execute(
                update(UserSession)
                .where(UserSession.jti == jti, UserSession.revoked_at.is_(None))
                .values(revoked_at=datetime.now(timezone.utc))
            )
            await db.commit()
    #  第二步：清除浏览器中的refresh_token并返回ok()响应
    clear_refresh_cookie(response)
    return ok()

# 获取当前登录用户的基本信息
@router.get("/me")                                     # 只有登录用户才能访问
async def me(current_user = Depends(get_current_user)):
    return ok(data={"id": str(current_user.id), "email": current_user.email})

# 第一次发送验证邮件，或者重新发送验证邮件（兼容）
@router.post("/verify-email/resend")
async def resend_verify_email(
    payload: ResendIn,
    background: BackgroundTasks,
    db: AsyncSession = Depends(get_db),
):
    # 第一步：标准化邮箱格式：去除空格并转小写
    email = str(payload.email).strip().lower()

    # 第二步：查找用户
    q = await db.execute(select(User).where(User.email == email))
    user = q.scalar_one_or_none()
    if not user:
        # 情况1) 若用户不存在，为了防止枚举，照样返回成功，但实际上不发
        return ok(message="verification_sent", data={"email": email})

    if user.email_verified_at is not None:
        # 情况2) 若用户邮箱已验证过，则无需重新发送，直接返回提示信息
        return ok(message="already_verified", data={"email": email})

    # 第三步：让之前未使用过的token失效
    await revoke_unusued_tokens_of_user(db, user.id)

    # 第四步：生成新 token并入库
    plain, token_hash = gen_email_token_pair()
    row = await create_email_token(db, user_id=user.id, token_hash=token_hash, ttl_hours=EMAIL_TOKEN_TTL_HOURS)
    await db.commit()

    # 第五步：构建验证链接并发送邮件
    link = build_verify_link(plain)
    #     后台异步执行发邮件任务，不阻塞请求
    background.add_task(send_verification_email, email, link)

    # 第六步：返回成功响应
    return ok(message="verification_sent", data={"email": email, "expires_in_hours": EMAIL_TOKEN_TTL_HOURS})

# 邮箱验证链接点击处理
    # 当用户点击邮件里的验证链接时，会跳转到一个前端页面，然后前端页面访问形如：GET /auth/verify-email?token=abc123456...
    # 本接口验证 token 的有效性，并将用户标记为“邮箱已验证”。
@router.get("/verify-email")
async def verify_email(
    token: str = Query(..., description="邮件里的 token"),  # Query用来自动提取查询参数
    request: Request = None,
    db: AsyncSession = Depends(get_db),
):
    # 第一步：检查链接中token的合法性
    if not token or len(token) < 16:
        raise BizError(400, BizCode.INVALID_REQUEST, "invalid_request")

    # 第二步：从数据库获取对应email_token
    token_hash = hash_email_token(token)
    row = await get_token_by_hash(db, token_hash)
     # 情况1) token不存在
    if not row:
        raise BizError(401, BizCode.TOKEN_INVALID, "token_invalid")
     # 情况2) token已被撤销
    if row.revoked_at is not None:
        raise BizError(401, BizCode.TOKEN_REVOKED, "token_revoked")
     # 情况3) token已经过期
    if datetime.now(timezone.utc) > row.expires_at:
        raise BizError(401, BizCode.TOKEN_EXPIRED, "token_expired")
     # 情况4) token已被使用
    if row.used_at is not None:
        return ok(message="email_verified", data={"user_id": str(row.user_id)})

    # 第三步：如果token没有问题，标记此token已用，并给用户打上已验证
    row.used_at = datetime.now(timezone.utc)
    row.used_ip = request.client.host if request and request.client else None
    row.used_user_agent = request.headers.get("user-agent") if request else None

    await db.execute(
        update(User)
        .where(User.id == row.user_id, User.email_verified_at.is_(None))
        .values(email_verified_at=datetime.now(timezone.utc))
        .execution_options(synchronize_session=False)
    )
    # 第四步：把该用户其他未用 token 全撤销
    await revoke_unusued_tokens_of_user(db, row.user_id)
    # 记得提交
    await db.commit()

    # 第五步：返回一个“已验证”的响应
    return ok(message="email_verified", data={"user_id": str(row.user_id)})