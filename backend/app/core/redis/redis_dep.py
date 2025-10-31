from fastapi import Depends, Request
from redis.asyncio import Redis

def get_redis(request: Request) -> Redis:
    """
        Returns the Redis client that has been assigned to the app.state.redis
    """
    return request.app.state.redis
