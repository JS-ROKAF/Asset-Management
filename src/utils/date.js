export { displayDate, displayAge, toKST };

// 날짜 표시 헬퍼 — 레거시(연월일) + 신규(연월일 시분초) 모두 처리
const displayDate = (dateStr) => {
  if (!dateStr) return "-";
  // 이미 시분초가 있으면 그대로 반환
  if (dateStr.length >= 16) return dateStr.slice(0, 16); // 'YYYY-MM-DD HH:mm'
  return dateStr; // 'YYYY-MM-DD' 형식 레거시 그대로
};

const displayAge = (dateStr) => {
  if (!dateStr || dateStr === "-") return "-";
  const start = new Date(dateStr.slice(0, 10));
  const today = new Date();
  const diffMs = today - start;
  if (isNaN(diffMs) || diffMs < 0) return "-";
  const days = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  if (days < 30) return `${days}일`;
  if (days < 365) return `${Math.floor(days / 30)}개월`;
  const years = Math.floor(days / 365);
  const months = Math.floor((days % 365) / 30);
  return months > 0 ? `${years}년 ${months}개월` : `${years}년`;
};

const toKST = () => {
  return new Date().toLocaleString("sv-SE", {
    timeZone: "Asia/Seoul",
    hour12: false
  });
};
