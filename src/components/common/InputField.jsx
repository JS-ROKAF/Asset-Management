import { C } from "../../constants";

export default function InputField({ label, value, onChange, type = "text", placeholder = "" }) {
  return (   
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      <label style={{ fontSize: 12, color: C.textMuted, fontWeight: 600 }}>{label}</label>
      <input
        type={type}
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        style={{
          border: `1px solid ${C.border}`,
          borderRadius: 8,
          padding: "10px 12px",
          fontSize: 14,
          color: C.text,
          outline: "none",
          transition: "border 0.15s"
        }}
        onFocus={e => e.target.style.borderColor = C.primary}
        onBlur={e => e.target.style.borderColor = C.border}
      />
    </div>
  );
}