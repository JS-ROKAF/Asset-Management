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

export function assetTemplate({ corporations, departments, assetTypes }) {
  const wb = XLSX.utils.book_new();
  const corp = corporations.find(c => c.active)?.code ?? "DR";
  const dept = departments.find(d => d.active && d.corporation === corp);
  XLSX.utils.book_append_sheet(wb, inputSheet(
    ["자산번호", "구자산번호", "법인코드", "유형코드", "자산명", "모델명", "시리얼", "제조년월",
      "CPU", "RAM", "저장장치", "OS", "취득일자", "취득금액", "구입처", "구매품의번호",
      "보증만료일", "부서", "위치", "상태", "사용자(사번)", "지급일", "비고"],
    ["예시(이 행은 지우세요)", "IT-2018-001", corp, "NB", "업무용 노트북", "LG gram 16", "SN12345", "2018-08",
      "i5-8250U", "16GB", "SSD 512GB", "Windows 11", "2018-09", "1,250,000", "LG전자", "",
      "2021-09-30", dept ? `${dept.corporation} | ${dept.name}` : "", "본사 3층", "사용중", "20230001", "2023-03-02", ""],
  ), "자산목록");
  XLSX.utils.book_append_sheet(wb, codeSheet([
    ["법인코드", corporations.filter(c => c.active).map(c => `${c.code} (${c.name})`)],
    ["유형코드", assetTypes.filter(t => t.active).map(t => `${t.code} (${t.name}${t.hasSpecs ? ", 사양 입력" : ""})`)],
    ["부서 (법인코드 | 부서)", departments.filter(d => d.active).map(d => `${d.corporation} | ${d.name}`)],
    ["상태", ["사용중 (사용자 필수)", "공용", "보관", "수리중", "분실", "미확인 (사용자 모름)"]],
    ["작성 규칙", [
      "자산번호: 비우면 자동 발급 ({법인}-{유형}-0000)",
      "사용자(사번): 사용중일 때만, 구성원 먼저 등록",
      "지급일: 사용자가 있을 때만 (배정 이력 날짜)",
      "날짜: YYYY-MM-DD, 취득일자·제조년월은 YYYY-MM도 가능",
      "시리얼: 없으면 비우거나 -",
      "목록에 없는 사용자는 미확인/보관 + 비고에 이름",
    ]],
  ]), "코드표");
  return wb;
}

export function memberTemplate({ corporations, departments }) {
  const wb = XLSX.utils.book_new();
  const dept = departments.find(d => d.active);
  XLSX.utils.book_append_sheet(wb, inputSheet(
    ["사번", "이름", "법인코드", "부서", "직급", "이메일", "재직상태"],
    ["예시(이 행은 지우세요)", "홍길동", dept?.corporation ?? "DR", dept?.name ?? "부서명", "대리", "", "재직"],
  ), "구성원목록");
  XLSX.utils.book_append_sheet(wb, codeSheet([
    ["법인코드", corporations.filter(c => c.active).map(c => `${c.code} (${c.name})`)],
    ["법인코드 | 부서", departments.filter(d => d.active).map(d => `${d.corporation} | ${d.name}`)],
    ["재직상태", ["재직", "퇴직"]],
  ]), "코드표");
  return wb;
}
