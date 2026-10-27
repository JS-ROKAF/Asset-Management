import React, { useState, useEffect } from "react";
import { api } from "../api";
import { STATUS_OPTIONS, STATUS_COLORS, C } from "../constants";
import { displayDate, displayAge } from "../utils/date";
import { displayUser } from "../utils/user";
import useSort from "../hooks/useSort";
import {
  Btn,
  Modal,
  InputField,
  SelectField,
  MemberSelect,
  Field,
  PageHeader,
  SummaryCards,
  SearchFilter,
  StatusBadge,
  HistoryBadge,
  Pagination,
  ImportModal,
} from "../components/common";
import { assetTemplate } from "../utils/templates";
import SortableTable from "../components/SortableTable";
import { QRCodeSVG } from "qrcode.react";

// ── 폼 ↔ 저장값 변환 ──
// 폼은 입력칸 문자열을 그대로 들고 있고, 저장 직전에 서버 형식(id는 number, 빈 칸은 null)으로 바꾼다
const EMPTY_FORM = {
  name: "", corporationId: "", typeId: "", departmentId: "", memberId: null, location: "", status: "보관",
  legacyNo: "", model: "", serial: "", manufacturedYm: "", purchaseDate: "", purchaseCost: "",
  vendor: "", approvalNo: "", warrantyExpiry: "", cpu: "", ram: "", storage: "", os: "", note: "",
};
const ID_KEYS = ["corporationId", "typeId", "departmentId"];
const SPEC_KEYS = ["cpu", "ram", "storage", "os"];

const toPayload = (form) => Object.fromEntries(Object.keys(EMPTY_FORM).map(k => {
  const v = form[k];
  if (k === "memberId") return [k, v];
  if (ID_KEYS.includes(k) || k === "purchaseCost") return [k, v === "" || v == null ? null : Number(v)];
  return [k, typeof v === "string" ? (v.trim() || null) : v];
}));
const fromAsset = (a) => Object.fromEntries(Object.keys(EMPTY_FORM).map(k =>
  [k, k === "memberId" ? a.memberId : a[k] == null ? "" : String(a[k])]
));

// 저장 전 검사. 문제 있으면 메시지, 없으면 null
const validate = (form) => {
  if (!form.corporationId || !form.typeId) return "법인과 유형은 필수입니다.";
  if (form.memberId === undefined) return "사용자를 목록에서 선택해 주세요.";
  if (form.status === "사용중" && form.memberId == null) return "사용중 상태는 사용자가 필요합니다.";
  if (form.purchaseDate && !/^\d{4}-\d{2}(-\d{2})?$/.test(form.purchaseDate.trim())) return "취득일자는 YYYY-MM 또는 YYYY-MM-DD 형식입니다.";
  return null;
};

const today = new Date();
today.setHours(0, 0, 0, 0);
const thirtyDaysLater = new Date(today.getTime() + 30 * 24 * 60 * 60 * 1000);
const getWarrantyStatus = (warrantyExpiry) => {
  if (!warrantyExpiry) return null;
  const expiry = new Date(warrantyExpiry.slice(0, 10));
  if (expiry < today) return "expired";
  if (expiry <= thirtyDaysLater) return "warning";
  return null;
};

const textareaStyle = {
  border: `1px solid ${C.border}`, borderRadius: 8, padding: "10px 12px",
  fontSize: 14, color: C.text, outline: "none", resize: "vertical", fontFamily: "inherit",
};

// ── 등록·수정 공통 입력 폼 ──
function AssetForm({ form, setForm, corporations, departments, assetTypes, members, isCreate, quantity }) {
  const set = (k) => (v) => setForm({ ...form, [k]: v });
  const type = assetTypes.find(t => String(t.id) === form.typeId);
  const activeOpt = (rows, label) => [{ value: "", label: "선택해 주세요" },
    ...rows.filter(r => r.active || String(r.id) === form[label]).map(r => ({ value: String(r.id), label: r.code ? `${r.code} · ${r.name}` : r.name }))];

  // 상태–사용자 연동: 사용자를 고르면 사용중, 사용중이 아닌 상태를 고르면 사용자 해제
  const setStatus = (s) => setForm({ ...form, status: s, memberId: s === "사용중" ? form.memberId : null });
  const setMember = (m) => setForm({
    ...form, memberId: m,
    status: m != null ? "사용중" : form.status === "사용중" ? "보관" : form.status,
  });

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12 }}>
        <SelectField label="법인 *" value={form.corporationId} onChange={set("corporationId")}
          options={activeOpt(corporations, "corporationId")} disabled={!isCreate} />
        <SelectField label="유형 *" value={form.typeId} onChange={set("typeId")}
          options={activeOpt(assetTypes, "typeId")} />
        <InputField label="자산명" value={form.name} onChange={set("name")} />
      </div>
      {!isCreate && (
        <p style={{ margin: "-6px 0 0", fontSize: 12, color: C.textLight }}>자산번호는 최초 등록 기준이라 법인·유형을 바꿔도 번호는 그대로입니다.</p>
      )}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        <SelectField label="사용부서" value={form.departmentId} onChange={set("departmentId")}
          options={[{ value: "", label: "미지정" }, ...activeOpt(departments, "departmentId").slice(1)]} />
        <InputField label="위치" value={form.location} onChange={set("location")} />
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        <SelectField label="상태" value={form.status} onChange={setStatus} options={STATUS_OPTIONS} />
        <MemberSelect value={form.memberId} onChange={setMember} members={members} disabled={quantity > 1}
          label={quantity > 1 ? "사용자 (수량 2개 이상은 등록 후 개별 배정)" : "사용자"} />
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12 }}>
        <InputField label="모델명" value={form.model} onChange={set("model")} />
        <InputField label="시리얼 넘버" value={form.serial} onChange={set("serial")} />
        <InputField label="제조년월" value={form.manufacturedYm} type="month" onChange={set("manufacturedYm")} />
      </div>
      {type?.hasSpecs ? (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: 12 }}>
          <InputField label="CPU" value={form.cpu} onChange={set("cpu")} />
          <InputField label="RAM" value={form.ram} onChange={set("ram")} />
          <InputField label="저장장치" value={form.storage} onChange={set("storage")} />
          <InputField label="OS" value={form.os} onChange={set("os")} />
        </div>
      ) : null}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12 }}>
        <InputField label="취득일자" value={form.purchaseDate} placeholder="YYYY-MM 또는 YYYY-MM-DD" onChange={set("purchaseDate")} />
        <InputField label="취득금액 (원)" value={form.purchaseCost} type="number" onChange={set("purchaseCost")} />
        <InputField label="보증 만료일" value={form.warrantyExpiry} type="date" onChange={set("warrantyExpiry")} />
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12 }}>
        <InputField label="구입처" value={form.vendor} onChange={set("vendor")} />
        <InputField label="구매품의번호" value={form.approvalNo} onChange={set("approvalNo")} />
        <InputField label="구자산번호" value={form.legacyNo} onChange={set("legacyNo")} />
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        <label style={{ fontSize: 12, color: C.textMuted, fontWeight: 600 }}>비고</label>
        <textarea value={form.note} onChange={e => set("note")(e.target.value)} rows={2} style={textareaStyle} />
      </div>
    </div>
  );
}

// 발생일 + 이력 메모 (이력에 남는 값)
function EventFields({ value, onChange }) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 2fr", gap: 12, background: C.bg, borderRadius: 10, padding: 12 }}>
      <InputField label="발생일 (비우면 오늘)" value={value.eventDate} type="date" onChange={v => onChange({ ...value, eventDate: v })} />
      <InputField label="이력 메모" value={value.memo} onChange={v => onChange({ ...value, memo: v })} placeholder="이력에 함께 기록됩니다" />
    </div>
  );
}
const EMPTY_EVENT = { eventDate: "", memo: "" };
const eventPayload = (ev) => ({ eventDate: ev.eventDate || null, memo: ev.memo.trim() || null });

// ── 자산관리 ──
export default function AssetPage({ assets, history, members, corporations, departments, assetTypes, permission, userDept, currentUser, save, refresh, focusAssetId, onFocusCleared, initialStatus }) {
  // 부서장/뷰어면 자기 부서 자산만
  const visibleAssets = (permission === "admin" ? assets : assets.filter(a => a.departmentId === userDept))
    .filter(a => !a.isDisposed);
  const masters = { corporations, departments, assetTypes, members };

  const [addOpen, setAddOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [quantity, setQuantity] = useState(1);
  const [manualId, setManualId] = useState("");
  const [addEvent, setAddEvent] = useState(EMPTY_EVENT);

  const [selectedId, setSelectedId] = useState(null);
  const selected = assets.find(a => a.id === selectedId) || null;   // 저장 후 재조회되면 자동으로 최신값
  const [editBase, setEditBase] = useState(null);                    // 수정 시작 시점 스냅샷 (updatedAt 충돌 검사용)
  const [editForm, setEditForm] = useState(EMPTY_FORM);
  const [editEvent, setEditEvent] = useState(EMPTY_EVENT);
  const [repair, setRepair] = useState({ vendor: "", cost: "", content: "", dueDate: "" });

  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState(initialStatus || "전체");
  const [filterDept, setFilterDept] = useState("");
  const [filterType, setFilterType] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const PER_PAGE = 15;
  const [selectedIds, setSelectedIds] = useState([]);
  const [bulkMode, setBulkMode] = useState(null);   // "assign" | "status" | "move"
  const [bulkMember, setBulkMember] = useState(null);
  const [bulkStatus, setBulkStatus] = useState("수리중");
  const [bulkMove, setBulkMove] = useState({ departmentId: "", location: "" });
  const [showQR, setShowQR] = useState(false);
  const [disposeOpen, setDisposeOpen] = useState(false);
  const [disposeForm, setDisposeForm] = useState({ reason: "", method: "폐기" });

  useEffect(() => { setCurrentPage(1); }, [search, filterStatus, filterDept, filterType]);
  useEffect(() => {
    if (focusAssetId) {
      if (assets.some(a => a.id === focusAssetId)) setSelectedId(focusAssetId);
      onFocusCleared();
    }
  }, [focusAssetId, assets]);

  const q = search.toLowerCase();
  const base = visibleAssets.filter(a =>
    (filterStatus === "전체" || a.status === filterStatus) &&
    (!filterDept || String(a.departmentId) === filterDept) &&
    (!filterType || String(a.typeId) === filterType) &&
    [a.id, a.legacyNo, a.name, a.user, a.location, a.department, a.model, a.serial, a.vendor, a.note]
      .some(v => v?.toLowerCase().includes(q))
  );
  const { sorted, sortKey, sortDir, handleSort } = useSort(base, "date");
  const totalFiltered = sorted.length;
  const filtered = sorted.slice((currentPage - 1) * PER_PAGE, currentPage * PER_PAGE);

  const openDetail = (a) => { setSelectedId(a.id); setEditBase(null); };

  const addAsset = async () => {
    const err = validate(form);
    if (err) return alert(err);
    const fields = toPayload(form);
    if (!assetTypes.find(t => t.id === fields.typeId)?.hasSpecs) SPEC_KEYS.forEach(k => delete fields[k]);
    const created = await save(() => api.assets.create({
      fields, quantity, id: manualId.trim() || null, ...eventPayload(addEvent),
    }));
    if (!created) return;
    alert(`등록되었습니다: ${created.map(a => a.id).join(", ")}`);
    setAddOpen(false);
    setForm(EMPTY_FORM);
    setQuantity(1);
    setManualId("");
    setAddEvent(EMPTY_EVENT);
  };

  const startEdit = () => {
    setEditBase(selected);
    setEditForm(fromAsset(selected));
    setEditEvent(EMPTY_EVENT);
    setRepair({ vendor: "", cost: "", content: "", dueDate: "" });
  };

  const saveEdit = async () => {
    const err = validate(editForm);
    if (err) return alert(err);
    const before = toPayload(fromAsset(editBase));
    const after = toPayload(editForm);
    const fields = Object.fromEntries(Object.entries(after).filter(([k, v]) => before[k] !== v));
    if (Object.keys(fields).length === 0) { setEditBase(null); return; }
    const toRepair = fields.status === "수리중";
    const ok = await save(() => api.assets.update(editBase.id, {
      fields, updatedAt: editBase.updatedAt, ...eventPayload(editEvent),
      repair: toRepair ? repair : null,
    }));
    if (ok) setEditBase(null);
  };

  const disposeAsset = async () => {
    if (!disposeForm.reason.trim()) { alert("폐기 사유를 입력해 주세요."); return; }
    const ok = await save(() => api.assets.dispose(selected.id, disposeForm.method, disposeForm.reason.trim()));
    if (!ok) return;
    setDisposeOpen(false);
    setDisposeForm({ reason: "", method: "폐기" });
    setSelectedId(null);
  };

  const runBulk = async (ids, fields, memo) => {
    const ok = await save(() => api.assets.bulk(ids, fields, memo));
    if (!ok) return;
    setBulkMode(null);
    setSelectedIds([]);
    alert(`${ids.length}개 자산이 처리되었습니다.`);
  };

  const requestReturn = async () => {
    if (!window.confirm(`'${selected.name}' 반납을 요청할까요?`)) return;
    const ok = await save(() => api.requests.create("반납요청", selected.id, "반납 요청"));
    if (ok) { alert("반납 요청이 접수되었습니다."); setSelectedId(null); }
  };

  const assetHistory = selected
    ? history.filter(h => h.assetId === selected.id)
        .sort((a, b) => a.date.localeCompare(b.date) || a.id - b.id)
    : [];

  const ASSET_HEADERS = [
    { label: "자산번호", key: "id", width: 110 },
    { label: "구번호", key: "legacyNo" },
    { label: "자산명", key: "name" },
    { label: "유형", key: "type" },
    { label: "상태", key: "status" },
    { label: "위치", key: "location" },
    { label: "사용부서", key: "department" },
    { label: "사용자", key: "user" },
    { label: "보증만료일", key: "warrantyExpiry" },
    { label: "취득일자", key: "purchaseDate" },
    { label: "취득금액", key: "purchaseCost" },
    { label: "비고", key: "note" },
    { label: "등록일", key: "date" },
  ];

  const filterSelect = (value, onChange, options, label) => (
    <select value={value} onChange={e => onChange(e.target.value)}
      style={{ border: `1px solid ${C.border}`, borderRadius: 8, padding: "9px 12px", fontSize: 13, color: C.textMuted, outline: "none", background: C.card, cursor: "pointer" }}>
      <option value="">{label} 전체</option>
      {options.map(o => <option key={o.id} value={String(o.id)}>{o.name}</option>)}
    </select>
  );

  const td = { padding: "10px 12px", fontSize: 14, color: C.text, whiteSpace: "nowrap" };
  const selectedType = selected && assetTypes.find(t => t.id === selected.typeId);

  return (
    <main style={{ flex: 1, padding: "36px 40px", overflowY: "auto" }}>
      <PageHeader title="자산 관리" subtitle="등록된 IT 기기를 한눈에 확인하세요"
        action={permission !== "viewer" ? (
          <div style={{ display: "flex", gap: 8 }}>
            {permission === "admin" && <Btn variant="ghost" onClick={() => setImportOpen(true)}>⬆ 엑셀 가져오기</Btn>}
            <Btn onClick={() => setAddOpen(true)}>+ 자산 등록</Btn>
          </div>
        ) : null}
      />
      {importOpen && (
        <ImportModal title="자산 엑셀 가져오기 (구성원을 먼저 등록하세요)" templateName="자산등록_양식.xlsx"
          makeTemplate={() => assetTemplate({ corporations, departments, assetTypes })}
          run={api.assets.import}
          summary={r => `등록 ${r.create}건 (${Object.entries(r.statuses).map(([s, n]) => `${s} ${n}`).join(", ") || "-"})`}
          onClose={() => setImportOpen(false)}
          onSaved={async () => { setImportOpen(false); await refresh(); }} />
      )}
      <SummaryCards items={[
        { label: "전체 자산", value: visibleAssets.length, color: C.primary },
        ...STATUS_OPTIONS.map(s => ({ label: s, value: visibleAssets.filter(a => a.status === s).length, color: STATUS_COLORS[s] })),
        { label: "보증 만료", value: visibleAssets.filter(a => getWarrantyStatus(a.warrantyExpiry) === "expired").length, color: "#DC2626" },
        { label: "만료 임박", value: visibleAssets.filter(a => getWarrantyStatus(a.warrantyExpiry) === "warning").length, color: "#F97316" },
      ]} />

      <SearchFilter value={search} onChange={setSearch}
        filters={["전체", ...STATUS_OPTIONS]} active={filterStatus} onFilter={setFilterStatus} />
      <div style={{ display: "flex", gap: 10, marginBottom: 16, flexWrap: "wrap" }}>
        {filterSelect(filterDept, setFilterDept, departments, "부서")}
        {filterSelect(filterType, setFilterType, assetTypes, "유형")}
      </div>

      <SortableTable
        headers={ASSET_HEADERS}
        sortKey={sortKey} sortDir={sortDir} onSort={handleSort}
        extraHeader={
          <input type="checkbox"
            checked={selectedIds.length === filtered.length && filtered.length > 0}
            onChange={e => setSelectedIds(e.target.checked ? filtered.map(a => a.id) : [])}
            style={{ cursor: "pointer", width: 15, height: 15 }}
          />
        }
        rows={filtered.map((a, i) => (
          <tr key={a.id}
            onClick={() => openDetail(a)}
            style={{ borderBottom: i < filtered.length - 1 ? `1px solid ${C.bg}` : "none", cursor: "pointer",
              background: selectedIds.includes(a.id) ? "#EFF6FF" : "transparent" }}
            onMouseEnter={e => { if (!selectedIds.includes(a.id)) e.currentTarget.style.background = "#F8FAFC"; }}
            onMouseLeave={e => { if (!selectedIds.includes(a.id)) e.currentTarget.style.background = "transparent"; }}>
            <td style={{ padding: "14px 16px" }} onClick={e => e.stopPropagation()}>
              <input type="checkbox"
                checked={selectedIds.includes(a.id)}
                onChange={e => setSelectedIds(prev => e.target.checked ? [...prev, a.id] : prev.filter(id => id !== a.id))}
                style={{ cursor: "pointer", width: 15, height: 15 }}
              />
            </td>
            <td style={{ ...td, fontSize: 13, color: C.textMuted, fontWeight: 600 }}>{a.id}</td>
            <td style={{ ...td, fontSize: 13, color: C.textLight }}>{a.legacyNo || "-"}</td>
            <td style={{ ...td, fontWeight: 500 }}>{a.name || "-"}</td>
            <td style={{ ...td, color: C.textMuted }}>{a.type}</td>
            <td style={{ ...td }}><StatusBadge status={a.status} /></td>
            <td style={td}>{a.location || "-"}</td>
            <td style={td}>{a.department}</td>
            <td style={{ ...td, color: a.memberId ? C.text : C.textLight }}>{displayUser(a.user)}</td>
            <td style={td}>
              {(() => {
                const ws = getWarrantyStatus(a.warrantyExpiry);
                if (!a.warrantyExpiry) return <span style={{ color: C.textLight }}>-</span>;
                return (
                  <span style={{
                    fontSize: 12, fontWeight: ws ? 600 : 400,
                    color: ws === "expired" ? "#DC2626" : ws === "warning" ? "#F97316" : C.textMuted,
                    background: ws === "expired" ? "#FEE2E2" : ws === "warning" ? "#FFEDD5" : "transparent",
                    padding: ws ? "2px 8px" : 0,
                    borderRadius: ws ? 6 : 0,
                  }}>
                    {ws === "expired" && "만료 "}
                    {ws === "warning" && "임박 "}
                    {a.warrantyExpiry}
                  </span>
                );
              })()}
            </td>
            <td style={td}>{a.purchaseDate || "-"}</td>
            <td style={td}>{a.purchaseCost != null ? `${Number(a.purchaseCost).toLocaleString()}원` : "-"}</td>
            <td style={{ ...td, fontSize: 13, color: C.textLight, maxWidth: 200, overflow: "hidden", textOverflow: "ellipsis" }}>{a.note || "-"}</td>
            <td style={{ ...td, fontSize: 13, color: C.textLight }}>{displayDate(a.date)}</td>
          </tr>
        ))}
      />
      <Pagination total={totalFiltered} page={currentPage} perPage={PER_PAGE} onChange={setCurrentPage} />

      {/* 일괄 처리 바 */}
      {selectedIds.length > 0 && permission !== "viewer" && (
        <div style={{ position: "fixed", bottom: 24, left: "50%", transform: "translateX(-50%)", background: C.sidebar, borderRadius: 12, padding: "14px 24px", display: "flex", alignItems: "center", gap: 16, boxShadow: "0 8px 32px rgba(0,0,0,0.2)", zIndex: 40 }}>
          <span style={{ fontSize: 14, fontWeight: 600, color: "#fff" }}>{selectedIds.length}개 선택됨</span>
          <Btn small onClick={() => { setBulkMember(null); setBulkMode("assign"); }}>일괄 배정</Btn>
          <Btn small variant="danger" onClick={() => {
            const returnable = assets.filter(a => selectedIds.includes(a.id) && a.memberId != null).map(a => a.id);
            if (returnable.length === 0) return alert("선택한 자산 중 배정된 자산이 없습니다.");
            if (!window.confirm(`선택한 ${selectedIds.length}개 중 배정된 ${returnable.length}개 자산을 반납(→ 보관) 처리할까요?`)) return;
            runBulk(returnable, { memberId: null }, "일괄 반납");
          }}>일괄 반납</Btn>
          <Btn small variant="ghost" onClick={() => setBulkMode("status")}>일괄 상태 변경</Btn>
          <Btn small variant="ghost" onClick={() => { setBulkMove({ departmentId: "", location: "" }); setBulkMode("move"); }}>일괄 이동</Btn>
          <Btn small variant="ghost" onClick={() => setSelectedIds([])}>선택 해제</Btn>
        </div>
      )}

      {/* 일괄 처리 모달 */}
      {bulkMode && (
        <Modal title={`${{ assign: "일괄 배정", status: "일괄 상태 변경", move: "일괄 이동" }[bulkMode]} (${selectedIds.length}개 자산)`}
          onClose={() => setBulkMode(null)}>
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <div style={{ background: C.bg, borderRadius: 8, padding: 12, maxHeight: 160, overflowY: "auto" }}>
              {selectedIds.map(id => {
                const a = assets.find(a => a.id === id);
                return a ? (
                  <div key={id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                    <span style={{ fontSize: 13, color: C.text }}>{a.id} {a.name}</span>
                    <span style={{ fontSize: 12, color: C.textMuted }}>{displayUser(a.user)} · {a.department}</span>
                  </div>
                ) : null;
              })}
            </div>
            {bulkMode === "assign" && <MemberSelect label="배정할 사용자" value={bulkMember} onChange={setBulkMember} members={members} />}
            {bulkMode === "status" && (
              <>
                {/* 사용중은 사용자가 필요하므로 일괄 배정으로 */}
                <SelectField label="변경할 상태" value={bulkStatus} onChange={setBulkStatus} options={STATUS_OPTIONS.filter(s => s !== "사용중")} />
                <div style={{ background: "#FEF3C7", borderRadius: 8, padding: "10px 14px", fontSize: 13, color: "#92400E" }}>
                  ⚠️ '{bulkStatus}'으로 변경하면 사용자가 자동으로 해제되고 반납 이력이 생성됩니다.
                </div>
              </>
            )}
            {bulkMode === "move" && (
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <SelectField label="이동할 부서 (비우면 유지)" value={bulkMove.departmentId} onChange={v => setBulkMove({ ...bulkMove, departmentId: v })}
                  options={[{ value: "", label: "유지" }, ...departments.filter(d => d.active).map(d => ({ value: String(d.id), label: d.name }))]} />
                <InputField label="이동할 위치 (비우면 유지)" value={bulkMove.location} onChange={v => setBulkMove({ ...bulkMove, location: v })} />
              </div>
            )}
            <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 8 }}>
              <Btn variant="ghost" onClick={() => setBulkMode(null)}>취소</Btn>
              <Btn onClick={() => {
                if (bulkMode === "assign") {
                  if (bulkMember == null) return alert("사용자를 목록에서 선택해 주세요.");
                  return runBulk(selectedIds, { memberId: bulkMember }, "일괄 배정");
                }
                if (bulkMode === "status") return runBulk(selectedIds, { status: bulkStatus }, "일괄 상태 변경");
                const fields = {};
                if (bulkMove.departmentId) fields.departmentId = Number(bulkMove.departmentId);
                if (bulkMove.location.trim()) fields.location = bulkMove.location.trim();
                if (!Object.keys(fields).length) return alert("부서 또는 위치를 입력해 주세요.");
                return runBulk(selectedIds, fields, "일괄 이동");
              }}>적용</Btn>
            </div>
          </div>
        </Modal>
      )}

      {/* 자산 등록 모달 */}
      {addOpen && (
        <Modal title="자산 등록" onClose={() => setAddOpen(false)} wide>
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <AssetForm form={form} setForm={setForm} {...masters} isCreate quantity={quantity} />
            <div style={{ display: "grid", gridTemplateColumns: "1fr 2fr", gap: 12 }}>
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                <label style={{ fontSize: 12, color: C.textMuted, fontWeight: 600 }}>수량</label>
                <input type="number" min="1" max="100" value={quantity}
                  onChange={e => {
                    const n = Math.min(100, Math.max(1, parseInt(e.target.value) || 1));
                    setQuantity(n);
                    if (n > 1) setForm(f => ({ ...f, memberId: null, status: f.status === "사용중" ? "보관" : f.status }));
                  }}
                  style={{ border: `1px solid ${C.border}`, borderRadius: 8, padding: "10px 12px", fontSize: 14, color: C.text, outline: "none" }}
                />
              </div>
              <InputField label="자산번호 직접 입력 (비우면 자동 발급, 수량 1개일 때만)" value={manualId}
                onChange={setManualId} placeholder="예: DR-NB-0001" />
            </div>
            <EventFields value={addEvent} onChange={setAddEvent} />
            {quantity > 1 && (
              <div style={{ background: "#EFF6FF", borderRadius: 8, padding: "10px 14px", fontSize: 13, color: "#1D4ED8" }}>
                ℹ️ {quantity}개의 자산이 개별 자산번호로 일괄 등록됩니다.
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
        <Modal title={editBase ? `자산 수정 — ${selected.id}` : "자산 상세"} onClose={() => { setSelectedId(null); setEditBase(null); }} wide>
          {editBase ? (
            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              <AssetForm form={editForm} setForm={setEditForm} {...masters} />
              {editForm.status === "수리중" && editBase.status !== "수리중" && (
                <div style={{ background: "#EFF6FF", borderRadius: 10, padding: 14, display: "flex", flexDirection: "column", gap: 10 }}>
                  <p style={{ margin: 0, fontSize: 12, fontWeight: 600, color: "#1D4ED8" }}>수리 정보 입력 (선택)</p>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                    <InputField label="수리업체" value={repair.vendor} onChange={v => setRepair({ ...repair, vendor: v })} />
                    <InputField label="수리비용 (원)" value={repair.cost} type="number" onChange={v => setRepair({ ...repair, cost: v })} />
                  </div>
                  <InputField label="수리내용" value={repair.content} onChange={v => setRepair({ ...repair, content: v })} />
                  <InputField label="완료 예정일" value={repair.dueDate} type="date" onChange={v => setRepair({ ...repair, dueDate: v })} />
                </div>
              )}
              <EventFields value={editEvent} onChange={setEditEvent} />
              <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 8 }}>
                <Btn variant="ghost" onClick={() => setEditBase(null)}>취소</Btn>
                <Btn onClick={saveEdit}>저장</Btn>
              </div>
            </div>
          ) : (
            <div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 20 }}>
                {[
                  { label: "자산번호", value: selected.id },
                  { label: "구자산번호", value: selected.legacyNo || "-" },
                  { label: "법인 · 유형", value: `${selected.corporation} · ${selected.type}` },
                  { label: "자산명", value: selected.name || "-" },
                  { label: "모델명", value: selected.model || "-" },
                  { label: "시리얼 넘버", value: selected.serial || "-" },
                  { label: "상태", value: <StatusBadge status={selected.status} /> },
                  { label: "사용자", value: displayUser(selected.user) },
                  { label: "사용부서", value: selected.department },
                  { label: "위치", value: selected.location || "-" },
                  ...(selectedType?.hasSpecs ? [
                    { label: "CPU / RAM", value: `${selected.cpu || "-"} / ${selected.ram || "-"}` },
                    { label: "저장장치 / OS", value: `${selected.storage || "-"} / ${selected.os || "-"}` },
                  ] : []),
                  { label: "제조년월", value: selected.manufacturedYm || "-" },
                  { label: "취득일자", value: selected.purchaseDate || "-" },
                  { label: "취득금액", value: selected.purchaseCost != null ? `${Number(selected.purchaseCost).toLocaleString()}원` : "-" },
                  { label: "구입처", value: selected.vendor || "-" },
                  { label: "구매품의번호", value: selected.approvalNo || "-" },
                  { label: "보증 만료일", value: selected.warrantyExpiry || "-" },
                  { label: "등록일", value: displayDate(selected.date) },
                  { label: "사용 기간 (취득일 기준)", value: displayAge(selected.purchaseDate || selected.date) },
                  { label: "비고", value: selected.note || "-" },
                ].map(({ label, value }) => <Field key={label} label={label} value={value} />)}
              </div>
              <div style={{ background: C.bg, borderRadius: 10, padding: 16, marginBottom: 20 }}>
                <p style={{ margin: "0 0 12px", fontSize: 13, fontWeight: 600, color: "#475569" }}>자산 이력</p>
                {assetHistory.length > 0
                  ? assetHistory.map(h => (
                    <div key={h.id} style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
                      <HistoryBadge type={h.type} />
                      <span style={{ fontSize: 13, color: "#475569", whiteSpace: "nowrap", flexShrink: 0 }}>{displayUser(h.from)} → {displayUser(h.to)}</span>
                      <span style={{ fontSize: 12, color: C.textLight, flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={h.note}>{h.note}</span>
                      <span style={{ fontSize: 12, color: C.textLight, whiteSpace: "nowrap", flexShrink: 0 }}>{displayDate(h.date)}</span>
                    </div>
                  ))
                  : <p style={{ margin: 0, fontSize: 13, color: "#CBD5E1" }}>이력 없음</p>}
              </div>
              <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
                {/* QR 모달 */}
                {showQR && (
                  <div
                    style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 9999 }}
                    onClick={() => setShowQR(false)}
                  >
                    <div
                      id="qr-print-area"
                      style={{ background: "#fff", borderRadius: 16, padding: "32px 36px", display: "flex", flexDirection: "column", alignItems: "center", gap: 10, boxShadow: "0 8px 32px rgba(0,0,0,0.18)" }}
                      onClick={e => e.stopPropagation()}
                    >
                      <QRCodeSVG value={`${window.location.origin}/#/assets/${selected.id}`} size={200} />
                      <p style={{ margin: 0, fontWeight: 800, fontSize: 20, color: "#0F172A", letterSpacing: 1 }}>{selected.id}</p>
                      <p style={{ margin: 0, fontSize: 13, color: "#64748B" }}>{selected.name || selected.type}</p>
                      <button
                        onClick={() => {
                          const area = document.getElementById("qr-print-area");
                          const original = document.body.innerHTML;
                          document.body.innerHTML = area.innerHTML;
                          window.print();
                          document.body.innerHTML = original;
                          window.location.reload();
                        }}
                        style={{ marginTop: 8, padding: "8px 24px", background: "#6366F1", color: "#fff", border: "none", borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: "pointer" }}
                      >
                        🖨️ 인쇄
                      </button>
                      <button
                        onClick={() => setShowQR(false)}
                        style={{ padding: "6px 20px", background: "#F1F5F9", color: "#64748B", border: "none", borderRadius: 8, fontSize: 13, cursor: "pointer" }}
                      >
                        닫기
                      </button>
                    </div>
                  </div>
                )}

                <Btn variant="ghost" small onClick={() => setShowQR(true)}>🔲 QR 출력</Btn>

                {/* 본인 자산: 반납 요청 */}
                {permission !== "admin" && selected.memberId === currentUser?.id && (
                  <Btn variant="ghost" onClick={requestReturn}>반납 요청</Btn>
                )}
                {/* admin/manager: 수정/폐기 버튼 */}
                {permission !== "viewer" && (
                  <>
                    <Btn variant="danger" onClick={() => setDisposeOpen(true)}>폐기</Btn>
                    <Btn onClick={startEdit}>수정</Btn>
                  </>
                )}
              </div>
            </div>
          )}
        </Modal>
      )}

      {/* 폐기 처리 모달 */}
      {disposeOpen && selected && (
        <Modal title={`자산 폐기 — ${selected.id}`} onClose={() => { setDisposeOpen(false); setDisposeForm({ reason: "", method: "폐기" }); }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <div style={{ background: C.dangerBg, borderRadius: 8, padding: "10px 14px", fontSize: 13, color: "#991B1B" }}>
              ⚠️ 폐기 처리된 자산은 목록에서 제외됩니다. 사용자가 있으면 반납 후 폐기됩니다. 이력은 영구 보존됩니다.
            </div>
            <SelectField
              label="폐기 방법"
              value={disposeForm.method}
              onChange={v => setDisposeForm({ ...disposeForm, method: v })}
              options={["폐기", "매각", "기증", "분실처리"]}
            />
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              <label style={{ fontSize: 12, color: C.textMuted, fontWeight: 600 }}>폐기 사유 *</label>
              <textarea
                value={disposeForm.reason}
                onChange={e => setDisposeForm({ ...disposeForm, reason: e.target.value })}
                rows={3}
                placeholder="폐기 사유를 입력해 주세요"
                style={textareaStyle}
              />
            </div>
            <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 8 }}>
              <Btn variant="ghost" onClick={() => { setDisposeOpen(false); setDisposeForm({ reason: "", method: "폐기" }); }}>취소</Btn>
              <Btn variant="danger" onClick={disposeAsset}>폐기 처리</Btn>
            </div>
          </div>
        </Modal>
      )}
    </main>
  );
}
