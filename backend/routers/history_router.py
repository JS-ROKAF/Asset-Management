from datetime import datetime
from typing import Any

from fastapi import APIRouter, Depends

from db.database import db
from db.helpers import HISTORY_COLUMNS, insert_rows, delete_rows
from deps import get_current_user, require_admin, require_not_viewer

router = APIRouter(prefix="/api/history", tags=["history"])


@router.get("")
def list_history(user: dict = Depends(get_current_user)):
    with db() as conn:
        rows = conn.execute("SELECT * FROM history ORDER BY eventDate DESC, id DESC").fetchall()
    return [dict(r) for r in rows]


@router.post("/bulk_insert")
def bulk_insert(rows: list[dict[str, Any]], user: dict = Depends(require_not_viewer)):
    # 기록자·기록시각은 브라우저 값을 믿지 않고 서버가 채운다
    now = datetime.now().isoformat(timespec="seconds")
    return insert_rows("history", HISTORY_COLUMNS + ["recordedAt", "recordedBy"],
                       [{**r, "recordedAt": now, "recordedBy": user["id"]} for r in rows])


@router.delete("/{history_id}")
def delete_history(history_id: int, user: dict = Depends(require_admin)):
    delete_rows("history", [history_id])
    return {"ok": True}
