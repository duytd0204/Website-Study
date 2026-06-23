"""
Service tính GPA - viết theo hướng đối tượng (OOP).

Lớp GPAService đóng gói toàn bộ logic: quy đổi điểm, tính GPA tổng/theo kỳ,
dự đoán GPA, phân loại học lực.

Nguyên lý OOP áp dụng:
  * Encapsulation – dữ liệu cấu hình (thang điểm, xếp loại) nằm trong class
  * Abstraction   – interface công khai rõ ràng, ẩn chi tiết tính toán bên trong
  * Single Responsibility – class chỉ làm một việc: tính GPA
"""
from typing import Optional


class GPAService:
    """Dịch vụ tính GPA theo quy chế đào tạo tín chỉ TLU."""

    LETTER_TO_SCORE_4 = {
    "A": 4.0,
    "B": 3.0,
    "C": 2.0,
    "D": 1.0,
    "F": 0.0,
}

    GRADE_THRESHOLDS = [
    (8.5, "A"),
    (7.0, "B"),
    (5.5, "C"),
    (4.0, "D"),
    (0.0, "F"),
]

    CLASSIFICATION_THRESHOLDS: list[tuple[float, str]] = [
        (3.6, "Xuất sắc"), (3.2, "Giỏi"), (2.5, "Khá"),
        (2.0, "Trung bình"), (1.0, "Yếu"), (0.0, "Kém"),
    ]

    PASS_THRESHOLD: float = 4.0

    # ── Quy đổi điểm ──────────────────────────────────────────────────────────

    def score_to_letter(self, score: Optional[float]) -> str:
        if score is None:
            return ""
        for threshold, letter in self.GRADE_THRESHOLDS:
            if score >= threshold:
                return letter
        return "F"

    def letter_to_score4(self, letter: str) -> float:
        return self.LETTER_TO_SCORE_4.get(letter, 0.0)

    def score10_to_score4(self, score: Optional[float]) -> float:
        return self.letter_to_score4(self.score_to_letter(score))

    def is_passed(self, score_10: Optional[float]) -> bool:
        return score_10 is not None and score_10 >= self.PASS_THRESHOLD

    # ── Tính điểm tổng kết ────────────────────────────────────────────────────

    def calculate_total_score(
        self,
        process_score: Optional[float],
        final_score: Optional[float],
        process_weight: float = 0.4,
        midterm_score: Optional[float] = None,
    ) -> Optional[float]:
        """
        Tổng = QT × hệ_số + Thi × (1 - hệ_số).
        Nếu chỉ có điểm thi → tính 100%.
        """
        if final_score is None:
            return None
        if process_score is not None:
            exam_w = round(1.0 - process_weight, 10)
            total = process_score * process_weight + final_score * exam_w
        else:
            total = final_score
        return round(total, 2)

    # ── Áp điểm vào đối tượng Subject (ORM) ───────────────────────────────────

    def apply_grade(self, subject) -> None:
        """
        Tự động tính và gán letter_grade, total_score_4, is_passed cho 1
        đối tượng Subject (mutate in-place). Đây là nơi DUY NHẤT chứa logic
        "điểm vào → điểm chữ/hệ4/đạt-trượt ra".
        """
        if subject.total_score_10 is not None:
            total = subject.total_score_10
        elif subject.final_score is not None:
            total = self.calculate_total_score(
                subject.process_score, subject.final_score,
                process_weight=subject.process_weight or 0.4,
            )
            subject.total_score_10 = total
        else:
            return

        if total is not None:
            subject.letter_grade = self.score_to_letter(total)
            subject.total_score_4 = self.score10_to_score4(total)
            subject.is_passed = self.is_passed(total)

    # ── Xếp loại học lực ──────────────────────────────────────────────────────

    def classify(self, gpa_4: float) -> str:
        for threshold, label in self.CLASSIFICATION_THRESHOLDS:
            if gpa_4 >= threshold:
                return label
        return "Kém"

    # ── Tính GPA tổng ─────────────────────────────────────────────────────────

    def calculate_gpa(self, subjects: list) -> dict:
        total_w4 = total_w10 = total_credits = earned_credits = 0.0
        completed = failed = 0

        for s in subjects:
            if s.total_score_10 is None or s.is_predicted:
                continue
            credits = s.credits or 0
            total_credits += credits
            total_w10 += s.total_score_10 * credits
            total_w4 += self.score10_to_score4(s.total_score_10) * credits
            if self.is_passed(s.total_score_10):
                earned_credits += credits
                completed += 1
            else:
                failed += 1

        gpa_10 = round(total_w10 / total_credits, 2) if total_credits else 0.0
        gpa_4 = round(total_w4 / total_credits, 2) if total_credits else 0.0

        return {
            "gpa_4": gpa_4, "gpa_10": gpa_10,
            "total_credits": int(total_credits),
            "earned_credits": int(earned_credits),
            "completed_subjects": completed,
            "failed_subjects": failed,
            "classification": self.classify(gpa_4),
        }

    # ── GPA theo kỳ ───────────────────────────────────────────────────────────

    def calculate_gpa_by_semester(self, subjects: list) -> list:
        by_sem: dict[str, list] = {}
        for s in subjects:
            if s.total_score_10 is None or s.is_predicted:
                continue
            key = s.semester or "Không xác định"
            by_sem.setdefault(key, []).append(s)

        result = []
        for sem, subs in sorted(by_sem.items()):
            stats = self.calculate_gpa(subs)
            result.append({
                "semester": sem, "gpa_4": stats["gpa_4"], "gpa_10": stats["gpa_10"],
                "credits": stats["total_credits"], "subjects_count": len(subs),
            })
        return result

    # ── Dự đoán GPA ───────────────────────────────────────────────────────────

    def predict_gpa(self, current_subjects: list, predicted_subjects: list) -> dict:
        current = self.calculate_gpa(current_subjects)

        class _FakeSubject:
            def __init__(self, credits: int, score: float):
                self.credits = credits
                self.total_score_10 = score
                self.is_predicted = False

        combined = list(current_subjects) + [
            _FakeSubject(p["credits"], p.get("total_score_10") or p.get("expected_score"))
            for p in predicted_subjects
        ]
        future = self.calculate_gpa(combined)

        return {
            "current_gpa_4": current["gpa_4"],
            "current_gpa_10": current["gpa_10"],
            "predicted_gpa_4": future["gpa_4"],
            "predicted_gpa_10": future["gpa_10"],
            "predicted_classification": future["classification"],
            "total_credits_after": future["total_credits"],
        }


# ── Singleton instance dùng ở mọi nơi trong app ────────────────────────────────
gpa_service = GPAService()
