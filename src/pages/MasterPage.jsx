import React, { useState } from "react";
import { api } from "../api";
import { Btn, Modal, InputField, PageHeader } from "../components/common";
import { C } from "../constants";

// 탭별 설정: API 종류, 목록 칸, 입력 칸
const TABS = {
  corporations: { label: "법인", columns: [["code", "코드"], ["name", "이름"]], empty: { code: "", name: "" } },
  departments: { label: "부서", columns: [["name", "이름"]], empty: { name: "" } },
  types: { label: "유형", columns: [["code", "코드"], ["name", "이름"], ["hasSpecs", "사양 입력"]], empty: { code: "", name: "", hasSpecs: 0 } },
};

// ── 기준정보 (admin) — 삭제 없이 사용여부만 토글 ──
export default function MasterPage({ corporations, departments, assetTypes, save }) {
  const [tab, setTab] = useState("corporations");
  const [editing, setEditing] = useState(null);   // { id?: number, ...fields }
  const rows = { corporations, departments, types: assetTypes }[tab];
  const { columns, empty } = TABS[tab];

  const submit = async () => {
    const { id, ...fields } = editing;
    if (!fields.name?.trim() || ("code" in fields && !fields.code?.trim())) return alert("코드와 이름은 필수입니다.");
    const ok = await save(() => id ? api.masters.update(tab, id, fields) : api.masters.create(tab, fields));
    if (ok) setEditing(null);
  };

  const toggleActive = (r) => save(() => api.masters.update(tab, r.id, { active: r.active ? 0 : 1 }));
  const startEdit = (r) => setEditing({ id: r.id, ...Object.fromEntries(Object.keys(empty).map(k => [k, r[k]])) });

  return (
    <main style={{ flex: 1, padding: "36px 40px", overflowY: "auto" }}>
      <PageHeader title="기준정보" subtitle="법인·부서·유형을 관리하세요. 사용 중인 항목은 삭제 대신 사용 안 함으로 바꿉니다."
        action={<Btn onClick={() => setEditing({ ...empty })}>+ {TABS[tab].label} 추가</Btn>} />
      <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
        {Object.entries(TABS).map(([key, t]) => (
          <button key={key} onClick={() => setTab(key)}
            style={{ padding: "9px 18px", borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: "pointer",
              border: `1px solid ${C.border}`, background: tab === key ? C.primary : C.card, color: tab === key ? "#fff" : C.textMuted }}>
            {t.label}
          </button>
        ))}
      </div>
      <div style={{ background: C.card, borderRadius: 12, boxShadow: "0 1px 4px rgba(0,0,0,0.06)", overflow: "hidden" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14 }}>
          <thead>
            <tr style={{ background: "#F8FAFC", borderBottom: `1px solid ${C.border}` }}>
              {[...columns.map(([, label]) => label), "사용", ""].map(h => (
                <th key={h} style={{ padding: "10px 16px", textAlign: "left", fontSize: 12, color: C.textMuted, fontWeight: 600 }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr><td colSpan={columns.length + 2} style={{ padding: 40, textAlign: "center", color: "#CBD5E1" }}>항목이 없습니다</td></tr>
            )}
            {rows.map(r => (
              <tr key={r.id} style={{ borderBottom: `1px solid ${C.bg}`, opacity: r.active ? 1 : 0.5 }}>
                {columns.map(([k]) => (
                  <td key={k} style={{ padding: "10px 16px", color: C.text }}>{k === "hasSpecs" ? (r[k] ? "✓" : "") : r[k]}</td>
                ))}
                <td style={{ padding: "10px 16px" }}>
                  <input type="checkbox" checked={!!r.active} onChange={() => toggleActive(r)} style={{ cursor: "pointer" }} />
                </td>
                <td style={{ padding: "10px 16px", textAlign: "right" }}>
                  <Btn small variant="ghost" onClick={() => startEdit(r)}>수정</Btn>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {editing && (
        <Modal title={`${TABS[tab].label} ${editing.id ? "수정" : "추가"}`} onClose={() => setEditing(null)}>
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            {"code" in editing && (
              <InputField label="코드 * (자산번호에 쓰임, 사용 중이면 변경 불가)" value={editing.code} onChange={v => setEditing({ ...editing, code: v.toUpperCase() })} />
            )}
            <InputField label="이름 *" value={editing.name} onChange={v => setEditing({ ...editing, name: v })} />
            {"hasSpecs" in editing && (
              <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, color: C.text }}>
                <input type="checkbox" checked={!!editing.hasSpecs} onChange={e => setEditing({ ...editing, hasSpecs: e.target.checked ? 1 : 0 })} />
                사양(CPU·RAM·저장장치·OS) 입력 칸 표시
              </label>
            )}
            <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 8 }}>
              <Btn variant="ghost" onClick={() => setEditing(null)}>취소</Btn>
              <Btn onClick={submit}>저장</Btn>
            </div>
          </div>
        </Modal>
      )}
    </main>
  );
}
