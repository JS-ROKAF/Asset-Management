import sys

from auth import hash_password
from db.database import db, init_db


def seed_admin(password: str, login_id: str = "admin", name: str = "시스템관리자"):
    """시스템 admin 계정 생성/비밀번호 초기화. 아이디 기본값 'admin' (인사 연동 대상 제외, 설계안 v2.1 2장)"""
    init_db()
    with db() as conn:
        existing = conn.execute("SELECT id FROM members WHERE loginId = ?", (login_id,)).fetchone()
        if existing:
            conn.execute(
                "UPDATE members SET passwordHash = ?, permission = 'admin', status = '재직' WHERE id = ?",
                (hash_password(password), existing["id"]),
            )
            print(f"기존 계정 {login_id} 비밀번호 갱신 + admin 권한 부여")
        else:
            conn.execute(
                "INSERT INTO members (loginId, name, permission, status, passwordHash) VALUES (?, ?, 'admin', '재직', ?)",
                (login_id, name, hash_password(password)),
            )
            print(f"신규 admin 계정 생성: {login_id}")


if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("사용법: python seed_admin.py <password> [아이디=admin] [이름=시스템관리자]")
        sys.exit(1)
    seed_admin(*sys.argv[1:])
