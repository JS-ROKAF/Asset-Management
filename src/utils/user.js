export { displayUser };

// 사용자 표시용 헬퍼 — "-"를 "미배정"으로 변환
const displayUser = (user) => (!user || user === "-") ? "미배정" : user;