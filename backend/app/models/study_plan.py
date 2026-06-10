"""Model lưu lộ trình học vượt của sinh viên"""
import datetime
from sqlalchemy import Column, Integer, String, ForeignKey, DateTime
from app.core.database import Base


class StudyPlanItem(Base):
    __tablename__ = "study_plan_items"

    id            = Column(Integer, primary_key=True, index=True)
    user_id       = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    subject_code  = Column(String(50), nullable=False)
    subject_name  = Column(String(200), nullable=False)
    credits       = Column(Integer, default=3)
    semester_target = Column(Integer, nullable=True)      # Kỳ dự định học vượt
    created_at    = Column(DateTime(timezone=True),
                           default=lambda: datetime.datetime.now(datetime.timezone.utc))
