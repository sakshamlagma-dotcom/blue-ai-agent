import { nanoid } from "nanoid";
import db from "../db/db.js";

const now = () => new Date().toISOString();

export function createConversation({ title = "New chat", mode = "agent" } = {}) {
  const id = nanoid();
  const ts = now();
  db.prepare(
    `INSERT INTO conversations (id, title, mode, created_at, updated_at) VALUES (?, ?, ?, ?, ?)`
  ).run(id, title, mode, ts, ts);
  return getConversation(id);
}

export function getConversation(id) {
  return db.prepare(`SELECT * FROM conversations WHERE id = ?`).get(id);
}

export function listConversations() {
  return db.prepare(`SELECT * FROM conversations ORDER BY updated_at DESC`).all();
}

export function updateConversation(id, fields) {
  const existing = getConversation(id);
  if (!existing) return null;
  const title = fields.title ?? existing.title;
  const mode = fields.mode ?? existing.mode;
  db.prepare(
    `UPDATE conversations SET title = ?, mode = ?, updated_at = ? WHERE id = ?`
  ).run(title, mode, now(), id);
  return getConversation(id);
}

export function touchConversation(id) {
  db.prepare(`UPDATE conversations SET updated_at = ? WHERE id = ?`).run(now(), id);
}

export function deleteConversation(id) {
  db.prepare(`DELETE FROM conversations WHERE id = ?`).run(id);
}

export function listMessages(conversationId) {
  return db
    .prepare(`SELECT * FROM messages WHERE conversation_id = ? ORDER BY created_at ASC`)
    .all(conversationId)
    .map(deserializeMessage);
}

export function addMessage({
  conversationId,
  role,
  content,
  attachments = [],
  steps = [],
  toolCalls = [],
}) {
  const id = nanoid();
  const ts = now();
  db.prepare(
    `INSERT INTO messages (id, conversation_id, role, content, attachments, steps, tool_calls, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    id,
    conversationId,
    role,
    content,
    JSON.stringify(attachments || []),
    JSON.stringify(steps || []),
    JSON.stringify(toolCalls || []),
    ts
  );
  touchConversation(conversationId);
  return deserializeMessage(
    db.prepare(`SELECT * FROM messages WHERE id = ?`).get(id)
  );
}

function deserializeMessage(row) {
  if (!row) return row;
  return {
    ...row,
    attachments: safeParse(row.attachments, []),
    steps: safeParse(row.steps, []),
    tool_calls: safeParse(row.tool_calls, []),
  };
}

function safeParse(json, fallback) {
  try {
    return JSON.parse(json ?? "");
  } catch {
    return fallback;
  }
}

export function historyForModel(conversationId, limit = 20) {
  const rows = listMessages(conversationId).slice(-limit);
  return rows
    .filter((m) => m.role === "user" || m.role === "assistant")
    .map((m) => ({ role: m.role, content: m.content }));
}
