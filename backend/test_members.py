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
# 부서 초기값: 1 경영, 2 경영전략기획실, 6 기술연구소. 11 = 아래에서 추가하는 비활성 부서
with db() as conn:
    conn.executescript("""
        INSERT INTO departments (name, active) VALUES ('폐지부서', 0);
        INSERT INTO members (name, permission, loginId) VALUES ('관리자', 'admin', 'admin');
        INSERT INTO members (name, departmentId, permission, loginId) VALUES ('부서장', 1, 'manager', 'mgr');
    """)
admin = {"id": 1, "permission": "admin", "departmentId": None}
manager = {"id": 2, "permission": "manager", "departmentId": 1}

# manager: 자기 부서에만 등록, 다른 부서로 옮길 수 없음
hong = create_member({"name": "홍길동", "departmentId": 1, "part": "합성파트", "email": ""}, manager)
assert hong["email"] is None and hong["part"] == "합성파트" and "loginId" not in hong
assert status_of(create_member, {"name": "x", "departmentId": 2}, manager) == 403
assert status_of(update_member, hong["id"], UpdateReq(fields={"departmentId": 2}), manager) == 403
assert status_of(create_member, {"name": "x", "departmentId": 11}, admin) == 400   # 비활성 부서
assert status_of(create_member, {"name": "x", "email": "nope"}, admin) == 400
assert status_of(create_member, {"name": "x/y"}, admin) == 400                     # '/'는 이름/부서 구분자
assert status_of(update_member, hong["id"], UpdateReq(fields={"status": "퇴직"}), admin) == 400    # 퇴직은 /retire로만
assert status_of(update_member, hong["id"], UpdateReq(fields={"loginId": "hong"}), admin) == 400  # 아이디는 /permission으로만

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

# 동명이인: 김철수 2명(경영, 기술연구소)
create_member({"name": "김철수", "departmentId": 1}, admin)
create_member({"name": "김철수", "departmentId": 6}, admin)

# 가져오기: 오류가 하나라도 있으면 저장 안 함, 행·칸·사유 반환
rows = [
    {"이름": "홍길동", "부서": "경영전략기획실", "직위": "대리"},              # 2: 갱신 (부서 이동)
    {"이름": "이신규", "부서": "경영", "이메일": "lee@x.com"},                 # 3: 신규
    {"이름": "이신규", "부서": "경영"},                                        # 4: 파일 안 같은 사람 중복
    {"이름": "", "부서": "영업"},                                              # 5: 이름 없음 + 없는 부서
    {"이름": "부서장", "부서": "폐지부서"},                                    # 6: 비활성 부서
    {"이름": "", "부서": ""},                                                  # 7: 빈 행 무시
    {"이름": "x", "부서": "경영", "재직상태": "휴직"},                         # 8
    {"이름": "예시(이 행은 지우세요)", "부서": "경영"},                        # 9
    {"이름": "김철수", "부서": "경영"},                                        # 10: 동명이인 → 이름/부서 필요
    {"이름": "박없음/경영", "부서": "경영"},                                   # 11: 지정했는데 없음
    {"이름": "김철수 / 기술연구소", "부서": "기술연구소", "파트": "합성파트"},  # 12: 이름/부서 지정 (공백 무시)
    {"이름": "김철수/기술연구소", "부서": "기술연구소"},                       # 13: 12와 같은 사람
]
res = import_members(ImportReq(rows=rows), dry_run=False, user=admin)
assert not res["saved"]
got = {(e["row"], e["column"]) for e in res["errors"]}
assert got == {(4, "이름"), (5, "이름"), (5, "부서"), (6, "부서"), (8, "재직상태"), (9, "이름"),
               (10, "이름"), (11, "이름"), (13, "이름")}, got
with db() as conn:
    assert conn.execute("SELECT count(*) FROM members WHERE name = '이신규'").fetchone()[0] == 0

# 보유 자산이 있는 재직자를 가져오기로 퇴직시키는 것은 거부
res = import_members(ImportReq(rows=[{"이름": "홍길동", "부서": "경영", "재직상태": "퇴직"}]), dry_run=True, user=admin)
assert [e["column"] for e in res["errors"]] == ["재직상태"]

# 정상 파일: dry_run은 저장 안 함, 실제 실행은 백업 후 저장
ok_rows = [rows[0], rows[1], rows[10], {"이름": "관리자", "부서": "경영"}]
res = import_members(ImportReq(rows=ok_rows), dry_run=True, user=admin)
assert (res["create"], res["update"], res["errors"], res["saved"]) == (1, 3, [], False), res
res = import_members(ImportReq(rows=ok_rows), dry_run=False, user=admin)
assert res["saved"] and (tmp / "backups" / res["backup"]).exists()
with db() as conn:
    row = conn.execute("SELECT departmentId, position FROM members WHERE id = ?", (hong["id"],)).fetchone()
    assert (row[0], row[1]) == (2, "대리")
    assert conn.execute("SELECT part FROM members WHERE name = '김철수' AND departmentId = 6").fetchone()[0] == "합성파트"
    # 가져오기는 권한·아이디·비밀번호를 건드리지 않음
    assert tuple(conn.execute("SELECT permission, loginId FROM members WHERE id = 1").fetchone()) == ("admin", "admin")
res = import_members(ImportReq(rows=ok_rows), dry_run=True, user=admin)
assert (res["create"], res["update"], res["same"]) == (0, 0, 4), res

print("OK")
