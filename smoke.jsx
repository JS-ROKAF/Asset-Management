// 렌더 스모크 — `npm run smoke`. 컴포넌트가 return을 빠뜨려도 빌드는 통과하므로 이걸로 잡는다.
import assert from "node:assert";
import { renderToStaticMarkup } from "react-dom/server";
import SummaryCards from "./src/components/common/SummaryCards.jsx";
import { StatusBadge, HistoryBadge, RequestBadge, RequestStatusBadge } from "./src/components/common/Badge.jsx";
import { enrich } from "./src/utils/enrich.js";
import Dashboard from "./src/pages/Dashboard.jsx";
import AssetPage from "./src/pages/AssetPage.jsx";
import MemberPage from "./src/pages/MemberPage.jsx";
import HistoryPage from "./src/pages/HistoryPage.jsx";
import RequestPage from "./src/pages/RequestPage.jsx";
import MasterPage from "./src/pages/MasterPage.jsx";
import * as XLSX from "xlsx";
import { assetTemplate, memberTemplate } from "./src/utils/templates.js";

const cards = renderToStaticMarkup(
  <SummaryCards items={[{ label: "전체 자산", value: 42, color: "#3B82F6" }]} />
);
assert.match(cards, /전체 자산/, "SummaryCards가 label을 렌더하지 않음");
assert.match(cards, /42/, "SummaryCards가 value를 렌더하지 않음");

const cases = [
  [<StatusBadge status="사용중" />, "사용중"],
  [<HistoryBadge type="배정" />, "배정"],
  [<RequestBadge type="배정요청" />, "배정요청"],
  [<RequestStatusBadge status="대기중" />, "대기중"],
  [<StatusBadge status="없는상태" />, "없는상태"], // fallback 스타일로 죽지 않아야 함
];
for (const [el, expected] of cases) {
  const html = renderToStaticMarkup(el);
  assert.match(html, new RegExp(expected), `배지 렌더 실패: ${expected}`);
  assert.match(html, /background/, `배지 스타일 미적용: ${expected}`);
}

// 페이지 렌더: bootstrap 응답 모양(FK id) → enrich → 각 페이지
const data = enrich({
  corporations: [{ id: 1, code: "DR", name: "두래", active: 1 }],
  departments: [{ id: 1, corporationId: 1, name: "경영지원", active: 1 }],
  assetTypes: [{ id: 1, code: "NB", name: "노트북", hasSpecs: 1, active: 1 }],
  members: [{ id: 1, employeeNo: "1001", name: "홍길동", departmentId: 1, position: "대리", permission: "admin", status: "재직", email: null }],
  assets: [
    { id: "DR-NB-0001", typeId: 1, corporationId: 1, departmentId: 1, memberId: 1, status: "사용중", name: "업무용", warrantyExpiry: "2020-01-01", purchaseDate: "2018-09", purchaseCost: 1000000, createdAt: "2026-11-01T09:00:00.000000", updatedAt: "x", isDisposed: 0 },
    { id: "DR-NB-0002", typeId: 1, corporationId: 1, departmentId: null, memberId: null, status: "미확인", createdAt: "2026-11-01T09:00:00.000000", updatedAt: "x", isDisposed: 0 },
  ],
  history: [{ id: 1, assetId: "DR-NB-0001", type: "배정", fromMemberId: null, toMemberId: 1, detail: null, note: "지급", eventDate: "2023-03-02", recordedAt: "2026-11-01T09:00:00", recordedBy: 1 }],
  requests: [{ id: 1, type: "반납요청", assetId: "DR-NB-0001", requesterId: 1, targetMemberId: null, status: "대기중", note: "반납", date: "2026-11-02" }],
});
assert.equal(data.assets[0].user, "홍길동");
assert.equal(data.history[0].to, "홍길동");
const props = { ...data, permission: "admin", userDept: 1, currentUser: data.members[0], save: async () => null, onNavigate: () => {}, onFocusCleared: () => {} };
const pages = [
  [Dashboard, /미확인/], [AssetPage, /DR-NB-0002/], [MemberPage, /홍길동/],
  [HistoryPage, /지급/], [RequestPage, /반납요청/], [MasterPage, /두래/],
];
for (const [Page, expected] of pages) {
  const html = renderToStaticMarkup(<Page {...props} />);
  assert.match(html, expected, `${Page.name} 렌더 결과에 ${expected} 없음`);
}

// 양식 왕복: 내려받은 양식을 그대로 읽으면 머리글 + 예시 1행만 나와야 함 (텍스트 서식 빈 칸이 행으로 섞이면 안 됨)
const wb = XLSX.read(XLSX.write(memberTemplate(data), { type: "array", bookType: "xlsx" }), { type: "array" });
assert.deepEqual(wb.SheetNames, ["구성원목록", "코드표"]);
const back = XLSX.utils.sheet_to_json(wb.Sheets["구성원목록"], { defval: "", raw: false }).filter(r => Object.values(r).some(v => v !== ""));
assert.equal(back.length, 1);
assert.match(back[0]["사번"], /^예시/);
assert.equal(back[0]["부서"], "경영지원");
const awb = XLSX.read(XLSX.write(assetTemplate(data), { type: "array", bookType: "xlsx" }), { type: "array" });
const aback = XLSX.utils.sheet_to_json(awb.Sheets["자산목록"], { defval: "", raw: true }).filter(r => Object.values(r).some(v => v !== ""));
assert.equal(aback.length, 1);
assert.equal(aback[0]["취득일자"], "2018-09");   // 텍스트 서식 — 날짜로 바뀌지 않음
assert.equal(aback[0]["부서"], "DR | 경영지원");

console.log("OK — SummaryCards + 배지 4종 + 페이지 6개 렌더 + 구성원·자산 양식 왕복 정상");
