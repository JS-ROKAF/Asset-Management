import React, { useState, useEffect } from "react";
import {
  PieChart, Pie, Cell, Tooltip,
  BarChart, Bar, XAxis, YAxis, ResponsiveContainer
} from "recharts";
import { exportToExcel } from "../utils/exportExcel";
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
import { STATUS_OPTIONS, STATUS_COLORS, C } from "../constants";
import { displayDate } from "../utils/date";
import { api } from "../api";

// ── 백엔드 모니터링 훅 ──
function useBackendMonitor(permission) {
  const [connStatus, setConnStatus] = useState("확인중"); // "정상" | "불안정" | "끊김" | "확인중"
  const [latency, setLatency] = useState(null);           // ms
  const [lastSynced, setLastSynced] = useState(null);     // Date
  const [tableCounts, setTableCounts] = useState(null);   // admin 전용
  const [latencyHistory, setLatencyHistory] = useState([]); // 최근 10회 응답속도

  // ── 연결 상태 + 응답속도 체크 ──
  const checkConnection = async () => {
    const start = Date.now();
    try {
      await api.health();
      const ms = Date.now() - start;
      setConnStatus("정상");
      setLatency(ms);
      setLastSynced(new Date());
      setLatencyHistory(prev => [...prev.slice(-9), ms]);
    } catch {
      setConnStatus("끊김");
      setLatency(null);
    }
  };

  // ── 테이블별 레코드 수 (admin 전용) ──
  const fetchTableCounts = async () => {
    try {
      const data = await api.tableCounts();
      setTableCounts(Object.values(data));
    } catch {
      setTableCounts(null);
    }
  };

  // ── 최초 + 주기적 체크 ──
  useEffect(() => {
    checkConnection();
    if (permission === "admin") fetchTableCounts();

    // 30초마다 갱신
    const interval = setInterval(() => {
      checkConnection();
      if (permission === "admin") fetchTableCounts();
    }, 30000);

    return () => clearInterval(interval);
  }, [permission]);

  return {
    connStatus,
    latency,
    lastSynced,
    tableCounts,
    latencyHistory,
    refresh: () => {
      checkConnection();
      if (permission === "admin") fetchTableCounts();
    },
  };
}

// ── 상태 색상 헬퍼 ──
function statusColor(status) {
  if (status === "정상" || status === "연결됨") return "#10B981";
  if (status === "불안정" || status === "연결중") return "#F59E0B";
  if (status === "끊김") return "#EF4444";
  return "#94A3B8";
}

function statusBg(status) {
  if (status === "정상" || status === "연결됨") return "rgba(16,185,129,0.08)";
  if (status === "불안정" || status === "연결중") return "rgba(245,158,11,0.08)";
  if (status === "끊김") return "rgba(239,68,68,0.08)";
  return "rgba(148,163,184,0.08)";
}

// ── 응답속도 미니 스파크라인 ──
function LatencySparkline({ data }) {
  if (!data || data.length < 2) return null;
  const max = Math.max(...data, 1);
  const w = 80, h = 28;
  const pts = data.map((v, i) => {
    const x = (i / (data.length - 1)) * w;
    const y = h - (v / max) * h;
    return `${x},${y}`;
  }).join(" ");

  return (
    <svg width={w} height={h} style={{ display: "block" }}>
      <polyline
        points={pts}
        fill="none"
        stroke="#3B82F6"
        strokeWidth="1.5"
        strokeLinejoin="round"
        strokeLinecap="round"
      />
      {/* 마지막 점 */}
      {(() => {
        const last = data[data.length - 1];
        const x = w;
        const y = h - (last / max) * h;
        return <circle cx={x} cy={y} r="2.5" fill="#3B82F6" />;
      })()}
    </svg>
  );
}

// ── 백엔드 모니터링 섹션 컴포넌트 ──
function BackendMonitor({ permission, history }) {
  const {
    connStatus,
    latency,
    lastSynced,
    tableCounts,
    latencyHistory,
    refresh,
  } = useBackendMonitor(permission);

  const isAdmin = permission === "admin";

  // 오늘 이력 건수 (history prop에서 직접 계산)
  const todayStr = new Date().toISOString().slice(0, 10);
  const todayHistoryCount = history.filter(h =>
    h.date && h.date.slice(0, 10) === todayStr
  ).length;

  return (
    <div style={{ background: C.card, borderRadius: 12, padding: "16px 20px", boxShadow: "0 1px 4px rgba(0,0,0,0.06)" }}>
      
      {/* 헤더 */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <h3 style={{ margin: 0, fontSize: 13, fontWeight: 700, color: C.text }}>
            백엔드 연동 현황
          </h3>
          {/* 전체 상태 표시 */}
          <span style={{
            fontSize: 11, fontWeight: 600,
            color: statusColor(connStatus),
            background: statusBg(connStatus),
            padding: "2px 8px", borderRadius: 99,
          }}>
            {connStatus}
          </span>
        </div>
        <button
          onClick={refresh}
          style={{
            fontSize: 11, color: C.primary, background: "rgba(59,130,246,0.08)",
            border: "none", borderRadius: 6, padding: "4px 10px", cursor: "pointer", fontWeight: 600,
          }}
          title="수동 갱신 (자동: 30초마다)"
        >
          ↺ 갱신
        </button>
      </div>

      {/* ── 공통 지표 (모든 권한) ── */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 10, marginBottom: isAdmin ? 14 : 0 }}>
        
        {/* DB 연결 상태 */}
        <div style={{ background: statusBg(connStatus), borderRadius: 10, padding: "10px 14px" }}>
          <p style={{ margin: 0, fontSize: 10, color: C.textLight, fontWeight: 500 }}>DB 연결</p>
          <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 4 }}>
            <div style={{
              width: 8, height: 8, borderRadius: "50%",
              background: statusColor(connStatus),
              boxShadow: connStatus === "정상" ? `0 0 6px ${statusColor(connStatus)}` : "none",
              animation: connStatus === "확인중" ? "pulse 1s infinite" : "none",
            }} />
            <span style={{ fontSize: 15, fontWeight: 700, color: statusColor(connStatus) }}>
              {connStatus}
            </span>
          </div>
        </div>

        {/* 응답 지연시간 */}
        <div style={{ background: "rgba(59,130,246,0.06)", borderRadius: 10, padding: "10px 14px" }}>
          <p style={{ margin: 0, fontSize: 10, color: C.textLight, fontWeight: 500 }}>응답 속도</p>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 4 }}>
            <span style={{ fontSize: 15, fontWeight: 700, color: C.primary }}>
              {latency !== null ? `${latency}ms` : "-"}
            </span>
            <LatencySparkline data={latencyHistory} />
          </div>
        </div>

        {/* 마지막 동기화 */}
        <div style={{ background: "rgba(16,185,129,0.06)", borderRadius: 10, padding: "10px 14px" }}>
          <p style={{ margin: 0, fontSize: 10, color: C.textLight, fontWeight: 500 }}>마지막 동기화</p>
          <p style={{ margin: "4px 0 0", fontSize: 13, fontWeight: 700, color: "#10B981" }}>
            {lastSynced
              ? lastSynced.toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit", second: "2-digit" })
              : "-"}
          </p>
        </div>
      </div>

      {/* ── admin 전용 상세 지표 ── */}
      {isAdmin && (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
          
          {/* 테이블별 레코드 수 */}
          <div style={{ background: C.bg, borderRadius: 10, padding: "12px 14px" }}>
            <p style={{ margin: "0 0 8px", fontSize: 11, fontWeight: 700, color: C.text }}>테이블별 레코드 수</p>
            {tableCounts ? (
              <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
                {tableCounts.map(({ label, count }) => (
                  <div key={label} style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <span style={{ fontSize: 11, color: C.textMuted }}>{label}</span>
                    <span style={{ fontSize: 12, fontWeight: 700, color: C.text }}>{typeof count === "number" ? count.toLocaleString() : count}</span>
                  </div>
                ))}
              </div>
            ) : (
              <p style={{ margin: 0, fontSize: 11, color: C.textLight }}>불러오는 중...</p>
            )}
          </div>

          {/* 오늘 활동 + 자동갱신 안내 */}
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {/* 오늘 이벤트 */}
            <div style={{ background: C.bg, borderRadius: 10, padding: "12px 14px", flex: 1 }}>
              <p style={{ margin: "0 0 6px", fontSize: 11, fontWeight: 700, color: C.text }}>오늘 발생 이벤트</p>
              <div style={{ display: "flex", alignItems: "baseline", gap: 4 }}>
                <span style={{ fontSize: 24, fontWeight: 700, color: C.primary }}>
                  {todayHistoryCount}
                </span>
                <span style={{ fontSize: 11, color: C.textMuted }}>건</span>
              </div>
              <p style={{ margin: "4px 0 0", fontSize: 10, color: C.textLight }}>자산 배정·반납·수정 등 전체</p>
            </div>

            {/* 자동 갱신 안내 */}
            <div style={{ background: C.bg, borderRadius: 10, padding: "12px 14px" }}>
              <p style={{ margin: "0 0 4px", fontSize: 11, fontWeight: 700, color: C.text }}>자동 갱신</p>
              <p style={{ margin: 0, fontSize: 11, color: C.textMuted }}>30초마다 자동 갱신</p>
              <p style={{ margin: "2px 0 0", fontSize: 10, color: C.textLight }}>
                다음 갱신: {lastSynced
                  ? new Date(lastSynced.getTime() + 30000).toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit", second: "2-digit" })
                  : "-"}
              </p>
            </div>
          </div>
        </div>
      )}

      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.3; }
        }
      `}</style>
    </div>
  );
}

// 차트 툴팁 — 컴포넌트 밖에 선언 (렌더마다 재생성되면 state 초기화)
function CustomTooltip ({ active, payload, label }) {
  if (!(active && payload && payload.length)) return null;
  return (
    <div style={{
      backgroundColor: "rgba(255, 255, 255, 0.95)",
      borderRadius: "10px",
      padding: "12px 16px",
      boxShadow: "0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)",
      backdropFilter: "blur(4px)",
      border: "1px solid rgba(226, 232, 240, 0.8)"
    }}>
      <p style={{ margin: "0 0 6px", fontWeight: 700, fontSize: "12px", color: "#1e293b" }}>{label}</p>
      <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
        {payload.map((entry, index) => (
          <div key={index} style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <div style={{ width: "8px", height: "8px", borderRadius: "50%", backgroundColor: entry.color || entry.fill }} />
            <span style={{ fontSize: "11px", color: "#64748b", fontWeight: 500 }}>{entry.name}:</span>
            <span style={{ fontSize: "11px", color: "#0f172a", fontWeight: 700 }}>
              {typeof entry.value === 'number' ? entry.value.toLocaleString() : entry.value}
              {entry.unit || (entry.name.includes("금액") ? "원" : "개")}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── 대시보드 ──
export default function Dashboard({ assets, members, history, departments, permission, userDept, onNavigate }) {

  // 폐기 자산은 집계·차트·엑셀에서 제외 (이력은 HistoryPage에 그대로 남음)
  const activeAssets = assets.filter(a => !a.isDisposed);
  const filteredAssets = permission === "admin" ? activeAssets : activeAssets.filter(a => a.departmentId === userDept);
  const activeMembers = members.filter(m => m.status === "재직");
  const filteredMembers = permission === "admin" ? activeMembers : activeMembers.filter(m => m.departmentId === userDept);
  // 차트 축: 자산이나 구성원이 있는 부서만 (부서 마스터가 많아져도 차트가 뭉개지지 않게)
  const deptLabel = (d) => `${d.corporation} ${d.name}`;
  const chartDepts = departments.filter(d =>
    filteredAssets.some(a => a.departmentId === d.id) || filteredMembers.some(m => m.departmentId === d.id));
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

  const deptAssetData = chartDepts.map(d => ({
    name: deptLabel(d),
    ...Object.fromEntries(STATUS_OPTIONS.map(s => [s, filteredAssets.filter(a => a.departmentId === d.id && a.status === s).length])),
  }));

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const thirtyDaysLater = new Date(today.getTime() + 30 * 24 * 60 * 60 * 1000);

  const warningAssets = filteredAssets.filter(a => {
    if (!a.warrantyExpiry || a.warrantyExpiry === "-") return false;
    const expiry = new Date(a.warrantyExpiry.slice(0, 10));
    return expiry <= thirtyDaysLater && expiry >= today;
  });

  const expiredAssets = filteredAssets.filter(a => {
    if (!a.warrantyExpiry || a.warrantyExpiry === "-") return false;
    const expiry = new Date(a.warrantyExpiry.slice(0, 10));
    return expiry < today;
  });

  const totalCost = filteredAssets.reduce((sum, a) => {
    const cost = Number(a.purchaseCost);
    return sum + (isNaN(cost) ? 0 : cost);
  }, 0);

  const deptCostData = chartDepts.map(d => ({
    name: deptLabel(d),
    금액: filteredAssets
      .filter(a => a.departmentId === d.id)
      .reduce((sum, a) => {
        const cost = Number(a.purchaseCost);
        return sum + (isNaN(cost) ? 0 : cost);
      }, 0),
  }));

  const recentHistory = filteredHistory
    .filter(h => ["배정", "반납", "입고", "이동"].includes(h.type))
    .slice(0, 10);

  return (
    <main style={{ 
      flex: 1, height: "100vh", display: "flex", flexDirection: "column", 
      gap: 14, padding: "20px 28px", boxSizing: "border-box", 
      overflow: "hidden", backgroundColor: C.bg 
    }}>
      
      {/* 상단 헤더 & SummaryCards (기존과 동일) */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexShrink: 0 }}>
        <div>
          <h1 style={{ fontSize: 20, fontWeight: 700, color: C.text, margin: 0 }}>대시보드</h1>
          <p style={{ fontSize: 12, color: C.textLight, marginTop: 2, marginBottom: 0 }}>전체 현황을 한눈에 확인하세요</p>
        </div>
        <button onClick={() => exportToExcel(filteredAssets, filteredMembers, filteredHistory)} style={{ background: "#10B981", color: "#fff", border: "none", padding: "8px 16px", borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: "pointer", display: "flex", alignItems: "center", gap: 6 }}>⬇ 엑셀 내보내기</button>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(9, 1fr)", gap: 10, flexShrink: 0 }}>
        {[
          { label: "전체 자산", value: filteredAssets.length, color: C.primary },
          // 미확인은 12/1까지 0건 목표 — 0이 아니면 강조, 누르면 자산 목록을 미확인 필터로
          ...STATUS_OPTIONS.map(s => ({
            label: s, value: filteredAssets.filter(a => a.status === s).length, color: STATUS_COLORS[s],
            onClick: () => onNavigate("assets", null, s),
          })),
          { label: "총 자산금액", value: `${totalCost.toLocaleString()}원`, color: "#0EA5E9" },
          { label: "재직 구성원", value: filteredMembers.length, color: C.purple },
        ].map(({ label, value, color, onClick }) => (
          <div key={label} onClick={onClick}
            style={{ background: label === "미확인" && value > 0 ? "#FAF5FF" : C.card, borderRadius: 10, padding: "12px 16px",
              boxShadow: label === "미확인" && value > 0 ? `0 0 0 2px ${color}` : "0 1px 4px rgba(0,0,0,0.06)",
              cursor: onClick ? "pointer" : "default" }}>
            <p style={{ margin: 0, fontSize: 11, color: C.textLight, fontWeight: 500 }}>{label}</p>
            <p style={{ margin: "4px 0 0", fontSize: 20, fontWeight: 700, color }}>{value}</p>
          </div>
        ))}
      </div>

      {/* 메인 레이아웃 */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, flex: 1, minHeight: 0 }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 14, minHeight: 0 }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, height: "48%" }}>
            <div style={{ background: C.card, borderRadius: 12, padding: "16px 20px", display: "flex", flexDirection: "column" }}>
              <h3 style={{ margin: "0 0 8px", fontSize: 13, fontWeight: 700 }}>자산 상태별 현황</h3>
              <div style={{ flex: 1, minHeight: 0 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={statusData} cx="50%" cy="50%" innerRadius={35} outerRadius={58} paddingAngle={3} dataKey="value">
                      {statusData.map(entry => <Cell key={entry.name} fill={STATUS_COLORS[entry.name]} />)}
                    </Pie>
                    <Tooltip content={<CustomTooltip />} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div style={{ display: "flex", justifyContent: "center", gap: 10, marginTop: 4 }}>
                {statusData.map(({ name }) => (
                  <div key={name} style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 11, color: C.textMuted }}>
                    <div style={{ width: 6, height: 6, borderRadius: "50%", background: STATUS_COLORS[name] }} />{name}
                  </div>
                ))}
              </div>
            </div>

            <div style={{ background: C.card, borderRadius: 12, padding: "16px 20px", display: "flex", flexDirection: "column" }}>
              <h3 style={{ margin: "0 0 8px", fontSize: 13, fontWeight: 700 }}>부서별 구성원 현황</h3>
              <div style={{ flex: 1, minHeight: 0 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={deptMemberData} barSize={14}>
                    <XAxis dataKey="name" tick={{ fontSize: 9 }} axisLine={false} tickLine={false} />
                    <YAxis allowDecimals={false} tick={{ fontSize: 10 }} axisLine={false} tickLine={false} />
                    <Tooltip content={<CustomTooltip />} cursor={{ fill: "#F1F5F9" }} />
                    <Bar dataKey="value" fill={C.purple} radius={[4, 4, 0, 0]} name="구성원 수" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>

          <div style={{ background: C.card, borderRadius: 12, padding: "16px 20px", flex: 1, display: "flex", flexDirection: "column" }}>
            <h3 style={{ margin: "0 0 8px", fontSize: 13, fontWeight: 700 }}>부서별 자산 현황</h3>
            <div style={{ flex: 1, minHeight: 0 }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={deptAssetData} barSize={16}>
                  <XAxis dataKey="name" tick={{ fontSize: 9 }} axisLine={false} tickLine={false} />
                  <YAxis allowDecimals={false} tick={{ fontSize: 10 }} axisLine={false} tickLine={false} />
                  <Tooltip content={<CustomTooltip />} cursor={{ fill: "#F1F5F9" }} />
                  {STATUS_OPTIONS.map(s => <Bar key={s} dataKey={s} stackId="a" fill={STATUS_COLORS[s]} name={s} />)}
                </BarChart>
              </ResponsiveContainer>
            </div>
            <div style={{ display: "flex", justifyContent: "center", gap: 12, marginTop: 4 }}>
              {STATUS_OPTIONS.map(name => ({ name, color: STATUS_COLORS[name] })).map(({ name, color }) => (
                <div key={name} style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 11, color: C.textMuted }}><div style={{ width: 6, height: 6, borderRadius: "50%", background: color }} />{name}</div>
              ))}
            </div>
          </div>

          <div style={{ background: C.card, borderRadius: 12, padding: "16px 20px", flex: 1, display: "flex", flexDirection: "column" }}>
            <h3 style={{ margin: "0 0 8px", fontSize: 13, fontWeight: 700 }}>부서별 자산 금액</h3>
            <div style={{ flex: 1, minHeight: 0 }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={deptCostData} barSize={20}>
                  <XAxis dataKey="name" tick={{ fontSize: 9 }} axisLine={false} tickLine={false} />
                  <YAxis allowDecimals={false} tick={{ fontSize: 10 }} axisLine={false} tickLine={false} tickFormatter={v => v >= 10000 ? `${(v / 10000).toFixed(0)}만` : v} />
                  <Tooltip content={<CustomTooltip />} cursor={{ fill: "#F1F5F9" }} />
                  <Bar dataKey="금액" fill="#0EA5E9" radius={[4, 4, 0, 0]} name="자산금액" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>

        {/* 오른쪽 컬럼 (기존 로직 유지) */}
        <div style={{ display: "flex", flexDirection: "column", gap: 14, minHeight: 0 }}>
          <div style={{ background: C.card, borderRadius: 12, padding: "16px 20px", flex: 1, display: "flex", flexDirection: "column", minHeight: 0 }}>
            <h3 style={{ margin: "0 0 10px", fontSize: 13, fontWeight: 700 }}>알림</h3>
            <div style={{ display: "flex", flexDirection: "column", gap: 6, flex: 1, overflowY: "auto" }}>
              {expiredAssets.map(a => (<div key={a.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "6px 10px", background: "#FEF2F2", borderRadius: 8 }}><span style={{ fontSize: 11, fontWeight: 700, color: C.danger, background: "#FEE2E2", padding: "2px 6px", borderRadius: 4 }}>만료</span><span style={{ fontSize: 12, flex: 1 }}>{a.id} {a.name}</span></div>))}
              {warningAssets.map(a => (<div key={a.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "6px 10px", background: "#FFF7ED", borderRadius: 8 }}><span style={{ fontSize: 11, fontWeight: 700, color: "#F97316", background: "#FFEDD5", padding: "2px 6px", borderRadius: 4 }}>임박</span><span style={{ fontSize: 12, flex: 1 }}>{a.id} {a.name}</span></div>))}
            </div>
          </div>

          <div style={{ background: C.card, borderRadius: 12, padding: "16px 20px", flex: 1, display: "flex", flexDirection: "column", minHeight: 0 }}>
            <h3 style={{ margin: "0 0 10px", fontSize: 13, fontWeight: 700 }}>최근 입고·배정·반납·이동</h3>
            <div style={{ flex: 1, overflowY: "auto" }}>
              {recentHistory.map(h => (<div key={h.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "7px 0", borderBottom: `1px solid ${C.bg}` }}><HistoryBadge type={h.type} /><span style={{ fontSize: 13, flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{h.assetId} {h.assetName !== h.assetId ? h.assetName : ""}</span><span style={{ fontSize: 11, color: C.textLight }}>{displayDate(h.date)}</span></div>))}
            </div>
          </div>
          <div style={{ flexShrink: 0 }}><BackendMonitor permission={permission} history={filteredHistory} /></div>
        </div>
      </div>
    </main>
  );
}