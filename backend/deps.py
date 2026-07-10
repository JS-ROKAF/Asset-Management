from fastapi import Depends, HTTPException
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from jose.exceptions import JWTError

from auth import decode_token

security = HTTPBearer()


def get_current_user(creds: HTTPAuthorizationCredentials = Depends(security)) -> dict:
    try:
        return decode_token(creds.credentials)
    except JWTError:
        raise HTTPException(401, "유효하지 않은 토큰입니다.")


def require_admin(user: dict = Depends(get_current_user)) -> dict:
    if user.get("permission") != "admin":
        raise HTTPException(403, "관리자 권한이 필요합니다.")
    return user


def require_not_viewer(user: dict = Depends(get_current_user)) -> dict:
    if user.get("permission") == "viewer":
        raise HTTPException(403, "권한이 없습니다.")
    return user
