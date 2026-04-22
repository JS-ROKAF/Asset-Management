import { C } from "../../constants";

// ── 페이지네이션 ──
export default function Pagination ({ total, page, perPage, onChange }) {
  const totalPages = Math.ceil(total / perPage);
  if (totalPages <= 1) return null;

  return (
    <div style={{ display: "flex", justifyContent: "center", alignItems: "center", gap: 6, marginTop: 16 }}>
      <button onClick={() => onChange(1)} disabled={page === 1}
        style={{ padding: "6px 10px", borderRadius: 6, border: `1px solid ${C.border}`, background: C.card, color: page === 1 ? C.textLight : C.textMuted, cursor: page === 1 ? "default" : "pointer", fontSize: 13 }}>
        «
      </button>
      <button onClick={() => onChange(page - 1)} disabled={page === 1}
        style={{ padding: "6px 10px", borderRadius: 6, border: `1px solid ${C.border}`, background: C.card, color: page === 1 ? C.textLight : C.textMuted, cursor: page === 1 ? "default" : "pointer", fontSize: 13 }}>
        ‹
      </button>
      {Array.from({ length: totalPages }, (_, i) => i + 1)
        .filter(p => p === 1 || p === totalPages || Math.abs(p - page) <= 2)
        .reduce((acc, p, i, arr) => {
          if (i > 0 && p - arr[i - 1] > 1) acc.push("...");
          acc.push(p);
          return acc;
        }, [])
        .map((p, i) => p === "..." ? (
          <span key={`ellipsis-${i}`} style={{ padding: "6px 4px", color: C.textLight, fontSize: 13 }}>...</span>
        ) : (
          <button key={p} onClick={() => onChange(p)}
            style={{ padding: "6px 10px", borderRadius: 6, border: `1px solid ${p === page ? C.primary : C.border}`, background: p === page ? C.primary : C.card, color: p === page ? "#fff" : C.textMuted, cursor: "pointer", fontSize: 13, fontWeight: p === page ? 700 : 400 }}>
            {p}
          </button>
        ))
      }
      <button onClick={() => onChange(page + 1)} disabled={page === totalPages}
        style={{ padding: "6px 10px", borderRadius: 6, border: `1px solid ${C.border}`, background: C.card, color: page === totalPages ? C.textLight : C.textMuted, cursor: page === totalPages ? "default" : "pointer", fontSize: 13 }}>
        ›
      </button>
      <button onClick={() => onChange(totalPages)} disabled={page === totalPages}
        style={{ padding: "6px 10px", borderRadius: 6, border: `1px solid ${C.border}`, background: C.card, color: page === totalPages ? C.textLight : C.textMuted, cursor: page === totalPages ? "default" : "pointer", fontSize: 13 }}>
        »
      </button>
      <span style={{ fontSize: 13, color: C.textLight, marginLeft: 8 }}>
        총 {total}개 중 {Math.min((page - 1) * perPage + 1, total)}~{Math.min(page * perPage, total)}
      </span>
    </div>
  );
};
