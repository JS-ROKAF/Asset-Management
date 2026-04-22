import { HISTORY_STYLES } from "../../constants";

export default function HistoryBadge ({ type }) {
  const style = HISTORY_STYLES[type] || { background: "#F1F5F9", color: "#64748B" };
  return <span style={{ ...style, padding: "3px 10px", borderRadius: 99, fontSize: 12, fontWeight: 600 }}>{type}</span>;
};