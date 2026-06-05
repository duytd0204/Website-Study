@echo off
chcp 65001 > nul
title TLU Learning Support - Khởi động

echo ============================================================
echo   HỆ THỐNG QUẢN LÝ HỌC TẬP - ĐẠI HỌC THỦY LỢI
echo ============================================================
echo.

cd backend

REM Kiểm tra Python
where python >nul 2>nul
if errorlevel 1 (
    echo [LỖI] Không tìm thấy Python. Vui lòng cài đặt Python 3.10+ tại:
    echo       https://www.python.org/downloads/
    pause
    exit /b 1
)

REM Kiểm tra .env
if not exist .env (
    echo [INFO] Tạo file .env từ .env.example...
    copy .env.example .env > nul
)

REM Kiểm tra dependencies
if not exist venv (
    echo [INFO] Tạo virtual environment...
    python -m venv venv
)

call venv\Scripts\activate.bat

echo [INFO] Cài đặt thư viện cần thiết...
pip install -q -r requirements.txt

echo.
echo ============================================================
echo  Server đang khởi động tại http://localhost:8000
echo  Nhấn Ctrl+C để dừng
echo ============================================================
echo.
echo  Tài khoản demo:
echo    - Sinh viên: sinhvien@tlu.edu.vn / Sinhvien@123
echo    - Admin:     admin@tlu.edu.vn / Admin@123456
echo ============================================================
echo.

python -m uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload

pause
