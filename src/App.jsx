import React, { useState, useEffect, useCallback } from "react";
import { getToken } from "./api";
import { handleLogin, handleLogout, fetchAll, restoreSession, EMPTY_DATA } from "./services/authService";
import { C } from "./constants";
import Sidebar from "./components/layout/Sidebar";
import Dashboard from "./pages/Dashboard";
import AssetPage from "./pages/AssetPage";
import MemberPage from "./pages/MemberPage";
import HistoryPage from "./pages/HistoryPage";
import RequestPage from "./pages/RequestPage";
import InspectionPage from "./pages/InspectionPage";
import MasterPage from "./pages/MasterPage";
import LoginPage from "./pages/LoginPage";

// ── 메인 App ──
export default function App() {
  const [session, setSession] = useState(null);
  const [employeeNo, setEmployeeNo] = useState("");
  const [password, setPassword] = useState("");
  const [authLoading, setAuthLoading] = useState(false);
  const [data, setData] = useState(EMPTY_DATA);
  const [page, setPage] = useState("dashboard");
  const [focusAssetId, setFocusAssetId] = useState(null);
  const [initialStatus, setInitialStatus] = useState(null);  // 대시보드 카드에서 상태 필터를 걸고 자산 목록 열기
  const [loading, setLoading] = useState(true);

  const currentUser = session;
  const permission = currentUser?.permission;
  const userDept = currentUser?.departmentId ?? null;

  const handleLoginWrapper = (e) => {
    e?.preventDefault();
    handleLogin(employeeNo, password, setAuthLoading, setSession);
  };

  const refresh = useCallback(async () => {
    setData(await fetchAll());
    setLoading(false);
  }, []);

  // 모든 쓰기의 단일 경로: 서버 호출 → 성공하면 전체 재조회(서버가 만든 이력까지 반영) → 결과 반환. 실패 시 알림 후 null
  const save = useCallback(async (call) => {
    try {
      const result = await call();
      await refresh();
      return result ?? true;
    } catch (e) {
      alert(e.status === 409 ? e.message : `저장 실패: ${e.message}`);
      if (e.status === 409) await refresh();
      return null;
    }
  }, [refresh]);

  useEffect(() => {
    if (!getToken()) { setLoading(false); return; }
    restoreSession(setSession).then((ok) => { if (!ok) setLoading(false); });
  }, []);

  useEffect(() => {
    if (session) refresh();
  }, [session, refresh]);

  const menuItems = [
    { key: "dashboard",   icon: "dashboard",   label: "대시보드" },
    { key: "assets",      icon: "assets",      label: "자산관리" },
    { key: "members",     icon: "members",     label: "구성원 관리" },
    { key: "history",     icon: "history",     label: "이력 관리" },
    { key: "requests",    icon: "requests",    label: "요청 관리" },
    { key: "inspections", icon: "inspections", label: "정기 실사" },
    ...(permission === "admin" ? [{ key: "masters", icon: "masters", label: "기준정보" }] : []),
  ];

  // ── 로딩 화면 ──
  if (loading)
    return (
      <div
        style={{
          display: "flex",
          height: "100vh",
          alignItems: "center",
          justifyContent: "center",
          background: C.bg,
          flexDirection: "column",
          gap: 16,
        }}
      >
        <div
          style={{
            width: 40,
            height: 40,
            border: `3px solid ${C.border}`,
            borderTop: `3px solid ${C.primary}`,
            borderRadius: "50%",
            animation: "spin 0.8s linear infinite",
          }}
        />
        <p style={{ color: C.textLight, fontSize: 14 }}>데이터 불러오는 중...</p>
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );

  // ── 로그인 화면 ──
  if (!session)
    return (
      <LoginPage
        employeeNo={employeeNo}
        password={password}
        setEmployeeNo={setEmployeeNo}
        setPassword={setPassword}
        onLogin={handleLoginWrapper}
        loading={authLoading}
      />
    );

  const common = { ...data, permission, userDept, currentUser, save };

  // ── 메인 레이아웃 ──
  return (
    <div
      style={{
        display: "flex",
        height: "100vh",
        fontFamily: "'Pretendard Variable', 'Pretendard', 'Apple SD Gothic Neo', sans-serif",
        background: C.bg,
      }}
    >
      {/* ── 사이드바 ── */}
      <Sidebar
        page={page}
        setPage={setPage}
        menuItems={menuItems}
        requests={data.requests}
        inspections={[]}
        currentUser={currentUser}
        permission={permission}
        onRefresh={refresh}
        onLogout={() => handleLogout(setSession)}
      />

      {/* ── 페이지 콘텐츠 ── */}
      {page === "dashboard" && (
        <Dashboard
          {...common}
          onNavigate={(p, assetId, status) => {
            setPage(p);
            if (assetId) setFocusAssetId(assetId);
            setInitialStatus(status ?? null);
          }}
        />
      )}
      {page === "assets" && (
        <AssetPage
          {...common}
          focusAssetId={focusAssetId}
          onFocusCleared={() => setFocusAssetId(null)}
          initialStatus={initialStatus}
        />
      )}
      {page === "members" && <MemberPage {...common} />}
      {page === "history" && <HistoryPage {...common} />}
      {page === "requests" && <RequestPage {...common} />}
      {page === "inspections" && <InspectionPage />}
      {page === "masters" && permission === "admin" && <MasterPage {...common} />}
    </div>
  );
}
