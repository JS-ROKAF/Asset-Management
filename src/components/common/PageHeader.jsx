import { C } from "../../constants";

export default function PageHeader({ title, subtitle, action }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 28 }}>
      <div>
        <h1 style={{ fontSize: 22, fontWeight: 700, color: C.text, margin: 0 }}>{title}</h1>
        <p style={{ fontSize: 13, color: C.textLight, marginTop: 4, marginBottom: 0 }}>{subtitle}</p>
      </div>
      {action}
    </div>
  );
}