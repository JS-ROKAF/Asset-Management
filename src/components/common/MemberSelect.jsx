import { useId, useState } from "react";
import { C } from "../../constants";

const labelOf = (m) => `${m.name} (${m.employeeNo} · ${m.department})`;

// 구성원 선택: 이름·사번·부서로 타이핑 검색 (네이티브 datalist).
// 값: memberId(number) / null(미배정) / undefined(목록에 없는 입력 — 호출부는 저장을 막을 것)
export default function MemberSelect({ label = "사용자", value, onChange, members, disabled = false, placeholder = "이름 또는 사번 입력 (비우면 미배정)" }) {
  const listId = useId();
  const current = members.find(m => m.id === value);
  const [text, setText] = useState(current ? labelOf(current) : "");
  const active = members.filter(m => m.status === "재직");

  const handle = (v) => {
    setText(v);
    if (!v.trim()) return onChange(null);
    const hit = active.find(m => labelOf(m) === v) || active.find(m => m.employeeNo === v.trim());
    onChange(hit ? hit.id : undefined);
  };
  const invalid = value === undefined && text.trim() !== "";

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      <label style={{ fontSize: 12, color: C.textMuted, fontWeight: 600 }}>{label}</label>
      <input list={listId} value={text} disabled={disabled} placeholder={placeholder}
        onChange={e => handle(e.target.value)}
        style={{ border: `1px solid ${invalid ? C.danger : C.border}`, borderRadius: 8, padding: "10px 12px", fontSize: 14,
          color: disabled ? C.textLight : C.text, outline: "none", background: disabled ? C.bg : "#fff" }} />
      <datalist id={listId}>
        {active.map(m => <option key={m.id} value={labelOf(m)} />)}
      </datalist>
      {invalid && <span style={{ fontSize: 12, color: C.danger }}>목록에서 구성원을 선택해 주세요.</span>}
    </div>
  );
}
