"""
Pydantic Schemas cho User - validation đầu vào, định dạng đầu ra
"""
from pydantic import BaseModel, EmailStr, Field, field_validator
from typing import Optional
from datetime import datetime
from app.models.user import UserRole


class UserBase(BaseModel):
    email: EmailStr
    full_name: str = Field(..., min_length=2, max_length=255)
    course: Optional[str] = None
    class_name: Optional[str] = None
    major: Optional[str] = None
    student_code: Optional[str] = None
    phone: Optional[str] = None


class UserRegister(UserBase):
    password: str = Field(..., min_length=8, max_length=100)
    confirm_password: str
    agree_terms: bool = Field(..., description="Đồng ý điều khoản sử dụng")

    @field_validator("agree_terms")
    @classmethod
    def must_agree_terms(cls, v):
        if not v:
            raise ValueError("Bạn phải đồng ý với điều khoản sử dụng")
        return v

    @field_validator("confirm_password")
    @classmethod
    def passwords_match(cls, v, info):
        if "password" in info.data and v != info.data["password"]:
            raise ValueError("Mật khẩu xác nhận không khớp")
        return v


class UserLogin(BaseModel):
    email: EmailStr
    password: str


class UserUpdate(BaseModel):
    full_name: Optional[str] = None
    course: Optional[str] = None
    class_name: Optional[str] = None
    major: Optional[str] = None
    student_code: Optional[str] = None
    phone: Optional[str] = None
    avatar_url: Optional[str] = None


class PasswordChange(BaseModel):
    old_password: str
    new_password: str = Field(..., min_length=8)


class ForgotPasswordRequest(BaseModel):
    email: EmailStr


class ResetPasswordRequest(BaseModel):
    email: EmailStr
    otp_code: str = Field(..., min_length=4, max_length=10)
    new_password: str = Field(..., min_length=8)


class UserResponse(UserBase):
    id: int
    role: UserRole
    is_active: bool
    avatar_url: Optional[str] = None
    created_at: datetime

    class Config:
        from_attributes = True


class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserResponse


class UserListResponse(BaseModel):
    """Response cho admin xem danh sách người dùng"""
    items: list[UserResponse]
    total: int
    page: int
    page_size: int


class AdminUpdateUser(BaseModel):
    """Admin cập nhật trạng thái/quyền của user"""
    is_active: Optional[bool] = None
    role: Optional[UserRole] = None
