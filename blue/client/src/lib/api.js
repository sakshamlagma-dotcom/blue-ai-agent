// In production, set VITE_API_BASE_URL to your deployed backend's URL
// (e.g. https://blue-backend.onrender.com/api). In local dev this is left
// unset and the Vite dev server proxy handles "/api" -> localhost:8787.
const BASE = import.meta.env.VITE_API_BASE_URL || "/api";

async function request(path, options = {}) {
  const res = await fetch(`${BASE}${path}`, {
    headers: { "Content-Type": "application/json" },
    ...options,
  });
  const isJson = res.headers.get("content-type")?.includes("application/json");
  const data = isJson ? await res.json() : null;
  if (!res.ok) {
    const message = [502, 503, 504].includes(res.status)
      ? `The server is temporarily unavailable (HTTP ${res.status}). Please try again shortly.`
      : `Request failed (HTTP ${res.status}).`;
    throw new Error(data?.error || message);
  }
  return data;
}

export const api = {
  health: () => request("/health"),

  listConversations: () => request("/conversations"),
  getConversation: (id) => request(`/conversations/${id}`),
  renameConversation: (id, title) =>
    request(`/conversations/${id}`, { method: "PATCH", body: JSON.stringify({ title }) }),
  setConversationMode: (id, mode) =>
    request(`/conversations/${id}`, { method: "PATCH", body: JSON.stringify({ mode }) }),
  deleteConversation: (id) => request(`/conversations/${id}`, { method: "DELETE" }),

  sendMessage: ({ message, conversationId, mode, attachments }) =>
    request("/chat", {
      method: "POST",
      body: JSON.stringify({ message, conversationId, mode, attachments }),
    }),

  uploadFiles: async (files) => {
    const formData = new FormData();
    for (const f of files) formData.append("files", f);
    const res = await fetch(`${BASE}/files/upload`, { method: "POST", body: formData });
    const data = await res.json();
    if (!res.ok) throw new Error(data?.error || "Upload failed");
    return data;
  },
};
