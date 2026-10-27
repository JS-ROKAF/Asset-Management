import re
from typing import Any, Literal

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field

from asset_ops import ambiguous_msg, apply_change, check_scope, find_member, member_index
from auth import hash_password
from backup_db import backup
from db.database import db
from deps import MEMBER_PUBLIC, require_admin, require_not_viewer

router = APIRouter(prefix="/api/members", tags=["members"])

# permission·loginId·passwordHash·status는 여기서 못 바꾼다 — 권한·아이디는 /permission, 퇴직은 /retire 전용
EDITABLE = ["name", "departmentId", "part", "position", "email"]
EMAIL = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")


def _clean(fields: dict) -> dict:
    bad = set(fields) - set(EDITABLE)
    if bad:
        raise HTTPException(400, f"수정할 수 없는 항목입니다: {', '.join(sorted(bad))}")
    out = {k: (v.strip() or None) if isinstance(v, str) else v for k, v in fields.items()}
    if "name" in out and (not out["name"] or "/" in out["name"]):
        # "/"는 가져오기의 "이름/부서" 구분자
        raise HTTPException(400, "이름은 필수이며 '/'를 쓸 수 없습니다.")
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
    if not fields.get("name"):
        raise HTTPException(400, "이름은 필수입니다.")
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


# ── 구성원 일괄 등록 (설계안 v2.1 3-3) — 이름 기준: 없으면 등록, 1명이면 갱신, 2명 이상이면 "이름/부서"로 지정 ──
IMPORT_COLUMNS = ["이름", "부서", "파트", "직위", "이메일", "재직상태"]


class ImportReq(BaseModel):
    rows: list[dict[str, Any]] = Field(max_length=3000)


def _cell(row, key) -> str:
    v = row.get(key)
    return "" if v is None else str(v).strip()


def plan_member_import(conn, rows: list[dict]) -> tuple[list[dict], list[dict]]:
    """행별 검증. (적용할 작업 목록, 오류 목록[행·칸·사유]) 반환. DB는 읽기만 한다"""
    depts = {r["name"]: dict(r) for r in conn.execute("SELECT * FROM departments")}
    members = member_index(conn, active_only=False)   # 퇴직자도 갱신(재입사 등) 대상
    email_owner = {m["email"].lower(): m["id"] for m in members if m["email"]}
    holding = {r[0] for r in conn.execute("SELECT DISTINCT memberId FROM assets WHERE memberId IS NOT NULL AND isDisposed = 0")}

    ops, errors, seen, seen_email = [], [], {}, {}
    for i, row in enumerate(rows):
        line = i + 2   # 1행은 머리글

        def err(col, reason):
            errors.append({"row": line, "column": col, "reason": reason})

        if not any(_cell(row, k) for k in IMPORT_COLUMNS):
            continue   # 빈 행은 건너뜀
        who, dept_name = _cell(row, "이름"), _cell(row, "부서")
        if who.startswith("예시"):
            err("이름", "양식의 예시 행입니다. 지우고 다시 올려 주세요.")
            continue
        email, status = _cell(row, "이메일") or None, _cell(row, "재직상태") or "재직"
        n = len(errors)

        old = None
        if not who:
            err("이름", "필수 항목입니다.")
        else:
            hits, with_dept = find_member(members, who)
            if len(hits) > 1:
                err("이름", ambiguous_msg(hits, with_dept))
            elif hits:
                old = hits[0]
            elif with_dept:
                err("이름", f"지정한 구성원이 없습니다: {who}. 신규 등록이면 이름만 적으세요.")
            key = old["id"] if old else who
            if key in seen:
                err("이름", f"파일 안에서 같은 사람이 중복입니다 ({seen[key]}행).")
            seen.setdefault(key, line)

        dept = depts.get(dept_name)
        if not dept_name:
            err("부서", "필수 항목입니다.")
        elif not dept:
            err("부서", f"없는 부서입니다: {dept_name}")
        elif not dept["active"]:
            err("부서", f"사용하지 않는 부서입니다: {dept_name}")
        if status not in ("재직", "퇴직"):
            err("재직상태", f"재직 또는 퇴직만 입력할 수 있습니다: {status}")
        if email:
            low = email.lower()
            if not EMAIL.match(email):
                err("이메일", f"형식이 올바르지 않습니다: {email}")
            elif low in seen_email:
                err("이메일", f"파일 안에서 중복입니다 ({seen_email[low]}행).")
            elif low in email_owner and email_owner[low] != (old and old["id"]):
                err("이메일", "다른 구성원이 쓰는 이메일입니다.")
            seen_email.setdefault(low, line)
        if old and status == "퇴직" and old["status"] == "재직" and old["id"] in holding:
            err("재직상태", "보유 자산이 있어 가져오기로 퇴직 처리할 수 없습니다. 구성원 화면에서 퇴직 처리하세요.")
        if len(errors) > n:
            continue
        fields = {"departmentId": dept["id"], "part": _cell(row, "파트") or None,
                  "position": _cell(row, "직위") or None, "email": email, "status": status}
        if not old:
            ops.append({"action": "create", "fields": {"name": who, **fields}})
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


LOGIN_ID = re.compile(r"^[A-Za-z0-9._-]{2,30}$")


class PermissionReq(BaseModel):
    permission: Literal["admin", "manager", "viewer"] | None
    loginId: str | None = None   # 권한을 줄 때 필수(이미 있으면 생략 가능). 권한 회수 시 무시


@router.patch("/{member_id}/permission")
def set_permission(member_id: int, req: PermissionReq, user: dict = Depends(require_admin)):
    if member_id == user["id"] and req.permission != "admin":
        raise HTTPException(400, "자기 자신의 관리자 권한은 해제할 수 없습니다.")
    login_id = (req.loginId or "").strip() or None
    if login_id and not LOGIN_ID.match(login_id):
        raise HTTPException(400, "아이디는 영문·숫자·. _ - 로 2~30자입니다.")
    with db() as conn:
        row = conn.execute("SELECT loginId FROM members WHERE id = ?", (member_id,)).fetchone()
        if not row:
            raise HTTPException(404, "구성원을 찾을 수 없습니다.")
        if req.permission is None:
            # 권한 회수 시 아이디·비밀번호도 지워 재부여 때 새로 정하게 한다
            conn.execute("UPDATE members SET permission = NULL, loginId = NULL, passwordHash = NULL WHERE id = ?", (member_id,))
        else:
            login_id = login_id or row["loginId"]
            if not login_id:
                raise HTTPException(400, "권한을 주려면 아이디가 필요합니다.")
            conn.execute("UPDATE members SET permission = ?, loginId = ? WHERE id = ?", (req.permission, login_id, member_id))
        return dict(conn.execute(f"SELECT {MEMBER_PUBLIC}, loginId FROM members WHERE id = ?", (member_id,)).fetchone())


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
