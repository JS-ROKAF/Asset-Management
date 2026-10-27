from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from auth import create_token, verify_password
from db.database import db
from deps import MEMBER_PUBLIC, get_current_user

router = APIRouter(prefix="/api/auth", tags=["auth"])

BAD_LOGIN = "아이디 또는 비밀번호가 올바르지 않습니다."


class LoginReq(BaseModel):
    loginId: str
    password: str


@router.post("/login")
def login(req: LoginReq):
    with db() as conn:
        row = conn.execute(
            f"SELECT {MEMBER_PUBLIC}, passwordHash FROM members WHERE loginId = ?",   # 칸이 COLLATE NOCASE — 대소문자 무시
            (req.loginId.strip(),),
        ).fetchone()
    if not row:
        raise HTTPException(401, BAD_LOGIN)
    member = dict(row)
    password_hash = member.pop("passwordHash")
    if member["permission"] is None:
        raise HTTPException(403, "로그인 권한이 없는 구성원입니다.")
    if not password_hash:
        raise HTTPException(401, "비밀번호가 설정되지 않았습니다. 관리자에게 임시 비밀번호 발급을 요청하세요.")
    if not verify_password(req.password, password_hash):
        raise HTTPException(401, BAD_LOGIN)
    if member["status"] != "재직":
        raise HTTPException(403, "퇴직 처리된 계정입니다.")
    return {"token": create_token(member), "member": member}


@router.get("/me")
def me(user: dict = Depends(get_current_user)):
    return user
