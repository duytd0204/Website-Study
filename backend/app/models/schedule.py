"""
Model Schedule - Lịch học của sinh viên
"""
from sqlalchemy import Column, Integer, String, Time, ForeignKey, DateTime, Text
from sqlalchemy.orm import relationship
from datetime import datetime, timezone
from app.core.database import Base


class Schedule(Base):
    """
    Lịch học của sinh viên.
    Một bản ghi = một tiết/buổi học trong tuần.
    """
    __tablename__ = "schedules"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)

    subject_name = Column(String(255), nullable=False)   # Tên môn học
    subject_code = Column(String(50), nullable=True)     # Mã môn (vd: CSE401)
    teacher = Column(String(255), nullable=True)         # Tên giảng viên
    room = Column(String(100), nullable=True)            # Phòng học
    day_of_week = Column(Integer, nullable=False)        # 2-7=T2-T7, 8=CN
    start_time = Column(Time, nullable=False)            # Giờ bắt đầu
    end_time = Column(Time, nullable=False)              # Giờ kết thúc
    weeks = Column(String(255), nullable=True)           # Tuần học (vd: "1-15", "1,3,5")
    note = Column(Text, nullable=True)                   # Ghi chú thêm
    color = Column(String(20), default="#003F87")        # Màu hiển thị trên lịch

    # Cài đặt nhắc nhở
    reminder_minutes = Column(Integer, default=30)       # Nhắc trước X phút

    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    updated_at = Column(DateTime, default=lambda: datetime.now(timezone.utc),
                        onupdate=lambda: datetime.now(timezone.utc))

    user = relationship("User", back_populates="schedules")
