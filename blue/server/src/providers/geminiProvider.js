import { env } from "../config/env.js";

const API_BASE = "https://generativelanguage.googleapis.com/v1beta/models";

function requireKey() {
  if (!env.geminiApiKey) {
    const err = new Error(
      "GEMINI_API_KEY is not configured. Add it to server/.env to enable AI responses."
    );
    err.code = "MISSING_API_KEY";
    throw err;
  }
}

// Converts Blue's internal message format into Gemini's `contents` format.
// A "tool" message carries `results`: an array of {name, content} — one per
// function call the model made in its preceding turn — so that a turn with
// multiple tool calls is represented as a single turn with multiple
// functionResponse parts, matching what the Gemini API expects.
function toGeminiContents(messages) {
  return messages.map((m) => {
    if (m.role === "tool") {
      return {
        role: "user",
        parts: (m.results || []).map((r) => ({
          functionResponse: {
            name: r.name,
            response: { result: r.content },
          },
        })),
      };
    }
    return {
      role: m.role === "assistant" ? "model" : "user",
      parts: m.parts || [{ text: m.content || "" }],
    };
  });
}

function toGeminiTools(tools) {
  if (!tools || tools.length === 0) return undefined;
  return [
    {
      functionDeclarations: tools.map((t) => ({
        name: t.name,
        description: t.description,
        parameters: t.inputSchema,
      })),
    },
  ];
}

async function callGemini({ contents, systemPrompt, tools, temperature = 0.6 }) {
  requireKey();
  const url = `${API_BASE}/${env.geminiModel}:generateContent?key=${env.geminiApiKey}`;
  const body = {
    contents,
    systemInstruction: systemPrompt
      ? { role: "system", parts: [{ text: systemPrompt }] }
      : undefined,
    tools: toGeminiTools(tools),
    generationConfig: { temperature },
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
  const candidate = data.candidates?.[0];
  const parts = candidate?.content?.parts || [];

  const textParts = parts.filter((p) => typeof p.text === "string").map((p) => p.text);
  const functionCalls = parts
    .filter((p) => p.functionCall)
    .map((p) => ({ name: p.functionCall.name, args: p.functionCall.args || {} }));

  return {
    text: textParts.join("\n").trim(),
    toolCalls: functionCalls,
    finishReason: candidate?.finishReason,
    raw: data,
  };
}

async function generate({ messages, systemPrompt, tools, temperature }) {
  const contents = toGeminiContents(messages);
  return callGemini({ contents, systemPrompt, tools, temperature });
}

// imageParts: [{ mimeType, base64 }]
async function generateVision({ messages, imageParts = [], systemPrompt }) {
  const contents = toGeminiContents(messages);
  // Attach images to the last user turn
  const last = contents[contents.length - 1];
  if (last && last.role === "user") {
    for (const img of imageParts) {
      last.parts.push({ inlineData: { mimeType: img.mimeType, data: img.base64 } });
    }
  }
  return callGemini({ contents, systemPrompt });
}

export const geminiProvider = {
  name: "gemini",
  generate,
  generateVision,
};
