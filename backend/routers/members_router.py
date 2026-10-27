from typing import Any, Literal

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field

from asset_ops import apply_change, check_scope
from auth import hash_password
from db.database import db
from db.helpers import MEMBER_COLUMNS, insert_rows, update_row, delete_rows
from deps import MEMBER_PUBLIC, require_admin, require_not_viewer

router = APIRouter(prefix="/api/members", tags=["members"])


def _public(rows: list[dict]) -> list[dict]:
    return [{k: v for k, v in r.items() if k != "passwordHash"} for r in rows]


@router.post("/bulk_insert")
def bulk_insert(rows: list[dict[str, Any]], user: dict = Depends(require_not_viewer)):
    return _public(insert_rows("members", MEMBER_COLUMNS, rows))


@router.post("/bulk_delete")
def bulk_delete(body: dict[str, Any], user: dict = Depends(require_admin)):
    delete_rows("members", body.get("ids", []))
    return {"ok": True}


@router.patch("/{member_id}")
def update_member(member_id: int, fields: dict[str, Any], user: dict = Depends(require_not_viewer)):
    # MEMBER_COLUMNS에 permission이 없으므로 여기서는 권한을 바꿀 수 없다 (아래 /permission 전용)
    updated = update_row("members", MEMBER_COLUMNS, member_id, fields)
    if not updated:
        raise HTTPException(404, "구성원을 찾을 수 없습니다.")
    return _public([updated])[0]


class RetireReq(BaseModel):
    eventDate: str | None = Field(None, pattern=r"^\d{4}-\d{2}-\d{2}$")


@router.post("/{member_id}/retire")
def retire(member_id: int, req: RetireReq, user: dict = Depends(require_not_viewer)):
    # 퇴직 + 보유 자산 전부 반납(→ 보관)을 한 트랜잭션으로
    with db(write=True) as conn:
        row = conn.execute(f"SELECT {MEMBER_PUBLIC} FROM members WHERE id = ?", (member_id,)).fetchone()
        if not row:
            raise HTTPException(404, "구성원을 찾을 수 없습니다.")
        if row["status"] == "퇴직":
            raise HTTPException(400, "이미 퇴직 처리된 구성원입니다.")
        if member_id == user["id"]:
            raise HTTPException(400, "자기 자신은 퇴직 처리할 수 없습니다.")
        check_scope(user, row["departmentId"])
        assets = conn.execute("SELECT * FROM assets WHERE memberId = ? AND isDisposed = 0", (member_id,)).fetchall()
        for a in assets:
            # 다른 부서 자산이라도 퇴직자 보유분이면 반납 처리 (구성원 기준 권한은 위에서 확인)
            apply_change(conn, user, dict(a), {"memberId": None}, req.eventDate, "퇴직 반납", scope=False)
        conn.execute("UPDATE members SET status = '퇴직' WHERE id = ?", (member_id,))
        return {"returned": [a["id"] for a in assets]}


class PermissionReq(BaseModel):
    permission: Literal["admin", "manager", "viewer"] | None


@router.patch("/{member_id}/permission")
def set_permission(member_id: int, req: PermissionReq, user: dict = Depends(require_admin)):
    if member_id == user["id"] and req.permission != "admin":
        raise HTTPException(400, "자기 자신의 관리자 권한은 해제할 수 없습니다.")
    with db() as conn:
        # 권한 회수 시 비밀번호도 지워 재부여 때 새로 발급받게 한다
        cur = conn.execute(
            "UPDATE members SET permission = ?, passwordHash = CASE WHEN ? IS NULL THEN NULL ELSE passwordHash END WHERE id = ?",
            (req.permission, req.permission, member_id),
        )
        if not cur.rowcount:
            raise HTTPException(404, "구성원을 찾을 수 없습니다.")
        row = conn.execute(f"SELECT {MEMBER_PUBLIC} FROM members WHERE id = ?", (member_id,)).fetchone()
    return dict(row)


class ResetPasswordReq(BaseModel):
    new_password: str


@router.post("/{member_id}/reset_password")
def reset_password(member_id: int, req: ResetPasswordReq, user: dict = Depends(require_admin)):
    if len(req.new_password) < 8:
        raise HTTPException(400, "비밀번호는 8자 이상이어야 합니다.")
    with db() as conn:
        row = conn.execute("SELECT permission FROM members WHERE id = ?", (member_id,)).fetchone()
        if not row:
            raise HTTPException(404, "구성원을 찾을 수 없습니다.")
        if row["permission"] is None:
            raise HTTPException(400, "로그인 권한이 없는 구성원입니다. 권한을 먼저 부여하세요.")
        conn.execute("UPDATE members SET passwordHash = ? WHERE id = ?", (hash_password(req.new_password), member_id))
    return {"ok": True}
