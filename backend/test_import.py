"""자산 가져오기 자체 점검. 임시 DB에서만 동작: python test_import.py"""
import os
import tempfile
from pathlib import Path

tmp = Path(tempfile.mkdtemp())
os.environ["ASSETHUB_DB"] = str(tmp / "test.db")
os.environ["JWT_SECRET"] = "test-secret"

from asset_import import CellError, to_cost, to_date, to_month_or_date  # noqa: E402
from db.database import db, init_db  # noqa: E402
from routers.assets_router import CreateReq, ImportReq, create, import_assets  # noqa: E402


def fails(fn, *a):
    try:
        fn(*a)
    except CellError:
        return True
    return False


# 값 변환 규칙
assert to_month_or_date(43344) == "2018-09"            # 2018-09-01 자정 일련번호 → 월
assert to_month_or_date(43345) == "2018-09-02"
assert to_month_or_date(43344.5) == "2018-09-01"       # 자정이 아니면 날짜 그대로
assert to_month_or_date("2018.9") == "2018-09"
assert to_month_or_date(" 2018/09/05 ") == "2018-09-05"
assert to_month_or_date("2018.09.") == "2018-09" and to_month_or_date("2018.9.1.") == "2018-09-01"   # 끝에 점
assert to_month_or_date(43344, True) == "2018-09"
assert fails(to_month_or_date, 43345, True)             # 제조년월에 1일이 아닌 날짜
assert fails(to_month_or_date, "2018-09-05", True)
assert fails(to_month_or_date, "2018-13")
assert to_date(43345) == "2018-09-02" and to_date("") is None
assert fails(to_date, "2018-09") and fails(to_date, "2018-02-30")
assert to_cost("1,250,000원") == 1250000 and to_cost("₩ 3000") == 3000 and to_cost(1500000.0) == 1500000
assert to_cost("\\705,100") == 705100                   # 역슬래시 = 원화 기호
assert fails(to_cost, "약 100만") and fails(to_cost, -1)

init_db()
# 부서 초기값: 1 경영, 2 경영전략기획실, 6 기술연구소
with db() as conn:
    conn.executescript("""
        INSERT INTO members (name, permission, loginId) VALUES ('관리자', 'admin', 'admin');
        INSERT INTO members (name, departmentId) VALUES ('홍길동', 1);
        INSERT INTO members (name, status) VALUES ('퇴사자', '퇴직');
        INSERT INTO members (name, departmentId) VALUES ('김철수', 1), ('김철수', 6);
        INSERT INTO members (name, departmentId, status) VALUES ('박영희', 1, '퇴직'), ('박영희', 2, '재직');
    """)
admin = {"id": 1, "permission": "admin", "departmentId": None}
create(CreateReq(fields={"corporationId": 1, "typeId": 1, "serial": "OLD"}), admin)   # DR-NB-0001 기존

base = {"법인코드": "DR", "대분류코드": "IT", "유형코드": "NB", "상태": "보관"}
bad = [
    {**base, "사용자(이름)": "홍길동"},                             # 2: 보관인데 사용자
    {**base, "상태": "사용중"},                                     # 3: 사용중인데 사용자 없음
    {**base, "상태": "미사용"},                                     # 4: 구 상태값
    {**base, "시리얼": "OLD"},                                      # 5: DB 시리얼 중복
    {**base, "자산번호": "DR-IT-NB-0001"},                          # 6: DB 번호 중복
    {**base, "자산번호": "TC-IT-NB-0001"},                          # 7: 법인 불일치
    {**base, "상태": "사용중", "사용자(이름)": "퇴사자"},            # 8: 퇴직자는 재직자 중에 없음
    {**base, "지급일": "2023-03-02"},                               # 9: 사용자 없이 지급일
    {**base, "부서": "DR | 경영"},                                  # 10: 법인|부서 형식은 없어짐
    {**base, "유형코드": "XX", "법인코드": ""},                     # 11: 코드 오류 2개
    {**base, "취득금액": "백만원"},                                 # 12
    {**base, "자산번호": "예시(이 행은 지우세요)"},                 # 13: 양식 예시 행
    {**base, "상태": "사용중", "사용자(이름)": "김철수"},            # 14: 동명이인
    {**base, "상태": "사용중", "사용자(이름)": "없는사람"},          # 15
    {**base, "대분류코드": "FN"},                                   # 16: FN에는 NB 유형 없음
    {**base, "대분류코드": "ZZ"},                                   # 17: 없는 대분류 (유형은 판단 안 함)
]
res = import_assets(ImportReq(rows=bad), dry_run=False, user=admin)
assert not res["saved"] and res["create"] == 0
got = {(e["row"], e["column"]) for e in res["errors"]}
expected = {(2, "사용자(이름)"), (3, "사용자(이름)"), (4, "상태"), (5, "시리얼"), (6, "자산번호"), (7, "자산번호"),
            (8, "사용자(이름)"), (9, "지급일"), (10, "부서"), (11, "법인코드"), (11, "유형코드"), (12, "취득금액"),
            (13, "자산번호"), (14, "사용자(이름)"), (15, "사용자(이름)"), (16, "유형코드"), (17, "대분류코드")}
assert expected <= got, expected - got
assert (17, "유형코드") not in got

good = [
    {**base},                                                                            # 자동 번호
    {**base, "자산번호": "DR-IT-NB-0003", "시리얼": "A1"},                                  # 수동 번호 (자동보다 뒤 행)
    {**base, "상태": "사용중", "사용자(이름)": "홍길동", "지급일": 44987, "부서": "경영",  # 일련번호 지급일
     "취득일자": 43344, "취득금액": "1,250,000", "시리얼": "-"},
    {**base, "상태": "미확인", "부서": "경영전략기획실", "비고": "대장상 사용자: 김철수"},
    {**base, "상태": "사용중", "사용자(이름)": "김철수/기술연구소"},                      # 동명이인은 이름/부서로
    {**base, "상태": "사용중", "사용자(이름)": "박영희"},                                 # 같은 이름 퇴직자는 후보 제외
    {"법인코드": "", "대분류코드": "", "유형코드": "", "상태": ""},                                         # 빈 행: 무시
]
res = import_assets(ImportReq(rows=good), dry_run=True, user=admin)
assert (res["create"], res["errors"], res["statuses"]) == (6, [], {"보관": 2, "사용중": 3, "미확인": 1}), res
with db() as conn:
    assert conn.execute("SELECT count(*) FROM assets").fetchone()[0] == 1   # dry_run은 저장 안 함

res = import_assets(ImportReq(rows=good), dry_run=False, user=admin)
assert res["saved"] and (tmp / "backups" / res["backup"]).exists()
# 수동 DR-NB-0003을 먼저 넣고 카운터를 올린 뒤 자동 번호 발급 → 0004부터, 충돌 없음
assert sorted(res["assetNos"]) == [f"DR-IT-NB-{n:04d}" for n in range(3, 9)], res["assetNos"]
with db() as conn:
    a = dict(conn.execute("SELECT * FROM assets WHERE memberId = 2").fetchone())
    assert (a["purchaseDate"], a["purchaseCost"], a["serial"], a["departmentId"]) == ("2018-09", 1250000, None, 1)
    h = [dict(r) for r in conn.execute("SELECT type, eventDate, detail FROM history WHERE assetId = ? ORDER BY id", (a["id"],))]
    assert [x["type"] for x in h] == ["입고", "배정"]
    assert h[0]["detail"] == "시스템 이관 등록" and h[1]["eventDate"] == "2023-03-02"   # 지급일 = 배정 이력 날짜
    assert conn.execute("SELECT departmentId FROM assets WHERE status = '미확인'").fetchone()[0] == 2
    owner = "SELECT m.departmentId, m.status FROM assets a JOIN members m ON m.id = a.memberId WHERE m.name = ?"
    assert conn.execute(owner, ("김철수",)).fetchone()[0] == 6
    assert conn.execute(owner, ("박영희",)).fetchone()[1] == "재직"

print("OK")
