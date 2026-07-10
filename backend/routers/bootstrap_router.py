from fastapi import APIRouter, Depends

from deps import get_current_user
from db.database import get_conn

router = APIRouter(prefix="/api", tags=["bootstrap"])


@router.get("/bootstrap")
def bootstrap(user: dict = Depends(get_current_user)):
    is_admin = user.get("permission") == "admin"
    dept = user.get("department")
    conn = get_conn()

    assets = [dict(r) for r in conn.execute("SELECT * FROM assets").fetchall()]
    members = [dict(r) for r in conn.execute("SELECT * FROM members").fetchall()]
    history = [dict(r) for r in conn.execute(
        'SELECT * FROM history ORDER BY date DESC'
    ).fetchall()]
    requests_ = [dict(r) for r in conn.execute(
        'SELECT * FROM requests ORDER BY date DESC'
    ).fetchall()]
    inspections = [dict(r) for r in conn.execute(
        'SELECT * FROM inspections ORDER BY startDate DESC'
    ).fetchall()]
    inspection_items = [dict(r) for r in conn.execute("SELECT * FROM inspection_items").fetchall()]
    conn.close()

    if not is_admin:
        assets = [a for a in assets if a.get("department") == dept]
        members = [m for m in members if m.get("department") == dept]
        asset_ids_in_dept = {a["id"] for a in assets}
        history = [h for h in history if h.get("assetId") in asset_ids_in_dept]
        requests_ = [r for r in requests_ if r.get("assetId") in asset_ids_in_dept]
        inspection_items = [i for i in inspection_items if i.get("department") == dept]

    return {
        "assets": assets,
        "members": members,
        "history": history,
        "requests": requests_,
        "inspections": inspections,
        "inspectionItems": inspection_items,
    }


@router.get("/health")
def health():
    conn = get_conn()
    conn.execute("SELECT 1")
    conn.close()
    return {"status": "ok"}


@router.get("/table_counts")
def table_counts(user: dict = Depends(get_current_user)):
    conn = get_conn()
    counts = {}
    for table, label in [
        ("assets", "자산"), ("members", "구성원"), ("history", "이력"),
        ("requests", "요청"), ("inspections", "정기실사"),
    ]:
        count = conn.execute(f"SELECT COUNT(*) c FROM {table}").fetchone()["c"]
        counts[table] = {"label": label, "count": count}
    conn.close()
    return counts
