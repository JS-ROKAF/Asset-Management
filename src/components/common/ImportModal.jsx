import { useRef, useState } from "react";
import * as XLSX from "xlsx";
import { C } from "../../constants";
import Btn from "./Btn";
import Modal from "./Modal";

// 엑셀 가져오기 공통 흐름: 양식 다운로드 → 파일 선택 → 서버 dry_run 미리보기(오류 목록) → 오류 0건이면 저장
// 브라우저는 첫 시트를 머리글 기준 원본 값으로만 읽어 보낸다. 정리·검증은 전부 서버
// - makeTemplate(): XLSX workbook 반환 (양식 + 코드표 시트)
// - run(rows, dryRun): 서버 호출 → { total, errors[], saved, ...건수 }
// - summary(result): 미리보기에 보여줄 건수 문구
export default function ImportModal({ title, templateName, makeTemplate, run, summary, onClose, onSaved }) {
  const fileRef = useRef(null);
  const [rows, setRows] = useState(null);
  const [result, setResult] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const call = async (r, dryRun) => {
    setBusy(true);
    setError("");
    try {
      const res = await run(r, dryRun);
      setResult(res);
      return res;
    } catch (e) {
      setError(e.message);
      return null;
    } finally {
      setBusy(false);
    }
  };

  const onFile = (e) => {
    const file = e.target.files[0];
    e.target.value = "";   // 같은 파일 재선택 허용
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async (evt) => {
      try {
        const wb = XLSX.read(evt.target.result, { type: "array" });
        // raw:true — 원본 값 그대로 (날짜 셀은 엑셀 일련번호 숫자). 날짜·금액 해석은 서버 규칙 하나로
        const parsed = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { defval: "", raw: true });
        if (!parsed.length) return setError("데이터가 없습니다. 첫 번째 시트를 확인해 주세요.");
        setRows(parsed);
        await call(parsed, true);
      } catch {
        setError("파일을 읽는 중 오류가 발생했습니다.");
      }
    };
    reader.readAsArrayBuffer(file);
  };

  const save = async () => {
    const res = await call(rows, false);
    if (res?.saved) {
      alert(`저장되었습니다.${res.backup ? `\n저장 직전 백업: ${res.backup}` : ""}`);
      onSaved();
    }
  };

  const errors = result?.errors ?? [];
  return (
    <Modal title={title} onClose={onClose} wide>
      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        <input type="file" accept=".xlsx,.xls" ref={fileRef} onChange={onFile} style={{ display: "none" }} />
        <div style={{ background: "#EFF6FF", borderRadius: 8, padding: "12px 14px", fontSize: 13, color: "#1D4ED8", lineHeight: 1.6 }}>
          ℹ️ 양식을 내려받아 첫 번째 시트에 입력한 뒤 파일을 선택하세요. 「코드표」 시트에 입력할 수 있는 값이 있습니다.<br />
          파일을 고르면 먼저 검사만 하고, 오류가 없을 때만 저장할 수 있습니다.
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <Btn variant="ghost" onClick={() => XLSX.writeFile(makeTemplate(), templateName)}>⬇ 양식 다운로드</Btn>
          <Btn variant="ghost" onClick={() => fileRef.current.click()} disabled={busy}>📂 파일 선택</Btn>
        </div>
        {busy && <p style={{ margin: 0, fontSize: 13, color: C.textMuted }}>처리 중...</p>}
        {error && <p style={{ margin: 0, fontSize: 13, color: C.danger, whiteSpace: "pre-line" }}>{error}</p>}
        {result && (
          <>
            <div style={{ background: C.bg, borderRadius: 8, padding: "10px 14px", fontSize: 13, color: C.text }}>
              전체 {result.total}행 · {summary(result)} · <strong style={{ color: errors.length ? C.danger : "#065F46" }}>오류 {errors.length}건</strong>
            </div>
            {errors.length > 0 && (
              <div style={{ maxHeight: 280, overflowY: "auto", border: `1px solid ${C.border}`, borderRadius: 8 }}>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                  <thead>
                    <tr style={{ background: "#F8FAFC" }}>
                      {["행", "칸", "사유"].map(h => <th key={h} style={{ padding: "8px 12px", textAlign: "left", color: C.textMuted }}>{h}</th>)}
                    </tr>
                  </thead>
                  <tbody>
                    {errors.map((e, i) => (
                      <tr key={i} style={{ borderTop: `1px solid ${C.bg}` }}>
                        <td style={{ padding: "6px 12px", whiteSpace: "nowrap" }}>{e.row}</td>
                        <td style={{ padding: "6px 12px", whiteSpace: "nowrap" }}>{e.column}</td>
                        <td style={{ padding: "6px 12px", color: C.danger }}>{e.reason}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}
        <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
          <Btn variant="ghost" onClick={onClose}>닫기</Btn>
          <Btn onClick={save} disabled={busy || !result || errors.length > 0 || result.saved}>저장</Btn>
        </div>
      </div>
    </Modal>
  );
}
