"""
Service tính GPA - quy đổi điểm hệ 10 sang hệ 4 và xếp loại
theo quy chế đào tạo tín chỉ chuẩn Bộ GD&ĐT (Quy chế 17/2021/TT-BGDĐT)
"""
from typing import Optional


def score_10_to_letter(score: float) -> str:
    """Quy đổi điểm hệ 10 sang điểm chữ"""
    if score is None:
        return ""
    if score >= 8.5:
        return "A"
    elif score >= 8.0:
        return "B+"
    elif score >= 7.0:
        return "B"
    elif score >= 6.5:
        return "C+"
    elif score >= 5.5:
        return "C"
    elif score >= 5.0:
        return "D+"
    elif score >= 4.0:
        return "D"
    else:
        return "F"


def letter_to_score_4(letter: str) -> float:
    """Quy đổi điểm chữ sang hệ 4"""
    mapping = {
        "A+": 4.0, "A": 4.0,
        "B+": 3.5, "B": 3.0,
        "C+": 2.5, "C": 2.0,
        "D+": 1.5, "D": 1.0,
        "F": 0.0,
    }
    return mapping.get(letter, 0.0)


def score_10_to_4(score: float) -> float:
    """Quy đổi trực tiếp điểm hệ 10 sang hệ 4"""
    if score is None:
        return 0.0
    letter = score_10_to_letter(score)
    return letter_to_score_4(letter)


def is_passed(score_10: Optional[float]) -> bool:
    """Đạt môn khi điểm >= 4.0 hệ 10 (>= D)"""
    if score_10 is None:
        return False
    return score_10 >= 4.0


def calculate_total_score(
    process_score: Optional[float],
    final_score: Optional[float],
    process_weight: float = 0.4,
    midterm_score: Optional[float] = None,   # giữ lại tham số cho tương thích
) -> Optional[float]:
    """
    Tính điểm tổng kết hệ 10 từ 2 thành phần:
      - Điểm quá trình (process_weight, mặc định 40%)
      - Điểm thi (1 - process_weight, mặc định 60%)
    """
    if final_score is None:
        return None

    # Nếu có cả 2 thành phần: tổng = QT * hs + Thi * (1-hs)
    # Nếu chỉ có điểm thi: tổng = điểm thi (hệ số 100%)
    if process_score is not None:
        exam_weight = round(1.0 - process_weight, 10)
        total = process_score * process_weight + final_score * exam_weight
    else:
        total = final_score

    return round(total, 2)


def calculate_gpa(subjects: list) -> dict:
    """
    Tính GPA tổng dựa trên danh sách Subject (chỉ tính các môn đã có điểm tổng kết).
    Trả về: gpa_4, gpa_10, total_credits, earned_credits, ...
    """
    total_weighted_4 = 0.0
    total_weighted_10 = 0.0
    total_credits = 0          # Tổng tín chỉ đã đăng ký (có điểm)
    earned_credits = 0         # Tín chỉ đã đạt (>= 4 hệ 10)
    completed = 0
    failed = 0

    for s in subjects:
        if s.total_score_10 is None or s.is_predicted:
            continue

        credits = s.credits or 0
        total_credits += credits

        gpa10 = s.total_score_10
        gpa4 = score_10_to_4(gpa10)

        total_weighted_10 += gpa10 * credits
        total_weighted_4 += gpa4 * credits

        if is_passed(gpa10):
            earned_credits += credits
            completed += 1
        else:
            failed += 1

    gpa_10 = round(total_weighted_10 / total_credits, 2) if total_credits > 0 else 0.0
    gpa_4 = round(total_weighted_4 / total_credits, 2) if total_credits > 0 else 0.0

    return {
        "gpa_4": gpa_4,
        "gpa_10": gpa_10,
        "total_credits": total_credits,
        "earned_credits": earned_credits,
        "completed_subjects": completed,
        "failed_subjects": failed,
        "classification": classify_gpa(gpa_4),
    }


def classify_gpa(gpa_4: float) -> str:
    """
    Xếp loại học lực theo quy chế tín chỉ TLU
    """
    if gpa_4 >= 3.6:
        return "Xuất sắc"
    elif gpa_4 >= 3.2:
        return "Giỏi"
    elif gpa_4 >= 2.5:
        return "Khá"
    elif gpa_4 >= 2.0:
        return "Trung bình"
    elif gpa_4 >= 1.0:
        return "Yếu"
    else:
        return "Kém"


def calculate_gpa_by_semester(subjects: list) -> list:
    """Nhóm các môn theo học kỳ và tính GPA cho từng kỳ"""
    by_semester = {}
    for s in subjects:
        if s.total_score_10 is None or s.is_predicted:
            continue
        key = s.semester or "Không xác định"
        if key not in by_semester:
            by_semester[key] = []
        by_semester[key].append(s)

    result = []
    for sem, subs in sorted(by_semester.items()):
        stats = calculate_gpa(subs)
        result.append({
            "semester": sem,
            "gpa_4": stats["gpa_4"],
            "gpa_10": stats["gpa_10"],
            "credits": stats["total_credits"],
            "subjects_count": len(subs),
        })
    return result


def predict_gpa(current_subjects: list, predicted_subjects: list) -> dict:
    """
    Dự đoán GPA sau khi học thêm các môn dự kiến.
    current_subjects: các môn đã có điểm thực tế
    predicted_subjects: các môn dự kiến với điểm dự kiến
    """
    current = calculate_gpa(current_subjects)

    # Kết hợp cả 2 list để tính GPA tương lai
    class FakeSub:
        def __init__(self, credits, total_score_10):
            self.credits = credits
            self.total_score_10 = total_score_10
            self.is_predicted = False

    combined = list(current_subjects)
    for p in predicted_subjects:
        combined.append(FakeSub(p["credits"], p.get("total_score_10") or p.get("expected_score")))

    future = calculate_gpa(combined)

    return {
        "current_gpa_4": current["gpa_4"],
        "current_gpa_10": current["gpa_10"],
        "predicted_gpa_4": future["gpa_4"],
        "predicted_gpa_10": future["gpa_10"],
        "predicted_classification": future["classification"],
        "total_credits_after": future["total_credits"],
    }
