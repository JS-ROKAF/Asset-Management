import { api } from "../api";

export const updateAssets = async (prev, newAssets, setAssetsState, setHistoryState, histories = []) => {
  setAssetsState(newAssets);

  const added   = newAssets.filter(n => !prev.find(p => p.id === n.id));
  const removed = prev.filter(p => !newAssets.find(n => n.id === p.id));
  const updated = newAssets.filter(n => {
    const old = prev.find(p => p.id === n.id);
    return old && JSON.stringify(old) !== JSON.stringify(n);
  });

  try {
    if (added.length) {
      await api.assets.bulkInsert(added);
      if (histories.length > 0) {
        await api.history.bulkInsert(histories);
      }
    }

    if (removed.length) {
      await api.assets.bulkDelete(removed.map(r => r.id));
    }

    if (updated.length) {
      for (const u of updated) {
        await api.assets.update(u.id, u);
      }
      if (!added.length && histories.length > 0) {
        await api.history.bulkInsert(histories);
      }
    }
  } catch (e) {
    setAssetsState(prev);
    alert("자산 저장 실패: " + e.message);
    return;
  }

  const hData = await api.history.list();
  if (hData) setHistoryState(hData);
};
