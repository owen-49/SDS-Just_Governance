from fastapi import FastAPI
from redis.asyncio import from_url, Redis
from .redis_conf import REDIS_SETTINGS

async def create_redis() -> Redis:
    """
    Creates a new Redis client for this project with the given settings.
    """
    return from_url(
        REDIS_SETTINGS.url,
        decode_responses=REDIS_SETTINGS.decode_responses,
        socket_timeout=REDIS_SETTINGS.socket_timeout,
        health_check_interval=REDIS_SETTINGS.health_check_interval,
    )

def get_redis_from_app(app: FastAPI) -> Redis:
    """
    Returns the Redis client that has been assigned to the app.state.redis
    """
    return app.state.redis
