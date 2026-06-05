#!/bin/bash
# Quick start script for Linux/Mac

set -e

echo "============================================================"
echo "  HỆ THỐNG QUẢN LÝ HỌC TẬP - ĐẠI HỌC THỦY LỢI"
echo "============================================================"
echo ""

cd "$(dirname "$0")/backend"

# Check Python
if ! command -v python3 &> /dev/null; then
    echo "[LỖI] Không tìm thấy python3. Hãy cài đặt Python 3.10+ trước."
    exit 1
fi

# .env
if [ ! -f .env ]; then
    echo "[INFO] Tạo file .env từ .env.example..."
    cp .env.example .env
fi

# Virtualenv
if [ ! -d venv ]; then
    echo "[INFO] Tạo virtual environment..."
    python3 -m venv venv
fi

source venv/bin/activate

echo "[INFO] Cài đặt thư viện cần thiết..."
pip install -q -r requirements.txt

echo ""
echo "============================================================"
echo " Server đang khởi động tại http://localhost:8000"
echo " Nhấn Ctrl+C để dừng"
echo "============================================================"
echo ""
echo " Tài khoản demo:"
echo "   - Sinh viên: sinhvien@tlu.edu.vn / Sinhvien@123"
echo "   - Admin:     admin@tlu.edu.vn / Admin@123456"
echo "============================================================"
echo ""

python -m uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
