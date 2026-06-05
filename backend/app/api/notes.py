"""
API Quản lý Ghi chú
Use Case 3.7: Thêm/Sửa/Xóa ghi chú
"""
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from sqlalchemy import or_
from app.core.database import get_db
from app.models.user import User
from app.models.note import Note
from app.schemas.note import NoteCreate, NoteUpdate, NoteResponse
from app.api.deps import get_current_user

router = APIRouter(prefix="/notes", tags=["Ghi chú"])


@router.get("/", response_model=list[NoteResponse])
def list_notes(
    search: str = Query(None, description="Tìm kiếm theo tiêu đề, nội dung, tag"),
    tag: str = Query(None, description="Lọc theo tag"),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Lấy danh sách ghi chú, có hỗ trợ tìm kiếm và lọc"""
    query = db.query(Note).filter(Note.user_id == current_user.id)

    if search:
        kw = f"%{search}%"
        query = query.filter(or_(
            Note.title.ilike(kw),
            Note.content.ilike(kw),
            Note.tag.ilike(kw),
            Note.related_subject.ilike(kw),
        ))

    if tag:
        query = query.filter(Note.tag == tag)

    # Ghim lên đầu, sau đó sắp xếp theo thời gian cập nhật mới nhất
    notes = query.order_by(Note.is_pinned.desc(), Note.updated_at.desc()).all()
    return notes


@router.post("/", response_model=NoteResponse, status_code=201)
def create_note(
    data: NoteCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Use Case 3.7: Thêm ghi chú mới"""
    if not data.content.strip():
        raise HTTPException(status_code=400, detail="Nội dung không được để trống")

    note = Note(**data.model_dump(), user_id=current_user.id)
    db.add(note)
    db.commit()
    db.refresh(note)
    return note


@router.get("/tags", response_model=list[str])
def list_tags(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Lấy danh sách các tag đã dùng"""
    rows = db.query(Note.tag).filter(
        Note.user_id == current_user.id,
        Note.tag.isnot(None),
        Note.tag != "",
    ).distinct().all()
    return [r[0] for r in rows if r[0]]


@router.get("/{note_id}", response_model=NoteResponse)
def get_note(
    note_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    note = db.query(Note).filter(
        Note.id == note_id, Note.user_id == current_user.id
    ).first()
    if not note:
        raise HTTPException(status_code=404, detail="Ghi chú không tồn tại")
    return note


@router.put("/{note_id}", response_model=NoteResponse)
def update_note(
    note_id: int,
    data: NoteUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Use Case 3.8: Sửa ghi chú"""
    note = db.query(Note).filter(
        Note.id == note_id, Note.user_id == current_user.id
    ).first()
    if not note:
        raise HTTPException(status_code=404, detail="Ghi chú không tồn tại")

    update_data = data.model_dump(exclude_unset=True)
    if "content" in update_data and not update_data["content"].strip():
        raise HTTPException(status_code=400, detail="Nội dung ghi chú không được để trống")

    for key, value in update_data.items():
        setattr(note, key, value)

    db.commit()
    db.refresh(note)
    return note


@router.delete("/{note_id}", status_code=204)
def delete_note(
    note_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Use Case 3.9: Xóa ghi chú"""
    note = db.query(Note).filter(
        Note.id == note_id, Note.user_id == current_user.id
    ).first()
    if not note:
        raise HTTPException(
            status_code=404,
            detail="Ghi chú không còn tồn tại hoặc lỗi hệ thống, vui lòng tải lại trang"
        )
    db.delete(note)
    db.commit()
