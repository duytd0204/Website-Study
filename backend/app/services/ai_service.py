"""
Service tích hợp AI - hỗ trợ nhiều nhà cung cấp.

- ChatBot trợ lý ảo: chọn nhà cung cấp qua AI_PROVIDER ("groq" hoặc "gemini").
- OCR/trích xuất từ ảnh: LUÔN dùng Gemini (Groq không nhận ảnh).

Cấu hình trong .env:
    AI_PROVIDER=groq        # hoặc gemini
    GROQ_API_KEY=...        # lấy tại https://console.groq.com/keys
    GROQ_MODEL=llama-3.3-70b-versatile
    GEMINI_API_KEY=...      # lấy tại https://aistudio.google.com/app/apikey
    GEMINI_MODEL=gemini-2.0-flash
"""
import json
import io
import re
import httpx
import tempfile
import os
from paddleocr import PaddleOCR
from typing import Optional
from PIL import Image
from app.core.config import settings


# ============================================================
#  TIỆN ÍCH CHUNG
# ============================================================

def _is_quota_error(err_text: str) -> bool:
    """Phát hiện lỗi vượt hạn ngạch / rate limit (429)."""
    t = (err_text or "").lower()
    return any(k in t for k in ["429", "quota", "rate limit", "rate-limit",
                                "resource_exhausted", "too many requests"])


def _friendly_quota_message(provider: str) -> str:
    return (
        f"⚠️ Đã vượt giới hạn sử dụng miễn phí của {provider} (lỗi 429). "
        "Vui lòng đợi một lát rồi thử lại, hoặc đổi sang nhà cung cấp AI khác "
        "trong file .env (AI_PROVIDER=groq hoặc gemini)."
    )


SYSTEM_PROMPT_CHATBOT = """Bạn là trợ lý học tập AI dành cho sinh viên Trường Đại học Thủy lợi (TLU).
Nhiệm vụ của bạn:
1. Giải đáp các thắc mắc về học tập, môn học, kiến thức chuyên ngành.
2. Tóm tắt nội dung học tập khi sinh viên cung cấp tài liệu.
3. Hỗ trợ giải thích các quy chế đào tạo tín chỉ theo quy chế của TLU.
4. Tư vấn kỹ năng học tập, quản lý thời gian, ôn thi.
5. Trả lời bằng tiếng Việt, lịch sự, thân thiện, ngắn gọn (trừ khi sinh viên yêu cầu chi tiết).

Quy tắc:
- Nếu câu hỏi không liên quan đến học tập/giáo dục, hãy lịch sự từ chối và gợi ý sinh viên hỏi đúng trọng tâm.
- Không đưa ra thông tin sai lệch về quy chế nhà trường. Khuyến khích sinh viên kiểm tra với phòng đào tạo khi cần thiết.
- Không đưa ra lời khuyên về sức khỏe tâm lý nghiêm trọng - khuyến khích tìm gặp chuyên gia.

Thông tin nền về Đại học Thủy lợi (TLU):
- Tên: Trường Đại học Thủy lợi (Thuyloi University - TLU)
- Cơ sở chính: 175 Tây Sơn, Đống Đa, Hà Nội
- Hệ đào tạo: Tín chỉ
- Thang điểm: hệ 10 và hệ 4 (A=4.0, B+=3.5, B=3.0, C+=2.5, C=2.0, D+=1.5, D=1.0, F=0)
- Xếp loại GPA hệ 4: Xuất sắc (>=3.6), Giỏi (>=3.2), Khá (>=2.5), Trung bình (>=2.0), Yếu (>=1.0)
"""


def _build_system_prompt(user_context: Optional[dict]) -> str:
    """Ghép thông tin cá nhân hóa vào system prompt."""
    user_context = user_context or {}
    ctx_parts = []
    if user_context.get("full_name"):
        ctx_parts.append(f"Sinh viên: {user_context['full_name']}")
    if user_context.get("major"):
        ctx_parts.append(f"Ngành: {user_context['major']}")
    if user_context.get("class_name"):
        ctx_parts.append(f"Lớp: {user_context['class_name']}")
    if user_context.get("course"):
        ctx_parts.append(f"Khóa: {user_context['course']}")
    if user_context.get("gpa_4") is not None:
        ctx_parts.append(f"GPA hiện tại (hệ 4): {user_context['gpa_4']}")

    full_system = SYSTEM_PROMPT_CHATBOT
    if ctx_parts:
        full_system += "\n\nThông tin về sinh viên đang trò chuyện:\n" + "\n".join(ctx_parts)
    return full_system


def _provider_configured() -> tuple[bool, str]:
    """Kiểm tra nhà cung cấp chatbot đã được cấu hình chưa.
    Trả về (configured, provider_name)."""
    provider = (settings.AI_PROVIDER or "gemini").strip().lower()
    if provider == "groq":
        ok = bool(settings.GROQ_API_KEY and not settings.GROQ_API_KEY.startswith("your_"))
        return ok, "groq"
    # mặc định gemini
    ok = bool(settings.GEMINI_API_KEY and settings.GEMINI_API_KEY != "your_gemini_api_key_here")
    return ok, "gemini"


# ============================================================
#  GEMINI (text + vision)
# ============================================================

_genai = None  # None = chưa thử; False = đã thử và fail

_paddle_ocr = None


def _init_paddle():
    global _paddle_ocr

    if _paddle_ocr is None:
        _paddle_ocr = PaddleOCR(
            lang="vi",
            use_doc_orientation_classify=False,
            use_doc_unwarping=False,
            use_textline_orientation=False
    )

    return _paddle_ocr


def _extract_text_with_paddle(image_bytes: bytes) -> str:
    ocr = _init_paddle()

    fd, temp_path = tempfile.mkstemp(suffix=".jpg")
    os.close(fd)

    try:
        with open(temp_path, "wb") as f:
            f.write(image_bytes)

        result = ocr.predict(temp_path)

        result = ocr.predict(temp_path)

        print("TEXTS:")
        print(result[0]["rec_texts"])

        print("POLYS:")
        print(result[0]["dt_polys"])

        texts = []

        for page in result:
            texts.extend(page.get("rec_texts", []))

        return {
        "texts": result[0]["rec_texts"],
        "positions": [poly.tolist() for poly in result[0]["dt_polys"]]
    }

    finally:
        if os.path.exists(temp_path):
            os.remove(temp_path)

def _init_gemini() -> bool:
    """Khởi tạo Gemini SDK (chỉ chạy 1 lần)."""
    global _genai
    if _genai is not None:
        return _genai is not False

    if not settings.GEMINI_API_KEY or settings.GEMINI_API_KEY == "your_gemini_api_key_here":
        _genai = False
        return False

    try:
        import google.generativeai as genai
        genai.configure(api_key=settings.GEMINI_API_KEY)
        _genai = genai
        return True
    except Exception as e:
        print(f"[AI Service] Lỗi khởi tạo Gemini: {e}")
        _genai = False
        return False


def _gemini_chat(user_message: str, history: list[dict], full_system: str) -> str:
    """Gọi Gemini cho chatbot."""
    gemini_history = []
    for h in history[-10:]:
        role = "user" if h["role"] == "user" else "model"
        gemini_history.append({"role": role, "parts": [h["content"]]})

    model = _genai.GenerativeModel(
        settings.GEMINI_MODEL,
        system_instruction=full_system,
    )
    chat = model.start_chat(history=gemini_history)
    response = chat.send_message(user_message)
    return response.text.strip()


# ============================================================
#  GROQ (text-only, API tương thích OpenAI)
# ============================================================

GROQ_URL = "https://api.groq.com/openai/v1/chat/completions"


async def _groq_chat(user_message: str, history: list[dict], full_system: str) -> str:
    """Gọi Groq cho chatbot qua REST API (tương thích OpenAI)."""
    messages = [{"role": "system", "content": full_system}]
    for h in history[-10:]:
        role = "user" if h["role"] == "user" else "assistant"
        messages.append({"role": role, "content": h["content"]})
    messages.append({"role": "user", "content": user_message})

    payload = {
        "model": settings.GROQ_MODEL,
        "messages": messages,
        "temperature": 0.7,
        "max_tokens": 1024,
    }
    headers = {
        "Authorization": f"Bearer {settings.GROQ_API_KEY}",
        "Content-Type": "application/json",
    }

    async with httpx.AsyncClient(timeout=30.0) as client:
        resp = await client.post(GROQ_URL, json=payload, headers=headers)
        if resp.status_code == 429:
            raise RuntimeError("429 quota/rate limit (Groq)")
        resp.raise_for_status()
        data = resp.json()
        return data["choices"][0]["message"]["content"].strip()

async def _groq_extract_json(prompt: str) -> str:
    payload = {
        "model": settings.GROQ_MODEL,
        "messages": [
            {
                "role": "user",
                "content": prompt
            }
        ],
        "temperature": 0,
        "max_tokens": 4096
    }

    headers = {
        "Authorization": f"Bearer {settings.GROQ_API_KEY}",
        "Content-Type": "application/json",
    }

    async with httpx.AsyncClient(timeout=60.0) as client:
        resp = await client.post(
            GROQ_URL,
            json=payload,
            headers=headers
        )

        if resp.status_code == 429:
            raise RuntimeError("429 quota/rate limit (Groq)")

        resp.raise_for_status()

        data = resp.json()

        return data["choices"][0]["message"]["content"].strip()


# ============================================================
#  CHATBOT - điểm vào chính (tự chọn nhà cung cấp)
# ============================================================

async def chat_with_ai(
    user_message: str,
    history: list[dict] = None,
    user_context: Optional[dict] = None,
) -> str:
    """
    Gửi tin nhắn tới AI và nhận phản hồi.
    Tự động chọn nhà cung cấp theo settings.AI_PROVIDER ("groq" | "gemini").
    """
    configured, provider = _provider_configured()
    if not configured:
        hint = "GROQ_API_KEY" if provider == "groq" else "GEMINI_API_KEY"
        return (f"⚠️ Hệ thống AI hiện chưa được cấu hình (nhà cung cấp: {provider}). "
                f"Vui lòng liên hệ quản trị viên để thiết lập {hint} trong file .env.")

    history = history or []
    full_system = _build_system_prompt(user_context)

    try:
        if provider == "groq":
            return await _groq_chat(user_message, history, full_system)
        else:
            if not _init_gemini():
                return ("⚠️ Không khởi tạo được Gemini. "
                        "Kiểm tra lại GEMINI_API_KEY trong file .env.")
            return _gemini_chat(user_message, history, full_system)
    except Exception as e:
        err = str(e)
        print(f"[AI Service] Lỗi khi gọi AI ({provider}): {err}")
        if _is_quota_error(err):
            return _friendly_quota_message("Groq" if provider == "groq" else "Gemini")
        return f"⚠️ Có lỗi xảy ra khi gọi AI. Vui lòng thử lại sau."
    



# ============================================================
#  OCR / VISION - luôn dùng Gemini
# ============================================================

def _validate_image(image_bytes: bytes) -> Optional[Image.Image]:
    """Kiểm tra và mở ảnh, resize nếu quá lớn."""
    try:
        img = Image.open(io.BytesIO(image_bytes))
        max_size = 1600
        if img.width > max_size or img.height > max_size:
            img.thumbnail((max_size, max_size))
        if img.mode != "RGB":
            img = img.convert("RGB")
        return img
    except Exception as e:
        print(f"[AI Service] Ảnh không hợp lệ: {e}")
        return None


OCR_SCHEDULE_PROMPT = """Bạn là chuyên gia trích xuất dữ liệu thời khóa biểu sinh viên đại học.
Hãy phân tích ảnh thời khóa biểu này và trích xuất TẤT CẢ các môn học/tiết học có trong ảnh.

Trả về CHỈ MỘT JSON array (không thêm chữ giải thích, không thêm ```json), mỗi phần tử có cấu trúc:
{
  "subject_name": "Tên môn học đầy đủ",
  "subject_code": "Mã môn (nếu có)",
  "teacher": "Tên giảng viên (nếu có)",
  "room": "Phòng học (nếu có)",
  "day_of_week": <số: 2=Thứ 2, 3=Thứ 3, 4=Thứ 4, 5=Thứ 5, 6=Thứ 6, 7=Thứ 7, 8=Chủ Nhật>,
  "start_time": "HH:MM (giờ 24h)",
  "end_time": "HH:MM (giờ 24h)",
  "weeks": "Tuần học, vd: 1-15 hoặc 1,3,5"
}

Nếu không có thông tin nào, để trống chuỗi "" hoặc null. Phải luôn có subject_name, day_of_week, start_time, end_time.
Trả về [] nếu ảnh không chứa thời khóa biểu."""


OCR_TRANSCRIPT_PROMPT = """
Bạn là chuyên gia xử lý dữ liệu OCR tiếng Việt.

Dữ liệu đầu vào được trích xuất từ ảnh bằng OCR và có thể chứa:

- Lỗi dấu tiếng Việt.
- Lỗi ký tự đặc biệt.
- Lỗi nhận dạng chữ cái gần giống nhau.
- Lỗi xuống dòng.
- Lỗi tách hoặc ghép cột.
- Lỗi khoảng trắng.
- Lỗi nhận dạng số và chữ.

Nhiệm vụ:

1. Tự động sửa lỗi OCR dựa trên ngữ cảnh.
2. Khôi phục tiếng Việt có dấu nếu ngữ cảnh đủ rõ.
3. Chuẩn hóa tên môn học, thuật ngữ giáo dục và văn bản tiếng Việt.
4. Giữ nguyên các mã định danh như:
   - Mã môn học
   - MSSV
   - Số quyết định
   - Số công văn
   - CCCD
   - Mã lớp
5. Không tự tạo dữ liệu không tồn tại.
6. Nếu không chắc chắn thì giữ nguyên dữ liệu OCR.
7. Ưu tiên độ chính xác hơn suy diễn.

Bảng điểm có các cột theo thứ tự:

STT
Mã môn học
Tên môn học
Số tín chỉ
Thang điểm 10
Thang điểm 4
Điểm chữ
Lần học
Lần thi
Là môn tính điểm
Đánh giá

Chỉ lấy:
- Mã môn học từ cột Mã môn học
- Tên môn học từ cột Tên môn học
- Số tín chỉ từ cột Số tín chỉ
- Điểm hệ 10 từ cột Thang điểm 10
- Điểm chữ từ cột Điểm chữ

KHÔNG lấy giá trị từ cột Đánh giá (ĐẠT) làm mã môn học.
KHÔNG lấy lần học, lần thi hoặc thang điểm 4 làm tín chỉ.

Sau khi chuẩn hóa dữ liệu OCR, hãy trích xuất bảng điểm thành JSON.

Quy đổi điểm chữ sang điểm hệ 10 nếu bảng chỉ có điểm chữ:

A  = 9.0
B+ = 8.2
B  = 7.5
C+ = 6.7
C  = 6.0
D+ = 5.2
D  = 4.5
F  = 2.0

Nếu OCR cung cấp cả điểm hệ 10 và điểm chữ:
- Ưu tiên điểm hệ 10 gốc.
- Không tự tính lại.

Bắt buộc chỉ trả về JSON hợp lệ.

Định dạng:

[
  {
    "subject_code": "CSE280",
    "subject_name": "Ngôn ngữ lập trình",
    "credits": 4,
    "total_score_10": 7.5,
    "letter_grade": "B",
    "semester": null
  }
]

Không thêm giải thích.
Không thêm markdown.
Không thêm ```json.
Chỉ trả về JSON array.
Trả về [] nếu không phải bảng điểm.
"""


async def extract_from_image(image_bytes: bytes, image_type: str) -> dict:
    """
    OCR bằng PaddleOCR + Groq
    """

    img = _validate_image(image_bytes)

    if img is None:
        return {
            "success": False,
            "items": [],
            "message": "Ảnh không hợp lệ, vui lòng chụp rõ ràng hơn."
        }

    try:
        ocr_data = _extract_text_with_paddle(image_bytes)
        print("========== OCR ==========")
        print(ocr_data)

        if not ocr_data["texts"]:
         return {
            "success": False,
            "items": [],
            "message": "Không đọc được nội dung từ ảnh."
    }

        base_prompt = (
            OCR_SCHEDULE_PROMPT
            if image_type == "schedule"
            else OCR_TRANSCRIPT_PROMPT
        )

        prompt = f"""
            Dưới đây là dữ liệu OCR.

            texts chứa nội dung OCR.
            positions chứa tọa độ của từng text tương ứng.

            Hãy sử dụng positions để xác định các text nào nằm trên cùng một hàng của bảng.

            OCR DATA:

            {json.dumps(ocr_data, ensure_ascii=False)}

            {base_prompt}

            CHỈ trả về JSON hợp lệ.
            Không giải thích.
            Không markdown.
"""

        text = await _groq_extract_json(prompt)

        if text.startswith("```"):
            lines = [
                l for l in text.split("\n")
                if not l.strip().startswith("```")
            ]
            text = "\n".join(lines).strip()

        print("RAW RESPONSE:")
        print(text)

        items = json.loads(text)  

        if not isinstance(items, list):
            items = [items] if isinstance(items, dict) else []

        return {
            "success": True,
            "items": items,
            "message": f"Đã trích xuất {len(items)} bản ghi từ ảnh"
        }

    except json.JSONDecodeError as e:
        print(f"[AI Service] JSON lỗi: {e}")

        return {
            "success": False,
            "items": [],
            "message": "AI không trả về JSON hợp lệ."
        }

    except Exception as e:
        print(f"[AI Service] PaddleOCR + Groq lỗi: {e}")

        return {
            "success": False,
            "items": [],
            "message": "Không thể xử lý ảnh."
        }
