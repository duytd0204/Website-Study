"""
Tạo dữ liệu khởi tạo:
- Tài khoản Admin mặc định
- Chương trình đào tạo mẫu cho ngành Công nghệ thông tin (TLU)
"""
from sqlalchemy.orm import Session
from app.core.security import hash_password
from app.core.config import settings
from app.models.user import User, UserRole
from app.models.subject import CurriculumSubject


def seed_admin(db: Session):
    """Tạo tài khoản admin mặc định nếu chưa có"""
    admin = db.query(User).filter(User.email == settings.DEFAULT_ADMIN_EMAIL).first()
    if admin:
        return
    admin = User(
        email=settings.DEFAULT_ADMIN_EMAIL,
        hashed_password=hash_password(settings.DEFAULT_ADMIN_PASSWORD),
        full_name="Quản trị viên hệ thống",
        role=UserRole.ADMIN,
        is_active=True,
        major="Quản trị hệ thống",
    )
    db.add(admin)
    db.commit()
    print(f"[Seed] Đã tạo tài khoản Admin: {settings.DEFAULT_ADMIN_EMAIL}")


def seed_demo_student(db: Session):
    """Tạo tài khoản sinh viên demo"""
    demo = db.query(User).filter(User.email == "sinhvien@tlu.edu.vn").first()
    if demo:
        return
    demo = User(
        email="sinhvien@tlu.edu.vn",
        hashed_password=hash_password("Sinhvien@123"),
        full_name="Nguyễn Văn Demo",
        student_code="2151234567",
        course="K65",
        class_name="65CNTT01",
        major="Công nghệ thông tin",
        role=UserRole.STUDENT,
        is_active=True,
    )
    db.add(demo)
    db.commit()
    print("[Seed] Đã tạo tài khoản Sinh viên demo: sinhvien@tlu.edu.vn / Sinhvien@123")


# Chương trình đào tạo mẫu - ngành CNTT TLU (trích lược, có thể chỉnh sửa)
SAMPLE_CURRICULUM = [
    # Kỳ 1
    {"code": "CSE111", "name": "Nhập môn Công nghệ thông tin", "credits": 3, "sem": 1, "prereq": ""},
    {"code": "MTH101", "name": "Giải tích 1", "credits": 3, "sem": 1, "prereq": ""},
    {"code": "MTH102", "name": "Đại số tuyến tính", "credits": 3, "sem": 1, "prereq": ""},
    {"code": "ENG101", "name": "Tiếng Anh 1", "credits": 3, "sem": 1, "prereq": ""},
    {"code": "PHE101", "name": "Giáo dục thể chất 1", "credits": 1, "sem": 1, "prereq": ""},

    # Kỳ 2
    {"code": "CSE121", "name": "Lập trình cơ bản (C/C++)", "credits": 3, "sem": 2, "prereq": "CSE111"},
    {"code": "MTH103", "name": "Giải tích 2", "credits": 3, "sem": 2, "prereq": "MTH101"},
    {"code": "PHY101", "name": "Vật lý đại cương", "credits": 3, "sem": 2, "prereq": ""},
    {"code": "ENG102", "name": "Tiếng Anh 2", "credits": 3, "sem": 2, "prereq": "ENG101"},
    {"code": "PHI101", "name": "Triết học Mác-Lênin", "credits": 3, "sem": 2, "prereq": ""},

    # Kỳ 3
    {"code": "CSE211", "name": "Lập trình hướng đối tượng (Java)", "credits": 4, "sem": 3, "prereq": "CSE121"},
    {"code": "CSE221", "name": "Cấu trúc dữ liệu và Giải thuật", "credits": 4, "sem": 3, "prereq": "CSE121"},
    {"code": "CSE231", "name": "Toán rời rạc", "credits": 3, "sem": 3, "prereq": "MTH102"},
    {"code": "CSE241", "name": "Kiến trúc máy tính", "credits": 3, "sem": 3, "prereq": ""},
    {"code": "ENG201", "name": "Tiếng Anh chuyên ngành", "credits": 3, "sem": 3, "prereq": "ENG102"},

    # Kỳ 4
    {"code": "CSE311", "name": "Cơ sở dữ liệu", "credits": 4, "sem": 4, "prereq": "CSE221"},
    {"code": "CSE321", "name": "Hệ điều hành", "credits": 3, "sem": 4, "prereq": "CSE241"},
    {"code": "CSE331", "name": "Mạng máy tính", "credits": 3, "sem": 4, "prereq": "CSE241"},
    {"code": "CSE341", "name": "Phân tích & Thiết kế thuật toán", "credits": 3, "sem": 4, "prereq": "CSE221,CSE231"},
    {"code": "CSE351", "name": "Lập trình Web", "credits": 3, "sem": 4, "prereq": "CSE211"},

    # Kỳ 5
    {"code": "CSE411", "name": "Công nghệ phần mềm", "credits": 4, "sem": 5, "prereq": "CSE211,CSE311"},
    {"code": "CSE421", "name": "Trí tuệ nhân tạo", "credits": 3, "sem": 5, "prereq": "CSE221,CSE341"},
    {"code": "CSE431", "name": "An toàn thông tin", "credits": 3, "sem": 5, "prereq": "CSE331"},
    {"code": "CSE441", "name": "Lập trình di động", "credits": 3, "sem": 5, "prereq": "CSE211"},
    {"code": "CSE451", "name": "Hệ quản trị CSDL nâng cao", "credits": 3, "sem": 5, "prereq": "CSE311"},

    # Kỳ 6
    {"code": "CSE511", "name": "Phân tích thiết kế hệ thống", "credits": 4, "sem": 6, "prereq": "CSE411"},
    {"code": "CSE521", "name": "Học máy", "credits": 3, "sem": 6, "prereq": "CSE421"},
    {"code": "CSE531", "name": "Phát triển ứng dụng đa nền tảng", "credits": 3, "sem": 6, "prereq": "CSE441"},
    {"code": "CSE541", "name": "Kiểm thử phần mềm", "credits": 3, "sem": 6, "prereq": "CSE411"},

    # Kỳ 7
    {"code": "CSE611", "name": "Đồ án chuyên ngành", "credits": 4, "sem": 7, "prereq": "CSE511"},
    {"code": "CSE621", "name": "Quản lý dự án phần mềm", "credits": 3, "sem": 7, "prereq": "CSE411"},
    {"code": "CSE631", "name": "Khoa học dữ liệu", "credits": 3, "sem": 7, "prereq": "CSE521"},

    # Kỳ 8 - Tốt nghiệp
    {"code": "CSE711", "name": "Thực tập tốt nghiệp", "credits": 4, "sem": 8, "prereq": "CSE611"},
    {"code": "CSE712", "name": "Đồ án tốt nghiệp", "credits": 10, "sem": 8, "prereq": "CSE611"},
]


def seed_curriculum(db: Session):
    """Tạo dữ liệu chương trình đào tạo mẫu"""
    count = db.query(CurriculumSubject).count()
    if count > 0:
        return

    for item in SAMPLE_CURRICULUM:
        cs = CurriculumSubject(
            subject_code=item["code"],
            subject_name=item["name"],
            credits=item["credits"],
            semester_default=item["sem"],
            major="Công nghệ thông tin",
            prerequisites=item["prereq"] or None,
        )
        db.add(cs)
    db.commit()
    print(f"[Seed] Đã tạo {len(SAMPLE_CURRICULUM)} môn trong chương trình đào tạo CNTT")


def run_all(db: Session):
    seed_admin(db)
    seed_demo_student(db)
    seed_curriculum(db)
