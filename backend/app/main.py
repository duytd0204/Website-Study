"""
HỆ THỐNG HỖ TRỢ QUẢN LÝ HỌC TẬP - ĐẠI HỌC THỦY LỢI
Entry point của FastAPI Backend.
"""
import os
from pathlib import Path
from contextlib import asynccontextmanager
from sqlalchemy import text as _sa_text
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse, JSONResponse
from fastapi.exceptions import RequestValidationError
from starlette.exceptions import HTTPException as StarletteHTTPException

from app.core.config import settings
from app.core.database import Base, engine, SessionLocal
from app.api import auth, users, schedules, subjects, notes, chat, ocr, admin
from app import seed

# Đảm bảo data/ tồn tại
Path("data").mkdir(parents=True, exist_ok=True)
Path("data/avatars").mkdir(parents=True, exist_ok=True)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Startup: tạo bảng + seed dữ liệu"""
    # Tạo bảng nếu chưa có
    Base.metadata.create_all(bind=engine)
    print("[Startup] Database initialized")
    # Migration: thêm cột process_weight nếu chưa có (cho DB cũ)
    try:
        from app.core.database import engine as _eng
        with _eng.connect() as conn:
            conn.execute(_sa_text("ALTER TABLE subjects ADD COLUMN process_weight FLOAT DEFAULT 0.4"))
            conn.commit()
        print("[Migration] Đã thêm cột process_weight")
    except Exception:
        pass  # Cột đã tồn tại

    # Seed dữ liệu mặc định
    db = SessionLocal()
    try:
        seed.run_all(db)
    finally:
        db.close()

    print(f"[Startup] {settings.APP_NAME} v{settings.APP_VERSION} đã sẵn sàng")
    yield


app = FastAPI(
    title=settings.APP_NAME,
    version=settings.APP_VERSION,
    description="""
## 🎓 Hệ thống Hỗ trợ Quản lý Học tập - Đại học Thủy lợi

Backend RESTful API hỗ trợ:
* 🔐 **Xác thực**: Đăng ký, Đăng nhập, Quên mật khẩu
* 👤 **Profile**: Quản lý thông tin cá nhân
* 📅 **Lịch học**: Quản lý thời khóa biểu và nhắc nhở
* 📊 **Điểm & GPA**: Tính GPA hệ 4/10, dự báo điểm số
* 📝 **Ghi chú**: CRUD ghi chú học tập
* 🤖 **AI Chatbot**: Trợ lý ảo (Google Gemini)
* 📸 **OCR**: Trích xuất thời khóa biểu / bảng điểm từ ảnh
* 🎓 **Học vượt**: Đề xuất lộ trình học vượt
* 🛡️ **Admin**: Quản lý người dùng

**Tech Stack**: Python + FastAPI + SQLite + SQLAlchemy + Gemini API
    """,
    lifespan=lifespan,
)

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"] if settings.CORS_ORIGINS == "*" else settings.CORS_ORIGINS.split(","),
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# Xử lý lỗi chung
@app.exception_handler(StarletteHTTPException)
async def http_exception_handler(request, exc):
    return JSONResponse(
        status_code=exc.status_code,
        content={"detail": exc.detail, "status_code": exc.status_code},
    )


@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request, exc):
    errors = []
    for err in exc.errors():
        loc = " > ".join(str(x) for x in err.get("loc", []) if x != "body")
        msg = err.get("msg", "")
        errors.append(f"{loc}: {msg}" if loc else msg)
    return JSONResponse(
        status_code=422,
        content={"detail": "; ".join(errors), "status_code": 422, "errors": exc.errors()},
    )


# Đăng ký các router
API_PREFIX = "/api"
app.include_router(auth.router, prefix=API_PREFIX)
app.include_router(users.router, prefix=API_PREFIX)
app.include_router(schedules.router, prefix=API_PREFIX)
app.include_router(subjects.router, prefix=API_PREFIX)
app.include_router(subjects.curriculum_router, prefix=API_PREFIX)
app.include_router(notes.router, prefix=API_PREFIX)
app.include_router(chat.router, prefix=API_PREFIX)
app.include_router(ocr.router, prefix=API_PREFIX)
app.include_router(admin.router, prefix=API_PREFIX)


# Phục vụ file avatar
AVATAR_DIR = Path("data/avatars")
if AVATAR_DIR.exists():
    @app.get("/api/users/avatar/{filename}")
    async def get_avatar(filename: str):
        filepath = AVATAR_DIR / filename
        if filepath.exists() and filepath.is_file():
            return FileResponse(filepath)
        return JSONResponse(status_code=404, content={"detail": "Không tìm thấy ảnh"})


@app.get("/api/health")
def health_check():
    """Health check endpoint"""
    provider = (settings.AI_PROVIDER or "gemini").strip().lower()
    if provider == "groq":
        ai_configured = bool(settings.GROQ_API_KEY and not settings.GROQ_API_KEY.startswith("your_"))
    else:
        ai_configured = bool(settings.GEMINI_API_KEY and settings.GEMINI_API_KEY != "your_gemini_api_key_here")
    # OCR luôn cần Gemini
    ocr_configured = bool(settings.GEMINI_API_KEY and settings.GEMINI_API_KEY != "your_gemini_api_key_here")
    return {
        "status": "ok",
        "app": settings.APP_NAME,
        "version": settings.APP_VERSION,
        "ai_provider": provider,
        "ai_configured": ai_configured,
        "ocr_configured": ocr_configured,
        "smtp_configured": bool(settings.SMTP_USER and settings.SMTP_PASSWORD),
    }


# Phục vụ Frontend (Static SPA)
FRONTEND_DIR = Path(__file__).parent.parent.parent / "frontend"
if FRONTEND_DIR.exists():
    # CSS, JS, assets
    app.mount("/css", StaticFiles(directory=FRONTEND_DIR / "css"), name="css")
    app.mount("/js", StaticFiles(directory=FRONTEND_DIR / "js"), name="js")
    app.mount("/assets", StaticFiles(directory=FRONTEND_DIR / "assets"), name="assets")
    app.mount("/pages", StaticFiles(directory=FRONTEND_DIR / "pages"), name="pages")

    @app.get("/")
    async def serve_index():
        return FileResponse(FRONTEND_DIR / "index.html")

    @app.get("/favicon.ico")
    async def favicon():
        ico = FRONTEND_DIR / "assets" / "favicon.ico"
        if ico.exists():
            return FileResponse(ico)
        return JSONResponse(status_code=204, content=None)


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("app.main:app", host="0.0.0.0", port=8000, reload=True)
