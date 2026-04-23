import React, { useState, useEffect } from "react";
import { supabase } from "./supabase";
import { updateAssets } from "./services/assetService";
import { updateMembers } from "./services/memberService";
import { handleLogin, fetchAll } from "./services/authService";
import { C, DEPARTMENTS } from "./constants";
import Sidebar from "./components/layout/Sidebar";
import Dashboard from "./pages/Dashboard";
import AssetPage from "./pages/AssetPage";
import MemberPage from "./pages/MemberPage";
import HistoryPage from "./pages/HistoryPage";
import RequestPage from "./pages/RequestPage";
import InspectionPage from "./pages/InspectionPage";
import LoginPage from "./pages/LoginPage";

// ── 메인 App ──
export default function App() {
  const [session, setSession] = useState(null);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [authLoading, setAuthLoading] = useState(false);
  const [assets, setAssetsState] = useState([]);
  const [members, setMembersState] = useState([]);
  const [history, setHistoryState] = useState([]);
  const [requests, setRequestsState] = useState([]);
  const [inspections, setInspectionsState] = useState([]);
  const [inspectionItems, setInspectionItemsState] = useState([]);
  const [page, setPage] = useState("dashboard");
  const [focusAssetId, setFocusAssetId] = useState(null);
  const [loading, setLoading] = useState(true);

  const currentUser = members.find((m) => m.email === session?.user?.email) || null;
  const permission = currentUser?.permission || "admin";
  const userDept = currentUser?.department || null;

  const handleLoginWrapper = (e) => {
    e.preventDefault();
    handleLogin(email, password, setAuthLoading);
  };

  const updateAssetsWrapper = (newAssets, histories = []) =>
    updateAssets(assets, newAssets, setAssetsState, setHistoryState, histories);

  const updateMembersWrapper = (newMembers) =>
    updateMembers(members, newMembers, setMembersState);

  const fetchAllWrapper = () =>
    fetchAll(
      setLoading,
      setAssetsState,
      setMembersState,
      setHistoryState,
      setRequestsState,
      setInspectionsState,
      setInspectionItemsState
    );

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      if (session) fetchAllWrapper();
      else setLoading(false);
    });
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      if (session) fetchAllWrapper();
    });
    return () => subscription.unsubscribe();
  }, []);

  const menuItems = [
    { key: "dashboard",   icon: "dashboard",   label: "대시보드" },
    { key: "assets",      icon: "assets",      label: "자산관리" },
    { key: "members",     icon: "members",     label: "구성원 관리" },
    { key: "history",     icon: "history",     label: "이력 관리" },
    { key: "requests",    icon: "requests",    label: "요청 관리" },
    { key: "inspections", icon: "inspections", label: "정기 실사" },
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
        email={email}
        password={password}
        setEmail={setEmail}
        setPassword={setPassword}
        onLogin={handleLoginWrapper}
        loading={authLoading}
      />
    );

  // ── 메인 레이아웃 ──
  return (
    <div
      style={{
        display: "flex",
        height: "100vh",
        fontFamily: "'Pretendard', 'Apple SD Gothic Neo', sans-serif",
        background: C.bg,
      }}
    >
      {/* ── 사이드바 ── */}
      <Sidebar
        page={page}
        setPage={setPage}
        menuItems={menuItems}
        requests={requests}
        inspections={inspections}
        currentUser={currentUser}
        permission={permission}
        onRefresh={fetchAllWrapper}
      />

      {/* ── 페이지 콘텐츠 ── */}
      {page === "dashboard" && (
        <Dashboard
          assets={assets}
          members={members}
          history={history}
          permission={permission}
          userDept={userDept}
          onNavigate={(p, assetId) => {
            setPage(p);
            if (assetId) setFocusAssetId(assetId);
          }}
        />
      )}
      {page === "assets" && (
        <AssetPage
          assets={assets}
          setAssets={updateAssetsWrapper}
          history={history}
          members={members}
          permission={permission}
          userDept={userDept}
          requests={requests}
          setRequests={setRequestsState}
          currentUser={currentUser}
          focusAssetId={focusAssetId}
          onFocusCleared={() => setFocusAssetId(null)}
        />
      )}
      {page === "members" && (
        <MemberPage
          members={members}
          setMembers={updateMembersWrapper}
          assets={assets}
          setAssets={updateAssetsWrapper}
          history={history}
          permission={permission}
          userDept={userDept}
        />
      )}
      {page === "history" && (
        <HistoryPage
          history={history}
          setHistory={setHistoryState}
          permission={permission}
          userDept={userDept}
          assets={assets}
        />
      )}
      {page === "requests" && (
        <RequestPage
          requests={requests}
          setRequests={setRequestsState}
          assets={assets}
          setAssets={updateAssetsWrapper}
          members={members}
          permission={permission}
          userDept={userDept}
          currentUser={currentUser}
        />
      )}
      {page === "inspections" && (
        <InspectionPage
          inspections={inspections}
          setInspections={setInspectionsState}
          inspectionItems={inspectionItems}
          setInspectionItems={setInspectionItemsState}
          assets={assets}
          setAssets={updateAssetsWrapper}
          members={members}
          permission={permission}
          userDept={userDept}
          currentUser={currentUser}
        />
      )}
    </div>
  );
}