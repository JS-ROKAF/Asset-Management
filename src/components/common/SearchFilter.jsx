import { C } from "../../constants";

export default function SearchFilter({ value, onChange, filters = [], active, onFilter, activeColor = C.primary }) {
  return (
    <div style={{ display: "flex", gap: 10, marginBottom: 16, flexWrap: "wrap" }}>
      <input
        placeholder="검색..."
        value={value}
        onChange={e => onChange(e.target.value)}
        style={{ flex: 1, minWidth: 180, border: `1px solid ${C.border}`, borderRadius: 8, padding: "9px 14px", fontSize: 14, outline: "none", background: C.card }}
        onFocus={e => e.target.style.borderColor = C.primary}
        onBlur={e => e.target.style.borderColor = C.border}
      />
      {filters.map(f => (
        <button key={f} onClick={() => onFilter(f)}
          style={{ padding: "9px 16px", borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: "pointer", border: `1px solid ${C.border}`, background: active === f ? activeColor : C.card, color: active === f ? "#fff" : C.textMuted, transition: "all 0.15s" }}>
          {f}
        </button>
      ))}
    </div>
  );
}