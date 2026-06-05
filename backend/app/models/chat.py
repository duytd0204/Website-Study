"""
Model ChatMessage - Lưu lịch sử chat với AI Chatbot
"""
from sqlalchemy import Column, Integer, String, Text, ForeignKey, DateTime
from sqlalchemy.orm import relationship
from datetime import datetime, timezone
from app.core.database import Base


class ChatMessage(Base):
    __tablename__ = "chat_messages"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    session_id = Column(String(50), nullable=False, index=True)  # Để nhóm các tin nhắn cùng phiên

    role = Column(String(20), nullable=False)        # "user" hoặc "assistant"
    content = Column(Text, nullable=False)

    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), index=True)

    user = relationship("User", back_populates="chat_messages")
