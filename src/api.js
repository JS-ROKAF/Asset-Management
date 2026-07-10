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
      if (data?.detail) message = data.detail;
    } catch {}
    const err = new Error(message);
    err.status = res.status;
    throw err;
  }
  if (res.status === 204) return null;
  return res.json();
}

export const api = {
  login: (email, password) => request("/api/auth/login", { method: "POST", body: { email, password }, auth: false }),
  me: () => request("/api/auth/me"),
  bootstrap: () => request("/api/bootstrap"),
  health: () => request("/api/health", { auth: false }),
  tableCounts: () => request("/api/table_counts"),

  assets: {
    get: (id) => request(`/api/assets/${id}`),
    bulkInsert: (rows) => request("/api/assets/bulk_insert", { method: "POST", body: rows }),
    bulkDelete: (ids) => request("/api/assets/bulk_delete", { method: "POST", body: { ids } }),
    update: (id, fields) => request(`/api/assets/${id}`, { method: "PATCH", body: fields }),
  },
  members: {
    bulkInsert: (rows) => request("/api/members/bulk_insert", { method: "POST", body: rows }),
    bulkDelete: (ids) => request("/api/members/bulk_delete", { method: "POST", body: { ids } }),
    update: (id, fields) => request(`/api/members/${id}`, { method: "PATCH", body: fields }),
    resetPassword: (id, newPassword) => request(`/api/members/${id}/reset_password`, { method: "POST", body: { new_password: newPassword } }),
  },
  history: {
    list: () => request("/api/history"),
    bulkInsert: (rows) => request("/api/history/bulk_insert", { method: "POST", body: rows }),
    delete: (id) => request(`/api/history/${id}`, { method: "DELETE" }),
  },
  requests: {
    create: (fields) => request("/api/requests", { method: "POST", body: fields }),
    update: (id, fields) => request(`/api/requests/${id}`, { method: "PATCH", body: fields }),
    delete: (id) => request(`/api/requests/${id}`, { method: "DELETE" }),
  },
  inspections: {
    create: (fields) => request("/api/inspections", { method: "POST", body: fields }),
    update: (id, fields) => request(`/api/inspections/${id}`, { method: "PATCH", body: fields }),
    delete: (id) => request(`/api/inspections/${id}`, { method: "DELETE" }),
    current: () => request("/api/inspections/current"),
    itemsBulkInsert: (rows) => request("/api/inspections/items/bulk_insert", { method: "POST", body: rows }),
    items: (params = {}) => {
      const qs = new URLSearchParams(params).toString();
      return request(`/api/inspections/items${qs ? `?${qs}` : ""}`);
    },
    updateItem: (id, fields) => request(`/api/inspections/items/${id}`, { method: "PATCH", body: fields }),
  },
};
