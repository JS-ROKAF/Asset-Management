import React, { useState } from "react";
import { supabase } from "../../supabase";
import { C } from "../../constants";
import Icon from "../common/Icon";
// ⬇ 배경 제거된 투명 PNG 파일로 교체하세요
import logo from "../../assets/DURAE_AI_transparent.png";

// ── 메뉴 아이템 컴포넌트 ──
function MenuItem({ item, active, badgeCount, onClick, collapsed }) {
  const { key, icon, label } = item;
  const hasBadge = badgeCount > 0;

  return (
    <button
      onClick={() => onClick(key)}
      aria-current={active ? "page" : undefined}
      title={collapsed ? label : undefined}
      className={[
        "flex items-center w-full rounded-lg mb-0.5",
        "text-left text-sm transition-colors duration-150 outline-none",
        "border-l-[3px]",
        collapsed ? "justify-center px-0 py-2.5" : "gap-2.5 px-3 py-2.5",
        active
          ? "font-semibold text-white"
          : "border-transparent font-normal text-white/50 hover:text-white/80",
      ].join(" ")}
      style={{
        background: active ? C.sidebarActive : "transparent",
        borderLeftColor: active ? C.primary : "transparent",
      }}
      onFocus={(e) => {
        if (!active) e.currentTarget.style.background = C.sidebarHover;
      }}
      onBlur={(e) => {
        if (!active) e.currentTarget.style.background = "transparent";
      }}
    >
      {/* 아이콘 — collapsed 시 뱃지를 아이콘에 겹쳐 표시 */}
      <span className="relative flex-shrink-0">
        <Icon type={icon} active={active} />
        {collapsed && hasBadge && (
          <span
            className="absolute -top-1 -right-1 w-2 h-2 rounded-full"
            style={{ background: "#F97316" }}
            aria-label={`${badgeCount}건`}
          />
        )}
      </span>

      {/* 라벨 + 뱃지 — expanded 시에만 표시 */}
      {!collapsed && (
        <>
          <span className="flex-1 tracking-tight">{label}</span>

          {/* 요청 대기 뱃지 */}
          {hasBadge && (
            <span
              className="ml-auto text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full"
              style={{ background: "#F97316" }}
              aria-label={`대기 중 ${badgeCount}건`}
            >
              {badgeCount}
            </span>
          )}

          {/* 활성 인디케이터 점 (뱃지 없는 활성 메뉴) */}
          {active && !hasBadge && (
            <span
              className="ml-auto w-1.5 h-1.5 rounded-full flex-shrink-0"
              style={{ background: C.primary }}
              aria-hidden="true"
            />
          )}
        </>
      )}
    </button>
  );
}

// ── 유저 아바타 컴포넌트 ──
function UserAvatar({ currentUser, permission, size = 7 }) {
  const bgColor =
    permission === "admin"
      ? C.primary
      : permission === "manager"
      ? C.purple
      : "rgba(255,255,255,0.1)";

  const initial = currentUser ? currentUser.name[0] : "A";
  const sizeClass = size === 8 ? "w-8 h-8" : "w-7 h-7";

  return (
    <div
      className={`${sizeClass} rounded-full flex items-center justify-center text-xs font-bold text-white flex-shrink-0`}
      style={{ background: bgColor }}
      aria-hidden="true"
    >
      {initial}
    </div>
  );
}

// ── 권한 라벨 ──
function permissionLabel(permission) {
  if (permission === "admin") return "총무관리자";
  if (permission === "manager") return "부서장";
  return "구성원";
}

// ── 메인 Sidebar 컴포넌트 ──
export default function Sidebar({
  page,
  setPage,
  menuItems,
  requests,
  inspections,      // 정기 실사 데이터 (미완료 뱃지용)
  currentUser,
  permission,
  onRefresh,
}) {
  const [collapsed, setCollapsed] = useState(false);

  // 뱃지 카운트 계산
  const pendingRequestCount = requests.filter((r) => r.status === "대기중").length;
  const pendingInspectionCount = (inspections ?? []).filter(
    (i) => i.status === "진행중" || i.status === "대기"
  ).length;

  const getBadgeCount = (key) => {
    if (key === "requests") return pendingRequestCount;
    if (key === "inspections") return pendingInspectionCount;
    return 0;
  };

  const sidebarWidth = collapsed ? 64 : 224;

  return (
    <aside
      className="flex flex-col flex-shrink-0 transition-all duration-200"
      style={{ width: sidebarWidth, background: C.sidebar }}
      aria-label="사이드 내비게이션"
    >
      {/* ── 로고 + 토글 버튼 영역 ── */}
      <div
        style={{
          paddingTop: 16,
          paddingBottom: 16,
          borderBottom: "1px solid rgba(255,255,255,0.06)",
          position: "relative",
        }}
        className={collapsed ? "px-2" : "px-3"}
      >
        {/* 로고 (expanded 시에만) */}
        {!collapsed && (
          <div
            className="cursor-pointer"
            onClick={() => setPage("dashboard")}
            role="link"
            aria-label="대시보드로 이동"
            tabIndex={0}
            onKeyDown={(e) => e.key === "Enter" && setPage("dashboard")}
          >
            <img
              src={logo}
              alt="DURAE Assets 로고"
              className="object-contain w-full"
              style={{ maxHeight: 130 }}
            />
          </div>
        )}

        {/* collapsed 시 아바타를 로고 대신 표시 */}
        {collapsed && (
          <div className="flex justify-center py-1">
            <UserAvatar currentUser={currentUser} permission={permission} size={8} />
          </div>
        )}

        {/* 토글 버튼 */}
        <button
          onClick={() => setCollapsed((v) => !v)}
          aria-label={collapsed ? "메뉴 펼치기" : "메뉴 접기"}
          className="absolute -right-3 top-1/2 -translate-y-1/2 w-6 h-6 rounded-full flex items-center justify-center text-xs transition-colors duration-150 hover:opacity-90 cursor-pointer z-10"
          style={{
            background: C.primary,
            color: "#fff",
            border: "none",
            boxShadow: "0 2px 6px rgba(0,0,0,0.3)",
          }}
        >
          {collapsed ? "›" : "‹"}
        </button>
      </div>

      {/* ── 네비게이션 메뉴 ── */}
      <nav
        className="flex-1 overflow-y-auto"
        style={{ padding: collapsed ? "12px 6px" : "12px 10px" }}
        aria-label="메인 메뉴"
      >
        {!collapsed && (
          <p
            className="text-[10px] font-bold tracking-widest uppercase"
            style={{
              color: "rgba(255,255,255,0.25)",
              padding: "8px 10px 4px",
              margin: 0,
            }}
            aria-hidden="true"
          >
            MENU
          </p>
        )}
        <ul className="list-none p-0 m-0" role="list">
          {menuItems.map((item) => (
            <li key={item.key} role="listitem">
              <MenuItem
                item={item}
                active={page === item.key}
                badgeCount={getBadgeCount(item.key)}
                onClick={setPage}
                collapsed={collapsed}
              />
            </li>
          ))}
        </ul>
      </nav>

      {/* ── 유저 정보 + 로그아웃 ── */}
      <div
        style={{
          padding: collapsed ? "12px 6px" : "12px 16px",
          borderTop: "1px solid rgba(255,255,255,0.06)",
        }}
      >
        {collapsed ? (
          /* collapsed: 아바타만 */
          <div className="flex justify-center">
            <UserAvatar currentUser={currentUser} permission={permission} />
          </div>
        ) : (
          /* expanded: 유저 정보 + 로그아웃 아이콘 버튼 */
          <div className="flex items-center gap-2">
            <UserAvatar currentUser={currentUser} permission={permission} />
            <div className="min-w-0 flex-1">
              <p
                className="m-0 text-xs font-semibold text-white truncate"
                title={currentUser?.name}
              >
                {currentUser ? currentUser.name : "관리자"}
              </p>
              <p
                className="m-0 text-[10px] truncate"
                style={{ color: "rgba(255,255,255,0.4)" }}
              >
                {permissionLabel(permission)}
              </p>
            </div>
            {/* 로그아웃 아이콘 버튼 */}
            <button
              onClick={() => supabase.auth.signOut()}
              title="로그아웃"
              aria-label="로그아웃"
              className="flex-shrink-0 w-7 h-7 rounded-md flex items-center justify-center transition-colors duration-150 hover:opacity-80 cursor-pointer"
              style={{
                background: "rgba(239,68,68,0.15)",
                color: C.danger,
                border: "none",
                fontSize: 14,
              }}
            >
              ⏻
            </button>
          </div>
        )}
      </div>

      {/* ── 새로고침 + 버전 ── */}
      <div
        style={{
          padding: collapsed ? "10px 6px" : "10px 16px 14px",
          borderTop: "1px solid rgba(255,255,255,0.06)",
        }}
      >
        <button
          onClick={onRefresh}
          title="새로고침"
          aria-label="데이터 새로고침"
          className={[
            "transition-opacity duration-150 hover:opacity-80 cursor-pointer rounded-md text-xs font-semibold",
            collapsed
              ? "w-full flex items-center justify-center py-2"
              : "w-full py-2",
          ].join(" ")}
          style={{
            background: "rgba(59,130,246,0.1)",
            color: C.primary,
            border: "none",
          }}
        >
          ↺{!collapsed && " 새로고침"}
        </button>

        {!collapsed && (
          <p
            className="m-0 text-[10px] mt-2"
            style={{ color: "rgba(255,255,255,0.2)" }}
          >
            DURAE Assets v2.0.0
          </p>
        )}
      </div>
    </aside>
  );
}