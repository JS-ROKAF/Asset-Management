from typing import Any

from fastapi import APIRouter, Depends, HTTPException

from db.helpers import REQUEST_COLUMNS, insert_rows, update_row, delete_rows
from deps import get_current_user, require_not_viewer

router = APIRouter(prefix="/api/requests", tags=["requests"])


@router.post("")
def create_request(fields: dict[str, Any], user: dict = Depends(get_current_user)):
    # 요청자는 토큰 사용자로 고정 (타인 명의 요청 방지)
    inserted = insert_rows("requests", REQUEST_COLUMNS, [{**fields, "requesterId": user["id"], "status": "대기중"}])
    return inserted[0]


@router.patch("/{request_id}")
def update_request(request_id: int, fields: dict[str, Any], user: dict = Depends(require_not_viewer)):
    updated = update_row("requests", REQUEST_COLUMNS, request_id, fields)
    if not updated:
        raise HTTPException(404, "요청을 찾을 수 없습니다.")
    return updated


@router.delete("/{request_id}")
def delete_request(request_id: int, user: dict = Depends(require_not_viewer)):
    delete_rows("requests", [request_id])
    return {"ok": True}
