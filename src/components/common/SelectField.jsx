import { C } from "../../constants";

export default function SelectField({ label, value, onChange, options }) {
  return (   
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      <label style={{ fontSize: 12, color: C.textMuted, fontWeight: 600 }}>{label}</label>
      <select
        value={value}
        onChange={e => onChange(e.target.value)}
        style={{
          border: `1px solid ${C.border}`,
          borderRadius: 8,
          padding: "10px 12px",
          fontSize: 14,
          color: C.text,
          outline: "none",
          background: "#fff"
        }}
      >
        {options.map(o => (
          <option key={o} value={o}>
            {o === "" ? "미지정" : o}
          </option>
        ))}
      </select>
    </div>
  );
}