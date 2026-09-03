import { STATUS_STYLES, HISTORY_STYLES, REQUEST_STYLES, REQUEST_STATUS_STYLES } from "../../constants";

const FALLBACK = { background: "#F1F5F9", color: "#64748B" };

function Badge ({ value, styles }) {
  return (
    <span style={{ ...(styles[value] || FALLBACK), padding: "3px 10px", borderRadius: 99, fontSize: 12, fontWeight: 600 }}>
      {value}
    </span>
  );
}

export const StatusBadge = ({ status }) => <Badge value={status} styles={STATUS_STYLES} />;
export const HistoryBadge = ({ type }) => <Badge value={type} styles={HISTORY_STYLES} />;
export const RequestBadge = ({ type }) => <Badge value={type} styles={REQUEST_STYLES} />;
export const RequestStatusBadge = ({ status }) => <Badge value={status} styles={REQUEST_STATUS_STYLES} />;
