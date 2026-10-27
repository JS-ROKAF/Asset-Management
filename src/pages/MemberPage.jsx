import React, { useState } from "react";
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
  ImportModal,
} from "../components/common";
import { api } from "../api";
import { memberTemplate } from "../utils/templates";
import { PERMISSION_LABELS, C } from "../constants";
import { displayDate } from "../utils/date";
import { displayUser } from "../utils/user";
import SortableTable from "../components/SortableTable";

const EMPTY_FORM = { name: "", departmentId: "", part: "", position: "", email: "" };
const toPayload = (f) => ({
  name: f.name.trim(),
  departmentId: f.departmentId ? Number(f.departmentId) : null,
  part: f.part.trim() || null,
  position: f.position.trim() || null,
  email: f.email.trim() || null,
});
// 이름은 필수, "/"는 가져오기의 이름/부서 구분자라 쓸 수 없음 (서버도 검사)
const nameError = (f) => !f.name.trim() ? "이름은 필수입니다." : f.name.includes("/") ? "이름에 '/'를 쓸 수 없습니다." : null;
const LOGIN_ID = /^[A-Za-z0-9._-]{2,30}$/;

// ── 구성원 관리 ──
export default function MemberPage({ members, assets, history, departments, permission, userDept, save, refresh }) {
  const visibleMembers = (permission === "admin" ? members : members.filter(m => m.departmentId === userDept))
    .filter(m => m.status !== "퇴직");
  const activeAssets = assets.filter(a => !a.isDisposed);
  const [addOpen, setAddOpen] = useState(false);
  const [selectedId, setSelectedId] = useState(null);
  const selected = members.find(m => m.id === selectedId) || null;
  const [issuedPassword, setIssuedPassword] = useState(null);
  const [editMode, setEditMode] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [editForm, setEditForm] = useState(EMPTY_FORM);
  const [editPermission, setEditPermission] = useState("");
  const [editLoginId, setEditLoginId] = useState("");
  const [search, setSearch] = useState("");
  const [filterDept, setFilterDept] = useState("");
  const [sortBy, setSortBy] = useState("name");
  const [viewMode, setViewMode] = useState("card");
  const [importOpen, setImportOpen] = useState(false);

  const deptOptions = [{ value: "", label: "미지정" },
    ...departments.filter(d => d.active).map(d => ({ value: String(d.id), label: d.name }))];
  const memberAssets = (id) => activeAssets.filter(a => a.memberId === id);

  const q = search.toLowerCase();
  const filtered = visibleMembers.filter(m =>
    (!filterDept || String(m.departmentId) === filterDept) &&
    [m.name, m.part, m.email, m.role].some(v => v?.toLowerCase().includes(q))
  );
  const sorted = [...filtered].sort((a, b) => {
    if (sortBy === "name") return a.name.localeCompare(b.name, "ko");
    if (sortBy === "department") return a.department.localeCompare(b.department, "ko");
    if (sortBy === "assets") return memberAssets(b.id).length - memberAssets(a.id).length;
    return 0;
  });

  const open = (m) => { setSelectedId(m.id); setEditMode(false); setIssuedPassword(null); };

  const addMember = async () => {
    if (nameError(form)) return alert(nameError(form));
    const ok = await save(() => api.members.create(toPayload(form)));
    if (!ok) return;
    setAddOpen(false);
    setForm(EMPTY_FORM);
  };

  const startEdit = () => {
    setEditForm({
      name: selected.name, departmentId: selected.departmentId ? String(selected.departmentId) : "",
      part: selected.part || "", position: selected.position || "", email: selected.email || "",
    });
    setEditPermission(selected.permission || "");
    setEditLoginId(selected.loginId || "");
    setEditMode(true);
  };

  const saveMember = async () => {
    if (nameError(editForm)) return alert(nameError(editForm));
    const loginId = editLoginId.trim();
    if (permission === "admin" && editPermission && !LOGIN_ID.test(loginId)) return alert("아이디는 영문·숫자·. _ - 로 2~30자입니다.");
    const payload = toPayload(editForm);
    const held = memberAssets(selected.id).length;
    // 부서가 바뀌고 보유 자산이 있으면 자산도 옮길지 확인 (설계안 3-6)
    const moveAssets = payload.departmentId !== selected.departmentId && held > 0 &&
      window.confirm(`보유 자산 ${held}개도 새 부서로 이동할까요?\n[확인] 자산도 이동(이동 이력 생성) / [취소] 구성원 부서만 변경`);
    const ok = await save(async () => {
      await api.members.update(selected.id, payload, moveAssets);
      if (permission === "admin" && (editPermission !== (selected.permission || "") || (editPermission && loginId !== selected.loginId))) {
        await api.members.setPermission(selected.id, editPermission || null, editPermission ? loginId : null);
      }
    });
    if (ok) setEditMode(false);
  };

  const retireMember = async () => {
    const n = memberAssets(selected.id).length;
    if (!window.confirm(`'${selected.name}'을(를) 퇴직 처리할까요?${n ? `\n배정된 자산 ${n}개는 자동으로 반납(→ 보관) 처리됩니다.` : ""}`)) return;
    const ok = await save(() => api.members.retire(selected.id));
    if (ok) setSelectedId(null);
  };

  // 임시 비밀번호 자동생성 — 혼동되는 글자(0/O, 1/l/I) 제외한 10자
  const issueTempPassword = async () => {
    if (!window.confirm(`'${selected.name}'의 임시 비밀번호를 발급할까요?\n기존 비밀번호는 즉시 무효화됩니다.`)) return;
    const chars = "abcdefghjkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789";
    const pw = Array.from(crypto.getRandomValues(new Uint32Array(10)), n => chars[n % chars.length]).join("");
    try {
      await api.members.resetPassword(selected.id, pw);
      setIssuedPassword(pw);
    } catch (e) {
      alert("임시 비밀번호 발급 실패: " + e.message);
    }
  };

  const deptBadge = (m) => (
    <span style={{ background: "#F3F0FF", color: "#7C3AED", fontSize: 11, fontWeight: 600, padding: "3px 10px", borderRadius: 99, whiteSpace: "nowrap" }}>{m.department}</span>
  );

  return (
    <main style={{ flex: 1, padding: "36px 40px", overflowY: "auto" }}>
      <PageHeader title="구성원 관리" subtitle="부서별 구성원과 배정 자산을 관리하세요"
        action={permission !== "viewer" ? (
          <div style={{ display: "flex", gap: 8 }}>
            {permission === "admin" && <Btn variant="ghost" onClick={() => setImportOpen(true)}>⬆ 엑셀 가져오기</Btn>}
            <Btn onClick={() => setAddOpen(true)}>+ 구성원 등록</Btn>
          </div>
        ) : null} />
      {importOpen && (
        <ImportModal title="구성원 엑셀 가져오기 (이름 기준: 없으면 등록, 있으면 갱신)" templateName="구성원등록_양식.xlsx"
          makeTemplate={() => memberTemplate({ departments })}
          run={api.members.import}
          summary={r => `신규 ${r.create} · 갱신 ${r.update} · 변경 없음 ${r.same}`}
          onClose={() => setImportOpen(false)}
          onSaved={async () => { setImportOpen(false); await refresh(); }} />
      )}
      <SummaryCards items={[
        { label: "재직 구성원", value: visibleMembers.length, color: C.primary },
        { label: "로그인 계정", value: visibleMembers.filter(m => m.permission).length, color: C.purple },
        { label: "자산 보유자", value: visibleMembers.filter(m => memberAssets(m.id).length > 0).length, color: "#10B981" },
      ]} />

      <SearchFilter value={search} onChange={setSearch} filters={[]} />
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12, gap: 8 }}>
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
        <div style={{ display: "flex", gap: 8 }}>
          <select value={filterDept} onChange={e => setFilterDept(e.target.value)}
            style={{ border: `1px solid ${C.border}`, borderRadius: 8, padding: "7px 12px", fontSize: 13, color: C.textMuted, outline: "none", background: C.card, cursor: "pointer" }}>
            <option value="">부서 전체</option>
            {departments.map(d => <option key={d.id} value={String(d.id)}>{d.name}</option>)}
          </select>
          <select value={sortBy} onChange={e => setSortBy(e.target.value)}
            style={{ border: `1px solid ${C.border}`, borderRadius: 8, padding: "7px 12px", fontSize: 13, color: C.textMuted, outline: "none", background: C.card, cursor: "pointer" }}>
            <option value="name">이름순</option>
            <option value="department">부서순</option>
            <option value="assets">보유 자산 많은 순</option>
          </select>
        </div>
      </div>

      {viewMode === "card" ? (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 16 }}>
          {sorted.map(m => {
            const myAssets = memberAssets(m.id);
            return (
              <div key={m.id} onClick={() => open(m)}
                style={{ background: C.card, borderRadius: 12, padding: 20, boxShadow: "0 1px 4px rgba(0,0,0,0.06)", cursor: "pointer", transition: "box-shadow 0.15s" }}
                onMouseEnter={e => e.currentTarget.style.boxShadow = "0 4px 16px rgba(0,0,0,0.10)"}
                onMouseLeave={e => e.currentTarget.style.boxShadow = "0 1px 4px rgba(0,0,0,0.06)"}>
                <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 14 }}>
                  <div style={{ width: 42, height: 42, borderRadius: "50%", background: "#EDE9FE", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16, fontWeight: 700, color: "#7C3AED" }}>
                    {m.name[0]}
                  </div>
                  <div>
                    <p style={{ margin: 0, fontSize: 15, fontWeight: 700, color: C.text }}>{m.name}</p>
                    <p style={{ margin: 0, fontSize: 12, color: C.textLight }}>{[m.part, m.role].filter(Boolean).join(" · ")}</p>
                  </div>
                  <span style={{ marginLeft: "auto" }}>{deptBadge(m)}</span>
                </div>
                {m.email && <p style={{ margin: "0 0 12px", fontSize: 12, color: C.textMuted }}>✉ {m.email}</p>}
                <div style={{ borderTop: `1px solid ${C.bg}`, paddingTop: 12 }}>
                  <p style={{ margin: "0 0 6px", fontSize: 11, color: C.textLight, fontWeight: 600 }}>배정 자산 {myAssets.length}개</p>
                  {myAssets.length > 0
                    ? myAssets.map(a => <span key={a.id} style={{ display: "inline-block", background: C.bg, color: "#475569", fontSize: 11, padding: "2px 8px", borderRadius: 6, marginRight: 4, marginBottom: 4 }}>{a.assetNo} {a.type}</span>)
                    : <p style={{ margin: 0, fontSize: 12, color: "#CBD5E1" }}>배정된 자산 없음</p>}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <SortableTable
          headers={[
            { label: "이름", key: "name" },
            { label: "부서", key: "department" },
            { label: "파트", key: null },
            { label: "직위", key: null },
            { label: "이메일", key: null },
            { label: "배정 자산", key: "assets" },
          ]}
          sortKey={sortBy}
          sortDir="asc"
          onSort={key => setSortBy(key)}
          rows={sorted.length > 0
            ? sorted.map((m, i) => {
              const myAssets = memberAssets(m.id);
              return (
                <tr key={m.id}
                  onClick={() => open(m)}
                  style={{ borderBottom: i < sorted.length - 1 ? `1px solid ${C.bg}` : "none", cursor: "pointer" }}
                  onMouseEnter={e => e.currentTarget.style.background = "#F8FAFC"}
                  onMouseLeave={e => e.currentTarget.style.background = "transparent"}>
                  <td style={{ padding: "10px 12px" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      <div style={{ width: 32, height: 32, borderRadius: "50%", background: "#EDE9FE", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13, fontWeight: 700, color: "#7C3AED", flexShrink: 0 }}>
                        {m.name[0]}
                      </div>
                      <span style={{ fontSize: 14, fontWeight: 600, color: C.text }}>{m.name}</span>
                    </div>
                  </td>
                  <td style={{ padding: "10px 12px" }}>{deptBadge(m)}</td>
                  <td style={{ padding: "10px 12px", fontSize: 13, color: C.textMuted }}>{m.part || "-"}</td>
                  <td style={{ padding: "10px 12px", fontSize: 13, color: C.textMuted }}>{m.role}</td>
                  <td style={{ padding: "10px 12px", fontSize: 13, color: C.textMuted }}>{m.email || "-"}</td>
                  <td style={{ padding: "10px 12px", maxWidth: 200 }}>
                    {myAssets.length === 0
                      ? <span style={{ color: "#CBD5E1" }}>없음</span>
                      : (
                        <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                          <span style={{ background: C.bg, color: "#475569", fontSize: 11, padding: "2px 8px", borderRadius: 6, whiteSpace: "nowrap" }}>
                            {myAssets[0].assetNo}
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
            : [<tr key="empty"><td colSpan={7} style={{ padding: "40px", textAlign: "center", fontSize: 14, color: "#CBD5E1" }}>구성원이 없습니다</td></tr>]
          }
        />
      )}

      {addOpen && (
        <Modal title="구성원 등록" onClose={() => setAddOpen(false)}>
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <InputField label="이름 *" value={form.name} onChange={v => setForm({ ...form, name: v })} />
            <SelectField label="부서" value={form.departmentId} onChange={v => setForm({ ...form, departmentId: v })} options={deptOptions} />
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <InputField label="파트 (선택)" value={form.part} onChange={v => setForm({ ...form, part: v })} />
              <InputField label="직위 (선택)" value={form.position} onChange={v => setForm({ ...form, position: v })} />
            </div>
            <InputField label="이메일 (선택)" value={form.email} onChange={v => setForm({ ...form, email: v })} type="email" />
            <p style={{ margin: 0, fontSize: 12, color: C.textLight }}>시스템 권한은 등록 후 구성원 수정에서 admin이 부여합니다. 권한이 없으면 로그인할 수 없습니다.</p>
            <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 8 }}>
              <Btn variant="ghost" onClick={() => setAddOpen(false)}>취소</Btn>
              <Btn onClick={addMember}>등록</Btn>
            </div>
          </div>
        </Modal>
      )}

      {selected && (
        <Modal title={editMode ? "구성원 수정" : "구성원 상세"} onClose={() => { setSelectedId(null); setIssuedPassword(null); }}>
          {editMode ? (
            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              <InputField label="이름 *" value={editForm.name} onChange={v => setEditForm({ ...editForm, name: v })} />
              <SelectField label="부서" value={editForm.departmentId} onChange={v => setEditForm({ ...editForm, departmentId: v })} options={deptOptions} />
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <InputField label="파트 (선택)" value={editForm.part} onChange={v => setEditForm({ ...editForm, part: v })} />
                <InputField label="직위 (선택)" value={editForm.position} onChange={v => setEditForm({ ...editForm, position: v })} />
              </div>
              <InputField label="이메일 (선택)" value={editForm.email} onChange={v => setEditForm({ ...editForm, email: v })} type="email" />
              {permission === "admin" && (
                <SelectField label="시스템 권한" value={editPermission} onChange={setEditPermission}
                  options={Object.entries(PERMISSION_LABELS).map(([value, label]) => ({ value, label }))} />
              )}
              {permission === "admin" && editPermission && (
                <InputField label="로그인 아이디 * (영문·숫자·. _ -, 2~30자)" value={editLoginId} onChange={setEditLoginId} />
              )}
              {permission === "admin" && editPermission === "" && selected.permission && (
                <p style={{ margin: 0, fontSize: 12, color: C.danger }}>권한을 없애면 로그인할 수 없고 아이디·비밀번호도 지워집니다.</p>
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
                  <p style={{ margin: 0, fontSize: 13, color: C.textLight }}>{[selected.department, selected.part, selected.role].filter(Boolean).join(" · ")}</p>
                </div>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 20 }}>
                <Field label="부서" value={selected.department} />
                <Field label="파트" value={selected.part || "-"} />
                <Field label="직위" value={selected.role} />
                <Field label="이메일" value={selected.email || "-"} />
                {permission === "admin" && <Field label="시스템 권한" value={PERMISSION_LABELS[selected.permission || ""]} />}
                {permission === "admin" && selected.permission && <Field label="로그인 아이디" value={selected.loginId || "-"} />}
              </div>
              <div style={{ background: C.bg, borderRadius: 10, padding: 16, marginBottom: 20 }}>
                <p style={{ margin: "0 0 10px", fontSize: 13, fontWeight: 600, color: "#475569" }}>배정 자산</p>
                {memberAssets(selected.id).length > 0
                  ? memberAssets(selected.id).map(a => (
                    <div key={a.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                      <span style={{ fontSize: 13, color: C.text }}>{a.assetNo} {a.name || a.type}</span>
                      <StatusBadge status={a.status} />
                    </div>
                  ))
                  : <p style={{ margin: 0, fontSize: 13, color: "#CBD5E1" }}>배정된 자산 없음</p>}
              </div>
              <div style={{ background: C.bg, borderRadius: 10, padding: 16, marginBottom: 20 }}>
                <p style={{ margin: "0 0 10px", fontSize: 13, fontWeight: 600, color: "#475569" }}>자산 이력</p>
                {(() => {
                  const memberHistory = history
                    .filter(h => h.fromMemberId === selected.id || h.toMemberId === selected.id)
                    .sort((a, b) => b.date.localeCompare(a.date) || b.id - a.id);
                  return memberHistory.length > 0
                    ? memberHistory.map(h => (
                      <div key={h.id} style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8, flexWrap: "wrap" }}>
                        <HistoryBadge type={h.type} />
                        <span style={{ fontSize: 13, color: C.text, fontWeight: 500, flex: 1, minWidth: 100 }}>{h.assetNo} {h.assetName !== h.assetNo ? h.assetName : ""}</span>
                        <span style={{ fontSize: 12, color: C.textMuted }}>{displayUser(h.from)} → {displayUser(h.to)}</span>
                        <span style={{ fontSize: 12, color: C.textLight, whiteSpace: "nowrap" }}>{displayDate(h.date)}</span>
                      </div>
                    ))
                    : <p style={{ margin: 0, fontSize: 13, color: "#CBD5E1" }}>이력 없음</p>;
                })()}
              </div>

              {permission === "admin" && (
                <div style={{ background: "#FFFBEB", border: "1px solid #FDE68A", borderRadius: 10, padding: 16, marginBottom: 20 }}>
                  <p style={{ margin: "0 0 10px", fontSize: 13, fontWeight: 600, color: "#92400E" }}>로그인 계정</p>
                  {!selected.permission ? (
                    <p style={{ margin: 0, fontSize: 12, color: C.textLight }}>
                      시스템 권한이 없어 로그인할 수 없습니다. 로그인이 필요하면 [수정]에서 권한을 먼저 부여하세요.
                    </p>
                  ) : issuedPassword ? (
                    <>
                      <p style={{ margin: "0 0 6px", fontSize: 12, color: "#92400E" }}>
                        임시 비밀번호가 발급됐습니다. 이 화면을 닫으면 다시 볼 수 없으니 본인에게 전달하세요.
                      </p>
                      <code style={{
                        display: "block", background: "#fff", border: "1px solid #FDE68A", borderRadius: 6,
                        padding: "10px 12px", fontSize: 16, fontWeight: 700, letterSpacing: 1, color: "#0F172A",
                        userSelect: "all", marginBottom: 8,
                      }}>{issuedPassword}</code>
                      <p style={{ margin: 0, fontSize: 12, color: C.textLight }}>
                        로그인 아이디: <strong>{selected.loginId}</strong>
                      </p>
                    </>
                  ) : (
                    <>
                      <p style={{ margin: "0 0 10px", fontSize: 12, color: C.textLight }}>
                        임시 비밀번호를 발급하면 이 구성원이 아이디로 로그인할 수 있습니다. 기존 비밀번호는 즉시 무효화됩니다.
                      </p>
                      <Btn variant="ghost" small onClick={issueTempPassword}>🔑 임시 비밀번호 발급</Btn>
                    </>
                  )}
                </div>
              )}

              {permission !== "viewer" && (
                <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
                  <Btn variant="danger" onClick={retireMember}>퇴직 처리</Btn>
                  <Btn onClick={startEdit}>수정</Btn>
                </div>
              )}
            </div>
          )}
        </Modal>
      )}
    </main>
  );
}
