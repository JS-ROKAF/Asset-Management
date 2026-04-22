import { C } from "../../constants";

export default function Field({ label, value }) {   
  return (   // 👈 return 추가
    <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
      <span style={{ fontSize: 11, color: C.textLight, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em" }}>
        {label}
      </span>
      <span style={{ fontSize: 14, color: C.text, fontWeight: 500 }}>
        {value}
      </span>
    </div>
  );
}