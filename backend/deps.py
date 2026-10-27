from fastapi import Depends, HTTPException
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from jose.exceptions import JWTError

from auth import decode_token
from db.database import db

security = HTTPBearer()

# passwordHash는 응답에 절대 포함하지 않는다
MEMBER_PUBLIC = "id, employeeNo, email, name, departmentId, position, permission, status"


def get_current_user(creds: HTTPAuthorizationCredentials = Depends(security)) -> dict:
    try:
        member_id = int(decode_token(creds.credentials)["sub"])
    except (JWTError, KeyError, ValueError):
        raise HTTPException(401, "유효하지 않은 토큰입니다.")
    # 매 요청 DB 재확인: 권한 회수·퇴직이 토큰 만료를 기다리지 않고 즉시 반영됨
    with db() as conn:
        row = conn.execute(f"SELECT {MEMBER_PUBLIC} FROM members WHERE id = ?", (member_id,)).fetchone()
    if not row or row["permission"] is None or row["status"] != "재직":
        raise HTTPException(401, "로그인할 수 없는 계정입니다.")
    return dict(row)


def require_admin(user: dict = Depends(get_current_user)) -> dict:
    if user["permission"] != "admin":
        raise HTTPException(403, "관리자 권한이 필요합니다.")
    return user


def require_not_viewer(user: dict = Depends(get_current_user)) -> dict:
    if user["permission"] == "viewer":
        raise HTTPException(403, "권한이 없습니다.")
    return user
