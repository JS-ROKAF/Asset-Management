export {
  ASSET_STATUS, STATUS_OPTIONS, STATUS_COLORS, STATUS_STYLES,
  HISTORY_TYPES, HISTORY_STYLES, ROLES, PERMISSION_LABELS,
  REQUEST_STYLES, REQUEST_STATUS_STYLES, C
};

// 부서·법인·유형은 기준정보(DB 마스터)에서 온다. 여기 하드코딩하지 않는다

// 상태는 이 객체 하나가 기준. 라벨·차트색·배지색을 한곳에서 관리
const ASSET_STATUS = {
  "사용중": { color: "#10B981", badge: { background: "#D1FAE5", color: "#065F46" } },
  "공용":   { color: "#3B82F6", badge: { background: "#DBEAFE", color: "#1D4ED8" } },
  "보관":   { color: "#94A3B8", badge: { background: "#F1F5F9", color: "#64748B" } },
  "수리중": { color: "#EF4444", badge: { background: "#FEE2E2", color: "#991B1B" } },
  "분실":   { color: "#F97316", badge: { background: "#FFF7ED", color: "#C2410C" } },
  "미확인": { color: "#A855F7", badge: { background: "#F3E8FF", color: "#7E22CE" } },
};
const STATUS_OPTIONS = Object.keys(ASSET_STATUS);
const STATUS_COLORS = Object.fromEntries(STATUS_OPTIONS.map(s => [s, ASSET_STATUS[s].color]));
const STATUS_STYLES = Object.fromEntries(STATUS_OPTIONS.map(s => [s, ASSET_STATUS[s].badge]));

const HISTORY_TYPES = ["전체", "입고", "배정", "반납", "이동", "상태변경", "수리", "실사정정", "폐기"];
const HISTORY_STYLES = {
  "배정":    { background: "#DBEAFE", color: "#1D4ED8" },
  "반납":    { background: "#FEF3C7", color: "#92400E" },
  "입고":    { background: "#D1FAE5", color: "#065F46" },
  "이동":    { background: "#E0F2FE", color: "#0369A1" },
  "상태변경": { background: "#F3F0FF", color: "#6D28D9" },
  "수리":    { background: "#FFE4E6", color: "#BE123C" },
  "실사정정": { background: "#FEF9C3", color: "#854D0E" },
  "폐기":    { background: "#FEE2E2", color: "#991B1B" },
};
const ROLES = [
  "인턴", "사원", "주임", "대리", "과장", "차장", "부장",
  "연구원", "주임연구원", "선임연구원", "책임연구원", "수석연구원",
  "원장", "소장", "본부장", "전무", "부사장", "대표"
];
const PERMISSION_LABELS = {
  "": "없음 (로그인 불가)",
  viewer: "viewer — 자기 부서 조회·요청",
  manager: "manager — 자기 부서 관리",
  admin: "admin — 전체 관리",
};
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
