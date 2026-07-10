import sys
import uuid

from auth import hash_password
from db.database import get_conn, init_db


def seed_admin(email: str, password: str, name: str = "관리자", department: str = "경영지원사업부"):
    init_db()
    conn = get_conn()
    existing = conn.execute("SELECT id FROM members WHERE email = ?", (email,)).fetchone()
    if existing:
        conn.execute(
            "UPDATE members SET password_hash = ?, permission = 'admin', status = '재직' WHERE email = ?",
            (hash_password(password), email),
        )
        print(f"기존 계정 {email} 비밀번호 갱신 + admin 권한 부여")
    else:
        conn.execute(
            """INSERT INTO members (id, name, department, email, role, permission, status, password_hash)
               VALUES (?, ?, ?, ?, ?, 'admin', '재직', ?)""",
            (str(uuid.uuid4()), name, department, email, "대표", hash_password(password)),
        )
        print(f"신규 admin 계정 생성: {email}")
    conn.commit()
    conn.close()


if __name__ == "__main__":
    if len(sys.argv) < 3:
        print("사용법: python seed_admin.py <email> <password> [name] [department]")
        sys.exit(1)
    seed_admin(*sys.argv[1:])
