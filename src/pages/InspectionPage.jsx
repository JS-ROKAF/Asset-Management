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
import { C } from "../constants";
import { makeHistory } from "../utils/history";
import { displayDate, toKST } from "../utils/date";

export default function InspectionPage({ inspections, setInspections, inspectionItems, setInspectionItems, assets, setAssets, members, permission, userDept, currentUser }) {
  const [createOpen, setCreateOpen] = useState(false);
  const [selectedInspection, setSelectedInspection] = useState(null);
  const [form, setForm] = useState({ title: "", startDate: "", endDate: "", note: "" });

  // admin: 전체, manager/viewer: 자기 부서 관련 실사만
  const myItems = permission !== "admin"
    ? inspectionItems.filter(item => item.department === userDept)
    : inspectionItems;

  const createInspection = async () => {
    if (!form.title || !form.startDate) return;
    const newInspection = {
      title: form.title,
      status: "진행중",
      startDate: form.startDate,
      endDate: form.endDate || "-",
      createdBy: currentUser?.name || "관리자",
      note: form.note || "-",
    };
    const { data, error } = await supabase.from("inspections").insert(newInspection).select().single();
    if (error) { alert("실사 생성 실패: " + error.message); return; }

    // 전체 자산을 실사 항목으로 생성
    const items = assets.map(a => ({
      inspectionId: data.id,
      assetId: a.id,
      assetName: a.name,
      department: a.department || "-",
      assignedUser: a.user || "-",
      confirmedBy: "-",
      status: "미확인",
      note: "-",
      confirmedDate: "-",
    }));
    const { error: itemError } = await supabase.from("inspection_items").insert(items);
    if (itemError) { alert("실사 항목 생성 실패: " + itemError.message); return; }

    setInspections([data, ...inspections]);
    setInspectionItems([...inspectionItems, ...items]);
    setCreateOpen(false);
    setForm({ title: "", startDate: "", endDate: "", note: "" });
    alert(`실사가 생성되었습니다. 총 ${items.length}개 자산이 등록되었습니다.`);
  };

  const confirmItem = async (item, status, note = "") => {
    const updated = {
      ...item,
      status,
      confirmedBy: currentUser?.name || "-",
      confirmedDate: toKST(),
      note: note || item.note,
    };
    const { error } = await supabase.from("inspection_items").update(updated).eq("id", item.id);
    if (error) { alert("확인 실패: " + error.message); return; }
    setInspectionItems(inspectionItems.map(i => i.id === item.id ? updated : i));
  };

  const closeInspection = async (inspection) => {
    if (!window.confirm("실사를 완료 처리할까요?\n'없음'으로 확인된 자산은 '미사용', '분실'로 확인된 자산은 '분실'로 자동 변경됩니다.")) return;

    const updated = { ...inspection, status: "완료" };
    const { error } = await supabase.from("inspections").update(updated).eq("id", inspection.id);
    if (error) { alert("완료 처리 실패: " + error.message); return; }

    // 없음 → 미사용, 분실 → 분실 자동 반영
    const items = inspectionItems.filter(i => i.inspectionId === inspection.id);
    const histories = [];
    const updatedAssets = assets.map(a => {
      const item = items.find(i => i.assetId === a.id);
      if (!item) return a;
      if (item.status === "없음" && a.status !== "미사용") {
        histories.push(makeHistory("상태변경", a, a.user, a.user, "실사 결과: 없음 → 미사용 처리"));
        return { ...a, status: "미사용", user: "-" };
      }
      if (item.status === "분실" && a.status !== "분실") {
        histories.push(makeHistory("상태변경", a, a.user, a.user, "실사 결과: 분실 처리"));
        return { ...a, status: "분실", user: "-" };
      }
      return a;
    });

    if (histories.length > 0) {
      setAssets(updatedAssets, histories);
    }

    setInspections(inspections.map(i => i.id === inspection.id ? updated : i));
    setSelectedInspection(updated);
    alert(`실사가 완료되었습니다.${histories.length > 0 ? `\n${histories.length}개 자산의 상태가 변경되었습니다.` : ""}`);
  };

  const [inspectionFilter, setInspectionFilter] = useState("전체");
  const selectedItems = selectedInspection
    ? inspectionItems.filter(i => i.inspectionId === selectedInspection.id &&
        (permission === "admin" || i.department === userDept))
    : [];
  const filteredItems = inspectionFilter === "전체"
  ? selectedItems
  : selectedItems.filter(i => i.status === inspectionFilter);
  const confirmedCount = selectedItems.filter(i => i.status !== "미확인").length;
  const progressPct = selectedItems.length > 0 ? Math.round(confirmedCount / selectedItems.length * 100) : 0;

  return (
    <main style={{ flex: 1, padding: "36px 40px", overflowY: "auto" }}>
      <PageHeader title="정기 실사" subtitle="자산 보유 현황을 주기적으로 확인하세요"
        action={permission === "admin" && !selectedInspection
          ? <Btn onClick={() => setCreateOpen(true)}>+ 실사 생성</Btn>
          : selectedInspection ? <Btn variant="ghost" onClick={() => setSelectedInspection(null)}>← 목록으로</Btn>
          : null}
      />

      {/* 실사 목록 */}
      {!selectedInspection ? (
        <>
          <SummaryCards items={[
            { label: "전체 실사", value: inspections.length, color: C.primary },
            { label: "진행중", value: inspections.filter(i => i.status === "진행중").length, color: "#F97316" },
            { label: "완료", value: inspections.filter(i => i.status === "완료").length, color: "#10B981" },
          ]} />
          <div style={{ background: C.card, borderRadius: 12, boxShadow: "0 1px 4px rgba(0,0,0,0.06)", overflow: "hidden" }}>
            {inspections.length === 0
              ? <p style={{ padding: 40, textAlign: "center", fontSize: 14, color: "#CBD5E1", margin: 0 }}>실사 내역이 없습니다</p>
              : inspections.map((ins, i) => {
                const items = inspectionItems.filter(item => item.inspectionId === ins.id);
                const confirmed = items.filter(item => item.status !== "미확인").length;
                const pct = items.length > 0 ? Math.round(confirmed / items.length * 100) : 0;
                return (
                  <div key={ins.id} onClick={() => setSelectedInspection(ins)}
                    style={{ display: "flex", alignItems: "center", gap: 16, padding: "16px 20px",
                      borderBottom: i < inspections.length - 1 ? `1px solid ${C.bg}` : "none",
                      cursor: "pointer" }}
                    onMouseEnter={e => e.currentTarget.style.background = "#F8FAFC"}
                    onMouseLeave={e => e.currentTarget.style.background = "transparent"}>
                    <div style={{ flex: 1 }}>
                      <p style={{ margin: 0, fontSize: 14, fontWeight: 600, color: C.text }}>{ins.title}</p>
                      <p style={{ margin: "2px 0 0", fontSize: 12, color: C.textMuted }}>
                        {ins.startDate} ~ {ins.endDate !== "-" ? ins.endDate : "진행중"} · 생성: {ins.createdBy}
                      </p>
                    </div>
                    <div style={{ textAlign: "right" }}>
                      <span style={{ fontSize: 12, color: C.textMuted }}>{confirmed}/{items.length} ({pct}%)</span>
                      <div style={{ width: 80, height: 4, background: C.bg, borderRadius: 99, marginTop: 4 }}>
                        <div style={{ width: `${pct}%`, height: "100%", background: pct === 100 ? "#10B981" : C.primary, borderRadius: 99 }} />
                      </div>
                    </div>
                    <span style={{ fontSize: 12, fontWeight: 600, padding: "3px 10px", borderRadius: 99,
                      background: ins.status === "완료" ? "#D1FAE5" : "#FFF7ED",
                      color: ins.status === "완료" ? "#065F46" : "#C2410C" }}>
                      {ins.status}
                    </span>
                    {permission === "admin" && (
                      <button onClick={async (e) => {
                        e.stopPropagation();
                        if (!window.confirm(`'${ins.title}' 실사를 삭제할까요?\n관련 실사 항목도 모두 삭제됩니다.`)) return;
                        await supabase.from("inspection_items").delete().eq("inspectionId", ins.id);
                        const { error } = await supabase.from("inspections").delete().eq("id", ins.id);
                        if (error) { alert("삭제 실패: " + error.message); return; }
                        setInspections(inspections.filter(i => i.id !== ins.id));
                        setInspectionItems(inspectionItems.filter(i => i.inspectionId !== ins.id));
                      }}
                        style={{ background: C.dangerBg, color: C.danger, border: "none", padding: "4px 10px", borderRadius: 6, fontSize: 12, fontWeight: 600, cursor: "pointer" }}>
                        삭제
                      </button>
                    )}
                  </div>
                );
              })
            }
          </div>
        </>
      ) : (
        /* 실사 상세 */
        <>
          <div style={{ background: C.card, borderRadius: 12, padding: 20, marginBottom: 20, boxShadow: "0 1px 4px rgba(0,0,0,0.06)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div>
                <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: C.text }}>{selectedInspection.title}</h2>
                <p style={{ margin: "4px 0 0", fontSize: 13, color: C.textMuted }}>
                  {selectedInspection.startDate} ~ {selectedInspection.endDate !== "-" ? selectedInspection.endDate : "진행중"}
                </p>
              </div>
              <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                <span style={{ fontSize: 13, color: C.textMuted }}>{confirmedCount}/{selectedItems.length} 확인 ({progressPct}%)</span>
                {permission === "admin" && selectedInspection.status === "진행중" && (
                  <Btn small variant="ghost" onClick={() => closeInspection(selectedInspection)}>실사 완료</Btn>
                )}
              </div>
            </div>
            {/* 진행률 바 */}
            <div style={{ width: "100%", height: 6, background: C.bg, borderRadius: 99, marginTop: 12 }}>
              <div style={{ width: `${progressPct}%`, height: "100%", background: progressPct === 100 ? "#10B981" : C.primary, borderRadius: 99, transition: "width 0.3s" }} />
            </div>
          </div>

          {/* 필터 */}
          <div style={{ display: "flex", gap: 10, marginBottom: 16 }}>
            {["전체", "미확인", "보유중", "없음", "분실"].map(s => (
              <button key={s} onClick={() => setInspectionFilter(s)}
                style={{ padding: "8px 16px", borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: "pointer",
                  border: `1px solid ${C.border}`,
                  background: inspectionFilter === s ? C.primary : C.card,
                  color: inspectionFilter === s ? "#fff" : C.textMuted, transition: "all 0.15s" }}>
                {s}
              </button>
            ))}
          </div>

          {/* 실사 항목 목록 */}
          <div style={{ background: C.card, borderRadius: 12, boxShadow: "0 1px 4px rgba(0,0,0,0.06)", overflow: "hidden" }}>
            {filteredItems.length === 0
              ? <p style={{ padding: 40, textAlign: "center", fontSize: 14, color: "#CBD5E1", margin: 0 }}>항목이 없습니다</p>
              : filteredItems.map((item, i) => (
                <div key={item.id} style={{ display: "flex", alignItems: "center", gap: 16, padding: "10px 12px",
                  borderBottom: i < selectedItems.length - 1 ? `1px solid ${C.bg}` : "none" }}>
                  <div style={{ flex: 1 }}>
                    <p style={{ margin: 0, fontSize: 14, fontWeight: 600, color: C.text }}>{item.assetName}</p>
                    <p style={{ margin: "2px 0 0", fontSize: 12, color: C.textMuted }}>
                      {item.department} · {displayUser(item.assignedUser)}
                      {item.confirmedBy !== "-" && ` · 확인: ${item.confirmedBy} (${item.confirmedDate?.slice(0, 10)})`}
                    </p>
                  </div>
                  <span style={{ fontSize: 12, fontWeight: 600, padding: "3px 10px", borderRadius: 99,
                    background: item.status === "보유중" ? "#D1FAE5" : item.status === "없음" ? "#FEE2E2" : item.status === "분실" ? "#FFF7ED" : "#F1F5F9",
                    color: item.status === "보유중" ? "#065F46" : item.status === "없음" ? "#991B1B" : item.status === "분실" ? "#C2410C" : "#64748B" }}>
                    {item.status}
                  </span>
                  {selectedInspection.status === "진행중" && (
                    <div style={{ display: "flex", gap: 6 }}>
                      <Btn small onClick={() => confirmItem(item, "보유중")}>보유중</Btn>
                      <Btn small variant="ghost" onClick={() => confirmItem(item, "없음")}>없음</Btn>
                      <Btn small variant="danger" onClick={() => confirmItem(item, "분실")}>분실</Btn>
                    </div>
                  )}
                </div>
              ))
            }
          </div>

          {/* 결과 요약 */}
          {selectedItems.length > 0 && (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12, marginTop: 16 }}>
              {[
                { label: "전체", value: selectedItems.length, color: C.primary },
                { label: "보유중", value: selectedItems.filter(i => i.status === "보유중").length, color: "#10B981" },
                { label: "없음", value: selectedItems.filter(i => i.status === "없음").length, color: C.danger },
                { label: "분실", value: selectedItems.filter(i => i.status === "분실").length, color: "#F97316" },
              ].map(({ label, value, color }) => (
                <div key={label} style={{ background: C.card, borderRadius: 12, padding: "16px 20px", boxShadow: "0 1px 4px rgba(0,0,0,0.06)", textAlign: "center" }}>
                  <p style={{ margin: 0, fontSize: 12, color: C.textLight }}>{label}</p>
                  <p style={{ margin: "6px 0 0", fontSize: 24, fontWeight: 700, color }}>{value}</p>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {/* 실사 생성 모달 */}
      {createOpen && (
        <Modal title="실사 생성" onClose={() => setCreateOpen(false)}>
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <InputField label="실사명 *" value={form.title} onChange={v => setForm({ ...form, title: v })} placeholder="예: 2025년 1분기 정기 실사" />
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <InputField label="시작일 *" value={form.startDate} type="date" onChange={v => setForm({ ...form, startDate: v })} />
              <InputField label="종료일" value={form.endDate} type="date" onChange={v => setForm({ ...form, endDate: v })} />
            </div>
            <InputField label="비고" value={form.note} onChange={v => setForm({ ...form, note: v })} placeholder="실사 관련 메모" />
            <div style={{ background: "#EFF6FF", borderRadius: 8, padding: "10px 14px", fontSize: 13, color: "#1D4ED8" }}>
              ℹ️ 실사 생성 시 현재 등록된 전체 자산 {assets.length}개가 실사 항목으로 자동 등록됩니다.
            </div>
            <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 8 }}>
              <Btn variant="ghost" onClick={() => setCreateOpen(false)}>취소</Btn>
              <Btn onClick={createInspection}>생성</Btn>
            </div>
          </div>
        </Modal>
      )}
    </main>
  );
}