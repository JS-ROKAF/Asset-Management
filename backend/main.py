import os
import sqlite3
from pathlib import Path

from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from db.database import init_db
from routers import (
    auth_router, bootstrap_router, assets_router, members_router,
    history_router, requests_router, inspections_router, masters_router,
)

app = FastAPI(title="AssetHub API")

# 사내망 고정 IP만 허용. 트레이 운영 시에는 화면·API가 같은 origin이라 CORS를 타지 않고,
# 개발서버(npm run dev, 5173)에서만 필요하다. 외부 도메인은 허용하지 않는다.
ALLOWED_ORIGINS = os.environ.get(
    "ALLOWED_ORIGINS", "http://192.168.0.189:8011,http://192.168.0.189:5173"
).split(",")

app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# DB 제약 위반을 500 대신 400 + 읽을 수 있는 문구로
INTEGRITY_MESSAGES = {
    "assets.serial": "이미 등록된 시리얼입니다.",
    "assets.id": "이미 있는 자산번호입니다.",
    "members.loginId": "이미 쓰이는 아이디입니다.",
    "departments.name": "이미 있는 부서명입니다.",
    "members.email": "이미 등록된 이메일입니다.",
    "status = '사용중'": "사용중이면 사용자가 필요하고, 그 외 상태는 사용자가 없어야 합니다.",
    "FOREIGN KEY": "없는 기준정보·구성원을 참조했습니다.",
}


@app.exception_handler(sqlite3.IntegrityError)
def integrity_error(request: Request, exc: sqlite3.IntegrityError):
    msg = str(exc)
    detail = next((v for k, v in INTEGRITY_MESSAGES.items() if k in msg), f"입력값이 올바르지 않습니다 ({msg})")
    return JSONResponse(status_code=400, content={"detail": detail})


@app.on_event("startup")
def on_startup():
    init_db()


app.include_router(auth_router.router)
app.include_router(bootstrap_router.router)
app.include_router(assets_router.router)
app.include_router(members_router.router)
app.include_router(history_router.router)
app.include_router(requests_router.router)
app.include_router(inspections_router.router)
app.include_router(masters_router.router)

# 프론트엔드 빌드 결과물(dist) 서빙 — 트레이 실행 시 단일 포트(8001)로 API+화면 통합
DIST_DIR = Path(__file__).resolve().parent.parent / "dist"
if DIST_DIR.exists():
    app.mount("/", StaticFiles(directory=DIST_DIR, html=True), name="frontend")
