"""
@file: auth.py
@description: Роутер авторизации (регистрация, вход, выход) для FastAPI backend.
@dependencies: fastapi, pydantic, user_service, security
@created: 2024-07-09
"""

from fastapi import APIRouter, Depends, HTTPException, status, Request
from fastapi.security import OAuth2PasswordRequestForm, HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import Optional
from src.backend.models.user import UserCreate, UserRead
from src.backend.services.user_service import create_user, authenticate_user, get_current_user, get_user_by_email
from src.backend.services.security import create_access_token, create_refresh_token, verify_token
from src.backend.db.session import get_db
from src.backend.middleware.rate_limit import get_limiter

router = APIRouter(prefix="/auth", tags=["auth"])
security = HTTPBearer()
limiter = get_limiter()

class TokenResponse(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"

class RefreshTokenRequest(BaseModel):
    refresh_token: str

@router.post("/register", response_model=UserRead)
@limiter.limit("5/minute")
def register(request: Request, user: UserCreate, db: Session = Depends(get_db)):
    """Регистрация нового пользователя"""
    db_user = create_user(db, user)
    return UserRead(
        id=db_user.id,
        email=db_user.email,
        full_name=db_user.full_name,
        is_active=db_user.is_active,
        is_verified=db_user.is_verified,
        created_at=db_user.created_at
    )

@router.post("/login", response_model=TokenResponse)
@limiter.limit("10/minute")
def login(request: Request, form_data: OAuth2PasswordRequestForm = Depends(), db: Session = Depends(get_db)):
    """Вход пользователя"""
    user = authenticate_user(db, form_data.username, form_data.password)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Неверный email или пароль",
            headers={"WWW-Authenticate": "Bearer"},
        )
    access_token = create_access_token(data={"sub": user.email})
    refresh_token = create_refresh_token(data={"sub": user.email})
    return TokenResponse(
        access_token=access_token,
        refresh_token=refresh_token,
        token_type="bearer"
    )

@router.post("/refresh", response_model=TokenResponse)
@limiter.limit("20/minute")
def refresh_token(request: Request, token_request: RefreshTokenRequest, db: Session = Depends(get_db)):
    """Обновление access token с помощью refresh token"""
    payload = verify_token(token_request.refresh_token, token_type="refresh")
    if payload is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Недействительный refresh token",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    email: str = payload.get("sub")
    if email is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Недействительный refresh token",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    user = get_user_by_email(db, email=email)
    if user is None or not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Пользователь не найден или неактивен",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    # Создаем новые токены
    new_access_token = create_access_token(data={"sub": user.email})
    new_refresh_token = create_refresh_token(data={"sub": user.email})
    
    return TokenResponse(
        access_token=new_access_token,
        refresh_token=new_refresh_token,
        token_type="bearer"
    )

@router.post("/logout")
def logout(credentials: HTTPAuthorizationCredentials = Depends(security)):
    """Выход пользователя (инвалидация токена)"""
    # В MVP просто возвращаем успех
    # В production можно добавить blacklist токенов через Redis
    return {"message": "Успешный выход"}

@router.get("/me", response_model=UserRead)
def get_me(current_user = Depends(get_current_user)):
    """Получение информации о текущем пользователе"""
    return UserRead(
        id=current_user.id,
        email=current_user.email,
        full_name=current_user.full_name,
        is_active=current_user.is_active,
        is_verified=current_user.is_verified,
        created_at=current_user.created_at
    ) 