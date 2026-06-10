"""
API Quản lý Lịch học (Schedule)
Use Case 3.5: Quản lý lịch học và nhắc nhở
"""
from datetime import datetime, time, timedelta
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.models.user import User
from app.models.schedule import Schedule
from app.schemas.schedule import (
    ScheduleCreate, ScheduleUpdate, ScheduleResponse, ScheduleBulkCreate
)
from app.api.deps import get_current_user

router = APIRouter(prefix="/schedules", tags=["Lịch học"])


@router.get("/", response_model=list[ScheduleResponse])
def list_schedules(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Lấy toàn bộ lịch học của sinh viên"""
    schedules = db.query(Schedule).filter(
        Schedule.user_id == current_user.id
    ).order_by(Schedule.day_of_week, Schedule.start_time).all()
    return schedules


@router.get("/upcoming", response_model=list[dict])
def upcoming_reminders(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Lấy danh sách buổi học sắp diễn ra trong 24h tới (cho thông báo nhắc nhở).
    """
    schedules = db.query(Schedule).filter(Schedule.user_id == current_user.id).all()

    now = datetime.now()
    today_day = now.isoweekday() + 1  # Python: Monday=1, ta: Monday=2

    upcoming = []
    for s in schedules:
        # Tính thời điểm tiếp theo của lịch này trong tuần
        days_ahead = s.day_of_week - today_day
        if days_ahead < 0:
            days_ahead += 7
        elif days_ahead == 0:
            # Cùng ngày: kiểm tra giờ đã qua chưa
            class_dt = datetime.combine(now.date(), s.start_time)
            if class_dt < now:
                days_ahead = 7  # Lùi sang tuần sau

        next_class = datetime.combine(now.date() + timedelta(days=days_ahead), s.start_time)
        reminder_time = next_class - timedelta(minutes=s.reminder_minutes or 30)

        # Chỉ trả về các lịch trong 24h tới
        if (next_class - now).total_seconds() <= 24 * 3600:
            upcoming.append({
                "id": s.id,
                "subject_name": s.subject_name,
                "subject_code": s.subject_code,
                "teacher": s.teacher,
                "room": s.room,
                "start_time": s.start_time.strftime("%H:%M"),
                "end_time": s.end_time.strftime("%H:%M"),
                "next_class_at": next_class.isoformat(),
                "reminder_at": reminder_time.isoformat(),
                "minutes_until": int((next_class - now).total_seconds() / 60),
            })

    upcoming.sort(key=lambda x: x["next_class_at"])
    return upcoming


@router.post("/", response_model=ScheduleResponse, status_code=201)
def create_schedule(
    data: ScheduleCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Thêm một buổi học vào lịch"""
    schedule = Schedule(**data.model_dump(), user_id=current_user.id)
    db.add(schedule)
    db.commit()
    db.refresh(schedule)
    return schedule


@router.post("/bulk", response_model=list[ScheduleResponse], status_code=201)
def create_bulk_schedules(
    data: ScheduleBulkCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Tạo nhiều lịch học cùng lúc (dùng sau khi OCR)"""
    created = []
    for item in data.schedules:
        schedule = Schedule(**item.model_dump(), user_id=current_user.id)
        db.add(schedule)
        created.append(schedule)
    db.commit()
    for s in created:
        db.refresh(s)
    return created


@router.get("/{schedule_id}", response_model=ScheduleResponse)
def get_schedule(
    schedule_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    schedule = db.query(Schedule).filter(
        Schedule.id == schedule_id,
        Schedule.user_id == current_user.id
    ).first()
    if not schedule:
        raise HTTPException(status_code=404, detail="Không tìm thấy lịch học")
    return schedule


@router.put("/{schedule_id}", response_model=ScheduleResponse)
def update_schedule(
    schedule_id: int,
    data: ScheduleUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    schedule = db.query(Schedule).filter(
        Schedule.id == schedule_id,
        Schedule.user_id == current_user.id
    ).first()
    if not schedule:
        raise HTTPException(status_code=404, detail="Không tìm thấy lịch học")

    update_data = data.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(schedule, key, value)

    db.commit()
    db.refresh(schedule)
    return schedule


@router.delete("/{schedule_id}", status_code=204)
def delete_schedule(
    schedule_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    schedule = db.query(Schedule).filter(
        Schedule.id == schedule_id,
        Schedule.user_id == current_user.id
    ).first()
    if not schedule:
        raise HTTPException(status_code=404, detail="Không tìm thấy lịch học")
    db.delete(schedule)
    db.commit()


@router.delete("/", status_code=204)
def delete_all_schedules(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Xóa toàn bộ lịch học (để nhập lại từ đầu)"""
    db.query(Schedule).filter(Schedule.user_id == current_user.id).delete()
    db.commit()


@router.post("/remind-email", status_code=200)
async def send_reminder_email(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Gửi email nhắc nhở lịch học sắp tới trong 24h cho người dùng hiện tại.
    Được gọi thủ công hoặc bởi frontend khi phát hiện lịch gần đến.
    """
    from app.services.email_service import send_schedule_reminder
    # Lấy lịch sắp tới bằng cách tái dùng logic của upcoming_reminders
    from datetime import datetime as _dt, timedelta as _td, date as _date, time as _time
    schedules = db.query(Schedule).filter(Schedule.user_id == current_user.id).all()
    now = _dt.now()
    today_day = now.isoweekday() + 1
    upcoming = []
    for s in schedules:
        days_ahead = s.day_of_week - today_day
        if days_ahead < 0:
            days_ahead += 7
        elif days_ahead == 0:
            class_dt = _dt.combine(now.date(), s.start_time)
            if class_dt < now:
                days_ahead = 7
        next_class = _dt.combine(now.date() + _td(days=days_ahead), s.start_time)
        if (next_class - now).total_seconds() <= 24 * 3600:
            upcoming.append({
                "subject_name": s.subject_name, "room": s.room, "teacher": s.teacher,
                "start_time": s.start_time.strftime("%H:%M"),
                "end_time": s.end_time.strftime("%H:%M"),
                "minutes_until": int((next_class - now).total_seconds() / 60),
            })
    upcoming.sort(key=lambda x: x["minutes_until"])
    if not upcoming:
        return {"message": "Không có lịch học nào trong 24h tới", "sent": False}

    try:
        await send_schedule_reminder(current_user.email, current_user.full_name, upcoming)
        return {"message": f"Đã gửi nhắc nhở tới {current_user.email}", "sent": True, "count": len(upcoming)}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Lỗi gửi email: {str(e)}")
