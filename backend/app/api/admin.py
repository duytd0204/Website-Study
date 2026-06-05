"""
API dành cho Quản trị viên (Admin)
Use Case 3.13-3.15: Quản lý người dùng, Khóa/Mở khóa, Đặt lại mật khẩu, Phân quyền
"""
import random
import string
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from sqlalchemy import or_, func
from app.core.database import get_db
from app.core.security import hash_password
from app.models.user import User, UserRole
from app.models.subject import CurriculumSubject
from app.schemas.user import UserResponse, UserListResponse, AdminUpdateUser
from app.schemas.subject import CurriculumSubjectCreate, CurriculumSubjectResponse
from app.api.deps import get_current_admin

router = APIRouter(prefix="/admin", tags=["Quản trị viên"])


@router.get("/users", response_model=UserListResponse)
def list_users(
    search: str = Query(None, description="Tìm theo email hoặc họ tên"),
    role: UserRole = Query(None),
    is_active: bool = Query(None),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    current_admin: User = Depends(get_current_admin),
    db: Session = Depends(get_db),
):
    """Use Case 3.13: Quản lý người dùng - xem danh sách & tìm kiếm"""
    query = db.query(User)

    if search:
        kw = f"%{search}%"
        query = query.filter(or_(
            User.email.ilike(kw),
            User.full_name.ilike(kw),
            User.student_code.ilike(kw),
        ))
    if role is not None:
        query = query.filter(User.role == role)
    if is_active is not None:
        query = query.filter(User.is_active == is_active)

    total = query.count()
    items = query.order_by(User.created_at.desc()).offset((page - 1) * page_size).limit(page_size).all()

    return UserListResponse(
        items=items,
        total=total,
        page=page,
        page_size=page_size,
    )


@router.get("/users/{user_id}", response_model=UserResponse)
def get_user_detail(
    user_id: int,
    current_admin: User = Depends(get_current_admin),
    db: Session = Depends(get_db),
):
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="Không tìm thấy người dùng")
    return user


@router.put("/users/{user_id}", response_model=UserResponse)
def admin_update_user(
    user_id: int,
    data: AdminUpdateUser,
    current_admin: User = Depends(get_current_admin),
    db: Session = Depends(get_db),
):
    """
    Use Case 3.14: Khóa/Mở khóa tài khoản và Phân quyền người dùng.
    Quản trị viên không thể tự khóa/đổi quyền chính mình.
    """
    if user_id == current_admin.id:
        raise HTTPException(
            status_code=400,
            detail="Không thể tự thay đổi quyền hạn hoặc khóa tài khoản đang đăng nhập hiện tại"
        )

    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="Không tìm thấy người dùng")

    update_data = data.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(user, key, value)

    db.commit()
    db.refresh(user)
    return user


@router.post("/users/{user_id}/reset-password")
def admin_reset_password(
    user_id: int,
    current_admin: User = Depends(get_current_admin),
    db: Session = Depends(get_db),
):
    """Use Case 3.15: Đặt lại mật khẩu tạm thời cho sinh viên"""
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="Không tìm thấy người dùng")

    # Sinh mật khẩu tạm thời ngẫu nhiên (10 ký tự, gồm chữ và số)
    chars = string.ascii_letters + string.digits
    temp_password = "".join(random.choices(chars, k=10))
    # Đảm bảo có ít nhất 1 chữ và 1 số
    if not any(c.isdigit() for c in temp_password):
        temp_password = temp_password[:-1] + "1"
    if not any(c.isalpha() for c in temp_password):
        temp_password = temp_password[:-1] + "A"

    user.hashed_password = hash_password(temp_password)
    db.commit()

    return {
        "message": "Đặt lại mật khẩu thành công",
        "temporary_password": temp_password,
        "user_email": user.email,
        "note": "Vui lòng gửi mật khẩu tạm thời này cho sinh viên qua kênh liên lạc an toàn."
    }


@router.delete("/users/{user_id}", status_code=204)
def admin_delete_user(
    user_id: int,
    current_admin: User = Depends(get_current_admin),
    db: Session = Depends(get_db),
):
    """Xóa hẳn tài khoản người dùng"""
    if user_id == current_admin.id:
        raise HTTPException(status_code=400, detail="Không thể tự xóa tài khoản của chính mình")
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="Không tìm thấy người dùng")
    db.delete(user)
    db.commit()


@router.get("/stats")
def admin_stats(
    current_admin: User = Depends(get_current_admin),
    db: Session = Depends(get_db),
):
    """Thống kê tổng quan dành cho Admin Dashboard"""
    from app.models.schedule import Schedule
    from app.models.subject import Subject
    from app.models.note import Note
    from app.models.chat import ChatMessage

    total_users = db.query(User).count()
    active_users = db.query(User).filter(User.is_active == True).count()
    locked_users = db.query(User).filter(User.is_active == False).count()
    student_count = db.query(User).filter(User.role == UserRole.STUDENT).count()
    admin_count = db.query(User).filter(User.role == UserRole.ADMIN).count()

    total_schedules = db.query(Schedule).count()
    total_subjects = db.query(Subject).count()
    total_notes = db.query(Note).count()
    total_chats = db.query(ChatMessage).count()

    # Đăng ký mới trong 7 ngày qua
    from datetime import datetime, timedelta, timezone
    seven_days_ago = datetime.now(timezone.utc) - timedelta(days=7)
    new_users_7d = db.query(User).filter(User.created_at >= seven_days_ago).count()

    return {
        "total_users": total_users,
        "active_users": active_users,
        "locked_users": locked_users,
        "student_count": student_count,
        "admin_count": admin_count,
        "new_users_7d": new_users_7d,
        "total_schedules": total_schedules,
        "total_subjects": total_subjects,
        "total_notes": total_notes,
        "total_chats": total_chats,
    }


# ============ QUẢN LÝ CHƯƠNG TRÌNH ĐÀO TẠO ============

@router.get("/curriculum", response_model=list[CurriculumSubjectResponse])
def list_curriculum(
    current_admin: User = Depends(get_current_admin),
    db: Session = Depends(get_db),
):
    """Xem chương trình đào tạo"""
    return db.query(CurriculumSubject).order_by(
        CurriculumSubject.semester_default.nulls_last(),
        CurriculumSubject.subject_code,
    ).all()


@router.post("/curriculum", response_model=CurriculumSubjectResponse, status_code=201)
def create_curriculum(
    data: CurriculumSubjectCreate,
    current_admin: User = Depends(get_current_admin),
    db: Session = Depends(get_db),
):
    """Thêm môn vào chương trình đào tạo"""
    existing = db.query(CurriculumSubject).filter(
        CurriculumSubject.subject_code == data.subject_code
    ).first()
    if existing:
        raise HTTPException(status_code=400, detail="Mã môn đã tồn tại")

    item = CurriculumSubject(**data.model_dump())
    db.add(item)
    db.commit()
    db.refresh(item)
    return item


@router.put("/curriculum/{item_id}", response_model=CurriculumSubjectResponse)
def update_curriculum(
    item_id: int,
    data: CurriculumSubjectCreate,
    current_admin: User = Depends(get_current_admin),
    db: Session = Depends(get_db),
):
    item = db.query(CurriculumSubject).filter(CurriculumSubject.id == item_id).first()
    if not item:
        raise HTTPException(status_code=404, detail="Không tìm thấy môn học")
    for key, value in data.model_dump().items():
        setattr(item, key, value)
    db.commit()
    db.refresh(item)
    return item


@router.delete("/curriculum/{item_id}", status_code=204)
def delete_curriculum(
    item_id: int,
    current_admin: User = Depends(get_current_admin),
    db: Session = Depends(get_db),
):
    item = db.query(CurriculumSubject).filter(CurriculumSubject.id == item_id).first()
    if not item:
        raise HTTPException(status_code=404, detail="Không tìm thấy môn học")
    db.delete(item)
    db.commit()
