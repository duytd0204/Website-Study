"""
Pydantic Schemas cho ChatBot AI và OCR
"""
from pydantic import BaseModel, Field
from typing import Optional, Literal
from datetime import datetime


class ChatRequest(BaseModel):
    message: str = Field(..., min_length=1, max_length=4000)
    session_id: Optional[str] = None


class ChatMessageResponse(BaseModel):
    id: int
    role: str
    content: str
    created_at: datetime

    class Config:
        from_attributes = True


class ChatResponse(BaseModel):
    session_id: str
    reply: str
    suggestions: list[str] = []


class OCRRequest(BaseModel):
    """Yêu cầu OCR/trích xuất dữ liệu từ ảnh"""
    image_type: Literal["schedule", "transcript"]   # Lịch học hay bảng điểm


class OCRScheduleItem(BaseModel):
    subject_name: str
    subject_code: Optional[str] = None
    teacher: Optional[str] = None
    room: Optional[str] = None
    day_of_week: int
    start_time: str  # HH:MM
    end_time: str
    weeks: Optional[str] = None


class OCRTranscriptItem(BaseModel):
    subject_code: Optional[str] = None
    subject_name: str
    credits: int
    total_score_10: Optional[float] = None
    semester: Optional[str] = None


class OCRResponse(BaseModel):
    success: bool
    image_type: str
    items: list[dict]
    message: str = ""
