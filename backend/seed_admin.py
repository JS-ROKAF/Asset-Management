import sys

from auth import hash_password
from db.database import db, init_db


def seed_admin(password: str, employee_no: str = "admin", name: str = "관리자"):
    """시스템 admin 계정 생성/비밀번호 초기화. 사번 기본값 'admin' (인사 연동 대상 제외, 설계안 3-5)"""
    init_db()
    with db() as conn:
        existing = conn.execute("SELECT id FROM members WHERE employeeNo = ?", (employee_no,)).fetchone()
        if existing:
            conn.execute(
                "UPDATE members SET passwordHash = ?, permission = 'admin', status = '재직' WHERE employeeNo = ?",
                (hash_password(password), employee_no),
            )
            print(f"기존 계정 {employee_no} 비밀번호 갱신 + admin 권한 부여")
        else:
            conn.execute(
                "INSERT INTO members (employeeNo, name, permission, status, passwordHash) VALUES (?, ?, 'admin', '재직', ?)",
                (employee_no, name, hash_password(password)),
            )
            print(f"신규 admin 계정 생성: {employee_no}")


if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("사용법: python seed_admin.py <password> [사번=admin] [이름=관리자]")
        sys.exit(1)
    seed_admin(*sys.argv[1:])
