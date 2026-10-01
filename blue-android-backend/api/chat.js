const { chatReply } = require("../lib/gemini");

module.exports = async (req, res) => {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Use POST." });
  }

  const { message, history } = req.body || {};

  if (!message || typeof message !== "string" || !message.trim()) {
    return res.status(400).json({ error: "A non-empty 'message' string is required." });
  }

  try {
    const text = await chatReply({ message: message.trim(), history: Array.isArray(history) ? history : [] });
    res.status(200).json({ text });
  } catch (err) {
    if (err.code === "MISSING_API_KEY") {
      return res.status(503).json({
        error: "BLUE's backend isn't connected to the AI service yet. Please check the server configuration.",
      });
    }
    console.error("[chat] Gemini call failed:", err);
    res.status(502).json({ error: "BLUE couldn't reach the AI service. Please try again." });
  }
};
