"""스키마 마이그레이션 자체 점검. 임시 DB에서만 동작: python test_schema.py"""
import os
import sqlite3
import tempfile
from pathlib import Path

tmp = Path(tempfile.mkdtemp())
os.environ["ASSETHUB_DB"] = str(tmp / "test.db")

from db import database  # noqa: E402  (환경변수 설정 후 import)
from db.database import MIGRATIONS, get_conn, init_db  # noqa: E402


def expect_fail(conn, sql, params=()):
    try:
        conn.execute(sql, params)
    except sqlite3.IntegrityError:
        return
    raise AssertionError(f"제약 위반이 통과됨: {sql} {params}")


init_db()
init_db()  # 두 번 실행해도 무해해야 함
conn = get_conn()
assert conn.execute("PRAGMA user_version").fetchone()[0] == len(MIGRATIONS)
assert [r[0] for r in conn.execute("SELECT code FROM corporations ORDER BY id")] == ["DR", "TC", "SL"]
assert [r[0] for r in conn.execute("SELECT code FROM asset_types WHERE hasSpecs = 1 ORDER BY id")] == ["NB", "PC"]
assert conn.execute("SELECT count(*) FROM departments").fetchone()[0] == 10

conn.execute("INSERT INTO members (name, departmentId) VALUES ('홍길동', 1)")
asset = "INSERT INTO assets (id, typeId, corporationId, status, memberId, serial, purchaseDate) VALUES (?, 1, 1, ?, ?, ?, ?)"
conn.execute(asset, ("DR-NB-0001", "사용중", 1, "S1", "2018-09"))
conn.execute(asset, ("DR-NB-0002", "미확인", None, None, "2018-09-01"))
conn.execute(asset, ("DR-NB-0003", "보관", None, None, None))  # serial NULL 여러 개 허용

expect_fail(conn, asset, ("DR-NB-0004", "사용중", None, None, None))   # 사용중인데 사용자 없음
expect_fail(conn, asset, ("DR-NB-0004", "보관", 1, None, None))        # 보관인데 사용자 있음
expect_fail(conn, asset, ("DR-NB-0004", "미사용", None, None, None))   # 구 상태값
expect_fail(conn, asset, ("DR-NB-0004", "보관", None, "S1", None))     # 시리얼 중복
expect_fail(conn, asset, ("DR-NB-0004", "보관", None, "-", None))      # "-"는 NULL로 저장해야 함
expect_fail(conn, asset, ("DR-NB-0004", "보관", None, None, "2018/09"))  # 날짜 형식
expect_fail(conn, asset, ("DR-NB-0004", "보관", 99, None, None))       # 없는 구성원 FK
conn.execute("INSERT INTO members (name) VALUES ('홍길동')")                         # 동명이인은 DB가 막지 않음
conn.execute("INSERT INTO members (name, permission, loginId) VALUES ('관리자', 'admin', 'Admin')")
expect_fail(conn, "INSERT INTO members (name, permission, loginId) VALUES ('x', 'viewer', 'ADMIN')")  # 아이디 대소문자 무시 중복
expect_fail(conn, "INSERT INTO members (name, loginId) VALUES ('x', 'nobody')")        # 권한 없이 아이디
expect_fail(conn, "INSERT INTO members (name, permission) VALUES ('x', 'root')")
expect_fail(conn, "INSERT INTO members (name) VALUES ('홍길동/영업')")                  # 구분자 '/'
expect_fail(conn, "INSERT INTO members (name) VALUES ('')")
expect_fail(conn, "INSERT INTO departments (name) VALUES ('경영')")
expect_fail(conn, "INSERT INTO history (assetId, type, eventDate, recordedAt, recordedBy) VALUES ('DR-NB-0001', '삭제', 'd', 'd', 1)")
conn.close()

# 구버전 DB는 자동 변환하지 않고 거부
legacy = tmp / "legacy.db"
sqlite3.connect(legacy).execute("CREATE TABLE assets (id TEXT)").connection.close()
database.DB_PATH = legacy
try:
    init_db()
    raise AssertionError("구버전 DB가 거부되지 않음")
except RuntimeError:
    pass

print("OK")
