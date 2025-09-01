const BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:4000";

async function http(path, { method = "GET", body, headers } = {}) {
  const res = await fetch(`${BASE_URL}${path}`, {
    method,
    headers: { "Content-Type": "application/json", ...(headers || {}) },
    body: body ? JSON.stringify(body) : undefined,
    credentials: "include"
  });
  let data = null;
  try { data = await res.json(); } catch {}
  if (!res.ok) throw new Error(data?.message || `Erro ${res.status}`);
  return data;
}

export const api = {
  signup: (payload) => http("/api/auth/signup", { method: "POST", body: payload }),
  login:  (payload) => http("/api/auth/login",  { method: "POST", body: payload }),
  health: () => http("/api/health")
};
