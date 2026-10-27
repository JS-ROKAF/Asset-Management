from typing import Any, Literal

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field

import asset_import
from asset_ops import apply_change, create_asset, dispose_asset, get_asset as load_asset
from backup_db import backup
from db.database import db
from deps import get_current_user, require_admin, require_not_viewer

router = APIRouter(prefix="/api/assets", tags=["assets"])

DATE = r"^\d{4}-\d{2}-\d{2}$"


class CreateReq(BaseModel):
    fields: dict[str, Any]
    id: str | None = None          # 수동 입력 번호 (quantity=1일 때만)
    quantity: int = Field(1, ge=1, le=100)
    eventDate: str | None = Field(None, pattern=DATE)
    memo: str | None = None


class PatchReq(BaseModel):
    fields: dict[str, Any]
    updatedAt: str                 # 화면이 읽은 시점의 값. 다르면 409
    eventDate: str | None = Field(None, pattern=DATE)
    memo: str | None = None
    repair: dict[str, Any] | None = None


class BulkReq(BaseModel):
    ids: list[str] = Field(min_length=1)
    fields: dict[str, Any]         # 배정 {memberId}, 반납 {memberId: null}, 상태 {status}, 이동 {departmentId, location}
    eventDate: str | None = Field(None, pattern=DATE)
    memo: str | None = None


class DisposeReq(BaseModel):
    method: Literal["폐기", "매각", "기증", "분실처리"]
    reason: str = Field(min_length=1)
    eventDate: str | None = Field(None, pattern=DATE)


@router.get("/{asset_id}")
def get_asset(asset_id: str, user: dict = Depends(get_current_user)):
    # QR 조회 화면용: 표시 이름까지 붙여서 반환
    with db() as conn:
        asset = load_asset(conn, asset_id)
        names = conn.execute(
            """SELECT t.name typeName, c.code corporationCode, d.name departmentName, m.name memberName
               FROM assets a JOIN asset_types t ON t.id = a.typeId JOIN corporations c ON c.id = a.corporationId
               LEFT JOIN departments d ON d.id = a.departmentId LEFT JOIN members m ON m.id = a.memberId
               WHERE a.id = ?""", (asset_id,)).fetchone()
        return {**asset, **dict(names)}


@router.post("")
def create(req: CreateReq, user: dict = Depends(require_not_viewer)):
    if req.id and req.quantity > 1:
        raise HTTPException(400, "자산번호를 직접 입력할 때는 1개씩만 등록할 수 있습니다.")
    with db(write=True) as conn:
        return [create_asset(conn, user, req.fields, req.id, req.eventDate, req.memo) for _ in range(req.quantity)]


@router.patch("/{asset_id}")
def update(asset_id: str, req: PatchReq, user: dict = Depends(require_not_viewer)):
    with db(write=True) as conn:
        asset = load_asset(conn, asset_id)
        if asset["updatedAt"] != req.updatedAt:
            raise HTTPException(409, "다른 사용자가 먼저 수정했습니다. 새로고침 후 다시 시도하세요.")
        return apply_change(conn, user, asset, req.fields, req.eventDate, req.memo, req.repair)


class ImportReq(BaseModel):
    rows: list[dict[str, Any]] = Field(max_length=3000)


@router.post("/import")
def import_assets(req: ImportReq, dry_run: bool = False, user: dict = Depends(require_admin)):
    # 쓰기 잠금을 먼저 잡고 검증 → 백업 → 단일 트랜잭션 저장. 한 건이라도 실패하면 전체 취소
    with db(write=not dry_run) as conn:
        items, errors = asset_import.plan(conn, req.rows)
        statuses = {}
        for it in items:
            statuses[it["fields"]["status"]] = statuses.get(it["fields"]["status"], 0) + 1
        summary = {
            "total": len(items) + len({e["row"] for e in errors}), "create": len(items),
            "statuses": statuses, "errors": errors, "saved": False,
        }
        if dry_run or errors:
            return summary
        summary["backup"] = backup("before_asset_import").name
        summary["ids"] = asset_import.apply(conn, user, items)
        summary["saved"] = True
        return summary


@router.post("/bulk")
def bulk(req: BulkReq, user: dict = Depends(require_not_viewer)):
    # 한 건이라도 실패하면 전체 취소
    with db(write=True) as conn:
        return [apply_change(conn, user, load_asset(conn, i), req.fields, req.eventDate, req.memo) for i in req.ids]


@router.post("/{asset_id}/dispose")
def dispose(asset_id: str, req: DisposeReq, user: dict = Depends(require_not_viewer)):
    with db(write=True) as conn:
        return dispose_asset(conn, user, load_asset(conn, asset_id), req.method, req.reason, req.eventDate)
