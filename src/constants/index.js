export {
  DEPARTMENTS,
  ASSET_STATUS,
  STATUS_OPTIONS,
  STATUS_COLORS,
  HISTORY_TYPES,
  HISTORY_STYLES,
  ASSET_TYPES,
  ROLES,
  REQUEST_TYPES,
  C
};

const DEPARTMENTS = ["경영지원사업부", "SCM사업부", "뉴비즈니스사업부", "CIST", "GIST", "셀럭스", "기술연구소"];
const ASSET_STATUS = {
  IN_USE: "사용중",
  UNUSED: "미사용",
  REPAIR: "수리중",
  LOST: "분실"
};
const STATUS_OPTIONS = Object.values(ASSET_STATUS);
const STATUS_COLORS = { "사용중": "#10B981", "미사용": "#94A3B8", "수리중": "#EF4444", "분실": "#F97316" };
const HISTORY_TYPES = ["전체", "배정", "반납", "입고", "상태변경", "폐기"];
const HISTORY_STYLES = {
  "배정":    { background: "#DBEAFE", color: "#1D4ED8" },
  "반납":    { background: "#FEF3C7", color: "#92400E" },
  "입고":    { background: "#D1FAE5", color: "#065F46" },
  "상태변경": { background: "#F3F0FF", color: "#6D28D9" },
  "폐기":    { background: "#FEE2E2", color: "#991B1B" },
};
const ASSET_TYPES = [
  "노트북",
  "데스크탑",
  "모니터",
  "키보드/마우스",
  "프린터/복합기",
  "TV",
  "네트워크 장비",
  "비품",
  "차량",
  "기타",
];
const ROLES = [
  "인턴", "사원", "주임", "대리", "과장", "차장", "부장",
  "연구원", "주임연구원", "선임연구원", "책임연구원", "수석연구원",
  "원장", "소장", "본부장", "전무", "부사장", "대표"
];
const REQUEST_TYPES = ["반납요청", "배정요청"];
const REQUEST_STYLES = {
  "반납요청": { background: "#FEF3C7", color: "#92400E" },
  "배정요청": { background: "#DBEAFE", color: "#1D4ED8" },
};
const REQUEST_STATUS_STYLES = {
  "대기중": { background: "#F1F5F9", color: "#64748B" },
  "승인":   { background: "#D1FAE5", color: "#065F46" },
  "거절":   { background: "#FEE2E2", color: "#991B1B" },
};
// ── 색상 / 디자인 토큰 ──
const C = {
  primary: "#3B82F6",
  primaryDark: "#2563EB",
  danger: "#EF4444",
  dangerBg: "#FEF2F2",
  purple: "#8B5CF6",
  sidebar: "#0F172A",
  sidebarHover: "rgba(255,255,255,0.06)",
  sidebarActive: "rgba(59,130,246,0.15)",
  text: "#0F172A",
  textMuted: "#64748B",
  textLight: "#94A3B8",
  border: "#E2E8F0",
  bg: "#F1F5F9",
  card: "#fff",
};