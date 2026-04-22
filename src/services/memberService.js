import { supabase } from "../supabase";

export const updateMembers = async (prev, newMembers, setMembersState) => {
  setMembersState(newMembers);

  const added   = newMembers.filter(n => !prev.find(p => p.id === n.id));
  const removed = prev.filter(p => !newMembers.find(n => n.id === p.id));
  const updated = newMembers.filter(n => {
    const old = prev.find(p => p.id === n.id);
    return old && JSON.stringify(old) !== JSON.stringify(n);
  });

  if (added.length) {
    const { data, error } = await supabase.from("members").insert(added).select();
    if (error) { setMembersState(prev); alert("구성원 등록 실패: " + error.message); return; }
    setMembersState(current =>
      current.map(m => {
        const match = data.find(d => d.email === m.email);
        return match ? match : m;
      })
    );
  }
  if (removed.length) {
    const { error } = await supabase.from("members").delete().in("id", removed.map(r => r.id));
    if (error) { setMembersState(prev); alert("구성원 삭제 실패: " + error.message); return; }
  }
  if (updated.length) {
    for (const u of updated) {
      const { error } = await supabase.from("members").update(u).eq("id", u.id);
      if (error) {
        setMembersState(prev);
        alert("구성원 수정 실패: " + error.message);
        return;
      }
    }
  }
};