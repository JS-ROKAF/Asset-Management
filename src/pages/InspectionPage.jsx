import React from "react";
import { PageHeader } from "../components/common";
import { C } from "../constants";

// ponytail: 실사 흐름은 2단계(설계안 4-3)에서 inspection_checks 기반으로 재설계. 그때까지 안내만 표시
export default function InspectionPage() {
  return (
    <main style={{ flex: 1, padding: "36px 40px", overflowY: "auto" }}>
      <PageHeader title="정기 실사" subtitle="자산 보유 현황을 주기적으로 확인하세요" />
      <div style={{ background: C.card, borderRadius: 12, padding: 40, textAlign: "center", boxShadow: "0 1px 4px rgba(0,0,0,0.06)" }}>
        <p style={{ margin: 0, fontSize: 15, fontWeight: 600, color: C.text }}>실사 기능을 새 구조에 맞춰 다시 만드는 중입니다</p>
        <p style={{ margin: "8px 0 0", fontSize: 13, color: C.textMuted }}>11월 실사 일정 전에 QR 현장 체크와 함께 제공됩니다.</p>
      </div>
    </main>
  );
}
