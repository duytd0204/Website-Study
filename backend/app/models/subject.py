"""
Model Subject - Môn học và điểm số của sinh viên.
Dùng để tính GPA hệ 4 và hệ 10.
"""
from sqlalchemy import Column, Integer, String, Float, ForeignKey, DateTime, Boolean, Text
from sqlalchemy.orm import relationship
from datetime import datetime, timezone
from app.core.database import Base


class Subject(Base):
    """
    Một môn học sinh viên đã/đang học.
    Lưu điểm thành phần và điểm tổng kết theo thang điểm 10 và 4.
    """
    __tablename__ = "subjects"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)

    subject_code = Column(String(50), nullable=True)         # Mã môn
    subject_name = Column(String(255), nullable=False)       # Tên môn
    credits = Column(Integer, default=3, nullable=False)     # Số tín chỉ
    semester = Column(String(20), nullable=True)             # Học kỳ (vd: "20241")
    school_year = Column(String(20), nullable=True)          # Năm học (vd: "2024-2025")

    # Điểm thành phần (thang 10)
    process_score = Column(Float, nullable=True)             # Điểm quá trình
    process_weight = Column(Float, default=0.4)              # Hệ số điểm quá trình (0.1-0.9), mặc định 40%
    midterm_score = Column(Float, nullable=True)             # Giữ lại cho dữ liệu cũ
    final_score = Column(Float, nullable=True)               # Điểm thi

    # Điểm tổng kết
    total_score_10 = Column(Float, nullable=True)            # Điểm hệ 10
    total_score_4 = Column(Float, nullable=True)             # Điểm hệ 4
    letter_grade = Column(String(5), nullable=True)          # A+, A, B+, B, C+, C, D+, D, F

    # Trạng thái
    is_completed = Column(Boolean, default=False)            # Đã hoàn thành môn
    is_passed = Column(Boolean, default=False)               # Đã đạt
    is_predicted = Column(Boolean, default=False)            # Là điểm dự kiến hay thực tế

    notes = Column(Text, nullable=True)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    updated_at = Column(DateTime, default=lambda: datetime.now(timezone.utc),
                        onupdate=lambda: datetime.now(timezone.utc))

    user = relationship("User", back_populates="subjects")


class CurriculumSubject(Base):
    """
    Danh sách môn học trong chương trình đào tạo (cho chức năng đề xuất học vượt).
    Quản trị viên cấu hình.
    """
    __tablename__ = "curriculum_subjects"

    id = Column(Integer, primary_key=True, index=True)
    subject_code = Column(String(50), unique=True, nullable=False, index=True)
    subject_name = Column(String(255), nullable=False)
    credits = Column(Integer, nullable=False)
    semester_default = Column(Integer, nullable=True)        # Kỳ học mặc định trong chương trình
    major = Column(String(255), nullable=True)               # Ngành áp dụng
    prerequisites = Column(String(500), nullable=True)       # Mã môn tiên quyết, phân tách bằng dấu phẩy
    is_required = Column(Boolean, default=True)                # Môn bắt buộc hay tự chọn
    description = Column(Text, nullable=True)

    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
