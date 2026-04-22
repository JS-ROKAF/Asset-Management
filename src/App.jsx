import React, { useState, useEffect } from "react";
import { supabase } from "./supabase";
import { updateAssets } from "./services/assetService";
import { updateMembers } from "./services/memberService";
import { handleLogin, fetchAll } from "./services/authService";
import { C, DEPARTMENTS } from "./constants";
import Icon from "./components/common/Icon";
import Dashboard from "./pages/Dashboard";
import AssetPage from "./pages/AssetPage";
import MemberPage from "./pages/MemberPage";
import HistoryPage from "./pages/HistoryPage";
import RequestPage from "./pages/RequestPage";
import InspectionPage from "./pages/InspectionPage";

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
  const currentUser = members.find(m => m.email === session?.user?.email) || null;
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
    fetchAll(setLoading, setAssetsState, setMembersState, setHistoryState, setRequestsState, setInspectionsState, setInspectionItemsState);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      if (session) fetchAllWrapper();
      else setLoading(false);
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      if (session) fetchAllWrapper();
    });
    return () => subscription.unsubscribe();
  }, []);
  
  const menuItems = [
    { key: "dashboard", icon: "dashboard", label: "대시보드" },
    { key: "assets",    icon: "assets",    label: "자산관리" },
    { key: "members",   icon: "members",   label: "구성원 관리" },
    { key: "history",   icon: "history",   label: "이력 관리" },
    { key: "requests",  icon: "requests",  label: "요청 관리" },
    { key: "inspections", icon: "inspections", label: "정기 실사" },
  ];

  if (loading) return (
    <div style={{ display: "flex", height: "100vh", alignItems: "center", justifyContent: "center", background: C.bg, flexDirection: "column", gap: 16 }}>
      <div style={{ width: 40, height: 40, border: `3px solid ${C.border}`, borderTop: `3px solid ${C.primary}`, borderRadius: "50%", animation: "spin 0.8s linear infinite" }} />
      <p style={{ color: C.textLight, fontSize: 14 }}>데이터 불러오는 중...</p>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );

  if (!session) {
    return (
      <div style={{
        height: "100vh", display: "flex", alignItems: "center", justifyContent: "center",
        background: "linear-gradient(135deg, #0F172A 0%, #1E293B 100%)", fontFamily: "'Pretendard', sans-serif"
      }}>
        <div style={{
          width: "100%", maxWidth: 400, padding: 40, borderRadius: 24,
          background: "rgba(255, 255, 255, 0.05)", backdropFilter: "blur(12px)",
          border: "1px solid rgba(255, 255, 255, 0.1)", textAlign: "center",
          boxShadow: "0 20px 50px rgba(0,0,0,0.3)"
        }}>
          <div style={{ marginBottom: 32 }}>
            <div style={{ width: 64, height: 64, background: C.primary, borderRadius: 18, margin: "0 auto 16px", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 28, boxShadow: `0 8px 20px ${C.primary}44` }}>📦</div>
            <h1 style={{ color: "#fff", fontSize: 26, fontWeight: 800, margin: 0, letterSpacing: "-0.5px" }}>DURAE Assets</h1>
            <p style={{ color: "rgba(255,255,255,0.4)", fontSize: 14, marginTop: 10, fontWeight: 500 }}>Admin Authentication</p>
          </div>
          <form onSubmit={handleLoginWrapper} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <input
              type="email" placeholder="Admin Email" value={email} onChange={e => setEmail(e.target.value)}
              style={{ width: "100%", padding: "16px 20px", borderRadius: 14, border: "1px solid rgba(255,255,255,0.1)", background: "rgba(255,255,255,0.05)", color: "#fff", fontSize: 15, outline: "none" }}
            />
            <input
              type="password" placeholder="Password" value={password} onChange={e => setPassword(e.target.value)}
              style={{ width: "100%", padding: "16px 20px", borderRadius: 14, border: "1px solid rgba(255,255,255,0.1)", background: "rgba(255,255,255,0.05)", color: "#fff", fontSize: 15, outline: "none" }}
            />
            <button
              disabled={authLoading}
              style={{ width: "100%", padding: "16px", borderRadius: 14, border: "none", background: C.primary, color: "#fff", fontWeight: 700, cursor: "pointer", fontSize: 16, marginTop: 12, transition: "transform 0.2s" }}
              onMouseEnter={e => e.target.style.transform = "scale(1.02)"}
              onMouseLeave={e => e.target.style.transform = "scale(1)"}
            >
              {authLoading ? "Authenticating..." : "Sign In"}
            </button>
          </form>
        </div>
      </div>
    );
  } return (
    <div style={{ display: "flex", height: "100vh", fontFamily: "'Pretendard', 'Apple SD Gothic Neo', sans-serif", background: C.bg }}>
      <aside style={{ width: 224, background: C.sidebar, display: "flex", flexDirection: "column", flexShrink: 0 }}>
        <div style={{ padding: "28px 20px 24px", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
          <div onClick={() => setPage("dashboard")}
            style={{ display: "flex", alignItems: "center", gap: 10, cursor: "pointer" }}>
            <div style={{ width: 32, height: 32, borderRadius: 8, background: C.primary, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16 }}>📦</div>
            <span style={{ color: "#fff", fontWeight: 800, fontSize: 17, letterSpacing: "-0.3px" }}>DURAE Assets</span>
          </div>
        </div>
        <nav style={{ flex: 1, padding: "12px 10px" }}>
          <p style={{ fontSize: 10, fontWeight: 700, color: "rgba(255,255,255,0.25)", letterSpacing: "0.08em", padding: "8px 10px 4px", margin: 0 }}>MENU</p>
          {menuItems.map(({ key, icon, label }) => {
            const active = page === key;
            return (
              <div key={key} onClick={() => setPage(key)}
                style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 12px", borderRadius: 8, marginBottom: 2, cursor: "pointer", background: active ? C.sidebarActive : "transparent", transition: "background 0.15s" }}
                onMouseEnter={e => { if (!active) e.currentTarget.style.background = C.sidebarHover; }}
                onMouseLeave={e => { if (!active) e.currentTarget.style.background = "transparent"; }}>
                <Icon type={icon} active={active} />
                <span style={{ fontSize: 14, fontWeight: active ? 600 : 400, color: active ? "#fff" : "rgba(255,255,255,0.5)", letterSpacing: "-0.1px" }}>{label}</span>
                {key === "requests" && requests.filter(r => r.status === "대기중").length > 0 && (
                  <span style={{ marginLeft: "auto", background: "#F97316", color: "#fff", fontSize: 10, fontWeight: 700, padding: "2px 6px", borderRadius: 99 }}>
                    {requests.filter(r => r.status === "대기중").length}
                  </span>
                )}
                {active && key !== "requests" && <div style={{ marginLeft: "auto", width: 6, height: 6, borderRadius: "50%", background: C.primary }} />}
              </div>
            );
          })}
        </nav>
        <div style={{ padding: "12px 20px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <div style={{ width: 28, height: 28, borderRadius: "50%", background: permission === "admin" ? C.primary : permission === "manager" ? C.purple : "rgba(255,255,255,0.1)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 700, color: "#fff" }}>
              {currentUser ? currentUser.name[0] : "A"}
            </div>
            <div>
              <p style={{ margin: 0, fontSize: 12, fontWeight: 600, color: "#fff" }}>{currentUser ? currentUser.name : "관리자"}</p>
              <p style={{ margin: 0, fontSize: 10, color: "rgba(255,255,255,0.4)" }}>
                {permission === "admin" ? "총무관리자" : permission === "manager" ? "부서장" : "구성원"}
              </p>
            </div>
          </div>
        </div>
        <div style={{ padding: "16px 20px", borderTop: "1px solid rgba(255,255,255,0.06)" }}>
          <button
            onClick={fetchAllWrapper}
            style={{ width: "100%", padding: "8px", background: "rgba(59,130,246,0.1)", color: C.primary, border: "none", borderRadius: 6, fontSize: 12, fontWeight: 600, cursor: "pointer", marginBottom: 8 }}
          >
            ↺ 새로고침
          </button>
          <button
            onClick={() => supabase.auth.signOut()}
            style={{ width: "100%", padding: "8px", background: "rgba(239,68,68,0.1)", color: C.danger, border: "none", borderRadius: 6, fontSize: 12, fontWeight: 600, cursor: "pointer", marginBottom: 12 }}
          >
            Sign Out
          </button>
          <p style={{ margin: 0, fontSize: 11, color: "rgba(255,255,255,0.2)" }}>DURAE Assets v2.0.0</p>
        </div>
      </aside>
      {page === "dashboard" && <Dashboard assets={assets} members={members} history={history} permission={permission} userDept={userDept} onNavigate={(p, assetId) => { setPage(p); if (assetId) setFocusAssetId(assetId); }} />}
      {page === "assets" && <AssetPage assets={assets} setAssets={updateAssetsWrapper} history={history} members={members} permission={permission} userDept={userDept} requests={requests} setRequests={setRequestsState} currentUser={currentUser} focusAssetId={focusAssetId} onFocusCleared={() => setFocusAssetId(null)} />}
      {page === "members"   && <MemberPage members={members} setMembers={updateMembersWrapper} assets={assets} setAssets={updateAssetsWrapper} history={history} permission={permission} userDept={userDept} />}
      {page === "history" && <HistoryPage history={history} setHistory={setHistoryState} permission={permission} userDept={userDept} assets={assets} />}
      {page === "requests"  && <RequestPage requests={requests} setRequests={setRequestsState} assets={assets} setAssets={updateAssetsWrapper} members={members} permission={permission} userDept={userDept} currentUser={currentUser} />}
      {page === "inspections" && <InspectionPage inspections={inspections} setInspections={setInspectionsState} inspectionItems={inspectionItems} setInspectionItems={setInspectionItemsState} assets={assets} setAssets={updateAssetsWrapper} members={members} permission={permission} userDept={userDept} currentUser={currentUser} />}
    </div>
  );
}