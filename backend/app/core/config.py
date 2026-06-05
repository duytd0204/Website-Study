"""
Cấu hình hệ thống - đọc từ biến môi trường (.env)
"""
from pydantic_settings import BaseSettings
from functools import lru_cache


class Settings(BaseSettings):
    # Bảo mật
    SECRET_KEY: str = "tlu_default_secret_change_me"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 10080  # 7 ngày

    # Database
    DATABASE_URL: str = "sqlite:///./data/tlu.db"

    # AI - Lựa chọn nhà cung cấp cho Chatbot: "groq" hoặc "gemini"
    AI_PROVIDER: str = "gemini"

    # Gemini (dùng cho OCR ảnh + chatbot nếu AI_PROVIDER=gemini)
    GEMINI_API_KEY: str = ""
    GEMINI_MODEL: str = "gemini-2.0-flash"

    # Groq (chỉ cho chatbot - không hỗ trợ OCR ảnh)
    GROQ_API_KEY: str = ""
    GROQ_MODEL: str = "llama-3.3-70b-versatile"

    # SMTP
    SMTP_HOST: str = ""
    SMTP_PORT: int = 587
    SMTP_USER: str = ""
    SMTP_PASSWORD: str = ""
    SMTP_FROM_NAME: str = "TLU Learning Support"

    # Admin mặc định
    DEFAULT_ADMIN_EMAIL: str = "admin@tlu.edu.vn"
    DEFAULT_ADMIN_PASSWORD: str = "Admin@123456"

    # CORS
    CORS_ORIGINS: str = "*"

    # App
    APP_NAME: str = "Hệ thống Quản lý Học tập - Đại học Thủy lợi"
    APP_VERSION: str = "1.0.0"

    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"
        extra = "ignore"


@lru_cache()
def get_settings() -> Settings:
    return Settings()


settings = get_settings()
