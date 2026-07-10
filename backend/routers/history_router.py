from typing import Any

from fastapi import APIRouter, Depends, HTTPException

from db.database import get_conn
from db.helpers import HISTORY_COLUMNS, insert_rows, delete_rows
from deps import get_current_user, require_admin

router = APIRouter(prefix="/api/history", tags=["history"])


@router.get("")
def list_history(user: dict = Depends(get_current_user)):
    conn = get_conn()
    rows = conn.execute(
        'SELECT * FROM history ORDER BY date DESC, id DESC'
    ).fetchall()
    conn.close()
    return [dict(r) for r in rows]


@router.post("/bulk_insert")
def bulk_insert(rows: list[dict[str, Any]], user: dict = Depends(get_current_user)):
    return insert_rows("history", HISTORY_COLUMNS, rows)


@router.delete("/{history_id}")
def delete_history(history_id: int, user: dict = Depends(require_admin)):
    delete_rows("history", [history_id])
    return {"ok": True}
