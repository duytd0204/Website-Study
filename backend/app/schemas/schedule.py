"""
Pydantic Schemas cho Schedule
"""
from pydantic import BaseModel, Field
from typing import Optional
from datetime import time, datetime


class ScheduleBase(BaseModel):
    subject_name: str = Field(..., min_length=1, max_length=255)
    subject_code: Optional[str] = None
    teacher: Optional[str] = None
    room: Optional[str] = None
    day_of_week: int = Field(..., ge=2, le=8, description="2=Thứ 2, 8=Chủ nhật")
    start_time: time
    end_time: time
    weeks: Optional[str] = None
    note: Optional[str] = None
    color: Optional[str] = "#003F87"
    reminder_minutes: Optional[int] = 30


class ScheduleCreate(ScheduleBase):
    pass


class ScheduleUpdate(BaseModel):
    subject_name: Optional[str] = None
    subject_code: Optional[str] = None
    teacher: Optional[str] = None
    room: Optional[str] = None
    day_of_week: Optional[int] = None
    start_time: Optional[time] = None
    end_time: Optional[time] = None
    weeks: Optional[str] = None
    note: Optional[str] = None
    color: Optional[str] = None
    reminder_minutes: Optional[int] = None


class ScheduleResponse(ScheduleBase):
    id: int
    user_id: int
    created_at: datetime

    class Config:
        from_attributes = True


class ScheduleBulkCreate(BaseModel):
    """Tạo nhiều lịch học cùng lúc - dùng sau khi OCR ảnh thời khóa biểu"""
    schedules: list[ScheduleCreate]
