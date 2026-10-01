const { z } = require("zod");

// This is the ONLY set of actions the backend will ever hand back to the app.
// If Gemini proposes anything outside this list, it is rejected before the
// app ever sees it. Risk tiers are fixed here — the model does not get to
// decide how risky an action is.
//
// riskLevel:
//   "low"    -> app may execute immediately
//   "medium" -> app MUST show a confirmation dialog with the exact content first
//   "high"   -> app MUST show confirmation + a secondary explicit step (e.g. re-type/biometric)
//
// "reply" is the special no-device-action case: BLUE just wants to say something
// back to the user (e.g. answering a question) without touching the phone.

const ACTIONS = {
  reply: {
    riskLevel: "low",
    description: "Just say something back to the user; no device action is taken.",
    schema: z.object({
      text: z.string().min(1),
    }),
  },

  open_app: {
    riskLevel: "low",
    description: "Open an installed app by name or package id.",
    schema: z.object({
      appName: z.string().min(1),
    }),
  },

  search_web: {
    riskLevel: "low",
    description: "Search the web for information.",
    schema: z.object({
      query: z.string().min(1),
    }),
  },

  read_notifications: {
    riskLevel: "low",
    description: "Read the user's recent notifications back to them.",
    schema: z.object({
      appFilter: z.string().optional(),
    }),
  },

  send_sms: {
    riskLevel: "medium",
    description: "Send an SMS text message to a contact.",
    schema: z.object({
      contact: z.string().min(1),
      message: z.string().min(1),
    }),
  },

  send_whatsapp_message: {
    riskLevel: "medium",
    description: "Send a WhatsApp message to a contact.",
    schema: z.object({
      contact: z.string().min(1),
      message: z.string().min(1),
    }),
  },

  make_call: {
    riskLevel: "medium",
    description: "Place a phone call to a contact.",
    schema: z.object({
      contact: z.string().min(1),
    }),
  },

  read_file: {
    riskLevel: "low",
    description: "Read a file's contents from device storage.",
    schema: z.object({
      path: z.string().min(1),
    }),
  },

  delete_file: {
    riskLevel: "high",
    description: "Permanently delete a file from device storage.",
    schema: z.object({
      path: z.string().min(1),
    }),
  },
};

function riskRequiresConfirmation(riskLevel) {
  return riskLevel === "medium" || riskLevel === "high";
}

function actionListForPrompt() {
  return Object.entries(ACTIONS)
    .map(([name, def]) => `- ${name} (${def.riskLevel} risk): ${def.description}`)
    .join("\n");
}

module.exports = { ACTIONS, riskRequiresConfirmation, actionListForPrompt };
