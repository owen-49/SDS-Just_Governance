# backend/app/api/routes/auth.py
from __future__ import annotations

import asyncio
import uuid
from datetime import datetime, timezone
from fastapi import APIRouter, Request, Response, Depends, Cookie, HTTPException, BackgroundTasks, Query
from redis.asyncio import Redis
from sqlalchemy.exc import SQLAlchemyError, IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, update
from sqlalchemy.orm import noload

from app.core.db.db import get_db
from app.core.tools.auth import normalize_email
from app.core.tools.email_verify import gen_email_token_pair, build_verify_link, send_verification_email, EMAIL_TOKEN_TTL_HOURS, \
    hash_email_token
from app.repositories.auth.email_tokens import revoke_unusued_tokens_of_user, create_email_token, get_token_by_hash
from app.schemas.core.api_response import ok
from app.schemas.auth.auth import RegisterIn, LoginIn, TokenOut, ResendIn
from app.core.tools.security import (
    hash_password, verify_password, create_access_token,
    new_refresh_token_pair, hash_refresh_token, refresh_expiry_from_now
)
from app.core.exceptions.exceptions import BizError
from app.core.exceptions.exceptions import BizCode
from app.models import User
from app.models import UserSession
from app.deps.auth import get_current_user

from sqlalchemy.dialects.postgresql import insert as pg_insert

from app.core.redis.redis_dep import get_redis
from app.deps.rate_limit import limit_by_ip, limit_by_value

router = APIRouter(prefix="/auth", tags=["auth"])

REFRESH_COOKIE_NAME = "refresh_token"
REFRESH_RETRY_GRACE_SECONDS = 30  # 重试宽限窗口

# 字典常量，用于统一设置刷新 token Cookie 的属性（安全性配置）
COOKIE_KW = dict(
    httponly=True, secure=True, samesite="lax", path="/"
)

# 作用：把 refresh token安全地设置到浏览器的 Cookie 中
def set_refresh_cookie(resp: Response, token_with_jti: str, expires: datetime):
    resp.set_cookie(
        REFRESH_COOKIE_NAME,
        token_with_jti,
        expires=expires,
        httponly=True,
        secure=True,
        samesite="lax",
        path="/"
    )

def clear_refresh_cookie(resp: Response):
    resp.delete_cookie(REFRESH_COOKIE_NAME, path="/")


async def get_client_meta(request: Request):
    return request.headers.get("user-agent", ""), request.client.host if request.client else None

# 一、邮箱注册
@router.post("/register",
             dependencies=[Depends(limit_by_ip("register", limit=5, window_seconds=3600))])
async def register(payload: RegisterIn, db: AsyncSession = Depends(get_db), redis:Redis = Depends(get_redis)):
    email_norm = normalize_email(str(payload.email))

    # 再按邮箱做一道更细的限流（防同邮箱被刷）
    await limit_by_value(redis, "register-email", email_norm, limit=5, window_seconds=3600)

    # 第一步：判断邮箱是否已经存在
    result = await db.execute(select(User).where(User.email == email_norm))
    existing = result.scalar_one_or_none()

    if existing:
        if existing.email_verified_at:
            # 情况1）已验证：返回 409，前端提示该账号已被注册
            raise BizError(409,BizCode.EMAIL_EXISTS,"email_exists")
        else:
            # 情况2）未验证：返回特殊成功，前端跳转发送验证邮件
            return ok(data={
                "user_id": str(existing.id),
                "email": existing.email,
                "need_verify": True
            })
    ###### UPSERT解决并发问题 ######
    # —— 第二步：创建新的用户对象（将原来的 add+commit 改为 UPSERT）——
    try:
        stmt = (
            pg_insert(User)
            .values(
                id=uuid.uuid4(),
                email=email_norm,
                password_hash=hash_password(payload.password),
                name=payload.name,
                is_active=True,
            )
            .on_conflict_do_nothing(index_elements=[User.email])
            .returning(User.id, User.email)  # 只有真正插入成功才会返回行
        )

        row = (await db.execute(stmt)).first()
        if row:
            # 插入成功 → 提交并返回
            await db.commit()
            return ok(data={
                "user_id": str(row.id),
                "email": row.email,
                "need_verify": True
            })

        # 没有返回行 → 说明发生了唯一冲突（并发或历史已存在），这一步没有写入
        # 为了结束当前事务边界，这里做一次 rollback（可选但更干净）
        await db.rollback()

        # 再查一次，判断“已验证/未验证”，与第一次查时的语义对齐
        result2 = await db.execute(select(User).where(User.email == email_norm))
        existing2 = result2.scalar_one_or_none()

        if existing2 is None:
            # 极少数时序/读写分离导致此刻还看不到胜出事务
            # 语义上可以视为存在竞争，需要客户端稍后重试
            raise BizError(503, BizCode.TRY_AGAIN, "please_retry", headers={"Retry-After": "2"})

        if existing2.email_verified_at:
            raise BizError(409, BizCode.EMAIL_EXISTS, "email_exists")

        return ok(data={
            "user_id": str(existing2.id),
            "email": existing2.email,
            "need_verify": True
        })

    except IntegrityError as e:
        await db.rollback()
        sqlstate = getattr(getattr(e, "orig", None), "sqlstate", None)
        # if sqlstate == "23505":
        #     raise BizError(409, BizCode.EMAIL_EXISTS, "email_exists") from e
        # 其他约束（外键/检查等）你也可细分成 409/422
        raise BizError(422, BizCode.VALIDATION_ERROR, "validation_error") from e

    # 未知数据库故障：
    except SQLAlchemyError as e:
        await db.rollback()
        raise e

# 二、第一次发送验证邮件，或者重新发送验证邮件（兼容）
@router.post("/verify-email/resend")
async def resend_verify_email(
    payload: ResendIn,
    background: BackgroundTasks,
    db: AsyncSession = Depends(get_db),
):
    # 第一步：标准化邮箱格式：去除空格并转小写
    email_normal = normalize_email(str(payload.email))

    # 第二步：查找用户
    q = await db.execute(select(User).where(User.email == email_normal))
    user = q.scalar_one_or_none()
    if not user:
        # 情况1) 若用户不存在，为了防止枚举，照样返回成功，但实际上不发
        return ok(message="verification_sent", data={"email": email_normal})

    if user.email_verified_at is not None:
        # 情况2) 若用户邮箱已验证过，则无需重新发送，直接返回提示信息
        return ok(message="already_verified", data={"email": email_normal})

    # 第三步：让之前未使用过的token失效
    await revoke_unusued_tokens_of_user(db, user.id)

    # 第四步：生成新 token并入库
    plain, token_hash = gen_email_token_pair()
    row = await create_email_token(db, user_id=user.id, token_hash=token_hash, ttl_hours=EMAIL_TOKEN_TTL_HOURS)
    await db.commit()

    # 第五步：构建验证链接并发送邮件
    link = build_verify_link(plain)
    #     后台异步执行发邮件任务，不阻塞请求
    background.add_task(send_verification_email, email_normal, link)

    # 第六步：返回成功响应
    return ok(message="verification_sent", data={"email": email_normal, "expires_in_hours": EMAIL_TOKEN_TTL_HOURS})

# 三、邮箱验证链接点击处理
    # 当用户点击邮件里的验证链接时，会跳转到一个前端页面，然后前端页面访问形如：GET /auth/verify-email?token=abc123456...
    # 本接口验证 token 的有效性，并将用户标记为“邮箱已验证”。
@router.get("/verify-email")
async def verify_email(
    request: Request,
    token: str = Query(..., description="邮件里的 token"),  # Query用来自动提取查询参数
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
    
    # 先提交当前token的使用状态，确保它不会被撤销
    await db.commit()
    
    # 第四步：把该用户其他未用 token 全撤销（当前token已标记为used_at，不会被撤销）
    await revoke_unusued_tokens_of_user(db, row.user_id)
    # 再次提交撤销操作
    await db.commit()

    # 第五步：返回一个“已验证”的响应
    return ok(message="email_verified", data={"user_id": str(row.user_id)})

# 四、邮箱登录，成功后返回 access_token并通过 Cookie 设置 refresh_token，并记录登录 session（UserSession）。
@router.post("/login", response_model=TokenOut,
             dependencies=[Depends(limit_by_ip("login", limit=10, window_seconds=240))])
async def login(payload: LoginIn, request: Request, db: AsyncSession = Depends(get_db), redis:Redis = Depends(get_redis)):
    email_norm = normalize_email(str(payload.email))
    # 对邮箱也做一个限流
    await limit_by_value(redis, "login-email", email_norm, limit=5, window_seconds=240)

    # 第一步：查询用户
    q = await db.execute(select(User).where(User.email == email_norm))
    user = q.scalar_one_or_none()

    # 检查邮箱是否已验证
    if user and user.email_verified_at is None:
        raise BizError(401, BizCode.EMAIL_NOT_VERIFIED, "email_not_verified")

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


# 五、JWT Refresh Token 轮转机制
def _map_key(old_jti: str) -> str:
    """
    构造Redis键名: rt:map:{old_jti}，用于刷新令牌的old_jti->new_jti映射
    """
    return f"rt:map:{old_jti}"

def _plain_key(new_jti: str) -> str:
    """
    构造Redis键名：rt:plain:{new_jti}，用于刷新令牌的new_jti->new_plain映射
    """
    return f"rt:plain:{new_jti}"

def _exp_key(new_jti: str) -> str:
    """
    构造Redis键名：rt:exp:{new_jti}，用于刷新令牌的new_jti->expired_at映射
    """
    return f"rt:exp:{new_jti}"

def _b2s(v):
    if isinstance(v, (bytes, bytearray)):
        return v.decode()
    return v

@router.post("/refresh", response_model=TokenOut)
async def refresh(
    db: AsyncSession = Depends(get_db),
    redis: Redis = Depends(get_redis),
    refresh_cookie: str | None = Cookie(default=None, alias=REFRESH_COOKIE_NAME),
):
    # 0) 若未携带刷新令牌，返回未鉴权
    if not refresh_cookie:
        raise HTTPException(401, "unauthenticated", headers={"WWW-Authenticate": "Bearer"})

    # 解析RT Token中的jti
    try:
        jti, _ = refresh_cookie.split(".", 1)
    except ValueError:
        # 1) 若分隔不成功，说明令牌无效
        raise BizError(401, BizCode.TOKEN_INVALID, "token_invalid",
                       headers={"WWW-Authenticate": 'Bearer error="invalid_token"'})

    # 拿到RT Token明文加密后的哈希值
    refresh_hash = hash_refresh_token(refresh_cookie)
    # 取到当前时间
    now = datetime.now(timezone.utc)

    # 变量：用于事务外设置 cookie / 缓存 / 抛错
    rotate_ok = False
    # 表示这次刷新“已有可返回的结果”。两种情况会设为 True：正常轮转成功/复用命中缓存
    replay_detected = False
    # 表示在“已撤销分支”中没有命中复用缓存（包括重试后仍未命中）或校验失败，推定为复用旧 RT
    user_id_for_resp = None
    # 提前把用户 ID 存出来，用于事务外签发 AT。这么做避免在事务外继续依赖被锁对象 sess，也避免提交后对象过期的问题。
    new_plain: str | None = None
    # 新 Refresh Token 的明文
    new_expires: datetime | None = None
    new_jti: str | None = None
    family_id = None

    # 2) 事务 + 行锁：对当前 jti 串行化 refresh
    async with db.begin():
        res = await db.execute(
            select(UserSession).options(noload(UserSession.user)).where(UserSession.jti == jti).with_for_update()
        )
        sess = res.scalar_one_or_none()

        # 2.1) 无该 jti 或哈希不匹配 → invalid
        if not sess or sess.refresh_token_hash != refresh_hash:
            raise BizError(401, BizCode.TOKEN_INVALID, "token_invalid",
                           headers={"WWW-Authenticate": 'Bearer error="invalid_token"'})
        # 否则，拿到对应user_id和family_id
        user_id_for_resp = sess.user_id
        family_id = sess.family_id

        # 2.2) 过期 → expired
        if now > sess.expires_at:
            raise BizError(401, BizCode.TOKEN_EXPIRED, "token_expired",
                           headers={"WWW-Authenticate": 'Bearer error="invalid_token", error_description="expired"'})

        # 2.3) 已撤销：重试安全分支（复用）
        if sess.revoked_at is not None:
            new_jti = None
            for _try in range(3):  # 共尝试 3 次：0ms / 50ms / 100ms
                # 看看这个jti是不是刚刚用过并被保存在缓存中
                new_jti = _b2s(await redis.get(_map_key(str(sess.jti))))
                if new_jti:
                    break
                await asyncio.sleep(0.05 * (_try + 1))  # 50ms 线性退避

            # 如果缓存了
            if new_jti:
                cached_plain = exp_epoch = None
                for _try in range(3):
                    # 拿到这个新jti对应token的明文和过期时间
                    cp, ee = await redis.mget(_plain_key(new_jti), _exp_key(new_jti))
                    cached_plain, exp_epoch = _b2s(cp), _b2s(ee)
                    if cached_plain and exp_epoch:
                        break
                    await asyncio.sleep(0.05 * (_try + 1))

                if cached_plain and exp_epoch:
                    # 轻量校验：新会话仍存在且未撤销、未过期
                    check = await db.execute(
                        select(UserSession.id).where(
                            UserSession.jti == new_jti,
                            UserSession.family_id == family_id,
                            UserSession.revoked_at.is_(None),
                            UserSession.expires_at > now,
                        )
                    )
                    alive = check.scalar_one_or_none()
                    if alive:
                        new_plain = cached_plain
                        new_expires = datetime.fromtimestamp(int(exp_epoch), tz=timezone.utc)
                        rotate_ok = True  # 事务结束后直接构造响应
                    else:
                        replay_detected = True
                else:
                    replay_detected = True
            else:
                replay_detected = True

            if replay_detected and not rotate_ok:
                # 吊销整个 family（在事务内提交）
                await db.execute(
                    update(UserSession)
                    .where(UserSession.family_id == family_id, UserSession.revoked_at.is_(None))
                    .values(revoked_at=now)
                )
                # 事务结束后抛错

        # 2.4) 未撤销：正常轮转（单事务：新建新 session + 撤销旧 session）
        else:
            new_plain, new_hash, new_jti = new_refresh_token_pair()
            new_expires = refresh_expiry_from_now()

            new_sess = UserSession(
                user_id=sess.user_id,
                jti=new_jti,
                family_id=family_id,
                refresh_token_hash=new_hash,
                issued_at=now,
                expires_at=new_expires,
                user_agent=str(sess.user_agent),
                ip_address=str(sess.ip_address),
            )
            db.add(new_sess)
            await db.flush() # ← 确保 new_sess.id 可用
            sess.revoked_at = now
            sess.replaced_by_id = new_sess.id

            rotate_ok = True
        # 事务结束：提交并释放行锁

    # 3) 事务外：根据标志返回或抛错 + 写缓存
    if replay_detected and not rotate_ok:
        raise BizError(401, BizCode.TOKEN_REVOKED, "token_revoked")

    # 3.1) 构造响应（首次轮转或复用）
    access = create_access_token(str(user_id_for_resp))
    resp = ok(data=TokenOut(access_token=access).model_dump())

    # 3.2) 如果是“首次轮转成功”，把映射结果缓存 30s，支撑重试复用
    if new_plain and new_jti and new_expires:
        pipe = redis.pipeline(transaction=False)
        pipe.setex(_map_key(jti), REFRESH_RETRY_GRACE_SECONDS, new_jti)
        pipe.setex(_plain_key(new_jti), REFRESH_RETRY_GRACE_SECONDS, new_plain)
        pipe.setex(_exp_key(new_jti), REFRESH_RETRY_GRACE_SECONDS, str(int(new_expires.timestamp())))
        await pipe.execute()

    # 3.3) 设置 refresh cookie
    if rotate_ok and new_plain and new_expires:
        set_refresh_cookie(resp, new_plain, new_expires)
    return resp

# 六、注销用户: 吊销当前 refresh token 并清除浏览器中的 refresh cookie
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
    #  第二步： 清除浏览器中的refresh_token并返回ok()响应
    clear_refresh_cookie(response)
    return ok()

# 获取当前登录用户的基本信息
@router.get("/me")                                     # 只有登录用户才能访问
async def me(current_user = Depends(get_current_user)):
    return ok(data={"id": str(current_user.id), "email": current_user.email})