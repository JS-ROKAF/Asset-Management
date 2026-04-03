import React, { useState, useEffect } from "react";
import {
  PieChart, Pie, Cell, Tooltip,
  BarChart, Bar, XAxis, YAxis, ResponsiveContainer
} from "recharts";
import { supabase } from "./supabase";
import { exportToExcel } from "./exportExcel";

const DEPARTMENTS = ["개발팀", "디자인팀", "마케팅팀", "HR팀", "경영지원팀"];
const STATUS_OPTIONS = ["사용중", "미사용", "수리중", "분실"];
const STATUS_COLORS = { "사용중": "#10B981", "미사용": "#94A3B8", "수리중": "#EF4444", "분실": "#F97316" };
const HISTORY_TYPES = ["전체", "배정", "반납", "입고", "상태변경", "폐기"];
const HISTORY_STYLES = {
  "배정":    { background: "#DBEAFE", color: "#1D4ED8" },
  "반납":    { background: "#FEF3C7", color: "#92400E" },
  "입고":    { background: "#D1FAE5", color: "#065F46" },
  "상태변경": { background: "#F3F0FF", color: "#6D28D9" },
  "폐기":    { background: "#FEE2E2", color: "#991B1B" },
};
const ASSET_TYPES = ["노트북", "스마트폰", "태블릿", "모니터", "키보드/마우스", "헤드셋", "기타"];
const ROLES = [
  "인턴", "사원", "주임", "대리", "과장", "차장", "부장",
  "연구원", "주임연구원", "선임연구원", "책임연구원", "수석연구원",
  "원장", "소장", "본부장", "전무", "부사장", "대표"
];
// 사용자 표시용 헬퍼 — "-"를 "미배정"으로 변환
const displayUser = (user) => (!user || user === "-") ? "미배정" : user;


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

// ── 사이드바 아이콘 SVG ──
const Icon = ({ type, active }) => {
  const color = active ? "#3B82F6" : "#64748B";
  const icons = {
    dashboard: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/>
        <rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/>
      </svg>
    ),
    assets: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M20 7H4a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2z"/>
        <circle cx="12" cy="12" r="1"/>
      </svg>
    ),
    members: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
        <circle cx="9" cy="7" r="4"/>
        <path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>
      </svg>
    ),
    history: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="10"/>
        <polyline points="12 6 12 12 16 14"/>
      </svg>
    ),
  };
  return icons[type] || null;
};

// ── 공통 컴포넌트 ──
const StatusBadge = ({ status }) => {
  const style =
    status === "사용중" ? { background: "#D1FAE5", color: "#065F46" } :
    status === "미사용" ? { background: "#F1F5F9", color: "#64748B" } :
    status === "수리중" ? { background: "#FEE2E2", color: "#991B1B" } :
    status === "분실"   ? { background: "#FFF7ED", color: "#C2410C" } :
    { background: "#F1F5F9", color: "#64748B" };
  return <span style={{ ...style, padding: "3px 10px", borderRadius: 99, fontSize: 12, fontWeight: 600 }}>{status}</span>;
};

const HistoryBadge = ({ type }) => {
  const style = HISTORY_STYLES[type] || { background: "#F1F5F9", color: "#64748B" };
  return <span style={{ ...style, padding: "3px 10px", borderRadius: 99, fontSize: 12, fontWeight: 600 }}>{type}</span>;
};

const Field = ({ label, value }) => (
  <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
    <span style={{ fontSize: 11, color: C.textLight, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em" }}>{label}</span>
    <span style={{ fontSize: 14, color: C.text, fontWeight: 500 }}>{value}</span>
  </div>
);

const Modal = ({ title, onClose, children, wide }) => (
  <div style={{ position: "fixed", inset: 0, background: "rgba(15,23,42,0.45)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 50 }}>
    <div style={{ background: C.card, borderRadius: 16, padding: 32, width: wide ? 600 : 480, boxShadow: "0 24px 64px rgba(0,0,0,0.18)", maxHeight: "85vh", overflowY: "auto" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
        <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: C.text }}>{title}</h2>
        <button onClick={onClose} style={{ background: "#F1F5F9", border: "none", width: 32, height: 32, borderRadius: 8, fontSize: 16, color: C.textMuted, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>✕</button>
      </div>
      {children}
    </div>
  </div>
);

const InputField = ({ label, value, onChange, type = "text", placeholder = ""}) => (
  <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
    <label style={{ fontSize: 12, color: C.textMuted, fontWeight: 600 }}>{label}</label>
    <input type={type} value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder}
      style={{ border: `1px solid ${C.border}`, borderRadius: 8, padding: "10px 12px", fontSize: 14, color: C.text, outline: "none", transition: "border 0.15s" }}
      onFocus={e => e.target.style.borderColor = C.primary}
      onBlur={e => e.target.style.borderColor = C.border}
    />
  </div>
);

const SelectField = ({ label, value, onChange, options }) => (
  <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
    <label style={{ fontSize: 12, color: C.textMuted, fontWeight: 600 }}>{label}</label>
    <select value={value} onChange={e => onChange(e.target.value)}
      style={{ border: `1px solid ${C.border}`, borderRadius: 8, padding: "10px 12px", fontSize: 14, color: C.text, outline: "none", background: "#fff" }}>
      {options.map(o => <option key={o} value={o}>{o === "" ? "미지정" : o}</option>)}
    </select>
  </div>
);

const Btn = ({ onClick, children, variant = "primary", small }) => {
  const styles = {
    primary: { background: C.primary, color: "#fff", border: "none" },
    ghost:   { background: "#fff", color: C.textMuted, border: `1px solid ${C.border}` },
    danger:  { background: C.dangerBg, color: C.danger, border: "none" },
    purple:  { background: C.purple, color: "#fff", border: "none" },
  };
  return (
    <button onClick={onClick}
      style={{ ...styles[variant], padding: small ? "7px 14px" : "10px 20px", borderRadius: 8, fontSize: small ? 13 : 14, fontWeight: 600, cursor: "pointer", transition: "opacity 0.15s" }}
      onMouseEnter={e => e.currentTarget.style.opacity = "0.85"}
      onMouseLeave={e => e.currentTarget.style.opacity = "1"}
    >
      {children}
    </button>
  );
};

const PageHeader = ({ title, subtitle, action }) => (
  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 28 }}>
    <div>
      <h1 style={{ fontSize: 22, fontWeight: 700, color: C.text, margin: 0 }}>{title}</h1>
      <p style={{ fontSize: 13, color: C.textLight, marginTop: 4, marginBottom: 0 }}>{subtitle}</p>
    </div>
    {action}
  </div>
);

const SummaryCards = ({ items }) => (
  <div style={{ display: "grid", gridTemplateColumns: `repeat(${Math.min(items.length, 6)}, 1fr)`, gap: 12, marginBottom: 28 }}>
    {items.map(({ label, value, color }) => (
      <div key={label} style={{ background: C.card, borderRadius: 12, padding: "16px 20px", boxShadow: "0 1px 4px rgba(0,0,0,0.06)" }}>
        <p style={{ margin: 0, fontSize: 12, color: C.textLight, fontWeight: 500 }}>{label}</p>
        <p style={{ margin: "6px 0 0", fontSize: 24, fontWeight: 700, color }}>{value}</p>
      </div>
    ))}
  </div>
);

const SearchFilter = ({ value, onChange, filters, active, onFilter, activeColor = C.primary }) => (
  <div style={{ display: "flex", gap: 10, marginBottom: 16, flexWrap: "wrap" }}>
    <input placeholder="검색..." value={value} onChange={e => onChange(e.target.value)}
      style={{ flex: 1, minWidth: 180, border: `1px solid ${C.border}`, borderRadius: 8, padding: "9px 14px", fontSize: 14, outline: "none", background: C.card }}
      onFocus={e => e.target.style.borderColor = C.primary}
      onBlur={e => e.target.style.borderColor = C.border}
    />
    {filters.map(f => (
      <button key={f} onClick={() => onFilter(f)}
        style={{ padding: "9px 16px", borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: "pointer", border: `1px solid ${C.border}`, background: active === f ? activeColor : C.card, color: active === f ? "#fff" : C.textMuted, transition: "all 0.15s" }}>
        {f}
      </button>
    ))}
  </div>
);

// ── 정렬 가능한 테이블 ──
// [수정 6] 컬럼 클릭 정렬 기능 추가
const SortableTable = ({ headers, rows, data, sortKey, sortDir, onSort }) => (
  <div style={{ background: C.card, borderRadius: 12, boxShadow: "0 1px 4px rgba(0,0,0,0.06)", overflow: "auto" }}>
    <table style={{ width: "100%", borderCollapse: "collapse" }}>
      <thead>
        <tr style={{ background: "#F8FAFC", borderBottom: `1px solid ${C.border}` }}>
          {headers.map(({ label, key }) => (
            <th key={label} onClick={() => key && onSort(key)}
              style={{ padding: "12px 20px", textAlign: "left", fontSize: 12, fontWeight: 600, color: sortKey === key ? C.primary : C.textMuted, letterSpacing: "0.04em", cursor: key ? "pointer" : "default", userSelect: "none", whiteSpace: "nowrap" }}>
              {label}
              {key && <span style={{ marginLeft: 4, opacity: sortKey === key ? 1 : 0.3 }}>{sortKey === key ? (sortDir === "asc" ? "↑" : "↓") : "↕"}</span>}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>{rows}</tbody>
    </table>
  </div>
);

// ── 페이지네이션 ──
const Pagination = ({ total, page, perPage, onChange }) => {
  const totalPages = Math.ceil(total / perPage);
  if (totalPages <= 1) return null;

  return (
    <div style={{ display: "flex", justifyContent: "center", alignItems: "center", gap: 6, marginTop: 16 }}>
      <button onClick={() => onChange(1)} disabled={page === 1}
        style={{ padding: "6px 10px", borderRadius: 6, border: `1px solid ${C.border}`, background: C.card, color: page === 1 ? C.textLight : C.textMuted, cursor: page === 1 ? "default" : "pointer", fontSize: 13 }}>
        «
      </button>
      <button onClick={() => onChange(page - 1)} disabled={page === 1}
        style={{ padding: "6px 10px", borderRadius: 6, border: `1px solid ${C.border}`, background: C.card, color: page === 1 ? C.textLight : C.textMuted, cursor: page === 1 ? "default" : "pointer", fontSize: 13 }}>
        ‹
      </button>
      {Array.from({ length: totalPages }, (_, i) => i + 1)
        .filter(p => p === 1 || p === totalPages || Math.abs(p - page) <= 2)
        .reduce((acc, p, i, arr) => {
          if (i > 0 && p - arr[i - 1] > 1) acc.push("...");
          acc.push(p);
          return acc;
        }, [])
        .map((p, i) => p === "..." ? (
          <span key={`ellipsis-${i}`} style={{ padding: "6px 4px", color: C.textLight, fontSize: 13 }}>...</span>
        ) : (
          <button key={p} onClick={() => onChange(p)}
            style={{ padding: "6px 10px", borderRadius: 6, border: `1px solid ${p === page ? C.primary : C.border}`, background: p === page ? C.primary : C.card, color: p === page ? "#fff" : C.textMuted, cursor: "pointer", fontSize: 13, fontWeight: p === page ? 700 : 400 }}>
            {p}
          </button>
        ))
      }
      <button onClick={() => onChange(page + 1)} disabled={page === totalPages}
        style={{ padding: "6px 10px", borderRadius: 6, border: `1px solid ${C.border}`, background: C.card, color: page === totalPages ? C.textLight : C.textMuted, cursor: page === totalPages ? "default" : "pointer", fontSize: 13 }}>
        ›
      </button>
      <button onClick={() => onChange(totalPages)} disabled={page === totalPages}
        style={{ padding: "6px 10px", borderRadius: 6, border: `1px solid ${C.border}`, background: C.card, color: page === totalPages ? C.textLight : C.textMuted, cursor: page === totalPages ? "default" : "pointer", fontSize: 13 }}>
        »
      </button>
      <span style={{ fontSize: 13, color: C.textLight, marginLeft: 8 }}>
        총 {total}개 중 {Math.min((page - 1) * perPage + 1, total)}~{Math.min(page * perPage, total)}
      </span>
    </div>
  );
};

function useSort(data, defaultKey, defaultDir = "desc") {
  const [sortKey, setSortKey] = useState(defaultKey || "");
  const [sortDir, setSortDir] = useState(defaultDir); // "asc" → defaultDir로 변경

  const handleSort = (key) => {
    if (sortKey === key) setSortDir(d => d === "asc" ? "desc" : "asc");
    else { setSortKey(key); setSortDir("asc"); }
  };

  const sorted = [...data].sort((a, b) => {
    if (!sortKey) return 0;
    const va = a[sortKey] ?? "";
    const vb = b[sortKey] ?? "";
    const cmp = String(va).localeCompare(String(vb), "ko");
    if (cmp !== 0) return sortDir === "asc" ? cmp : -cmp;
    // 같은 값이면 id 기준 내림차순 (최근 생성 순)
    return String(b.id).localeCompare(String(a.id));
  });

  return { sorted, sortKey, sortDir, handleSort };
}

// 날짜 표시 헬퍼 — 레거시(연월일) + 신규(연월일 시분초) 모두 처리
const displayDate = (dateStr) => {
  if (!dateStr) return "-";
  // 이미 시분초가 있으면 그대로 반환
  if (dateStr.length >= 16) return dateStr.slice(0, 16); // 'YYYY-MM-DD HH:mm'
  return dateStr; // 'YYYY-MM-DD' 형식 레거시 그대로
};

const toKST = (offsetMs = 0) =>
  new Date(Date.now() + 9 * 60 * 60 * 1000 + offsetMs)
    .toISOString().replace('T', ' ').slice(0, 23); // 밀리초까지 포함

function makeHistory(type, asset, prevUser, nextUser, note, offsetMs = 0) {
  return {
    assetId: asset.id,
    assetName: asset.name,
    type,
    from: prevUser ?? "-",
    to: nextUser ?? "-",
    date: toKST(offsetMs),
    note: note || "",
  };
}

// ── 대시보드 ──
function Dashboard({ assets, members, history, permission, userDept }) {

  const filteredAssets = permission === "admin" ? assets : assets.filter(a => a.department === userDept);
  const filteredMembers = permission === "admin" ? members : members.filter(m => m.department === userDept);
  const filteredHistory = permission === "admin" ? history : history.filter(h =>
    filteredAssets.some(a => a.id === h.assetId)
  );

  const statusData = STATUS_OPTIONS.map(s => ({
    name: s, value: filteredAssets.filter(a => a.status === s).length
  }));

  const deptMemberMap = {};
  filteredMembers.forEach(m => {
    deptMemberMap[m.department] = (deptMemberMap[m.department] || 0) + 1;
  });
  const deptMemberData = Object.entries(deptMemberMap).map(([name, value]) => ({ name, value }));

  const deptAssetData = DEPARTMENTS.map(dept => ({
    name: dept,
    사용중: filteredAssets.filter(a => a.department === dept && a.status === "사용중").length,
    미사용: filteredAssets.filter(a => a.department === dept && a.status === "미사용").length,
    수리중: filteredAssets.filter(a => a.department === dept && a.status === "수리중").length,
  }));

  const recentHistory = filteredHistory
    .filter(h => ["배정", "반납", "입고"].includes(h.type))
    .slice(0, 10);

  return (
    <main style={{ flex: 1, padding: "36px 40px", overflowY: "auto" }}>
      <PageHeader title="대시보드" subtitle="전체 현황을 한눈에 확인하세요"
        action={
          <button
            onClick={() => exportToExcel(filteredAssets, filteredMembers, filteredHistory)}
            style={{ background: "#10B981", color: "#fff", border: "none", padding: "10px 20px", borderRadius: 8, fontSize: 14, fontWeight: 600, cursor: "pointer", display: "flex", alignItems: "center", gap: 6 }}
            onMouseEnter={e => e.currentTarget.style.opacity = "0.85"}
            onMouseLeave={e => e.currentTarget.style.opacity = "1"}
          >
            ⬇ 엑셀 내보내기
          </button>
        }
      />

      <SummaryCards items={[
        { label: "전체 자산", value: filteredAssets.length, color: C.primary },
        { label: "사용중", value: filteredAssets.filter(a => a.status === "사용중").length, color: "#10B981" },
        { label: "미사용", value: filteredAssets.filter(a => a.status === "미사용").length, color: C.textMuted },
        { label: "수리중", value: filteredAssets.filter(a => a.status === "수리중").length, color: C.danger },
        { label: "분실", value: filteredAssets.filter(a => a.status === "분실").length, color: "#F97316" },
        { label: "전체 구성원", value: filteredMembers.length, color: C.purple },
      ]} />

      {/* 3열 차트 */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 20, marginBottom: 20 }}>

        {/* 자산 상태별 파이차트 */}
        <div style={{ background: C.card, borderRadius: 12, padding: 24, boxShadow: "0 1px 4px rgba(0,0,0,0.06)" }}>
          <h3 style={{ margin: "0 0 20px", fontSize: 15, fontWeight: 700, color: C.text }}>자산 상태별 현황</h3>
          <ResponsiveContainer width="100%" height={200}>
            <PieChart>
              <Pie data={statusData} cx="50%" cy="50%" innerRadius={50} outerRadius={80} paddingAngle={3} dataKey="value">
                {statusData.map(entry => <Cell key={entry.name} fill={STATUS_COLORS[entry.name]} />)}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
          <div style={{ display: "flex", justifyContent: "center", gap: 16, marginTop: 8 }}>
            {statusData.map(({ name }) => (
              <div key={name} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: C.textMuted }}>
                <div style={{ width: 8, height: 8, borderRadius: "50%", background: STATUS_COLORS[name] }} />
                {name}
              </div>
            ))}
          </div>
        </div>

        {/* 부서별 자산 현황 스택 바차트 */}
        <div style={{ background: C.card, borderRadius: 12, padding: 24, boxShadow: "0 1px 4px rgba(0,0,0,0.06)" }}>
          <h3 style={{ margin: "0 0 20px", fontSize: 15, fontWeight: 700, color: C.text }}>부서별 자산 현황</h3>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={deptAssetData} barSize={20}>
              <XAxis dataKey="name" tick={{ fontSize: 10, fill: C.textLight }} axisLine={false} tickLine={false} />
              <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: C.textLight }} axisLine={false} tickLine={false} />
              <Tooltip cursor={{ fill: "#F1F5F9" }} />
              <Bar dataKey="사용중" stackId="a" fill="#10B981" radius={[0, 0, 0, 0]} name="사용중" />
              <Bar dataKey="미사용" stackId="a" fill="#94A3B8" name="미사용" />
              <Bar dataKey="수리중" stackId="a" fill="#EF4444" radius={[4, 4, 0, 0]} name="수리중" />
            </BarChart>
          </ResponsiveContainer>
          <div style={{ display: "flex", justifyContent: "center", gap: 16, marginTop: 8 }}>
            {[{ name: "사용중", color: "#10B981" }, { name: "미사용", color: "#94A3B8" }, { name: "수리중", color: "#EF4444" }].map(({ name, color }) => (
              <div key={name} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: C.textMuted }}>
                <div style={{ width: 8, height: 8, borderRadius: "50%", background: color }} />
                {name}
              </div>
            ))}
          </div>
        </div>

        {/* 부서별 구성원 현황 */}
        <div style={{ background: C.card, borderRadius: 12, padding: 24, boxShadow: "0 1px 4px rgba(0,0,0,0.06)" }}>
          <h3 style={{ margin: "0 0 20px", fontSize: 15, fontWeight: 700, color: C.text }}>부서별 구성원 현황</h3>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={deptMemberData} barSize={20}>
              <XAxis dataKey="name" tick={{ fontSize: 10, fill: C.textLight }} axisLine={false} tickLine={false} />
              <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: C.textLight }} axisLine={false} tickLine={false} />
              <Tooltip cursor={{ fill: "#F1F5F9" }} />
              <Bar dataKey="value" fill={C.purple} radius={[4, 4, 0, 0]} name="구성원 수" />
            </BarChart>
          </ResponsiveContainer>
        </div>

      </div>

      {/* 최근 배정/반납 이력 */}
      <div style={{ background: C.card, borderRadius: 12, padding: 24, boxShadow: "0 1px 4px rgba(0,0,0,0.06)" }}>
        <h3 style={{ margin: "0 0 16px", fontSize: 15, fontWeight: 700, color: C.text }}>최근 배정/반납 이력</h3>
        {recentHistory.length === 0
          ? <p style={{ margin: 0, fontSize: 13, color: C.textLight }}>이력 없음</p>
          : recentHistory.map(h => (
            <div key={h.id} style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 0", borderBottom: `1px solid ${C.bg}` }}>
              <HistoryBadge type={h.type} />
              <span style={{ fontSize: 14, color: C.text, fontWeight: 500, flex: 1 }}>{h.assetName}</span>
              <span style={{ fontSize: 13, color: C.textMuted }}>{displayUser(h.from)} → {displayUser(h.to)}</span>
              <span style={{ fontSize: 12, color: C.textLight }}>{displayDate(h.date)}</span>
            </div>
          ))
        }
      </div>
    </main>
  );
}

// ── 자산관리 ──
function AssetPage({ assets, setAssets, history, members, permission, userDept }) {
  // 부서장/뷰어면 자기 부서 자산만
  const visibleAssets = permission === "admin" ? assets : assets.filter(a => a.department === userDept);
  const [addOpen, setAddOpen] = useState(false);
  const [form, setForm] = useState({
    name: "", type: "기타", location: "", user: "",
    purchaseDate: "", purchaseCost: "", vendor: "",
    department: "", note: "", quantity: 1,
  });
  const [selected, setSelected] = useState(null);
  const [editMode, setEditMode] = useState(false);
  const [editForm, setEditForm] = useState({});
  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState("전체");
  const [filterDept, setFilterDept] = useState("전체");
  const [filterType, setFilterType] = useState("전체");
  const [currentPage, setCurrentPage] = useState(1);
  const PER_PAGE = 15;
  const memberNames = members.map(m => m.name);

  useEffect(() => { setCurrentPage(1); }, [search, filterStatus, filterDept, filterType]);

  const base = visibleAssets.filter(a => {
  const matchStatus = filterStatus === "전체" || a.status === filterStatus;
  const matchDept = filterDept === "전체" || a.department === filterDept;
  const matchType = filterType === "전체" || a.type === filterType;
  const matchSearch = [a.id, a.name, a.user, a.location, a.department, a.vendor, a.note]
    .some(v => v?.toLowerCase().includes(search.toLowerCase()));
  return matchStatus && matchDept && matchType && matchSearch;
  });
  const { sorted, sortKey, sortDir, handleSort } = useSort(base, "date");
  const totalFiltered = sorted.length;
  const filtered = sorted.slice((currentPage - 1) * PER_PAGE, currentPage * PER_PAGE);

  const addAsset = () => {
    if (!form.name || !form.location) return;
    const qty = Math.max(1, parseInt(form.quantity) || 1);
    const isAssigned = form.user && form.user !== "";
    if (isAssigned && !memberNames.includes(form.user)) {
      alert(`'${form.user}'은(는) 구성원 목록에 없는 사용자입니다.`);
      return;
    }
    // 수량이 2 이상인데 사용자를 지정하면 경고
    if (qty > 1 && isAssigned) {
      alert("수량이 2개 이상일 때는 사용자를 지정할 수 없습니다.\n등록 후 각 자산에 개별 배정해 주세요.");
      return;
    }

    const newAssets = [];
    const histories = [];

    for (let i = 0; i < qty; i++) {
      const newAsset = {
        id: "A" + Math.floor(Math.random() * 900000 + 100000),
        name: form.name,
        type: form.type || "기타",
        status: isAssigned ? "사용중" : "미사용",
        user: isAssigned ? form.user : "-",
        department: form.department || "-",
        location: form.location,
        purchaseDate: form.purchaseDate ? `${form.purchaseDate} ${toKST().slice(11, 19)}` : "-",
        purchaseCost: form.purchaseCost || "-",
        vendor: form.vendor || "-",
        note: form.note || "-",
        date: toKST(i), // 수량이 여러 개일 때 ms 차이로 순서 보장
      };
      newAssets.push(newAsset);
      histories.push(makeHistory("입고", newAsset, "-", "-", `신규 자산 시스템 입고${qty > 1 ? ` (${i + 1}/${qty})` : ""}`, i * 2));
      if (isAssigned) {
        histories.push(makeHistory("배정", newAsset, "-", form.user, "신규 등록 시 즉시 배정", i * 2 + 1));
      }
    }

    setAssets([...assets, ...newAssets], histories);
    setAddOpen(false);
    setForm({
      name: "", type: "기타", location: "", user: "",
      purchaseDate: "", purchaseCost: "", vendor: "",
      department: "", note: "", quantity: 1,
    });
  };

  const saveEdit = () => {
    const prev = assets.find(a => a.id === editForm.id);
    let updated = { ...editForm };
    const histories = [];

    const userChanged = prev.user !== updated.user;
    const statusChanged = prev.status !== updated.status;

    if (updated.user && updated.user !== "-" && updated.user !== "미배정" && !memberNames.includes(updated.user)) {
      alert(`'${updated.user}'은(는) 구성원 목록에 없는 사용자입니다.\n구성원 관리에서 먼저 등록해주세요.`);
      return;
    }

    if (updated.status === "미사용" && updated.user !== "-" && updated.user !== "미배정") {
      const prevUser = updated.user;
      updated.user = "-";
      histories.push(makeHistory("반납", updated, prevUser, "-", "미사용 처리로 인한 자동 반납"));
    } else if (updated.status === "수리중" && updated.user !== "-" && updated.user !== "미배정") {
      const prevUser = updated.user;
      updated.user = "-";
      histories.push(makeHistory("반납", updated, prevUser, "-", "수리 입고로 인한 자동 반납"));
    } else if (updated.status === "분실" && updated.user !== "-" && updated.user !== "미배정") {
      const prevUser = updated.user;
      updated.user = "-";
      histories.push(makeHistory("반납", updated, prevUser, "-", "분실 처리로 인한 자동 반납"));
    } else if (userChanged && updated.status !== "미사용" && updated.status !== "수리중") {
      if (prev.user === "-" && updated.user !== "-") {
        histories.push(makeHistory("배정", updated, "-", updated.user, `${updated.user}에게 배정`));
      } else if (prev.user !== "-" && updated.user === "-") {
        histories.push(makeHistory("반납", updated, prev.user, "-", "사용자 반납 처리"));
      } else if (prev.user !== "-" && updated.user !== "-") {
        histories.push(makeHistory("반납", updated, prev.user, "-", `${prev.user} → ${updated.user} 사용자 변경`, 0));
        histories.push(makeHistory("배정", updated, "-", updated.user, `${prev.user}에서 ${updated.user}으로 재배정`, 1));
      }
    } else if (statusChanged && !userChanged) {
      histories.push(makeHistory("상태변경", updated, updated.user, updated.user, `${prev.status} → ${updated.status}`));
    }

    setAssets(assets.map(a => a.id === updated.id ? updated : a), histories);
    setSelected(updated);
    setEditMode(false);
  };

  const deleteAsset = () => {
    if (!window.confirm(`'${selected.name}'을(를) 삭제할까요?`)) return;
    const histories = [];
    if (selected.user && selected.user !== "-") {
      histories.push(makeHistory("반납", selected, selected.user, "-", "자산 삭제로 인한 자동 반납", 0));
    }
    histories.push(makeHistory("폐기", selected, selected.user ?? "-", "-", "자산 삭제(폐기)", selected.user && selected.user !== "-" ? 1 : 0));
    setAssets(assets.filter(a => a.id !== selected.id), histories);
    setSelected(null);
  };

  const assetHistory = selected
    ? history.filter(h => h.assetId === selected.id).sort((a, b) => a.date.localeCompare(b.date))
    : [];

  const ASSET_HEADERS = [
    { label: "자산번호", key: "id" },
    { label: "자산명", key: "name" },
    { label: "유형", key: "type" },
    { label: "상태", key: "status" },
    { label: "위치", key: "location" },
    { label: "사용부서", key: "department" },
    { label: "사용자", key: "user" },
    { label: "취득일자", key: "purchaseDate" },
    { label: "취득금액", key: "purchaseCost" },
    { label: "구입처", key: "vendor" },
    { label: "비고", key: "note" },
    { label: "등록일", key: "date" },
  ];

  // 2단 필터 (상태 + 부서)
  const deptFilterRow = (
    <div style={{ display: "flex", gap: 10, marginBottom: 16, flexWrap: "wrap" }}>
      {["전체", ...DEPARTMENTS].map(d => (
        <button key={d} onClick={() => setFilterDept(d)}
          style={{ padding: "9px 16px", borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: "pointer",
            border: `1px solid ${C.border}`,
            background: filterDept === d ? C.purple : C.card,
            color: filterDept === d ? "#fff" : C.textMuted, transition: "all 0.15s" }}>
          {d}
        </button>
      ))}
    </div>
  );



  return (
    <main style={{ flex: 1, padding: "36px 40px", overflowY: "auto" }}>
      <PageHeader title="자산 관리" subtitle="등록된 IT 기기를 한눈에 확인하세요"
        action={permission !== "viewer" ? <Btn onClick={() => setAddOpen(true)}>+ 자산 등록</Btn> : null} />
      <SummaryCards items={[
        { label: "전체 자산", value: visibleAssets.length, color: C.primary },
        { label: "사용중", value: visibleAssets.filter(a => a.status === "사용중").length, color: "#10B981" },
        { label: "미사용", value: visibleAssets.filter(a => a.status === "미사용").length, color: C.textMuted },
        { label: "수리중", value: visibleAssets.filter(a => a.status === "수리중").length, color: C.danger },
        { label: "분실", value: visibleAssets.filter(a => a.status === "분실").length, color: "#F97316" },
        { label: "전체 구성원", value: members.length, color: C.purple },
      ]} />

      {/* 상태 필터 */}
      <SearchFilter value={search} onChange={setSearch}
      filters={["전체", "사용중", "미사용", "수리중", "분실"]} active={filterStatus} onFilter={setFilterStatus} />
      {/* 부서 필터 */}
      {deptFilterRow}
      <div style={{ display: "flex", gap: 10, marginBottom: 16, flexWrap: "wrap" }}>
        {["전체", ...ASSET_TYPES].map(t => (
          <button key={t} onClick={() => setFilterType(t)}
            style={{ padding: "9px 16px", borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: "pointer",
              border: `1px solid ${C.border}`,
              background: filterType === t ? C.primary : C.card,
              color: filterType === t ? "#fff" : C.textMuted, transition: "all 0.15s" }}>
            {t}
          </button>
        ))}
      </div>

      <SortableTable
        headers={ASSET_HEADERS}
        sortKey={sortKey} sortDir={sortDir} onSort={handleSort}
        rows={filtered.map((a, i) => (
          <tr key={a.id} onClick={() => { setSelected(a); setEditMode(false); }}
            style={{ borderBottom: i < filtered.length - 1 ? `1px solid ${C.bg}` : "none", cursor: "pointer" }}
            onMouseEnter={e => e.currentTarget.style.background = "#F8FAFC"}
            onMouseLeave={e => e.currentTarget.style.background = "transparent"}>
            <td style={{ padding: "14px 20px", fontSize: 13, color: C.textMuted, whiteSpace: "nowrap" }}>{a.id}</td>
            <td style={{ padding: "14px 20px", fontSize: 14, color: C.text, fontWeight: 500, whiteSpace: "nowrap" }}>{a.name}</td>
            <td style={{ padding: "14px 20px", fontSize: 14, color: C.textMuted, whiteSpace: "nowrap" }}>{a.type || "기타"}</td>
            <td style={{ padding: "14px 20px", whiteSpace: "nowrap" }}><StatusBadge status={a.status} /></td>
            <td style={{ padding: "14px 20px", fontSize: 14, color: C.text, whiteSpace: "nowrap" }}>{a.location}</td>
            <td style={{ padding: "14px 20px", fontSize: 14, color: C.text, whiteSpace: "nowrap" }}>{a.department || "-"}</td>
            <td style={{ padding: "14px 20px", fontSize: 14, color: a.user === "-" ? C.textLight : C.text, whiteSpace: "nowrap" }}>{displayUser(a.user)}</td>
            <td style={{ padding: "14px 20px", fontSize: 14, color: C.text, whiteSpace: "nowrap" }}>{a.purchaseDate && a.purchaseDate !== "-" ? displayDate(a.purchaseDate) : "-"}</td>
            <td style={{ padding: "14px 20px", fontSize: 14, color: C.text, whiteSpace: "nowrap" }}>{a.purchaseCost ? `${Number(a.purchaseCost).toLocaleString()}원` : "-"}</td>
            <td style={{ padding: "14px 20px", fontSize: 14, color: C.text, whiteSpace: "nowrap" }}>{a.vendor || "-"}</td>
            <td style={{ padding: "14px 20px", fontSize: 13, color: C.textLight, whiteSpace: "nowrap", maxWidth: 200, overflow: "auto", textOverflow: "ellipsis" }}>{a.note || "-"}</td>
            <td style={{ padding: "14px 20px", fontSize: 13, color: C.textLight, whiteSpace: "nowrap" }}>{displayDate(a.date)}</td>
          </tr>
        ))}
      />
      <Pagination total={totalFiltered} page={currentPage} perPage={PER_PAGE} onChange={setCurrentPage} />

      {/* 자산 등록 모달 */}
      {addOpen && (
        <Modal title="자산 등록" onClose={() => setAddOpen(false)} wide>
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            {/* 1행: 자산명 + 유형 */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <InputField label="자산명 *" value={form.name} onChange={v => setForm({ ...form, name: v })} />
              <SelectField label="유형" value={form.type} onChange={v => setForm({ ...form, type: v })} options={ASSET_TYPES} />
            </div>
            {/* 2행: 수량 + 위치 */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                <label style={{ fontSize: 12, color: C.textMuted, fontWeight: 600 }}>수량</label>
                <input type="number" min="1" max="100" value={form.quantity}
                  onChange={e => setForm({ ...form, quantity: Math.max(1, parseInt(e.target.value) || 1) })}
                  style={{ border: `1px solid ${C.border}`, borderRadius: 8, padding: "10px 12px", fontSize: 14, color: C.text, outline: "none" }}
                  onFocus={e => e.target.style.borderColor = C.primary}
                  onBlur={e => e.target.style.borderColor = C.border}
                />
              </div>
              <InputField label="위치 *" value={form.location} onChange={v => setForm({ ...form, location: v })} />
            </div>
            {/* 3행: 취득일자 + 취득금액 */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <InputField label="취득일자" value={form.purchaseDate} type="date" onChange={v => setForm({ ...form, purchaseDate: v })} />
              <InputField label="취득금액 (원)" value={form.purchaseCost} type="number" onChange={v => setForm({ ...form, purchaseCost: v })} />
            </div>
            {/* 4행: 구입처 + 사용부서 */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <InputField label="구입처" value={form.vendor} onChange={v => setForm({ ...form, vendor: v })} />
              <SelectField label="사용부서" value={form.department || ""} onChange={v => setForm({ ...form, department: v })}
                options={["", ...DEPARTMENTS]} />
            </div>
            {/* 5행: 사용자 (수량 1일 때만 활성) */}
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              <label style={{ fontSize: 12, color: C.textMuted, fontWeight: 600 }}>
                사용자 {form.quantity > 1 && <span style={{ color: C.textLight, fontWeight: 400 }}>(수량 2개 이상 시 등록 후 개별 배정)</span>}
              </label>
              <select value={form.user} onChange={e => setForm({ ...form, user: e.target.value })}
                disabled={form.quantity > 1}
                style={{ border: `1px solid ${C.border}`, borderRadius: 8, padding: "10px 12px", fontSize: 14,
                  color: form.quantity > 1 ? C.textLight : C.text, outline: "none",
                  background: form.quantity > 1 ? C.bg : "#fff", cursor: form.quantity > 1 ? "not-allowed" : "pointer" }}>
                <option value="">미배정</option>
                {members.map(m => <option key={m.id} value={m.name}>{m.name} ({m.department})</option>)}
              </select>
            </div>
            {/* 6행: 비고 */}
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              <label style={{ fontSize: 12, color: C.textMuted, fontWeight: 600 }}>비고</label>
              <textarea value={form.note} onChange={e => setForm({ ...form, note: e.target.value })}
                rows={2} style={{ border: `1px solid ${C.border}`, borderRadius: 8, padding: "10px 12px",
                  fontSize: 14, color: C.text, outline: "none", resize: "vertical", fontFamily: "inherit" }}
                onFocus={e => e.target.style.borderColor = C.primary}
                onBlur={e => e.target.style.borderColor = C.border}
              />
            </div>
            {form.quantity > 1 && (
              <div style={{ background: "#EFF6FF", borderRadius: 8, padding: "10px 14px", fontSize: 13, color: "#1D4ED8" }}>
                ℹ️ {form.quantity}개의 자산이 개별 자산번호로 일괄 등록됩니다.
              </div>
            )}
            <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 8 }}>
              <Btn variant="ghost" onClick={() => setAddOpen(false)}>취소</Btn>
              <Btn onClick={addAsset}>등록</Btn>
            </div>
          </div>
        </Modal>
      )}

      {/* 자산 상세 / 수정 모달 */}
      {selected && (
        <Modal title={editMode ? "자산 수정" : "자산 상세"} onClose={() => setSelected(null)} wide>
          {editMode ? (
            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <InputField label="자산명" value={editForm.name} onChange={v => setEditForm({ ...editForm, name: v })} />
                <SelectField label="유형" value={editForm.type || "기타"} onChange={v => setEditForm({ ...editForm, type: v })} options={ASSET_TYPES} />
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <InputField label="위치" value={editForm.location} onChange={v => setEditForm({ ...editForm, location: v })} />
                <SelectField label="사용부서" value={editForm.department || ""} onChange={v => setEditForm({ ...editForm, department: v })} options={["", ...DEPARTMENTS]} />
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <InputField label="취득일자" value={editForm.purchaseDate || ""} type="date" onChange={v => setEditForm({ ...editForm, purchaseDate: v })} />
                <InputField label="취득금액 (원)" value={editForm.purchaseCost || ""} type="number" onChange={v => setEditForm({ ...editForm, purchaseCost: v })} />
              </div>
              <InputField label="구입처" value={editForm.vendor || ""} onChange={v => setEditForm({ ...editForm, vendor: v })} />
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                <label style={{ fontSize: 12, color: C.textMuted, fontWeight: 600 }}>사용자</label>
                <select value={editForm.user === "-" ? "" : editForm.user}
                  onChange={e => setEditForm({ ...editForm, user: e.target.value || "-" })}
                  style={{ border: `1px solid ${C.border}`, borderRadius: 8, padding: "10px 12px", fontSize: 14, color: C.text, outline: "none", background: "#fff" }}>
                  <option value="">미배정 (-)</option>
                  {members.map(m => <option key={m.id} value={m.name}>{m.name} ({m.department})</option>)}
                </select>
              </div>
              <SelectField label="상태" value={editForm.status} onChange={v => setEditForm({ ...editForm, status: v })} options={STATUS_OPTIONS} />
              {(editForm.status === "미사용" || editForm.status === "수리중" || editForm.status === "분실") && editForm.user !== "-" && (
                <div style={{ background: "#FEF3C7", borderRadius: 8, padding: "10px 14px", fontSize: 13, color: "#92400E" }}>
                  ⚠️ 상태를 '{editForm.status}'으로 변경하면 사용자가 자동으로 초기화됩니다.
                </div>
              )}
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                <label style={{ fontSize: 12, color: C.textMuted, fontWeight: 600 }}>비고</label>
                <textarea value={editForm.note || ""} onChange={e => setEditForm({ ...editForm, note: e.target.value })}
                  rows={2} style={{ border: `1px solid ${C.border}`, borderRadius: 8, padding: "10px 12px",
                    fontSize: 14, color: C.text, outline: "none", resize: "vertical", fontFamily: "inherit" }}
                  onFocus={e => e.target.style.borderColor = C.primary}
                  onBlur={e => e.target.style.borderColor = C.border}
                />
              </div>
              <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 8 }}>
                <Btn variant="ghost" onClick={() => setEditMode(false)}>취소</Btn>
                <Btn onClick={saveEdit}>저장</Btn>
              </div>
            </div>
          ) : (
            <div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 20 }}>
                {[
                  { label: "자산번호", value: selected.id },
                  { label: "유형", value: selected.type || "기타" },
                  { label: "자산명", value: selected.name },
                  { label: "상태", value: <StatusBadge status={selected.status} /> },
                  { label: "사용부서", value: selected.department || "-" },
                  { label: "사용자", value: displayUser(selected.user) },
                  { label: "위치", value: selected.location },
                  { label: "취득일자", value: selected.purchaseDate && selected.purchaseDate !== "-" ? displayDate(selected.purchaseDate) : "-" },
                  { label: "취득금액", value: selected.purchaseCost ? `${Number(selected.purchaseCost).toLocaleString()}원` : "-" },
                  { label: "구입처", value: selected.vendor || "-" },
                  { label: "등록일", value: displayDate(selected.date) },
                  { label: "비고", value: selected.note || "-" },
                ].map(({ label, value }) => <Field key={label} label={label} value={value} />)}
              </div>
              <div style={{ background: C.bg, borderRadius: 10, padding: 16, marginBottom: 20 }}>
                <p style={{ margin: "0 0 12px", fontSize: 13, fontWeight: 600, color: "#475569" }}>자산 이력</p>
                {assetHistory.length > 0
                  ? assetHistory.map(h => (
                    <div key={h.id} style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
                      <HistoryBadge type={h.type} />
                      <span style={{ fontSize: 13, color: "#475569", flex: 1 }}>{displayUser(h.from)} → {displayUser(h.to)}</span>
                      <span style={{ fontSize: 12, color: C.textLight }}>{h.note}</span>
                      <span style={{ fontSize: 12, color: C.textLight }}>{displayDate(h.date)}</span>
                    </div>
                  ))
                  : <p style={{ margin: 0, fontSize: 13, color: "#CBD5E1" }}>이력 없음</p>}
              </div>
              {permission !== "viewer" && (
                <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
                  <Btn variant="danger" onClick={deleteAsset}>삭제</Btn>
                  <Btn onClick={() => { setEditForm({ ...selected }); setEditMode(true); }}>수정</Btn>
                </div>
              )}
            </div>
          )}
        </Modal>
      )}
    </main>
  );
}


// ── 구성원 관리 ──
function MemberPage({ members, setMembers, assets, setAssets, history, permission, userDept }) {
  const visibleMembers = permission === "admin" ? members : members.filter(m => m.department === userDept);
  const [addOpen, setAddOpen] = useState(false);
  const [selected, setSelected] = useState(null);
  const [editMode, setEditMode] = useState(false);
  const [form, setForm] = useState({ name: "", department: DEPARTMENTS[0], email: "", role: "사원" });
  const [editForm, setEditForm] = useState({});
  const [search, setSearch] = useState("");
  const [filterDept, setFilterDept] = useState("전체");
  const [sortBy, setSortBy] = useState("name"); // 기본: 이름순

  const filtered = visibleMembers.filter(m => {
    const matchDept = filterDept === "전체" || m.department === filterDept;
    const matchSearch = [m.name, m.email, m.role].some(v => v.toLowerCase().includes(search.toLowerCase()));
    return matchDept && matchSearch;
  });

  const sorted = [...filtered].sort((a, b) => {
    if (sortBy === "name") return a.name.localeCompare(b.name, "ko");
    if (sortBy === "department") return a.department.localeCompare(b.department, "ko");
    if (sortBy === "assets") {
      const aCount = assets.filter(asset => asset.user === a.name).length;
      const bCount = assets.filter(asset => asset.user === b.name).length;
      return bCount - aCount;
    }
    return 0;
  });

  const addMember = () => {
    if (!form.name || !form.email) return;
    setMembers([...members, { id: "M" + Math.floor(Math.random() * 90000 + 10000), ...form }]);
    setAddOpen(false);
    setForm({ name: "", department: DEPARTMENTS[0], email: "", role: "사원" });
  };

  const saveMember = () => {
    const prev = members.find(m => m.id === editForm.id);
    const nameChanged = prev.name !== editForm.name;

    // 이름이 변경된 경우 해당 구성원의 자산 user 필드도 함께 업데이트
    if (nameChanged) {
      const updatedAssets = assets.map(a =>
        a.user === prev.name ? { ...a, user: editForm.name } : a
      );
      setAssets(updatedAssets, []); // 이력은 생성하지 않음
    }

    setMembers(members.map(m => m.id === editForm.id ? editForm : m));
    setSelected(editForm);
    setEditMode(false);
  };

  // [수정 5] 구성원 삭제 시 배정 자산 자동 미배정 처리 및 이력 생성
  const deleteMember = () => {
    if (!window.confirm(`'${selected.name}'을(를) 삭제할까요?\n이 구성원에게 배정된 자산은 자동으로 미배정(미사용) 처리됩니다.`)) return;

    const histories = []; // 생성할 이력을 담을 배열
    
    const updatedAssets = assets.map(a => {
      if (a.user === selected.name) {
        const updatedAsset = { ...a, user: "-", status: "미사용" };
        
        // 삭제되는 구성원이 보유했던 각 자산에 대해 '반납' 이력 생성
        histories.push(makeHistory(
          "반납", 
          updatedAsset, 
          selected.name, 
          "-", 
          "구성원 삭제로 인한 자동 반납 처리"
        ));
        
        return updatedAsset;
      }
      return a;
    });

    // setAssets 호출 시 생성된 histories 배열을 함께 전달
    setAssets(updatedAssets, histories); 
    setMembers(members.filter(m => m.id !== selected.id));
    setSelected(null);
  };

  const memberAssets = (name) => assets.filter(a => a.user === name);

  return (
    <main style={{ flex: 1, padding: "36px 40px", overflowY: "auto" }}>
      <PageHeader title="구성원 관리" subtitle="부서별 구성원과 배정 자산을 관리하세요"
        action={permission !== "viewer" ? <Btn onClick={() => setAddOpen(true)}>+ 구성원 등록</Btn> : null} />
      <SummaryCards items={[
        { label: "전체", value: visibleMembers.length, color: C.primary },
        ...DEPARTMENTS.map(d => ({ label: d, value: visibleMembers.filter(m => m.department === d).length, color: C.purple }))
      ]} />
      <SearchFilter value={search} onChange={setSearch}
        filters={["전체", ...DEPARTMENTS]} active={filterDept} onFilter={setFilterDept} activeColor={C.purple} />

      <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 12 }}>
        <select value={sortBy} onChange={e => setSortBy(e.target.value)}
          style={{ border: `1px solid ${C.border}`, borderRadius: 8, padding: "7px 12px", fontSize: 13, color: C.textMuted, outline: "none", background: C.card, cursor: "pointer" }}>
          <option value="name">이름순</option>
          <option value="department">부서순</option>
          <option value="assets">보유 자산 많은 순</option>
        </select>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 16 }}>
        {sorted.map(m => {
          const myAssets = memberAssets(m.name);
          return (
            <div key={m.id} onClick={() => { setSelected(m); setEditMode(false); }}
              style={{ background: C.card, borderRadius: 12, padding: 20, boxShadow: "0 1px 4px rgba(0,0,0,0.06)", cursor: "pointer", transition: "box-shadow 0.15s" }}
              onMouseEnter={e => e.currentTarget.style.boxShadow = "0 4px 16px rgba(0,0,0,0.10)"}
              onMouseLeave={e => e.currentTarget.style.boxShadow = "0 1px 4px rgba(0,0,0,0.06)"}>
              <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 14 }}>
                <div style={{ width: 42, height: 42, borderRadius: "50%", background: "#EDE9FE", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16, fontWeight: 700, color: "#7C3AED" }}>
                  {m.name[0]}
                </div>
                <div>
                  <p style={{ margin: 0, fontSize: 15, fontWeight: 700, color: C.text }}>{m.name}</p>
                  <p style={{ margin: 0, fontSize: 12, color: C.textLight }}>{m.role}</p>
                </div>
                <span style={{ marginLeft: "auto", background: "#F3F0FF", color: "#7C3AED", fontSize: 11, fontWeight: 600, padding: "3px 10px", borderRadius: 99 }}>{m.department}</span>
              </div>
              <p style={{ margin: "0 0 12px", fontSize: 12, color: C.textMuted }}>✉ {m.email}</p>
              <div style={{ borderTop: `1px solid ${C.bg}`, paddingTop: 12 }}>
                <p style={{ margin: "0 0 6px", fontSize: 11, color: C.textLight, fontWeight: 600 }}>배정 자산 {myAssets.length}개</p>
                {myAssets.length > 0
                  ? myAssets.map(a => <span key={a.id} style={{ display: "inline-block", background: C.bg, color: "#475569", fontSize: 11, padding: "2px 8px", borderRadius: 6, marginRight: 4, marginBottom: 4 }}>{a.name} ({a.type || "기타"})</span>)
                  : <p style={{ margin: 0, fontSize: 12, color: "#CBD5E1" }}>배정된 자산 없음</p>}
              </div>
            </div>
          );
        })}
      </div>

      {addOpen && (
        <Modal title="구성원 등록" onClose={() => setAddOpen(false)}>
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <InputField label="이름" value={form.name} onChange={v => setForm({ ...form, name: v })} />
            <InputField label="이메일" value={form.email} onChange={v => setForm({ ...form, email: v })} type="email" />
            <SelectField label="부서" value={form.department} onChange={v => setForm({ ...form, department: v })} options={DEPARTMENTS} />
            <SelectField label="직급" value={form.role} onChange={v => setForm({ ...form, role: v })} options={ROLES} />
            <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 8 }}>
              <Btn variant="ghost" onClick={() => setAddOpen(false)}>취소</Btn>
              <Btn onClick={addMember}>등록</Btn>
            </div>
          </div>
        </Modal>
      )}

      {selected && (
        <Modal title={editMode ? "구성원 수정" : "구성원 상세"} onClose={() => setSelected(null)}>
          {editMode ? (
            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              <InputField label="이름" value={editForm.name} onChange={v => setEditForm({ ...editForm, name: v })} />
              <InputField label="이메일" value={editForm.email} onChange={v => setEditForm({ ...editForm, email: v })} type="email" />
              <SelectField label="부서" value={editForm.department} onChange={v => setEditForm({ ...editForm, department: v })} options={DEPARTMENTS} />
              <SelectField label="직급" value={editForm.role} onChange={v => setEditForm({ ...editForm, role: v })} options={ROLES} />
              {permission === "admin" && (
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                <label style={{ fontSize: 12, color: C.textMuted, fontWeight: 600 }}>시스템 권한</label>
                <select
                  value={editForm.permission || ""}
                  onChange={e => setEditForm({ ...editForm, permission: e.target.value })}
                  style={{ border: `1px solid ${C.border}`, borderRadius: 8, padding: "10px 12px", fontSize: 14, color: C.text, outline: "none", background: "#fff" }}>
                  <option value="">없음 (읽기 전용)</option>
                  <option value="viewer">viewer — 자기 부서 조회만</option>
                  <option value="manager">manager — 자기 부서 관리</option>
                  <option value="admin">admin — 전체 관리</option>
                </select>
              </div>
            )}
              <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 8 }}>
                <Btn variant="ghost" onClick={() => setEditMode(false)}>취소</Btn>
                <Btn onClick={saveMember}>저장</Btn>
              </div>
            </div>
          ) : (
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 24 }}>
                <div style={{ width: 56, height: 56, borderRadius: "50%", background: "#EDE9FE", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22, fontWeight: 700, color: "#7C3AED" }}>
                  {selected.name[0]}
                </div>
                <div>
                  <p style={{ margin: 0, fontSize: 18, fontWeight: 700, color: C.text }}>{selected.name}</p>
                  <p style={{ margin: 0, fontSize: 13, color: C.textLight }}>{selected.department} · {selected.role}</p>
                </div>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 20 }}>
                <Field label="사번" value={selected.id} />
                <Field label="이메일" value={selected.email} />
                <Field label="부서" value={selected.department} />
                <Field label="직급" value={selected.role} />
                {permission === "admin" && (
                  <Field label="시스템 권한" value={
                    selected.permission === "admin" ? "admin — 전체 관리" :
                    selected.permission === "manager" ? "manager — 자기 부서 관리" :
                    selected.permission === "viewer" ? "viewer — 자기 부서 조회만" :
                    "없음 (읽기 전용)"
                  } />
                )}
              </div>
              <div style={{ background: C.bg, borderRadius: 10, padding: 16, marginBottom: 20 }}>
                <p style={{ margin: "0 0 10px", fontSize: 13, fontWeight: 600, color: "#475569" }}>배정 자산</p>
                {memberAssets(selected.name).length > 0
                  ? memberAssets(selected.name).map(a => (
                    <div key={a.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                      <span style={{ fontSize: 13, color: C.text }}>{a.name}</span>
                      <StatusBadge status={a.status} />
                    </div>
                  ))
                  : <p style={{ margin: 0, fontSize: 13, color: "#CBD5E1" }}>배정된 자산 없음</p>}
              </div>
              {/* 자산 이력 섹션 */}
              <div style={{ background: C.bg, borderRadius: 10, padding: 16, marginBottom: 20 }}>
                <p style={{ margin: "0 0 10px", fontSize: 13, fontWeight: 600, color: "#475569" }}>자산 이력</p>
                {(() => {
                  const memberHistory = history
                    .filter(h => h.from === selected.name || h.to === selected.name)
                    .sort((a, b) => b.date.localeCompare(a.date));
                  return memberHistory.length > 0
                    ? memberHistory.map(h => (
                      <div key={h.id} style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8, flexWrap: "wrap" }}>
                        <HistoryBadge type={h.type} />
                        <span style={{ fontSize: 13, color: C.text, fontWeight: 500, flex: 1, minWidth: 100 }}>{h.assetName}</span>
                        <span style={{ fontSize: 12, color: C.textMuted }}>{displayUser(h.from)} → {displayUser(h.to)}</span>
                        <span style={{ fontSize: 12, color: C.textLight, whiteSpace: "nowrap" }}>{displayDate(h.date)}</span>
                      </div>
                    ))
                    : <p style={{ margin: 0, fontSize: 13, color: "#CBD5E1" }}>이력 없음</p>;
                })()}
              </div>      
              {permission !== "viewer" && (
                <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
                  <Btn variant="danger" onClick={deleteMember}>삭제</Btn>
                  <Btn onClick={() => {
                    setEditForm({
                      ...selected,
                      purchaseDate: selected.purchaseDate && selected.purchaseDate !== "-"
                        ? selected.purchaseDate.slice(0, 10)
                        : "",
                    });
                    setEditMode(true);
                  }}>수정</Btn>
                </div>
              )}
            </div>
          )}
        </Modal>
      )}
    </main>
  );
}

// ── 이력 관리 ──
function HistoryPage({ history, permission, userDept, assets }) {
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
    { label: "자산명", key: "assetName" },
    { label: "이전 사용자", key: "from" },
    { label: "변경 후 사용자", key: "to" },
    { label: "메모", key: "note" },
    { label: "날짜", key: "date" },
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
              <td style={{ padding: "14px 20px" }}><HistoryBadge type={h.type} /></td>
              <td style={{ padding: "14px 20px", fontSize: 14, color: C.text, fontWeight: 500 }}>{h.assetName}</td>
              <td style={{ padding: "14px 20px", fontSize: 14, color: C.textMuted }}>{displayUser(h.from)}</td>
              <td style={{ padding: "14px 20px", fontSize: 14, color: C.text, fontWeight: 500 }}>{displayUser(h.to)}</td>
              <td style={{ padding: "14px 20px", fontSize: 13, color: C.textLight }}>{h.note || "-"}</td>
              <td style={{ padding: "14px 20px", fontSize: 13, color: C.textLight }}>{displayDate(h.date)}</td>
            </tr>
          ))
          : [<tr key="empty"><td colSpan={6} style={{ padding: "40px", textAlign: "center", fontSize: 14, color: "#CBD5E1" }}>이력이 없습니다</td></tr>]
        }
      />
      <Pagination total={totalFiltered} page={currentPage} perPage={PER_PAGE} onChange={setCurrentPage} />
    </main>
  );
}

// ── 메인 App ──
export default function App() {
  const [session, setSession] = useState(null);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [authLoading, setAuthLoading] = useState(false);
  const [assets, setAssetsState] = useState([]);
  const [members, setMembersState] = useState([]);
  const [history, setHistoryState] = useState([]);
  const [page, setPage] = useState("dashboard");
  const [loading, setLoading] = useState(true);

  const fetchAll = async () => {
    setLoading(true);
    try {
      const [{ data: a, error: e1 }, { data: m, error: e2 }, { data: h, error: e3 }] = await Promise.all([
        supabase.from("assets").select("*"),
        supabase.from("members").select("*"),
        supabase.from("history").select("*").order("date", { ascending: false }),
      ]);
      if (e1 || e2 || e3) {
        alert("데이터를 불러오는 중 오류가 발생했습니다. 새로고침을 시도해 주세요.");
        setLoading(false);
        return;
      }
      setAssetsState(a || []);
      setMembersState(m || []);
      setHistoryState(h || []);
    } catch (e) {
      alert("네트워크 오류가 발생했습니다. 인터넷 연결을 확인해 주세요.");
    } finally {
      setLoading(false);
    }
  };

  // 로그인한 사용자 정보 파악
  const currentUser = members.find(m => m.email === session?.user?.email) || null;
  // permission이 없거나 admin이면 총무관리자, 아니면 해당 permission 사용
  const permission = currentUser?.permission || "admin";
  const userDept = currentUser?.department || null;  

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      if (session) fetchAll();
      else setLoading(false);
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      if (session) fetchAll();
    });
    return () => subscription.unsubscribe();
  }, []);

  /* 3분마다 자동 새로고침 (현재는 보류)
  useEffect(() => {
    if (!session) return;
    const interval = setInterval(fetchAll, 3 * 60 * 1000);
    return () => clearInterval(interval);
  }, [session]);
  */

  const handleLogin = async (e) => {
    e.preventDefault();
    setAuthLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) alert("로그인 실패: " + error.message);
    setAuthLoading(false);
  };

  const updateAssets = async (newAssets, histories = []) => {
    const prev = assets;
    setAssetsState(newAssets);

    const added   = newAssets.filter(n => !prev.find(p => p.id === n.id));
    const removed = prev.filter(p => !newAssets.find(n => n.id === p.id));
    const updated = newAssets.filter(n => {
      const old = prev.find(p => p.id === n.id);
      return old && JSON.stringify(old) !== JSON.stringify(n);
    });

    if (added.length) {
      const { error } = await supabase.from("assets").insert(added);
      if (error) { setAssetsState(prev); alert("등록 실패: " + error.message); return; }
    }
    if (removed.length) {
      const { error } = await supabase.from("assets").delete().in("id", removed.map(r => r.id));
      if (error) { setAssetsState(prev); alert("삭제 실패: " + error.message); return; }
    }
    if (updated.length) {
      for (const u of updated) {
        const { error } = await supabase.from("assets").update(u).eq("id", u.id);
        if (error) { setAssetsState(prev); alert("수정 실패: " + error.message); return; }
      }
    }

    if (histories.length > 0) {
      const { error } = await supabase.from("history").insert(histories);
      if (error) { alert("이력 저장 실패: " + error.message); return; }
    }

    const { data: hData } = await supabase.from("history")
      .select("*")
      .order("date", { ascending: false })
      .order("id", { ascending: false });
    if (hData) setHistoryState(hData);
  };

  // ── members 변경 시 Supabase 동기화 ──
  const updateMembers = async (newMembers) => {
    const prev = members;
    setMembersState(newMembers);
    const added   = newMembers.filter(n => !prev.find(p => p.id === n.id));
    const removed = prev.filter(p => !newMembers.find(n => n.id === p.id));
    const updated = newMembers.filter(n => {
      const old = prev.find(p => p.id === n.id);
      return old && JSON.stringify(old) !== JSON.stringify(n);
    });
    if (added.length) {
      const { error } = await supabase.from("members").insert(added);
      if (error) { setMembersState(prev); alert("구성원 등록 실패: " + error.message); return; }
    }
    if (removed.length) {
      const { error } = await supabase.from("members").delete().in("id", removed.map(r => r.id));
      if (error) { setMembersState(prev); alert("구성원 삭제 실패: " + error.message); return; }
    }
    if (updated.length) {
      for (const u of updated) {
        const { error } = await supabase.from("members").update(u).eq("id", u.id);
        if (error) { setMembersState(prev); alert("구성원 수정 실패: " + error.message); return; }
      }
    }
  };

  const menuItems = [
    { key: "dashboard", icon: "dashboard", label: "대시보드" },
    { key: "assets",    icon: "assets",    label: "자산관리" },
    { key: "members",   icon: "members",   label: "구성원 관리" },
    { key: "history",   icon: "history",   label: "이력 관리" },
  ];

  if (loading) return (
    <div style={{ display: "flex", height: "100vh", alignItems: "center", justifyContent: "center", background: C.bg, flexDirection: "column", gap: 16 }}>
      <div style={{ width: 40, height: 40, border: `3px solid ${C.border}`, borderTop: `3px solid ${C.primary}`, borderRadius: "50%", animation: "spin 0.8s linear infinite" }} />
      <p style={{ color: C.textLight, fontSize: 14 }}>데이터 불러오는 중...</p>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );

  if (!session) {
    return (
      <div style={{
        height: "100vh", display: "flex", alignItems: "center", justifyContent: "center",
        background: "linear-gradient(135deg, #0F172A 0%, #1E293B 100%)", fontFamily: "'Pretendard', sans-serif"
      }}>
        <div style={{
          width: "100%", maxWidth: 400, padding: 40, borderRadius: 24,
          background: "rgba(255, 255, 255, 0.05)", backdropFilter: "blur(12px)",
          border: "1px solid rgba(255, 255, 255, 0.1)", textAlign: "center",
          boxShadow: "0 20px 50px rgba(0,0,0,0.3)"
        }}>
          <div style={{ marginBottom: 32 }}>
            <div style={{ width: 64, height: 64, background: C.primary, borderRadius: 18, margin: "0 auto 16px", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 28, boxShadow: `0 8px 20px ${C.primary}44` }}>📦</div>
            <h1 style={{ color: "#fff", fontSize: 26, fontWeight: 800, margin: 0, letterSpacing: "-0.5px" }}>DURAE Assets</h1>
            <p style={{ color: "rgba(255,255,255,0.4)", fontSize: 14, marginTop: 10, fontWeight: 500 }}>Admin Authentication</p>
          </div>
          <form onSubmit={handleLogin} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <input
              type="email" placeholder="Admin Email" value={email} onChange={e => setEmail(e.target.value)}
              style={{ width: "100%", padding: "16px 20px", borderRadius: 14, border: "1px solid rgba(255,255,255,0.1)", background: "rgba(255,255,255,0.05)", color: "#fff", fontSize: 15, outline: "none" }}
            />
            <input
              type="password" placeholder="Password" value={password} onChange={e => setPassword(e.target.value)}
              style={{ width: "100%", padding: "16px 20px", borderRadius: 14, border: "1px solid rgba(255,255,255,0.1)", background: "rgba(255,255,255,0.05)", color: "#fff", fontSize: 15, outline: "none" }}
            />
            <button
              disabled={authLoading}
              style={{ width: "100%", padding: "16px", borderRadius: 14, border: "none", background: C.primary, color: "#fff", fontWeight: 700, cursor: "pointer", fontSize: 16, marginTop: 12, transition: "transform 0.2s" }}
              onMouseEnter={e => e.target.style.transform = "scale(1.02)"}
              onMouseLeave={e => e.target.style.transform = "scale(1)"}
            >
              {authLoading ? "Authenticating..." : "Sign In"}
            </button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div style={{ display: "flex", height: "100vh", fontFamily: "'Pretendard', 'Apple SD Gothic Neo', sans-serif", background: C.bg }}>
      <aside style={{ width: 224, background: C.sidebar, display: "flex", flexDirection: "column", flexShrink: 0 }}>
        <div style={{ padding: "28px 20px 24px", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
          <div onClick={() => setPage("dashboard")}
            style={{ display: "flex", alignItems: "center", gap: 10, cursor: "pointer" }}>
            <div style={{ width: 32, height: 32, borderRadius: 8, background: C.primary, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16 }}>📦</div>
            <span style={{ color: "#fff", fontWeight: 800, fontSize: 17, letterSpacing: "-0.3px" }}>DURAE Assets</span>
          </div>
        </div>
        <nav style={{ flex: 1, padding: "12px 10px" }}>
          <p style={{ fontSize: 10, fontWeight: 700, color: "rgba(255,255,255,0.25)", letterSpacing: "0.08em", padding: "8px 10px 4px", margin: 0 }}>MENU</p>
          {menuItems.map(({ key, icon, label }) => {
            const active = page === key;
            return (
              <div key={key} onClick={() => setPage(key)}
                style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 12px", borderRadius: 8, marginBottom: 2, cursor: "pointer", background: active ? C.sidebarActive : "transparent", transition: "background 0.15s" }}
                onMouseEnter={e => { if (!active) e.currentTarget.style.background = C.sidebarHover; }}
                onMouseLeave={e => { if (!active) e.currentTarget.style.background = "transparent"; }}>
                <Icon type={icon} active={active} />
                <span style={{ fontSize: 14, fontWeight: active ? 600 : 400, color: active ? "#fff" : "rgba(255,255,255,0.5)", letterSpacing: "-0.1px" }}>{label}</span>
                {active && <div style={{ marginLeft: "auto", width: 6, height: 6, borderRadius: "50%", background: C.primary }} />}
              </div>
            );
          })}
        </nav>
        <div style={{ padding: "12px 20px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <div style={{ width: 28, height: 28, borderRadius: "50%", background: permission === "admin" ? C.primary : permission === "manager" ? C.purple : "rgba(255,255,255,0.1)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 700, color: "#fff" }}>
              {currentUser ? currentUser.name[0] : "A"}
            </div>
            <div>
              <p style={{ margin: 0, fontSize: 12, fontWeight: 600, color: "#fff" }}>{currentUser ? currentUser.name : "관리자"}</p>
              <p style={{ margin: 0, fontSize: 10, color: "rgba(255,255,255,0.4)" }}>
                {permission === "admin" ? "총무관리자" : permission === "manager" ? "부서장" : "구성원"}
              </p>
            </div>
          </div>
        </div>
        <div style={{ padding: "16px 20px", borderTop: "1px solid rgba(255,255,255,0.06)" }}>
          <button
            onClick={fetchAll}
            style={{ width: "100%", padding: "8px", background: "rgba(59,130,246,0.1)", color: C.primary, border: "none", borderRadius: 6, fontSize: 12, fontWeight: 600, cursor: "pointer", marginBottom: 8 }}
          >
            ↺ 새로고침
          </button>
          <button
            onClick={() => supabase.auth.signOut()}
            style={{ width: "100%", padding: "8px", background: "rgba(239,68,68,0.1)", color: C.danger, border: "none", borderRadius: 6, fontSize: 12, fontWeight: 600, cursor: "pointer", marginBottom: 12 }}
          >
            Sign Out
          </button>
          <p style={{ margin: 0, fontSize: 11, color: "rgba(255,255,255,0.2)" }}>DURAE Assets v1.0.0</p>
        </div>
      </aside>
      {page === "dashboard" && <Dashboard assets={assets} members={members} history={history} permission={permission} userDept={userDept} />}
      {page === "assets"    && <AssetPage assets={assets} setAssets={updateAssets} history={history} members={members} permission={permission} userDept={userDept} />}
      {page === "members"   && <MemberPage members={members} setMembers={updateMembers} assets={assets} setAssets={updateAssets} history={history} permission={permission} userDept={userDept} />}
      {page === "history" && <HistoryPage history={history} permission={permission} userDept={userDept} assets={assets} />}
    </div>
  );
}