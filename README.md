# 🎓 Hệ thống Hỗ trợ Quản lý Học tập - Đại học Thủy lợi (TLU)

Hệ thống web toàn diện hỗ trợ sinh viên Đại học Thủy lợi quản lý lịch học, điểm số, GPA, ghi chú, kèm các tính năng AI hiện đại (trợ lý ảo, OCR ảnh thời khóa biểu/bảng điểm, đề xuất học vượt).

> **Tech stack**: Python 3.10+ · FastAPI · SQLite · SQLAlchemy · Google Gemini API · Vanilla JS/HTML5/CSS3

---

## 📋 Mục lục

- [Tính năng chính](#-tính-năng-chính)
- [Yêu cầu hệ thống](#-yêu-cầu-hệ-thống)
- [Cài đặt nhanh](#-cài-đặt-nhanh)
- [Cấu hình AI và Email](#-cấu-hình-ai-và-email)
- [Tài khoản mẫu](#-tài-khoản-mẫu)
- [Cấu trúc dự án](#-cấu-trúc-dự-án)
- [API Documentation](#-api-documentation)
- [Khắc phục sự cố](#-khắc-phục-sự-cố)

---

## ✨ Tính năng chính

### 👨‍🎓 Sinh viên

- **🔐 Xác thực**: Đăng ký, Đăng nhập, Quên mật khẩu (OTP qua email), Đổi mật khẩu
- **👤 Hồ sơ cá nhân**: Cập nhật thông tin, đổi ảnh đại diện
- **📅 Quản lý lịch học**: Tạo / sửa / xóa thời khóa biểu, hiển thị trực quan dạng calendar tuần
- **🔔 Nhắc nhở thông minh**: Tự động nhắc trước 30 phút (có hỗ trợ Browser Notification)
- **📊 Quản lý điểm & GPA**:
  - Tính GPA hệ 4 và hệ 10 tự động
  - Tính điểm tổng theo trọng số TLU (Quá trình 10% + Giữa kỳ 30% + Cuối kỳ 60%)
  - Quy đổi điểm chữ (A, B+, B, C+, C, D+, D, F) theo quy chế
  - GPA theo từng học kỳ
  - **🔮 Dự đoán GPA** khi cộng thêm các môn học sắp tới
- **🎓 Đề xuất học vượt**: Tự động kiểm tra môn tiên quyết, gợi ý môn có thể học vượt, áp dụng giới hạn 24 TC/kỳ
- **📝 Ghi chú**: Sticky-note style với màu sắc, ghim, tag, tìm kiếm
- **📸 OCR Ảnh**: Quét thời khóa biểu / bảng điểm bằng Gemini Vision, chỉnh sửa trước khi lưu
- **🤖 Trợ lý AI**: Chat với Gemini AI 24/7 - hỏi đáp về học tập, lập kế hoạch ôn thi, lời khuyên...

### 🛡️ Quản trị viên (Admin)

- **📊 Dashboard tổng quan**: Thống kê người dùng, môn học, lịch, ghi chú
- **👥 Quản lý người dùng**:
  - Tìm kiếm theo email / họ tên / MSSV
  - Khóa / Mở khóa tài khoản
  - Đặt lại mật khẩu tạm thời ngẫu nhiên
  - Phân quyền (Sinh viên / Admin)
  - Xóa tài khoản
- **🎓 Quản lý Chương trình đào tạo**: CRUD danh sách môn học, môn tiên quyết, kỳ học mặc định

---

## 💻 Yêu cầu hệ thống

| Mục | Yêu cầu |
|-----|---------|
| Python | 3.10 hoặc cao hơn |
| Trình duyệt | Chrome / Firefox / Edge phiên bản mới |
| RAM | Tối thiểu 512MB |
| Đĩa cứng | ~200MB cho hệ thống và dữ liệu |
| Internet | Cần thiết cho tính năng AI (Gemini) |

---

## 🚀 Cài đặt nhanh

### Bước 1: Cài đặt Python

Đảm bảo bạn đã có Python 3.10+. Kiểm tra:
```bash
python --version
# Hoặc trên Linux/Mac:
python3 --version
```

Nếu chưa, tải tại: https://www.python.org/downloads/

### Bước 2: Cài đặt thư viện

Mở terminal/cmd, di chuyển vào thư mục dự án và cài đặt dependencies:

```bash
cd tlu_system/backend

# Tạo virtual environment (khuyến nghị)
python -m venv venv

# Kích hoạt:
# Trên Windows:
venv\Scripts\activate
# Trên Linux/Mac:
source venv/bin/activate

# Cài đặt:
pip install -r requirements.txt
```

### Bước 3: Cấu hình môi trường

Sao chép file `.env.example` thành `.env`:

```bash
# Windows:
copy .env.example .env

# Linux/Mac:
cp .env.example .env
```

Mở file `.env` và chỉnh sửa nếu cần (xem mục [Cấu hình AI và Email](#-cấu-hình-ai-và-email)). 

> ⚠️ Nếu không cấu hình `GEMINI_API_KEY`, tính năng AI Chatbot và OCR sẽ không hoạt động (nhưng các tính năng khác vẫn dùng được bình thường).

### Bước 4: Khởi động server

```bash
# Đảm bảo đang ở thư mục backend
python -m uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
```

Khi thấy thông báo:
```
[Startup] Database initialized
[Seed] Đã tạo tài khoản Admin: admin@tlu.edu.vn
[Seed] Đã tạo tài khoản Sinh viên demo: sinhvien@tlu.edu.vn / Sinhvien@123
[Seed] Đã tạo 34 môn trong chương trình đào tạo CNTT
[Startup] Hệ thống Quản lý Học tập - Đại học Thủy lợi v1.0.0 đã sẵn sàng
INFO:     Application startup complete.
INFO:     Uvicorn running on http://0.0.0.0:8000
```

### Bước 5: Mở trình duyệt

Truy cập **http://localhost:8000** để bắt đầu sử dụng.

🎉 **Xong!** Đăng nhập bằng tài khoản demo bên dưới để khám phá.

---

## 🔑 Tài khoản mẫu

Hệ thống tự động tạo 2 tài khoản mặc định khi khởi động lần đầu:

### Tài khoản Sinh viên (để test các tính năng học tập)
- **Email**: `sinhvien@tlu.edu.vn`
- **Mật khẩu**: `Sinhvien@123`

### Tài khoản Quản trị viên
- **Email**: `admin@tlu.edu.vn`
- **Mật khẩu**: `Admin@123456`

> ⚠️ **An toàn**: Hãy đổi mật khẩu admin ngay sau khi deploy lên môi trường thật!

---

## 🤖 Cấu hình AI và Email

Hệ thống dùng AI cho **hai tính năng riêng biệt**:

| Tính năng | Nhà cung cấp dùng được | Vì sao |
|-----------|------------------------|--------|
| 🤖 Chatbot (chỉ chữ) | **Groq** *(khuyến nghị)* hoặc Gemini | Groq miễn phí rộng rãi, rất nhanh |
| 📸 OCR ảnh (TKB/bảng điểm) | **Gemini** (bắt buộc) | Groq không đọc được ảnh |

Bạn chọn nhà cung cấp cho Chatbot qua biến `AI_PROVIDER` trong file `.env`:
```env
AI_PROVIDER=groq    # hoặc: gemini
```

### 🟢 Bật Chatbot bằng Groq (khuyến nghị - miễn phí, không cần thẻ)

Groq cho hạn mức miễn phí rộng (~14.400 request/ngày) và tốc độ rất nhanh. Đây là lựa chọn tốt nhất nếu Gemini báo lỗi `429 quota` (thường gặp ở Việt Nam do giới hạn khu vực).

1. Truy cập: https://console.groq.com/keys
2. Đăng nhập (Google/GitHub) → nhấn **"Create API Key"**
3. Copy key (bắt đầu bằng `gsk_...`)
4. Mở `backend/.env`, đặt:
```env
AI_PROVIDER=groq
GROQ_API_KEY=gsk_...your_actual_key_here
GROQ_MODEL=llama-3.3-70b-versatile
```
5. Khởi động lại server

> 💡 Nếu Groq cũng báo 429, thử đổi `GROQ_MODEL=llama-3.1-8b-instant` (model nhẹ, hạn mức rộng hơn).

### 🔵 Bật tính năng AI bằng Gemini

Gemini **bắt buộc** nếu muốn dùng tính năng **Quét ảnh (OCR)**, và cũng dùng được cho Chatbot.

1. Truy cập: https://aistudio.google.com/app/apikey
2. Đăng nhập bằng Google Account → nhấn **"Create API Key"**
3. Copy API key
4. Mở `backend/.env`, dán vào:
```env
GEMINI_API_KEY=AIzaSy...your_actual_key_here
GEMINI_MODEL=gemini-2.0-flash
```
5. Khởi động lại server

> ⚠️ Nếu Gemini báo `429 ... limit: 0`: đây thường là giới hạn **khu vực** (Việt Nam chưa được cấp free tier), không phải lỗi code. Hãy thử tạo key ở một project Google khác, hoặc dùng Groq cho Chatbot.

### 💡 Cấu hình gợi ý (tốt nhất cho đồ án)

Dùng **Groq cho Chatbot** + **Gemini cho OCR** cùng lúc:
```env
AI_PROVIDER=groq
GROQ_API_KEY=gsk_...
GEMINI_API_KEY=AIzaSy...
```
Khi đó Chatbot chạy bằng Groq (nhanh, hạn mức rộng) còn OCR vẫn dùng Gemini. Nếu một nhà cung cấp hết hạn ngạch, hệ thống hiển thị thông báo tiếng Việt thân thiện thay vì lỗi kỹ thuật.

### Nếu không cấu hình AI

Các tính năng khác (lịch học, GPA, ghi chú, học vượt, quản trị...) vẫn hoạt động bình thường. Chatbot và OCR sẽ hiển thị thông báo hướng dẫn thiết lập key, không gây lỗi hệ thống.

### Cấu hình SMTP (cho chức năng Quên mật khẩu qua Email)

Nếu không cấu hình, mã OTP sẽ được in ra **console** (terminal) thay vì gửi email - thuận tiện cho phát triển.

Để gửi email thật (dùng Gmail làm ví dụ):

1. Bật xác thực 2 bước cho Gmail
2. Tạo App Password tại: https://myaccount.google.com/apppasswords
3. Cấu hình `.env`:
```env
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your_email@gmail.com
SMTP_PASSWORD=your_16_char_app_password
SMTP_FROM_NAME=TLU Learning Support
```

---

## 📁 Cấu trúc dự án

```
tlu_system/
├── backend/                       # FastAPI Backend
│   ├── app/
│   │   ├── api/                   # API endpoints
│   │   │   ├── auth.py            # Đăng ký/Đăng nhập/Quên MK
│   │   │   ├── users.py           # Profile, Avatar
│   │   │   ├── schedules.py       # Lịch học
│   │   │   ├── subjects.py        # Môn học & GPA
│   │   │   ├── notes.py           # Ghi chú
│   │   │   ├── chat.py            # AI Chatbot
│   │   │   ├── ocr.py             # OCR ảnh
│   │   │   ├── admin.py           # Quản trị
│   │   │   └── deps.py            # Dependencies (auth, db)
│   │   ├── core/
│   │   │   ├── config.py          # Pydantic Settings
│   │   │   ├── database.py        # SQLAlchemy setup
│   │   │   └── security.py        # Hash, JWT
│   │   ├── models/                # SQLAlchemy models
│   │   ├── schemas/               # Pydantic schemas
│   │   ├── services/              # Business logic
│   │   │   ├── gpa_service.py     # Tính GPA hệ 4/10
│   │   │   ├── ai_service.py      # Gemini integration
│   │   │   ├── email_service.py   # SMTP
│   │   │   └── curriculum_service.py # Học vượt
│   │   ├── seed.py                # Dữ liệu mẫu ban đầu
│   │   └── main.py                # Entry point
│   ├── data/                      # Auto-created
│   │   ├── tlu.db                 # SQLite database
│   │   └── avatars/               # Uploaded avatars
│   ├── requirements.txt
│   └── .env.example
│
├── frontend/                      # Vanilla JS Frontend (SPA)
│   ├── index.html                 # Auto-redirect entry
│   ├── css/
│   │   ├── style.css              # Base + design system (TLU theme)
│   │   ├── auth.css               # Login/Register/Forgot styles
│   │   └── app.css                # Main app layout
│   ├── js/
│   │   ├── config.js              # API_BASE config
│   │   ├── api.js                 # API client + utilities (Toast, Modal)
│   │   ├── app.js                 # Main shell, sidebar router
│   │   └── views/                 # Các view module
│   │       ├── dashboard.js
│   │       ├── schedule.js
│   │       ├── gpa.js
│   │       ├── curriculum.js
│   │       ├── notes.js
│   │       ├── ocr.js
│   │       ├── chatbot.js
│   │       └── profile.js
│   └── pages/
│       ├── login.html
│       ├── register.html
│       ├── forgot.html
│       ├── app.html               # Main app shell (sinh viên)
│       └── admin.html             # Admin panel
│
└── README.md                      # File này
```

---

## 📚 API Documentation

Khi server đang chạy, truy cập **http://localhost:8000/docs** để xem giao diện Swagger UI tương tác (tự động sinh bởi FastAPI):

- Mọi endpoint đều có mô tả tiếng Việt
- Có thể test trực tiếp từ trình duyệt
- Hỗ trợ Authentication via Bearer Token

Có thể truy cập **http://localhost:8000/redoc** để xem version ReDoc đẹp hơn.

### Endpoints chính

| Category | Endpoints |
|----------|-----------|
| Auth | `POST /api/auth/register`, `POST /api/auth/login`, `POST /api/auth/forgot-password`, ... |
| Users | `GET/PUT /api/users/me`, `POST /api/users/me/avatar` |
| Schedules | `GET/POST/PUT/DELETE /api/schedules/...` |
| Subjects | `GET/POST /api/subjects/...`, `GET /api/subjects/gpa`, `POST /api/subjects/gpa/predict` |
| Curriculum | `GET /api/curriculum/recommend` |
| Notes | `GET/POST/PUT/DELETE /api/notes/...` |
| Chat AI | `POST /api/chat/`, `GET /api/chat/sessions` |
| OCR | `POST /api/ocr/extract` |
| Admin | `GET /api/admin/stats`, `GET/PUT/DELETE /api/admin/users/...` |

---

## 🛠 Khắc phục sự cố

### ❌ Lỗi `bcrypt` khi khởi động

```
AttributeError: module 'bcrypt' has no attribute '__about__'
```

→ Đã được fix trong code. Đảm bảo bạn dùng `bcrypt==4.2.0` từ `requirements.txt`.

### ❌ Server không khởi động (Port 8000 bận)

Đổi port khác:
```bash
python -m uvicorn app.main:app --port 8080
```
Sau đó truy cập http://localhost:8080.

### ❌ AI Chatbot trả về thông báo lỗi

Kiểm tra `GEMINI_API_KEY` đã được đặt đúng trong `.env` và đã khởi động lại server.

### ❌ Không nhận được email OTP

Mặc định khi chưa cấu hình SMTP, OTP sẽ in ra **console nơi chạy uvicorn**. Tìm dòng giống:
```
==================================================
 [DEV MODE] Email OTP
 To: user@example.com
 OTP: 123456
==================================================
```

### ❌ Xóa và tạo lại database

Để reset hoàn toàn dữ liệu:
```bash
# Trong thư mục backend
rm -rf data/tlu.db
# Hoặc Windows: del data\tlu.db

# Khởi động lại server, tài khoản mặc định và dữ liệu mẫu sẽ được tạo lại
```

### ❌ Mở trang trắng không có nội dung

1. Mở DevTools (F12) → Tab Console để xem lỗi
2. Đảm bảo backend đang chạy
3. Kiểm tra các file `.js` và `.css` trong `frontend/` đầy đủ

---

## 📖 Hướng dẫn sử dụng nhanh

### Quy trình điển hình cho sinh viên:

1. **Đăng ký** tại `/pages/register.html` (hoặc dùng tài khoản demo)
2. **Đăng nhập** → vào Dashboard
3. **Cập nhật profile**: Thông tin cá nhân, ảnh đại diện
4. **Quét bảng điểm**:
   - Vào "📸 Quét ảnh" → Chọn "Bảng điểm" → Upload ảnh
   - AI trích xuất điểm, sửa lại nếu cần → "Lưu"
5. **Xem GPA**: Sang "📊 Điểm số & GPA" để xem GPA hệ 4/10, xếp loại
6. **Lập kế hoạch học vượt**: Vào "🎓 Lộ trình học vượt" - hệ thống tự gợi ý môn nào có thể đăng ký dựa trên các môn đã hoàn thành
7. **Quản lý lịch học**: "📅 Lịch học" - Tự tạo hoặc quét từ ảnh
8. **Ghi chú**: "📝 Ghi chú" - Tạo ghi chú học tập theo môn, có thể ghim, tô màu
9. **Hỏi AI**: "🤖 Trợ lý AI" - Hỏi bất kỳ điều gì về học tập

### Quy trình cho Admin:

1. Đăng nhập với tài khoản admin → vào `/pages/admin.html`
2. Xem **Tổng quan** hệ thống
3. **Quản lý người dùng**: Tìm, khóa, mở khóa, reset password, đổi quyền
4. **Quản lý CT đào tạo**: Thêm/sửa môn trong chương trình (ảnh hưởng đến đề xuất học vượt)

---

## 🎨 Giao diện

- **Màu chủ đạo**: Xanh đậm TLU `#003F87` (Pantone 287)
- **Màu phụ**: Vàng accent `#FFB800`, Đỏ `#C8102E`
- **Font**: Be Vietnam Pro (hiển thị tốt với tiếng Việt)
- **Responsive**: Hoạt động tốt trên desktop và mobile

---

## 📝 License

Đây là đồ án tốt nghiệp dành cho mục đích học tập. Vui lòng ghi nhận tác giả khi sử dụng.

**Tác giả**: Vũ Hoàng Lan Anh - Đại học Thủy lợi (TLU)

---

## 🙏 Lời cảm ơn

- **Google Gemini API** - cho khả năng AI mạnh mẽ
- **FastAPI** - framework Python tuyệt vời
- **SQLAlchemy** - ORM linh hoạt
- **Đại học Thủy lợi** - đơn vị đào tạo

---

> 💡 **Mẹo**: Nếu bạn gặp khó khăn, hãy mở DevTools (F12) và xem tab Console để biết chi tiết lỗi. Mọi đóng góp ý kiến đều được hoan nghênh!
