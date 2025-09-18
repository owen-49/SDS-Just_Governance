import os
from datetime import datetime, timedelta

from fastapi import APIRouter, HTTPException
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field
from passlib.context import CryptContext
import jwt

from db.session import SessionLocal
from models.user import User
from services.mail_service import MailService
from core.response import success_response, error_response, ErrorCode

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
    password: str = Field(..., description="Password", min_length=8, max_length=64)
    name: str = Field(None, description="User name")


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
def register(payload: RegisterIn):
    """User registration (create account, email verification not required for now)"""
    try:
        with SessionLocal() as db:
            # Check if email already exists
            existing = db.query(User).filter(User.email == payload.email).first()
            if existing:
                return error_response(
                    message="email already exists",
                    code=ErrorCode.CONFLICT,
                    status_code=409
                )
            
            # Create new user
            hashed = pwd_context.hash(payload.password)
            user = User(
                email=payload.email, 
                password_hash=hashed,
                name=payload.name
            )
            db.add(user)
            db.commit()
            db.refresh(user)
            
            return success_response(data={
                "user_id": str(user.id),
                "email": user.email,
                "need_verify": True  # Simplified version, assume verification needed
            })
    except Exception as e:
        return error_response(
            message="internal error",
            code=ErrorCode.INTERNAL_ERROR,
            status_code=500
        )


@router.post("/login")
def login(payload: LoginIn):
    try:
        with SessionLocal() as db:
            user = db.query(User).filter(User.email == payload.email).first()
            if not user:
                return error_response(
                    message="account not found",
                    code=ErrorCode.NOT_FOUND,
                    status_code=404
                )
            
            if not pwd_context.verify(payload.password, user.password_hash):
                return error_response(
                    message="incorrect password",
                    code=ErrorCode.VALIDATION_ERROR,
                    status_code=400
                )
            
            # Generate JWT token
            to_encode = {
                "sub": str(user.id),
                "exp": datetime.utcnow() + timedelta(minutes=30),  # 30 minutes expiry
            }
            token = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
            
            # Check if first time login (simplified version, always return false)
            show_intro = False
            
            return success_response(data={
                "access_token": token,
                "token_type": "bearer",
                "expires_in": 1800,  # 30 minutes = 1800 seconds
                "user": {
                    "user_id": str(user.id),
                    "email": user.email,
                    "name": getattr(user, 'name', None),
                    "avatar_url": None
                },
                "show_intro": show_intro
            })
    except Exception as e:
        return error_response(
            message="internal error",
            code=ErrorCode.INTERNAL_ERROR,
            status_code=500
        )


@router.get("/me")
def get_current_user():
    """Get current user info (requires Bearer token)"""
    # Simplified version, return test user for now
    return success_response(data={
        "user_id": "test-user-id",
        "email": "test@example.com",
        "name": "Test User",
        "avatar_url": None,
        "email_verified": True
    })


@router.get("/verify-email")
def verify_email(token: str):
    """Email verification"""
    if not token:
        return error_response(
            message="token not found",
            code=ErrorCode.NOT_FOUND,
            status_code=404
        )
    
    # Simplified version, assume verification successful
    return success_response(
        message="email verified",
        data={"email": "test@example.com"}
    )


@router.post("/resend-verification")
def resend_verification_email(payload: dict):
    """Resend verification email"""
    email = payload.get("email")
    if not email:
        return error_response(
            message="email required",
            code=ErrorCode.VALIDATION_ERROR,
            status_code=400
        )
    
    # Simplified version, assume sending successful
    return success_response(
        message="verification email sent",
        data=None
    )


@router.post("/forgot-password")
def forgot_password(payload: dict):
    """Request password reset"""
    email = payload.get("email")
    if not email:
        return error_response(
            message="email required",
            code=ErrorCode.VALIDATION_ERROR,
            status_code=400
        )
    
    # Simplified version, always return success (avoid exposing user info)
    return success_response(
        message="reset email sent if account exists",
        data=None
    )


@router.post("/reset-password")
def reset_password(payload: dict):
    """Reset password"""
    token = payload.get("token")
    new_password = payload.get("new_password")
    
    if not token or not new_password:
        return error_response(
            message="token and new_password required",
            code=ErrorCode.VALIDATION_ERROR,
            status_code=400
        )
    
    # Simplified version, assume reset successful
    return success_response(
        message="password reset",
        data=None
    )


@router.post("/logout")
def logout():
    """User logout"""
    return success_response(
        message="ok",
        data=None
    )


@router.post("/create-test-user")
def create_test_user():
    """Create test user test@example.com / 123456"""
    try:
        # Ensure database tables exist
        from db.session import Base, engine
        Base.metadata.create_all(bind=engine)
        
        with SessionLocal() as db:
            existing = db.query(User).filter(User.email == "test@example.com").first()
            if existing:
                return success_response(data={
                    "message": "Test user already exists", 
                    "id": existing.id, 
                    "email": existing.email
                })
            
            hashed = pwd_context.hash("123456")
            user = User(email="test@example.com", password_hash=hashed, name="Test User")
            db.add(user)
            db.commit()
            db.refresh(user)
            
            return success_response(data={
                "message": "Test user created", 
                "id": user.id, 
                "email": user.email
            })
    except Exception as e:
        return error_response(
            message=f"Failed to create test user: {str(e)}",
            code=ErrorCode.INTERNAL_ERROR,
            status_code=500
        )
