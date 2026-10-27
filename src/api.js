const API_BASE = import.meta.env.VITE_API_BASE || "";
const TOKEN_KEY = "assethub_token";

export const getToken = () => localStorage.getItem(TOKEN_KEY);
export const setToken = (token) => localStorage.setItem(TOKEN_KEY, token);
export const clearToken = () => localStorage.removeItem(TOKEN_KEY);

async function request(path, { method = "GET", body, auth = true } = {}) {
  const headers = { "Content-Type": "application/json" };
  if (auth) {
    const token = getToken();
    if (token) headers["Authorization"] = `Bearer ${token}`;
  }
  const res = await fetch(`${API_BASE}${path}`, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) {
    let message = `요청 실패 (${res.status})`;
    try {
      const data = await res.json();
      if (typeof data?.detail === "string") message = data.detail;
      // pydantic 검증 오류는 배열로 온다
      else if (Array.isArray(data?.detail)) message = data.detail.map(d => `${d.loc?.at(-1)}: ${d.msg}`).join("\n");
    } catch {
      // 본문이 JSON이 아니면 기본 메시지 유지
    }
    const err = new Error(message);
    err.status = res.status;
    throw err;
  }
  if (res.status === 204) return null;
  return res.json();
}

const post = (path, body) => request(path, { method: "POST", body });
const patch = (path, body) => request(path, { method: "PATCH", body });

export const api = {
  login: (loginId, password) => request("/api/auth/login", { method: "POST", body: { loginId, password }, auth: false }),
  me: () => request("/api/auth/me"),
  bootstrap: () => request("/api/bootstrap"),
  health: () => request("/api/health", { auth: false }),
  tableCounts: () => request("/api/table_counts"),

  // 자산 쓰기는 의도만 보낸다. 이력은 서버가 만든다
  assets: {
    get: (id) => request(`/api/assets/${id}`),
    create: ({ fields, quantity, id, eventDate, memo }) => post("/api/assets", { fields, quantity, id, eventDate, memo }),
    update: (id, { fields, updatedAt, eventDate, memo, repair }) => patch(`/api/assets/${id}`, { fields, updatedAt, eventDate, memo, repair }),
    bulk: (ids, fields, memo) => post("/api/assets/bulk", { ids, fields, memo }),
    dispose: (id, method, reason) => post(`/api/assets/${id}/dispose`, { method, reason }),
    import: (rows, dryRun) => post(`/api/assets/import?dry_run=${dryRun ? 1 : 0}`, { rows }),
  },
  members: {
    create: (fields) => post("/api/members", fields),
    update: (id, fields, moveAssets = false) => patch(`/api/members/${id}`, { fields, moveAssets }),
    // dryRun=true: 검증 결과만(저장 안 함). false: 오류 0건일 때만 서버가 백업 후 저장
    import: (rows, dryRun) => post(`/api/members/import?dry_run=${dryRun ? 1 : 0}`, { rows }),
    // 권한을 줄 때 loginId 필수(이미 있으면 생략 가능). permission=null이면 아이디·비밀번호도 서버가 지운다
    setPermission: (id, permission, loginId) => patch(`/api/members/${id}/permission`, { permission, loginId }),
    retire: (id) => post(`/api/members/${id}/retire`, {}),
    resetPassword: (id, newPassword) => post(`/api/members/${id}/reset_password`, { new_password: newPassword }),
  },
  masters: {
    create: (kind, fields) => post(`/api/masters/${kind}`, fields),
    update: (kind, id, fields) => patch(`/api/masters/${kind}/${id}`, fields),
  },
  history: {
    delete: (id) => request(`/api/history/${id}`, { method: "DELETE" }),
  },
  requests: {
    create: (type, assetId, note) => post("/api/requests", { type, assetId, note }),
    resolve: (id, approve, resolvedNote) => post(`/api/requests/${id}/resolve`, { approve, resolvedNote }),
    delete: (id) => request(`/api/requests/${id}`, { method: "DELETE" }),
  },
};
