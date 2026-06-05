"""
Pydantic Schemas cho Subject (môn học & điểm)
"""
from pydantic import BaseModel, Field
from typing import Optional
from datetime import datetime


class SubjectBase(BaseModel):
    subject_code: Optional[str] = None
    subject_name: str = Field(..., min_length=1, max_length=255)
    credits: int = Field(default=3, ge=0, le=10)
    semester: Optional[str] = None
    school_year: Optional[str] = None
    process_score: Optional[float] = Field(None, ge=0, le=10)
    midterm_score: Optional[float] = Field(None, ge=0, le=10)
    final_score: Optional[float] = Field(None, ge=0, le=10)
    total_score_10: Optional[float] = Field(None, ge=0, le=10)
    process_weight: float = Field(0.4, ge=0.1, le=0.9)
    is_completed: bool = False
    is_predicted: bool = False
    notes: Optional[str] = None


class SubjectCreate(SubjectBase):
    pass


class SubjectUpdate(BaseModel):
    subject_code: Optional[str] = None
    subject_name: Optional[str] = None
    credits: Optional[int] = None
    semester: Optional[str] = None
    school_year: Optional[str] = None
    process_score: Optional[float] = None
    midterm_score: Optional[float] = None
    final_score: Optional[float] = None
    total_score_10: Optional[float] = None
    process_weight: Optional[float] = Field(None, ge=0.1, le=0.9)
    is_completed: Optional[bool] = None
    is_predicted: Optional[bool] = None
    notes: Optional[str] = None


class SubjectResponse(SubjectBase):
    id: int
    user_id: int
    total_score_4: Optional[float] = None
    letter_grade: Optional[str] = None
    is_passed: bool
    created_at: datetime

    class Config:
        from_attributes = True


class GPAStats(BaseModel):
    """Thống kê GPA của sinh viên"""
    gpa_4: float            # GPA hệ 4
    gpa_10: float           # GPA hệ 10
    total_credits: int      # Tổng tín chỉ đã tích lũy
    earned_credits: int     # Tín chỉ đã đạt
    completed_subjects: int
    failed_subjects: int
    classification: str     # Xếp loại: Xuất sắc/Giỏi/Khá/Trung bình/Yếu
    by_semester: list[dict]  # GPA từng học kỳ


class GPAPrediction(BaseModel):
    """Yêu cầu dự báo GPA"""
    predicted_subjects: list[SubjectCreate]


class GPAPredictionResponse(BaseModel):
    current_gpa_4: float
    current_gpa_10: float
    predicted_gpa_4: float
    predicted_gpa_10: float
    predicted_classification: str
    total_credits_after: int


class CurriculumSubjectBase(BaseModel):
    subject_code: str
    subject_name: str
    credits: int
    semester_default: Optional[int] = None
    major: Optional[str] = None
    prerequisites: Optional[str] = None
    description: Optional[str] = None


class CurriculumSubjectCreate(CurriculumSubjectBase):
    pass


class CurriculumSubjectResponse(CurriculumSubjectBase):
    id: int
    class Config:
        from_attributes = True


class AdvancedStudyRecommendation(BaseModel):
    """Đề xuất môn học vượt"""
    can_take: list[CurriculumSubjectResponse]
    cannot_take: list[dict]   # {subject, missing_prerequisites}
    total_available_credits: int
    max_credits_per_semester: int = 24
    recommendation_message: str
