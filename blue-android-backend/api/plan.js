const { planCommand } = require("../lib/gemini");
const { validatePlan } = require("../lib/validatePlan");
const { actionListForPrompt } = require("../lib/actionSchema");

function sendError(res, status, message) {
  res.status(status).json({ error: message });
}

module.exports = async (req, res) => {
  if (req.method !== "POST") {
    return sendError(res, 405, "Use POST.");
  }

  const { command, deviceContext } = req.body || {};

  if (!command || typeof command !== "string" || !command.trim()) {
    return sendError(res, 400, "A non-empty 'command' string is required.");
  }

  let rawPlan;
  try {
    rawPlan = await planCommand({
      command: command.trim(),
      deviceContext,
      actionListPrompt: actionListForPrompt(),
    });
  } catch (err) {
    if (err.code === "MISSING_API_KEY") {
      return sendError(
        res,
        503,
        "BLUE's backend isn't connected to the AI service yet. Please check the server configuration."
      );
    }
    console.error("[plan] Gemini call failed:", err);
    return sendError(res, 502, "BLUE couldn't reach the AI service. Please try again.");
  }

  if (!rawPlan) {
    // Fail closed: if we can't parse a plan, tell the user rather than guessing.
    return res.status(200).json({
      action: "reply",
      params: { text: "I didn't quite catch an actionable command in that — could you rephrase it?" },
      riskLevel: "low",
      requiresConfirmation: false,
    });
  }

  const validated = validatePlan(rawPlan);
  if (!validated.ok) {
    // The model proposed something outside the allow-list or with bad params.
    // Fail closed with a safe "reply" plan instead of passing anything untrusted to the app.
    console.warn("[plan] Rejected model plan:", validated.reason, rawPlan);
    return res.status(200).json({
      action: "reply",
      params: {
        text: "I understood what you want, but I'm not able to do that safely yet.",
      },
      riskLevel: "low",
      requiresConfirmation: false,
      _rejectedReason: validated.reason, // useful for your own debugging/audit log, not shown to user
    });
  }

  res.status(200).json(validated.plan);
};
