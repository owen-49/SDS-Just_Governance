# rate_limit.py
import time
from typing import Optional, Callable
from fastapi import Request, Depends
from redis.asyncio import Redis
from app.core.exceptions.exceptions import BizError
from app.core.exceptions.codes import BizCode
from app.core.redis.redis_dep import get_redis


def get_client_ip(request: Request) -> str:
    """
    get client ip address from the request object
    """
    xff = request.headers.get("x-forwarded-for") or request.headers.get("X-Forwarded-For")
    if xff:
        return xff.split(",")[0].strip()
    xri = request.headers.get("x-real-ip") or request.headers.get("X-Real-IP")
    if xri:
        return xri.strip()
    return request.client.host or "unknown"


def limit_by_ip(scope: str, limit: int, window_seconds: int):
    """
    生成用于给某个ip限流的依赖
    用法: 在路由上加 dependencies=[Depends(limit_by_ip("register", 5, 3600, get_redis))]
        则其含义是每个 IP 在“register”这个作用域内，每小时最多只能请求 5 次。
    """
    async def _dep(request: Request, redis: Redis = Depends(get_redis)):
        # 获取当前时间
        now_ms = int(time.time() * 1000)
        key = f"rl:{scope}:ip:{get_client_ip(request)}"
        window_ms = window_seconds * 1000

        # Phase 1: trim + count
        pipe = redis.pipeline(transaction=True)
        await pipe.zremrangebyscore(key, 0, now_ms - window_ms)
        await pipe.zcard(key)
        _, count = await pipe.execute()

        if count >= limit:
            # compute real retry-after from oldest in-window item
            oldest = await redis.zrange(key, 0, 0, withscores=True)
            oldest_ms = int(oldest[0][1]) if oldest else now_ms
            retry_sec = max(1, (oldest_ms + window_ms - now_ms + 999) // 1000)
            raise BizError(429, BizCode.RATE_LIMITED, "rate_limited",
                           headers={"Retry-After": str(retry_sec)})

        # Phase 2: record + expire (only on accepted requests)
        pipe = redis.pipeline(transaction=True)
        await pipe.zadd(key, {str(now_ms): now_ms})
        await pipe.pexpire(key, window_ms)
        await pipe.execute()
    return _dep


# ---- 针对“某个值”的限流（email/手机号/用户ID等），在业务代码里调用 ----
async def limit_by_value(redis: Redis, scope: str, value: str, limit: int, window_seconds: int):
    now_ms = int(time.time() * 1000)
    window_ms = window_seconds * 1000
    key = f"rl:{scope}:key:{value}"

    # Phase 1: trim + count (no side effects if we later reject)
    pipe = redis.pipeline(transaction=True)
    await pipe.zremrangebyscore(key, 0, now_ms - window_ms)
    await pipe.zcard(key)
    _, count = await pipe.execute()

    if count >= limit:
        # Compute precise retry time from the oldest member still in the window
        oldest = await redis.zrange(key, 0, 0, withscores=True)
        if oldest:
            oldest_ms = int(oldest[0][1])
            retry_ms = oldest_ms + window_ms - now_ms
        else:
            retry_ms = window_ms  # fallback
        retry_sec = max(1, (retry_ms + 999) // 1000)

        raise BizError(
            429, BizCode.RATE_LIMITED, "rate_limited",
            data={"scope": scope, "limit": limit, "window_s": window_seconds, "value": value},
            headers={"Retry-After": str(retry_sec)}
        )

    # Phase 2: record + housekeeping (only for accepted requests)
    pipe = redis.pipeline(transaction=True)
    await pipe.zadd(key, {str(now_ms): now_ms})
    await pipe.pexpire(key, window_ms)  # refresh for cleanup only on success
    await pipe.execute()
