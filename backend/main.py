import os
from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from db.database import init_db
from routers import (
    auth_router, bootstrap_router, assets_router, members_router,
    history_router, requests_router, inspections_router,
)

app = FastAPI(title="AssetHub API")

ALLOWED_ORIGINS = os.environ.get(
    "ALLOWED_ORIGINS", "http://localhost:5173,http://localhost:4173"
).split(",")

app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


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

# 프론트엔드 빌드 결과물(dist) 서빙 — 트레이 실행 시 단일 포트(8001)로 API+화면 통합
DIST_DIR = Path(__file__).resolve().parent.parent / "dist"
if DIST_DIR.exists():
    app.mount("/", StaticFiles(directory=DIST_DIR, html=True), name="frontend")
