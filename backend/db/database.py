import os
import sqlite3
from contextlib import contextmanager
from pathlib import Path

# ASSETHUB_DB: 테스트용 복사본 경로 지정 (운영 DB 보호)
DB_PATH = Path(os.environ.get("ASSETHUB_DB") or Path(__file__).resolve().parent.parent.parent / "db" / "assethub.db")
DB_PATH.parent.mkdir(parents=True, exist_ok=True)

YM = "'[0-9][0-9][0-9][0-9]-[0-1][0-9]'"
YMD = "'[0-9][0-9][0-9][0-9]-[0-1][0-9]-[0-3][0-9]'"

# 순서가 곧 버전. 적용된 항목은 절대 수정하지 말고 뒤에 추가만 할 것 (PRAGMA user_version = 적용 개수)
MIGRATIONS = [
    # 1: 실운영 전환 스키마 (설계안 v2 3-1 + v2.1 1장. 운영 DB 적용 전이라 v2.1 변경을 이 항목에 직접 반영)
    f"""
    CREATE TABLE corporations (
        id INTEGER PRIMARY KEY,
        code TEXT NOT NULL UNIQUE,
        name TEXT NOT NULL UNIQUE,
        active INTEGER NOT NULL DEFAULT 1 CHECK (active IN (0, 1))
    );
    CREATE TABLE departments (
        id INTEGER PRIMARY KEY,
        name TEXT NOT NULL UNIQUE,
        active INTEGER NOT NULL DEFAULT 1 CHECK (active IN (0, 1))
    );
    CREATE TABLE asset_types (
        id INTEGER PRIMARY KEY,
        code TEXT NOT NULL UNIQUE,
        name TEXT NOT NULL UNIQUE,
        hasSpecs INTEGER NOT NULL DEFAULT 0 CHECK (hasSpecs IN (0, 1)),
        active INTEGER NOT NULL DEFAULT 1 CHECK (active IN (0, 1))
    );
    CREATE TABLE members (
        id INTEGER PRIMARY KEY,
        name TEXT NOT NULL CHECK (name <> '' AND instr(name, '/') = 0),
        departmentId INTEGER REFERENCES departments(id),
        part TEXT,
        position TEXT,
        email TEXT UNIQUE,
        loginId TEXT UNIQUE COLLATE NOCASE,
        permission TEXT CHECK (permission IN ('admin', 'manager', 'viewer')),
        status TEXT NOT NULL DEFAULT '재직' CHECK (status IN ('재직', '퇴직')),
        passwordHash TEXT,
        CHECK (loginId IS NULL OR permission IS NOT NULL)
    );
    CREATE TABLE assets (
        id TEXT PRIMARY KEY,
        legacyNo TEXT,
        name TEXT,
        typeId INTEGER NOT NULL REFERENCES asset_types(id),
        corporationId INTEGER NOT NULL REFERENCES corporations(id),
        departmentId INTEGER REFERENCES departments(id),
        memberId INTEGER REFERENCES members(id),
        location TEXT,
        status TEXT NOT NULL CHECK (status IN ('사용중', '공용', '보관', '수리중', '분실', '미확인')),
        model TEXT,
        serial TEXT UNIQUE CHECK (serial IS NULL OR serial NOT IN ('', '-')),
        manufacturedYm TEXT CHECK (manufacturedYm GLOB {YM}),
        purchaseDate TEXT CHECK (purchaseDate GLOB {YM} OR purchaseDate GLOB {YMD}),
        warrantyExpiry TEXT CHECK (warrantyExpiry GLOB {YMD}),
        purchaseCost INTEGER,
        vendor TEXT,
        approvalNo TEXT,
        cpu TEXT,
        ram TEXT,
        storage TEXT,
        os TEXT,
        note TEXT,
        lastInspectedAt TEXT,
        createdAt TEXT NOT NULL DEFAULT (datetime('now', 'localtime')),
        updatedAt TEXT NOT NULL DEFAULT (datetime('now', 'localtime')),
        isDisposed INTEGER NOT NULL DEFAULT 0 CHECK (isDisposed IN (0, 1)),
        disposalMethod TEXT CHECK (disposalMethod IN ('폐기', '매각', '기증', '분실처리')),
        disposalReason TEXT,
        disposalDate TEXT,
        CHECK ((status = '사용중') = (memberId IS NOT NULL))
    );
    CREATE INDEX idx_assets_legacyNo ON assets(legacyNo);
    CREATE INDEX idx_assets_memberId ON assets(memberId);
    CREATE TABLE asset_seq (
        corporationId INTEGER NOT NULL REFERENCES corporations(id),
        typeId INTEGER NOT NULL REFERENCES asset_types(id),
        lastNo INTEGER NOT NULL DEFAULT 0,
        PRIMARY KEY (corporationId, typeId)
    );
    CREATE TABLE history (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        assetId TEXT NOT NULL REFERENCES assets(id),
        type TEXT NOT NULL CHECK (type IN ('입고', '배정', '반납', '이동', '상태변경', '수리', '실사정정', '폐기')),
        fromMemberId INTEGER REFERENCES members(id),
        toMemberId INTEGER REFERENCES members(id),
        detail TEXT,
        note TEXT,
        eventDate TEXT NOT NULL,
        recordedAt TEXT NOT NULL,
        recordedBy INTEGER NOT NULL REFERENCES members(id)
    );
    CREATE INDEX idx_history_assetId ON history(assetId);
    CREATE TABLE requests (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        type TEXT NOT NULL CHECK (type IN ('배정요청', '반납요청')),
        assetId TEXT NOT NULL REFERENCES assets(id),
        targetMemberId INTEGER REFERENCES members(id),
        requesterId INTEGER NOT NULL REFERENCES members(id),
        status TEXT NOT NULL DEFAULT '대기중' CHECK (status IN ('대기중', '승인', '거절')),
        note TEXT,
        resolvedNote TEXT,
        resolvedDate TEXT,
        date TEXT NOT NULL
    );
    CREATE TABLE inspections (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        title TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT '진행중' CHECK (status IN ('진행중', '종료')),
        startedAt TEXT NOT NULL,
        endedAt TEXT,
        createdBy INTEGER NOT NULL REFERENCES members(id)
    );
    CREATE TABLE inspection_checks (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        inspectionId INTEGER NOT NULL REFERENCES inspections(id),
        assetId TEXT NOT NULL REFERENCES assets(id),
        result TEXT NOT NULL CHECK (result IN ('확인', '정정', '미발견')),
        checkedBy INTEGER NOT NULL REFERENCES members(id),
        checkedAt TEXT NOT NULL,
        note TEXT,
        UNIQUE (inspectionId, assetId)
    );
    INSERT INTO corporations (code, name) VALUES ('DR', '두래'), ('TC', '두래티앤씨'), ('SL', '셀럭스');
    INSERT INTO asset_types (code, name, hasSpecs) VALUES
        ('NB', '노트북', 1), ('PC', '데스크탑', 1), ('MN', '모니터', 0), ('PH', '전화기', 0),
        ('TV', 'TV', 0), ('PR', '프린터/복합기', 0), ('ET', '기타', 0);
    INSERT INTO departments (name) VALUES
        ('경영'), ('경영전략기획실'), ('식품사업부'), ('전략SCM사업부'), ('CIST&GIST'),
        ('기술연구소'), ('제주바이오센터'), ('음성LH센터'), ('생산공정센터'), ('두래USA');
    """,
    # 2: 자산번호 체계 {법인}-{대분류}-{유형}-{4자리} + 바뀌지 않는 내부 키 분리 (2026-10-27)
    #    QR·이력·요청·실사는 정수 assets.id를 가리키고, 자산번호(assetNo)는 바꿀 수 있는 표시용 값.
    #    기존 번호 DR-MN-0001 → DR-IT-MN-0001 (일련번호 유지, 기존 유형은 모두 IT), 셀럭스 SL → CX.
    #    테이블 재생성은 init_db 연결(foreign_keys 꺼짐)에서 돌고, 끝에 foreign_key_check로 검증한다
    f"""
    CREATE TABLE asset_categories (
        id INTEGER PRIMARY KEY,
        code TEXT NOT NULL UNIQUE,
        name TEXT NOT NULL UNIQUE,
        active INTEGER NOT NULL DEFAULT 1 CHECK (active IN (0, 1))
    );
    INSERT INTO asset_categories (code, name) VALUES ('IT', 'IT기기'), ('FN', '가구·비품'), ('RE', '연구장비');

    CREATE TABLE asset_types_v2 (
        id INTEGER PRIMARY KEY,
        categoryId INTEGER NOT NULL REFERENCES asset_categories(id),
        code TEXT NOT NULL,
        name TEXT NOT NULL,
        hasSpecs INTEGER NOT NULL DEFAULT 0 CHECK (hasSpecs IN (0, 1)),
        active INTEGER NOT NULL DEFAULT 1 CHECK (active IN (0, 1)),
        UNIQUE (categoryId, code),
        UNIQUE (categoryId, name)
    );
    INSERT INTO asset_types_v2 (id, categoryId, code, name, hasSpecs, active)
        SELECT id, (SELECT id FROM asset_categories WHERE code = 'IT'), code, name, hasSpecs, active FROM asset_types;
    DROP TABLE asset_types;
    ALTER TABLE asset_types_v2 RENAME TO asset_types;

    UPDATE corporations SET code = 'CX' WHERE code = 'SL';

    CREATE TEMP TABLE asset_map AS
        SELECT a.id oldId, row_number() OVER (ORDER BY a.createdAt, a.id) newId,
               c.code || '-' || g.code || '-' || t.code || '-' || substr(a.id, -4) assetNo
        FROM assets a JOIN corporations c ON c.id = a.corporationId
        JOIN asset_types t ON t.id = a.typeId JOIN asset_categories g ON g.id = t.categoryId;

    CREATE TABLE assets_v2 (
        id INTEGER PRIMARY KEY,
        assetNo TEXT NOT NULL UNIQUE,
        legacyNo TEXT,
        name TEXT,
        typeId INTEGER NOT NULL REFERENCES asset_types(id),
        corporationId INTEGER NOT NULL REFERENCES corporations(id),
        departmentId INTEGER REFERENCES departments(id),
        memberId INTEGER REFERENCES members(id),
        location TEXT,
        status TEXT NOT NULL CHECK (status IN ('사용중', '공용', '보관', '수리중', '분실', '미확인')),
        model TEXT,
        serial TEXT UNIQUE CHECK (serial IS NULL OR serial NOT IN ('', '-')),
        manufacturedYm TEXT CHECK (manufacturedYm GLOB {YM}),
        purchaseDate TEXT CHECK (purchaseDate GLOB {YM} OR purchaseDate GLOB {YMD}),
        warrantyExpiry TEXT CHECK (warrantyExpiry GLOB {YMD}),
        purchaseCost INTEGER,
        vendor TEXT,
        approvalNo TEXT,
        cpu TEXT,
        ram TEXT,
        storage TEXT,
        os TEXT,
        note TEXT,
        lastInspectedAt TEXT,
        createdAt TEXT NOT NULL DEFAULT (datetime('now', 'localtime')),
        updatedAt TEXT NOT NULL DEFAULT (datetime('now', 'localtime')),
        isDisposed INTEGER NOT NULL DEFAULT 0 CHECK (isDisposed IN (0, 1)),
        disposalMethod TEXT CHECK (disposalMethod IN ('폐기', '매각', '기증', '분실처리')),
        disposalReason TEXT,
        disposalDate TEXT,
        CHECK ((status = '사용중') = (memberId IS NOT NULL))
    );
    INSERT INTO assets_v2 SELECT m.newId, m.assetNo, a.legacyNo, a.name, a.typeId, a.corporationId, a.departmentId,
        a.memberId, a.location, a.status, a.model, a.serial, a.manufacturedYm, a.purchaseDate, a.warrantyExpiry,
        a.purchaseCost, a.vendor, a.approvalNo, a.cpu, a.ram, a.storage, a.os, a.note, a.lastInspectedAt,
        a.createdAt, a.updatedAt, a.isDisposed, a.disposalMethod, a.disposalReason, a.disposalDate
        FROM assets a JOIN asset_map m ON m.oldId = a.id;

    CREATE TABLE history_v2 (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        assetId INTEGER NOT NULL REFERENCES assets(id),
        type TEXT NOT NULL CHECK (type IN ('입고', '배정', '반납', '이동', '상태변경', '수리', '실사정정', '폐기', '번호변경')),
        fromMemberId INTEGER REFERENCES members(id),
        toMemberId INTEGER REFERENCES members(id),
        detail TEXT,
        note TEXT,
        eventDate TEXT NOT NULL,
        recordedAt TEXT NOT NULL,
        recordedBy INTEGER NOT NULL REFERENCES members(id)
    );
    INSERT INTO history_v2 SELECT h.id, m.newId, h.type, h.fromMemberId, h.toMemberId, h.detail, h.note,
        h.eventDate, h.recordedAt, h.recordedBy FROM history h JOIN asset_map m ON m.oldId = h.assetId;

    CREATE TABLE requests_v2 (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        type TEXT NOT NULL CHECK (type IN ('배정요청', '반납요청')),
        assetId INTEGER NOT NULL REFERENCES assets(id),
        targetMemberId INTEGER REFERENCES members(id),
        requesterId INTEGER NOT NULL REFERENCES members(id),
        status TEXT NOT NULL DEFAULT '대기중' CHECK (status IN ('대기중', '승인', '거절')),
        note TEXT,
        resolvedNote TEXT,
        resolvedDate TEXT,
        date TEXT NOT NULL
    );
    INSERT INTO requests_v2 SELECT r.id, r.type, m.newId, r.targetMemberId, r.requesterId, r.status, r.note,
        r.resolvedNote, r.resolvedDate, r.date FROM requests r JOIN asset_map m ON m.oldId = r.assetId;

    CREATE TABLE inspection_checks_v2 (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        inspectionId INTEGER NOT NULL REFERENCES inspections(id),
        assetId INTEGER NOT NULL REFERENCES assets(id),
        result TEXT NOT NULL CHECK (result IN ('확인', '정정', '미발견')),
        checkedBy INTEGER NOT NULL REFERENCES members(id),
        checkedAt TEXT NOT NULL,
        note TEXT,
        UNIQUE (inspectionId, assetId)
    );
    INSERT INTO inspection_checks_v2 SELECT i.id, i.inspectionId, m.newId, i.result, i.checkedBy, i.checkedAt, i.note
        FROM inspection_checks i JOIN asset_map m ON m.oldId = i.assetId;

    DROP TABLE inspection_checks;
    DROP TABLE requests;
    DROP TABLE history;
    DROP TABLE assets;
    ALTER TABLE assets_v2 RENAME TO assets;
    ALTER TABLE history_v2 RENAME TO history;
    ALTER TABLE requests_v2 RENAME TO requests;
    ALTER TABLE inspection_checks_v2 RENAME TO inspection_checks;
    CREATE INDEX idx_assets_legacyNo ON assets(legacyNo);
    CREATE INDEX idx_assets_memberId ON assets(memberId);
    CREATE INDEX idx_history_assetId ON history(assetId);
    DROP TABLE asset_map;
    """,
]


def get_conn():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA journal_mode=WAL")
    conn.execute("PRAGMA foreign_keys=ON")
    return conn


@contextmanager
def db(write=False):
    """성공 시에만 commit, 예외 시 rollback, 어느 경우든 연결을 닫는다 (database is locked 방지).
    write=True: 시작부터 쓰기 잠금(BEGIN IMMEDIATE) — 읽고 판단한 뒤 쓰는 작업이 그 사이 다른 쓰기와 엇갈리지 않게"""
    conn = get_conn()
    try:
        with conn:
            if write:
                conn.execute("BEGIN IMMEDIATE")
            yield conn
    finally:
        conn.close()


def init_db():
    conn = sqlite3.connect(DB_PATH)
    try:
        version = conn.execute("PRAGMA user_version").fetchone()[0]
        if version == 0 and conn.execute("SELECT 1 FROM sqlite_master WHERE type='table'").fetchone():
            # 전환 이전 구조의 DB. 자동 변환하지 않는다 — 파일 이름을 바꿔 보관한 뒤 새로 생성 (설계안 3-1)
            raise RuntimeError(f"구버전 스키마 DB입니다: {DB_PATH} — 파일 이름을 바꿔 보관한 뒤 다시 실행하세요.")
        if version > len(MIGRATIONS):
            raise RuntimeError(f"DB 버전({version})이 코드({len(MIGRATIONS)})보다 높습니다.")
        for i, sql in enumerate(MIGRATIONS[version:], start=version + 1):
            # executescript는 자체 트랜잭션 관리를 안 하므로 BEGIN을 직접 연다. user_version도 같은 트랜잭션.
            # 이 연결은 foreign_keys가 꺼져 있어 테이블 재생성이 가능하다 — 대신 커밋 전에 참조 무결성을 직접 확인
            try:
                conn.executescript(f"BEGIN;\n{sql}\nPRAGMA user_version = {i};")
                broken = conn.execute("PRAGMA foreign_key_check").fetchall()
                if broken:
                    raise RuntimeError(f"마이그레이션 {i} 후 참조가 깨졌습니다: {broken[:5]}")
                conn.commit()
            except Exception:
                conn.rollback()
                raise
    finally:
        conn.close()
