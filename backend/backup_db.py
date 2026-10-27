import sqlite3
from datetime import datetime
from pathlib import Path

from db.database import DB_PATH

BACKUP_DIR = Path(DB_PATH).parent / "backups"
KEEP_DAYS = 30


def backup(tag: str = "") -> Path:
    """SQLite 온라인 백업 API로 복사 — WAL에 남은 최신 쓰기까지 포함되고, 서버 실행 중에도 안전"""
    if not Path(DB_PATH).exists():
        raise FileNotFoundError(f"DB 파일이 없습니다: {DB_PATH}")
    BACKUP_DIR.mkdir(parents=True, exist_ok=True)
    stamp = datetime.now().strftime("%Y%m%d_%H%M%S_%f")
    dest = BACKUP_DIR / f"assethub_{stamp}{'_' + tag if tag else ''}.db"
    src, dst = sqlite3.connect(DB_PATH), sqlite3.connect(dest)
    try:
        src.backup(dst)
    finally:
        dst.close()
        src.close()

    cutoff = datetime.now().timestamp() - KEEP_DAYS * 86400
    for f in BACKUP_DIR.glob("assethub_*.db"):
        if f.stat().st_mtime < cutoff:
            f.unlink()
    return dest


if __name__ == "__main__":
    print(f"백업 완료: {backup()}")
