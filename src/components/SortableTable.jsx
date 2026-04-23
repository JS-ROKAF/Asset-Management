import React from "react";
import { C } from "../constants";

export default function SortableTable({ headers, rows, sortKey, sortDir, onSort, extraHeader }) {
  return (
    <div style={{ background: C.card, borderRadius: 12, boxShadow: "0 1px 4px rgba(0,0,0,0.06)", overflow: "auto" }}>
      <table style={{ width: "100%", borderCollapse: "collapse" }}>
        <thead>
          <tr style={{ background: "#F8FAFC", borderBottom: `1px solid ${C.border}` }}>
            {extraHeader && <th style={{ padding: "12px 16px", width: 40 }}>{extraHeader}</th>}
            {headers.map(({ label, key, width }) => (
              <th
                key={label}
                onClick={() => key && onSort(key)}
                style={{
                  padding: "10px 12px",
                  textAlign: "left",
                  fontSize: 12,
                  fontWeight: 600,
                  color: sortKey === key ? C.primary : C.textMuted,
                  letterSpacing: "0.04em",
                  cursor: key ? "pointer" : "default",
                  userSelect: "none",
                  whiteSpace: "nowrap",
                  width: width,          
                  maxWidth: width
                }}
              >
                {label}
                {key && (
                  <span style={{ marginLeft: 4, opacity: sortKey === key ? 1 : 0.3 }}>
                    {sortKey === key ? (sortDir === "asc" ? "↑" : "↓") : "↕"}
                  </span>
                )}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {Array.isArray(rows)
            ? rows.map((row, i) => React.cloneElement(row, { key: row.key || i }))
            : rows}
        </tbody>
      </table>
    </div>
  );
}