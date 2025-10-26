from pydantic import BaseModel
import os

class RedisSettings(BaseModel):
    """
        Config for Redis
    """
    url: str = os.getenv("REDIS_URL", "redis://localhost:6379/0")
        # also supports rediss://host:port/0 —— Redis over TLS/SSL, which encrypts the communication for security

    socket_timeout: float = float(os.getenv("REDIS_TIMEOUT", "1.5"))
    health_check_interval: int = int(os.getenv("REDIS_HC_SEC", "30"))
    decode_responses: bool = True  # 直接返回 str，写限流更方便

REDIS_SETTINGS = RedisSettings()
