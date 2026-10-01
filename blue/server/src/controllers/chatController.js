import { runAgent } from "../agents/agentEngine.js";
import {
  getConversation,
  createConversation,
  addMessage,
  historyForModel,
} from "../services/conversationService.js";

// Builds the text actually sent to the model: the user's message plus an
// explicit, machine-readable note about any uploaded attachments and their
// fileId, so the model can call file_reader itself. The clean, original
// `message` (without this note) is what gets stored/displayed for the user.
function buildModelMessage(message, attachments) {
  if (!attachments || attachments.length === 0) return message;
  const fileList = attachments
    .map((a) => `- fileId: "${a.fileId}", name: "${a.name}", type: "${a.type}"`)
    .join("\n");
  const note = `\n\n[Attached files available to you via the file_reader tool:\n${fileList}\nUse file_reader with the exact fileId above to read any of these before answering.]`;
  return `${message}${note}`;
}

// POST /api/agent/run  (also backs POST /api/chat)
export async function runAgentTurn(req, res, next) {
  try {
    const { message, conversationId, mode = "agent", attachments = [] } = req.body || {};

    if (!message || typeof message !== "string" || !message.trim()) {
      return res.status(400).json({ error: "A non-empty 'message' is required." });
    }

    let conversation = conversationId ? getConversation(conversationId) : null;
    if (!conversation) {
      const title = message.slice(0, 60);
      conversation = createConversation({ title, mode });
    }

    addMessage({
      conversationId: conversation.id,
      role: "user",
      content: message,
      attachments,
    });

    const history = historyForModel(conversation.id, 20).slice(0, -1); // exclude the message just added
    const steps = [];
    const modelMessage = buildModelMessage(message, attachments);

    const { text, toolCalls } = await runAgent({
      history,
      userMessage: modelMessage,
      mode,
      onStep: (s) => steps.push(s),
    });

    const assistantMessage = addMessage({
      conversationId: conversation.id,
      role: "assistant",
      content: text,
      steps,
      toolCalls,
    });

    res.json({
      conversationId: conversation.id,
      message: assistantMessage,
      steps,
    });
  } catch (err) {
    next(err);
  }
}
