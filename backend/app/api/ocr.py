"""
API Trích xuất dữ liệu học tập từ ảnh (OCR + AI)
Use Case 3.12: Trích xuất dữ liệu học tập từ ảnh
"""
from fastapi import APIRouter, Depends, UploadFile, File, Form, HTTPException
from app.models.user import User
from app.schemas.chat import OCRResponse
from app.api.deps import get_current_user
from app.services.ai_service import ai_service

router = APIRouter(prefix="/ocr", tags=["Trích xuất ảnh"])

ALLOWED_IMAGE_TYPES = {"image/jpeg", "image/jpg", "image/png", "image/webp"}
MAX_IMAGE_SIZE = 10 * 1024 * 1024  # 10 MB


@router.post("/extract", response_model=OCRResponse)
async def extract_from_image(
    image_type: str = Form(..., description="Loại ảnh: schedule | transcript"),
    file: UploadFile = File(...),
    _: User = Depends(get_current_user),
):
    """
    Trích xuất dữ liệu từ ảnh thời khóa biểu hoặc bảng điểm.
    image_type:
      - "schedule": Ảnh thời khóa biểu
      - "transcript": Ảnh bảng điểm
    """
    if image_type not in ["schedule", "transcript"]:
        raise HTTPException(
            status_code=400,
            detail="Loại ảnh không hợp lệ. Chỉ chấp nhận 'schedule' hoặc 'transcript'."
        )

    if file.content_type not in ALLOWED_IMAGE_TYPES:
        raise HTTPException(
            status_code=400,
            detail="Định dạng file không hợp lệ. Chỉ chấp nhận JPG, PNG, WebP."
        )

    contents = await file.read()
    if len(contents) > MAX_IMAGE_SIZE:
        raise HTTPException(
            status_code=400,
            detail=f"Ảnh vượt quá dung lượng cho phép ({MAX_IMAGE_SIZE // 1024 // 1024} MB)."
        )

    result = await ai_service.extract_from_image(contents, image_type)
    return OCRResponse(
        success=result["success"],
        image_type=image_type,
        items=result["items"],
        message=result["message"],
    )
