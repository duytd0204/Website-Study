"""
API Trợ lý ảo AI ChatBot (Gemini API)
Use Case 3.11: Tra cứu trợ lý ảo AI
"""
import uuid
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.models.user import User
from app.models.chat import ChatMessage
from app.models.subject import Subject
from app.schemas.chat import ChatRequest, ChatResponse, ChatMessageResponse
from app.api.deps import get_current_user
from app.services.ai_service import ai_service
from app.services.gpa_service import gpa_service

router = APIRouter(prefix="/chat", tags=["Trợ lý AI"])


@router.post("/", response_model=ChatResponse)
async def send_message(
    data: ChatRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Gửi tin nhắn tới AI và nhận phản hồi"""
    session_id = data.session_id or uuid.uuid4().hex

    # Lấy lịch sử chat trong cùng session
    history_records = db.query(ChatMessage).filter(
        ChatMessage.user_id == current_user.id,
        ChatMessage.session_id == session_id,
    ).order_by(ChatMessage.created_at.asc()).limit(20).all()

    history = [{"role": m.role, "content": m.content} for m in history_records]

    # Tạo context cho AI: thông tin sinh viên + GPA
    subjects = db.query(Subject).filter(Subject.user_id == current_user.id).all()
    gpa_stats = gpa_service.calculate_gpa(subjects)

    user_context = {
        "full_name": current_user.full_name,
        "major": current_user.major,
        "class_name": current_user.class_name,
        "course": current_user.course,
        "gpa_4": gpa_stats["gpa_4"],
    }

    # Lưu tin nhắn của user
    user_msg = ChatMessage(
        user_id=current_user.id,
        session_id=session_id,
        role="user",
        content=data.message,
    )
    db.add(user_msg)
    db.commit()

    # Gọi AI
    reply = await ai_service.chat(
        user_message=data.message,
        history=history,
        user_context=user_context,
    )

    # Lưu phản hồi của AI
    assistant_msg = ChatMessage(
        user_id=current_user.id,
        session_id=session_id,
        role="assistant",
        content=reply,
    )
    db.add(assistant_msg)
    db.commit()

    # Gợi ý câu hỏi tiếp theo (đơn giản)
    suggestions = _generate_suggestions(data.message)

    return ChatResponse(session_id=session_id, reply=reply, suggestions=suggestions)


@router.get("/history", response_model=list[ChatMessageResponse])
def get_history(
    session_id: str = None,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Lấy lịch sử chat"""
    query = db.query(ChatMessage).filter(ChatMessage.user_id == current_user.id)
    if session_id:
        query = query.filter(ChatMessage.session_id == session_id)
    messages = query.order_by(ChatMessage.created_at.asc()).limit(100).all()
    return messages


@router.get("/sessions")
def list_sessions(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Lấy danh sách các phiên chat của user"""
    from sqlalchemy import func
    sessions = db.query(
        ChatMessage.session_id,
        func.min(ChatMessage.created_at).label("started_at"),
        func.max(ChatMessage.created_at).label("last_at"),
        func.count(ChatMessage.id).label("message_count"),
    ).filter(
        ChatMessage.user_id == current_user.id
    ).group_by(ChatMessage.session_id).order_by(
        func.max(ChatMessage.created_at).desc()
    ).limit(20).all()

    result = []
    for s in sessions:
        # Lấy tin nhắn đầu tiên của user trong session để hiển thị tiêu đề
        first = db.query(ChatMessage).filter(
            ChatMessage.session_id == s.session_id,
            ChatMessage.user_id == current_user.id,
            ChatMessage.role == "user",
        ).order_by(ChatMessage.created_at.asc()).first()
        title = (first.content[:60] + "...") if first and len(first.content) > 60 else (first.content if first else "Phiên chat")
        result.append({
            "session_id": s.session_id,
            "title": title,
            "started_at": s.started_at.isoformat() if s.started_at else None,
            "last_at": s.last_at.isoformat() if s.last_at else None,
            "message_count": s.message_count,
        })
    return result


@router.delete("/sessions/{session_id}", status_code=204)
def delete_session(
    session_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Xóa một phiên chat"""
    db.query(ChatMessage).filter(
        ChatMessage.user_id == current_user.id,
        ChatMessage.session_id == session_id,
    ).delete()
    db.commit()


def _generate_suggestions(last_message: str) -> list[str]:
    """Sinh gợi ý câu hỏi tiếp theo dựa trên nội dung"""
    lower = last_message.lower()
    if any(k in lower for k in ["gpa", "điểm", "tích lũy"]):
        return [
            "Làm sao để cải thiện GPA?",
            "Cách quy đổi điểm hệ 10 sang hệ 4?",
            "Học lực Giỏi cần đạt GPA bao nhiêu?",
        ]
    if any(k in lower for k in ["lịch", "thời khóa biểu", "deadline"]):
        return [
            "Tip quản lý thời gian học hiệu quả?",
            "Cách lập kế hoạch ôn thi cuối kỳ?",
        ]
    if any(k in lower for k in ["học vượt", "tốt nghiệp", "tín chỉ"]):
        return [
            "Điều kiện để được học vượt là gì?",
            "Tối đa được đăng ký bao nhiêu tín chỉ một kỳ?",
            "Cách lập kế hoạch tốt nghiệp sớm?",
        ]
    return [
        "Cho mình mẹo học hiệu quả",
        "Cách viết báo cáo đồ án đại học",
        "Cách quản lý thời gian khi học nhiều môn",
    ]


@router.post("/with-file", response_model=ChatResponse)
async def send_message_with_file(
    message: str = Form(...),
    session_id: str = Form(None),
    file: UploadFile = File(None),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Gửi tin nhắn kèm file (ảnh hoặc PDF) tới AI.
    - Nếu là ảnh: dùng Gemini Vision để phân tích ảnh + trả lời
    - Nếu là PDF/text: trích xuất text rồi gửi AI
    """
    import uuid as _uuid
    s_id = session_id or _uuid.uuid4().hex

    # Đọc nội dung file nếu có
    file_content = None
    file_type = None
    file_info = ""

    if file and file.filename:
        raw = await file.read()
        ct = (file.content_type or "").lower()
        if "image" in ct:
            file_content = raw
            file_type = "image"
            file_info = f" [Kèm ảnh: {file.filename}]"
        elif "pdf" in ct or file.filename.endswith(".pdf"):
            # Trích text từ PDF nếu có PyPDF2/pypdf
            try:
                import io
                import pypdf
                reader = pypdf.PdfReader(io.BytesIO(raw))
                extracted = "\n".join(p.extract_text() or "" for p in reader.pages)
                message = message + f"\n\n[Nội dung file {file.filename}]:\n{extracted[:3000]}"
            except ImportError:
                message = message + f"\n\n[Người dùng đính kèm PDF: {file.filename} — hệ thống không hỗ trợ đọc PDF tự động]"
            file_info = f" [Kèm PDF: {file.filename}]"
        else:
            try:
                text = raw.decode("utf-8", errors="replace")
                message = message + f"\n\n[Nội dung file {file.filename}]:\n{text[:3000]}"
            except Exception:
                pass
            file_info = f" [Kèm file: {file.filename}]"

    # Lịch sử hội thoại
    history_records = db.query(ChatMessage).filter(
        ChatMessage.user_id == current_user.id,
        ChatMessage.session_id == s_id,
    ).order_by(ChatMessage.created_at.asc()).limit(20).all()
    history = [{"role": m.role, "content": m.content} for m in history_records]

    # Context sinh viên
    subjects = db.query(Subject).filter(Subject.user_id == current_user.id).all()
    gpa_stats = gpa_service.calculate_gpa(subjects)
    user_context = {
        "full_name": current_user.full_name,
        "major": current_user.major,
        "class_name": current_user.class_name,
        "course": current_user.course,
        "gpa_4": gpa_stats["gpa_4"],
    }

    # Lưu tin nhắn user
    user_msg = ChatMessage(
        user_id=current_user.id, session_id=s_id,
        role="user", content=message + file_info,
    )
    db.add(user_msg); db.commit()

    # Gọi AI — nếu có ảnh thì dùng Vision (Gemini), nếu không thì text
    if file_type == "image" and file_content:
        reply = await ai_service.chat_with_image(
            user_message=message,
            image_bytes=file_content,
            history=history,
            user_context=user_context,
        )
    else:
        reply = await ai_service.chat(
            user_message=message,
            history=history,
            user_context=user_context,
        )

    # Lưu phản hồi
    asst_msg = ChatMessage(
        user_id=current_user.id, session_id=s_id,
        role="assistant", content=reply,
    )
    db.add(asst_msg); db.commit()

    suggestions = _generate_suggestions(message)
    return ChatResponse(session_id=s_id, reply=reply, suggestions=suggestions)
