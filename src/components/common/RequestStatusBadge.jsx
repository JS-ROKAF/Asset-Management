import { C } from "../../constants";

export default function RequestStatusBadge ({ status }) {
  const style = REQUEST_STATUS_STYLES[status] || { background: "#F1F5F9", color: "#64748B" };
  return <span style={{ ...style, padding: "3px 10px", borderRadius: 99, fontSize: 12, fontWeight: 600 }}>{status}</span>;
};