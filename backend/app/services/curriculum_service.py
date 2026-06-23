"""
Curriculum Service - viết theo OOP.

Lớp CurriculumService đóng gói: xác định kỳ hiện tại, đề xuất học vượt
đúng theo Use Case, lưu/đọc lộ trình học vượt.

Nguyên lý OOP:
  * Encapsulation – hằng số quy chế (MAX_CREDITS) nằm trong class
  * Single Responsibility – class chỉ quản lý chương trình đào tạo & học vượt
  * Dependency Injection – nhận db Session qua tham số
"""
from sqlalchemy.orm import Session
from app.models.subject import Subject, CurriculumSubject


class CurriculumService:
    """Dịch vụ quản lý chương trình đào tạo và đề xuất học vượt."""

    MAX_CREDITS_PER_SEMESTER: int = 24   # Quy chế TLU

    def _get_passed_codes(self, db: Session, user_id: int) -> set[str]:
        rows = db.query(Subject).filter(
            Subject.user_id == user_id, Subject.is_passed == True,
        ).all()
        return {s.subject_code for s in rows if s.subject_code}

    def _get_taken_codes(self, db: Session, user_id: int) -> set[str]:
        rows = db.query(Subject).filter(Subject.user_id == user_id).all()
        return {s.subject_code for s in rows if s.subject_code}

    def _infer_current_semester(self, db: Session, user_id: int) -> int:
        """Suy ra kỳ hiện tại = kỳ cao nhất trong CT đào tạo mà sinh viên đã đạt môn."""
        passed = self._get_passed_codes(db, user_id)
        if not passed:
            return 1
        max_sem = 1
        for cs in db.query(CurriculumSubject).all():
            if cs.subject_code in passed and (cs.semester_default or 0) > max_sem:
                max_sem = cs.semester_default
        return max_sem

    def _build_subject_info(self, cs: CurriculumSubject) -> dict:
        return {
            "id": cs.id, "subject_code": cs.subject_code, "subject_name": cs.subject_name,
            "credits": cs.credits, "semester_default": cs.semester_default,
            "prerequisites": cs.prerequisites or "",
            "is_required": getattr(cs, "is_required", True),
        }

    def _build_message(self, passed, can_take, cannot_take, current_sem, total_credits):
        if not passed:
            return (
                "Bạn chưa có môn học nào được ghi nhận là đạt. "
                "Hãy cập nhật điểm các môn đã hoàn thành để hệ thống "
                "có thể đề xuất lộ trình học vượt.", "E01",
            )
        if not can_take and not cannot_take:
            return (
                f"Bạn đang ở kỳ {current_sem}. Không tìm thấy môn học nào "
                f"thuộc kỳ {current_sem + 1} trở đi trong chương trình đào tạo.", None,
            )
        if not can_take:
            return (
                f"Bạn đang ở kỳ {current_sem}. Chưa đủ điều kiện học vượt môn "
                f"nào trong kỳ {current_sem + 1}+ vì chưa hoàn thành tiên quyết.", "E01",
            )
        return (
            f"Bạn đang ở kỳ {current_sem}. Có thể đăng ký học vượt "
            f"{len(can_take)} môn ({total_credits} tín chỉ) từ kỳ {current_sem + 1} trở đi.", None,
        )

    def recommend(self, db: Session, user_id: int) -> dict:
        """Đề xuất lộ trình học vượt: chỉ tính môn thuộc kỳ SAU kỳ hiện tại."""
        passed = self._get_passed_codes(db, user_id)
        taken = self._get_taken_codes(db, user_id)
        current_sem = self._infer_current_semester(db, user_id)

        all_curriculum = db.query(CurriculumSubject).all()
        if not all_curriculum:
            return {
                "can_take": [], "cannot_take": [], "current_semester": current_sem,
                "total_available_credits": 0,
                "max_credits_per_semester": self.MAX_CREDITS_PER_SEMESTER,
                "recommendation_message": (
                    "Chưa có dữ liệu chương trình đào tạo trong hệ thống. "
                    "Vui lòng liên hệ Quản trị viên để cập nhật."
                ),
                "max_credits_warning": "", "error_code": "E02",
            }

        can_take, cannot_take = [], []
        for cs in all_curriculum:
            if cs.subject_code in taken:
                continue
            if cs.semester_default is None or cs.semester_default <= current_sem:
                continue   # Không phải học vượt nếu cùng kỳ hoặc trước kỳ hiện tại

            # Tận dụng property/method đóng gói sẵn trong model CurriculumSubject
            if cs.has_passed_prerequisites(passed):
                can_take.append(self._build_subject_info(cs))
            else:
                missing = [p for p in cs.prerequisite_list if p not in passed]
                info = self._build_subject_info(cs)
                info["missing_prerequisites"] = missing
                cannot_take.append(info)

        can_take.sort(key=lambda x: (x["semester_default"], x["subject_code"]))
        cannot_take.sort(key=lambda x: (x.get("semester_default") or 99, x["subject_code"]))
        total_credits = sum(c["credits"] for c in can_take)
        message, error_code = self._build_message(passed, can_take, cannot_take, current_sem, total_credits)

        return {
            "can_take": can_take, "cannot_take": cannot_take,
            "current_semester": current_sem,
            "total_available_credits": total_credits,
            "max_credits_per_semester": self.MAX_CREDITS_PER_SEMESTER,
            "recommendation_message": message,
            "max_credits_warning": (
                f"Lưu ý: Tổng tín chỉ đăng ký trong một kỳ (kể cả môn bình thường) "
                f"không được vượt quá {self.MAX_CREDITS_PER_SEMESTER} TC theo quy chế TLU."
            ),
            "error_code": error_code,
        }

    def save_plan(self, db: Session, user_id: int, selected_codes: list[str]) -> dict:
        from app.models.study_plan import StudyPlanItem
        import datetime

        db.query(StudyPlanItem).filter(StudyPlanItem.user_id == user_id).delete()
        saved = 0
        for code in selected_codes:
            cs = db.query(CurriculumSubject).filter(CurriculumSubject.subject_code == code).first()
            if cs:
                db.add(StudyPlanItem(
                    user_id=user_id, subject_code=cs.subject_code, subject_name=cs.subject_name,
                    credits=cs.credits, semester_target=cs.semester_default,
                    created_at=datetime.datetime.now(datetime.timezone.utc),
                ))
                saved += 1
        db.commit()
        return {"saved": saved, "message": "Đã lưu lộ trình học vượt thành công"}

    def get_plan(self, db: Session, user_id: int) -> list:
        from app.models.study_plan import StudyPlanItem
        items = db.query(StudyPlanItem).filter(StudyPlanItem.user_id == user_id).all()
        return [
            {"subject_code": i.subject_code, "subject_name": i.subject_name,
             "credits": i.credits, "semester_target": i.semester_target}
            for i in items
        ]


curriculum_service = CurriculumService()
