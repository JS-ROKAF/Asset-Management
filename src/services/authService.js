import { api, setToken, clearToken } from "../api";
import { enrich } from "../utils/enrich";

export const handleLogin = async (employeeNo, password, setAuthLoading, setSession) => {
  setAuthLoading(true);
  try {
    const data = await api.login(employeeNo, password);
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

export const EMPTY_DATA = enrich({
  corporations: [], departments: [], assetTypes: [],
  assets: [], members: [], history: [], requests: [],
});

export const fetchAll = async () => {
  try {
    return enrich(await api.bootstrap());
  } catch (e) {
    alert(`데이터를 불러오는데 실패했습니다: ${e.message}\n새로고침을 시도해 주세요.`);
    return EMPTY_DATA;
  }
};
