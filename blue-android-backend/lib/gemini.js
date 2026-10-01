const API_BASE = "https://generativelanguage.googleapis.com/v1beta/models";

function getConfig() {
  const apiKey = process.env.GEMINI_API_KEY || "";
  const model = process.env.GEMINI_MODEL || "gemini-2.0-flash";
  return { apiKey, model };
}

function requireKey() {
  const { apiKey } = getConfig();
  if (!apiKey) {
    const err = new Error(
      "GEMINI_API_KEY is not configured on the server. Set it in your Vercel project's environment variables."
    );
    err.code = "MISSING_API_KEY";
    throw err;
  }
}

function stripCodeFences(text) {
  return text
    .trim()
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/```$/i, "")
    .trim();
}

async function callGemini({ systemPrompt, userText, jsonMode = false }) {
  requireKey();
  const { apiKey, model } = getConfig();
  const url = `${API_BASE}/${model}:generateContent?key=${apiKey}`;

  const body = {
    contents: [{ role: "user", parts: [{ text: userText }] }],
    systemInstruction: systemPrompt ? { parts: [{ text: systemPrompt }] } : undefined,
    generationConfig: {
      temperature: jsonMode ? 0.2 : 0.7,
      ...(jsonMode ? { responseMimeType: "application/json" } : {}),
    },
  };

  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const errText = await res.text().catch(() => "");
    const err = new Error(`Gemini API error (${res.status}): ${errText.slice(0, 300)}`);
    err.status = res.status;
    throw err;
  }

  const data = await res.json();
  const text = (data.candidates?.[0]?.content?.parts || [])
    .map((p) => p.text || "")
    .join("")
    .trim();

  return { text, raw: data };
}

/**
 * Turns a natural-language command into a raw plan object (unvalidated —
 * the caller must run this through validatePlan before trusting it).
 */
async function planCommand({ command, deviceContext, actionListPrompt }) {
  const systemPrompt = `You are BLUE's command planner for an Android device assistant.
Given a user's natural-language command, respond with ONE JSON object describing exactly one action to take.

Allowed actions:
${actionListPrompt}

Rules:
- Respond with ONLY a JSON object: { "action": "<one of the allowed action names>", "params": { ... } }
- Do not invent actions outside the allowed list. If nothing fits, use "reply" with a helpful text explaining what you can't do.
- Do not include a riskLevel or requiresConfirmation field — the server decides those.
- If the command is just conversation/a question with no device action needed, use "reply".
- Keep "params" minimal and exactly matching what the action needs.`;

  const contextLine = deviceContext
    ? `\n\nDevice context (installed apps, current screen, etc.): ${JSON.stringify(deviceContext)}`
    : "";

  const { text } = await callGemini({
    systemPrompt,
    userText: `Command: ${command}${contextLine}`,
    jsonMode: true,
  });

  try {
    return JSON.parse(stripCodeFences(text));
  } catch {
    return null; // caller treats this as a planning failure
  }
}

/**
 * Plain conversational reply — no device action, used for the companion-chat side.
 */
async function chatReply({ message, history = [] }) {
  const systemPrompt = `You are BLUE, a friendly voice-first Android AI companion. Reply naturally and helpfully in the same language/style the user used (English, Hindi, or Hinglish). Keep replies concise since they may be read aloud via text-to-speech.`;

  const transcript = history
    .map((m) => `${m.role === "user" ? "User" : "BLUE"}: ${m.content}`)
    .join("\n");
  const userText = transcript ? `${transcript}\nUser: ${message}` : message;

  const { text } = await callGemini({ systemPrompt, userText, jsonMode: false });
  return text;
}

module.exports = { planCommand, chatReply, getConfig };
