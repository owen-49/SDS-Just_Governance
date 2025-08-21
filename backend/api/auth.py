import os
from datetime import datetime, timedelta

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field
from passlib.context import CryptContext
import jwt

from db.session import SessionLocal
from models.user import User

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
SECRET_KEY = os.getenv("JWT_SECRET", "change_me")
ALGORITHM = "HS256"

router = APIRouter(tags=["auth"])


class RegisterIn(BaseModel):
    email: str = Field(..., description="User email")
    password: str = Field(..., description="Password")


class LoginIn(BaseModel):
    email: str = Field(..., description="User email")
    password: str = Field(..., description="Password")


class TokenOut(BaseModel):
    access_token: str
    token_type: str = "bearer"


@router.post("/register")
def register(payload: RegisterIn):
    with SessionLocal() as db:
        existing = db.query(User).filter(User.email == payload.email).first()
        if existing:
            raise HTTPException(status_code=400, detail="Email already registered")
        hashed = pwd_context.hash(payload.password)
        user = User(email=payload.email, password_hash=hashed)
        db.add(user)
        db.commit()
        db.refresh(user)
        return {"id": user.id, "email": user.email}


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