"""자산 쓰기 공통 로직. 모든 함수는 호출자가 연 트랜잭션(conn) 안에서 동작하며, 이력은 여기서만 생성한다 (설계안 2·3-3)"""
import re
from datetime import date, datetime

from fastapi import HTTPException

EDITABLE = [
    "legacyNo", "name", "typeId", "corporationId", "departmentId", "memberId", "location", "status",
    "model", "serial", "manufacturedYm", "purchaseDate", "warrantyExpiry", "purchaseCost",
    "vendor", "approvalNo", "cpu", "ram", "storage", "os", "note",
]
FIELD_LABELS = {"departmentId": "부서", "location": "위치", "corporationId": "법인"}
STATUSES = ["사용중", "공용", "보관", "수리중", "분실", "미확인"]   # DB CHECK와 같은 목록


def now() -> str:
    # 마이크로초까지 — 같은 초 안의 연속 수정도 updatedAt 충돌 검사에 걸리도록
    return datetime.now().isoformat(timespec="microseconds")


def today() -> str:
    return date.today().isoformat()


def clean(fields: dict) -> dict:
    out = {}
    for k, v in fields.items():
        if k not in EDITABLE:
            raise HTTPException(400, f"수정할 수 없는 항목입니다: {k}")
        if isinstance(v, str):
            v = v.strip() or None
        if k == "serial" and v == "-":
            v = None
        if k == "purchaseCost" and isinstance(v, str):
            digits = re.sub(r"[,원₩\s]", "", v)
            if not digits.isdigit():
                raise HTTPException(400, f"취득금액이 숫자가 아닙니다: {v}")
            v = int(digits)
        out[k] = v
    return out


def add_history(conn, user, asset_id, type_, event_date, from_id=None, to_id=None, detail=None, note=None):
    conn.execute(
        """INSERT INTO history (assetId, type, fromMemberId, toMemberId, detail, note, eventDate, recordedAt, recordedBy)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)""",
        (asset_id, type_, from_id, to_id, detail, note, event_date or today(), now(), user["id"]),
    )


def get_asset(conn, asset_id: int) -> dict:
    """asset_id = 바뀌지 않는 내부 키(QR·이력이 가리키는 값). 자산번호(assetNo)는 표시용이라 바뀔 수 있다"""
    row = conn.execute("SELECT * FROM assets WHERE id = ?", (asset_id,)).fetchone()
    if not row:
        raise HTTPException(404, f"자산을 찾을 수 없습니다: {asset_id}")
    return dict(row)


def check_scope(user, *dept_ids, what="자산"):
    # manager는 자기 부서만. 부서 이동이면 이전·이후 부서 모두 자기 부서여야 함
    if user["permission"] == "manager" and any(d != user["departmentId"] for d in dept_ids):
        raise HTTPException(403, f"자기 부서 {what}만 처리할 수 있습니다.")


def _check_member(conn, member_id):
    row = conn.execute("SELECT status FROM members WHERE id = ?", (member_id,)).fetchone()
    if not row:
        raise HTTPException(400, f"없는 구성원입니다: {member_id}")
    if row["status"] != "재직":
        raise HTTPException(400, "퇴직한 구성원에게는 배정할 수 없습니다.")


def _name(conn, table, id_):
    if id_ is None:
        return "-"
    row = conn.execute(f"SELECT name FROM {table} WHERE id = ?", (id_,)).fetchone()
    return row["name"] if row else str(id_)


def _derive_status(old: dict, changes: dict) -> dict:
    """상태–사용자 연동: 한쪽만 보내면 다른 쪽을 맞춰 준다. 둘 다 보내 모순이면 DB CHECK가 거부"""
    changes = dict(changes)
    if "memberId" in changes and "status" not in changes:
        if changes["memberId"] is not None:
            changes["status"] = "사용중"
        elif old["status"] == "사용중":
            changes["status"] = "보관"
    if "status" in changes and "memberId" not in changes and changes["status"] != "사용중":
        changes["memberId"] = None
    return changes


def repair_detail(repair: dict | None) -> str:
    parts = ["수리 접수"]
    for key, label, suffix in [("vendor", "업체", ""), ("cost", "비용", "원"), ("content", "내용", ""), ("dueDate", "완료예정", "")]:
        if repair and repair.get(key) not in (None, ""):
            parts.append(f"{label}: {repair[key]}{suffix}")
    return " | ".join(parts)


def apply_change(conn, user, asset: dict, changes: dict, event_date=None, memo=None, repair=None, scope=True) -> dict:
    if asset["isDisposed"]:
        raise HTTPException(400, f"폐기된 자산은 수정할 수 없습니다: {asset['assetNo']}")
    changes = _derive_status(asset, clean(changes))
    changes = {k: v for k, v in changes.items() if asset[k] != v}
    if scope:
        check_scope(user, asset["departmentId"], changes.get("departmentId", asset["departmentId"]))
    if not changes:
        return asset
    if changes.get("memberId") is not None:
        _check_member(conn, changes["memberId"])

    # 법인·유형이 바뀌면 번호를 새로 받는다 (QR은 내부 키라 그대로). 예전 번호는 번호변경 이력에 남긴다
    renumber = "corporationId" in changes or "typeId" in changes
    if renumber:
        changes["assetNo"] = issue_no(conn, changes.get("corporationId", asset["corporationId"]),
                                      changes.get("typeId", asset["typeId"]))
    set_sql = ", ".join(f'"{k}" = ?' for k in changes)
    conn.execute(f'UPDATE assets SET {set_sql}, updatedAt = ? WHERE id = ?', [*changes.values(), now(), asset["id"]])
    if renumber:
        add_history(conn, user, asset["id"], "번호변경", event_date, detail=f"{asset['assetNo']} → {changes['assetNo']}", note=memo)

    aid, old_status, new_status = asset["id"], asset["status"], changes.get("status", asset["status"])
    status_note = f"상태: {old_status} → {new_status}" if new_status != old_status else None
    if "memberId" in changes:
        old_m, new_m = asset["memberId"], changes["memberId"]
        if old_m is not None:
            add_history(conn, user, aid, "반납", event_date, from_id=old_m,
                        detail=status_note if new_m is None else None, note=memo)
        if new_m is not None:
            add_history(conn, user, aid, "배정", event_date, from_id=old_m, to_id=new_m, note=memo)
    if new_status == "수리중" and old_status != "수리중":
        add_history(conn, user, aid, "수리", event_date, detail=repair_detail(repair), note=memo)
    elif status_note and "사용중" not in (old_status, new_status):
        # 사용중이 낀 전환은 위 반납/배정 이력이 이미 기록함
        add_history(conn, user, aid, "상태변경", event_date, detail=status_note, note=memo)
    moved = [
        f"{FIELD_LABELS[k]}: {_name(conn, t, asset[k]) if t else asset[k] or '-'} → {_name(conn, t, changes[k]) if t else changes[k] or '-'}"
        for k, t in [("corporationId", "corporations"), ("departmentId", "departments"), ("location", None)]
        if k in changes
    ]
    if moved:
        add_history(conn, user, aid, "이동", event_date, detail=" | ".join(moved), note=memo)
    return get_asset(conn, aid)


def issue_no(conn, corporation_id, type_id, manual: str | None = None) -> str:
    """자산번호 {법인}-{대분류}-{유형}-{4자리}. 카운터는 (법인, 유형)별 — 유형이 대분류에 속하므로 대분류별과 같다"""
    corp = conn.execute("SELECT code, active FROM corporations WHERE id = ?", (corporation_id,)).fetchone()
    typ = conn.execute("""SELECT t.code, t.active, g.code catCode, g.active catActive
                          FROM asset_types t JOIN asset_categories g ON g.id = t.categoryId WHERE t.id = ?""",
                       (type_id,)).fetchone()
    if not corp or not corp["active"]:
        raise HTTPException(400, "없거나 사용하지 않는 법인입니다.")
    if not typ or not typ["active"] or not typ["catActive"]:
        raise HTTPException(400, "없거나 사용하지 않는 유형입니다.")
    prefix = f"{corp['code']}-{typ['catCode']}-{typ['code']}-"
    if manual:
        m = re.fullmatch(re.escape(prefix) + r"(\d{4})", manual.strip())
        if not m:
            raise HTTPException(400, f"자산번호는 {prefix}0000 형식이어야 합니다: {manual}")
        n = int(m.group(1))
        conn.execute(
            """INSERT INTO asset_seq (corporationId, typeId, lastNo) VALUES (?, ?, ?)
               ON CONFLICT DO UPDATE SET lastNo = max(lastNo, excluded.lastNo)""",
            (corporation_id, type_id, n),
        )
    else:
        n = conn.execute(
            """INSERT INTO asset_seq (corporationId, typeId, lastNo) VALUES (?, ?, 1)
               ON CONFLICT DO UPDATE SET lastNo = lastNo + 1 RETURNING lastNo""",
            (corporation_id, type_id),
        ).fetchone()[0]
    if n > 9999:
        raise HTTPException(400, f"{prefix} 번호가 9999를 넘었습니다.")
    return f"{prefix}{n:04d}"


def create_asset(conn, user, fields: dict, manual_no=None, event_date=None, memo=None, intake_note=None) -> dict:
    fields = _derive_status({"status": None}, clean(fields))
    fields.setdefault("status", "보관")
    for k in ("corporationId", "typeId"):
        if fields.get(k) is None:
            raise HTTPException(400, f"{k}는 필수입니다.")
    check_scope(user, fields.get("departmentId"))
    if fields.get("memberId") is not None:
        _check_member(conn, fields["memberId"])
    asset_no = issue_no(conn, fields["corporationId"], fields["typeId"], manual_no)
    ts = now()
    cols = ["assetNo", *fields, "createdAt", "updatedAt"]
    col_sql = ", ".join(f'"{c}"' for c in cols)
    aid = conn.execute(f"INSERT INTO assets ({col_sql}) VALUES ({', '.join('?' for _ in cols)})",
                       [asset_no, *fields.values(), ts, ts]).lastrowid
    add_history(conn, user, aid, "입고", None, detail=intake_note, note=memo)
    if fields.get("memberId") is not None:
        add_history(conn, user, aid, "배정", event_date, to_id=fields["memberId"], note=memo)
    return get_asset(conn, aid)


def dispose_asset(conn, user, asset: dict, method, reason, event_date=None) -> dict:
    if asset["isDisposed"]:
        raise HTTPException(400, f"이미 폐기된 자산입니다: {asset['assetNo']}")
    if asset["memberId"] is not None:
        asset = apply_change(conn, user, asset, {"memberId": None}, event_date, "폐기 전 반납")
    check_scope(user, asset["departmentId"])
    d = event_date or today()
    conn.execute(
        "UPDATE assets SET isDisposed = 1, disposalMethod = ?, disposalReason = ?, disposalDate = ?, updatedAt = ? WHERE id = ?",
        (method, reason, d, now(), asset["id"]),
    )
    add_history(conn, user, asset["id"], "폐기", d, detail=f"방법: {method} | 사유: {reason}")
    return get_asset(conn, asset["id"])


# ── 가져오기 공통: 이름으로 구성원 찾기 (설계안 v2.1 3-1) ──
def member_index(conn, active_only: bool) -> list[dict]:
    sql = """SELECT m.id, m.name, m.departmentId, m.part, m.position, m.email, m.status, d.name deptName
             FROM members m LEFT JOIN departments d ON d.id = m.departmentId"""
    return [dict(r) for r in conn.execute(sql + (" WHERE m.status = '재직'" if active_only else ""))]


def find_member(members: list[dict], text: str) -> tuple[list[dict], bool]:
    """'이름' 또는 '이름/부서'. (일치 목록, 부서까지 지정했는지) — 판정은 호출자가 한다"""
    name, sep, dept = (p.strip() for p in text.partition("/"))
    return [m for m in members if m["name"] == name and (not sep or m["deptName"] == dept)], bool(sep)


def ambiguous_msg(hits: list[dict], with_dept: bool) -> str:
    if with_dept:
        return f"같은 부서에 같은 이름이 {len(hits)}명입니다. 화면에서 직접 지정하세요."
    return f"같은 이름이 {len(hits)}명입니다. 이름/부서 형식으로 적어 주세요."
