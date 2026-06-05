"""
Tiện ích bảo mật: hash mật khẩu (bcrypt), tạo và xác thực JWT token
"""
from datetime import datetime, timedelta, timezone
from typing import Optional
import bcrypt
from jose import JWTError, jwt
from app.core.config import settings


def hash_password(password: str) -> str:
    """Mã hóa mật khẩu bằng bcrypt"""
    # bcrypt giới hạn 72 bytes, cắt nếu quá dài
    pw_bytes = password.encode("utf-8")[:72]
    salt = bcrypt.gensalt()
    return bcrypt.hashpw(pw_bytes, salt).decode("utf-8")


def verify_password(plain_password: str, hashed_password: str) -> bool:
    """Kiểm tra mật khẩu nhập vào có khớp với hash đã lưu"""
    try:
        pw_bytes = plain_password.encode("utf-8")[:72]
        return bcrypt.checkpw(pw_bytes, hashed_password.encode("utf-8"))
    except Exception:
        return False


def create_access_token(data: dict, expires_delta: Optional[timedelta] = None) -> str:
    """Tạo JWT access token"""
    to_encode = data.copy()
    if expires_delta:
        expire = datetime.now(timezone.utc) + expires_delta
    else:
        expire = datetime.now(timezone.utc) + timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, settings.SECRET_KEY, algorithm=settings.ALGORITHM)
    return encoded_jwt


def decode_access_token(token: str) -> Optional[dict]:
    """Giải mã JWT token, trả về payload nếu hợp lệ, None nếu lỗi"""
    try:
        payload = jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
        return payload
    except JWTError:
        return None


def validate_password_strength(password: str) -> tuple[bool, str]:
    """
    Kiểm tra độ mạnh mật khẩu theo yêu cầu của đồ án:
    Tối thiểu 8 ký tự, bao gồm cả chữ và số
    """
    if len(password) < 8:
        return False, "Mật khẩu phải có ít nhất 8 ký tự"
    has_digit = any(c.isdigit() for c in password)
    has_alpha = any(c.isalpha() for c in password)
    if not (has_digit and has_alpha):
        return False, "Mật khẩu phải bao gồm cả chữ và số"
    return True, ""
