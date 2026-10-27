import re
from typing import Any, Literal

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field

from asset_ops import apply_change, check_scope
from auth import hash_password
from backup_db import backup
from db.database import db
from deps import MEMBER_PUBLIC, require_admin, require_not_viewer

router = APIRouter(prefix="/api/members", tags=["members"])

# permission·passwordHash·status는 여기서 못 바꾼다 — 권한은 /permission, 퇴직은 /retire 전용
EDITABLE = ["employeeNo", "name", "departmentId", "position", "email"]
EMAIL = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")


def _clean(fields: dict) -> dict:
    bad = set(fields) - set(EDITABLE)
    if bad:
        raise HTTPException(400, f"수정할 수 없는 항목입니다: {', '.join(sorted(bad))}")
    out = {k: (v.strip() or None) if isinstance(v, str) else v for k, v in fields.items()}
    for k in ("employeeNo", "name"):
        if k in out and not out[k]:
            raise HTTPException(400, "사번과 이름은 필수입니다.")
    if out.get("email") and not EMAIL.match(out["email"]):
        raise HTTPException(400, f"이메일 형식이 올바르지 않습니다: {out['email']}")
    return out


def _check_dept(conn, dept_id):
    if dept_id is None:
        return
    row = conn.execute("SELECT active FROM departments WHERE id = ?", (dept_id,)).fetchone()
    if not row or not row["active"]:
        raise HTTPException(400, "없거나 사용하지 않는 부서입니다.")


def _get(conn, member_id) -> dict:
    row = conn.execute(f"SELECT {MEMBER_PUBLIC} FROM members WHERE id = ?", (member_id,)).fetchone()
    if not row:
        raise HTTPException(404, "구성원을 찾을 수 없습니다.")
    return dict(row)


@router.post("")
def create_member(fields: dict[str, Any], user: dict = Depends(require_not_viewer)):
    fields = _clean(fields)
    if not fields.get("employeeNo") or not fields.get("name"):
        raise HTTPException(400, "사번과 이름은 필수입니다.")
    check_scope(user, fields.get("departmentId"), what="구성원")
    with db(write=True) as conn:
        _check_dept(conn, fields.get("departmentId"))
        cur = conn.execute(f"INSERT INTO members ({', '.join(fields)}) VALUES ({', '.join('?' for _ in fields)})",
                           list(fields.values()))
        return _get(conn, cur.lastrowid)


class UpdateReq(BaseModel):
    fields: dict[str, Any]
    moveAssets: bool = False   # 부서 변경 시 보유 자산도 새 부서로 이동(이동 이력 생성)


@router.patch("/{member_id}")
def update_member(member_id: int, req: UpdateReq, user: dict = Depends(require_not_viewer)):
    fields = _clean(req.fields)
    with db(write=True) as conn:
        old = _get(conn, member_id)
        new_dept = fields.get("departmentId", old["departmentId"])
        check_scope(user, old["departmentId"], new_dept, what="구성원")
        changes = {k: v for k, v in fields.items() if old[k] != v}
        if "departmentId" in changes:
            _check_dept(conn, new_dept)
        if changes:
            conn.execute(f"UPDATE members SET {', '.join(f'{k} = ?' for k in changes)} WHERE id = ?",
                         [*changes.values(), member_id])
        moved = []
        if req.moveAssets and "departmentId" in changes:
            for a in conn.execute("SELECT * FROM assets WHERE memberId = ? AND isDisposed = 0", (member_id,)).fetchall():
                # 권한은 위에서 구성원 기준으로 확인 (manager는 자기 부서 안에서만 이동 가능)
                apply_change(conn, user, dict(a), {"departmentId": new_dept}, None, "구성원 부서 변경", scope=False)
                moved.append(a["id"])
        return {**_get(conn, member_id), "movedAssets": moved}


# ── 구성원 일괄 등록 (설계안 3-3·3-4) — 사번 기준: 없으면 등록, 있으면 갱신 ──
IMPORT_COLUMNS = ["사번", "이름", "법인코드", "부서", "직급", "이메일", "재직상태"]


class ImportReq(BaseModel):
    rows: list[dict[str, Any]] = Field(max_length=3000)


def _cell(row, key) -> str:
    v = row.get(key)
    return "" if v is None else str(v).strip()


def plan_member_import(conn, rows: list[dict]) -> tuple[list[dict], list[dict]]:
    """행별 검증. (적용할 작업 목록, 오류 목록[행·칸·사유]) 반환. DB는 읽기만 한다"""
    depts = {(r["code"], r["name"]): r for r in conn.execute(
        "SELECT d.id, d.name, d.active, c.code FROM departments d JOIN corporations c ON c.id = d.corporationId")}
    corps = {r["code"] for r in conn.execute("SELECT code FROM corporations")}
    existing = {r["employeeNo"]: dict(r) for r in conn.execute(f"SELECT {MEMBER_PUBLIC} FROM members")}
    email_owner = {m["email"].lower(): no for no, m in existing.items() if m["email"]}
    holding = {r[0] for r in conn.execute("SELECT DISTINCT memberId FROM assets WHERE memberId IS NOT NULL AND isDisposed = 0")}

    ops, errors, seen_no, seen_email = [], [], {}, {}
    for i, row in enumerate(rows):
        line = i + 2   # 1행은 머리글

        def err(col, reason):
            errors.append({"row": line, "column": col, "reason": reason})

        if not any(_cell(row, k) for k in IMPORT_COLUMNS):
            continue   # 빈 행은 건너뜀
        no, name, dept_name = _cell(row, "사번"), _cell(row, "이름"), _cell(row, "부서")
        corp = _cell(row, "법인코드").upper()
        email, status = _cell(row, "이메일") or None, _cell(row, "재직상태") or "재직"
        n = len(errors)
        if not no:
            err("사번", "필수 항목입니다.")
        elif no in seen_no:
            err("사번", f"파일 안에서 중복입니다 ({seen_no[no]}행).")
        else:
            seen_no[no] = line
        if not name:
            err("이름", "필수 항목입니다.")
        dept = depts.get((corp, dept_name))
        if not corp:
            err("법인코드", "필수 항목입니다.")
        elif corp not in corps:
            err("법인코드", f"없는 법인코드입니다: {corp}")
        elif not dept_name:
            err("부서", "필수 항목입니다.")
        elif not dept:
            err("부서", f"{corp} 법인에 없는 부서입니다: {dept_name}")
        elif not dept["active"]:
            err("부서", f"사용하지 않는 부서입니다: {dept_name}")
        if status not in ("재직", "퇴직"):
            err("재직상태", f"재직 또는 퇴직만 입력할 수 있습니다: {status}")
        if email:
            key = email.lower()
            if not EMAIL.match(email):
                err("이메일", f"형식이 올바르지 않습니다: {email}")
            elif key in seen_email:
                err("이메일", f"파일 안에서 중복입니다 ({seen_email[key]}행).")
            elif email_owner.get(key, no) != no:
                err("이메일", f"다른 구성원(사번 {email_owner[key]})이 쓰는 이메일입니다.")
            seen_email.setdefault(key, line)
        old = existing.get(no)
        if old and status == "퇴직" and old["status"] == "재직" and old["id"] in holding:
            err("재직상태", "보유 자산이 있어 가져오기로 퇴직 처리할 수 없습니다. 구성원 화면에서 퇴직 처리하세요.")
        if len(errors) > n:
            continue
        fields = {"employeeNo": no, "name": name, "departmentId": dept["id"],
                  "position": _cell(row, "직급") or None, "email": email, "status": status}
        if not old:
            ops.append({"action": "create", "fields": fields})
        else:
            changes = {k: v for k, v in fields.items() if old[k] != v}
            ops.append({"action": "update" if changes else "same", "id": old["id"], "fields": changes})
    return ops, errors


@router.post("/import")
def import_members(req: ImportReq, dry_run: bool = False, user: dict = Depends(require_admin)):
    # 쓰기 잠금을 먼저 잡고 검증 → 백업 → 저장. 그 사이 다른 쓰기가 끼지 않는다
    with db(write=not dry_run) as conn:
        ops, errors = plan_member_import(conn, req.rows)
        summary = {
            "total": len(ops) + len({e["row"] for e in errors}),
            **{k: sum(o["action"] == k for o in ops) for k in ("create", "update", "same")},
            "errors": errors, "saved": False,
        }
        if dry_run or errors:
            return summary
        summary["backup"] = backup("before_member_import").name
        for o in ops:
            f = o["fields"]
            if o["action"] == "create":
                conn.execute(f"INSERT INTO members ({', '.join(f)}) VALUES ({', '.join('?' for _ in f)})", list(f.values()))
            elif o["action"] == "update":
                conn.execute(f"UPDATE members SET {', '.join(f'{k} = ?' for k in f)} WHERE id = ?", [*f.values(), o["id"]])
        summary["saved"] = True
        return summary


class RetireReq(BaseModel):
    eventDate: str | None = Field(None, pattern=r"^\d{4}-\d{2}-\d{2}$")


@router.post("/{member_id}/retire")
def retire(member_id: int, req: RetireReq, user: dict = Depends(require_not_viewer)):
    # 퇴직 + 보유 자산 전부 반납(→ 보관)을 한 트랜잭션으로
    with db(write=True) as conn:
        row = _get(conn, member_id)
        if row["status"] == "퇴직":
            raise HTTPException(400, "이미 퇴직 처리된 구성원입니다.")
        if member_id == user["id"]:
            raise HTTPException(400, "자기 자신은 퇴직 처리할 수 없습니다.")
        check_scope(user, row["departmentId"], what="구성원")
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
        return _get(conn, member_id)


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
