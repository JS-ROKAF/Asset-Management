"""SQLite 백업.
- backup(tag): 로컬 db/backups/ — 가져오기 저장 직전 등 서버가 호출, 30일 보관
- nas_backup(): NAS 매일 백업 — 작업 스케줄러 AssetHub_DbBackup이 `python backup_db.py`로 호출, 14세대 보관
둘 다 Connection.backup()을 쓰므로 서버 가동 중에도 안전 (WAL 포함 일관된 스냅샷).
NAS에는 백업본만 보낸다 — 라이브 DB를 SMB에 두면 락이 깨져 손상된다. (HR AGENT backup_db.py와 같은 방식)
"""
import os
import sqlite3
import sys
from datetime import datetime
from pathlib import Path

from db.database import DB_PATH

BACKUP_DIR = Path(DB_PATH).parent / "backups"
KEEP_DAYS = 30

# UNC는 슬래시로 적는다. 역슬래시 하나가 먹히면 `\Durae_Nas_HQ\...`(로컬 드라이브 루트)로 조용히 바뀐다
NAS_DIR = Path("//Durae_Nas_HQ/NetBackup/AssetHub")
NAS_PREFIX = "assethub_"
NAS_KEEP = 14
LOG = Path(__file__).resolve().parent.parent / "db" / "backup_nas.log"


def _snapshot(dest: Path):
    src = sqlite3.connect(f"file:{os.fspath(DB_PATH)}?mode=ro", uri=True)
    dst = sqlite3.connect(os.fspath(dest))
    try:
        src.backup(dst)
        dst.execute("PRAGMA journal_mode=DELETE")   # 백업본은 단일 파일로 (-wal/-shm 없이 옮겨도 열리게)
    finally:
        dst.close()
        src.close()


def backup(tag: str = "") -> Path:
    if not Path(DB_PATH).exists():
        raise FileNotFoundError(f"DB 파일이 없습니다: {DB_PATH}")
    BACKUP_DIR.mkdir(parents=True, exist_ok=True)
    stamp = datetime.now().strftime("%Y%m%d_%H%M%S_%f")
    dest = BACKUP_DIR / f"assethub_{stamp}{'_' + tag if tag else ''}.db"
    _snapshot(dest)

    cutoff = datetime.now().timestamp() - KEEP_DAYS * 86400
    for f in BACKUP_DIR.glob("assethub_*.db"):
        if f.stat().st_mtime < cutoff:
            f.unlink()
    return dest


def _log(msg: str):
    line = f"{datetime.now():%Y-%m-%d %H:%M:%S} {msg}"
    with LOG.open("a", encoding="utf-8") as f:
        f.write(line + "\n")
    print(line)


def nas_backup(nas_dir: Path = NAS_DIR) -> int:
    if len(nas_dir.drive) <= 2:   # UNC면 drive가 //host/share 전체
        _log(f"FAIL 목적지가 네트워크 경로가 아님: {nas_dir}")
        return 1
    dest = nas_dir / f"{NAS_PREFIX}{datetime.now():%Y%m%d}.db"
    try:
        if not Path(DB_PATH).exists():
            raise FileNotFoundError(DB_PATH)
        nas_dir.mkdir(parents=True, exist_ok=True)
        dest.unlink(missing_ok=True)   # 같은 날 재실행이면 새로 만든다
        _snapshot(dest)
        chk = sqlite3.connect(f"file:{os.fspath(dest)}?mode=ro", uri=True)
        integrity = chk.execute("PRAGMA integrity_check").fetchone()[0]
        assets = chk.execute("SELECT count(*) FROM assets").fetchone()[0]
        chk.close()
        if integrity != "ok":
            _log(f"FAIL integrity={integrity} {dest.name}")
            return 1
    except Exception as exc:
        _log(f"FAIL {type(exc).__name__}: {exc}")
        return 1
    old = sorted(nas_dir.glob(NAS_PREFIX + "*.db"))[:-NAS_KEEP]   # 날짜 이름 = 사전순
    for f in old:
        f.unlink(missing_ok=True)
    _log(f"OK {dest.name} {dest.stat().st_size / 1e6:.2f}MB assets={assets} 삭제={len(old)}")
    return 0


if __name__ == "__main__":
    sys.exit(nas_backup())
