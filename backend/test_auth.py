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
from db.helpers import MEMBER_COLUMNS, insert_rows  # noqa: E402
from deps import get_current_user  # noqa: E402
from routers.auth_router import LoginReq, login  # noqa: E402
from routers.bootstrap_router import bootstrap  # noqa: E402
from routers.members_router import PermissionReq, ResetPasswordReq, reset_password, set_permission, update_member  # noqa: E402
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
admin = login(LoginReq(employeeNo="admin", password="adminpass1"))["member"]
assert "passwordHash" not in admin
assert status_of(login, LoginReq(employeeNo="admin", password="wrong")) == 401

with db() as conn:
    conn.execute("INSERT INTO members (employeeNo, name) VALUES ('1001', '홍길동')")
viewer_id = 2

# permission NULL: 비밀번호 발급 불가, 로그인 불가
assert status_of(reset_password, viewer_id, ResetPasswordReq(new_password="temppass12"), admin) == 400
set_permission(viewer_id, PermissionReq(permission="viewer"), admin)
reset_password(viewer_id, ResetPasswordReq(new_password="temppass12"), admin)
viewer = user_from(login(LoginReq(employeeNo="1001", password="temppass12"))["token"])
assert viewer["permission"] == "viewer"

# viewer 권한 승격 차단: 일반 PATCH로는 permission이 무시됨
update_member(viewer_id, {"permission": "admin", "name": "홍길동"}, admin)
with db() as conn:
    assert conn.execute("SELECT permission FROM members WHERE id = ?", (viewer_id,)).fetchone()[0] == "viewer"

# 토큰이 살아 있어도 권한 회수·퇴직은 즉시 반영
token = create_token({"id": viewer_id})
set_permission(viewer_id, PermissionReq(permission=None), admin)
assert status_of(user_from, token) == 401
assert status_of(user_from, "garbage") == 401
assert status_of(set_permission, admin["id"], PermissionReq(permission="viewer"), admin) == 400

# bootstrap 응답에 passwordHash 없음
assert all("passwordHash" not in m for m in bootstrap(admin)["members"])

# 쓰기 실패 후에도 연결이 남지 않아 다음 쓰기가 잠기지 않음
try:
    insert_rows("members", MEMBER_COLUMNS, [{"employeeNo": "1001", "name": "중복"}])
    raise AssertionError("중복 사번이 통과됨")
except sqlite3.IntegrityError:
    pass
insert_rows("members", MEMBER_COLUMNS, [{"employeeNo": "1002", "name": "김철수"}])

print("OK")
