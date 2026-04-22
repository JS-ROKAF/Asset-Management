import { C } from "../../constants";

export default function Btn ({ onClick, children, variant = "primary", small }) {
  const styles = {
    primary: { background: C.primary, color: "#fff", border: "none" },
    ghost:   { background: "#fff", color: C.textMuted, border: `1px solid ${C.border}` },
    danger:  { background: C.dangerBg, color: C.danger, border: "none" },
    purple:  { background: C.purple, color: "#fff", border: "none" },
  };
  return (
    <button onClick={onClick}
      style={{ ...styles[variant], padding: small ? "7px 14px" : "10px 20px", borderRadius: 8, fontSize: small ? 13 : 14, fontWeight: 600, cursor: "pointer", transition: "opacity 0.15s" }}
      onMouseEnter={e => e.currentTarget.style.opacity = "0.85"}
      onMouseLeave={e => e.currentTarget.style.opacity = "1"}
    >
      {children}
    </button>
  );
};