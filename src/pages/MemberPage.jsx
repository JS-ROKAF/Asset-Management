import React, { useState, useEffect, useRef } from "react";
import * as XLSX from "xlsx";
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
import { ROLES, DEPARTMENTS, C } from "../constants";
import { makeHistory } from "../utils/history";
import { displayDate, displayAge, toKST } from "../utils/date";
import { displayUser } from "../utils/user";
import useSort from "../hooks/useSort";
import { SortableTable } from "../components";

// ── 구성원 관리 ──
export default function MemberPage({ members, setMembers, assets, setAssets, history, permission, userDept }) {
  const visibleMembers = (permission === "admin" ? members : members.filter(m => m.department === userDept))
  .filter(m => m.status !== "퇴직");
  const [addOpen, setAddOpen] = useState(false);
  const [selected, setSelected] = useState(null);
  const [editMode, setEditMode] = useState(false);
  const [form, setForm] = useState({ name: "", department: DEPARTMENTS[0], email: "", role: "사원" });
  const [editForm, setEditForm] = useState({});
  const [search, setSearch] = useState("");
  const [filterDept, setFilterDept] = useState("전체");
  const [sortBy, setSortBy] = useState("name"); // 기본: 이름순
  const [viewMode, setViewMode] = useState("card"); // "card" | "table"
  const memberFileInputRef = useRef(null);
  const [memberImportOpen, setMemberImportOpen] = useState(false);
  const [memberImportData, setMemberImportData] = useState([]);
  const [memberImportError, setMemberImportError] = useState("");
  const [memberImportGuideOpen, setMemberImportGuideOpen] = useState(false);
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
    if (members.some(m => m.email.toLowerCase() === form.email.toLowerCase())) {
      alert("이미 등록된 이메일입니다.");
      return;
    }
    // id 없이 넘기면 Supabase가 UUID 자동 발급, App.jsx가 state 반영
    setMembers([...members, { ...form }]);
    setAddOpen(false);
    setForm({ name: "", department: DEPARTMENTS[0], email: "", role: "사원" });
  };

  const handleMemberImportFile = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setMemberImportError("");

    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const wb = XLSX.read(evt.target.result, { type: "binary" });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const rows = XLSX.utils.sheet_to_json(ws, { defval: "" });

        if (rows.length === 0) {
          setMemberImportError("데이터가 없습니다.");
          return;
        }

        const required = ["이름", "이메일", "부서", "직급"];
        const headers = Object.keys(rows[0]);
        const missing = required.filter(r => !headers.includes(r));
        if (missing.length > 0) {
          setMemberImportError(`필수 컬럼이 없습니다: ${missing.join(", ")}`);
          return;
        }

        // 중복 이메일 체크
        const duplicates = rows.filter(row =>
          members.some(m => m.email.toLowerCase() === String(row["이메일"]).toLowerCase())
        );
        if (duplicates.length > 0) {
          setMemberImportError(`이미 등록된 이메일: ${duplicates.map(d => d["이메일"]).join(", ")}`);
          return;
        }

        const parsed = rows.map(row => ({
          name: String(row["이름"] || ""),
          email: String(row["이메일"] || ""),
          department: String(row["부서"] || DEPARTMENTS[0]),
          role: String(row["직급"] || "사원"),
        }));

        setMemberImportData(parsed);
        setMemberImportGuideOpen(false);
        setMemberImportOpen(true);
      } catch (err) {
        setMemberImportError("파일을 읽는 중 오류가 발생했습니다.");
      }
    };
    reader.readAsBinaryString(file);
    e.target.value = "";
  };

  const handleMemberImportConfirm = () => {
    if (memberImportData.length === 0) return;
    setMembers([...members, ...memberImportData]);
    setMemberImportData([]);
    setMemberImportOpen(false);
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

  const deleteMember = () => {
    if (!window.confirm(`'${selected.name}'을(를) 퇴직 처리할까요?\n이 구성원에게 배정된 자산은 자동으로 미배정(미사용) 처리됩니다.`)) return;

    const histories = [];

    const updatedAssets = assets.map(a => {
      if (a.user === selected.name) {
        const updatedAsset = { ...a, user: "-", status: "미사용" };
        histories.push(makeHistory(
          "반납",
          updatedAsset,
          selected.name,
          "-",
          "퇴직 처리로 인한 자동 반납"
        ));
        return updatedAsset;
      }
      return a;
    });

    setAssets(updatedAssets, histories);
    // 완전 삭제 대신 status를 "퇴직"으로 변경
    setMembers(members.map(m => m.id === selected.id ? { ...m, status: "퇴직" } : m));
    setSelected(null);
  };

  const memberAssets = (name) => assets.filter(a => a.user === name);

  return (
     <main style={{ flex: 1, padding: "36px 40px", overflowY: "auto" }}>
    <PageHeader title="구성원 관리" subtitle="부서별 구성원과 배정 자산을 관리하세요"
      action={permission !== "viewer" ? (
      <div style={{ display: "flex", gap: 8 }}>
        <input
          type="file"
          accept=".xlsx,.xls"
          ref={memberFileInputRef}
          onChange={handleMemberImportFile}
          style={{ display: "none" }}
        />
        <Btn variant="ghost" onClick={() => setMemberImportGuideOpen(true)}>⬆ 엑셀 가져오기</Btn>
        <Btn onClick={() => setAddOpen(true)}>+ 구성원 등록</Btn>
      </div>
    ) : null} />
    <SummaryCards items={[
      { label: "전체", value: visibleMembers.length, color: C.primary },
      ...DEPARTMENTS.map(d => ({ label: d, value: visibleMembers.filter(m => m.department === d).length, color: C.purple }))
    ]} />

    <SearchFilter value={search} onChange={setSearch}
      filters={["전체", ...DEPARTMENTS]} active={filterDept} onFilter={setFilterDept} activeColor={C.purple} />

    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
      <div style={{ display: "flex", gap: 4 }}>
        {[["card", "카드뷰"], ["table", "테이블뷰"]].map(([mode, label]) => (
          <button key={mode} onClick={() => setViewMode(mode)}
            style={{
              padding: "7px 14px", borderRadius: 8, fontSize: 13, cursor: "pointer",
              fontWeight: viewMode === mode ? 600 : 400,
              border: `1.5px solid ${viewMode === mode ? "#7C3AED" : C.border}`,
              background: viewMode === mode ? "#7C3AED" : C.card,
              color: viewMode === mode ? "#fff" : C.textMuted,
            }}>
            {label}
          </button>
        ))}
      </div>
      <select value={sortBy} onChange={e => setSortBy(e.target.value)}
        style={{ border: `1px solid ${C.border}`, borderRadius: 8, padding: "7px 12px", fontSize: 13, color: C.textMuted, outline: "none", background: C.card, cursor: "pointer" }}>
        <option value="name">이름순</option>
        <option value="department">부서순</option>
        <option value="assets">보유 자산 많은 순</option>
      </select>
    </div>

      
    {viewMode === "card" ? (
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
    ) : (
      <SortableTable
        headers={[
          { label: "사번", key: null },
          { label: "이름", key: "name" },
          { label: "부서", key: "department" },
          { label: "직급", key: "role" },
          { label: "이메일", key: "email" },
          { label: "배정 자산", key: null },
        ]}
        sortKey={sortBy}
        sortDir="asc"
        onSort={key => setSortBy(key)}
        rows={sorted.length > 0
        ? sorted.map((m, i) => {
        const myAssets = memberAssets(m.name); 
        return (
          <tr key={m.id}
            onClick={() => { setSelected(m); setEditMode(false); }}
            style={{ borderBottom: i < sorted.length - 1 ? `1px solid ${C.bg}` : "none", cursor: "pointer" }}
            onMouseEnter={e => e.currentTarget.style.background = "#F8FAFC"}
            onMouseLeave={e => e.currentTarget.style.background = "transparent"}>
            <td style={{ padding: "10px 12px", fontSize: 13, color: C.textMuted, whiteSpace: "nowrap" }}>
              {m.id?.slice(0, 8)}
            </td>
            <td style={{ padding: "10px 12px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <div style={{ width: 32, height: 32, borderRadius: "50%", background: "#EDE9FE", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13, fontWeight: 700, color: "#7C3AED", flexShrink: 0 }}>
                  {m.name[0]}
                </div>
                <span style={{ fontSize: 14, fontWeight: 600, color: C.text }}>{m.name}</span>
              </div>
            </td>
            <td style={{ padding: "10px 12px" }}>
              <span style={{ background: "#F3F0FF", color: "#7C3AED", fontSize: 11, fontWeight: 600, padding: "3px 10px", borderRadius: 99 }}>{m.department}</span>
            </td>
            <td style={{ padding: "10px 12px", fontSize: 13, color: C.textMuted }}>{m.role}</td>
            <td style={{ padding: "10px 12px", fontSize: 13, color: C.textMuted }}>{m.email}</td>
            <td style={{ padding: "10px 12px", maxWidth: 200 }}>
              {myAssets.length === 0
                ? <span style={{ color: "#CBD5E1" }}>없음</span>
                : (
                  <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                    <span style={{ background: C.bg, color: "#475569", fontSize: 11, padding: "2px 8px", borderRadius: 6, whiteSpace: "nowrap" }}>
                      {myAssets[0].name}
                    </span>
                    {myAssets.length > 1 && (
                      <span style={{ background: "#EDE9FE", color: "#7C3AED", fontSize: 11, fontWeight: 600, padding: "2px 8px", borderRadius: 6, whiteSpace: "nowrap" }}>
                        +{myAssets.length - 1}
                      </span>
                    )}
                  </div>
                )}
            </td>
          </tr>
        );
      })
        : [<tr key="empty"><td colSpan={6} style={{ padding: "40px", textAlign: "center", fontSize: 14, color: "#CBD5E1" }}>구성원이 없습니다</td></tr>]
      }
      />
    )}

      {memberImportGuideOpen && (
        <Modal title="구성원 엑셀 가져오기" onClose={() => setMemberImportGuideOpen(false)}>
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <div style={{ background: "#EFF6FF", borderRadius: 8, padding: "12px 14px", fontSize: 13, color: "#1D4ED8", lineHeight: 1.6 }}>
              ℹ️ 아래 양식을 다운로드하여 구성원 정보를 입력한 뒤 파일을 선택해주세요.<br />
              필수 항목: <strong>이름, 이메일, 부서, 직급</strong>
            </div>

            {/* 양식 다운로드 */}
            <Btn variant="ghost" onClick={() => {
              const template = XLSX.utils.book_new();
              const ws = XLSX.utils.aoa_to_sheet([
                ["이름", "이메일", "부서", "직급"],
                ["홍길동", "hong@durae.com", "경영지원사업부", "사원"],
              ]);
              XLSX.utils.book_append_sheet(template, ws, "구성원목록");
              XLSX.writeFile(template, "구성원등록_양식.xlsx");
            }}>⬇ 양식 다운로드</Btn>

            {memberImportError && (
              <p style={{ margin: 0, fontSize: 13, color: C.danger }}>{memberImportError}</p>
            )}

            <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
              <Btn variant="ghost" onClick={() => { setMemberImportGuideOpen(false); setMemberImportError(""); }}>취소</Btn>
              <Btn onClick={() => memberFileInputRef.current.click()}>📂 파일 선택</Btn>
            </div>
          </div>
        </Modal>
      )}

      {memberImportOpen && (
        <Modal title={`구성원 가져오기 (${memberImportData.length}명)`} onClose={() => { setMemberImportOpen(false); setMemberImportData([]); }} wide>
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <div style={{ background: "#EFF6FF", borderRadius: 8, padding: "10px 14px", fontSize: 13, color: "#1D4ED8" }}>
              ℹ️ 아래 구성원이 등록됩니다. 확인 후 가져오기를 눌러주세요.
            </div>
            <div style={{ overflowX: "auto", maxHeight: 320, overflowY: "auto", borderRadius: 8, border: `1px solid ${C.border}` }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                <thead>
                  <tr style={{ background: "#F8FAFC", borderBottom: `1px solid ${C.border}` }}>
                    {["이름", "이메일", "부서", "직급"].map(h => (
                      <th key={h} style={{ padding: "8px 12px", textAlign: "left", fontWeight: 600, color: C.textMuted, whiteSpace: "nowrap" }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {memberImportData.map((m, i) => (
                    <tr key={i} style={{ borderBottom: `1px solid ${C.bg}` }}>
                      <td style={{ padding: "8px 12px" }}>{m.name}</td>
                      <td style={{ padding: "8px 12px" }}>{m.email}</td>
                      <td style={{ padding: "8px 12px" }}>{m.department}</td>
                      <td style={{ padding: "8px 12px" }}>{m.role}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {memberImportError && (
              <p style={{ margin: 0, fontSize: 13, color: C.danger }}>{memberImportError}</p>
            )}
            <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 8 }}>
              <div style={{ display: "flex", gap: 8 }}>
                <Btn variant="ghost" onClick={() => { setMemberImportOpen(false); setMemberImportData([]); }}>취소</Btn>
                <Btn onClick={handleMemberImportConfirm}>가져오기 ({memberImportData.length}명)</Btn>
              </div>
            </div>
          </div>
        </Modal>
      )}

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

              <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
                <Btn variant="danger" onClick={deleteMember}>퇴직 처리</Btn>
                <Btn onClick={() => {
                  setEditForm(selected);
                  setEditMode(true);
                }}>
                  수정
                </Btn>
              </div>
            </div>
          )}
        </Modal>
      )}
    </main>
  );
}