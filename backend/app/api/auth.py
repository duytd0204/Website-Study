"""
API Xác thực: Đăng ký, Đăng nhập, Quên mật khẩu, Đăng xuất
"""
import random
import string
from datetime import datetime, timedelta, timezone
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.core.security import (
    hash_password, verify_password, create_access_token, validate_password_strength
)
from app.models.user import User, UserRole, PasswordReset
from app.schemas.user import (
    UserRegister, UserLogin, Token, UserResponse,
    ForgotPasswordRequest, ResetPasswordRequest, PasswordChange
)
from app.services.email_service import send_otp_email
from app.api.deps import get_current_user

router = APIRouter(prefix="/auth", tags=["Xác thực"])


@router.post("/register", response_model=UserResponse, status_code=status.HTTP_201_CREATED)
def register(data: UserRegister, db: Session = Depends(get_db)):
    """
    Use Case 3.1: Đăng ký tài khoản sinh viên.
    Kiểm tra email không trùng, mật khẩu đạt yêu cầu.
    """
    # Kiểm tra mật khẩu mạnh
    valid, msg = validate_password_strength(data.password)
    if not valid:
        raise HTTPException(status_code=400, detail=msg)

    # Kiểm tra email tồn tại
    existing = db.query(User).filter(User.email == data.email).first()
    if existing:
        raise HTTPException(status_code=400, detail="Email này đã được đăng ký trong hệ thống")

    user = User(
        email=data.email,
        hashed_password=hash_password(data.password),
        full_name=data.full_name,
        course=data.course,
        class_name=data.class_name,
        major=data.major,
        student_code=data.student_code,
        phone=data.phone,
        role=UserRole.STUDENT,
        is_active=True,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


@router.post("/login", response_model=Token)
def login(data: UserLogin, db: Session = Depends(get_db)):
    """Use Case 3.2: Đăng nhập"""
    user = db.query(User).filter(User.email == data.email).first()

    if not user or not verify_password(data.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Tên đăng nhập hoặc mật khẩu không chính xác"
        )

    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Tài khoản đang bị Quản trị viên khóa. Vui lòng liên hệ Admin để được hỗ trợ."
        )

    access_token = create_access_token(data={"sub": str(user.id), "role": user.role.value})
    return Token(access_token=access_token, user=user)


@router.post("/forgot-password")
def forgot_password(data: ForgotPasswordRequest, db: Session = Depends(get_db)):
    """Use Case 3.3: Quên mật khẩu - gửi OTP qua email"""
    user = db.query(User).filter(User.email == data.email).first()
    if not user:
        raise HTTPException(status_code=404, detail="Email không tồn tại trên hệ thống")

    # Tạo OTP 6 chữ số
    otp_code = "".join(random.choices(string.digits, k=6))
    expires_at = datetime.now(timezone.utc) + timedelta(minutes=15)

    # Vô hiệu hóa các OTP cũ
    db.query(PasswordReset).filter(
        PasswordReset.email == data.email,
        PasswordReset.used == False
    ).update({"used": True})

    reset = PasswordReset(
        email=data.email,
        otp_code=otp_code,
        expires_at=expires_at,
    )
    db.add(reset)
    db.commit()

    # Gửi email
    success = send_otp_email(data.email, otp_code, user.full_name)
    if not success:
        raise HTTPException(
            status_code=500,
            detail="Gửi mail thất bại, vui lòng thử lại sau ít phút"
        )

    return {"message": "Mã xác thực đã được gửi tới email của bạn"}


@router.post("/reset-password")
def reset_password(data: ResetPasswordRequest, db: Session = Depends(get_db)):
    """Use Case 3.3 (tiếp): Xác nhận OTP và đặt mật khẩu mới"""
    # Kiểm tra mật khẩu mạnh
    valid, msg = validate_password_strength(data.new_password)
    if not valid:
        raise HTTPException(status_code=400, detail=msg)

    # Tìm OTP
    reset = db.query(PasswordReset).filter(
        PasswordReset.email == data.email,
        PasswordReset.otp_code == data.otp_code,
        PasswordReset.used == False
    ).order_by(PasswordReset.created_at.desc()).first()

    if not reset:
        raise HTTPException(status_code=400, detail="Mã xác thực không hợp lệ")

    # Đảm bảo expires_at là timezone-aware
    expires = reset.expires_at
    if expires.tzinfo is None:
        expires = expires.replace(tzinfo=timezone.utc)

    if expires < datetime.now(timezone.utc):
        raise HTTPException(status_code=400, detail="Mã xác thực đã hết hạn")

    # Cập nhật mật khẩu
    user = db.query(User).filter(User.email == data.email).first()
    if not user:
        raise HTTPException(status_code=404, detail="Email không tồn tại")

    user.hashed_password = hash_password(data.new_password)
    reset.used = True
    db.commit()

    return {"message": "Đổi mật khẩu thành công"}


@router.post("/change-password")
def change_password(
    data: PasswordChange,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Đổi mật khẩu khi đã đăng nhập"""
    if not verify_password(data.old_password, current_user.hashed_password):
        raise HTTPException(status_code=400, detail="Mật khẩu cũ không chính xác")

    valid, msg = validate_password_strength(data.new_password)
    if not valid:
        raise HTTPException(status_code=400, detail=msg)

    current_user.hashed_password = hash_password(data.new_password)
    db.commit()
    return {"message": "Đổi mật khẩu thành công"}


@router.post("/logout")
def logout(current_user: User = Depends(get_current_user)):
    """
    Use Case 3.4: Đăng xuất.
    JWT là stateless nên việc đăng xuất chủ yếu được xử lý ở client (xóa token).
    Endpoint này cung cấp để client có thể gọi và xác nhận.
    """
    return {"message": "Đăng xuất thành công"}


@router.get("/me", response_model=UserResponse)
def get_me(current_user: User = Depends(get_current_user)):
    """Lấy thông tin user hiện tại"""
    return current_user
