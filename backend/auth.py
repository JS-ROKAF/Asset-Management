import os
import secrets
from datetime import datetime, timedelta, timezone
from pathlib import Path

from jose import jwt
from passlib.context import CryptContext

SECRET_FILE = Path(__file__).resolve().parent / ".jwt_secret"


def _load_secret() -> str:
    # 환경변수 우선, 없으면 첫 실행 시 무작위 생성해 파일로 보관 (git 미추적)
    if os.environ.get("JWT_SECRET"):
        return os.environ["JWT_SECRET"]
    if not SECRET_FILE.exists():
        SECRET_FILE.write_text(secrets.token_urlsafe(48), encoding="utf-8")
    return SECRET_FILE.read_text(encoding="utf-8").strip()


JWT_SECRET = _load_secret()
JWT_ALGORITHM = "HS256"
JWT_EXPIRE_HOURS = 8

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


def hash_password(password: str) -> str:
    return pwd_context.hash(password)


def verify_password(password: str, password_hash: str) -> bool:
    if not password_hash:
        return False
    return pwd_context.verify(password, password_hash)


def create_token(member: dict) -> str:
    # 권한·부서는 토큰에 넣지 않는다. 매 요청마다 DB에서 다시 읽음 (deps.get_current_user)
    payload = {
        "sub": str(member["id"]),
        "exp": datetime.now(timezone.utc) + timedelta(hours=JWT_EXPIRE_HOURS),
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)


def decode_token(token: str) -> dict:
    return jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
