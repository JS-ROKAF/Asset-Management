// 렌더 스모크 — `npm run smoke`. 컴포넌트가 return을 빠뜨려도 빌드는 통과하므로 이걸로 잡는다.
import assert from "node:assert";
import { renderToStaticMarkup } from "react-dom/server";
import SummaryCards from "./src/components/common/SummaryCards.jsx";
import { StatusBadge, HistoryBadge, RequestBadge, RequestStatusBadge } from "./src/components/common/Badge.jsx";

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

console.log("OK — SummaryCards + 배지 4종 렌더 정상");
