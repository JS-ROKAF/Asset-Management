// bootstrap 원본(FK id)에 화면 표시용 이름 칸을 덧붙인다.
// 덧붙인 칸(user, department, type, from, to …)은 표시 전용 — 저장 요청에는 항상 id 칸(memberId, departmentId …)을 쓸 것
export function enrich(data) {
  const byId = (rows) => new Map(rows.map(r => [r.id, r]));
  const corps = byId(data.corporations);
  const depts = byId(data.departments);
  const types = byId(data.assetTypes);
  const deptName = (id) => depts.get(id)?.name ?? "-";

  const members = data.members.map(m => ({
    ...m,
    department: deptName(m.departmentId),
    role: m.position || "-",
  }));
  const memberMap = byId(members);
  const memberName = (id) => memberMap.get(id)?.name ?? "-";

  const assets = data.assets.map(a => ({
    ...a,
    user: memberName(a.memberId),
    department: deptName(a.departmentId),
    type: types.get(a.typeId)?.name ?? "-",
    typeCode: types.get(a.typeId)?.code,
    corporation: corps.get(a.corporationId)?.code ?? "-",
    date: a.createdAt,
  }));
  const assetMap = byId(assets);

  const history = data.history.map(h => ({
    ...h,
    assetName: assetMap.get(h.assetId)?.name || h.assetId,
    from: memberName(h.fromMemberId),
    to: memberName(h.toMemberId),
    date: h.eventDate,
    memo: h.note,
    note: [h.detail, h.note].filter(Boolean).join(" | "),
    recordedByName: memberName(h.recordedBy),
  }));

  const requests = data.requests.map(r => ({
    ...r,
    assetName: assetMap.get(r.assetId)?.name || r.assetId,
    requesterName: memberName(r.requesterId),
    targetUser: memberName(r.targetMemberId ?? r.requesterId),
  }));

  return {
    corporations: data.corporations,
    departments: data.departments,
    assetTypes: data.assetTypes,
    assets, members, history, requests,
  };
}
