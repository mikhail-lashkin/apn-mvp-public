"""
@file: rate_limit.py
@description: Middleware для rate limiting запросов
@dependencies: slowapi
@created: 2025-01-30
"""

from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded
from fastapi import Request

# Создаем глобальный limiter
limiter = Limiter(key_func=get_remote_address)

def setup_rate_limiting(app):
    """Настройка rate limiting для приложения"""
    app.state.limiter = limiter
    app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)
    return app

def get_limiter():
    """Получение limiter для использования в роутерах"""
    return limiter
