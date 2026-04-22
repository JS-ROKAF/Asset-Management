import { C } from "../../constants";

export default function SummaryCards ({ items }) {
  <div style={{ display: "grid", gridTemplateColumns: `repeat(${Math.min(items.length, 6)}, 1fr)`, gap: 12, marginBottom: 28 }}>
    {items.map(({ label, value, color }) => (
      <div key={label} style={{ background: C.card, borderRadius: 12, padding: "16px 20px", boxShadow: "0 1px 4px rgba(0,0,0,0.06)" }}>
        <p style={{ margin: 0, fontSize: 12, color: C.textLight, fontWeight: 500 }}>{label}</p>
        <p style={{ margin: "6px 0 0", fontSize: 24, fontWeight: 700, color }}>{value}</p>
      </div>
    ))}
  </div>
};