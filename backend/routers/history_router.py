from fastapi import APIRouter, Depends

from db.database import db
from db.helpers import delete_rows
from deps import get_current_user, require_admin

router = APIRouter(prefix="/api/history", tags=["history"])


@router.get("")
def list_history(user: dict = Depends(get_current_user)):
    with db() as conn:
        rows = conn.execute("SELECT * FROM history ORDER BY eventDate DESC, id DESC").fetchall()
    return [dict(r) for r in rows]


@router.delete("/{history_id}")
def delete_history(history_id: int, user: dict = Depends(require_admin)):
    delete_rows("history", [history_id])
    return {"ok": True}
