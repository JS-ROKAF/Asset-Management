import sqlite3
from pathlib import Path

DB_PATH = Path(__file__).resolve().parent.parent.parent / "db" / "assethub.db"
DB_PATH.parent.mkdir(parents=True, exist_ok=True)


def get_conn():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA journal_mode=WAL")
    conn.execute("PRAGMA foreign_keys=ON")
    return conn


def init_db():
    conn = sqlite3.connect(DB_PATH)
    conn.execute("""
        CREATE TABLE IF NOT EXISTS members (
            id TEXT PRIMARY KEY,
            name TEXT,
            department TEXT,
            email TEXT UNIQUE,
            role TEXT,
            permission TEXT DEFAULT 'viewer',
            status TEXT DEFAULT '재직',
            password_hash TEXT
        )
    """)
    conn.execute("""
        CREATE TABLE IF NOT EXISTS assets (
            id TEXT PRIMARY KEY,
            name TEXT,
            type TEXT,
            status TEXT,
            user TEXT,
            department TEXT,
            location TEXT,
            purchaseDate TEXT,
            purchaseCost TEXT,
            vendor TEXT,
            model TEXT,
            serial TEXT,
            warrantyExpiry TEXT,
            note TEXT,
            date TEXT,
            isDisposed INTEGER DEFAULT 0,
            disposalReason TEXT,
            disposalMethod TEXT,
            disposalDate TEXT
        )
    """)
    conn.execute("""
        CREATE TABLE IF NOT EXISTS history (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            assetId TEXT,
            assetName TEXT,
            type TEXT,
            "from" TEXT,
            "to" TEXT,
            date TEXT,
            note TEXT
        )
    """)
    conn.execute("""
        CREATE TABLE IF NOT EXISTS requests (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            type TEXT,
            assetId TEXT,
            assetName TEXT,
            targetUser TEXT,
            requesterId TEXT,
            requesterName TEXT,
            status TEXT DEFAULT '대기중',
            note TEXT,
            resolvedNote TEXT,
            resolvedDate TEXT,
            date TEXT
        )
    """)
    conn.execute("""
        CREATE TABLE IF NOT EXISTS inspections (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            title TEXT,
            status TEXT DEFAULT '진행중',
            startDate TEXT,
            endDate TEXT,
            createdBy TEXT,
            note TEXT
        )
    """)
    conn.execute("""
        CREATE TABLE IF NOT EXISTS inspection_items (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            inspectionId INTEGER,
            assetId TEXT,
            assetName TEXT,
            department TEXT,
            assignedUser TEXT,
            confirmedBy TEXT,
            status TEXT DEFAULT '미확인',
            note TEXT,
            confirmedDate TEXT
        )
    """)
    conn.commit()
    conn.close()
