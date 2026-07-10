from typing import Any

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from auth import hash_password
from db.database import get_conn
from db.helpers import MEMBER_COLUMNS, insert_rows, update_row, delete_rows
from deps import get_current_user, require_admin

router = APIRouter(prefix="/api/members", tags=["members"])


@router.post("/bulk_insert")
def bulk_insert(rows: list[dict[str, Any]], user: dict = Depends(get_current_user)):
    return insert_rows("members", MEMBER_COLUMNS, rows)


@router.post("/bulk_delete")
def bulk_delete(body: dict[str, Any], user: dict = Depends(get_current_user)):
    delete_rows("members", body.get("ids", []))
    return {"ok": True}


@router.patch("/{member_id}")
def update_member(member_id: str, fields: dict[str, Any], user: dict = Depends(get_current_user)):
    updated = update_row("members", MEMBER_COLUMNS, member_id, fields)
    if not updated:
        raise HTTPException(404, "구성원을 찾을 수 없습니다.")
    return updated


class ResetPasswordReq(BaseModel):
    new_password: str


@router.post("/{member_id}/reset_password")
def reset_password(member_id: str, req: ResetPasswordReq, user: dict = Depends(require_admin)):
    conn = get_conn()
    row = conn.execute("SELECT id FROM members WHERE id = ?", (member_id,)).fetchone()
    if not row:
        conn.close()
        raise HTTPException(404, "구성원을 찾을 수 없습니다.")
    conn.execute(
        "UPDATE members SET password_hash = ? WHERE id = ?",
        (hash_password(req.new_password), member_id),
    )
    conn.commit()
    conn.close()
    return {"ok": True}
