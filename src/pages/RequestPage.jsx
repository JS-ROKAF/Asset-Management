import React, { useState, useEffect, useRef } from "react";
import { supabase } from "../supabase";
import { updateAssets } from "../services/assetService";

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

export default function RequestPage({ requests, setRequests, assets, setAssets, setHistory, members, permission, userDept, currentUser }) {
  const [filterStatus, setFilterStatus] = useState("전체");
  const [resolveOpen, setResolveOpen] = useState(false);
  const [selectedReq, setSelectedReq] = useState(null);
  const [resolveNote, setResolveNote] = useState("");
  const [assignReqOpen, setAssignReqOpen] = useState(false);
  const [assignNote, setAssignNote] = useState("");
  const [assignTarget, setAssignTarget] = useState(null);

  // 부서장은 자기 부서 자산 요청만
  const visibleRequests = permission === "admin"
    ? requests
    : requests.filter(r => {
        const asset = assets.find(a => a.id === r.assetId);
        return asset?.department === userDept;
      });

  const filtered = visibleRequests.filter(r =>
    filterStatus === "전체" || r.status === filterStatus
  );

  const pendingCount = visibleRequests.filter(r => r.status === "대기중").length;

  const handleResolve = async (approve) => {
    if (!selectedReq) return;
    const updatedReq = {
      ...selectedReq,
      status: approve ? "승인" : "거절",
      resolvedNote: resolveNote || (approve ? "승인 처리" : "거절 처리"),
      resolvedDate: toKST(),
    };

    const { error } = await supabase.from("requests").update(updatedReq).eq("id", selectedReq.id);
    if (error) { alert("처리 실패: " + error.message); return; }

    if (approve && selectedReq.type === "반납요청") {
      const asset = assets.find(a => a.id === selectedReq.assetId);
      // ✅ 자산 없을 경우 알림 추가
      if (!asset) { alert("해당 자산을 찾을 수 없습니다. 자산이 삭제되었을 수 있어요."); return; }
      const updatedAsset = { ...asset, user: "-", status: "미사용" };
      const histories = [makeHistory("반납", asset, asset.user, "-", `요청 승인: ${resolveNote || "반납 처리"}`)];
      // ✅ updateAssetsWrapper로 이력까지 저장
      await setAssets(assets.map(a => a.id === asset.id ? updatedAsset : a), histories);
    } else if (approve && selectedReq.type === "배정요청") {
      const asset = assets.find(a => a.id === selectedReq.assetId);
      // ✅ 자산 없을 경우 알림 추가
      if (!asset) { alert("해당 자산을 찾을 수 없습니다. 자산이 삭제되었을 수 있어요."); return; }
      const updatedAsset = { ...asset, user: selectedReq.targetUser, status: "사용중" };
      const histories = [makeHistory("배정", asset, "-", selectedReq.targetUser, `요청 승인: ${resolveNote || "배정 처리"}`)];
      // ✅ updateAssetsWrapper로 이력까지 저장
      await setAssets(assets.map(a => a.id === asset.id ? updatedAsset : a), histories);
    }

    setRequests(requests.map(r => r.id === selectedReq.id ? updatedReq : r));
    setResolveOpen(false);
    setSelectedReq(null);
    setResolveNote("");
  };

  return (
    <main style={{ flex: 1, padding: "36px 40px", overflowY: "auto" }}>
      <PageHeader title="요청 관리" subtitle="자산 반납/배정 요청을 승인하거나 거절하세요" />
      {permission !== "admin" && (
        <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 16 }}>
          <Btn onClick={() => setAssignReqOpen(true)}>+ 배정 요청</Btn>
        </div>
      )}
      <SummaryCards items={[
        { label: "전체 요청", value: visibleRequests.length, color: C.primary },
        { label: "대기중", value: visibleRequests.filter(r => r.status === "대기중").length, color: "#F97316" },
        { label: "승인", value: visibleRequests.filter(r => r.status === "승인").length, color: "#10B981" },
        { label: "거절", value: visibleRequests.filter(r => r.status === "거절").length, color: C.danger },
      ]} />

      {/* 상태 필터 */}
      <div style={{ display: "flex", gap: 10, marginBottom: 16, flexWrap: "wrap" }}>
        {["전체", "대기중", "승인", "거절"].map(s => (
          <button key={s} onClick={() => setFilterStatus(s)}
            style={{ padding: "9px 16px", borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: "pointer",
              border: `1px solid ${C.border}`,
              background: filterStatus === s ? C.primary : C.card,
              color: filterStatus === s ? "#fff" : C.textMuted, transition: "all 0.15s" }}>
            {s}
          </button>
        ))}
      </div>

      {/* 요청 목록 */}
      <div style={{ background: C.card, borderRadius: 12, boxShadow: "0 1px 4px rgba(0,0,0,0.06)", overflow: "hidden" }}>
        {filtered.length === 0 ? (
          <p style={{ padding: 40, textAlign: "center", fontSize: 14, color: "#CBD5E1", margin: 0 }}>요청이 없습니다</p>
        ) : filtered.map((r, i) => (
          <div key={r.id} style={{ display: "flex", alignItems: "center", gap: 16, padding: "16px 20px",
            borderBottom: i < filtered.length - 1 ? `1px solid ${C.bg}` : "none",
            background: r.status === "대기중" ? "#FFFBEB" : "transparent" }}>
            <RequestBadge type={r.type} />
            <div style={{ flex: 1 }}>
              <p style={{ margin: 0, fontSize: 14, fontWeight: 600, color: C.text }}>{r.assetName}</p>
              <p style={{ margin: "2px 0 0", fontSize: 12, color: C.textMuted }}>
                요청자: {r.requesterName} · {displayDate(r.date)}
              </p>
              {r.note && r.note !== "-" && (
                <p style={{ margin: "2px 0 0", fontSize: 12, color: C.textLight }}>사유: {r.note}</p>
              )}
            </div>
            <RequestStatusBadge status={r.status} />
            {r.status === "대기중" && permission !== "viewer" && (
              <Btn small onClick={() => { setSelectedReq(r); setResolveOpen(true); }}>처리</Btn>
            )}
            {r.status !== "대기중" && r.resolvedNote && r.resolvedNote !== "-" && (
              <span style={{ fontSize: 12, color: C.textLight }}>처리사유: {r.resolvedNote}</span>
            )}
            {permission === "admin" && (
              <button onClick={async () => {
                if (!window.confirm("이 요청을 삭제할까요?")) return;
                const { error } = await supabase.from("requests").delete().eq("id", r.id);
                if (error) { alert("삭제 실패: " + error.message); return; }
                setRequests(requests.filter(req => req.id !== r.id));
              }}
                style={{ background: C.dangerBg, color: C.danger, border: "none", padding: "4px 10px", borderRadius: 6, fontSize: 12, fontWeight: 600, cursor: "pointer" }}>
                삭제
              </button>
            )}
          </div>
        ))}
      </div>

      {/* 처리 모달 */}
      {resolveOpen && selectedReq && (
        <Modal title="요청 처리" onClose={() => { setResolveOpen(false); setResolveNote(""); }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <div style={{ background: C.bg, borderRadius: 8, padding: 14 }}>
              <p style={{ margin: 0, fontSize: 13, color: C.textMuted }}>요청 유형</p>
              <p style={{ margin: "4px 0 0", fontSize: 15, fontWeight: 600, color: C.text }}>{selectedReq.type}</p>
              <p style={{ margin: "8px 0 0", fontSize: 13, color: C.textMuted }}>자산명</p>
              <p style={{ margin: "4px 0 0", fontSize: 15, fontWeight: 600, color: C.text }}>{selectedReq.assetName}</p>
              <p style={{ margin: "8px 0 0", fontSize: 13, color: C.textMuted }}>요청자</p>
              <p style={{ margin: "4px 0 0", fontSize: 14, color: C.text }}>{selectedReq.requesterName}</p>
            </div>
            <InputField
              label="처리 사유 (선택)"
              value={resolveNote}
              onChange={v => setResolveNote(v)}
              placeholder="승인/거절 사유를 입력하세요"
            />
            <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 8 }}>
              <Btn variant="ghost" onClick={() => { setResolveOpen(false); setResolveNote(""); }}>취소</Btn>
              <Btn variant="danger" onClick={() => handleResolve(false)}>거절</Btn>
              <Btn onClick={() => handleResolve(true)}>승인</Btn>
            </div>
          </div>
        </Modal>
      )}

      {/* 배정 요청 모달 */}
      {assignReqOpen && (
        <Modal title="배정 요청" onClose={() => { setAssignReqOpen(false); setAssignNote(""); setAssignTarget(null); }} wide>
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <p style={{ margin: 0, fontSize: 13, color: C.textMuted }}>배정받을 자산을 선택하세요.</p>
            <div style={{ maxHeight: 240, overflowY: "auto", border: `1px solid ${C.border}`, borderRadius: 8 }}>
              {assets.filter(a => a.status === "미사용").length === 0
                ? <p style={{ padding: 20, textAlign: "center", fontSize: 13, color: C.textLight, margin: 0 }}>배정 가능한 자산이 없습니다</p>
                : assets.filter(a => a.status === "미사용").map(a => (
                  <div key={a.id} onClick={() => setAssignTarget(a)}
                    style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 16px",
                      borderBottom: `1px solid ${C.bg}`, cursor: "pointer",
                      background: assignTarget?.id === a.id ? "#EFF6FF" : "transparent" }}>
                    <div style={{ flex: 1 }}>
                      <p style={{ margin: 0, fontSize: 14, fontWeight: 600, color: C.text }}>{a.name}</p>
                      <p style={{ margin: "2px 0 0", fontSize: 12, color: C.textMuted }}>{a.type || "기타"} · {a.department || "-"} · {a.location}</p>
                    </div>
                    {assignTarget?.id === a.id && <span style={{ fontSize: 12, color: C.primary, fontWeight: 600 }}>선택됨</span>}
                  </div>
                ))
              }
            </div>
            <InputField label="요청 사유" value={assignNote} onChange={v => setAssignNote(v)} placeholder="배정이 필요한 이유를 입력하세요" />
            {!assignTarget && <p style={{ margin: 0, fontSize: 12, color: C.danger }}>자산을 선택해 주세요.</p>}
            <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 8 }}>
              <Btn variant="ghost" onClick={() => { setAssignReqOpen(false); setAssignNote(""); setAssignTarget(null); }}>취소</Btn>
              <Btn onClick={() => {
                if (!assignTarget) return;
                const req = {
                  type: "배정요청",
                  assetId: assignTarget.id,
                  assetName: assignTarget.name,
                  requesterId: currentUser?.id || "-",
                  requesterName: currentUser?.name || "-",
                  targetUser: currentUser?.name || "-",
                  status: "대기중",
                  note: assignNote || "배정 요청",
                  date: toKST(),
                  resolvedNote: "-",
                  resolvedDate: "-",
                };
                supabase.from("requests").insert(req).select().single().then(({ data, error }) => {
                  if (error) { alert("요청 실패: " + error.message); return; }
                  ssetRequests([data, ...requests]);
                  alert("배정 요청이 접수되었습니다.");
                  setAssignReqOpen(false);
                  setAssignNote("");
                  setAssignTarget(null);
                });
              }}>요청</Btn>
            </div>
          </div>
        </Modal>
      )}
    </main>
  );
}