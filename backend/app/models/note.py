"""
Model Note - Ghi chú của sinh viên
"""
from sqlalchemy import Column, Integer, String, Text, ForeignKey, DateTime, Boolean
from sqlalchemy.orm import relationship
from datetime import datetime, timezone
from app.core.database import Base


class Note(Base):
    __tablename__ = "notes"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)

    title = Column(String(255), nullable=False)
    content = Column(Text, nullable=False)
    tag = Column(String(100), nullable=True)            # Tag/nhãn (vd: "Bài tập", "Quan trọng")
    color = Column(String(20), default="#FFF9C4")       # Màu nền ghi chú
    is_pinned = Column(Boolean, default=False)          # Ghim ghi chú
    related_subject = Column(String(255), nullable=True)  # Môn học liên quan

    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    updated_at = Column(DateTime, default=lambda: datetime.now(timezone.utc),
                        onupdate=lambda: datetime.now(timezone.utc))

    user = relationship("User", back_populates="notes")
