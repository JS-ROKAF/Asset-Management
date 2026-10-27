// 2026-10-27 이관 변환 (일회성): 기준정보 초안 + 대장대조 + 설문 → 구성원·자산 가져오기 행 (JSON + 양식 xlsx)
// 입력(dataDir): 기준정보_초안_261027.xlsx, IT자산_대장대조_261027.xlsx, survey.xlsx(= 자산조사_261023.xlsx)
// 사용: node scripts/migrate_convert_261027.cjs <repo> <dataDir> <outDir>
// 실데이터(입력·출력)는 저장소 밖 폴더에 둘 것. 규칙은 docs/운영전환_설계안_v2.1.md 5장
// 출력 이관_변환결과.xlsx는 시트 2개 — 화면 가져오기는 첫 시트만 읽으므로 시트별 파일로 나눠 올릴 것
const [repo, dataDir, outDir] = process.argv.slice(2);
const XLSX = require(repo + "/node_modules/xlsx");
const fs = require("fs");
const path = require("path");

const book = (f) => XLSX.readFile(path.join(dataDir, f));
const sheetRows = (wb, name, header = 3) =>
  XLSX.utils.sheet_to_json(wb.Sheets[name], { header: 1, defval: "", raw: true }).slice(header + 1)
    .filter(r => /^\d+$/.test(String(r[0]).trim()));
const t = (v) => (v === null || v === undefined ? "" : String(v).trim());

// ── 기준정보: 부서·구성원 (설계안 v2.1 5장 결정) ──
const master = book("기준정보_초안_261027.xlsx");
const DEPT_FIX = { CIST: "CIST&GIST", GIST: "CIST&GIST" };
const PART_FIX = { "생산PART": "생산파트" };
const EXCLUDED_DEPT = "중국상해법인";
const members = sheetRows(master, "구성원")
  .filter(r => t(r[2]) !== EXCLUDED_DEPT)
  .map(r => ({
    이름: t(r[1]), 부서: DEPT_FIX[t(r[2])] || t(r[2]), 파트: PART_FIX[t(r[3])] || t(r[3]),
    직위: t(r[4]), 이메일: "", 재직상태: t(r[6]) || "재직",
  }));
const memberByName = new Map(members.map(m => [m.이름, m]));

const DEPTS = new Set(["경영", "경영전략기획실", "식품사업부", "전략SCM사업부", "CIST&GIST", "기술연구소",
  "제주바이오센터", "음성LH센터", "생산공정센터", "두래USA"]);
const deptRename = new Map();
// 부서명 변경표는 머리글이 4행, 데이터는 No 없이 시작하므로 따로 읽는다
XLSX.utils.sheet_to_json(master.Sheets["부서명 변경"], { header: 1, defval: "" }).slice(4)
  .forEach(([from, to]) => { if (t(from)) deptRename.set(t(from), t(to)); });
// 결정 2: 대장 원본 5개는 모두 본사 대장 → 경영지원사업부는 경영전략기획실 (변경표 그대로)
const mapDept = (name) => {
  const n = t(name);
  if (!n) return "";
  const m = DEPT_FIX[n] || deptRename.get(n) || n;
  return DEPTS.has(m) ? m : null;   // null = 대응 없음
};

// ── 설문 원본 (설문 행 번호로 연결) ──
const survey = XLSX.utils.sheet_to_json(book("survey.xlsx").Sheets.Sheet1, { header: 1, defval: "", raw: true });
const BLOCK = {   // 0-based 열
  MN: { brand: 1, model: 2, mfg: 3, buy: 4, price: 5, vendor: 6, approval: 7, corp: 8, legacy: 9 },
  PC: { brand: 10, model: 11, mfg: 12, buy: 13, issue: 14, price: 15, vendor: 16, approval: 17, corp: 18, legacy: 19 },
  NB: { brand: 21, model: 22, serial: 23, mfg: 24, buy: 25, issue: 26, price: 27, vendor: 28, approval: 29, corp: 30, legacy: 31 },
};
const surveyCell = (line, type, key) => {
  const row = survey[Number(line) - 1];
  const col = BLOCK[type]?.[key];
  return row && col !== undefined ? row[col] : "";
};
const surveyDept = (line) => t(survey[Number(line) - 1]?.[20]);

// ── 공통 변환 ──
const TYPE = { "데스크톱": "PC", "모니터": "MN", "노트북": "NB", "전화기": "PH", "TV 모니터": "TV", "복합기": "PR", "파쇄기": "ET" };
const CORP_NAME = { "두래": "DR", "티앤씨": "TC", "두래티앤씨": "TC", "셀럭스": "CX" };
const corpFromLegacy = (no) => /^DT/.test(no) ? "TC" : /^D/.test(no) ? "DR" : /^C[NO]-/.test(no) ? "CX" : "";
const legacyOk = (no) => /^[A-Z]{2,3}-[A-Z]-\d+$/.test(no);

// 제조년월: 날짜까지 있으면 월로 자른다 (제조년월은 YYYY-MM만 저장)
const toMonth = (v) => {
  if (typeof v === "number") { const d = XLSX.SSF.parse_date_code(v); return `${d.y}-${String(d.m).padStart(2, "0")}`; }
  const m = t(v).replace(/\.$/, "").match(/^(\d{4})[./-](\d{1,2})(?:[./-]\d{1,2})?$/);
  return m ? `${m[1]}-${m[2].padStart(2, "0")}` : t(v);
};
// 지급일: 날짜까지 있을 때만 칸에 넣고, 월만 있으면 비고로
const splitIssue = (v) => {
  if (typeof v === "number") return [v, ""];
  const s = t(v);
  return /^\d{4}[./-]\d{1,2}[./-]\d{1,2}\.?$/.test(s) ? [s, ""] : ["", s ? `지급 ${s}` : ""];
};
const first = (...vs) => vs.find(v => t(v) !== "") ?? "";

const assets = [];
const add = (src, f) => {
  const note = [src, ...f.notes].filter(Boolean).join(" / ");
  delete f.notes;
  assets.push({ ...f, 비고: note });
};

const userOf = (name) => {
  const m = memberByName.get(t(name));
  return m ? { user: m.이름, dept: m.부서 } : null;
};

const fromSurvey = (sheet, r, cols) => {
  const type = TYPE[t(r[2])];
  const line = r[cols.line];
  const notes = [];
  const u = userOf(r[1]);
  if (!u) notes.push(`설문 사용자: ${t(r[1])}`);
  const legacy = t(cols.legacy !== undefined ? r[cols.legacy] : "") || t(surveyCell(line, type, "legacy"));
  const legacyNo = legacyOk(legacy) ? legacy : "";
  if (legacy && !legacyNo && legacy !== "(번호 없음)") notes.push(`구번호 원문: ${legacy}`);
  let corp = corpFromLegacy(legacyNo) || CORP_NAME[t(surveyCell(line, type, "corp"))] || "";
  if (!corp) { corp = "DR"; notes.push("법인 확인 필요"); }
  const [issue, issueNote] = splitIssue(surveyCell(line, type, "issue"));
  if (issueNote && u) notes.push(issueNote);
  let dept = u ? u.dept : mapDept(surveyDept(line));
  if (dept === null) { notes.push(`설문 부서: ${surveyDept(line)}`); dept = ""; }
  const brand = t(r[3]) || t(surveyCell(line, type, "brand"));
  return {
    type, legacyNo, corp, dept, notes, u,
    fields: {
      자산명: [brand, t(r[2])].filter(Boolean).join(" "),
      모델명: t(r[4]) || t(surveyCell(line, type, "model")),
      시리얼: t(surveyCell(line, type, "serial")),
      제조년월: toMonth(cols.mfg !== undefined ? first(r[cols.mfg], surveyCell(line, type, "mfg")) : surveyCell(line, type, "mfg")),
      취득일자: cols.buy !== undefined ? first(r[cols.buy], surveyCell(line, type, "buy")) : surveyCell(line, type, "buy"),
      취득금액: cols.price !== undefined ? first(r[cols.price], surveyCell(line, type, "price")) : surveyCell(line, type, "price"),
      구입처: t(cols.vendor !== undefined ? first(r[cols.vendor], surveyCell(line, type, "vendor")) : surveyCell(line, type, "vendor")),
      구매품의번호: t(surveyCell(line, type, "approval")),
      지급일: u ? issue : "",
    },
  };
};

const push = (src, x) => add(src, {
  자산번호: "", 구자산번호: x.legacyNo, 법인코드: x.corp, 대분류코드: "IT", 유형코드: x.type, ...x.fields,
  부서: x.dept, 상태: x.u ? "사용중" : "미확인", "사용자(이름)": x.u ? x.u.user : "", notes: x.notes,
});

const cmp = book("IT자산_대장대조_261027.xlsx");
for (const r of sheetRows(cmp, "① 일치")) {
  const x = fromSurvey("①", r, { line: 13, legacy: 6, buy: 9, price: 8, vendor: 10 });
  if (t(r[12])) x.notes.push(`대조 비고: ${t(r[12])}`);
  push(`이관 ①일치(${t(r[5])})`, x);
}
for (const r of sheetRows(cmp, "② 확인필요")) {
  const x = fromSurvey("②", r, { line: 12, legacy: 5, buy: 9, price: 8 });
  x.notes.push(`번호 확인 필요: 대장 후보 ${t(r[6])} (${t(r[10])}) ${t(r[11])}`.trim());
  push("이관 ②확인필요", x);
}
for (const r of sheetRows(cmp, "③ 미매칭")) {
  const x = fromSurvey("③", r, { line: 10, legacy: 5, mfg: 6, buy: 7, price: 8 });
  if (t(r[9])) x.notes.push(`대조 비고: ${t(r[9])}`);
  push("이관 ③미매칭(신규)", x);
}
// ④⑤: 대장에만 있음 / 조사범위 외 — 설문으로 확인 안 됨 → 미확인 (실사에서 정정)
for (const [sheet, src] of [["④ 대장에만 있음", "이관 ④대장에만 있음(설문 미확인)"], ["⑤ 조사범위 외", "이관 ⑤조사범위 외"]]) {
  for (const r of sheetRows(cmp, sheet)) {
    const notes = [];
    const legacy = t(r[1]);
    const legacyNo = legacyOk(legacy) ? legacy : "";
    if (legacy && !legacyNo) notes.push(`구번호 원문: ${legacy}`);
    let corp = corpFromLegacy(legacyNo);
    if (!corp) { corp = "DR"; notes.push("법인 확인 필요"); }
    let dept = mapDept(r[4]);
    if (dept === null) { notes.push(`대장 부서: ${t(r[4])}`); dept = ""; }
    if (t(r[5])) notes.push(`대장상 사용자: ${t(r[5])}`);
    if (t(r[6])) notes.push(`대장 상태: ${t(r[6])}`);
    if (t(r[10])) notes.push(`대장 비고: ${t(r[10])}`);
    add(src, {
      자산번호: "", 구자산번호: legacyNo, 법인코드: corp, 대분류코드: "IT", 유형코드: TYPE[t(r[2])] || "", 자산명: [t(r[3]), t(r[2])].filter(Boolean).join(" "),
      모델명: "", 시리얼: "", 제조년월: "", 취득일자: r[8], 취득금액: r[7], 구입처: t(r[9]), 구매품의번호: "",
      부서: dept, 상태: "미확인", "사용자(이름)": "", 지급일: "", notes,
    });
  }
}

fs.writeFileSync(path.join(outDir, "rows.json"), JSON.stringify({ members, assets }));
const ASSET_COLS = ["자산번호", "구자산번호", "법인코드", "대분류코드", "유형코드", "자산명", "모델명", "시리얼", "제조년월", "CPU", "RAM", "저장장치", "OS",
  "취득일자", "취득금액", "구입처", "구매품의번호", "보증만료일", "부서", "위치", "상태", "사용자(이름)", "지급일", "비고"];
const wb = XLSX.utils.book_new();
XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(members, { header: ["이름", "부서", "파트", "직위", "이메일", "재직상태"] }), "구성원목록");
XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(assets, { header: ASSET_COLS }), "자산목록");
XLSX.writeFile(wb, path.join(outDir, "이관_변환결과.xlsx"));
const count = (k) => assets.reduce((m, a) => ({ ...m, [a[k]]: (m[a[k]] || 0) + 1 }), {});
console.log("members", members.length, "assets", assets.length);
console.log("상태", JSON.stringify(count("상태")), "법인", JSON.stringify(count("법인코드")), "유형", JSON.stringify(count("유형코드")));
console.log("부서", JSON.stringify(count("부서")));
console.log("법인 확인 필요", assets.filter(a => a.비고.includes("법인 확인 필요")).length,
  "구번호 있음", assets.filter(a => a.구자산번호).length);
