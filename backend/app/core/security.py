# backend/app/core/security.py
from __future__ import annotations
import os, uuid, time, hmac, hashlib
from datetime import datetime, timedelta, timezone
from typing import Tuple, Optional, Dict, Any

import jwt  # pyjwt
from passlib.context import CryptContext


PWD_CTX = CryptContext(schemes=["bcrypt"], deprecated="auto")

# 拿JWT密钥
JWT_SECRET = os.getenv("JWT_SECRET", "dev-secret")
# 设置加密算法
JWT_ALG = "HS256"
# access token 的有效时长（分钟）
ACCESS_TTL_MIN = int(os.getenv("ACCESS_TTL_MIN", "15"))

REFRESH_TTL_DAYS = int(os.getenv("REFRESH_TTL_DAYS", "14"))
REFRESH_HASH_PEPPER = os.getenv("REFRESH_HASH_PEPPER", "pepper")

# 将用户输入的明文密码（raw）加密为安全的哈希值，用于存入数据库。
def hash_password(raw: str) -> str:
    return PWD_CTX.hash(raw)

# 验证用户输入的明文密码（raw）是否和数据库里的哈希值（hashed）匹配。
def verify_password(raw: str, hashed: str) -> bool:
    return PWD_CTX.verify(raw, hashed)

# 创建一个 JWT Access Token（访问令牌），用于让用户携带身份信息访问 API。
#      sub	subject，通常是用户 ID 或用户名，代表“谁”拥有这个 token
#      extra	可选的额外字段，会加入到 JWT 的 payload 中

#     {
#         "sub": "user123",  # 用户身份
#         "iat": 1695740400,  # issued at，签发时间（时间戳）
#         "exp": 1695741300  # 过期时间（15 分钟后）
#         # ...可能还包含 extra 字段
#     }
def create_access_token(sub: str, extra: Optional[Dict[str, Any]] = None) -> str:
    now = int(time.time())
    payload = {"sub": sub, "iat": now, "exp": now + ACCESS_TTL_MIN * 60}
    if extra: payload.update(extra)
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALG)

# jwt.decode 会校验 token 是否符合签名。 如果过期或篡改，会直接抛出异常（需要捕获）。
def decode_access_token(token: str) -> Dict[str, Any]:
    return jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALG])



# new_refresh_token_pair() 生成刷新令牌，返回三元组：
    # token_with_jti	供客户端使用的 refresh token 明文
    # hashed	存入数据库的加密 hash，用于后续验证
    # jti	token 的唯一标识符（JWT ID）
def new_refresh_token_pair() -> Tuple[str, str, str]:  # (plain, hash, jti)
    # 生成不可预测的 refresh token（64字节）
    plain = uuid.uuid4().hex + uuid.uuid4().hex + uuid.uuid4().hex
    # 生成token ID
    jti = str(uuid.uuid4())
    # 拼接起来
    token_with_jti = f"{jti}.{plain}"
    # 算法加密
    hashed = hmac.new(REFRESH_HASH_PEPPER.encode(), token_with_jti.encode(), hashlib.sha256).hexdigest()
    return token_with_jti, hashed, jti

# 对一个 refresh token 明文值（含 jti）进行加密（哈希），生成数据库中要存的安全版本。
def hash_refresh_token(token_with_jti: str) -> str:
    return hmac.new(REFRESH_HASH_PEPPER.encode(), token_with_jti.encode(), hashlib.sha256).hexdigest()

# 生成当前时刻开始，向后推 REFRESH_TTL_DAYS 天的时间，用于设置 refresh token 的有效期。
def refresh_expiry_from_now() -> datetime:
    return datetime.now(timezone.utc) + timedelta(days=REFRESH_TTL_DAYS)
