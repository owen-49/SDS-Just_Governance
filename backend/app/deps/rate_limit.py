# rate_limit.py
import time
from typing import Optional, Callable
from fastapi import Request, Depends
from redis.asyncio import Redis
from app.core.exceptions.exceptions import BizError  # 你项目里的 BizError
from app.core.exceptions.codes import BizCode

# ---- IP 提取（仅在受信代理后使用 XFF/X-Real-IP）----
def get_client_ip(request: Request) -> str:
    xff = request.headers.get("x-forwarded-for") or request.headers.get("X-Forwarded-For")
    if xff:
        return xff.split(",")[0].strip()
    xri = request.headers.get("x-real-ip") or request.headers.get("X-Real-IP")
    if xri:
        return xri.strip()
    return request.client.host or "unknown"

# ---- 生成“按 IP 限流”的依赖 ----
def limit_by_ip(scope: str, limit: int, window_seconds: int, redis_dep: Callable[[], Redis]):
    """
    用法: 在路由上加 dependencies=[Depends(limit_by_ip("register", 5, 3600, get_redis))]
    """
    async def _dep(request: Request, redis: Redis = Depends(redis_dep)):
        now_ms = int(time.time() * 1000)
        key = f"rl:{scope}:ip:{get_client_ip(request)}"
        window_ms = window_seconds * 1000

        # 原子流水线：清理窗口外 -> 记录当前 -> 设TTL -> 计数
        pipe = redis.pipeline()
        pipe.zremrangebyscore(key, 0, now_ms - window_ms)
        pipe.zadd(key, {str(now_ms): now_ms})
        pipe.expire(key, window_seconds)
        pipe.zcard(key)
        _, _, _, count = await pipe.execute()

        if count > limit:
            ttl = await redis.ttl(key)
            raise BizError(
                429, BizCode.TOO_MANY_REQUESTS, "too_many_requests",
                data={"scope": scope, "limit": limit, "window_s": window_seconds},
                headers={"Retry-After": str(max(ttl, 1))}
            )
    return _dep

# ---- 针对“某个值”的限流（email/手机号/用户ID等），在业务代码里调用 ----
async def limit_by_value(redis: Redis, scope: str, value: str, limit: int, window_seconds: int):
    now_ms = int(time.time() * 1000)
    key = f"rl:{scope}:key:{value}"
    window_ms = window_seconds * 1000

    pipe = redis.pipeline()
    pipe.zremrangebyscore(key, 0, now_ms - window_ms)
    pipe.zadd(key, {str(now_ms): now_ms})
    pipe.expire(key, window_seconds)
    pipe.zcard(key)
    _, _, _, count = await pipe.execute()

    if count > limit:
        ttl = await redis.ttl(key)
        raise BizError(
            429, BizCode.TOO_MANY_REQUESTS, "too_many_requests",
            data={"scope": scope, "limit": limit, "window_s": window_seconds, "value": value},
            headers={"Retry-After": str(max(ttl, 1))}
        )
