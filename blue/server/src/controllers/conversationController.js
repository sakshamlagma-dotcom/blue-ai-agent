import {
  listConversations,
  getConversation,
  updateConversation,
  deleteConversation,
  listMessages,
} from "../services/conversationService.js";

export function getAllConversations(req, res) {
  res.json({ conversations: listConversations() });
}

export function getOneConversation(req, res) {
  const conversation = getConversation(req.params.id);
  if (!conversation) return res.status(404).json({ error: "Conversation not found." });
  res.json({ conversation, messages: listMessages(conversation.id) });
}

export function patchConversation(req, res) {
  const { title, mode } = req.body || {};
  const updated = updateConversation(req.params.id, { title, mode });
  if (!updated) return res.status(404).json({ error: "Conversation not found." });
  res.json({ conversation: updated });
}

export function removeConversation(req, res) {
  const existing = getConversation(req.params.id);
  if (!existing) return res.status(404).json({ error: "Conversation not found." });
  deleteConversation(req.params.id);
  res.status(204).end();
}
