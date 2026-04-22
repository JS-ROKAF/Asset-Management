import * as XLSX from "xlsx";
import { saveAs } from "file-saver";

const STATUS_KO = { "사용중": "사용중", "미사용": "미사용", "수리중": "수리중" };

// 셀 스타일 헬퍼
const headerStyle = (color = "1E40AF") => ({
  font: { bold: true, color: { rgb: "FFFFFF" }, sz: 11 },
  fill: { fgColor: { rgb: color } },
  alignment: { horizontal: "center", vertical: "center" },
  border: {
    top: { style: "thin", color: { rgb: "CCCCCC" } },
    bottom: { style: "thin", color: { rgb: "CCCCCC" } },
    left: { style: "thin", color: { rgb: "CCCCCC" } },
    right: { style: "thin", color: { rgb: "CCCCCC" } },
  }
});

const cellStyle = (bg = "FFFFFF") => ({
  fill: { fgColor: { rgb: bg } },
  alignment: { vertical: "center" },
  border: {
    top: { style: "thin", color: { rgb: "E2E8F0" } },
    bottom: { style: "thin", color: { rgb: "E2E8F0" } },
    left: { style: "thin", color: { rgb: "E2E8F0" } },
    right: { style: "thin", color: { rgb: "E2E8F0" } },
  }
});

const titleStyle = {
  font: { bold: true, sz: 14, color: { rgb: "0F172A" } },
  alignment: { horizontal: "left", vertical: "center" },
};

const summaryLabelStyle = {
  font: { bold: true, sz: 11, color: { rgb: "475569" } },
  fill: { fgColor: { rgb: "F1F5F9" } },
  alignment: { horizontal: "center", vertical: "center" },
  border: { top: { style: "thin", color: { rgb: "E2E8F0" } }, bottom: { style: "thin", color: { rgb: "E2E8F0" } }, left: { style: "thin", color: { rgb: "E2E8F0" } }, right: { style: "thin", color: { rgb: "E2E8F0" } } }
};

const summaryValueStyle = (color = "1E40AF") => ({
  font: { bold: true, sz: 16, color: { rgb: color } },
  fill: { fgColor: { rgb: "FFFFFF" } },
  alignment: { horizontal: "center", vertical: "center" },
  border: { top: { style: "thin", color: { rgb: "E2E8F0" } }, bottom: { style: "thin", color: { rgb: "E2E8F0" } }, left: { style: "thin", color: { rgb: "E2E8F0" } }, right: { style: "thin", color: { rgb: "E2E8F0" } } }
});

function setCell(ws, addr, value, style) {
  ws[addr] = { v: value, t: typeof value === "number" ? "n" : "s", s: style };
}

function applyColWidths(ws, widths) {
  ws["!cols"] = widths.map(w => ({ wch: w }));
}

// ── 시트 1: 자산 현황 ──
function buildAssetSheet(assets) {
  const ws = {};
  const statusColor = { "사용중": "D1FAE5", "미사용": "F1F5F9", "수리중": "FEE2E2" };
  const statusTextColor = { "사용중": "065F46", "미사용": "475569", "수리중": "991B1B" };

  // 제목
  setCell(ws, "A1", "📦 자산 현황 리포트", titleStyle);
  setCell(ws, "A2", `출력일: ${new Date().toLocaleDateString("ko-KR")}`, { font: { sz: 10, color: { rgb: "94A3B8" } } });

  // 요약 통계
  setCell(ws, "A4", "전체 자산", summaryLabelStyle);
  setCell(ws, "B4", "사용중", summaryLabelStyle);
  setCell(ws, "C4", "미사용", summaryLabelStyle);
  setCell(ws, "D4", "수리중", summaryLabelStyle);
  setCell(ws, "E4", "분실", summaryLabelStyle);
  setCell(ws, "A5", assets.length, summaryValueStyle("1E40AF"));
  setCell(ws, "B5", assets.filter(a => a.status === "사용중").length, summaryValueStyle("065F46"));
  setCell(ws, "C5", assets.filter(a => a.status === "미사용").length, summaryValueStyle("475569"));
  setCell(ws, "D5", assets.filter(a => a.status === "수리중").length, summaryValueStyle("991B1B"));
  setCell(ws, "E5", assets.filter(a => a.status === "분실").length, summaryValueStyle("C2410C"));

  // 헤더
  const headers = ["자산번호", "자산명", "유형", "상태", "모델명", "시리얼넘버", "사용자", "사용부서", "위치", "취득일자", "취득금액", "구입처", "보증만료일", "등록일"];
  const cols = ["A", "B", "C", "D", "E", "F", "G", "H", "I", "J", "K", "L", "M", "N"];
  const headerColors = cols.map(() => "1E3A8A");
  headers.forEach((h, i) => setCell(ws, `${cols[i]}7`, h, headerStyle(headerColors[i])));

  // 데이터
  assets.forEach((a, i) => {
    const row = i + 8;
    const bg = i % 2 === 0 ? "FFFFFF" : "F8FAFC";
    const sBg = statusColor[a.status] || "FFFFFF";
    const sColor = statusTextColor[a.status] || "000000";
    setCell(ws, `A${row}`, a.id, cellStyle(bg));
    setCell(ws, `B${row}`, a.name, cellStyle(bg));
    setCell(ws, `C${row}`, a.type || "기타", cellStyle(bg));
    ws[`D${row}`] = { v: a.status, t: "s", s: { ...cellStyle(sBg), font: { bold: true, color: { rgb: sColor } }, alignment: { horizontal: "center", vertical: "center" } } };
    setCell(ws, `E${row}`, a.model || "-", cellStyle(bg));
    setCell(ws, `F${row}`, a.serial || "-", cellStyle(bg));
    setCell(ws, `G${row}`, a.user === "-" ? "미배정" : a.user, cellStyle(bg));
    setCell(ws, `H${row}`, a.department || "-", cellStyle(bg));
    setCell(ws, `I${row}`, a.location, cellStyle(bg));
    setCell(ws, `J${row}`, a.purchaseDate && a.purchaseDate !== "-" ? a.purchaseDate.slice(0, 10) : "-", cellStyle(bg));
    setCell(ws, `K${row}`, a.purchaseCost && a.purchaseCost !== "-" ? Number(a.purchaseCost) : 0, { ...cellStyle(bg), alignment: { horizontal: "right" } });
    setCell(ws, `L${row}`, a.vendor || "-", cellStyle(bg));
    setCell(ws, `M${row}`, a.warrantyExpiry && a.warrantyExpiry !== "-" ? a.warrantyExpiry.slice(0, 10) : "-", cellStyle(bg));
    setCell(ws, `N${row}`, a.date ? a.date.slice(0, 10) : "-", cellStyle(bg));
  });

  ws["!ref"] = `A1:N${assets.length + 8}`;
  ws["!merges"] = [
  { s: { r: 0, c: 0 }, e: { r: 0, c: 13 } },
  { s: { r: 1, c: 0 }, e: { r: 1, c: 13 } },
  ];
  ws["!rows"] = [{ hpt: 28 }, { hpt: 18 }, {}, { hpt: 22 }, { hpt: 32 }];
  applyColWidths(ws, [12, 24, 10, 10, 18, 16, 12, 12, 12, 12, 12, 14, 12, 14]);
  return ws;
}

// ── 시트 2: 구성원 현황 ──
function buildMemberSheet(members, assets) {
  const ws = {};
  const deptColors = {
    "개발팀": "1E3A8A", "디자인팀": "5B21B6", "마케팅팀": "065F46",
    "HR팀": "92400E", "경영지원팀": "991B1B"
  };
  const deptBg = {
    "개발팀": "DBEAFE", "디자인팀": "EDE9FE", "마케팅팀": "D1FAE5",
    "HR팀": "FEF3C7", "경영지원팀": "FEE2E2"
  };

  setCell(ws, "A1", "👥 구성원 현황 리포트", titleStyle);
  setCell(ws, "A2", `출력일: ${new Date().toLocaleDateString("ko-KR")}`, { font: { sz: 10, color: { rgb: "94A3B8" } } });

  // 요약
  const depts = [...new Set(members.map(m => m.department))];
  setCell(ws, "A4", "전체 구성원", summaryLabelStyle);
  depts.slice(0, 4).forEach((d, i) => setCell(ws, `${["B","C","D","E"][i]}4`, d, summaryLabelStyle));
  setCell(ws, "A5", members.length, summaryValueStyle("1E40AF"));
  depts.slice(0, 4).forEach((d, i) => {
    setCell(ws, `${["B","C","D","E"][i]}5`, members.filter(m => m.department === d).length, summaryValueStyle("5B21B6"));
  });

  // 헤더
  const headers = ["사번", "이름", "부서", "이메일", "역할", "배정 자산 수", "배정 자산 목록"];
  ["A","B","C","D","E","F","G"].forEach((c, i) => setCell(ws, `${c}7`, headers[i], headerStyle("1E3A8A")));

  // 부서별 그룹핑
  let row = 8;
  const sortedMembers = [...members].sort((a, b) => a.department.localeCompare(b.department));
  let lastDept = "";

  sortedMembers.forEach((m, i) => {
    if (m.department !== lastDept) {
      // 부서 구분 행
      const color = deptColors[m.department] || "1E3A8A";
      const bg = deptBg[m.department] || "F1F5F9";
      ["A","B","C","D","E","F","G"].forEach(c => {
        ws[`${c}${row}`] = { v: c === "A" ? `▶ ${m.department}` : "", t: "s", s: { fill: { fgColor: { rgb: bg } }, font: { bold: true, color: { rgb: color }, sz: 11 }, border: cellStyle().border } };
      });
      row++;
      lastDept = m.department;
    }
    const bg = i % 2 === 0 ? "FFFFFF" : "F8FAFC";
    const myAssets = assets.filter(a => a.user === m.name);
    setCell(ws, `A${row}`, m.id, cellStyle(bg));
    setCell(ws, `B${row}`, m.name, cellStyle(bg));
    setCell(ws, `C${row}`, m.department, cellStyle(bg));
    setCell(ws, `D${row}`, m.email, cellStyle(bg));
    setCell(ws, `E${row}`, m.role, cellStyle(bg));
    setCell(ws, `F${row}`, myAssets.length, { ...cellStyle(bg), alignment: { horizontal: "center" } });
    setCell(ws, `G${row}`, myAssets.map(a => a.name).join(", ") || "-", cellStyle(bg));
    row++;
  });

  ws["!ref"] = `A1:G${row}`;
  ws["!merges"] = [
    { s: { r: 0, c: 0 }, e: { r: 0, c: 6 } },
    { s: { r: 1, c: 0 }, e: { r: 1, c: 6 } },
  ];
  applyColWidths(ws, [10, 12, 12, 26, 10, 12, 36]);
  return ws;
}

// ── 시트 3: 배정/반납 이력 ──
function buildHistorySheet(history) {
  const ws = {};

  setCell(ws, "A1", "📋 배정/반납 이력 리포트", titleStyle);
  setCell(ws, "A2", `출력일: ${new Date().toLocaleDateString("ko-KR")}`, { font: { sz: 10, color: { rgb: "94A3B8" } } });

  setCell(ws, "A4", "전체 이력", summaryLabelStyle);
  setCell(ws, "B4", "배정", summaryLabelStyle);
  setCell(ws, "C4", "반납", summaryLabelStyle);
  setCell(ws, "A5", history.length, summaryValueStyle("1E40AF"));
  setCell(ws, "B5", history.filter(h => h.type === "배정").length, summaryValueStyle("1D4ED8"));
  setCell(ws, "C5", history.filter(h => h.type === "반납").length, summaryValueStyle("92400E"));

  const headers = ["구분", "자산번호", "자산명", "이전 사용자", "변경 후 사용자", "메모", "날짜"];
  ["A","B","C","D","E","F","G"].forEach((c, i) => setCell(ws, `${c}7`, headers[i], headerStyle("1E3A8A")));

  const sorted = [...history].sort((a, b) => b.date.localeCompare(a.date));
  sorted.forEach((h, i) => {
    const row = i + 8;
    const bg = i % 2 === 0 ? "FFFFFF" : "F8FAFC";
    const typeBg = h.type === "배정" ? "DBEAFE" : "FEF3C7";
    const typeColor = h.type === "배정" ? "1D4ED8" : "92400E";
    ws[`A${row}`] = { v: h.type, t: "s", s: { fill: { fgColor: { rgb: typeBg } }, font: { bold: true, color: { rgb: typeColor } }, alignment: { horizontal: "center", vertical: "center" }, border: cellStyle().border } };
    setCell(ws, `B${row}`, h.assetId, cellStyle(bg));
    setCell(ws, `C${row}`, h.assetName, cellStyle(bg));
    setCell(ws, `D${row}`, h.from, cellStyle(bg));
    setCell(ws, `E${row}`, h.to, cellStyle(bg));
    setCell(ws, `F${row}`, h.note || "-", cellStyle(bg));
    setCell(ws, `G${row}`, h.date, cellStyle(bg));
  });

  ws["!ref"] = `A1:G${history.length + 8}`;
  ws["!merges"] = [
    { s: { r: 0, c: 0 }, e: { r: 0, c: 6 } },
    { s: { r: 1, c: 0 }, e: { r: 1, c: 6 } },
  ];
  applyColWidths(ws, [8, 12, 22, 14, 14, 24, 14]);
  return ws;
}

// ── 시트 4: 요약 리포트 (추천 기능) ──
function buildSummarySheet(assets, members) {
  const ws = {};

  setCell(ws, "A1", "📊 종합 요약 리포트", titleStyle);
  setCell(ws, "A2", `출력일: ${new Date().toLocaleDateString("ko-KR")}`, { font: { sz: 10, color: { rgb: "94A3B8" } } });

  // 부서별 자산 현황
  setCell(ws, "A4", "▶ 부서별 자산 보유 현황", { font: { bold: true, sz: 12, color: { rgb: "1E3A8A" } } });
  ["A","B","C","D"].forEach((c, i) => setCell(ws, `${c}5`, ["부서", "구성원 수", "보유 자산 수", "1인당 자산"][i], headerStyle("1E3A8A")));

  const depts = [...new Set(members.map(m => m.department))];
  depts.forEach((d, i) => {
    const row = i + 6;
    const bg = i % 2 === 0 ? "FFFFFF" : "F8FAFC";
    const memberCount = members.filter(m => m.department === d).length;
    const deptMembers = members.filter(m => m.department === d).map(m => m.name);
    const assetCount = assets.filter(a => deptMembers.includes(a.user)).length;
    setCell(ws, `A${row}`, d, cellStyle(bg));
    setCell(ws, `B${row}`, memberCount, { ...cellStyle(bg), alignment: { horizontal: "center" } });
    setCell(ws, `C${row}`, assetCount, { ...cellStyle(bg), alignment: { horizontal: "center" } });
    setCell(ws, `D${row}`, memberCount > 0 ? (assetCount / memberCount).toFixed(1) : "0", { ...cellStyle(bg), alignment: { horizontal: "center" } });
  });

  // 위치별 자산 분포
  const locationRow = depts.length + 8;
  setCell(ws, `A${locationRow}`, "▶ 위치별 자산 분포", { font: { bold: true, sz: 12, color: { rgb: "1E3A8A" } } });
  ["A","B","C"].forEach((c, i) => setCell(ws, `${c}${locationRow + 1}`, ["위치", "자산 수", "비율"][i], headerStyle("5B21B6")));
  const locations = [...new Set(assets.map(a => a.location))];
  locations.forEach((loc, i) => {
    const row = locationRow + 2 + i;
    const bg = i % 2 === 0 ? "FFFFFF" : "F8FAFC";
    const count = assets.filter(a => a.location === loc).length;
    setCell(ws, `A${row}`, loc, cellStyle(bg));
    setCell(ws, `B${row}`, count, { ...cellStyle(bg), alignment: { horizontal: "center" } });
    setCell(ws, `C${row}`, `${((count / assets.length) * 100).toFixed(1)}%`, { ...cellStyle(bg), alignment: { horizontal: "center" } });
  });

  // 수리중 자산 목록
  const repairRow = locationRow + locations.length + 4;
  setCell(ws, `A${repairRow}`, "▶ 수리중 자산 목록", { font: { bold: true, sz: 12, color: { rgb: "991B1B" } } });
  ["A","B","C","D"].forEach((c, i) => setCell(ws, `${c}${repairRow + 1}`, ["자산번호", "자산명", "담당자", "등록일"][i], headerStyle("991B1B")));
  const repairing = assets.filter(a => a.status === "수리중");
  if (repairing.length === 0) {
    setCell(ws, `A${repairRow + 2}`, "수리중인 자산이 없습니다", { font: { color: { rgb: "94A3B8" } }, alignment: { horizontal: "center" } });
  } else {
    repairing.forEach((a, i) => {
      const row = repairRow + 2 + i;
      const bg = i % 2 === 0 ? "FFF7F7" : "FFFFFF";
      setCell(ws, `A${row}`, a.id, cellStyle(bg));
      setCell(ws, `B${row}`, a.name, cellStyle(bg));
      setCell(ws, `C${row}`, a.user, cellStyle(bg));
      setCell(ws, `D${row}`, a.date, cellStyle(bg));
    });
  }

  // 미배정 자산 목록
  const unassignedRow = repairRow + repairing.length + 4;
  setCell(ws, `A${unassignedRow}`, "▶ 미배정 자산 목록", { font: { bold: true, sz: 12, color: { rgb: "92400E" } } });
  ["A","B","C"].forEach((c, i) => setCell(ws, `${c}${unassignedRow + 1}`, ["자산번호", "자산명", "위치"][i], headerStyle("92400E")));
  const unassigned = assets.filter(a => a.user === "-");
  if (unassigned.length === 0) {
    setCell(ws, `A${unassignedRow + 2}`, "미배정 자산이 없습니다", { font: { color: { rgb: "94A3B8" } } });
  } else {
    unassigned.forEach((a, i) => {
      const row = unassignedRow + 2 + i;
      const bg = i % 2 === 0 ? "FFFBEB" : "FFFFFF";
      setCell(ws, `A${row}`, a.id, cellStyle(bg));
      setCell(ws, `B${row}`, a.name, cellStyle(bg));
      setCell(ws, `C${row}`, a.location, cellStyle(bg));
    });
  }

  ws["!ref"] = `A1:D${unassignedRow + unassigned.length + 3}`;
  ws["!merges"] = [
    { s: { r: 0, c: 0 }, e: { r: 0, c: 3 } },
    { s: { r: 1, c: 0 }, e: { r: 1, c: 3 } },
  ];
  applyColWidths(ws, [18, 14, 14, 14]);
  return ws;
}

// ── 메인 export 함수 ──
export function exportToExcel(assets, members, history) {
  const wb = XLSX.utils.book_new();

  wb.Props = {
    Title: "AssetHub 자산관리 리포트",
    Author: "AssetHub",
    CreatedDate: new Date(),
  };

  XLSX.utils.book_append_sheet(wb, buildAssetSheet(assets), "📦 자산 현황");
  XLSX.utils.book_append_sheet(wb, buildMemberSheet(members, assets), "👥 구성원 현황");
  XLSX.utils.book_append_sheet(wb, buildHistorySheet(history), "📋 배정·반납 이력");
  XLSX.utils.book_append_sheet(wb, buildSummarySheet(assets, members), "📊 종합 요약");

  const buf = XLSX.write(wb, { bookType: "xlsx", type: "array", cellStyles: true });
  const date = new Date().toISOString().slice(0, 10);
  saveAs(new Blob([buf], { type: "application/octet-stream" }), `AssetHub_리포트_${date}.xlsx`);
}