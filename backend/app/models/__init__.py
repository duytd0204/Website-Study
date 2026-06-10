"""
Tập hợp tất cả models để dễ import
"""
from app.models.user import User, UserRole, PasswordReset
from app.models.schedule import Schedule
from app.models.subject import Subject, CurriculumSubject
from app.models.note import Note
from app.models.chat import ChatMessage

__all__ = [
    "User", "UserRole", "PasswordReset",
    "Schedule",
    "Subject", "CurriculumSubject",
    "Note",
    "ChatMessage",
]

from app.models.study_plan import StudyPlanItem
