# backend/app/schemas/auth.py
from pydantic import BaseModel, EmailStr, Field

class RegisterIn(BaseModel):
    email: EmailStr      # 自动验证邮箱格式
    password: str = Field(min_length=8, max_length=128)   # 自动校验密码长度
    name: str | None = None    # 可选的用户名

class LoginIn(BaseModel):
    email: EmailStr
    password: str

# 返回一个标准的 OAuth2 风格 token 响应
class TokenOut(BaseModel):
    access_token: str
    token_type: str = "bearer"

class ResendIn(BaseModel):
    email: EmailStr

