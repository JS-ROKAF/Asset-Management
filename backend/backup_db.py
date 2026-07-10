import shutil
import sys
from datetime import datetime
from pathlib import Path

DB_PATH = Path(__file__).resolve().parent.parent / "db" / "assethub.db"
BACKUP_DIR = Path(__file__).resolve().parent.parent / "db" / "backups"
KEEP_DAYS = 30


def backup():
    if not DB_PATH.exists():
        print(f"DB 파일이 없습니다: {DB_PATH}")
        sys.exit(1)

    BACKUP_DIR.mkdir(parents=True, exist_ok=True)
    stamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    dest = BACKUP_DIR / f"assethub_{stamp}.db"
    shutil.copy2(DB_PATH, dest)
    print(f"백업 완료: {dest}")

    cutoff = datetime.now().timestamp() - KEEP_DAYS * 86400
    for f in BACKUP_DIR.glob("assethub_*.db"):
        if f.stat().st_mtime < cutoff:
            f.unlink()
            print(f"오래된 백업 삭제: {f.name}")


if __name__ == "__main__":
    backup()
