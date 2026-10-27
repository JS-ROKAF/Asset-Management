from typing import Any

from fastapi import APIRouter, Depends, HTTPException

from db.database import db
from db.helpers import ASSET_COLUMNS, insert_rows, update_row, delete_rows
from deps import get_current_user, require_admin, require_not_viewer

router = APIRouter(prefix="/api/assets", tags=["assets"])


@router.get("/{asset_id}")
def get_asset(asset_id: str, user: dict = Depends(get_current_user)):
    with db() as conn:
        row = conn.execute("SELECT * FROM assets WHERE id = ?", (asset_id,)).fetchone()
    if not row:
        raise HTTPException(404, "자산을 찾을 수 없습니다.")
    return dict(row)


@router.post("/bulk_insert")
def bulk_insert(rows: list[dict[str, Any]], user: dict = Depends(require_not_viewer)):
    return insert_rows("assets", ASSET_COLUMNS, rows)


@router.post("/bulk_delete")
def bulk_delete(body: dict[str, Any], user: dict = Depends(require_admin)):
    delete_rows("assets", body.get("ids", []))
    return {"ok": True}


@router.patch("/{asset_id}")
def update_asset(asset_id: str, fields: dict[str, Any], user: dict = Depends(require_not_viewer)):
    updated = update_row("assets", ASSET_COLUMNS, asset_id, fields)
    if not updated:
        raise HTTPException(404, "자산을 찾을 수 없습니다.")
    return updated
