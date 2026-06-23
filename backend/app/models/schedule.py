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
    subject_id = Column(
        Integer,
        ForeignKey("subjects.id"),
        nullable=True
    )

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

    # ── Property tiện ích (Encapsulation) ────────────────────────────────────
    @property
    def time_range_str(self) -> str:
        """Hiển thị '07:00 - 09:25' từ start_time/end_time."""
        return f"{self.start_time.strftime('%H:%M')} - {self.end_time.strftime('%H:%M')}"

    @property
    def day_name(self) -> str:
        """Chuyển day_of_week (2-8) thành 'Thứ 2'...'Chủ nhật'."""
        names = {2: "Thứ 2", 3: "Thứ 3", 4: "Thứ 4", 5: "Thứ 5",
                 6: "Thứ 6", 7: "Thứ 7", 8: "Chủ nhật"}
        return names.get(self.day_of_week, "")

    user = relationship(
        "User",
        back_populates="schedules"
    )

    subject = relationship(
        "Subject",
        back_populates="schedules"
    )
