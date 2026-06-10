"""
Service đề xuất lộ trình học vượt.

Logic mới (đúng theo Use Case):
- Xác định kỳ hiện tại của sinh viên dựa trên môn học đã hoàn thành.
- Môn trong kỳ hiện tại trở về trước → không phải "học vượt" (bình thường/đã học).
- Học vượt = học môn thuộc kỳ SAU kỳ hiện tại, nhưng đã đủ tiên quyết.
"""
from sqlalchemy.orm import Session
from app.models.subject import Subject, CurriculumSubject

MAX_CREDITS_PER_SEMESTER = 24   # Quy chế TLU: tối đa 24 TC/kỳ


# ── Helpers ──────────────────────────────────────────────────────────────────

def get_passed_subject_codes(db: Session, user_id: int) -> set:
    rows = db.query(Subject).filter(
        Subject.user_id == user_id, Subject.is_passed == True
    ).all()
    return {s.subject_code for s in rows if s.subject_code}


def get_taken_subject_codes(db: Session, user_id: int) -> set:
    rows = db.query(Subject).filter(Subject.user_id == user_id).all()
    return {s.subject_code for s in rows if s.subject_code}


def parse_prerequisites(prereq_str: str) -> list[str]:
    if not prereq_str:
        return []
    return [p.strip() for p in prereq_str.split(",") if p.strip()]


def _current_semester_number(db: Session, user_id: int) -> int:
    """
    Suy ra kỳ hiện tại của sinh viên dựa trên số kỳ cao nhất trong
    chương trình đào tạo mà sinh viên đã hoàn thành ít nhất 1 môn.
    Mặc định 1 nếu không có dữ liệu.
    """
    passed_codes = get_passed_subject_codes(db, user_id)
    if not passed_codes:
        return 1

    max_sem = 1
    for cs in db.query(CurriculumSubject).all():
        if cs.subject_code in passed_codes and cs.semester_default:
            if cs.semester_default > max_sem:
                max_sem = cs.semester_default
    return max_sem


# ── API chính ─────────────────────────────────────────────────────────────────

def recommend_advanced_study(db: Session, user_id: int) -> dict:
    """
    Trả về:
      can_take   – môn CÓ THỂ học vượt (kỳ sau > kỳ hiện tại, đủ tiên quyết)
      cannot_take – môn CHƯA ĐỦ điều kiện (thiếu tiên quyết hoặc cùng kỳ/trước)
      current_semester – kỳ hiện tại suy ra được
      recommendation_message – thông báo tổng quan
      max_credits_warning – cảnh báo giới hạn tín chỉ
    """
    passed = get_passed_subject_codes(db, user_id)
    taken  = get_taken_subject_codes(db, user_id)
    current_sem = _current_semester_number(db, user_id)

    all_curriculum = db.query(CurriculumSubject).all()
    if not all_curriculum:
        return {
            "can_take": [], "cannot_take": [],
            "current_semester": current_sem,
            "total_available_credits": 0,
            "max_credits_per_semester": MAX_CREDITS_PER_SEMESTER,
            "recommendation_message": (
                "Chưa có dữ liệu chương trình đào tạo trong hệ thống. "
                "Vui lòng liên hệ Quản trị viên để cập nhật."
            ),
            "max_credits_warning": "",
            "error_code": "E02",
        }

    can_take    = []
    cannot_take = []

    for cs in all_curriculum:
        # Bỏ qua môn đã học / đang học
        if cs.subject_code in taken:
            continue

        # Môn không có semester_default hoặc thuộc kỳ ≤ kỳ hiện tại
        # → không phải học vượt, bỏ qua (không liệt kê)
        if cs.semester_default is None or cs.semester_default <= current_sem:
            continue

        prereqs = parse_prerequisites(cs.prerequisites)
        missing = [p for p in prereqs if p not in passed]

        if not missing:
            can_take.append({
                "id": cs.id,
                "subject_code": cs.subject_code,
                "subject_name": cs.subject_name,
                "credits": cs.credits,
                "semester_default": cs.semester_default,
                "prerequisites": cs.prerequisites or "",
                "is_required": cs.is_required,
            })
        else:
            cannot_take.append({
                "subject_code": cs.subject_code,
                "subject_name": cs.subject_name,
                "credits": cs.credits,
                "semester_default": cs.semester_default,
                "prerequisites": cs.prerequisites or "",
                "missing_prerequisites": missing,
            })

    # Sắp xếp can_take theo kỳ rồi mã môn
    can_take.sort(key=lambda x: (x["semester_default"], x["subject_code"]))
    cannot_take.sort(key=lambda x: (x["semester_default"] or 99, x["subject_code"]))

    total_credits = sum(c["credits"] for c in can_take)

    # ── Xác định thông điệp phù hợp ──────────────────────────────────────────
    if not passed:
        msg = (
            "Bạn chưa có môn học nào được ghi nhận là đạt. "
            "Hãy cập nhật điểm các môn đã hoàn thành để hệ thống có thể đề xuất lộ trình học vượt."
        )
        error_code = "E01"
    elif not can_take and not cannot_take:
        msg = (
            f"Bạn đang ở kỳ {current_sem}. Không tìm thấy môn học nào thuộc kỳ "
            f"{current_sem + 1} trở đi trong chương trình đào tạo."
        )
        error_code = None
    elif not can_take:
        msg = (
            f"Bạn đang ở kỳ {current_sem}. Chưa đủ điều kiện học vượt môn nào "
            f"trong kỳ {current_sem + 1}+ vì chưa hoàn thành các môn tiên quyết tương ứng."
        )
        error_code = "E01"
    else:
        msg = (
            f"Bạn đang ở kỳ {current_sem}. Có thể đăng ký học vượt "
            f"{len(can_take)} môn ({total_credits} tín chỉ) từ kỳ {current_sem + 1} trở đi."
        )
        error_code = None

    credit_warning = (
        f"Lưu ý: Tổng tín chỉ đăng ký trong một kỳ (kể cả môn bình thường) "
        f"không được vượt quá {MAX_CREDITS_PER_SEMESTER} TC theo quy chế TLU."
    )

    return {
        "can_take":   can_take,
        "cannot_take": cannot_take,
        "current_semester": current_sem,
        "total_available_credits": total_credits,
        "max_credits_per_semester": MAX_CREDITS_PER_SEMESTER,
        "recommendation_message": msg,
        "max_credits_warning": credit_warning,
        "error_code": error_code,
    }


# ── Study Plan helpers ────────────────────────────────────────────────────────

def save_study_plan(db: Session, user_id: int, selected_codes: list[str]) -> dict:
    """
    Lưu lộ trình học vượt mà sinh viên đã chọn.
    Dùng bảng StudyPlanItem (tạo nếu chưa có).
    """
    from app.models.study_plan import StudyPlanItem
    import datetime

    # Xóa kế hoạch cũ
    db.query(StudyPlanItem).filter(StudyPlanItem.user_id == user_id).delete()

    for code in selected_codes:
        cs = db.query(CurriculumSubject).filter(
            CurriculumSubject.subject_code == code
        ).first()
        if cs:
            db.add(StudyPlanItem(
                user_id=user_id,
                subject_code=cs.subject_code,
                subject_name=cs.subject_name,
                credits=cs.credits,
                semester_target=cs.semester_default,
                created_at=datetime.datetime.now(datetime.timezone.utc),
            ))

    db.commit()
    return {"saved": len(selected_codes), "message": "Đã lưu lộ trình học vượt thành công"}


def get_study_plan(db: Session, user_id: int) -> list:
    from app.models.study_plan import StudyPlanItem
    items = db.query(StudyPlanItem).filter(StudyPlanItem.user_id == user_id).all()
    return [
        {
            "subject_code": i.subject_code,
            "subject_name": i.subject_name,
            "credits": i.credits,
            "semester_target": i.semester_target,
        }
        for i in items
    ]
