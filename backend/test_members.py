"""구성원 등록·수정·가져오기 자체 점검. 임시 DB에서만 동작: python test_members.py"""
import os
import tempfile
from pathlib import Path

tmp = Path(tempfile.mkdtemp())
os.environ["ASSETHUB_DB"] = str(tmp / "test.db")
os.environ["JWT_SECRET"] = "test-secret"

from fastapi import HTTPException  # noqa: E402

from db.database import db, init_db  # noqa: E402
from routers.assets_router import CreateReq, create  # noqa: E402
from routers.members_router import ImportReq, UpdateReq, create_member, import_members, update_member  # noqa: E402


def status_of(fn, *args, **kw):
    try:
        fn(*args, **kw)
    except HTTPException as e:
        return e.status_code
    return 200


init_db()
with db() as conn:
    conn.executescript("""
        INSERT INTO departments (corporationId, name) VALUES (1, '경영지원'), (1, '영업'), (2, '경영지원');
        INSERT INTO departments (corporationId, name, active) VALUES (1, '폐지부서', 0);
        INSERT INTO members (employeeNo, name, permission) VALUES ('admin', '관리자', 'admin');
        INSERT INTO members (employeeNo, name, departmentId, permission) VALUES ('2001', '부서장', 1, 'manager');
    """)
admin = {"id": 1, "permission": "admin", "departmentId": None}
manager = {"id": 2, "permission": "manager", "departmentId": 1}

# manager: 자기 부서에만 등록, 다른 부서로 옮길 수 없음
hong = create_member({"employeeNo": "1001", "name": "홍길동", "departmentId": 1, "email": ""}, manager)
assert hong["email"] is None
assert status_of(create_member, {"employeeNo": "1002", "name": "x", "departmentId": 2}, manager) == 403
assert status_of(update_member, hong["id"], UpdateReq(fields={"departmentId": 2}), manager) == 403
assert status_of(create_member, {"employeeNo": "1003", "name": "x", "departmentId": 4}, admin) == 400   # 비활성 부서
assert status_of(create_member, {"employeeNo": "1003", "name": "x", "email": "nope"}, admin) == 400
assert status_of(update_member, hong["id"], UpdateReq(fields={"status": "퇴직"}), admin) == 400        # 퇴직은 /retire로만

# 부서 변경 + 보유 자산 이동: 자산 부서도 바뀌고 이동 이력 생성
a = create(CreateReq(fields={"corporationId": 1, "typeId": 1, "memberId": hong["id"], "departmentId": 1}), admin)[0]
r = update_member(hong["id"], UpdateReq(fields={"departmentId": 2}, moveAssets=True), admin)
assert r["movedAssets"] == [a["id"]]
with db() as conn:
    assert conn.execute("SELECT departmentId FROM assets WHERE id = ?", (a["id"],)).fetchone()[0] == 2
    assert conn.execute("SELECT type FROM history WHERE assetId = ? ORDER BY id DESC", (a["id"],)).fetchone()[0] == "이동"
# 이동 안 함: 구성원만 바뀜
r = update_member(hong["id"], UpdateReq(fields={"departmentId": 1}), admin)
assert r["movedAssets"] == []

# 가져오기: 오류가 하나라도 있으면 저장 안 함, 행·칸·사유 반환
rows = [
    {"사번": "1001", "이름": "홍길동", "법인코드": "dr", "부서": "영업", "직급": "대리"},            # 갱신 (소문자 코드 허용)
    {"사번": "3001", "이름": "김신규", "법인코드": "TC", "부서": "경영지원", "이메일": "kim@x.com"},  # 신규
    {"사번": "3001", "이름": "중복", "법인코드": "DR", "부서": "영업"},                              # 파일 내 사번 중복
    {"사번": "3002", "이름": "", "법인코드": "SL", "부서": "영업"},                                  # 이름 없음 + SL에 영업 없음
    {"사번": "1001", "이름": "홍길동", "법인코드": "DR", "부서": "폐지부서"},                         # 비활성 (사번 중복도)
    {"사번": "", "이름": "", "법인코드": "", "부서": ""},                                            # 빈 행: 무시
    {"사번": "3003", "이름": "x", "법인코드": "DR", "부서": "영업", "재직상태": "휴직"},
]
res = import_members(ImportReq(rows=rows), dry_run=False, user=admin)
assert not res["saved"]
got = {(e["row"], e["column"]) for e in res["errors"]}
assert got == {(4, "사번"), (5, "이름"), (5, "부서"), (6, "사번"), (6, "부서"), (8, "재직상태")}, got
with db() as conn:
    assert conn.execute("SELECT count(*) FROM members WHERE employeeNo = '3001'").fetchone()[0] == 0

# 보유 자산이 있는 재직자를 가져오기로 퇴직시키는 것은 거부
res = import_members(ImportReq(rows=[{"사번": "1001", "이름": "홍길동", "법인코드": "DR", "부서": "경영지원", "재직상태": "퇴직"}]), dry_run=True, user=admin)
assert [e["column"] for e in res["errors"]] == ["재직상태"]

# 정상 파일: dry_run은 저장 안 함, 실제 실행은 백업 후 저장
ok_rows = [rows[0], rows[1], {"사번": "admin", "이름": "관리자", "법인코드": "DR", "부서": "경영지원"}]
res = import_members(ImportReq(rows=ok_rows), dry_run=True, user=admin)
assert (res["create"], res["update"], res["errors"], res["saved"]) == (1, 2, [], False)
res = import_members(ImportReq(rows=ok_rows), dry_run=False, user=admin)
assert res["saved"] and (tmp / "backups" / res["backup"]).exists()
with db() as conn:
    row = conn.execute("SELECT departmentId, position, permission FROM members WHERE employeeNo = '1001'").fetchone()
    assert (row[0], row[1]) == (2, "대리")
    # 가져오기는 권한·비밀번호를 건드리지 않음
    assert conn.execute("SELECT permission FROM members WHERE employeeNo = 'admin'").fetchone()[0] == "admin"
res = import_members(ImportReq(rows=ok_rows), dry_run=True, user=admin)
assert (res["create"], res["update"], res["same"]) == (0, 0, 3)

print("OK")
