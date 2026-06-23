"""
Model User - Sinh viên & Quản trị viên
"""
from sqlalchemy import Column, Integer, String, DateTime, Boolean, Enum as SQLEnum
from sqlalchemy.orm import relationship
from sqlalchemy import ForeignKey
from datetime import datetime, timezone
import enum
from app.core.database import Base


class UserRole(str, enum.Enum):
    STUDENT = "student"     # Sinh viên
    ADMIN = "admin"         # Quản trị viên


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    email = Column(String(255), unique=True, index=True, nullable=False)
    hashed_password = Column(String(255), nullable=False)
    full_name = Column(String(255), nullable=False)

    # Thông tin sinh viên
    student_code = Column(String(50), nullable=True)   # Mã sinh viên
    course = Column(String(50), nullable=True)         # Khóa (vd: K65, K66)
    class_name = Column(String(50), nullable=True)     # Lớp (vd: 65CNTT01)
    major = Column(String(255), nullable=True)         # Ngành (vd: Công nghệ thông tin)
    avatar_url = Column(String(500), nullable=True)    # URL ảnh đại diện
    phone = Column(String(20), nullable=True)

    # Quyền và trạng thái
    role = Column(SQLEnum(UserRole), default=UserRole.STUDENT, nullable=False)
    is_active = Column(Boolean, default=True, nullable=False)   # False = bị khóa

    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    updated_at = Column(DateTime, default=lambda: datetime.now(timezone.utc),
                        onupdate=lambda: datetime.now(timezone.utc))

    # Quan hệ
    # ── Property (Encapsulation: gói logic kiểm tra quyền ngay trong model) ──
    @property
    def is_admin(self) -> bool:
        """True nếu user có quyền quản trị viên."""
        return self.role == UserRole.ADMIN

    @property
    def is_student(self) -> bool:
        """True nếu user là sinh viên."""
        return self.role == UserRole.STUDENT

    @property
    def display_label(self) -> str:
        """Nhãn hiển thị gọn: 'Họ tên (Lớp)' hoặc chỉ 'Họ tên'."""
        return f"{self.full_name} ({self.class_name})" if self.class_name else self.full_name

    schedules = relationship(
        "Schedule",
        back_populates="user",
        cascade="all, delete-orphan"
    )

    subjects = relationship(
        "Subject",
        back_populates="user",
        cascade="all, delete-orphan"
    )

    notes = relationship(
        "Note",
        back_populates="user",
        cascade="all, delete-orphan"
    )

    study_plan_items = relationship(
        "StudyPlanItem",
        back_populates="user",
        cascade="all, delete-orphan"
    )

    password_resets = relationship(
        "PasswordReset",
        back_populates="user",
        cascade="all, delete-orphan"
    )
    
    chat_messages = relationship(
        "ChatMessage",
        back_populates="user",
        cascade="all, delete-orphan"
    )


class PasswordReset(Base):
    __tablename__ = "password_resets"

    id = Column(Integer, primary_key=True)

    user_id = Column(
        Integer,
        ForeignKey("users.id"),
        nullable=False
    )

    otp_code = Column(String(10), nullable=False)
    expires_at = Column(DateTime, nullable=False)
    used = Column(Boolean, default=False)

    created_at = Column(
        DateTime,
        default=lambda: datetime.now(timezone.utc)
    )

    user = relationship(
        "User",
        back_populates="password_resets"
    )
