import * as XLSX from "xlsx";

// 입력 시트: 머리글 + 예시 1행. 입력 칸 전체를 텍스트 서식(@)으로 — 사번 앞자리 0, 날짜가 엑셀 일련번호로 바뀌는 것 방지
const inputSheet = (headers, example, rows = 500) => {
  const ws = XLSX.utils.aoa_to_sheet([headers, example]);
  for (let r = 1; r <= rows; r++) {
    headers.forEach((_, c) => {
      const ref = XLSX.utils.encode_cell({ r, c });
      ws[ref] = { ...(ws[ref] || { t: "s", v: "" }), z: "@" };
    });
  }
  ws["!ref"] = XLSX.utils.encode_range({ s: { r: 0, c: 0 }, e: { r: rows, c: headers.length - 1 } });
  ws["!cols"] = headers.map(h => ({ wch: Math.max(10, h.length * 2 + 2) }));
  return ws;
};

// 코드표 시트: 열마다 허용값 목록 (다운로드 시점의 기준정보로 생성)
const codeSheet = (columns) => {
  const height = Math.max(...columns.map(([, values]) => values.length));
  const aoa = [columns.map(([title]) => title)];
  for (let i = 0; i < height; i++) aoa.push(columns.map(([, values]) => values[i] ?? ""));
  const ws = XLSX.utils.aoa_to_sheet(aoa);
  ws["!cols"] = columns.map(() => ({ wch: 24 }));
  return ws;
};

export function memberTemplate({ corporations, departments }) {
  const wb = XLSX.utils.book_new();
  const dept = departments.find(d => d.active);
  XLSX.utils.book_append_sheet(wb, inputSheet(
    ["사번", "이름", "법인코드", "부서", "직급", "이메일", "재직상태"],
    ["20230001", "홍길동", dept?.corporation ?? "DR", dept?.name ?? "부서명", "대리", "", "재직"],
  ), "구성원목록");
  XLSX.utils.book_append_sheet(wb, codeSheet([
    ["법인코드", corporations.filter(c => c.active).map(c => `${c.code} (${c.name})`)],
    ["법인코드 | 부서", departments.filter(d => d.active).map(d => `${d.corporation} | ${d.name}`)],
    ["재직상태", ["재직", "퇴직"]],
  ]), "코드표");
  return wb;
}
