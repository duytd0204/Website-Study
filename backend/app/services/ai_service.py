"""
AI Service - viết theo OOP, hỗ trợ nhiều nhà cung cấp.

  - Chatbot trợ lý ảo : chọn nhà cung cấp qua AI_PROVIDER ("groq" hoặc "gemini").
  - OCR ảnh           : PaddleOCR đọc text thô, rồi Groq parse JSON có cấu trúc.
  - Chat kèm ảnh       : LUÔN dùng Gemini Vision (Groq không nhận ảnh).

Nguyên lý OOP áp dụng:
  * Encapsulation – cấu hình provider, prompt, client SDK đều là state nội bộ (self._...)
  * Polymorphism  – chat() điều phối sang _chat_groq()/_chat_gemini() tuỳ provider,
                    cùng interface, khác cách triển khai
  * Open/Closed   – muốn thêm nhà cung cấp mới chỉ cần thêm 1 method _chat_xxx()
                    và 1 nhánh trong dispatcher, không phải sửa code cũ

Cấu hình trong .env:
    AI_PROVIDER=groq        # hoặc gemini
    GROQ_API_KEY=...        # https://console.groq.com/keys
    GROQ_MODEL=llama-3.3-70b-versatile
    GEMINI_API_KEY=...      # https://aistudio.google.com/app/apikey
    GEMINI_MODEL=gemini-2.0-flash
"""
import json
import io
import os

os.environ["FLAGS_use_mkldnn"] = "0"
os.environ["FLAGS_enable_pir_api"] = "0"
os.environ["FLAGS_new_executor_sequential_run"] = "1"

from paddleocr import PaddleOCR
import re
import tempfile
import httpx
from typing import Optional
from PIL import Image, ImageEnhance
from app.core.config import settings


class AIService:
    """Dịch vụ AI cho hệ thống TLU Learning Support."""

    GROQ_URL = "https://api.groq.com/openai/v1/chat/completions"
    MAX_HISTORY = 10
    QUOTA_KEYWORDS = ["429", "quota", "rate limit", "rate-limit",
                      "resource_exhausted", "too many requests"]

    SYSTEM_PROMPT_CHATBOT = """Bạn là trợ lý học tập AI dành cho sinh viên Trường Đại học Thủy lợi (TLU).

Nhiệm vụ của bạn:

1. Giải đáp các thắc mắc về học tập, chương trình đào tạo và môn học.
2. Hỗ trợ giải thích quy chế đào tạo tín chỉ của Đại học Thủy lợi.
3. Hỗ trợ lập kế hoạch học tập, đăng ký học phần, cải thiện GPA.
4. Tư vấn kỹ năng học tập, quản lý thời gian và ôn thi.
5. Giải thích bảng điểm, GPA hệ 10, GPA hệ 4 và xếp loại học lực.
6. Tóm tắt tài liệu học tập khi sinh viên cung cấp nội dung.
7. Trả lời bằng tiếng Việt, ngắn gọn, dễ hiểu, lịch sự và thân thiện.
8. Nếu không chắc chắn về thông tin, hãy nói rõ rằng bạn không chắc chắn và khuyến khích sinh viên kiểm tra thông báo chính thức của nhà trường.

Thông tin về Đại học Thủy lợi (TLU):

- Cơ sở chính: 175 Tây Sơn, Đống Đa, Hà Nội.
- Hình thức đào tạo: Hệ thống tín chỉ.
- Điểm học phần được đánh giá theo hệ 10 và quy đổi sang hệ 4.

Quy đổi điểm chữ sang GPA hệ 4:

A = 4.0
B = 3.0
C = 2.0
D = 1.0
F = 0.0

Điểm chữ của TLU chỉ bao gồm:

A
B
C
D
F

Không sử dụng:
A+
B+
C+
D+

Xếp loại GPA hệ 4:

- Xuất sắc: GPA ≥ 3.60
- Giỏi: 3.20 ≤ GPA < 3.60
- Khá: 2.50 ≤ GPA < 3.20
- Trung bình: 2.00 ≤ GPA < 2.50
- Yếu: 1.00 ≤ GPA < 2.00
- Kém: GPA < 1.00

Khi giải thích GPA hoặc bảng điểm:
- Ưu tiên sử dụng quy đổi của Đại học Thủy lợi.
- Trình bày rõ ràng, từng bước.
- Có thể đưa ra lời khuyên cải thiện GPA và kế hoạch học tập phù hợp.

Không được tự bịa đặt quy chế hoặc thông tin của nhà trường.
Nếu người dùng hỏi các thông tin mang tính thời điểm như lịch học, lịch thi, học phí hoặc thông báo mới nhất thì cần nói rõ rằng thông tin có thể thay đổi theo từng học kỳ và người dùng nên kiểm tra trên hệ thống chính thức của TLU."""

    OCR_SCHEDULE_PROMPT = """Bạn là chuyên gia trích xuất dữ liệu thời khóa biểu sinh viên đại học.
Hãy phân tích văn bản OCR này và trích xuất TẤT CẢ các môn học/tiết học.

Trả về CHỈ MỘT JSON array (không giải thích, không markdown), mỗi phần tử:
{
  "subject_name": "Tên môn học đầy đủ",
  "subject_code": "Mã môn (nếu có)",
  "teacher": "Tên giảng viên (nếu có)",
  "room": "Phòng học (nếu có)",
  "day_of_week": <số: 2=Thứ 2 ... 7=Thứ 7, 8=Chủ Nhật>,
  "start_time": "HH:MM",
  "end_time": "HH:MM",
  "weeks": "Tuần học, vd: 1-15"
}
Trả về [] nếu không có dữ liệu thời khóa biểu."""

    OCR_TRANSCRIPT_PROMPT = """
Bạn là chuyên gia trích xuất dữ liệu bảng điểm sinh viên Đại học Thủy lợi (TLU).

NHIỆM VỤ:
- Phân tích văn bản OCR được cung cấp.
- Trích xuất TOÀN BỘ các môn học xuất hiện trong bảng điểm.
- Không được bỏ sót môn học.
- Không được tự suy đoán dữ liệu không tồn tại.
- Không được tự sửa chính tả tên môn học.
- Giữ nguyên dấu tiếng Việt như trong OCR.
- Nếu một tên môn bị xuống nhiều dòng thì ghép lại thành một dòng duy nhất.

Bảng điểm có cấu trúc:

STT | Mã học phần | Tên học phần | Số TC | Lần học | Lần thi |
Là môn tính điểm | Đánh giá | Mã sinh viên |
Quá trình | Thi | TKHP | Điểm chữ

CHỈ lấy điểm từ 3 cột cuối:

- Quá trình
- Thi
- TKHP

KHÔNG sử dụng giá trị từ:
- Số TC
- Lần học
- Lần thi
- Mã sinh viên

Ví dụ:

BR111 | Bóng rổ | 1 | 1 | 1 | DAT | 2251172243 | 9 | 4 | 6 | C

Kết quả:

{
  "credits": 1,
  "process_score": 9,
  "final_score": 4,
  "total_score_10": 6,
  "letter_grade": "C"
}

CHỈ trả về duy nhất một JSON array hợp lệ.

Mỗi phần tử có dạng:

{
  "subject_code": "Mã môn học",
  "subject_name": "Tên môn học",
  "credits": 3,
  "process_score": 9.0,
  "final_score": 8.5,
  "total_score_10": 8.8,
  "letter_grade": "A",
  "semester": "20241"
}

QUY TẮC:

1. Mã môn học
- Giữ nguyên đúng như OCR.
- Không tự thêm hoặc sửa ký tự.

2. Tên môn học
- Giữ nguyên chính tả tiếng Việt.
- Không dịch sang tiếng Anh.
- Không viết tắt.
- Nếu tên môn bị tách nhiều dòng thì nối lại thành một dòng.

Ví dụ:

"Cơ sở dữ liệu" phải trở thành: "Cơ sở dữ liệu"

3. Số tín chỉ
- Chuyển thành số nguyên.
- Nếu không tìm thấy thì null.

4. Điểm quá trình
Các tiêu đề sau đều tương ứng với process_score:
- Quá trình
- QT
- Điểm QT

5. Điểm thi
Các tiêu đề sau đều tương ứng với final_score:
- Thi
- CK
- Cuối kỳ

6. Điểm tổng kết học phần
Các tiêu đề sau đều tương ứng với total_score_10:
- TKHP
- Điểm học phần
- Điểm tổng kết
- Tổng kết

7. Điểm số
- Chỉ trả về kiểu số.
- Nếu OCR đọc được 8,5 thì chuyển thành 8.5.
- Nếu không có thì trả về null.

8. Điểm chữ
Đại học Thủy lợi chỉ sử dụng:

A
B
C
D
F

KHÔNG được tạo:
A+
B+
C+
D+

Nếu không xác định được thì trả về null.

9. Học kỳ
Ví dụ:
20231
20232
20241
20242

Nếu không tìm thấy thì null.

10. Không được gộp hai môn thành một.

11. Không được tạo thêm môn học không xuất hiện trong OCR.

12. Không được suy đoán dữ liệu bị mất.

13. Nếu dữ liệu một cột bị thiếu thì chỉ gán giá trị null cho cột đó, không được bỏ cả môn học.

14. Phải trích xuất tất cả các môn học xuất hiện trong bảng.

15. Không được trả về markdown.

16. Không được trả về giải thích.

17. Không được thêm chữ json.

18. Chỉ trả về JSON array hợp lệ.

Ví dụ:

[
  {
    "subject_code": "INT2204",
    "subject_name": "Lập trình Python",
    "credits": 3,
    "process_score": 8.5,
    "final_score": 9.0,
    "total_score_10": 8.8,
    "letter_grade": "A",
    "semester": "20241"
  }
]

Nếu không tìm thấy dữ liệu bảng điểm thì trả về:

[]
Tên môn học phải được chuẩn hóa về tiếng Việt có dấu đầy đủ.

Nếu OCR làm mất dấu hoặc thiếu ký tự,
hãy suy luận và khôi phục tên môn học đúng.

Ví dụ:
"Cu lông" -> "Cầu lông"
"Công ngh phn mm" -> "Công nghệ phần mềm"
"Cơ s d liu" -> "Cơ sở dữ liệu"
"Ch nghĩa xã hi khoa hoc" -> "Chủ nghĩa xã hội khoa học"
"Gi tích hàm mt bin" -> "Giải tích hàm một biến"
"""

    def __init__(self):
        self._genai = None        # None=chưa thử, False=đã thử & fail, module=sẵn sàng
        self._paddle_ocr = None   # Lazy-init PaddleOCR engine

    # ── Cấu hình & helper chung ─────────────────────────────────────────────

    def _provider_configured(self) -> tuple[bool, str]:
        """Kiểm tra nhà cung cấp chatbot đã cấu hình chưa → (configured, provider)."""
        provider = (settings.AI_PROVIDER or "gemini").strip().lower()
        if provider == "groq":
            ok = bool(settings.GROQ_API_KEY and not settings.GROQ_API_KEY.startswith("your_"))
            return ok, "groq"
        ok = bool(settings.GEMINI_API_KEY and settings.GEMINI_API_KEY != "your_gemini_api_key_here")
        return ok, "gemini"

    def _is_quota_error(self, err_text: str) -> bool:
        t = (err_text or "").lower()
        return any(k in t for k in self.QUOTA_KEYWORDS)

    def _quota_message(self, provider: str) -> str:
        return (
            f"Đã vượt giới hạn sử dụng miễn phí của {provider} (lỗi 429). "
            "Vui lòng đợi một lát rồi thử lại, hoặc đổi sang nhà cung cấp AI khác "
            "trong file .env (AI_PROVIDER=groq hoặc gemini)."
        )

    def _build_prompt(self, user_context: Optional[dict]) -> str:
        ctx = user_context or {}
        parts = []
        if ctx.get("full_name"): parts.append(f"Sinh viên: {ctx['full_name']}")
        if ctx.get("major"):     parts.append(f"Ngành: {ctx['major']}")
        if ctx.get("class_name"): parts.append(f"Lớp: {ctx['class_name']}")
        if ctx.get("course"):    parts.append(f"Khóa: {ctx['course']}")
        if ctx.get("gpa_4") is not None: parts.append(f"GPA hiện tại (hệ 4): {ctx['gpa_4']}")
        full = self.SYSTEM_PROMPT_CHATBOT
        if parts:
            full += "\n\nThông tin về sinh viên đang trò chuyện:\n" + "\n".join(parts)
        return full

    # ── PaddleOCR (đọc text thô từ ảnh) ─────────────────────────────────────

    def _init_paddle(self):
        if self._paddle_ocr is None:
            self._paddle_ocr = PaddleOCR(
            lang="vi",
            use_doc_orientation_classify=False,
            use_doc_unwarping=False,
            use_textline_orientation=False,

            # Quan trọng
            enable_mkldnn=False,
            cpu_threads=1
        )

        return self._paddle_ocr

    def _extract_text_with_paddle(self, img: Image.Image) -> str:
        ocr = self._init_paddle()
        fd, temp_path = tempfile.mkstemp(suffix=".jpg")
        os.close(fd)
        try:
            img.save(temp_path)
            result = ocr.predict(temp_path)
            texts = []
            for page in result:
                if isinstance(page, dict) and "rec_texts" in page:
                    texts.extend(page["rec_texts"])
            return "\n".join(texts)
        finally:
            if os.path.exists(temp_path):
                os.remove(temp_path)

    def _validate_image(self, image_bytes: bytes) -> Optional[Image.Image]:
        try:
            img = Image.open(io.BytesIO(image_bytes))

            max_size = 2000
            if img.width > max_size or img.height > max_size:
                img.thumbnail((max_size, max_size))

            # OCR tiếng Việt tốt hơn
            contrast = ImageEnhance.Contrast(img)
            img = contrast.enhance(1.5)

            sharpness = ImageEnhance.Sharpness(img)
            img = sharpness.enhance(2)

            img = img.convert("RGB")

            return img

        except Exception as e:
            print(f"[AIService] Ảnh không hợp lệ: {e}")
            return None

    # ── Gemini (text + vision) ───────────────────────────────────────────────

    def _init_gemini(self) -> bool:
        if self._genai is not None:
            return self._genai is not False
        if not settings.GEMINI_API_KEY or settings.GEMINI_API_KEY == "your_gemini_api_key_here":
            self._genai = False
            return False
        try:
            import google.generativeai as genai
            genai.configure(api_key=settings.GEMINI_API_KEY)
            self._genai = genai
            return True
        except Exception as e:
            print(f"[AIService] Lỗi khởi tạo Gemini: {e}")
            self._genai = False
            return False

    def _chat_gemini(self, user_message: str, history: list[dict], full_system: str) -> str:
        gemini_history = []
        for h in history[-self.MAX_HISTORY:]:
            role = "user" if h["role"] == "user" else "model"
            gemini_history.append({"role": role, "parts": [h["content"]]})
        model = self._genai.GenerativeModel(settings.GEMINI_MODEL, system_instruction=full_system)
        chat = model.start_chat(history=gemini_history)
        response = chat.send_message(user_message)
        return response.text.strip()

    # ── Groq (text-only, REST API tương thích OpenAI) ───────────────────────

    async def _chat_groq(self, user_message: str, history: list[dict], full_system: str) -> str:
        messages = [{"role": "system", "content": full_system}]
        for h in history[-self.MAX_HISTORY:]:
            role = "user" if h["role"] == "user" else "assistant"
            messages.append({"role": role, "content": h["content"]})
        messages.append({"role": "user", "content": user_message})

        payload = {"model": settings.GROQ_MODEL, "messages": messages,
                   "temperature": 0.7, "max_tokens": 1024}
        headers = {"Authorization": f"Bearer {settings.GROQ_API_KEY}", "Content-Type": "application/json"}

        async with httpx.AsyncClient(timeout=30.0) as client:
            resp = await client.post(self.GROQ_URL, json=payload, headers=headers)
            if resp.status_code == 429:
                raise RuntimeError("429 quota/rate limit (Groq)")
            resp.raise_for_status()
            return resp.json()["choices"][0]["message"]["content"].strip()

    async def _groq_extract_json(self, prompt: str) -> str:
        payload = {"model": settings.GROQ_MODEL,
                   "messages": [{"role": "user", "content": prompt}],
                   "temperature": 0, "max_tokens": 4096}
        headers = {"Authorization": f"Bearer {settings.GROQ_API_KEY}", "Content-Type": "application/json"}
        async with httpx.AsyncClient(timeout=60.0) as client:
            resp = await client.post(self.GROQ_URL, json=payload, headers=headers)
            if resp.status_code == 429:
                raise RuntimeError("429 quota/rate limit (Groq)")
            resp.raise_for_status()
            return resp.json()["choices"][0]["message"]["content"].strip()

    # ── Dispatcher (Polymorphism: cùng interface, khác triển khai) ───────────

    async def _dispatch_chat(self, user_message: str, history: list, full_system: str, provider: str) -> str:
        if provider == "groq":
            return await self._chat_groq(user_message, history, full_system)
        if not self._init_gemini():
            return "Không khởi tạo được Gemini. Kiểm tra lại GEMINI_API_KEY trong file .env."
        return self._chat_gemini(user_message, history, full_system)

    # ── Giao diện công khai (Public API) ─────────────────────────────────────

    async def chat(
        self,
        user_message: str,
        history: Optional[list] = None,
        user_context: Optional[dict] = None,
    ) -> str:
        """Gửi tin nhắn tới AI, tự chọn nhà cung cấp theo settings.AI_PROVIDER."""
        configured, provider = self._provider_configured()
        if not configured:
            hint = "GROQ_API_KEY" if provider == "groq" else "GEMINI_API_KEY"
            return (f"Hệ thống AI hiện chưa được cấu hình (nhà cung cấp: {provider}). "
                    f"Vui lòng liên hệ quản trị viên để thiết lập {hint} trong file .env.")

        full_system = self._build_prompt(user_context)
        try:
            return await self._dispatch_chat(user_message, history or [], full_system, provider)
        except Exception as e:
            err = str(e)
            print(f"[AIService] Lỗi khi gọi AI ({provider}): {err}")
            if self._is_quota_error(err):
                return self._quota_message("Groq" if provider == "groq" else "Gemini")
            return "Có lỗi xảy ra khi gọi AI. Vui lòng thử lại sau."

    async def chat_with_image(
        self,
        user_message: str,
        image_bytes: bytes,
        history: Optional[list] = None,
        user_context: Optional[dict] = None,
    ) -> str:
        """Gửi ảnh + câu hỏi tới Gemini Vision (bắt buộc dùng Gemini)."""
        import base64
        if not self._init_gemini():
            return (
                "Tính năng gửi ảnh yêu cầu Gemini API. "
                "Vui lòng thêm GEMINI_API_KEY vào .env và khởi động lại server.\n"
                "Hướng dẫn: https://aistudio.google.com/app/apikey"
            )
        try:
            model = self._genai.GenerativeModel(settings.GEMINI_MODEL or "gemini-2.0-flash")
            system_ctx = self._build_prompt(user_context)
            img_data = base64.b64encode(image_bytes).decode()

            contents = [
                {"role": "user", "parts": [{"text": system_ctx + "\n\nNgười dùng gửi ảnh kèm câu hỏi:"}]},
                {"role": "model", "parts": [{"text": "Tôi đã nhận được. Hãy cho tôi xem ảnh và câu hỏi của bạn."}]},
            ]
            for h in (history or []):
                contents.append({"role": h["role"], "parts": [{"text": h["content"]}]})
            contents.append({"role": "user", "parts": [
                {"inline_data": {"mime_type": "image/jpeg", "data": img_data}},
                {"text": user_message or "Hãy phân tích ảnh này và cho tôi biết nội dung."},
            ]})

            resp = model.generate_content(contents)
            return resp.text or "Không thể phân tích ảnh."
        except Exception as e:
            err = str(e)
            if self._is_quota_error(err):
                return "Gemini đã vượt giới hạn quota. Vui lòng thử lại sau."
            print(f"[AIService] Lỗi chat_with_image: {e}")
            return f"Có lỗi khi phân tích ảnh: {err[:120]}"

    async def extract_from_image(self, image_bytes: bytes, image_type: str) -> dict:
        """OCR bằng PaddleOCR (đọc text) rồi Groq (parse JSON có cấu trúc)."""
        img = self._validate_image(image_bytes)
        if img is None:
            return {"success": False, "items": [], "message": "Ảnh không hợp lệ, vui lòng chụp rõ ràng hơn."}

        try:
            ocr_text = self._extract_text_with_paddle(img)
            print("=" * 50)
            print("OCR TEXT:")
            print(ocr_text)
            print("=" * 50)
            if not ocr_text.strip():
                return {"success": False, "items": [], "message": "Không đọc được nội dung từ ảnh."}

            base_prompt = self.OCR_SCHEDULE_PROMPT if image_type == "schedule" else self.OCR_TRANSCRIPT_PROMPT
            prompt = f"""Dưới đây là văn bản OCR được trích xuất từ ảnh:

{ocr_text}

{base_prompt}

CHỈ trả về JSON hợp lệ. Không giải thích. Không dùng markdown."""

            text = await self._groq_extract_json(prompt)
            text = re.sub(r"^```(?:json)?|```$", "", text.strip(), flags=re.MULTILINE).strip()

            items = json.loads(text)
            if not isinstance(items, list):
                items = [items] if isinstance(items, dict) else []

            return {"success": True, "items": items, "message": f"Đã trích xuất {len(items)} bản ghi từ ảnh"}
        except json.JSONDecodeError as e:
            print(f"[AIService] JSON lỗi: {e}")
            return {"success": False, "items": [], "message": "AI không trả về JSON hợp lệ."}
        except Exception as e:
            print(f"[AIService] PaddleOCR + Groq lỗi: {e}")
            return {"success": False, "items": [], "message": "Không thể xử lý ảnh."}


# ── Singleton instance dùng trong toàn app ─────────────────────────────────────
ai_service = AIService()
