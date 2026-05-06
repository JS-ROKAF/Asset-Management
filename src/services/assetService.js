import { supabase } from "../supabase";

export const updateAssets = async (prev, newAssets, setAssetsState, setHistoryState, histories = []) => {
  setAssetsState(newAssets);

  const added   = newAssets.filter(n => !prev.find(p => p.id === n.id));
  const removed = prev.filter(p => !newAssets.find(n => n.id === p.id));
  const updated = newAssets.filter(n => {
    const old = prev.find(p => p.id === n.id);
    return old && JSON.stringify(old) !== JSON.stringify(n);
  });

  // added 처리
  if (added.length) {
    const { data, error } = await supabase.from("assets").insert(added).select();
    if (error) { setAssetsState(prev); alert("등록 실패: " + error.message); return; }

    // UUID가 반영된 실제 데이터로 state 교체
    setAssetsState(current =>
      current.map(a => {
        // serial + name 조합으로 매칭 안정성 향상
        const match = data.find(d => d.serial === a.serial && d.name === a.name && !a.id);
        return match ? match : a;
      })
    );

    // 입고 이력 UUID 교체 후 저장
    if (histories.length > 0) {
      const fixedHistories = histories.map(h => {
        const match = data.find(d => d.name === h.assetName);
        return match ? { ...h, assetId: match.id } : h;
      });
      const { error: hError } = await supabase.from("history").insert(fixedHistories);
      if (hError) { alert("이력 저장 실패: " + hError.message); return; }
    }
  }

  // removed 처리 (added와 분리, 독립적으로 실행)
  if (removed.length) {
    const { error } = await supabase.from("assets").delete().in("id", removed.map(r => r.id));
    if (error) { setAssetsState(prev); alert("삭제 실패: " + error.message); return; }
  }

  // updated 처리 (added 여부와 무관하게 항상 실행)
  if (updated.length) {
    for (const u of updated) {
      const { error } = await supabase.from("assets").update(u).eq("id", u.id);
      if (error) { setAssetsState(prev); alert("수정 실패: " + error.message); return; }
    }
  }

  // history 최신 데이터 재조회 (항상 마지막에 실행)
  const { data: hData } = await supabase.from("history")
    .select("*")
    .order("date", { ascending: false })
    .order("id", { ascending: false });
  if (hData) setHistoryState(hData);
};