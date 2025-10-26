# rate_limit.py
import time
from typing import Optional, Callable
from fastapi import Request, Depends
from redis.asyncio import Redis
from app.core.exceptions.exceptions import BizError
from app.core.exceptions.codes import BizCode
from core.redis.redis_dep import get_redis


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

        pipe = redis.pipeline(transaction=True)
        # 1）移除过期记录：即加入集合的时间 + 窗口时长 < 当前时间的元素
        await pipe.zremrangebyscore(key, 0, now_ms - window_ms)
        # 2）记录当前请求时间（zadd）
        await pipe.zadd(key, {str(now_ms): now_ms})
        # 3）为整个有序集合设置新的过期时间
        await pipe.expire(key, window_seconds)
        # 4）统计当前窗口的访问次数
        await pipe.zcard(key)
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
    await pipe.zremrangebyscore(key, 0, now_ms - window_ms)
    await pipe.zadd(key, {str(now_ms): now_ms})
    await pipe.expire(key, window_seconds)
    await pipe.zcard(key)
    _, _, _, count = await pipe.execute()

    if count > limit:
        ttl = await redis.ttl(key)
        raise BizError(
            429, BizCode.TOO_MANY_REQUESTS, "too_many_requests",
            data={"scope": scope, "limit": limit, "window_s": window_seconds, "value": value},
            headers={"Retry-After": str(max(ttl, 1))}
        )
