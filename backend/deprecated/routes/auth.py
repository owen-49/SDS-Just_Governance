import os
from datetime import datetime, timedelta

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field
from passlib.context import CryptContext
import jwt

from db.session import SessionLocal
from original_models.user import User
from services.old.mail_service import MailService

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
SECRET_KEY = os.getenv("JWT_SECRET", "change_me")
ALGORITHM = "HS256"

# 初始化邮件服务
mail_service = MailService()

router = APIRouter(tags=["auth"])


class SendCodeIn(BaseModel):
    email: str = Field(..., description="用户邮箱")


class RegisterIn(BaseModel):
    email: str = Field(..., description="User email")
    password: str = Field(..., description="Password")
    verification_code: str = Field(..., description="邮箱验证码")


class LoginIn(BaseModel):
    email: str = Field(..., description="User email")
    password: str = Field(..., description="Password")


class TokenOut(BaseModel):
    access_token: str
    token_type: str = "bearer"


@router.post("/send-code")
async def send_verification_code(payload: SendCodeIn):
    """发送邮箱验证码"""
    try:
        # 检查邮箱是否已注册
        with SessionLocal() as db:
            existing = db.query(User).filter(User.email == payload.email).first()
            if existing:
                raise HTTPException(status_code=400, detail="该邮箱已注册")
        
        # 发送验证码
        result = await mail_service.send_verification_code(payload.email)
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"发送验证码失败: {str(e)}")


@router.post("/register")
async def register(payload: RegisterIn):
    """用户注册（需要验证码）"""
    try:
        # 验证邮箱验证码
        if not mail_service.verify_code(payload.email, payload.verification_code):
            raise HTTPException(status_code=400, detail="验证码无效或已过期")
        
        with SessionLocal() as db:
            existing = db.query(User).filter(User.email == payload.email).first()
            if existing:
                raise HTTPException(status_code=400, detail="Email already registered")
            hashed = pwd_context.hash(payload.password)
            user = User(email=payload.email, password_hash=hashed)
            db.add(user)
            db.commit()
            db.refresh(user)
            
            # 清除已使用的验证码
            mail_service.clear_code(payload.email)
            
            return {"id": user.id, "email": user.email}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"注册失败: {str(e)}")


@router.post("/login", response_model=TokenOut)
def login(payload: LoginIn):
    with SessionLocal() as db:
        user = db.query(User).filter(User.email == payload.email).first()
        if not user or not pwd_context.verify(payload.password, user.password_hash):
            raise HTTPException(status_code=401, detail="Invalid credentials")
        to_encode = {
            "sub": str(user.id),
            "exp": datetime.utcnow() + timedelta(hours=1),
        }
        token = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
        return TokenOut(access_token=token)
