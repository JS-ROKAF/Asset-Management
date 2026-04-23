import React, { useState, useEffect, useRef } from "react";
import { supabase } from "../supabase";

import {
  Btn,
  Modal,
  InputField,
  SelectField,
  Field,
  Pagination,
  PageHeader,
  SummaryCards,
  SearchFilter,
  StatusBadge,
  HistoryBadge
} from "../components/common";
import { 
  STATUS_OPTIONS,
  STATUS_COLORS,
  HISTORY_STYLES,
  HISTORY_TYPES,
  ROLES,
  DEPARTMENTS,
  C
  } from "../constants";
import { makeHistory } from "../utils/history";
import { displayDate, displayAge, toKST } from "../utils/date";
import { displayUser } from "../utils/user";
import useSort from "../hooks/useSort";
import { SortableTable } from "../components";

export default function HistoryPage({ history, setHistory, permission, userDept, assets }) {
  // 부서장/뷰어면 자기 부서 자산의 이력만
  const visibleHistory = permission === "admin"
    ? history
    : history.filter(h => assets.filter(a => a.department === userDept).some(a => a.id === h.assetId));
  const [filterType, setFilterType] = useState("전체");
  const [search, setSearch] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const PER_PAGE = 15;

  useEffect(() => { setCurrentPage(1); }, [search, filterType, dateFrom, dateTo]);

  const base = visibleHistory.filter(h => {
    const matchType = filterType === "전체" || h.type === filterType;
    const matchSearch = [h.assetName, h.assetId, h.from, h.to, h.note].some(v =>
      v?.toLowerCase().includes(search.toLowerCase())
    );
    // 날짜 범위 필터 — h.date는 'YYYY-MM-DD HH:mm:ss.mmm' 형식이므로 앞 10자리만 비교
    const hDate = h.date ? h.date.slice(0, 10) : "";
    const matchFrom = dateFrom ? hDate >= dateFrom : true;
    const matchTo = dateTo ? hDate <= dateTo : true;
    return matchType && matchSearch && matchFrom && matchTo;
  });

  const { sorted, sortKey, sortDir, handleSort } = useSort(base, "date");
  const totalFiltered = sorted.length;
  const filtered = sorted.slice((currentPage - 1) * PER_PAGE, currentPage * PER_PAGE);

  const HISTORY_HEADERS = [
    { label: "구분", key: "type" },
    { label: "자산번호", key: "assetId" },
    { label: "자산명", key: "assetName" },
    { label: "이전 사용자", key: "from" },
    { label: "변경 후 사용자", key: "to" },
    { label: "메모", key: "note" },
    { label: "날짜", key: "date" },
    ...(permission === "admin" ? [{ label: "", key: null }] : []),
  ];

  const hasDateFilter = dateFrom || dateTo;

  return (
    <main style={{ flex: 1, padding: "36px 40px", overflowY: "auto" }}>
      <PageHeader title="배정/반납 이력" subtitle="자산의 배정 및 반납 기록을 확인하세요" />
      <SummaryCards items={[
        { label: "전체 이력", value: visibleHistory.length, color: C.primary },
        { label: "배정", value: visibleHistory.filter(h => h.type === "배정").length, color: "#1D4ED8" },
        { label: "반납", value: visibleHistory.filter(h => h.type === "반납").length, color: "#92400E" },
        { label: "입고", value: visibleHistory.filter(h => h.type === "입고").length, color: "#065F46" },
        { label: "상태변경", value: visibleHistory.filter(h => h.type === "상태변경").length, color: "#6D28D9" },
        { label: "폐기", value: visibleHistory.filter(h => h.type === "폐기").length, color: "#991B1B" },
      ]} />

      {/* 구분 필터 + 검색 */}
      <SearchFilter value={search} onChange={setSearch}
        filters={HISTORY_TYPES} active={filterType} onFilter={setFilterType} />

      {/* 날짜 범위 필터 */}
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16, flexWrap: "wrap" }}>
        <span style={{ fontSize: 13, fontWeight: 600, color: C.textMuted }}>기간</span>
        <input
          type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)}
          style={{ border: `1px solid ${C.border}`, borderRadius: 8, padding: "8px 12px", fontSize: 13, color: C.text, outline: "none", background: C.card, cursor: "pointer" }}
          onFocus={e => e.target.style.borderColor = C.primary}
          onBlur={e => e.target.style.borderColor = C.border}
        />
        <span style={{ fontSize: 13, color: C.textMuted }}>~</span>
        <input
          type="date" value={dateTo} onChange={e => setDateTo(e.target.value)}
          style={{ border: `1px solid ${C.border}`, borderRadius: 8, padding: "8px 12px", fontSize: 13, color: C.text, outline: "none", background: C.card, cursor: "pointer" }}
          onFocus={e => e.target.style.borderColor = C.primary}
          onBlur={e => e.target.style.borderColor = C.border}
        />
        {hasDateFilter && (
          <button
            onClick={() => { setDateFrom(""); setDateTo(""); }}
            style={{ padding: "8px 14px", borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: "pointer", border: `1px solid ${C.border}`, background: C.card, color: C.danger }}>
            초기화
          </button>
        )}
        {hasDateFilter && (
          <span style={{ fontSize: 13, color: C.textMuted }}>
            {totalFiltered}건 검색됨
          </span>
        )}
      </div>

      <SortableTable
        headers={HISTORY_HEADERS}
        sortKey={sortKey} sortDir={sortDir} onSort={handleSort}
        rows={filtered.length > 0
          ? filtered.map((h, i) => (
            <tr key={h.id} style={{ borderBottom: i < filtered.length - 1 ? `1px solid ${C.bg}` : "none" }}
              onMouseEnter={e => e.currentTarget.style.background = "#F8FAFC"}
              onMouseLeave={e => e.currentTarget.style.background = "transparent"}>
              <td style={{ padding: "10px 12px" }}><HistoryBadge type={h.type} /></td>
              <td style={{ padding: "10px 12px", fontSize: 13, color: C.textMuted, whiteSpace: "nowrap" }}>{h.assetId}</td>
              <td style={{ padding: "10px 12px", fontSize: 14, color: C.text, fontWeight: 500 }}>{h.assetName}</td>
              <td style={{ padding: "10px 12px", fontSize: 14, color: C.textMuted }}>{displayUser(h.from)}</td>
              <td style={{ padding: "10px 12px", fontSize: 14, color: C.text, fontWeight: 500 }}>{displayUser(h.to)}</td>
              <td style={{ padding: "10px 12px", fontSize: 13, color: C.textLight }}>{h.note || "-"}</td>
              <td style={{ padding: "10px 12px", fontSize: 13, color: C.textLight }}>{displayDate(h.date)}</td>
              {permission === "admin" && (
                <td style={{ padding: "10px 12px" }}>
                  <button onClick={async () => {
                    if (!window.confirm("이 이력을 삭제할까요?")) return;
                    const { error } = await supabase.from("history").delete().eq("id", h.id);
                    if (error) { alert("삭제 실패: " + error.message); return; }
                    setHistory(history.filter(item => item.id !== h.id));
                  }}
                    style={{ background: C.dangerBg, color: C.danger, border: "none", padding: "4px 10px", borderRadius: 6, fontSize: 12, fontWeight: 600, cursor: "pointer" }}>
                    삭제
                  </button>
                </td>
              )}
            </tr>
          ))
          : [<tr key="empty"><td colSpan={permission === "admin" ? 8 : 7} style={{ padding: "40px", textAlign: "center", fontSize: 14, color: "#CBD5E1" }}>이력이 없습니다</td></tr>]
        }
      />
      <Pagination total={totalFiltered} page={currentPage} perPage={PER_PAGE} onChange={setCurrentPage} />
    </main>
  );
}