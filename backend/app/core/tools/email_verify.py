from __future__ import annotations

import logging
import os, uuid, hmac, hashlib

logger = logging.getLogger(__name__)

# 验证令牌的有效期（小时）
EMAIL_TOKEN_TTL_HOURS = int(os.getenv("EMAIL_TOKEN_TTL_HOURS", "24"))

# 令牌哈希时使用的 HMAC 密钥
EMAIL_TOKEN_PEPPER = os.getenv("EMAIL_TOKEN_PEPPER", "email-pepper")

# 前端地址
FRONTEND_ORIGIN = os.getenv("FRONTEND_ORIGIN", "http://localhost:3000")  # 用于拼链接

_RESEND_API_KEY = os.getenv("RESEND_API_KEY")
_FROM_EMAIL = os.getenv("FROM_EMAIL")

# 生成token明文和哈希值，分别用于给用户和存数据库
def gen_email_token_pair() -> tuple[str, str]:
    """
    返回 (plain_token, token_hash)
    plain_token 会被拼进邮件链接里；数据库只存 hash。
    """

    # 生成plain_token
    t = uuid.uuid4().hex + uuid.uuid4().hex     # 64个字符，足够长
    # 生成 HMAC-SHA256 哈希值
    h = hmac.new(EMAIL_TOKEN_PEPPER.encode(), t.encode(), hashlib.sha256).hexdigest()
    return t, h

# 计算哈希值：
#  用于在验证 token 时，将用户提交的明文 token 再次哈希，和数据库中的 token_hash 进行比对。
def hash_email_token(plain: str) -> str:
    return hmac.new(EMAIL_TOKEN_PEPPER.encode(), plain.encode(), hashlib.sha256).hexdigest()

# 构建发给用户的“邮箱验证链接”
def build_verify_link(token_plain: str) -> str:
    # 你前端“验证完成页”的路由，自行替换
    return f"{FRONTEND_ORIGIN}/verify-email?token={token_plain}"


#
_SUBJECT = "Verify your email"
_HTML_TMPL = """\
<div style="font-family:system-ui,-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;max-width:560px;margin:auto;padding:24px">
  <h2 style="margin:0 0 12px">Confirm your email</h2>
  <p style="margin:0 0 16px;line-height:1.5">
    Click the button below to verify your email. The link expires in {ttl} hours.
  </p>
  <p style="margin:24px 0">
    <a href="{link}" style="display:inline-block;padding:10px 16px;text-decoration:none;border-radius:8px;border:1px solid #444">
      Verify Email
    </a>
  </p>
  <p style="color:#666;margin-top:24px;font-size:14px">
    If the button doesn't work, copy and paste this URL into your browser:<br>
    <span style="word-break:break-all">{link}</span>
  </p>
</div>
"""
_TEXT_TMPL = (
    "Confirm your email\n\n"
    "Open this link to verify (expires in {ttl} hours):\n{link}\n"
)

# 使用RESEND API发送验证邮件
def send_verification_email(to_email: str, verify_link: str) -> None:
    if not _RESEND_API_KEY or not _FROM_EMAIL:
        logger.warning("Resend env not set, skip email. to=%s link=%s", to_email, verify_link)
        return

    try:
        import resend
        resend.api_key = _RESEND_API_KEY

        params = resend.Emails.SendParams(
            **{
                "from": _FROM_EMAIL,
                "to": [to_email],
                "subject": _SUBJECT,
                "html": _HTML_TMPL.format(link=verify_link, ttl=EMAIL_TOKEN_TTL_HOURS),
                "text": _TEXT_TMPL.format(link=verify_link, ttl=EMAIL_TOKEN_TTL_HOURS),
            }
        )
        resend.Emails.send(params)
        logger.info("verification_mail_sent", extra={"extra": {"to": to_email}})
    except Exception as e:
        # 不要打断主流程；只记录错误
        logger.error("verification_mail_failed", extra={"extra": {"to": to_email, "error": str(e)}})
        # 需要严格失败的话，改成 raise
        return

