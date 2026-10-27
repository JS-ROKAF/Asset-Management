from datetime import date
from typing import Any

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from asset_ops import apply_change, get_asset
from db.database import db
from db.helpers import REQUEST_COLUMNS, insert_rows, delete_rows
from deps import get_current_user, require_not_viewer

router = APIRouter(prefix="/api/requests", tags=["requests"])


@router.post("")
def create_request(fields: dict[str, Any], user: dict = Depends(get_current_user)):
    # 요청자는 토큰 사용자로 고정 (타인 명의 요청 방지)
    with db() as conn:
        asset = get_asset(conn, fields.get("assetId"))
    if asset["isDisposed"]:
        raise HTTPException(400, "폐기된 자산입니다.")
    inserted = insert_rows("requests", REQUEST_COLUMNS, [{
        **fields, "requesterId": user["id"], "status": "대기중",
        "resolvedNote": None, "resolvedDate": None, "date": date.today().isoformat(),
    }])
    return inserted[0]


class ResolveReq(BaseModel):
    approve: bool
    resolvedNote: str | None = None


@router.post("/{request_id}/resolve")
def resolve(request_id: int, req: ResolveReq, user: dict = Depends(require_not_viewer)):
    # 승인 시 자산 변경 + 이력 + 요청 상태를 한 트랜잭션으로
    with db(write=True) as conn:
        r = conn.execute("SELECT * FROM requests WHERE id = ?", (request_id,)).fetchone()
        if not r:
            raise HTTPException(404, "요청을 찾을 수 없습니다.")
        if r["status"] != "대기중":
            raise HTTPException(400, "이미 처리된 요청입니다.")
        if req.approve:
            asset = get_asset(conn, r["assetId"])
            member_id = (r["targetMemberId"] or r["requesterId"]) if r["type"] == "배정요청" else None
            apply_change(conn, user, asset, {"memberId": member_id}, None, f"{r['type']} 승인")
        conn.execute(
            "UPDATE requests SET status = ?, resolvedNote = ?, resolvedDate = ? WHERE id = ?",
            ("승인" if req.approve else "거절", req.resolvedNote, date.today().isoformat(), request_id),
        )
        return dict(conn.execute("SELECT * FROM requests WHERE id = ?", (request_id,)).fetchone())


@router.delete("/{request_id}")
def delete_request(request_id: int, user: dict = Depends(require_not_viewer)):
    delete_rows("requests", [request_id])
    return {"ok": True}
