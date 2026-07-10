from typing import Any

from fastapi import APIRouter, Depends, HTTPException

from db.database import get_conn
from db.helpers import (
    INSPECTION_COLUMNS, INSPECTION_ITEM_COLUMNS,
    insert_rows, update_row, delete_rows,
)
from deps import get_current_user

router = APIRouter(prefix="/api/inspections", tags=["inspections"])


@router.post("")
def create_inspection(fields: dict[str, Any], user: dict = Depends(get_current_user)):
    inserted = insert_rows("inspections", INSPECTION_COLUMNS, [fields])
    return inserted[0]


@router.patch("/{inspection_id}")
def update_inspection(inspection_id: int, fields: dict[str, Any], user: dict = Depends(get_current_user)):
    updated = update_row("inspections", INSPECTION_COLUMNS, inspection_id, fields)
    if not updated:
        raise HTTPException(404, "실사를 찾을 수 없습니다.")
    return updated


@router.delete("/{inspection_id}")
def delete_inspection(inspection_id: int, user: dict = Depends(get_current_user)):
    delete_rows("inspections", [inspection_id])
    conn = get_conn()
    conn.execute("DELETE FROM inspection_items WHERE inspectionId = ?", (inspection_id,))
    conn.commit()
    conn.close()
    return {"ok": True}


@router.get("/current")
def current_inspection(user: dict = Depends(get_current_user)):
    conn = get_conn()
    row = conn.execute(
        'SELECT id FROM inspections WHERE status = ? LIMIT 1', ("진행중",)
    ).fetchone()
    conn.close()
    return dict(row) if row else None


@router.post("/items/bulk_insert")
def bulk_insert_items(rows: list[dict[str, Any]], user: dict = Depends(get_current_user)):
    return insert_rows("inspection_items", INSPECTION_ITEM_COLUMNS, rows)


@router.get("/items")
def list_items(
    inspectionId: int | None = None,
    assetId: str | None = None,
    user: dict = Depends(get_current_user),
):
    conn = get_conn()
    sql = "SELECT * FROM inspection_items WHERE 1=1"
    params: list[Any] = []
    if inspectionId is not None:
        sql += " AND inspectionId = ?"
        params.append(inspectionId)
    if assetId is not None:
        sql += " AND assetId = ?"
        params.append(assetId)
    rows = conn.execute(sql, params).fetchall()
    conn.close()
    return [dict(r) for r in rows]


@router.patch("/items/{item_id}")
def update_item(item_id: int, fields: dict[str, Any], user: dict = Depends(get_current_user)):
    updated = update_row("inspection_items", INSPECTION_ITEM_COLUMNS, item_id, fields)
    if not updated:
        raise HTTPException(404, "실사 항목을 찾을 수 없습니다.")
    return updated
