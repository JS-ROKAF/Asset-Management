from datetime import datetime
from typing import Any

from fastapi import APIRouter, Depends, HTTPException

from db.database import db
from db.helpers import (
    INSPECTION_COLUMNS, INSPECTION_CHECK_COLUMNS,
    insert_rows, update_row, delete_rows,
)
from deps import get_current_user, require_admin

router = APIRouter(prefix="/api/inspections", tags=["inspections"])


@router.post("")
def create_inspection(fields: dict[str, Any], user: dict = Depends(require_admin)):
    inserted = insert_rows("inspections", INSPECTION_COLUMNS, [{**fields, "createdBy": user["id"]}])
    return inserted[0]


@router.patch("/{inspection_id}")
def update_inspection(inspection_id: int, fields: dict[str, Any], user: dict = Depends(require_admin)):
    updated = update_row("inspections", INSPECTION_COLUMNS, inspection_id, fields)
    if not updated:
        raise HTTPException(404, "실사를 찾을 수 없습니다.")
    return updated


@router.delete("/{inspection_id}")
def delete_inspection(inspection_id: int, user: dict = Depends(require_admin)):
    with db() as conn:
        conn.execute("DELETE FROM inspection_checks WHERE inspectionId = ?", (inspection_id,))
        conn.execute("DELETE FROM inspections WHERE id = ?", (inspection_id,))
    return {"ok": True}


@router.get("/current")
def current_inspection(user: dict = Depends(get_current_user)):
    with db() as conn:
        row = conn.execute("SELECT id FROM inspections WHERE status = ? LIMIT 1", ("진행중",)).fetchone()
    return dict(row) if row else None


# ponytail: 실사 체크 흐름은 2단계(설계안 4-3)에서 재설계. 지금은 inspection_checks로 테이블만 맞춤
@router.post("/checks/bulk_insert")
def bulk_insert_checks(rows: list[dict[str, Any]], user: dict = Depends(get_current_user)):
    now = datetime.now().isoformat(timespec="seconds")
    return insert_rows("inspection_checks", INSPECTION_CHECK_COLUMNS,
                       [{**r, "checkedBy": user["id"], "checkedAt": now} for r in rows])


@router.get("/checks")
def list_checks(
    inspectionId: int | None = None,
    assetId: int | None = None,
    user: dict = Depends(get_current_user),
):
    sql = "SELECT * FROM inspection_checks WHERE 1=1"
    params: list[Any] = []
    if inspectionId is not None:
        sql += " AND inspectionId = ?"
        params.append(inspectionId)
    if assetId is not None:
        sql += " AND assetId = ?"
        params.append(assetId)
    with db() as conn:
        rows = conn.execute(sql, params).fetchall()
    return [dict(r) for r in rows]


@router.patch("/checks/{check_id}")
def update_check(check_id: int, fields: dict[str, Any], user: dict = Depends(get_current_user)):
    now = datetime.now().isoformat(timespec="seconds")
    updated = update_row("inspection_checks", INSPECTION_CHECK_COLUMNS, check_id,
                         {**fields, "checkedBy": user["id"], "checkedAt": now})
    if not updated:
        raise HTTPException(404, "실사 항목을 찾을 수 없습니다.")
    return updated
