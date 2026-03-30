import React, { useState, useEffect } from "react";
import {
  PieChart, Pie, Cell, Tooltip,
  BarChart, Bar, XAxis, YAxis, ResponsiveContainer
} from "recharts";
import { supabase } from "./supabase";
import { exportToExcel } from "./exportExcel";

// ── 초기 데이터 ──
// ── 초기 데이터 ──
const initialAssets = [
  { id: "A1001", name: "Dell XPS 15", status: "사용중", user: "박인수", date: "2021-03-10", location: "본사" },
  { id: "A1002", name: "MacBook Pro 14", status: "사용중", user: "김지연", date: "2021-06-22", location: "본사" },
  { id: "A1003", name: "iPhone 14 Pro", status: "사용중", user: "이수민", date: "2022-01-15", location: "본사" },
  { id: "A1004", name: "iPad Air 5", status: "미사용", user: "-", date: "2022-03-08", location: "사무지사" },
  { id: "A1005", name: "Samsung Galaxy S23", status: "사용중", user: "최준혁", date: "2022-05-20", location: "본사" },
  { id: "A1006", name: "LG 울트라기어 모니터", status: "사용중", user: "정다은", date: "2021-09-14", location: "본사" },
  { id: "A1007", name: "Dell U2722D 모니터", status: "미사용", user: "-", date: "2022-07-01", location: "창고" },
  { id: "A1008", name: "Apple Magic Keyboard", status: "사용중", user: "박인수", date: "2021-03-10", location: "본사" },
  { id: "A1009", name: "Logitech MX Master 3", status: "수리중", user: "김지연", date: "2021-06-22", location: "본사" },
  { id: "A1010", name: "Sony WH-1000XM5", status: "사용중", user: "이수민", date: "2022-08-30", location: "본사" },
  { id: "A1011", name: "MacBook Air M2", status: "사용중", user: "한지호", date: "2022-10-05", location: "사무지사" },
  { id: "A1012", name: "iPad Pro 12.9", status: "수리중", user: "오세영", date: "2021-11-18", location: "본사" },
  { id: "A1013", name: "Microsoft Surface Pro 9", status: "미사용", user: "-", date: "2023-01-09", location: "창고" },
  { id: "A1014", name: "ThinkPad X1 Carbon", status: "사용중", user: "윤채원", date: "2021-04-23", location: "본사" },
  { id: "A1015", name: "HP EliteBook 840", status: "사용중", user: "강민준", date: "2022-02-17", location: "사무지사" },
  { id: "A1016", name: "iPhone 13 mini", status: "미사용", user: "-", date: "2022-09-12", location: "창고" },
  { id: "A1017", name: "Galaxy Tab S8", status: "사용중", user: "임서연", date: "2022-11-03", location: "본사" },
  { id: "A1018", name: "Bose QC45 헤드폰", status: "사용중", user: "박인수", date: "2022-12-20", location: "본사" },
  { id: "A1019", name: "LG 그램 16", status: "수리중", user: "정다은", date: "2023-02-14", location: "본사" },
  { id: "A1020", name: "Apple Watch Series 8", status: "미사용", user: "-", date: "2023-03-01", location: "창고" },
  { id: "A1021", name: "Razer Blade 15", status: "사용중", user: "최준혁", date: "2023-04-10", location: "본사" },
  { id: "A1022", name: "ASUS ZenBook Pro", status: "사용중", user: "한지호", date: "2023-05-22", location: "사무지사" },
  { id: "A1023", name: "Cisco IP Phone", status: "사용중", user: "윤채원", date: "2021-01-05", location: "본사" },
  { id: "A1024", name: "Jabra Evolve2 85", status: "미사용", user: "-", date: "2023-06-15", location: "창고" },
  { id: "A1025", name: "Wacom Intuos Pro", status: "사용중", user: "김지연", date: "2022-04-18", location: "본사" },
  { id: "A1026", name: "Mac Mini M2", status: "사용중", user: "강민준", date: "2023-07-01", location: "사무지사" },
  { id: "A1027", name: "Dell Precision 5570", status: "수리중", user: "오세영", date: "2022-06-30", location: "본사" },
  { id: "A1028", name: "Samsung 외장 SSD T7", status: "미사용", user: "-", date: "2023-08-05", location: "창고" },
  { id: "A1029", name: "Anker 허브 13in1", status: "사용중", user: "임서연", date: "2023-09-10", location: "본사" },
  { id: "A1030", name: "iPhone 15 Pro", status: "사용중", user: "박인수", date: "2023-10-01", location: "본사" },
];

const initialMembers = [
  { id: "M001", name: "박인수", department: "개발팀", email: "insu@company.com", role: "팀장" },
  { id: "M002", name: "김지연", department: "디자인팀", email: "jiyeon@company.com", role: "팀장" },
  { id: "M003", name: "이수민", department: "개발팀", email: "sumin@company.com", role: "팀원" },
  { id: "M004", name: "최준혁", department: "마케팅팀", email: "junhyuk@company.com", role: "팀장" },
  { id: "M005", name: "정다은", department: "HR팀", email: "daeun@company.com", role: "팀원" },
  { id: "M006", name: "한지호", department: "개발팀", email: "jiho@company.com", role: "팀원" },
  { id: "M007", name: "오세영", department: "경영지원팀", email: "seyoung@company.com", role: "팀장" },
  { id: "M008", name: "윤채원", department: "마케팅팀", email: "chaewon@company.com", role: "팀원" },
  { id: "M009", name: "강민준", department: "개발팀", email: "minjun@company.com", role: "팀원" },
  { id: "M010", name: "임서연", department: "디자인팀", email: "seoyeon@company.com", role: "팀원" },
  { id: "M011", name: "송태양", department: "HR팀", email: "taeyang@company.com", role: "팀장" },
  { id: "M012", name: "배수지", department: "경영지원팀", email: "suji@company.com", role: "팀원" },
  { id: "M013", name: "권도현", department: "마케팅팀", email: "dohyun@company.com", role: "팀원" },
  { id: "M014", name: "나은혜", department: "디자인팀", email: "eunhye@company.com", role: "팀원" },
  { id: "M015", name: "문성훈", department: "개발팀", email: "sunghoon@company.com", role: "팀원" },
];

const initialHistory = [
  { id: "H001", assetId: "A1001", assetName: "Dell XPS 15", type: "배정", from: "-", to: "박인수", date: "2021-03-10", note: "신규 입사자 지급" },
  { id: "H002", assetId: "A1002", assetName: "MacBook Pro 14", type: "배정", from: "-", to: "김지연", date: "2021-06-22", note: "디자인팀 지급" },
  { id: "H003", assetId: "A1003", assetName: "iPhone 14 Pro", type: "배정", from: "-", to: "이수민", date: "2022-01-15", note: "업무용 지급" },
  { id: "H004", assetId: "A1005", assetName: "Samsung Galaxy S23", type: "배정", from: "-", to: "최준혁", date: "2022-05-20", note: "마케팅팀 지급" },
  { id: "H005", assetId: "A1006", assetName: "LG 울트라기어 모니터", type: "배정", from: "-", to: "정다은", date: "2021-09-14", note: "모니터 추가 지급" },
  { id: "H006", assetId: "A1009", assetName: "Logitech MX Master 3", type: "배정", from: "-", to: "김지연", date: "2021-06-22", note: "마우스 지급" },
  { id: "H007", assetId: "A1009", assetName: "Logitech MX Master 3", type: "반납", from: "김지연", to: "-", date: "2023-08-01", note: "수리 접수" },
  { id: "H008", assetId: "A1011", assetName: "MacBook Air M2", type: "배정", from: "-", to: "한지호", date: "2022-10-05", note: "신규 입사자 지급" },
  { id: "H009", assetId: "A1014", assetName: "ThinkPad X1 Carbon", type: "배정", from: "-", to: "윤채원", date: "2021-04-23", note: "업무용 지급" },
  { id: "H010", assetId: "A1015", assetName: "HP EliteBook 840", type: "배정", from: "-", to: "강민준", date: "2022-02-17", note: "사무지사 지급" },
  { id: "H011", assetId: "A1017", assetName: "Galaxy Tab S8", type: "배정", from: "-", to: "임서연", date: "2022-11-03", note: "디자인팀 지급" },
  { id: "H012", assetId: "A1019", assetName: "LG 그램 16", type: "배정", from: "-", to: "정다은", date: "2023-02-14", note: "기기 교체" },
  { id: "H013", assetId: "A1019", assetName: "LG 그램 16", type: "반납", from: "정다은", to: "-", date: "2023-09-01", note: "수리 접수" },
  { id: "H014", assetId: "A1021", assetName: "Razer Blade 15", type: "배정", from: "-", to: "최준혁", date: "2023-04-10", note: "고성능 작업용" },
  { id: "H015", assetId: "A1025", assetName: "Wacom Intuos Pro", type: "배정", from: "-", to: "김지연", date: "2022-04-18", note: "디자인 작업용" },
  { id: "H016", assetId: "A1026", assetName: "Mac Mini M2", type: "배정", from: "-", to: "강민준", date: "2023-07-01", note: "개발 서버용" },
  { id: "H017", assetId: "A1027", assetName: "Dell Precision 5570", type: "배정", from: "-", to: "오세영", date: "2022-06-30", note: "업무용 지급" },
  { id: "H018", assetId: "A1027", assetName: "Dell Precision 5570", type: "반납", from: "오세영", to: "-", date: "2023-10-15", note: "수리 접수" },
  { id: "H019", assetId: "A1029", assetName: "Anker 허브 13in1", type: "배정", from: "-", to: "임서연", date: "2023-09-10", note: "허브 추가 지급" },
  { id: "H020", assetId: "A1030", assetName: "iPhone 15 Pro", type: "배정", from: "-", to: "박인수", date: "2023-10-01", note: "기기 교체 지급" },
];

const DEPARTMENTS = ["개발팀", "디자인팀", "마케팅팀", "HR팀", "경영지원팀"];
const STATUS_OPTIONS = ["사용중", "미사용", "수리중"];
const STATUS_COLORS = { "사용중": "#10B981", "미사용": "#94A3B8", "수리중": "#EF4444" };

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
    { background: "#FEE2E2", color: "#991B1B" };
  return <span style={{ ...style, padding: "3px 10px", borderRadius: 99, fontSize: 12, fontWeight: 600 }}>{status}</span>;
};

const HistoryBadge = ({ type }) => {
  const style = type === "배정"
    ? { background: "#DBEAFE", color: "#1D4ED8" }
    : { background: "#FEF3C7", color: "#92400E" };
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

const InputField = ({ label, value, onChange, type = "text" }) => (
  <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
    <label style={{ fontSize: 12, color: C.textMuted, fontWeight: 600 }}>{label}</label>
    <input type={type} value={value} onChange={e => onChange(e.target.value)}
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
      {options.map(o => <option key={o}>{o}</option>)}
    </select>
  </div>
);

// 통일된 버튼 컴포넌트
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

// ── 페이지 헤더 ──
const PageHeader = ({ title, subtitle, action }) => (
  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 28 }}>
    <div>
      <h1 style={{ fontSize: 22, fontWeight: 700, color: C.text, margin: 0 }}>{title}</h1>
      <p style={{ fontSize: 13, color: C.textLight, marginTop: 4, marginBottom: 0 }}>{subtitle}</p>
    </div>
    {action}
  </div>
);

// ── 요약 카드 ──
const SummaryCards = ({ items }) => (
  <div style={{ display: "grid", gridTemplateColumns: `repeat(${items.length}, 1fr)`, gap: 16, marginBottom: 28 }}>
    {items.map(({ label, value, color }) => (
      <div key={label} style={{ background: C.card, borderRadius: 12, padding: "20px 24px", boxShadow: "0 1px 4px rgba(0,0,0,0.06)" }}>
        <p style={{ margin: 0, fontSize: 13, color: C.textLight, fontWeight: 500 }}>{label}</p>
        <p style={{ margin: "8px 0 0", fontSize: 28, fontWeight: 700, color }}>{value}</p>
      </div>
    ))}
  </div>
);

// ── 검색 + 필터 바 ──
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

// ── 테이블 래퍼 ──
const Table = ({ headers, rows }) => (
  <div style={{ background: C.card, borderRadius: 12, boxShadow: "0 1px 4px rgba(0,0,0,0.06)", overflow: "hidden" }}>
    <table style={{ width: "100%", borderCollapse: "collapse" }}>
      <thead>
        <tr style={{ background: "#F8FAFC", borderBottom: `1px solid ${C.border}` }}>
          {headers.map(h => (
            <th key={h} style={{ padding: "12px 20px", textAlign: "left", fontSize: 12, fontWeight: 600, color: C.textMuted, letterSpacing: "0.04em" }}>{h}</th>
          ))}
        </tr>
      </thead>
      <tbody>{rows}</tbody>
    </table>
  </div>
);

// ── 대시보드 ──
function Dashboard({ assets, members, history }) {
  const statusData = STATUS_OPTIONS.map(s => ({ name: s, value: assets.filter(a => a.status === s).length }));
  const deptMap = {};
  members.forEach(m => { deptMap[m.department] = (deptMap[m.department] || 0) + 1; });
  const deptData = Object.entries(deptMap).map(([name, value]) => ({ name, value }));

  return (
    <main style={{ flex: 1, padding: "36px 40px", overflowY: "auto" }}>
      <PageHeader title="대시보드" subtitle="전체 현황을 한눈에 확인하세요"
        action={
          <button
            onClick={() => exportToExcel(assets, members, history)}
            style={{ background: "#10B981", color: "#fff", border: "none", padding: "10px 20px", borderRadius: 8, fontSize: 14, fontWeight: 600, cursor: "pointer", display: "flex", alignItems: "center", gap: 6 }}
            onMouseEnter={e => e.currentTarget.style.opacity = "0.85"}
            onMouseLeave={e => e.currentTarget.style.opacity = "1"}
          >
            ⬇ 엑셀 내보내기
          </button>
        }
      />
      <SummaryCards items={[
        { label: "전체 자산", value: assets.length, color: C.primary },
        { label: "사용중", value: assets.filter(a => a.status === "사용중").length, color: "#10B981" },
        { label: "수리중", value: assets.filter(a => a.status === "수리중").length, color: C.danger },
        { label: "전체 구성원", value: members.length, color: C.purple },
      ]} />

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20, marginBottom: 20 }}>
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
        <div style={{ background: C.card, borderRadius: 12, padding: 24, boxShadow: "0 1px 4px rgba(0,0,0,0.06)" }}>
          <h3 style={{ margin: "0 0 20px", fontSize: 15, fontWeight: 700, color: C.text }}>부서별 구성원 현황</h3>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={deptData} barSize={32}>
              <XAxis dataKey="name" tick={{ fontSize: 11, fill: C.textLight }} axisLine={false} tickLine={false} />
              <YAxis allowDecimals={false} tick={{ fontSize: 12, fill: C.textLight }} axisLine={false} tickLine={false} />
              <Tooltip cursor={{ fill: "#F1F5F9" }} />
              <Bar dataKey="value" fill={C.purple} radius={[6, 6, 0, 0]} name="구성원 수" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div style={{ background: C.card, borderRadius: 12, padding: 24, boxShadow: "0 1px 4px rgba(0,0,0,0.06)" }}>
        <h3 style={{ margin: "0 0 16px", fontSize: 15, fontWeight: 700, color: C.text }}>최근 배정/반납 이력</h3>
        {history.length === 0
          ? <p style={{ margin: 0, fontSize: 13, color: C.textLight }}>이력 없음</p>
          : history.slice(-5).reverse().map(h => (
            <div key={h.id} style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 0", borderBottom: `1px solid ${C.bg}` }}>
              <HistoryBadge type={h.type} />
              <span style={{ fontSize: 14, color: C.text, fontWeight: 500, flex: 1 }}>{h.assetName}</span>
              <span style={{ fontSize: 13, color: C.textMuted }}>{h.from} → {h.to}</span>
              <span style={{ fontSize: 12, color: C.textLight }}>{h.date}</span>
            </div>
          ))
        }
      </div>
    </main>
  );
}

// ── 자산관리 ──
function AssetPage({ assets, setAssets, history, setHistory }) {
  const [addOpen, setAddOpen] = useState(false);
  const [form, setForm] = useState({ name: "", location: "" });
  const [selected, setSelected] = useState(null);
  const [editMode, setEditMode] = useState(false);
  const [editForm, setEditForm] = useState({});
  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState("전체");

  const filtered = assets.filter(a => {
    const matchStatus = filterStatus === "전체" || a.status === filterStatus;
    const matchSearch = [a.name, a.user, a.location].some(v => v.toLowerCase().includes(search.toLowerCase()));
    return matchStatus && matchSearch;
  });

  const addAsset = () => {
    if (!form.name || !form.location) return;
    setAssets([...assets, { id: "A" + Math.floor(Math.random() * 10000), name: form.name, status: "미사용", user: "-", date: new Date().toISOString().slice(0, 10), location: form.location }]);
    setAddOpen(false);
    setForm({ name: "", location: "" });
  };

  const saveEdit = () => {
    const prev = assets.find(a => a.id === editForm.id);
    if (prev.user !== editForm.user) {
      setHistory(h => [...h, {
        id: "H" + Date.now(), assetId: editForm.id, assetName: editForm.name,
        type: editForm.user === "-" ? "반납" : "배정",
        from: prev.user, to: editForm.user,
        date: new Date().toISOString().slice(0, 10),
        note: editForm.user === "-" ? "반납 처리" : "배정 처리",
      }]);
    }
    setAssets(assets.map(a => a.id === editForm.id ? editForm : a));
    setSelected(editForm);
    setEditMode(false);
  };

  const deleteAsset = () => {
    if (!window.confirm(`'${selected.name}'을(를) 삭제할까요?`)) return;
    setAssets(assets.filter(a => a.id !== selected.id));
    setSelected(null);
  };

  const assetHistory = selected ? history.filter(h => h.assetId === selected.id) : [];

  return (
    <main style={{ flex: 1, padding: "36px 40px", overflowY: "auto" }}>
      <PageHeader title="자산 관리" subtitle="등록된 IT 기기를 한눈에 확인하세요"
        action={<Btn onClick={() => setAddOpen(true)}>+ 자산 등록</Btn>} />
      <SummaryCards items={[
        { label: "전체 자산", value: assets.length, color: C.primary },
        { label: "사용중", value: assets.filter(a => a.status === "사용중").length, color: "#10B981" },
        { label: "수리중", value: assets.filter(a => a.status === "수리중").length, color: C.danger },
      ]} />
      <SearchFilter value={search} onChange={setSearch}
        filters={["전체", "사용중", "미사용", "수리중"]} active={filterStatus} onFilter={setFilterStatus} />
      <Table
        headers={["자산번호", "자산명", "상태", "사용자", "위치", "등록일"]}
        rows={filtered.map((a, i) => (
          <tr key={a.id} onClick={() => { setSelected(a); setEditMode(false); }}
            style={{ borderBottom: i < filtered.length - 1 ? `1px solid ${C.bg}` : "none", cursor: "pointer" }}
            onMouseEnter={e => e.currentTarget.style.background = "#F8FAFC"}
            onMouseLeave={e => e.currentTarget.style.background = "transparent"}>
            {[a.id, a.name, <StatusBadge status={a.status} />, a.user, a.location, a.date].map((val, j) => (
              <td key={j} style={{ padding: "14px 20px", fontSize: 14, color: C.text }}>{val}</td>
            ))}
          </tr>
        ))}
      />

      {addOpen && (
        <Modal title="자산 등록" onClose={() => setAddOpen(false)}>
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <InputField label="자산명" value={form.name} onChange={v => setForm({ ...form, name: v })} />
            <InputField label="위치" value={form.location} onChange={v => setForm({ ...form, location: v })} />
            <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 8 }}>
              <Btn variant="ghost" onClick={() => setAddOpen(false)}>취소</Btn>
              <Btn onClick={addAsset}>등록</Btn>
            </div>
          </div>
        </Modal>
      )}

      {selected && (
        <Modal title={editMode ? "자산 수정" : "자산 상세"} onClose={() => setSelected(null)} wide>
          {editMode ? (
            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              {[{ label: "자산명", key: "name" }, { label: "사용자", key: "user" }, { label: "위치", key: "location" }].map(({ label, key }) => (
                <InputField key={key} label={label} value={editForm[key]} onChange={v => setEditForm({ ...editForm, [key]: v })} />
              ))}
              <SelectField label="상태" value={editForm.status} onChange={v => setEditForm({ ...editForm, status: v })} options={STATUS_OPTIONS} />
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
                  { label: "자산명", value: selected.name },
                  { label: "상태", value: <StatusBadge status={selected.status} /> },
                  { label: "사용자", value: selected.user },
                  { label: "위치", value: selected.location },
                  { label: "등록일", value: selected.date },
                ].map(({ label, value }) => <Field key={label} label={label} value={value} />)}
              </div>
              <div style={{ background: C.bg, borderRadius: 10, padding: 16, marginBottom: 20 }}>
                <p style={{ margin: "0 0 12px", fontSize: 13, fontWeight: 600, color: "#475569" }}>배정/반납 이력</p>
                {assetHistory.length > 0
                  ? assetHistory.slice().reverse().map(h => (
                    <div key={h.id} style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
                      <HistoryBadge type={h.type} />
                      <span style={{ fontSize: 13, color: "#475569", flex: 1 }}>{h.from} → {h.to}</span>
                      <span style={{ fontSize: 12, color: C.textLight }}>{h.note}</span>
                      <span style={{ fontSize: 12, color: C.textLight }}>{h.date}</span>
                    </div>
                  ))
                  : <p style={{ margin: 0, fontSize: 13, color: "#CBD5E1" }}>이력 없음</p>}
              </div>
              <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
                <Btn variant="danger" onClick={deleteAsset}>삭제</Btn>
                <Btn onClick={() => { setEditForm({ ...selected }); setEditMode(true); }}>수정</Btn>
              </div>
            </div>
          )}
        </Modal>
      )}
    </main>
  );
}

// ── 구성원 관리 ──
function MemberPage({ members, setMembers, assets }) {
  const [addOpen, setAddOpen] = useState(false);
  const [selected, setSelected] = useState(null);
  const [editMode, setEditMode] = useState(false);
  const [form, setForm] = useState({ name: "", department: DEPARTMENTS[0], email: "", role: "팀원" });
  const [editForm, setEditForm] = useState({});
  const [search, setSearch] = useState("");
  const [filterDept, setFilterDept] = useState("전체");

  const filtered = members.filter(m => {
    const matchDept = filterDept === "전체" || m.department === filterDept;
    const matchSearch = [m.name, m.email, m.role].some(v => v.toLowerCase().includes(search.toLowerCase()));
    return matchDept && matchSearch;
  });

  const addMember = () => {
    if (!form.name || !form.email) return;
    setMembers([...members, { id: "M" + Math.floor(Math.random() * 10000), ...form }]);
    setAddOpen(false);
    setForm({ name: "", department: DEPARTMENTS[0], email: "", role: "팀원" });
  };

  const saveMember = () => {
    setMembers(members.map(m => m.id === editForm.id ? editForm : m));
    setSelected(editForm); setEditMode(false);
  };

  const deleteMember = () => {
    if (!window.confirm(`'${selected.name}'을(를) 삭제할까요?`)) return;
    setMembers(members.filter(m => m.id !== selected.id));
    setSelected(null);
  };

  const memberAssets = (name) => assets.filter(a => a.user === name);

  return (
    <main style={{ flex: 1, padding: "36px 40px", overflowY: "auto" }}>
      <PageHeader title="구성원 관리" subtitle="부서별 구성원과 배정 자산을 관리하세요"
        action={<Btn onClick={() => setAddOpen(true)}>+ 구성원 등록</Btn>} />
      <SummaryCards items={[
        { label: "전체", value: members.length, color: C.primary },
        ...DEPARTMENTS.slice(0, 3).map(d => ({ label: d, value: members.filter(m => m.department === d).length, color: C.purple }))
      ]} />
      <SearchFilter value={search} onChange={setSearch}
        filters={["전체", ...DEPARTMENTS]} active={filterDept} onFilter={setFilterDept} activeColor={C.purple} />

      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 16 }}>
        {filtered.map(m => {
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
                  ? myAssets.map(a => <span key={a.id} style={{ display: "inline-block", background: C.bg, color: "#475569", fontSize: 11, padding: "2px 8px", borderRadius: 6, marginRight: 4, marginBottom: 4 }}>{a.name}</span>)
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
            <InputField label="역할" value={form.role} onChange={v => setForm({ ...form, role: v })} />
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
              <InputField label="역할" value={editForm.role} onChange={v => setEditForm({ ...editForm, role: v })} />
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
                <Field label="역할" value={selected.role} />
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
              <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
                <Btn variant="danger" onClick={deleteMember}>삭제</Btn>
                <Btn onClick={() => { setEditForm({ ...selected }); setEditMode(true); }}>수정</Btn>
              </div>
            </div>
          )}
        </Modal>
      )}
    </main>
  );
}

// ── 이력 관리 ──
function HistoryPage({ history }) {
  const [filterType, setFilterType] = useState("전체");
  const [search, setSearch] = useState("");

  const filtered = history.filter(h => {
    const matchType = filterType === "전체" || h.type === filterType;
    const matchSearch = [h.assetName, h.from, h.to, h.note].some(v => v?.toLowerCase().includes(search.toLowerCase()));
    return matchType && matchSearch;
  }).slice().reverse();

  return (
    <main style={{ flex: 1, padding: "36px 40px", overflowY: "auto" }}>
      <PageHeader title="배정/반납 이력" subtitle="자산의 배정 및 반납 기록을 확인하세요" />
      <SummaryCards items={[
        { label: "전체 이력", value: history.length, color: C.primary },
        { label: "배정", value: history.filter(h => h.type === "배정").length, color: "#1D4ED8" },
        { label: "반납", value: history.filter(h => h.type === "반납").length, color: "#92400E" },
      ]} />
      <SearchFilter value={search} onChange={setSearch}
        filters={["전체", "배정", "반납"]} active={filterType} onFilter={setFilterType} />
      <Table
        headers={["구분", "자산명", "이전 사용자", "변경 후 사용자", "메모", "날짜"]}
        rows={filtered.length > 0
          ? filtered.map((h, i) => (
            <tr key={h.id} style={{ borderBottom: i < filtered.length - 1 ? `1px solid ${C.bg}` : "none" }}
              onMouseEnter={e => e.currentTarget.style.background = "#F8FAFC"}
              onMouseLeave={e => e.currentTarget.style.background = "transparent"}>
              <td style={{ padding: "14px 20px" }}><HistoryBadge type={h.type} /></td>
              <td style={{ padding: "14px 20px", fontSize: 14, color: C.text, fontWeight: 500 }}>{h.assetName}</td>
              <td style={{ padding: "14px 20px", fontSize: 14, color: C.textMuted }}>{h.from}</td>
              <td style={{ padding: "14px 20px", fontSize: 14, color: C.text, fontWeight: 500 }}>{h.to}</td>
              <td style={{ padding: "14px 20px", fontSize: 13, color: C.textLight }}>{h.note || "-"}</td>
              <td style={{ padding: "14px 20px", fontSize: 13, color: C.textLight }}>{h.date}</td>
            </tr>
          ))
          : [<tr key="empty"><td colSpan={6} style={{ padding: "40px", textAlign: "center", fontSize: 14, color: "#CBD5E1" }}>이력이 없습니다</td></tr>]
        }
      />
    </main>
  );
}

// ── 메인 App ──
export default function App() {
  const [assets, setAssets] = useState([]);
  const [members, setMembers] = useState([]);
  const [history, setHistory] = useState([]);
  const [page, setPage] = useState("dashboard");
  const [loading, setLoading] = useState(true);

  // ── 데이터 불러오기 ──
  useEffect(() => {
    const fetchAll = async () => {
      setLoading(true);
      const [{ data: a }, { data: m }, { data: h }] = await Promise.all([
        supabase.from("assets").select("*"),
        supabase.from("members").select("*"),
        supabase.from("history").select("*").order("date", { ascending: true }),
      ]);
      setAssets(a || []);
      setMembers(m || []);
      setHistory(h || []);
      setLoading(false);
    };
    fetchAll();
  }, []);

  // ── assets 변경 시 Supabase 동기화 ──
  const updateAssets = async (newAssets) => {
    setAssets(newAssets);
    const prev = assets;
    // 추가된 항목
    const added = newAssets.filter(n => !prev.find(p => p.id === n.id));
    // 삭제된 항목
    const removed = prev.filter(p => !newAssets.find(n => n.id === p.id));
    // 수정된 항목
    const updated = newAssets.filter(n => {
      const old = prev.find(p => p.id === n.id);
      return old && JSON.stringify(old) !== JSON.stringify(n);
    });
    if (added.length)   await supabase.from("assets").insert(added);
    if (removed.length) await supabase.from("assets").delete().in("id", removed.map(r => r.id));
    if (updated.length) await Promise.all(updated.map(u => supabase.from("assets").update(u).eq("id", u.id)));
  };

  // ── members 변경 시 Supabase 동기화 ──
  const updateMembers = async (newMembers) => {
    setMembers(newMembers);
    const prev = members;
    const added   = newMembers.filter(n => !prev.find(p => p.id === n.id));
    const removed = prev.filter(p => !newMembers.find(n => n.id === p.id));
    const updated = newMembers.filter(n => {
      const old = prev.find(p => p.id === n.id);
      return old && JSON.stringify(old) !== JSON.stringify(n);
    });
    if (added.length)   await supabase.from("members").insert(added);
    if (removed.length) await supabase.from("members").delete().in("id", removed.map(r => r.id));
    if (updated.length) await Promise.all(updated.map(u => supabase.from("members").update(u).eq("id", u.id)));
  };

  // ── history 변경 시 Supabase 동기화 ──
  const updateHistory = async (newHistory) => {
    setHistory(newHistory);
    const prev = history;
    const added = typeof newHistory === "function"
      ? [] : newHistory.filter(n => !prev.find(p => p.id === n.id));
    if (added.length) await supabase.from("history").insert(added);
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

  return (
    <div style={{ display: "flex", height: "100vh", fontFamily: "'Pretendard', 'Apple SD Gothic Neo', sans-serif", background: C.bg }}>
      <aside style={{ width: 224, background: C.sidebar, display: "flex", flexDirection: "column", flexShrink: 0 }}>
        <div style={{ padding: "28px 20px 24px", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
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
        <div style={{ padding: "16px 20px", borderTop: "1px solid rgba(255,255,255,0.06)" }}>
          <p style={{ margin: 0, fontSize: 11, color: "rgba(255,255,255,0.2)" }}>DURAE Assets v1.0.0</p>
        </div>
      </aside>

      {page === "dashboard" && <Dashboard assets={assets} members={members} history={history} />}
      {page === "assets"    && <AssetPage assets={assets} setAssets={updateAssets} history={history} setHistory={updateHistory} />}
      {page === "members"   && <MemberPage members={members} setMembers={updateMembers} assets={assets} />}
      {page === "history"   && <HistoryPage history={history} />}
    </div>
  );
}