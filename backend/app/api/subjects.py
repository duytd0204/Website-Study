"""
API Quản lý Điểm và GPA (Subjects)
Use Case 3.6: Quản lý điểm và GPA
Use Case 3.10: Đề xuất lộ trình học vượt
"""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.models.user import User
from app.models.subject import Subject, CurriculumSubject
from app.schemas.subject import (
    SubjectCreate, SubjectUpdate, SubjectResponse,
    GPAStats, GPAPrediction, GPAPredictionResponse,
    AdvancedStudyRecommendation, CurriculumSubjectResponse,
)
from app.api.deps import get_current_user
from app.services import gpa_service, curriculum_service

router = APIRouter(prefix="/subjects", tags=["Điểm số & GPA"])


def _fill_grade_fields(subject: Subject) -> Subject:
    """Tự động tính điểm hệ 4 và điểm chữ từ điểm hệ 10"""
    if subject.total_score_10 is not None:
        subject.letter_grade = gpa_service.score_10_to_letter(subject.total_score_10)
        subject.total_score_4 = gpa_service.score_10_to_4(subject.total_score_10)
        subject.is_passed = gpa_service.is_passed(subject.total_score_10)
    elif subject.final_score is not None:
        # Tính tổng kết từ điểm thành phần nếu chưa có
        total = gpa_service.calculate_total_score(
            subject.process_score, subject.final_score,
            process_weight=subject.process_weight or 0.4,
        )
        if total is not None:
            subject.total_score_10 = total
            subject.letter_grade = gpa_service.score_10_to_letter(total)
            subject.total_score_4 = gpa_service.score_10_to_4(total)
            subject.is_passed = gpa_service.is_passed(total)
    return subject


@router.get("/", response_model=list[SubjectResponse])
def list_subjects(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Lấy danh sách môn học của sinh viên"""
    subjects = db.query(Subject).filter(
        Subject.user_id == current_user.id
    ).order_by(Subject.semester.desc().nulls_last(), Subject.subject_name).all()
    return subjects


@router.post("/", response_model=SubjectResponse, status_code=201)
def create_subject(
    data: SubjectCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Thêm môn học mới"""
    subject = Subject(**data.model_dump(), user_id=current_user.id)
    _fill_grade_fields(subject)
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
        _fill_grade_fields(subject)
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

    predicted_data = []
    for p in data.predicted_subjects:
        d = p.model_dump()
        predicted_data.append({
            "credits": d["credits"],
            "total_score_10": d.get("total_score_10"),
        })

    result = gpa_service.predict_gpa(current_subjects, predicted_data)
    return result


@router.get("/{subject_id}", response_model=SubjectResponse)
def get_subject(
    subject_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    subject = db.query(Subject).filter(
        Subject.id == subject_id,
        Subject.user_id == current_user.id
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
        Subject.id == subject_id,
        Subject.user_id == current_user.id
    ).first()
    if not subject:
        raise HTTPException(status_code=404, detail="Không tìm thấy môn học")

    update_data = data.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(subject, key, value)

    # Nếu cập nhật điểm thành phần mà không cung cấp total_score_10 mới
    # -> reset để _fill_grade_fields tính lại từ components
    score_fields = {"process_score", "final_score", "process_weight"}
    if score_fields.intersection(update_data.keys()) and "total_score_10" not in update_data:
        subject.total_score_10 = None

    _fill_grade_fields(subject)
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
        Subject.id == subject_id,
        Subject.user_id == current_user.id
    ).first()
    if not subject:
        raise HTTPException(status_code=404, detail="Không tìm thấy môn học")
    db.delete(subject)
    db.commit()


# ============== ĐỀ XUẤT HỌC VƯỢT ==============

curriculum_router = APIRouter(prefix="/curriculum", tags=["Lộ trình học tập"])


@curriculum_router.get("/recommend", response_model=AdvancedStudyRecommendation)
def recommend_study_path(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Use Case 3.10: Đề xuất lộ trình học vượt"""
    result = curriculum_service.recommend_advanced_study(db, current_user.id)
    return result


@curriculum_router.get("/", response_model=list[CurriculumSubjectResponse])
def list_curriculum(
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    """Xem toàn bộ chương trình đào tạo"""
    return db.query(CurriculumSubject).order_by(CurriculumSubject.semester_default.nulls_last(), CurriculumSubject.subject_code).all()
