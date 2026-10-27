"""인증·권한·연결 처리 자체 점검. 임시 DB에서만 동작: python test_auth.py"""
import os
import sqlite3
import tempfile
from pathlib import Path

os.environ["ASSETHUB_DB"] = str(Path(tempfile.mkdtemp()) / "test.db")
os.environ["JWT_SECRET"] = "test-secret"

from fastapi import HTTPException  # noqa: E402
from fastapi.security import HTTPAuthorizationCredentials  # noqa: E402

from auth import create_token  # noqa: E402
from db.database import db  # noqa: E402
from deps import get_current_user  # noqa: E402
from routers.auth_router import LoginReq, login  # noqa: E402
from routers.bootstrap_router import bootstrap  # noqa: E402
from routers.members_router import PermissionReq, ResetPasswordReq, UpdateReq, create_member, reset_password, set_permission, update_member  # noqa: E402
from seed_admin import seed_admin  # noqa: E402


def status_of(fn, *args):
    try:
        fn(*args)
    except HTTPException as e:
        return e.status_code
    return 200


def user_from(token):
    return get_current_user(HTTPAuthorizationCredentials(scheme="Bearer", credentials=token))


seed_admin("adminpass1")
admin = login(LoginReq(loginId="ADMIN", password="adminpass1"))["member"]   # 대소문자 무시
assert "passwordHash" not in admin
assert status_of(login, LoginReq(loginId="admin", password="wrong")) == 401

with db() as conn:
    conn.execute("INSERT INTO members (name) VALUES ('홍길동')")
viewer_id = 2

# permission NULL: 비밀번호 발급 불가, 로그인 불가
assert status_of(reset_password, viewer_id, ResetPasswordReq(new_password="temppass12"), admin) == 400
assert status_of(set_permission, viewer_id, PermissionReq(permission="viewer"), admin) == 400      # 아이디 없이 권한 부여 불가
assert status_of(set_permission, viewer_id, PermissionReq(permission="viewer", loginId="홍길동"), admin) == 400  # 한글 아이디
try:   # 중복(대소문자 무시) — HTTP에서는 main.py의 IntegrityError 처리기가 400으로 바꾼다
    set_permission(viewer_id, PermissionReq(permission="viewer", loginId="Admin"), admin)
    raise AssertionError("중복 아이디가 통과됨")
except sqlite3.IntegrityError:
    pass
assert set_permission(viewer_id, PermissionReq(permission="viewer", loginId="hong"), admin)["loginId"] == "hong"
reset_password(viewer_id, ResetPasswordReq(new_password="temppass12"), admin)
viewer = user_from(login(LoginReq(loginId="hong", password="temppass12"))["token"])
assert viewer["permission"] == "viewer"

# viewer 권한 승격 차단: 일반 PATCH로는 permission을 보낼 수 없음
assert status_of(update_member, viewer_id, UpdateReq(fields={"permission": "admin"}), admin) == 400
with db() as conn:
    assert conn.execute("SELECT permission FROM members WHERE id = ?", (viewer_id,)).fetchone()[0] == "viewer"

# 토큰이 살아 있어도 권한 회수·퇴직은 즉시 반영
token = create_token({"id": viewer_id})
set_permission(viewer_id, PermissionReq(permission=None), admin)
assert status_of(user_from, token) == 401
with db() as conn:   # 권한 회수 시 아이디·비밀번호도 지워짐
    assert tuple(conn.execute("SELECT loginId, passwordHash FROM members WHERE id = ?", (viewer_id,)).fetchone()) == (None, None)
assert status_of(user_from, "garbage") == 401
assert status_of(set_permission, admin["id"], PermissionReq(permission="viewer"), admin) == 400

# bootstrap 응답에 passwordHash 없음. loginId는 admin 응답에만
assert all("passwordHash" not in m for m in bootstrap(admin)["members"])
assert all("loginId" in m for m in bootstrap(admin)["members"])
assert all("loginId" not in m for m in bootstrap({"id": viewer_id, "permission": "viewer", "departmentId": None})["members"])

# 쓰기 실패 후에도 연결이 남지 않아 다음 쓰기가 잠기지 않음
try:
    create_member({"name": "중복", "email": "a@x.com"}, admin)
    create_member({"name": "중복2", "email": "a@x.com"}, admin)
    raise AssertionError("중복 이메일이 통과됨")
except sqlite3.IntegrityError:
    pass
create_member({"name": "김철수"}, admin)
assert status_of(create_member, {"name": "김/철수"}, admin) == 400

print("OK")
