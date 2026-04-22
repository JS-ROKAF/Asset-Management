import React, { useState, useEffect, useRef } from "react";
import {
  DEPARTMENTS,
  STATUS_OPTIONS,
  ASSET_TYPES,
  C
} from "../constants";
import { makeHistory } from "../utils/history";
import { displayDate, displayAge, toKST } from "../utils/date";
import { displayUser } from "../utils/user";
import useSort from "../hooks/useSort";
import {
  Btn,
  Modal,
  InputField,
  SelectField,
  Field,
  PageHeader,
  SummaryCards,
  SearchFilter,
  StatusBadge,
  HistoryBadge,
  Pagination
} from "../components/common";
import { SortableTable } from "../components";
import * as XLSX from "xlsx";

// ── 자산관리 ──
export default function AssetPage({ assets, setAssets, history, members, permission, userDept, requests, setRequests, currentUser, focusAssetId, onFocusCleared }) {
  // 부서장/뷰어면 자기 부서 자산만
  const visibleAssets = permission === "admin" ? assets : assets.filter(a => a.department === userDept);
  const [addOpen, setAddOpen] = useState(false);
  const [form, setForm] = useState({
    name: "", type: "기타", location: "", user: "",
    purchaseDate: "", purchaseCost: "", vendor: "",
    department: "", note: "", quantity: 1,
    model: "", serial: "", warrantyExpiry: "",
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
  const [selectedIds, setSelectedIds] = useState([]); // 선택된 자산 id 목록
  const [bulkOpen, setBulkOpen] = useState(false);     // 일괄 배정 모달
  const [bulkUser, setBulkUser] = useState("");         // 일괄 배정할 사용자  
  const [bulkStatusOpen, setBulkStatusOpen] = useState(false);
  const [bulkStatus, setBulkStatus] = useState("수리중");
  const [importOpen, setImportOpen] = useState(false);   // 가져오기 모달
  const [importData, setImportData] = useState([]);       // 파싱된 데이터
  const [importError, setImportError] = useState("");     // 오류 메시지
  const fileInputRef = useRef(null);
  

  useEffect(() => { setCurrentPage(1); }, [search, filterStatus, filterDept, filterType]);
  useEffect(() => {
  if (focusAssetId) {
    const asset = assets.find(a => a.id === focusAssetId);
    if (asset) {
      setSelected(asset);
      setEditMode(false);
    }
    onFocusCleared();
  }
}, [focusAssetId]);

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

  const handleImportFile = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setImportError("");

    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const wb = XLSX.read(evt.target.result, { type: "binary" });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const rows = XLSX.utils.sheet_to_json(ws, { defval: "" });

        if (rows.length === 0) {
          setImportError("데이터가 없습니다. 엑셀 파일을 확인해 주세요.");
          return;
        }

        // 필수 컬럼 확인
        const required = ["자산명", "유형", "위치"];
        const headers = Object.keys(rows[0]);
        const missing = required.filter(r => !headers.includes(r));
        if (missing.length > 0) {
          setImportError(`필수 컬럼이 없습니다: ${missing.join(", ")}`);
          return;
        }

        // 데이터 변환
        const parsed = rows.map((row, i) => ({
          name: String(row["자산명"] || ""),
          type: String(row["유형"] || "기타"),
          status: "미사용",
          user: "-",
          department: String(row["사용부서"] || "-"),
          location: String(row["위치"] || "-"),
          purchaseDate: row["취득일자"] ? String(row["취득일자"]) : "-",
          purchaseCost: row["취득금액"] ? String(row["취득금액"]) : "-",
          vendor: String(row["구입처"] || "-"),
          model: String(row["모델명"] || "-"),
          serial: String(row["시리얼넘버"] || "-"),
          warrantyExpiry: row["보증만료일"] ? String(row["보증만료일"]) : "-",
          note: String(row["비고"] || "-"),
          date: toKST(i),
        }));

        setImportData(parsed);
        setImportOpen(true);
      } catch (err) {
        setImportError("파일을 읽는 중 오류가 발생했습니다.");
      }
    };
    reader.readAsBinaryString(file);
    // 같은 파일 재업로드 가능하도록 초기화
    e.target.value = "";
  };

  const handleImportConfirm = () => {
    if (importData.length === 0) return;
    const histories = importData.map((a, i) =>
      makeHistory("입고", a, "-", "-", "엑셀 일괄 입고", i)
    );
    setAssets([...assets, ...importData], histories);
    setImportData([]);
    setImportOpen(false);
  };

  const addAsset = () => {
    if (!form.name || !form.location) return;

     // 시리얼 넘버 중복 체크
    if (form.serial && form.serial !== "") {
      const duplicate = assets.find(a => a.serial === form.serial && a.serial !== "-");
      if (duplicate) {
        alert(`시리얼 넘버 '${form.serial}'는 이미 등록된 자산(${duplicate.name})에 사용 중입니다.`);
        return;
      }
    }

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
        model: form.model || "-",
        serial: form.serial || "-",
        warrantyExpiry: form.warrantyExpiry || "-",
        note: form.note || "-",
        date: toKST(i),
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
      model: "", serial: "", warrantyExpiry: "",
    });
  };

  const saveEdit = () => {
    const prev = assets.find(a => a.id === editForm.id);

    // 시리얼 넘버 중복 체크 (자기 자신 제외)
    if (editForm.serial && editForm.serial !== "" && editForm.serial !== "-") {
      const duplicate = assets.find(a => a.serial === editForm.serial && a.id !== editForm.id && a.serial !== "-");
      if (duplicate) {
        alert(`시리얼 넘버 '${editForm.serial}'는 이미 등록된 자산(${duplicate.name})에 사용 중입니다.`);
        return;
      }
    }

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
        action={
          permission !== "viewer" ? (
            <div style={{ display: "flex", gap: 8 }}>
              <input
                type="file"
                accept=".xlsx,.xls"
                ref={fileInputRef}
                onChange={handleImportFile}
                style={{ display: "none" }}
              />
              <Btn variant="ghost" onClick={() => fileInputRef.current.click()}>⬆ 엑셀 가져오기</Btn>
              <Btn onClick={() => setAddOpen(true)}>+ 자산 등록</Btn>
            </div>
          ) : null
        }
      />
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
      extraHeader={
        <input type="checkbox"
          checked={selectedIds.length === filtered.length && filtered.length > 0}
          onChange={e => setSelectedIds(e.target.checked ? filtered.map(a => a.id) : [])}
          style={{ cursor: "pointer", width: 15, height: 15 }}
        />
      }
      rows={filtered.map((a, i) => (
        <tr key={a.id}
          style={{ borderBottom: i < filtered.length - 1 ? `1px solid ${C.bg}` : "none", cursor: "pointer",
            background: selectedIds.includes(a.id) ? "#EFF6FF" : "transparent" }}
          onMouseEnter={e => { if (!selectedIds.includes(a.id)) e.currentTarget.style.background = "#F8FAFC"; }}
          onMouseLeave={e => { if (!selectedIds.includes(a.id)) e.currentTarget.style.background = "transparent"; }}>
          {/* 체크박스 td */}
          <td style={{ padding: "14px 16px" }} onClick={e => e.stopPropagation()}>
            <input type="checkbox"
              checked={selectedIds.includes(a.id)}
              onChange={e => {
                setSelectedIds(prev =>
                  e.target.checked ? [...prev, a.id] : prev.filter(id => id !== a.id)
                );
              }}
              style={{ cursor: "pointer", width: 15, height: 15 }}
            />
          </td>
          {/* 기존 td들 — onClick을 tr에서 각 td로 이동 */}
          <td style={{ padding: "14px 20px", fontSize: 13, color: C.textMuted, whiteSpace: "nowrap" }}
            onClick={() => { setSelected(a); setEditMode(false); }}>{a.id}</td>
          <td style={{ padding: "14px 20px", fontSize: 14, color: C.text, fontWeight: 500, whiteSpace: "nowrap" }}
            onClick={() => { setSelected(a); setEditMode(false); }}>{a.name}</td>
          <td style={{ padding: "14px 20px", fontSize: 14, color: C.textMuted, whiteSpace: "nowrap" }}
            onClick={() => { setSelected(a); setEditMode(false); }}>{a.type || "기타"}</td>
          <td style={{ padding: "14px 20px", whiteSpace: "nowrap" }}
            onClick={() => { setSelected(a); setEditMode(false); }}><StatusBadge status={a.status} /></td>
          <td style={{ padding: "14px 20px", fontSize: 14, color: C.text, whiteSpace: "nowrap" }}
            onClick={() => { setSelected(a); setEditMode(false); }}>{a.location}</td>
          <td style={{ padding: "14px 20px", fontSize: 14, color: C.text, whiteSpace: "nowrap" }}
            onClick={() => { setSelected(a); setEditMode(false); }}>{a.department || "-"}</td>
          <td style={{ padding: "14px 20px", fontSize: 14, color: a.user === "-" ? C.textLight : C.text, whiteSpace: "nowrap" }}
            onClick={() => { setSelected(a); setEditMode(false); }}>{displayUser(a.user)}</td>
          <td style={{ padding: "14px 20px", fontSize: 14, color: C.text, whiteSpace: "nowrap" }}
            onClick={() => { setSelected(a); setEditMode(false); }}>{a.purchaseDate && a.purchaseDate !== "-" ? displayDate(a.purchaseDate) : "-"}</td>
          <td style={{ padding: "14px 20px", fontSize: 14, color: C.text, whiteSpace: "nowrap" }}
            onClick={() => { setSelected(a); setEditMode(false); }}>{a.purchaseCost && a.purchaseCost !== "-" ? `${Number(a.purchaseCost).toLocaleString()}원` : "-"}</td>
          <td style={{ padding: "14px 20px", fontSize: 14, color: C.text, whiteSpace: "nowrap" }}
            onClick={() => { setSelected(a); setEditMode(false); }}>{a.vendor || "-"}</td>
          <td style={{ padding: "14px 20px", fontSize: 13, color: C.textLight, whiteSpace: "nowrap", maxWidth: 200, overflow: "hidden", textOverflow: "ellipsis" }}
            onClick={() => { setSelected(a); setEditMode(false); }}>{a.note || "-"}</td>
          <td style={{ padding: "14px 20px", fontSize: 13, color: C.textLight, whiteSpace: "nowrap" }}
            onClick={() => { setSelected(a); setEditMode(false); }}>{displayDate(a.date)}</td>
        </tr>
      ))}
    />
      <Pagination total={totalFiltered} page={currentPage} perPage={PER_PAGE} onChange={setCurrentPage} />

      {/* 일괄 처리 바 */}
      {selectedIds.length > 0 && (
        <div style={{ position: "fixed", bottom: 24, left: "50%", transform: "translateX(-50%)", background: C.sidebar, borderRadius: 12, padding: "14px 24px", display: "flex", alignItems: "center", gap: 16, boxShadow: "0 8px 32px rgba(0,0,0,0.2)", zIndex: 40 }}>
          <span style={{ fontSize: 14, fontWeight: 600, color: "#fff" }}>
            {selectedIds.length}개 선택됨
          </span>
          <Btn small onClick={() => setBulkOpen(true)}>일괄 배정</Btn>
          
          <Btn small variant="danger" onClick={() => {
            const returnable = assets.filter(a => selectedIds.includes(a.id) && a.user !== "-");
            if (returnable.length === 0) {
              alert("선택한 자산 중 배정된 자산이 없습니다.");
              return;
            }
            if (!window.confirm(`선택한 ${selectedIds.length}개 중 배정된 ${returnable.length}개 자산을 반납 처리할까요?`)) return;
            const histories = [];
            const updatedAssets = assets.map(a => {
              if (selectedIds.includes(a.id) && a.user !== "-") {
                const updated = { ...a, user: "-", status: "미사용" };
                histories.push(makeHistory("반납", updated, a.user, "-", "일괄 반납 처리"));
                return updated;
              }
              return a;
            });
            setAssets(updatedAssets, histories);
            setSelectedIds([]);
            alert(`${returnable.length}개 자산이 반납 처리되었습니다.`);
          }}>일괄 반납</Btn>
          <Btn small variant="ghost" onClick={() => setBulkStatusOpen(true)}>일괄 상태 변경</Btn>
          <Btn small variant="ghost" onClick={() => setSelectedIds([])}>선택 해제</Btn>
        </div>
      )}

      {/* 일괄 배정 모달 */}
      {bulkOpen && (
        <Modal title={`일괄 배정 (${selectedIds.length}개 자산)`} onClose={() => { setBulkOpen(false); setBulkUser(""); }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <div style={{ background: C.bg, borderRadius: 8, padding: 12, maxHeight: 160, overflowY: "auto" }}>
              {selectedIds.map(id => {
                const a = assets.find(a => a.id === id);
                return a ? (
                  <div key={id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                    <span style={{ fontSize: 13, color: C.text }}>{a.name}</span>
                    <span style={{ fontSize: 12, color: C.textMuted }}>{displayUser(a.user)}</span>
                  </div>
                ) : null;
              })}
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              <label style={{ fontSize: 12, color: C.textMuted, fontWeight: 600 }}>배정할 사용자</label>
              <select value={bulkUser} onChange={e => setBulkUser(e.target.value)}
                style={{ border: `1px solid ${C.border}`, borderRadius: 8, padding: "10px 12px", fontSize: 14, color: C.text, outline: "none", background: "#fff" }}>
                <option value="">선택해 주세요</option>
                {members.map(m => <option key={m.id} value={m.name}>{m.name} ({m.department})</option>)}
              </select>
            </div>
            {!bulkUser && (
              <p style={{ margin: 0, fontSize: 12, color: C.danger }}>사용자를 선택해 주세요.</p>
            )}
            <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 8 }}>
              <Btn variant="ghost" onClick={() => { setBulkOpen(false); setBulkUser(""); }}>취소</Btn>
              <Btn onClick={() => {
                if (!bulkUser) return;
                const histories = [];
                const updatedAssets = assets.map(a => {
                  if (selectedIds.includes(a.id)) {
                    // 기존 사용자가 있으면 반납 이력 먼저
                    if (a.user && a.user !== "-") {
                      histories.push(makeHistory("반납", a, a.user, "-", `${a.user} → ${bulkUser} 일괄 재배정`, histories.length * 2));
                    }
                    const updated = { ...a, user: bulkUser, status: "사용중" };
                    histories.push(makeHistory("배정", updated, a.user || "-", bulkUser, "일괄 배정 처리", histories.length * 2 + 1));
                    return updated;
                  }
                  return a;
                });
                setAssets(updatedAssets, histories);
                setBulkOpen(false);
                setBulkUser("");
                setSelectedIds([]);
              }}>배정</Btn>
            </div>
          </div>
        </Modal>
      )}

      {/* 일괄 상태 변경 모달 */}
      {bulkStatusOpen && (
        <Modal title={`일괄 상태 변경 (${selectedIds.length}개 자산)`} onClose={() => setBulkStatusOpen(false)}>
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <div style={{ background: C.bg, borderRadius: 8, padding: 12, maxHeight: 160, overflowY: "auto" }}>
              {selectedIds.map(id => {
                const a = assets.find(a => a.id === id);
                return a ? (
                  <div key={id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                    <span style={{ fontSize: 13, color: C.text }}>{a.name}</span>
                    <StatusBadge status={a.status} />
                  </div>
                ) : null;
              })}
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              <label style={{ fontSize: 12, color: C.textMuted, fontWeight: 600 }}>변경할 상태</label>
              <select value={bulkStatus} onChange={e => setBulkStatus(e.target.value)}
                style={{ border: `1px solid ${C.border}`, borderRadius: 8, padding: "10px 12px", fontSize: 14, color: C.text, outline: "none", background: "#fff" }}>
                {STATUS_OPTIONS.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            {(bulkStatus === "미사용" || bulkStatus === "수리중" || bulkStatus === "분실") && (
              <div style={{ background: "#FEF3C7", borderRadius: 8, padding: "10px 14px", fontSize: 13, color: "#92400E" }}>
                ⚠️ '{bulkStatus}'으로 변경하면 사용자가 자동으로 초기화됩니다.
              </div>
            )}
            <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 8 }}>
              <Btn variant="ghost" onClick={() => setBulkStatusOpen(false)}>취소</Btn>
              <Btn onClick={() => {
                const histories = [];
                const updatedAssets = assets.map(a => {
                  if (!selectedIds.includes(a.id)) return a;
                  let updated = { ...a, status: bulkStatus };
                  if ((bulkStatus === "미사용" || bulkStatus === "수리중" || bulkStatus === "분실") && a.user !== "-") {
                    histories.push(makeHistory("반납", updated, a.user, "-", `일괄 상태 변경(${bulkStatus})으로 인한 자동 반납`));
                    updated.user = "-";
                  }
                  histories.push(makeHistory("상태변경", updated, updated.user, updated.user, `일괄 상태 변경: ${a.status} → ${bulkStatus}`));
                  return updated;
                });
                setAssets(updatedAssets, histories);
                setBulkStatusOpen(false);
                setSelectedIds([]);
              }}>변경</Btn>
            </div>
          </div>
        </Modal>
      )}

      {/* 엑셀 가져오기 미리보기 모달 */}
      {importOpen && (
        <Modal title={`엑셀 가져오기 (${importData.length}건)`} onClose={() => { setImportOpen(false); setImportData([]); }} wide>
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <div style={{ background: "#EFF6FF", borderRadius: 8, padding: "10px 14px", fontSize: 13, color: "#1D4ED8" }}>
              ℹ️ 아래 데이터가 등록됩니다. 확인 후 가져오기를 눌러주세요.
            </div>
            <div style={{ overflowX: "auto", maxHeight: 320, overflowY: "auto", borderRadius: 8, border: `1px solid ${C.border}` }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                <thead>
                  <tr style={{ background: "#F8FAFC", borderBottom: `1px solid ${C.border}` }}>
                    {["자산명", "유형", "위치", "사용부서", "모델명", "시리얼넘버", "취득금액", "구입처"].map(h => (
                      <th key={h} style={{ padding: "8px 12px", textAlign: "left", fontWeight: 600, color: C.textMuted, whiteSpace: "nowrap" }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {importData.map((a, i) => (
                    <tr key={i} style={{ borderBottom: `1px solid ${C.bg}` }}>
                      <td style={{ padding: "8px 12px", whiteSpace: "nowrap" }}>{a.name}</td>
                      <td style={{ padding: "8px 12px", whiteSpace: "nowrap" }}>{a.type}</td>
                      <td style={{ padding: "8px 12px", whiteSpace: "nowrap" }}>{a.location}</td>
                      <td style={{ padding: "8px 12px", whiteSpace: "nowrap" }}>{a.department}</td>
                      <td style={{ padding: "8px 12px", whiteSpace: "nowrap" }}>{a.model}</td>
                      <td style={{ padding: "8px 12px", whiteSpace: "nowrap" }}>{a.serial}</td>
                      <td style={{ padding: "8px 12px", whiteSpace: "nowrap" }}>{a.purchaseCost !== "-" ? `${Number(a.purchaseCost).toLocaleString()}원` : "-"}</td>
                      <td style={{ padding: "8px 12px", whiteSpace: "nowrap" }}>{a.vendor}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 8 }}>
              <Btn variant="ghost" onClick={() => {
                // 엑셀 양식 다운로드
                const template = XLSX.utils.book_new();
                const ws = XLSX.utils.aoa_to_sheet([[
                  "자산명", "유형", "위치", "사용부서", "모델명", "시리얼넘버",
                  "취득일자", "취득금액", "구입처", "보증만료일", "비고"
                ]]);
                XLSX.utils.book_append_sheet(template, ws, "자산목록");
                XLSX.writeFile(template, "자산등록_양식.xlsx");
              }}>양식 다운로드</Btn>
              <div style={{ display: "flex", gap: 8 }}>
                <Btn variant="ghost" onClick={() => { setImportOpen(false); setImportData([]); }}>취소</Btn>
                <Btn onClick={handleImportConfirm}>가져오기 ({importData.length}건)</Btn>
              </div>
            </div>
          </div>
        </Modal>
      )}

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
            {/* 5행: 모델명 + 시리얼 넘버 */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <InputField label="모델명" value={form.model} onChange={v => setForm({ ...form, model: v })} />
              <InputField label="시리얼 넘버" value={form.serial} onChange={v => setForm({ ...form, serial: v })} />
            </div>
            {/* 6행: 보증 만료일 */}
            <InputField label="보증 만료일" value={form.warrantyExpiry} type="date" onChange={v => setForm({ ...form, warrantyExpiry: v })} />
            {/* 7행: 사용자 (수량 1일 때만 활성) */}
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
            {/* 7행: 비고 */}
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
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <InputField label="모델명" value={editForm.model || ""} onChange={v => setEditForm({ ...editForm, model: v })} />
                <InputField label="시리얼 넘버" value={editForm.serial || ""} onChange={v => setEditForm({ ...editForm, serial: v })} />
                <InputField label="보증 만료일" value={editForm.warrantyExpiry || ""} type="date" onChange={v => setEditForm({ ...editForm, warrantyExpiry: v })} />
              </div>
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
                    { label: "모델명", value: selected.model || "-" },
                    { label: "시리얼 넘버", value: selected.serial || "-" },
                    { label: "상태", value: <StatusBadge status={selected.status} /> },
                    { label: "사용부서", value: selected.department || "-" },
                    { label: "사용자", value: displayUser(selected.user) },
                    { label: "위치", value: selected.location },
                    { label: "취득일자", value: selected.purchaseDate && selected.purchaseDate !== "-" ? displayDate(selected.purchaseDate) : "-" },
                    { label: "취득금액", value: selected.purchaseCost && selected.purchaseCost !== "-" ? `${Number(selected.purchaseCost).toLocaleString()}원` : "-" },
                    { label: "구입처", value: selected.vendor || "-" },
                    { label: "보증 만료일", value: selected.warrantyExpiry && selected.warrantyExpiry !== "-" ? selected.warrantyExpiry.slice(0, 10) : "-" },
                    { label: "등록일", value: displayDate(selected.date) },
                    { label: "사용 기간", value: displayAge(selected.date) },
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
                <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
                {/*<div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>*/}
                <Btn variant="ghost" small onClick={() => {
                  const printWin = window.open("", "_blank", "width=400,height=400");
                  printWin.document.write(`
                    <html><head><title>QR - ${selected.name}</title>
                    <style>body{display:flex;flex-direction:column;align-items:center;justify-content:center;height:100vh;font-family:sans-serif;gap:12px;}
                    p{margin:0;font-size:14px;font-weight:600;}</style></head>
                    <body>
                      <p>${selected.name}</p>
                      <p style="font-size:12px;color:#64748B">${selected.id}</p>
                      <div id="qr"></div>
                      <script src="https://cdnjs.cloudflare.com/ajax/libs/qrcodejs/1.0.0/qrcode.min.js"></script>
                      <script>
                        new QRCode(document.getElementById("qr"), {
                          text: "${selected.id}",
                          width: 200, height: 200
                        });
                        setTimeout(() => window.print(), 500);
                      </script>
                    </body></html>
                  `);
                  printWin.document.close();
                }}>🔲 QR 출력</Btn>

                {/* viewer/manager: 요청 버튼 */}
                {permission !== "admin" && (
                  <>
                    <Btn variant="ghost" onClick={() => {
                      if (!window.confirm(`'${selected.name}' 반납을 요청할까요?`)) return;
                      const req = {
                        type: "반납요청",
                        assetId: selected.id,
                        assetName: selected.name,
                        requesterId: currentUser?.id || "-",
                        requesterName: currentUser?.name || "-",
                        targetUser: "-",
                        status: "대기중",
                        note: "반납 요청",
                        date: toKST(),
                        resolvedNote: "-",
                        resolvedDate: "-",
                      };
                      supabase.from("requests").insert(req).then(({ error }) => {
                        if (error) { alert("요청 실패: " + error.message); return; }
                        setRequests([req, ...requests]);
                        alert("반납 요청이 접수되었습니다.");
                        setSelected(null);
                      });
                    }}>반납 요청</Btn>
                  </>
                )}
                {/* admin/manager: 수정/삭제 버튼 */}
                {permission !== "viewer" && (
                  <>
                    <Btn variant="danger" onClick={deleteAsset}>삭제</Btn>
                    <Btn onClick={() => {
                      setEditForm({
                        ...selected,
                        purchaseDate: selected.purchaseDate && selected.purchaseDate !== "-"
                          ? selected.purchaseDate.slice(0, 10) : "",
                      });
                      setEditMode(true);
                    }}>수정</Btn>
                  </>
                )}
              </div>
            </div>
          )}
        </Modal>
      )}
    </main>
  );
}