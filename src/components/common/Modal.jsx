import { C } from "../../constants";

export default function Modal({ title, onClose, children, wide }) {
  return (
    <div
      onClick={onClose}
      style={{ position: "fixed", inset: 0, background: "rgba(15,23,42,0.45)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 50 }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{ background: C.card, borderRadius: 16, padding: 32, width: wide ? 600 : 480, boxShadow: "0 24px 64px rgba(0,0,0,0.18)", maxHeight: "85vh", overflowY: "auto" }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
          <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: C.text }}>{title}</h2>
          <button onClick={onClose} style={{ background: "#F1F5F9", border: "none", width: 32, height: 32, borderRadius: 8, fontSize: 16, color: C.textMuted, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>✕</button>
        </div>
        {children}
      </div>
    </div>
  );
}