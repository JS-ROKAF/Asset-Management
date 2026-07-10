import { api } from "../api";

export const updateMembers = async (prev, newMembers, setMembersState) => {
  setMembersState(newMembers);

  const added   = newMembers.filter(n => !prev.find(p => p.id === n.id));
  const removed = prev.filter(p => !newMembers.find(n => n.id === p.id));
  const updated = newMembers.filter(n => {
    const old = prev.find(p => p.id === n.id);
    return old && JSON.stringify(old) !== JSON.stringify(n);
  });

  try {
    if (added.length) {
      const withIds = added.map(m => ({ ...m, id: m.id || "M" + Date.now() + Math.random().toString(36).slice(2, 8) }));
      const inserted = await api.members.bulkInsert(withIds);
      setMembersState(current =>
        current.map(m => {
          const match = inserted.find(d => d.email === m.email);
          return match ? match : m;
        })
      );
    }
    if (removed.length) {
      await api.members.bulkDelete(removed.map(r => r.id));
    }
    if (updated.length) {
      for (const u of updated) {
        await api.members.update(u.id, u);
      }
    }
  } catch (e) {
    setMembersState(prev);
    alert("구성원 저장 실패: " + e.message);
  }
};
