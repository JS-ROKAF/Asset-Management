import { supabase } from "../supabase";

export const handleLogin = async (email, password, setAuthLoading) => {
  setAuthLoading(true);
  try {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) alert("로그인 실패: " + error.message);
  } catch (e) {
    alert("네트워크 오류가 발생했습니다. 인터넷 연결을 확인해 주세요.");
  } finally {
    setAuthLoading(false); // ← 성공/실패/오류 모든 경우에 반드시 실행
  }
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

    // ✅ 어떤 항목이 실패했는지 구체적으로 파악
    const errors = [
      e1 && "자산",
      e2 && "멤버",
      e3 && "이력",
      e4 && "요청",
      e5 && "점검",
      e6 && "점검항목"
    ].filter(Boolean);

    if (errors.length > 0) {
      console.error("fetchAll 오류:", { e1, e2, e3, e4, e5, e6 });
      alert(`다음 데이터를 불러오는데 실패했습니다: ${errors.join(", ")}\n새로고침을 시도해 주세요.`);
      
      // ✅ 실패한 항목은 빈 배열로 초기화 (이전 데이터 오염 방지)
      if (e1) setAssetsState([]);
      if (e2) setMembersState([]);
      if (e3) setHistoryState([]);
      if (e4) setRequestsState([]);
      if (e5) setInspectionsState([]);
      if (e6) setInspectionItemsState([]);

      // ✅ 성공한 항목은 정상 반영
      if (!e1) setAssetsState(a || []);
      if (!e2) setMembersState(m || []);
      if (!e3) setHistoryState(h || []);
      if (!e4) setRequestsState(r || []);
      if (!e5) setInspectionsState(ins || []);
      if (!e6) setInspectionItemsState(insItems || []);
      return;
    }

    // ✅ 전체 성공 시 정상 반영
    setAssetsState(a || []);
    setMembersState(m || []);
    setHistoryState(h || []);
    setRequestsState(r || []);
    setInspectionsState(ins || []);
    setInspectionItemsState(insItems || []);

  } catch (e) {
    alert("네트워크 오류가 발생했습니다. 인터넷 연결을 확인해 주세요.");
    
    // ✅ 네트워크 오류 시 전체 초기화
    setAssetsState([]);
    setMembersState([]);
    setHistoryState([]);
    setRequestsState([]);
    setInspectionsState([]);
    setInspectionItemsState([]);
  } finally {
    setLoading(false);
  }
};