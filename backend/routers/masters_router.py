from typing import Any

from fastapi import APIRouter, Depends, HTTPException

from db.database import db
from deps import get_current_user, require_admin

router = APIRouter(prefix="/api/masters", tags=["masters"])

# 테이블별 수정 가능 칸, 그리고 "사용 중이면 못 바꾸는 칸"과 사용처 검사 SQL
SPECS = {
    "corporations": {
        "table": "corporations", "fields": ["code", "name", "active"], "locked": ["code"],
        "used": "SELECT 1 FROM assets WHERE corporationId = :id UNION ALL SELECT 1 FROM departments WHERE corporationId = :id LIMIT 1",
    },
    "departments": {
        "table": "departments", "fields": ["corporationId", "name", "active"], "locked": ["corporationId"],
        "used": "SELECT 1 FROM assets WHERE departmentId = :id UNION ALL SELECT 1 FROM members WHERE departmentId = :id LIMIT 1",
    },
    "types": {
        "table": "asset_types", "fields": ["code", "name", "hasSpecs", "active"], "locked": ["code"],
        "used": "SELECT 1 FROM assets WHERE typeId = :id LIMIT 1",
    },
}


def _spec(kind: str) -> dict:
    if kind not in SPECS:
        raise HTTPException(404, "없는 기준정보입니다.")
    return SPECS[kind]


def _clean(spec, fields: dict) -> dict:
    bad = set(fields) - set(spec["fields"])
    if bad:
        raise HTTPException(400, f"수정할 수 없는 항목입니다: {', '.join(bad)}")
    out = {k: v.strip() if isinstance(v, str) else v for k, v in fields.items()}
    if "code" in out and out["code"]:
        out["code"] = out["code"].upper()
    return out


@router.get("/{kind}")
def list_master(kind: str, user: dict = Depends(get_current_user)):
    with db() as conn:
        return [dict(r) for r in conn.execute(f"SELECT * FROM {_spec(kind)['table']} ORDER BY id")]


@router.post("/{kind}")
def create_master(kind: str, fields: dict[str, Any], user: dict = Depends(require_admin)):
    spec = _spec(kind)
    fields = _clean(spec, fields)
    cols = ", ".join(fields)
    with db(write=True) as conn:
        cur = conn.execute(f"INSERT INTO {spec['table']} ({cols}) VALUES ({', '.join('?' for _ in fields)})",
                           list(fields.values()))
        return dict(conn.execute(f"SELECT * FROM {spec['table']} WHERE id = ?", (cur.lastrowid,)).fetchone())


@router.patch("/{kind}/{item_id}")
def update_master(kind: str, item_id: int, fields: dict[str, Any], user: dict = Depends(require_admin)):
    spec = _spec(kind)
    fields = _clean(spec, fields)
    if not fields:
        raise HTTPException(400, "변경할 항목이 없습니다.")
    with db(write=True) as conn:
        row = conn.execute(f"SELECT * FROM {spec['table']} WHERE id = ?", (item_id,)).fetchone()
        if not row:
            raise HTTPException(404, "항목을 찾을 수 없습니다.")
        locked = [k for k in spec["locked"] if k in fields and fields[k] != row[k]]
        if locked and conn.execute(spec["used"], {"id": item_id}).fetchone():
            raise HTTPException(400, f"사용 중인 항목은 바꿀 수 없습니다: {', '.join(locked)}")
        conn.execute(f"UPDATE {spec['table']} SET {', '.join(f'{k} = ?' for k in fields)} WHERE id = ?",
                     [*fields.values(), item_id])
        return dict(conn.execute(f"SELECT * FROM {spec['table']} WHERE id = ?", (item_id,)).fetchone())
