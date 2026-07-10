import { api, setToken, clearToken } from "../api";

export const handleLogin = async (email, password, setAuthLoading, setSession) => {
  setAuthLoading(true);
  try {
    const data = await api.login(email, password);
    setToken(data.token);
    setSession(data.member);
  } catch (e) {
    alert("로그인 실패: " + e.message);
  } finally {
    setAuthLoading(false);
  }
};

export const handleLogout = (setSession) => {
  clearToken();
  setSession(null);
};

export const restoreSession = async (setSession) => {
  try {
    const member = await api.me();
    setSession(member);
    return true;
  } catch {
    clearToken();
    setSession(null);
    return false;
  }
};

export const fetchAll = async (setLoading, setAssetsState, setMembersState, setHistoryState, setRequestsState, setInspectionsState, setInspectionItemsState) => {
  setLoading(true);
  try {
    const data = await api.bootstrap();
    setAssetsState(data.assets || []);
    setMembersState(data.members || []);
    setHistoryState(data.history || []);
    setRequestsState(data.requests || []);
    setInspectionsState(data.inspections || []);
    setInspectionItemsState(data.inspectionItems || []);
  } catch (e) {
    alert(`데이터를 불러오는데 실패했습니다: ${e.message}\n새로고침을 시도해 주세요.`);
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
