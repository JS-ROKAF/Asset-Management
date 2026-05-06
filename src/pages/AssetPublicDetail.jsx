import { useEffect, useState } from "react";
import { supabase } from "../supabase";

const statusColor = {
  "사용중":   { bg: "#DCFCE7", text: "#16A34A" },
  "보관중":   { bg: "#DBEAFE", text: "#2563EB" },
  "수리중":   { bg: "#FEF9C3", text: "#CA8A04" },
  "폐기":     { bg: "#FEE2E2", text: "#DC2626" },
};

export default function AssetPublicDetail({ assetId }) {
  const [asset, setAsset] = useState(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    supabase
      .from("assets")
      .select("*")
      .eq("id", assetId)
      .single()
      .then(({ data, error }) => {
        if (error || !data) setNotFound(true);
        else setAsset(data);
        setLoading(false);
      });
  }, [assetId]);

  if (loading) return (
    <div style={styles.center}>
      <div style={styles.spinner} />
      <p style={{ color: "#94A3B8", fontSize: 14, marginTop: 12 }}>자산 정보 불러오는 중...</p>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );

  if (notFound) return (
    <div style={styles.center}>
      <p style={{ fontSize: 40 }}>🔍</p>
      <p style={{ fontWeight: 700, fontSize: 18, margin: "8px 0 4px" }}>자산을 찾을 수 없습니다</p>
      <p style={{ color: "#94A3B8", fontSize: 14 }}>QR코드가 올바른지 확인해주세요.</p>
    </div>
  );

  const sc = statusColor[asset.status] || { bg: "#F1F5F9", text: "#64748B" };

  const rows = [
    ["자산번호",   asset.id?.slice(0, 8)],
    ["모델명",     asset.model],
    ["시리얼",     asset.serial],
    ["유형",       asset.type],
    ["부서",       asset.department],
    ["위치",       asset.location],
    ["사용자",     asset.user],
    ["구매일",     asset.purchaseDate],
    ["구매금액",   asset.purchaseCost ? Number(asset.purchaseCost).toLocaleString() + "원" : null],
    ["공급업체",   asset.vendor],
    ["보증만료",   asset.warrantyExpiry],
    ["비고",       asset.note],
  ];

  return (
    <div style={styles.page}>
      <div style={styles.card}>
        {/* 헤더 */}
        <div style={styles.header}>
          <p style={styles.typeLabel}>{asset.type || "기타"}</p>
          <h1 style={styles.title}>{asset.name}</h1>
          <span style={{ ...styles.badge, background: sc.bg, color: sc.text }}>
            {asset.status || "상태 미지정"}
          </span>
        </div>

        {/* 구분선 */}
        <hr style={{ border: "none", borderTop: "1px solid #F1F5F9", margin: "0" }} />

        {/* 정보 목록 */}
        <div style={styles.body}>
          {rows.map(([label, value]) =>
            value ? (
              <div key={label} style={styles.row}>
                <span style={styles.label}>{label}</span>
                <span style={styles.value}>{value}</span>
              </div>
            ) : null
          )}
        </div>

        {/* 푸터 */}
        <div style={styles.footer}>
          <p style={{ margin: 0, fontSize: 11, color: "#CBD5E1" }}>
            📅 등록일: {asset.date || "-"}
          </p>
        </div>
      </div>
    </div>
  );
}

const styles = {
  page: {
    minHeight: "100vh",
    background: "#F8FAFC",
    display: "flex",
    alignItems: "flex-start",
    justifyContent: "center",
    padding: "40px 16px",
    fontFamily: "'Pretendard', 'Apple SD Gothic Neo', sans-serif",
  },
  card: {
    width: "100%",
    maxWidth: 420,
    background: "#fff",
    borderRadius: 16,
    border: "1px solid #E2E8F0",
    boxShadow: "0 4px 24px rgba(0,0,0,0.06)",
    overflow: "hidden",
  },
  header: {
    padding: "24px 24px 20px",
    display: "flex",
    flexDirection: "column",
    gap: 6,
  },
  typeLabel: {
    margin: 0,
    fontSize: 12,
    color: "#94A3B8",
    fontWeight: 500,
  },
  title: {
    margin: 0,
    fontSize: 22,
    fontWeight: 700,
    color: "#0F172A",
  },
  badge: {
    alignSelf: "flex-start",
    padding: "3px 10px",
    borderRadius: 99,
    fontSize: 12,
    fontWeight: 600,
  },
  body: {
    padding: "8px 24px 16px",
    display: "flex",
    flexDirection: "column",
  },
  row: {
    display: "flex",
    justifyContent: "space-between",
    padding: "10px 0",
    borderBottom: "1px solid #F8FAFC",
    gap: 12,
  },
  label: {
    fontSize: 13,
    color: "#94A3B8",
    flexShrink: 0,
    width: 72,
  },
  value: {
    fontSize: 13,
    color: "#0F172A",
    fontWeight: 500,
    textAlign: "right",
    wordBreak: "break-all",
  },
  footer: {
    padding: "12px 24px",
    background: "#F8FAFC",
    textAlign: "right",
  },
  center: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    height: "100vh",
    fontFamily: "'Pretendard', sans-serif",
  },
  spinner: {
    width: 36,
    height: 36,
    border: "3px solid #E2E8F0",
    borderTop: "3px solid #6366F1",
    borderRadius: "50%",
    animation: "spin 0.8s linear infinite",
  },
};