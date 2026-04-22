import { useState } from "react";
export default useSort;

function useSort(data, defaultKey, defaultDir = "desc") {
  const [sortKey, setSortKey] = useState(defaultKey || "");
  const [sortDir, setSortDir] = useState(defaultDir); // "asc" → defaultDir로 변경

  const handleSort = (key) => {
    if (sortKey === key) setSortDir(d => d === "asc" ? "desc" : "asc");
    else { setSortKey(key); setSortDir("asc"); }
  };

  const sorted = [...data].sort((a, b) => {
    if (!sortKey) return 0;
    const va = a[sortKey] ?? "";
    const vb = b[sortKey] ?? "";
    const cmp = String(va).localeCompare(String(vb), "ko");
    if (cmp !== 0) return sortDir === "asc" ? cmp : -cmp;
    // 같은 값이면 id 기준 내림차순 (최근 생성 순)
    return String(b.id).localeCompare(String(a.id));
  });

  return { sorted, sortKey, sortDir, handleSort };
}