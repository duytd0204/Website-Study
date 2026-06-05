"""
Pydantic Schemas cho Note
"""
from pydantic import BaseModel, Field
from typing import Optional
from datetime import datetime


class NoteBase(BaseModel):
    title: str = Field(..., min_length=1, max_length=255)
    content: str = Field(..., min_length=1)
    tag: Optional[str] = None
    color: Optional[str] = "#FFF9C4"
    is_pinned: bool = False
    related_subject: Optional[str] = None


class NoteCreate(NoteBase):
    pass


class NoteUpdate(BaseModel):
    title: Optional[str] = None
    content: Optional[str] = None
    tag: Optional[str] = None
    color: Optional[str] = None
    is_pinned: Optional[bool] = None
    related_subject: Optional[str] = None


class NoteResponse(NoteBase):
    id: int
    user_id: int
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True
