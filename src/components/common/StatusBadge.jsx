import { STATUS_COLORS } from "../../constants";

export default function StatusBadge ({ status }) {
  const style =
    status === "사용중" ? { background: "#D1FAE5", color: "#065F46" } :
    status === "미사용" ? { background: "#F1F5F9", color: "#64748B" } :
    status === "수리중" ? { background: "#FEE2E2", color: "#991B1B" } :
    status === "분실"   ? { background: "#FFF7ED", color: "#C2410C" } :
    { background: "#F1F5F9", color: "#64748B" };
  return <span style={{ ...style, padding: "3px 10px", borderRadius: 99, fontSize: 12, fontWeight: 600 }}>{status}</span>;
};