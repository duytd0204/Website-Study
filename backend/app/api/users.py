"""
API Quản lý thông tin cá nhân (Profile)
"""
import os
import uuid
from pathlib import Path
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.models.user import User
from app.schemas.user import UserUpdate, UserResponse
from app.api.deps import get_current_user

router = APIRouter(prefix="/users", tags=["Người dùng"])

# Đường dẫn lưu avatar
AVATAR_DIR = Path("data/avatars")
AVATAR_DIR.mkdir(parents=True, exist_ok=True)

ALLOWED_IMAGE_TYPES = {"image/jpeg", "image/jpg", "image/png", "image/webp"}
MAX_AVATAR_SIZE = 5 * 1024 * 1024  # 5 MB


@router.get("/me", response_model=UserResponse)
def get_profile(current_user: User = Depends(get_current_user)):
    """Xem thông tin cá nhân"""
    return current_user


@router.put("/me", response_model=UserResponse)
def update_profile(
    data: UserUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Use Case 3.7: Cập nhật thông tin cá nhân (Full name, Khóa, Lớp, Ngành, Mã SV, ...)
    """
    update_data = data.model_dump(exclude_unset=True)

    # Validate: các trường bắt buộc không được rỗng
    if "full_name" in update_data and not update_data["full_name"].strip():
        raise HTTPException(status_code=400, detail="Họ tên không được để trống")

    for key, value in update_data.items():
        setattr(current_user, key, value)

    db.commit()
    db.refresh(current_user)
    return current_user


@router.post("/me/avatar", response_model=UserResponse)
async def upload_avatar(
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Tải lên ảnh đại diện"""
    if file.content_type not in ALLOWED_IMAGE_TYPES:
        raise HTTPException(
            status_code=400,
            detail="File ảnh không hợp lệ. Chỉ chấp nhận JPG, PNG, WebP."
        )

    contents = await file.read()
    if len(contents) > MAX_AVATAR_SIZE:
        raise HTTPException(
            status_code=400,
            detail=f"File ảnh vượt quá dung lượng cho phép ({MAX_AVATAR_SIZE // 1024 // 1024}MB)"
        )

    # Tạo tên file unique
    ext = file.filename.split(".")[-1].lower() if "." in file.filename else "jpg"
    filename = f"{current_user.id}_{uuid.uuid4().hex[:8]}.{ext}"
    filepath = AVATAR_DIR / filename

    with open(filepath, "wb") as f:
        f.write(contents)

    # Xóa avatar cũ
    if current_user.avatar_url:
        old_filename = current_user.avatar_url.split("/")[-1]
        old_path = AVATAR_DIR / old_filename
        if old_path.exists() and old_path != filepath:
            try:
                old_path.unlink()
            except Exception:
                pass

    current_user.avatar_url = f"/api/users/avatar/{filename}"
    db.commit()
    db.refresh(current_user)
    return current_user
