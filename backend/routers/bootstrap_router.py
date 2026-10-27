from fastapi import APIRouter, Depends

from deps import MEMBER_PUBLIC, get_current_user
from db.database import db

router = APIRouter(prefix="/api", tags=["bootstrap"])


def _all(conn, sql, params=()):
    return [dict(r) for r in conn.execute(sql, params).fetchall()]


@router.get("/bootstrap")
def bootstrap(user: dict = Depends(get_current_user)):
    with db() as conn:
        data = {
            "corporations": _all(conn, "SELECT * FROM corporations ORDER BY id"),
            "departments": _all(conn, "SELECT * FROM departments ORDER BY id"),
            "assetCategories": _all(conn, "SELECT * FROM asset_categories ORDER BY id"),
            "assetTypes": _all(conn, "SELECT * FROM asset_types ORDER BY id"),
            "assets": _all(conn, "SELECT * FROM assets"),
            "members": _all(conn, f"SELECT {MEMBER_PUBLIC}" + (", loginId" if user["permission"] == "admin" else "") + " FROM members"),
            "history": _all(conn, "SELECT * FROM history ORDER BY eventDate DESC, id DESC"),
            "requests": _all(conn, "SELECT * FROM requests ORDER BY date DESC"),
            "inspections": _all(conn, "SELECT * FROM inspections ORDER BY startedAt DESC"),
            "inspectionChecks": _all(conn, "SELECT * FROM inspection_checks"),
        }

    if user["permission"] != "admin":
        dept = user["departmentId"]
        data["assets"] = [a for a in data["assets"] if a["departmentId"] == dept]
        data["members"] = [m for m in data["members"] if m["departmentId"] == dept]
        ids = {a["id"] for a in data["assets"]}
        for key in ("history", "requests", "inspectionChecks"):
            data[key] = [r for r in data[key] if r["assetId"] in ids]
    return data


@router.get("/health")
def health():
    with db() as conn:
        conn.execute("SELECT 1")
    return {"status": "ok"}


@router.get("/table_counts")
def table_counts(user: dict = Depends(get_current_user)):
    counts = {}
    with db() as conn:
        for table, label in [
            ("assets", "자산"), ("members", "구성원"), ("history", "이력"),
            ("requests", "요청"), ("inspections", "정기실사"),
        ]:
            count = conn.execute(f"SELECT COUNT(*) c FROM {table}").fetchone()["c"]
            counts[table] = {"label": label, "count": count}
    return counts
