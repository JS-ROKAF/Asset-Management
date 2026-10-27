"""자산 엑셀 가져오기 — 정리·검증(plan)과 저장(apply). 설계안 3-4"""
import re
from datetime import date, timedelta

from asset_ops import STATUSES, create_asset

COLUMNS = [
    "자산번호", "구자산번호", "법인코드", "유형코드", "자산명", "모델명", "시리얼", "제조년월",
    "CPU", "RAM", "저장장치", "OS", "취득일자", "취득금액", "구입처", "구매품의번호",
    "보증만료일", "부서", "위치", "상태", "사용자(사번)", "지급일", "비고",
]
TEXT_FIELDS = {
    "구자산번호": "legacyNo", "자산명": "name", "모델명": "model", "CPU": "cpu", "RAM": "ram",
    "저장장치": "storage", "OS": "os", "구입처": "vendor", "구매품의번호": "approvalNo", "위치": "location", "비고": "note",
}
INTAKE_NOTE = "시스템 이관 등록"
EXCEL_EPOCH = date(1899, 12, 30)


class CellError(Exception):
    pass


def _text(v) -> str:
    if v is None:
        return ""
    if isinstance(v, float) and v.is_integer():
        v = int(v)   # 엑셀 숫자 셀 1001 → "1001" (1001.0 아님)
    return str(v).strip()


def _serial(v) -> tuple[date, bool]:
    """엑셀 날짜 일련번호 → (날짜, 자정 여부)"""
    return EXCEL_EPOCH + timedelta(days=int(v)), float(v).is_integer()


def _parse_text_date(s: str, allow_month: bool) -> str:
    s = re.sub(r"[./]", "-", s)
    m = re.fullmatch(r"(\d{4})-(\d{1,2})(?:-(\d{1,2}))?", s)
    if not m or (m.group(3) is None and not allow_month):
        raise CellError("YYYY-MM-DD 형식이어야 합니다." if not allow_month else "YYYY-MM 또는 YYYY-MM-DD 형식이어야 합니다.")
    y, mo, d = int(m.group(1)), int(m.group(2)), m.group(3)
    try:
        if d is None:
            date(y, mo, 1)
            return f"{y:04d}-{mo:02d}"
        return date(y, mo, int(d)).isoformat()
    except ValueError:
        raise CellError(f"없는 날짜입니다: {s}")


def to_date(v) -> str | None:
    """보증만료일·지급일: YYYY-MM-DD만"""
    if isinstance(v, (int, float)):
        return _serial(v)[0].isoformat()
    s = _text(v)
    return _parse_text_date(s, allow_month=False) if s else None


def to_month_or_date(v, month_only=False) -> str | None:
    """취득일자(YYYY-MM 또는 YYYY-MM-DD)·제조년월(YYYY-MM).
    일련번호가 1일 자정이면 원래 'YYYY-MM'으로 입력했다고 보고 월로 저장 (일련번호로는 둘을 구분할 수 없음)"""
    if isinstance(v, (int, float)):
        d, midnight = _serial(v)
        if d.day == 1 and midnight:
            return d.strftime("%Y-%m")
        if month_only:
            raise CellError(f"YYYY-MM 형식이어야 합니다 (입력값이 날짜 {d.isoformat()}로 읽힘).")
        return d.isoformat()
    s = _text(v)
    if not s:
        return None
    out = _parse_text_date(s, allow_month=True)
    if month_only and len(out) != 7:
        raise CellError("YYYY-MM 형식이어야 합니다.")
    return out


def to_cost(v) -> int | None:
    if isinstance(v, (int, float)):
        if v < 0 or not float(v).is_integer():
            raise CellError("0 이상의 정수여야 합니다.")
        return int(v)
    s = re.sub(r"[,원₩\s]", "", _text(v))
    if not s:
        return None
    if not s.isdigit():
        raise CellError(f"숫자가 아닙니다: {_text(v)}")
    return int(s)


def plan(conn, rows: list[dict]) -> tuple[list[dict], list[dict]]:
    """(저장할 자산 목록, 오류 목록[행·칸·사유]). DB는 읽기만 한다"""
    corps = {r["code"]: dict(r) for r in conn.execute("SELECT * FROM corporations")}
    types = {r["code"]: dict(r) for r in conn.execute("SELECT * FROM asset_types")}
    depts = {(r["corpCode"], r["name"]): dict(r) for r in conn.execute(
        "SELECT d.*, c.code corpCode FROM departments d JOIN corporations c ON c.id = d.corporationId")}
    members = {r["employeeNo"]: dict(r) for r in conn.execute("SELECT id, employeeNo, status FROM members")}
    db_ids = {r[0] for r in conn.execute("SELECT id FROM assets")}
    db_serials = {r[0] for r in conn.execute("SELECT serial FROM assets WHERE serial IS NOT NULL")}

    items, errors, seen_id, seen_serial = [], [], {}, {}
    for i, row in enumerate(rows):
        line = i + 2   # 1행은 머리글
        if not any(_text(row.get(k)) for k in COLUMNS):
            continue
        n = len(errors)

        def err(col, reason):
            errors.append({"row": line, "column": col, "reason": reason})

        if _text(row.get("자산번호")).startswith("예시"):
            err("자산번호", "양식의 예시 행입니다. 지우고 다시 올려 주세요.")
            continue

        def conv(col, fn, *a):
            try:
                return fn(row.get(col), *a)
            except CellError as e:
                err(col, str(e))
                return None

        fields = {f: _text(row.get(col)) or None for col, f in TEXT_FIELDS.items()}

        corp_code, type_code = _text(row.get("법인코드")).upper(), _text(row.get("유형코드")).upper()
        corp, typ = corps.get(corp_code), types.get(type_code)
        for col, code, rec in (("법인코드", corp_code, corp), ("유형코드", type_code, typ)):
            if not code:
                err(col, "필수 항목입니다.")
            elif not rec:
                err(col, f"없는 코드입니다: {code}")
            elif not rec["active"]:
                err(col, f"사용하지 않는 코드입니다: {code}")

        manual = _text(row.get("자산번호")).upper() or None
        if manual and corp and typ:
            if not re.fullmatch(rf"{corp_code}-{type_code}-\d{{4}}", manual):
                err("자산번호", f"{corp_code}-{type_code}-0000 형식이어야 합니다: {manual}")
            elif manual in db_ids:
                err("자산번호", f"이미 등록된 자산번호입니다: {manual}")
            elif manual in seen_id:
                err("자산번호", f"파일 안에서 중복입니다 ({seen_id[manual]}행).")
            else:
                seen_id[manual] = line

        serial = _text(row.get("시리얼"))
        if serial and serial != "-":
            if serial in db_serials:
                err("시리얼", f"이미 등록된 시리얼입니다: {serial}")
            elif serial in seen_serial:
                err("시리얼", f"파일 안에서 중복입니다 ({seen_serial[serial]}행).")
            else:
                seen_serial[serial] = line
            fields["serial"] = serial
        else:
            fields["serial"] = None

        # 부서: "법인코드 | 부서명"(코드표 형식) 또는 부서명만(이 행의 법인 기준)
        dept_text = _text(row.get("부서"))
        fields["departmentId"] = None
        if dept_text:
            dc, _, dn = dept_text.rpartition("|")
            key = (dc.strip().upper(), dn.strip()) if dc else (corp_code, dept_text)
            dept = depts.get(key)
            if not dept:
                err("부서", f"없는 부서입니다: {dept_text}" + ("" if dc else f" ({corp_code} 법인 기준)"))
            elif not dept["active"]:
                err("부서", f"사용하지 않는 부서입니다: {dept_text}")
            else:
                fields["departmentId"] = dept["id"]

        status = _text(row.get("상태"))
        if not status:
            err("상태", "필수 항목입니다.")
        elif status not in STATUSES:
            err("상태", f"허용값이 아닙니다: {status} (허용: {', '.join(STATUSES)})")

        emp_no = _text(row.get("사용자(사번)"))
        member = members.get(emp_no) if emp_no else None
        if emp_no and not member:
            err("사용자(사번)", f"구성원 목록에 없는 사번입니다: {emp_no}. 미확인·보관으로 넣고 이름은 비고에 적으세요.")
        elif member and member["status"] != "재직":
            err("사용자(사번)", f"퇴직한 구성원입니다: {emp_no}")
        if status == "사용중" and not emp_no:
            err("사용자(사번)", "사용중이면 사용자가 필요합니다.")
        elif status in STATUSES and status != "사용중" and emp_no:
            err("사용자(사번)", f"{status} 상태는 사용자가 없어야 합니다.")

        issue_date = conv("지급일", to_date)
        if issue_date and not emp_no:
            err("지급일", "사용자가 있을 때만 입력할 수 있습니다.")

        fields["manufacturedYm"] = conv("제조년월", to_month_or_date, True)
        fields["purchaseDate"] = conv("취득일자", to_month_or_date)
        fields["warrantyExpiry"] = conv("보증만료일", to_date)
        fields["purchaseCost"] = conv("취득금액", to_cost)

        if len(errors) > n:
            continue
        fields.update(corporationId=corp["id"], typeId=typ["id"], status=status,
                      memberId=member["id"] if member else None)
        items.append({"row": line, "id": manual, "fields": fields, "issueDate": issue_date})
    return items, errors


def apply(conn, user, items: list[dict]) -> list[str]:
    """호출자 트랜잭션 안에서 저장. 수동 번호 행을 먼저 넣어 카운터를 올린 뒤 자동 번호를 발급 —
    자동 번호가 같은 파일의 뒤쪽 수동 번호와 겹치지 않게"""
    ordered = sorted(items, key=lambda it: it["id"] is None)
    return [create_asset(conn, user, it["fields"], it["id"], it["issueDate"], None, INTAKE_NOTE)["id"] for it in ordered]
