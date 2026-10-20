// In production, set VITE_API_BASE_URL to your deployed backend's URL
// (e.g. https://blue-backend.onrender.com/api). In local dev this is left
// unset and the Vite dev server proxy handles "/api" -> localhost:8787.
const BASE = import.meta.env.VITE_API_BASE_URL || "/api";

function userFriendlyError(status, fallbackMessage, data) {
  if (status === 400) return data?.error || "The request could not be processed. Please check the message or uploaded files.";
  if (status === 401) return "Blue could not authenticate with the AI service. Please check the API configuration.";
  if (status === 403) return "The AI service rejected this request. Please check the project permissions or API access.";
  if (status === 404) return "The AI model or endpoint is unavailable. Please check the server configuration.";
  if (status === 408) return "The request timed out. Please try again with a shorter or simpler request.";
  if (status === 429) return data?.error || "Blue hit the AI rate limit. Please wait a moment and try again.";
  if ([502, 503, 504].includes(status)) return "The AI service is temporarily unavailable. Please try again shortly.";
  return data?.error || fallbackMessage;
}

async function request(path, options = {}) {
  const res = await fetch(`${BASE}${path}`, {
    headers: { "Content-Type": "application/json" },
    ...options,
  });
  const isJson = res.headers.get("content-type")?.includes("application/json");
  const data = isJson ? await res.json() : null;

  if (!res.ok) {
    throw new Error(userFriendlyError(res.status, `Request failed (HTTP ${res.status}).`, data));
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

  sendMessage: ({ message, conversationId, mode, attachments, signal }) =>
    request("/chat", {
      method: "POST",
      signal,
      body: JSON.stringify({ message, conversationId, mode, attachments }),
    }),

  uploadFiles: async (files, signal) => {
    const formData = new FormData();
    for (const f of files) formData.append("files", f);
    const res = await fetch(`${BASE}/files/upload`, { method: "POST", body: formData, signal });
    const data = await res.json();
    if (!res.ok) throw new Error(userFriendlyError(res.status, "Upload failed", data));
    return data;
  },
};
