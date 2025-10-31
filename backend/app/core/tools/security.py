# backend/app/core/security.py
from __future__ import annotations
import os, uuid, time, hmac, hashlib
from datetime import datetime, timedelta, timezone
from typing import Tuple, Optional, Dict, Any

import jwt  # pyjwt
import bcrypt  # ← 方案C：直接使用 pyca/bcrypt

# ----------------- JWT 配置 -----------------
# 设置JWT Access Token的签名密钥
JWT_SECRET = os.getenv("JWT_SECRET", "dev-secret")
# 设置JWT加密算法
JWT_ALG = "HS256"
# 设置access token 的有效时长（分钟）
ACCESS_TTL_MIN = int(os.getenv("ACCESS_TTL_MIN", "15"))

# ----------------- Refresh Token 配置 -----------------
# 设置refresh token的有效时长（天）
REFRESH_TTL_DAYS = int(os.getenv("REFRESH_TTL_DAYS", "14"))
# 设置refresh token 哈希加密时用的“盐”值（PEPPER）
REFRESH_HASH_PEPPER = os.getenv("REFRESH_HASH_PEPPER", "pepper")

# ----------------- 工具函数 -----------------
def _sha256_bytes(s: str) -> bytes:
    """返回 UTF-8 编码后做 SHA-256 的 32字节摘要。"""
    return hashlib.sha256(s.encode("utf-8")).digest()

# ----------------- 一、密码存储 ------------------
# 1) 哈希
def hash_password(raw: str) -> str:
    """
    先对明文做 SHA-256，再把32字节摘要交给 bcrypt。
    这样规避 bcrypt 的 72 字节限制，又与 bcrypt_sha256 语义等价。
    """
    if not isinstance(raw, str):
        raise TypeError("password must be a string")
    digest = _sha256_bytes(raw)
    salt = bcrypt.gensalt()  # 可传 rounds=12/成本参数自行权衡
    hashed = bcrypt.hashpw(digest, salt).decode("utf-8")
    return hashed

# 2) 校验
def verify_password(raw: str, hashed: str) -> bool:
    """
    校验密码：
    拿用户输入的明文密码 raw，先做一遍 SHA-256，然后跟数据库里传过来的哈希 hashed 进行 bcrypt 比对
    """
    if not isinstance(raw, str):
        return False
    try:
        digest = _sha256_bytes(raw)
        return bcrypt.checkpw(digest, hashed.encode("utf-8"))
    except Exception:
        # hashed 字符串格式非法等情况，直接视为不匹配
        return False

# ----------------- 二、访问令牌创建和校验 ------------------
# 1) 创建 Access Token
def create_access_token(sub: str, extra: Optional[Dict[str, Any]] = None) -> str:
    # 拿到当前精确时间戳
    now = int(time.time())
    # 构造payload
    payload = {"sub": sub, "iat": now, "exp": now + ACCESS_TTL_MIN * 60}
    if extra:
        payload.update(extra)
    # jwt编码并签名
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALG)

# 2) 校验 Access Token（过期/篡改会抛异常，调用方自行捕获）
def decode_access_token(token: str) -> Dict[str, Any]:
    return jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALG])

# ----------------- 三、Refresh Token 生成与校验 ------------------
# 1) 生成刷新令牌三元组
def new_refresh_token_pair() -> Tuple[str, str, str]:  # (plain, hash, jti)
    # 生成不可预测的 refresh token（96 hex chars）
    plain = uuid.uuid4().hex + uuid.uuid4().hex + uuid.uuid4().hex
    # 生成 token ID
    jti = str(uuid.uuid4())
    # 拼接（客户端保存此明文）
    token_with_jti = f"{jti}.{plain}"
    # 生成存库哈希（HMAC-SHA256，含服务端PEPPER）
    hashed = hmac.new(
        REFRESH_HASH_PEPPER.encode("utf-8"),
        token_with_jti.encode("utf-8"),
        hashlib.sha256,
    ).hexdigest()
    return token_with_jti, hashed, jti

# 2) 明文哈希
def hash_refresh_token(token_with_jti: str) -> str:
    """
    对 refresh token 明文（含 jti）进行哈希，用于校验
    """
    return hmac.new(
        REFRESH_HASH_PEPPER.encode("utf-8"),
        token_with_jti.encode("utf-8"),
        hashlib.sha256,
    ).hexdigest()

# 3) 计算 refresh token 过期时间
def refresh_expiry_from_now() -> datetime:
    return datetime.now(timezone.utc) + timedelta(days=REFRESH_TTL_DAYS)
