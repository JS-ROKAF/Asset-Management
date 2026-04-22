import React, { useState, useEffect, useRef } from "react";
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
import { 
  STATUS_OPTIONS,
  STATUS_COLORS,
  HISTORY_STYLES,
  HISTORY_TYPES,
  ROLES,
  DEPARTMENTS,
  C
  } from "../constants";

import { displayDate } from "../utils/date";

// ── 대시보드 ──
export default function Dashboard({ assets, members, history, permission, userDept, onNavigate }) {

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

  const today = new Date();
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

  // warrantyExpiry 계산 로직 아래에 추가
  const totalCost = filteredAssets.reduce((sum, a) => {
    const cost = Number(a.purchaseCost);
    return sum + (isNaN(cost) ? 0 : cost);
  }, 0);

  const deptCostData = DEPARTMENTS.map(dept => ({
    name: dept,
    금액: filteredAssets
      .filter(a => a.department === dept)
      .reduce((sum, a) => {
        const cost = Number(a.purchaseCost);
        return sum + (isNaN(cost) ? 0 : cost);
      }, 0),
  }));

  const recentHistory = filteredHistory
    .filter(h => ["배정", "반납", "입고"].includes(h.type))
    .slice(0, 10);

  return (
    <main style={{ flex: 1, padding: "20px 28px", overflowY: "auto", display: "flex", flexDirection: "column", gap: 14 }}>
      
      {/* 상단: PageHeader + 엑셀 버튼 */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div>
          <h1 style={{ fontSize: 20, fontWeight: 700, color: C.text, margin: 0 }}>대시보드</h1>
          <p style={{ fontSize: 12, color: C.textLight, marginTop: 2, marginBottom: 0 }}>전체 현황을 한눈에 확인하세요</p>
        </div>
        <button
          onClick={() => exportToExcel(filteredAssets, filteredMembers, filteredHistory)}
          style={{ background: "#10B981", color: "#fff", border: "none", padding: "8px 16px", borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: "pointer", display: "flex", alignItems: "center", gap: 6 }}
          onMouseEnter={e => e.currentTarget.style.opacity = "0.85"}
          onMouseLeave={e => e.currentTarget.style.opacity = "1"}
        >
          ⬇ 엑셀 내보내기
        </button>
      </div>

      {/* SummaryCards — 7개 */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 10 }}>
        {[
          { label: "전체 자산", value: filteredAssets.length, color: C.primary },
          { label: "사용중", value: filteredAssets.filter(a => a.status === "사용중").length, color: "#10B981" },
          { label: "미사용", value: filteredAssets.filter(a => a.status === "미사용").length, color: C.textMuted },
          { label: "수리중", value: filteredAssets.filter(a => a.status === "수리중").length, color: C.danger },
          { label: "분실", value: filteredAssets.filter(a => a.status === "분실").length, color: "#F97316" },
          { label: "총 자산금액", value: `${(totalCost / 10000).toFixed(0)}만원`, color: "#0EA5E9" },
          { label: "전체 구성원", value: filteredMembers.length, color: C.purple },
        ].map(({ label, value, color }) => (
          <div key={label} style={{ background: C.card, borderRadius: 10, padding: "12px 16px", boxShadow: "0 1px 4px rgba(0,0,0,0.06)" }}>
            <p style={{ margin: 0, fontSize: 11, color: C.textLight, fontWeight: 500 }}>{label}</p>
            <p style={{ margin: "4px 0 0", fontSize: 20, fontWeight: 700, color }}>{value}</p>
          </div>
        ))}
      </div>

      {/* 메인 2단 레이아웃 */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, flex: 1, minHeight: 0 }}>

        {/* 왼쪽 컬럼 */}
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>

          {/* 차트 2개 — 가로 2열 */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
            {/* 자산 상태별 파이차트 */}
            <div style={{ background: C.card, borderRadius: 12, padding: "16px 20px", boxShadow: "0 1px 4px rgba(0,0,0,0.06)" }}>
              <h3 style={{ margin: "0 0 8px", fontSize: 13, fontWeight: 700, color: C.text }}>자산 상태별 현황</h3>
              <ResponsiveContainer width="100%" height={130}>
                <PieChart>
                  <Pie data={statusData} cx="50%" cy="50%" innerRadius={35} outerRadius={58} paddingAngle={3} dataKey="value">
                    {statusData.map(entry => <Cell key={entry.name} fill={STATUS_COLORS[entry.name]} />)}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
              <div style={{ display: "flex", justifyContent: "center", gap: 10, marginTop: 4, flexWrap: "wrap" }}>
                {statusData.map(({ name }) => (
                  <div key={name} style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 11, color: C.textMuted }}>
                    <div style={{ width: 6, height: 6, borderRadius: "50%", background: STATUS_COLORS[name] }} />
                    {name}
                  </div>
                ))}
              </div>
            </div>

            {/* 부서별 구성원 현황 */}
            <div style={{ background: C.card, borderRadius: 12, padding: "16px 20px", boxShadow: "0 1px 4px rgba(0,0,0,0.06)" }}>
              <h3 style={{ margin: "0 0 8px", fontSize: 13, fontWeight: 700, color: C.text }}>부서별 구성원 현황</h3>
              <ResponsiveContainer width="100%" height={150}>
                <BarChart data={deptMemberData} barSize={14}>
                  <XAxis dataKey="name" tick={{ fontSize: 9, fill: C.textLight }} axisLine={false} tickLine={false} />
                  <YAxis allowDecimals={false} tick={{ fontSize: 10, fill: C.textLight }} axisLine={false} tickLine={false} />
                  <Tooltip cursor={{ fill: "#F1F5F9" }} />
                  <Bar dataKey="value" fill={C.purple} radius={[4, 4, 0, 0]} name="구성원 수" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* 부서별 자산 현황 */}
          <div style={{ background: C.card, borderRadius: 12, padding: "16px 20px", boxShadow: "0 1px 4px rgba(0,0,0,0.06)" }}>
            <h3 style={{ margin: "0 0 8px", fontSize: 13, fontWeight: 700, color: C.text }}>부서별 자산 현황</h3>
            <ResponsiveContainer width="100%" height={130}>
              <BarChart data={deptAssetData} barSize={16}>
                <XAxis dataKey="name" tick={{ fontSize: 9, fill: C.textLight }} axisLine={false} tickLine={false} />
                <YAxis allowDecimals={false} tick={{ fontSize: 10, fill: C.textLight }} axisLine={false} tickLine={false} />
                <Tooltip cursor={{ fill: "#F1F5F9" }} />
                <Bar dataKey="사용중" stackId="a" fill="#10B981" name="사용중" />
                <Bar dataKey="미사용" stackId="a" fill="#94A3B8" name="미사용" />
                <Bar dataKey="수리중" stackId="a" fill="#EF4444" radius={[4, 4, 0, 0]} name="수리중" />
              </BarChart>
            </ResponsiveContainer>
            <div style={{ display: "flex", justifyContent: "center", gap: 12, marginTop: 4 }}>
              {[{ name: "사용중", color: "#10B981" }, { name: "미사용", color: "#94A3B8" }, { name: "수리중", color: "#EF4444" }].map(({ name, color }) => (
                <div key={name} style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 11, color: C.textMuted }}>
                  <div style={{ width: 6, height: 6, borderRadius: "50%", background: color }} />
                  {name}
                </div>
              ))}
            </div>
          </div>

          {/* 부서별 자산금액 */}
          <div style={{ background: C.card, borderRadius: 12, padding: "16px 20px", boxShadow: "0 1px 4px rgba(0,0,0,0.06)" }}>
            <h3 style={{ margin: "0 0 8px", fontSize: 13, fontWeight: 700, color: C.text }}>부서별 자산 금액</h3>
            <ResponsiveContainer width="100%" height={130}>
              <BarChart data={deptCostData} barSize={20}>
                <XAxis dataKey="name" tick={{ fontSize: 9, fill: C.textLight }} axisLine={false} tickLine={false} />
                <YAxis allowDecimals={false} tick={{ fontSize: 10, fill: C.textLight }} axisLine={false} tickLine={false}
                  tickFormatter={v => v >= 1000000 ? `${(v / 1000000).toFixed(0)}백만` : v >= 10000 ? `${(v / 10000).toFixed(0)}만` : v} />
                <Tooltip formatter={(value) => [`${value.toLocaleString()}원`, "자산금액"]} cursor={{ fill: "#F1F5F9" }} />
                <Bar dataKey="금액" fill="#0EA5E9" radius={[4, 4, 0, 0]} name="자산금액" />
              </BarChart>
            </ResponsiveContainer>
          </div>

        </div>

        {/* 오른쪽 컬럼 */}
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>

          {/* 알림 섹션 — 보증만료 + 주의필요 통합 */}
          <div style={{ background: C.card, borderRadius: 12, padding: "16px 20px", boxShadow: "0 1px 4px rgba(0,0,0,0.06)" }}>
            <h3 style={{ margin: "0 0 10px", fontSize: 13, fontWeight: 700, color: C.text }}>⚠️ 알림</h3>
            {expiredAssets.length === 0 && warningAssets.length === 0 &&
            filteredAssets.filter(a => a.status === "수리중" || a.status === "분실").length === 0 ? (
              <p style={{ margin: 0, fontSize: 12, color: C.textLight }}>주의가 필요한 자산이 없습니다 ✅</p>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 6, maxHeight: 160, overflowY: "auto" }}>
                {/* 보증 만료 */}
                {expiredAssets.slice(0, 3).map(a => (
                  <div key={a.id} onClick={() => onNavigate("assets", a.id)}
                    style={{ display: "flex", alignItems: "center", gap: 10, padding: "6px 10px", background: "#FEF2F2", borderRadius: 8, cursor: "pointer" }}
                    onMouseEnter={e => e.currentTarget.style.opacity = "0.8"}
                    onMouseLeave={e => e.currentTarget.style.opacity = "1"}>
                    <span style={{ fontSize: 11, fontWeight: 700, color: C.danger, background: "#FEE2E2", padding: "2px 6px", borderRadius: 4 }}>만료</span>
                    <span style={{ fontSize: 12, color: C.text, fontWeight: 500, flex: 1 }}>{a.name}</span>
                    <span style={{ fontSize: 11, color: C.danger }}>{a.warrantyExpiry.slice(0, 10)}</span>
                  </div>
                ))}
                {warningAssets.slice(0, 3).map(a => (
                  <div key={a.id} onClick={() => onNavigate("assets", a.id)}
                    style={{ display: "flex", alignItems: "center", gap: 10, padding: "6px 10px", background: "#FFF7ED", borderRadius: 8, cursor: "pointer" }}
                    onMouseEnter={e => e.currentTarget.style.opacity = "0.8"}
                    onMouseLeave={e => e.currentTarget.style.opacity = "1"}>
                    <span style={{ fontSize: 11, fontWeight: 700, color: "#F97316", background: "#FFEDD5", padding: "2px 6px", borderRadius: 4 }}>임박</span>
                    <span style={{ fontSize: 12, color: C.text, fontWeight: 500, flex: 1 }}>{a.name}</span>
                    <span style={{ fontSize: 11, color: "#F97316" }}>{a.warrantyExpiry.slice(0, 10)}</span>
                  </div>
                ))}
                {/* 수리중/분실 */}
                {filteredAssets.filter(a => a.status === "수리중" || a.status === "분실").slice(0, 3).map(a => (
                  <div key={a.id} onClick={() => onNavigate("assets", a.id)}
                    style={{ display: "flex", alignItems: "center", gap: 10, padding: "6px 10px", background: a.status === "분실" ? "#FFF7ED" : "#FEF2F2", borderRadius: 8, cursor: "pointer" }}
                    onMouseEnter={e => e.currentTarget.style.opacity = "0.8"}
                    onMouseLeave={e => e.currentTarget.style.opacity = "1"}>
                    <StatusBadge status={a.status} />
                    <span style={{ fontSize: 12, color: C.text, fontWeight: 500, flex: 1 }}>{a.name}</span>
                    <span style={{ fontSize: 11, color: C.textMuted }}>{a.department || "-"}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* 최근 배정/반납 이력 — 5개로 제한 */}
          <div style={{ background: C.card, borderRadius: 12, padding: "16px 20px", boxShadow: "0 1px 4px rgba(0,0,0,0.06)", flex: 1 }}>
            <h3 style={{ margin: "0 0 10px", fontSize: 13, fontWeight: 700, color: C.text }}>최근 배정/반납 이력</h3>
            {recentHistory.length === 0
              ? <p style={{ margin: 0, fontSize: 12, color: C.textLight }}>이력 없음</p>
              : recentHistory.slice(0, 8).map(h => (
                <div key={h.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "7px 0", borderBottom: `1px solid ${C.bg}` }}>
                  <HistoryBadge type={h.type} />
                  <span style={{ fontSize: 13, color: C.text, fontWeight: 500, flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{h.assetName}</span>
                  <span style={{ fontSize: 12, color: C.textMuted, whiteSpace: "nowrap" }}>{displayUser(h.from)} → {displayUser(h.to)}</span>
                  <span style={{ fontSize: 11, color: C.textLight, whiteSpace: "nowrap" }}>{displayDate(h.date)}</span>
                </div>
              ))
            }
          </div>

        </div>
      </div>
    </main>
  );
}