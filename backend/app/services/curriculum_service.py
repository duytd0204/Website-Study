"""
Service đề xuất lộ trình học vượt.
Logic: dựa trên các môn sinh viên đã đạt, kiểm tra môn tiên quyết, đề xuất các môn có thể học vượt.
"""
from sqlalchemy.orm import Session
from app.models.subject import Subject, CurriculumSubject


MAX_CREDITS_PER_SEMESTER = 24   # Tối đa 24 tín chỉ/kỳ theo quy chế TLU


def get_passed_subject_codes(db: Session, user_id: int) -> set:
    """Lấy danh sách mã môn sinh viên đã đạt"""
    subjects = db.query(Subject).filter(
        Subject.user_id == user_id,
        Subject.is_passed == True
    ).all()
    return {s.subject_code for s in subjects if s.subject_code}


def get_taken_subject_codes(db: Session, user_id: int) -> set:
    """Lấy danh sách mã môn đã/đang học (kể cả đang dự kiến)"""
    subjects = db.query(Subject).filter(Subject.user_id == user_id).all()
    return {s.subject_code for s in subjects if s.subject_code}


def parse_prerequisites(prereq_str: str) -> list:
    """Parse chuỗi tiên quyết thành list mã môn"""
    if not prereq_str:
        return []
    return [p.strip() for p in prereq_str.split(",") if p.strip()]


def recommend_advanced_study(db: Session, user_id: int) -> dict:
    """
    Đề xuất các môn có thể học vượt:
    - Sinh viên đã đạt môn tiên quyết
    - Chưa từng đăng ký môn đó
    """
    passed = get_passed_subject_codes(db, user_id)
    taken = get_taken_subject_codes(db, user_id)

    all_curriculum = db.query(CurriculumSubject).all()

    if not all_curriculum:
        return {
            "can_take": [],
            "cannot_take": [],
            "total_available_credits": 0,
            "max_credits_per_semester": MAX_CREDITS_PER_SEMESTER,
            "recommendation_message": (
                "📚 Hiện tại chưa có dữ liệu chương trình đào tạo trong hệ thống. "
                "Vui lòng liên hệ Quản trị viên để được cập nhật."
            )
        }

    can_take = []
    cannot_take = []

    for cs in all_curriculum:
        # Bỏ qua môn đã đăng ký/đã học
        if cs.subject_code in taken:
            continue

        prereqs = parse_prerequisites(cs.prerequisites)

        # Tìm các môn tiên quyết còn thiếu
        missing = [p for p in prereqs if p not in passed]

        if not missing:
            can_take.append(cs)
        else:
            cannot_take.append({
                "subject_code": cs.subject_code,
                "subject_name": cs.subject_name,
                "credits": cs.credits,
                "missing_prerequisites": missing,
            })

    total_credits = sum(c.credits for c in can_take)

    if not can_take:
        msg = (
            "⚠️ Hiện tại bạn chưa đủ điều kiện để đăng ký học vượt môn nào. "
            "Hãy hoàn thành thêm các môn tiên quyết để mở khóa lộ trình học vượt."
        )
    else:
        msg = (
            f"🎓 Bạn có thể đăng ký học vượt {len(can_take)} môn "
            f"({total_credits} tín chỉ). Theo quy chế TLU, tối đa được đăng ký "
            f"{MAX_CREDITS_PER_SEMESTER} tín chỉ/kỳ. Hãy cân nhắc lựa chọn phù hợp với năng lực và lịch học hiện tại."
        )

    return {
        "can_take": can_take,
        "cannot_take": cannot_take,
        "total_available_credits": total_credits,
        "max_credits_per_semester": MAX_CREDITS_PER_SEMESTER,
        "recommendation_message": msg,
    }
