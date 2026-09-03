from db.database import get_conn

ASSET_COLUMNS = [
    "id", "name", "type", "status", "user", "department", "location",
    "purchaseDate", "purchaseCost", "vendor", "model", "serial",
    "warrantyExpiry", "note", "date", "isDisposed", "disposalReason",
    "disposalMethod", "disposalDate",
]
MEMBER_COLUMNS = ["id", "name", "department", "email", "role", "permission", "status"]
HISTORY_COLUMNS = ["id", "assetId", "assetName", "type", "from", "to", "date", "note"]
REQUEST_COLUMNS = [
    "id", "type", "assetId", "assetName", "targetUser", "requesterId", "requesterName",
    "status", "note", "resolvedNote", "resolvedDate", "date",
]
INSPECTION_COLUMNS = ["id", "title", "status", "startDate", "endDate", "createdBy", "note"]
INSPECTION_ITEM_COLUMNS = [
    "id", "inspectionId", "assetId", "assetName", "department",
    "assignedUser", "confirmedBy", "status", "note", "confirmedDate",
]


def _quote(col: str) -> str:
    return f'"{col}"'


def insert_rows(table: str, allowed: list[str], rows: list[dict]) -> list[dict]:
    if not rows:
        return []
    conn = get_conn()
    inserted = []
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
    conn.commit()
    conn.close()
    return inserted


def update_row(table: str, allowed: list[str], row_id, fields: dict) -> dict | None:
    cols = [c for c in fields.keys() if c in allowed and c != "id"]
    if not cols:
        return None
    conn = get_conn()
    set_sql = ",".join(f'{_quote(c)} = ?' for c in cols)
    conn.execute(
        f'UPDATE {table} SET {set_sql} WHERE id = ?',
        [fields[c] for c in cols] + [row_id],
    )
    conn.commit()
    fetched = conn.execute(f"SELECT * FROM {table} WHERE id = ?", (row_id,)).fetchone()
    conn.close()
    return dict(fetched) if fetched else None


def delete_rows(table: str, ids: list) -> None:
    if not ids:
        return
    conn = get_conn()
    placeholders = ",".join("?" for _ in ids)
    conn.execute(f"DELETE FROM {table} WHERE id IN ({placeholders})", ids)
    conn.commit()
    conn.close()
