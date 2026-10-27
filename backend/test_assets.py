"""자산 쓰기 API·이력 규칙 자체 점검. 임시 DB에서만 동작: python test_assets.py"""
import os
import sqlite3
import tempfile
from pathlib import Path

os.environ["ASSETHUB_DB"] = str(Path(tempfile.mkdtemp()) / "test.db")
os.environ["JWT_SECRET"] = "test-secret"

from fastapi import HTTPException  # noqa: E402

from db.database import db, init_db  # noqa: E402
from routers.assets_router import BulkReq, CreateReq, DisposeReq, PatchReq, bulk, create, dispose, update  # noqa: E402
from routers.masters_router import create_master, update_master  # noqa: E402
from routers.members_router import RetireReq, retire  # noqa: E402
from routers.requests_router import ResolveReq, create_request, resolve  # noqa: E402


def status_of(fn, *args):
    try:
        fn(*args)
    except HTTPException as e:
        return e.status_code
    except sqlite3.IntegrityError:
        return "integrity"
    return 200


def history(asset_id):
    with db() as conn:
        return [(r["type"], r["fromMemberId"], r["toMemberId"]) for r in
                conn.execute("SELECT * FROM history WHERE assetId = ? ORDER BY id", (asset_id,))]


init_db()
with db() as conn:
    # 부서 1·2는 초기값(경영, 경영전략기획실)
    conn.executescript("""
        INSERT INTO members (name, departmentId, permission, loginId) VALUES ('관리자', NULL, 'admin', 'admin');
        INSERT INTO members (name, departmentId, permission, loginId) VALUES ('부서장', 1, 'manager', 'mgr');
        INSERT INTO members (name, departmentId) VALUES ('홍길동', 1), ('김철수', 1);
    """)
admin = {"id": 1, "permission": "admin", "departmentId": None}
manager = {"id": 2, "permission": "manager", "departmentId": 1}
HONG, KIM = 3, 4
NB = {"corporationId": 1, "typeId": 1}

# 등록: 번호 자동 발급 + 입고, 사용자 있으면 배정 + 사용중
a1 = create(CreateReq(fields={**NB, "memberId": HONG, "serial": "S1", "departmentId": 1}, eventDate="2023-03-02"), admin)[0]
assert (a1["id"], a1["assetNo"], a1["status"]) == (1, "DR-IT-NB-0001", "사용중")
assert history(a1["id"]) == [("입고", None, None), ("배정", None, HONG)]
with db() as conn:
    assert conn.execute("SELECT eventDate FROM history WHERE assetId = ? AND type = '배정'", (a1["id"],)).fetchone()[0] == "2023-03-02"

# 수량 일괄 + 수동 번호는 카운터를 끌어올림, 번호 재사용 없음
assert [a["assetNo"] for a in create(CreateReq(fields={**NB, "serial": "-"}, quantity=2), admin)] == ["DR-IT-NB-0002", "DR-IT-NB-0003"]
assert create(CreateReq(fields=NB, assetNo="DR-IT-NB-0010"), admin)[0]["status"] == "보관"
assert create(CreateReq(fields=NB), admin)[0]["assetNo"] == "DR-IT-NB-0011"
assert status_of(create, CreateReq(fields=NB, assetNo="TC-IT-NB-0001"), admin) == 400   # 법인코드 불일치
assert status_of(create, CreateReq(fields=NB, assetNo="DR-NB-0099"), admin) == 400      # 대분류 빠진 옛 형식
assert status_of(create, CreateReq(fields=NB, assetNo="DR-IT-NB-0010"), admin) == "integrity"  # 중복 번호
assert status_of(create, CreateReq(fields={**NB, "serial": "S1"}), admin) == "integrity"  # 중복 시리얼
with db() as conn:
    assert conn.execute("SELECT count(*) FROM assets WHERE assetNo = 'DR-IT-NB-0012'").fetchone()[0] == 0  # 실패한 등록은 번호도 롤백

# 사용자 교체: 반납 + 배정
a1 = update(a1["id"], PatchReq(fields={"memberId": KIM}, updatedAt=a1["updatedAt"]), admin)
assert history(a1["id"])[-2:] == [("반납", HONG, None), ("배정", HONG, KIM)]

# 오래된 updatedAt은 409
assert status_of(update, a1["id"], PatchReq(fields={"location": "x"}, updatedAt="old"), admin) == 409

# 사용중 → 수리중: 사용자 자동 해제, 반납 + 수리
a1 = update(a1["id"], PatchReq(fields={"status": "수리중"}, updatedAt=a1["updatedAt"],
                               repair={"vendor": "A사", "cost": 50000}), admin)
assert a1["memberId"] is None and history(a1["id"])[-2:] == [("반납", KIM, None), ("수리", None, None)]
with db() as conn:
    assert conn.execute("SELECT detail FROM history WHERE assetId = ? AND type = '수리'", (a1["id"],)).fetchone()[0] \
        == "수리 접수 | 업체: A사 | 비용: 50000원"

# 수리중 → 보관: 상태변경 / 부서 이동: 이동 / 변경 없음: 이력 없음
a1 = update(a1["id"], PatchReq(fields={"status": "보관", "departmentId": 1}, updatedAt=a1["updatedAt"]), admin)
assert history(a1["id"])[-1] == ("상태변경", None, None)
n = len(history(a1["id"]))
a1 = update(a1["id"], PatchReq(fields={"status": "보관"}, updatedAt=a1["updatedAt"]), admin)
assert len(history(a1["id"])) == n

# 모순 조합(사용중인데 사용자 없음)은 DB가 거부
assert status_of(update, a1["id"], PatchReq(fields={"status": "사용중", "memberId": None}, updatedAt=a1["updatedAt"]), admin) == "integrity"

# manager: 자기 부서만, 다른 부서로 이동 불가
assert status_of(update, a1["id"], PatchReq(fields={"departmentId": 2}, updatedAt=a1["updatedAt"]), manager) == 403
assert status_of(create, CreateReq(fields={**NB, "departmentId": 2}), manager) == 403

# 일괄 처리: 하나라도 실패하면 전체 취소
ids = [2, 3]   # 내부 키 (DR-IT-NB-0002, 0003)
assert status_of(bulk, BulkReq(ids=[*ids, 999], fields={"memberId": HONG}), admin) == 404
with db() as conn:
    assert conn.execute("SELECT count(*) FROM assets WHERE memberId = ?", (HONG,)).fetchone()[0] == 0
bulk(BulkReq(ids=ids, fields={"memberId": HONG}), admin)

# 요청 승인: 반납요청 → 사용자 해제 + 이력
r = create_request({"type": "반납요청", "assetId": 2}, {"id": HONG})
assert resolve(r["id"], ResolveReq(approve=True), admin)["status"] == "승인"
assert history(2)[-1] == ("반납", HONG, None)
assert status_of(resolve, r["id"], ResolveReq(approve=True), admin) == 400   # 재처리 불가

# 퇴직: 보유 자산 보관 + 반납 이력, 이후 배정 불가
assert retire(HONG, RetireReq(), admin)["returned"] == [3]
assert history(3)[-1] == ("반납", HONG, None)
assert status_of(update, 5, PatchReq(fields={"memberId": HONG}, updatedAt="x"), admin) == 409
with db() as conn:
    ts = conn.execute("SELECT updatedAt FROM assets WHERE id = 5").fetchone()[0]
assert status_of(update, 5, PatchReq(fields={"memberId": HONG}, updatedAt=ts), admin) == 400

# 폐기: 사용중이면 반납 후 폐기, 이후 수정 불가
a = bulk(BulkReq(ids=[4], fields={"memberId": KIM}), admin)[0]   # DR-IT-NB-0010
d = dispose(a["id"], DisposeReq(method="매각", reason="노후"), admin)
assert d["isDisposed"] == 1 and d["memberId"] is None and d["status"] == "보관"
assert [t for t, *_ in history(a["id"])][-2:] == ["반납", "폐기"]
assert status_of(update, a["id"], PatchReq(fields={"location": "x"}, updatedAt=d["updatedAt"]), admin) == 400
assert status_of(dispose, a["id"], DisposeReq(method="폐기", reason="x"), admin) == 400

# 번호변경: 유형·법인을 바꾸면 새 번호, 내부 키·이력은 그대로, 예전 번호는 이력에 (QR은 내부 키라 영향 없음)
r = update(5, PatchReq(fields={"typeId": 3}, updatedAt=ts), admin)               # NB → MN
assert (r["id"], r["assetNo"]) == (5, "DR-IT-MN-0001")
r = update(5, PatchReq(fields={"corporationId": 3}, updatedAt=r["updatedAt"]), admin)   # DR → CX
assert r["assetNo"] == "CX-IT-MN-0001"
with db() as conn:
    assert [x[0] for x in conn.execute("SELECT detail FROM history WHERE assetId = 5 AND type = '번호변경' ORDER BY id")]         == ["DR-IT-NB-0011 → DR-IT-MN-0001", "DR-IT-MN-0001 → CX-IT-MN-0001"]
    assert conn.execute("SELECT type FROM history WHERE assetId = 5 ORDER BY id DESC").fetchone()[0] == "이동"   # 법인 변경은 이동도 남김
assert create(CreateReq(fields=NB), admin)[0]["assetNo"] == "DR-IT-NB-0012"   # 번호 재사용 없음

# 기준정보: 사용 중인 코드는 수정 불가, 이름은 가능
assert status_of(update_master, "types", 1, {"code": "LT"}, admin) == 400
assert update_master("types", 1, {"name": "노트북PC"}, admin)["name"] == "노트북PC"
assert status_of(update_master, "types", 1, {"categoryId": 2}, admin) == 400   # 사용 중인 유형의 대분류는 고정
assert status_of(update_master, "categories", 1, {"code": "XX"}, admin) == 400
fn_et = create_master("types", {"categoryId": 2, "code": "ET", "name": "기타"}, admin)   # 대분류가 다르면 같은 코드 허용
assert create(CreateReq(fields={"corporationId": 1, "typeId": fn_et["id"]}), admin)[0]["assetNo"] == "DR-FN-ET-0001"

# 모든 이력의 기록자·기록시각은 서버가 채움
with db() as conn:
    assert conn.execute("SELECT count(*) FROM history WHERE recordedBy IS NULL OR recordedAt IS NULL").fetchone()[0] == 0

print("OK")
