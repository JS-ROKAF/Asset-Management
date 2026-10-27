from db.database import db

# ponytail: 범용 엔드포인트용 화이트리스트. 요청/실사가 2·3단계에서 전용 API로 바뀌면 제거
REQUEST_COLUMNS = [
    "id", "type", "assetId", "targetMemberId", "requesterId",
    "status", "note", "resolvedNote", "resolvedDate", "date",
]
INSPECTION_COLUMNS = ["id", "title", "status", "startedAt", "endedAt", "createdBy"]
INSPECTION_CHECK_COLUMNS = ["id", "inspectionId", "assetId", "result", "checkedBy", "checkedAt", "note"]


def _quote(col: str) -> str:
    return f'"{col}"'


def insert_rows(table: str, allowed: list[str], rows: list[dict]) -> list[dict]:
    if not rows:
        return []
    inserted = []
    with db() as conn:
        for row in rows:
            cols = [c for c in row.keys() if c in allowed]
            placeholders = ",".join("?" for _ in cols)
            col_sql = ",".join(_quote(c) for c in cols)
            cur = conn.execute(
                f'INSERT INTO {table} ({col_sql}) VALUES ({placeholders})',
                [row[c] for c in cols],
            )
            row_id = row.get("id", cur.lastrowid)
            fetched = conn.execute(f"SELECT * FROM {table} WHERE id = ?", (row_id,)).fetchone()
            inserted.append(dict(fetched))
    return inserted


def update_row(table: str, allowed: list[str], row_id, fields: dict) -> dict | None:
    cols = [c for c in fields.keys() if c in allowed and c != "id"]
    if not cols:
        return None
    set_sql = ",".join(f'{_quote(c)} = ?' for c in cols)
    with db() as conn:
        conn.execute(
            f'UPDATE {table} SET {set_sql} WHERE id = ?',
            [fields[c] for c in cols] + [row_id],
        )
        fetched = conn.execute(f"SELECT * FROM {table} WHERE id = ?", (row_id,)).fetchone()
    return dict(fetched) if fetched else None


def delete_rows(table: str, ids: list) -> None:
    if not ids:
        return
    placeholders = ",".join("?" for _ in ids)
    with db() as conn:
        conn.execute(f"DELETE FROM {table} WHERE id IN ({placeholders})", ids)
