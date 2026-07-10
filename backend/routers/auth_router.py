from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from auth import create_token, verify_password
from db.database import get_conn
from deps import get_current_user

router = APIRouter(prefix="/api/auth", tags=["auth"])


class LoginReq(BaseModel):
    email: str
    password: str


@router.post("/login")
def login(req: LoginReq):
    conn = get_conn()
    row = conn.execute("SELECT * FROM members WHERE email = ?", (req.email,)).fetchone()
    conn.close()
    if not row:
        raise HTTPException(401, "이메일 또는 비밀번호가 올바르지 않습니다.")
    member = dict(row)
    if not member.get("password_hash"):
        raise HTTPException(401, "비밀번호가 설정되지 않았습니다. 관리자에게 임시 비밀번호 발급을 요청하세요.")
    if not verify_password(req.password, member["password_hash"]):
        raise HTTPException(401, "이메일 또는 비밀번호가 올바르지 않습니다.")
    if member.get("status") == "퇴직":
        raise HTTPException(403, "퇴직 처리된 계정입니다.")

    token = create_token(member)
    member.pop("password_hash", None)
    return {"token": token, "member": member}


@router.get("/me")
def me(user: dict = Depends(get_current_user)):
    conn = get_conn()
    row = conn.execute("SELECT * FROM members WHERE id = ?", (user["sub"],)).fetchone()
    conn.close()
    if not row:
        raise HTTPException(404, "사용자를 찾을 수 없습니다.")
    member = dict(row)
    member.pop("password_hash", None)
    return member
