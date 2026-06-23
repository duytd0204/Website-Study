"""
API Quản lý Điểm và GPA (Subjects) - Controller layer (OOP).

Kiến trúc 3 lớp:
    Controller (route ở đây) → Service (gpa_service / curriculum_service) → Model (ORM)

Toàn bộ logic tính toán được giao cho instance gpa_service / curriculum_service;
route chỉ điều phối request/response, không tự tính nghiệp vụ.
"""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.models.user import User
from app.models.subject import Subject, CurriculumSubject
from app.schemas.subject import (
    SubjectCreate, SubjectUpdate, SubjectResponse,
    GPAStats, GPAPrediction, GPAPredictionResponse,
    CurriculumSubjectResponse,
)
from app.api.deps import get_current_user
from app.services.gpa_service import gpa_service
from app.services.curriculum_service import curriculum_service

router = APIRouter(prefix="/subjects", tags=["Điểm số & GPA"])


@router.get("/", response_model=list[SubjectResponse])
def list_subjects(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Lấy danh sách môn học của sinh viên"""
    return db.query(Subject).filter(
        Subject.user_id == current_user.id
    ).order_by(Subject.semester.desc().nulls_last(), Subject.subject_name).all()


@router.post("/", response_model=SubjectResponse, status_code=201)
def create_subject(
    data: SubjectCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Thêm môn học mới"""
    subject = Subject(**data.model_dump(), user_id=current_user.id)
    gpa_service.apply_grade(subject)        # ← gọi method của instance GPAService
    db.add(subject)
    db.commit()
    db.refresh(subject)
    return subject


@router.post("/bulk", response_model=list[SubjectResponse], status_code=201)
def create_bulk_subjects(
    items: list[SubjectCreate],
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Tạo nhiều môn cùng lúc (dùng sau khi OCR bảng điểm)"""
    created = []
    for d in items:
        subject = Subject(**d.model_dump(), user_id=current_user.id)
        gpa_service.apply_grade(subject)
        db.add(subject)
        created.append(subject)
    db.commit()
    for s in created:
        db.refresh(s)
    return created


@router.get("/gpa", response_model=GPAStats)
def get_gpa(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Lấy thống kê GPA của sinh viên"""
    subjects = db.query(Subject).filter(Subject.user_id == current_user.id).all()
    stats = gpa_service.calculate_gpa(subjects)
    stats["by_semester"] = gpa_service.calculate_gpa_by_semester(subjects)
    return stats


@router.post("/gpa/predict", response_model=GPAPredictionResponse)
def predict_gpa(
    data: GPAPrediction,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Dự đoán GPA dựa trên các môn dự kiến"""
    current_subjects = db.query(Subject).filter(
        Subject.user_id == current_user.id,
        Subject.is_predicted == False,
        Subject.total_score_10.isnot(None),
    ).all()

    predicted_data = [
        {"credits": d["credits"], "total_score_10": d.get("total_score_10")}
        for d in (p.model_dump() for p in data.predicted_subjects)
    ]
    return gpa_service.predict_gpa(current_subjects, predicted_data)


@router.get("/{subject_id}", response_model=SubjectResponse)
def get_subject(
    subject_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    subject = db.query(Subject).filter(
        Subject.id == subject_id, Subject.user_id == current_user.id
    ).first()
    if not subject:
        raise HTTPException(status_code=404, detail="Không tìm thấy môn học")
    return subject


@router.put("/{subject_id}", response_model=SubjectResponse)
def update_subject(
    subject_id: int,
    data: SubjectUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    subject = db.query(Subject).filter(
        Subject.id == subject_id, Subject.user_id == current_user.id
    ).first()
    if not subject:
        raise HTTPException(status_code=404, detail="Không tìm thấy môn học")

    update_data = data.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(subject, key, value)

    # Nếu cập nhật điểm thành phần mà không gửi total_score_10 mới
    # → reset để gpa_service.apply_grade() tính lại từ điểm thành phần
    score_fields = {"process_score", "final_score", "process_weight"}
    if score_fields.intersection(update_data.keys()) and "total_score_10" not in update_data:
        subject.total_score_10 = None

    gpa_service.apply_grade(subject)
    db.commit()
    db.refresh(subject)
    return subject


@router.delete("/{subject_id}", status_code=204)
def delete_subject(
    subject_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    subject = db.query(Subject).filter(
        Subject.id == subject_id, Subject.user_id == current_user.id
    ).first()
    if not subject:
        raise HTTPException(status_code=404, detail="Không tìm thấy môn học")
    db.delete(subject)
    db.commit()


# ============== ĐỀ XUẤT HỌC VƯỢT ==============

curriculum_router = APIRouter(prefix="/curriculum", tags=["Lộ trình học tập"])


@curriculum_router.get("/recommend")
def recommend_study_path(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Use Case: Đề xuất lộ trình học vượt"""
    return curriculum_service.recommend(db, current_user.id)


@curriculum_router.get("/", response_model=list[CurriculumSubjectResponse])
def list_curriculum(
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    """Xem toàn bộ chương trình đào tạo"""
    return db.query(CurriculumSubject).order_by(
        CurriculumSubject.semester_default.nulls_last(),
        CurriculumSubject.subject_code,
    ).all()


@curriculum_router.post("/save-plan")
def save_study_plan(
    data: dict,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Lưu lộ trình học vượt đã chọn.
    Body: { "subject_codes": ["CSE411", "CSE421", ...] }
    """
    codes = data.get("subject_codes", [])
    if not codes:
        raise HTTPException(status_code=400, detail="Vui lòng chọn ít nhất 1 môn")
    return curriculum_service.save_plan(db, current_user.id, codes)


@curriculum_router.get("/plan")
def get_study_plan(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Lấy lộ trình học vượt đã lưu của sinh viên"""
    return curriculum_service.get_plan(db, current_user.id)
