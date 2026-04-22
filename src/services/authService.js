import { supabase } from "../supabase";

export const handleLogin = async (email, password, setAuthLoading) => {
  setAuthLoading(true);
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) alert("로그인 실패: " + error.message);
  setAuthLoading(false);
};

export const fetchAll = async (setLoading, setAssetsState, setMembersState, setHistoryState, setRequestsState, setInspectionsState, setInspectionItemsState) => {
  setLoading(true);
  try {
    const [
      { data: a, error: e1 },
      { data: m, error: e2 },
      { data: h, error: e3 },
      { data: r, error: e4 },
      { data: ins, error: e5 },
      { data: insItems, error: e6 }
    ] = await Promise.all([
      supabase.from("assets").select("*"),
      supabase.from("members").select("*"),
      supabase.from("history").select("*").order("date", { ascending: false }),
      supabase.from("requests").select("*").order("date", { ascending: false }),
      supabase.from("inspections").select("*").order("startDate", { ascending: false }),
      supabase.from("inspection_items").select("*"),
    ]);
    if (e1 || e2 || e3 || e4 || e5 || e6) {
      console.error("e1(assets):", e1);
      console.error("e2(members):", e2);
      console.error("e3(history):", e3);
      console.error("e4(requests):", e4);
      console.error("e5(inspections):", e5);
      console.error("e6(inspection_items):", e6);
      alert("데이터를 불러오는 중 오류가 발생했습니다. 새로고침을 시도해 주세요.");
      return;
    }
    setAssetsState(a || []);
    setMembersState(m || []);
    setHistoryState(h || []);
    setRequestsState(r || []);
    setInspectionsState(ins || []);
    setInspectionItemsState(insItems || []);
  } catch (e) {
    alert("네트워크 오류가 발생했습니다. 인터넷 연결을 확인해 주세요.");
  } finally {
    setLoading(false);
  }
};