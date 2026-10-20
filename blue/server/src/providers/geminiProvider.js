import { env, getGeminiModelName } from "../config/env.js";

const API_BASE = "https://generativelanguage.googleapis.com/v1beta/models";
const RETRYABLE_STATUSES = new Set([500, 502, 503, 504]);
const RETRY_DELAYS_MS = [250, 500];

function requireKey() {
  if (!env.geminiApiKey) {
    const err = new Error(
      "GEMINI_API_KEY is not configured. Add it to server/.env to enable AI responses."
    );
    err.code = "MISSING_API_KEY";
    throw err;
  }
}

function getRetryAfterMs(response) {
  const retryAfter = response.headers?.get?.("retry-after");
  if (!retryAfter) return 0;

  const seconds = Number.parseInt(retryAfter, 10);
  if (Number.isFinite(seconds)) return seconds * 1000;

  const dateMs = Date.parse(retryAfter);
  return Number.isFinite(dateMs) ? Math.max(0, dateMs - Date.now()) : 0;
}

function safeJsonParse(raw) {
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function buildProviderError(status, responseText) {
  const parsed = safeJsonParse(responseText) || {};
  const googleMessage = parsed?.error?.message || parsed?.message || "";
  const normalized = String(googleMessage || responseText || "").replace(/\s+/g, " ").trim();

  const err = new Error(
    status === 400
      ? "The AI request was invalid. Please check the message or uploaded files and try again."
      : status === 401 || status === 403
        ? "Blue could not authenticate with the Gemini API. Please check the API key and Google project permissions."
        : status === 404
          ? "The configured Gemini model or endpoint is unavailable. Check GEMINI_MODEL and the Google AI Studio configuration."
          : status === 429
            ? "Gemini quota or rate limits were reached. Please wait and try again later."
            : status >= 500
              ? "The AI service is temporarily unavailable. Please try again shortly."
              : "The Gemini request failed. Please try again."
  );

  err.status = status;
  err.code = "AI_PROVIDER_ERROR";
  err.googleMessage = normalized || undefined;
  err.retryAfterMs = getRetryAfterMs({ headers: { get: () => undefined } });

  if (status === 429) {
    err.retryAfterMs = 0;
  }

  return err;
}

function toGeminiContents(messages) {
  return messages.map((m) => {
    if (m.role === "tool") {
      return {
        role: "user",
        parts: (m.results || []).map((r) => ({
          functionResponse: {
            ...(r.id !== undefined ? { id: r.id } : {}),
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

async function callGemini({ contents, systemPrompt, tools, temperature = 0.6, signal }) {
  requireKey();
  const modelName = getGeminiModelName();
  const url = `${API_BASE}/${encodeURIComponent(modelName)}:generateContent?key=${encodeURIComponent(env.geminiApiKey)}`;
  const body = {
    contents,
    systemInstruction: systemPrompt
      ? { role: "system", parts: [{ text: systemPrompt }] }
      : undefined,
    tools: toGeminiTools(tools),
    generationConfig: { temperature },
  };

  let res;
  for (let attempt = 0; ; attempt++) {
    if (signal?.aborted) {
      const abortErr = new Error("The request was cancelled.");
      abortErr.name = "AbortError";
      abortErr.code = "ABORTED";
      throw abortErr;
    }

    res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal,
    });

    if (res.status === 429) {
      const retryAfterMs = getRetryAfterMs(res);
      const err = buildProviderError(429, await res.text().catch(() => ""));
      err.retryAfterMs = retryAfterMs;
      throw err;
    }

    if (RETRYABLE_STATUSES.has(res.status) && attempt < RETRY_DELAYS_MS.length) {
      await res.text().catch(() => "");
      await new Promise((resolve) => setTimeout(resolve, RETRY_DELAYS_MS[attempt]));
      continue;
    }

    break;
  }

  if (!res.ok) {
    const errText = await res.text().catch(() => "");
    const err = buildProviderError(res.status, errText);
    if (err.status === 429) {
      err.retryAfterMs = getRetryAfterMs(res);
    }
    throw err;
  }

  const data = await res.json();
  const candidate = data.candidates?.[0];
  const parts = candidate?.content?.parts || [];

  if (!candidate || !Array.isArray(parts) || parts.length === 0) {
    const emptyError = new Error("Gemini returned an empty or blocked response.");
    emptyError.status = 502;
    emptyError.code = "AI_PROVIDER_ERROR";
    throw emptyError;
  }

  const textParts = parts.filter((p) => typeof p.text === "string").map((p) => p.text);
  const functionCalls = parts
    .filter((part) => part.functionCall)
    .map((part) => ({
      name: part.functionCall.name,
      args: part.functionCall.args || {},
      id: part.functionCall.id,
      part,
    }));

  return {
    text: textParts.join("\n").trim(),
    toolCalls: functionCalls,
    finishReason: candidate?.finishReason,
    raw: data,
  };
}

async function generate({ messages, systemPrompt, tools, temperature, signal }) {
  const contents = toGeminiContents(messages);
  return callGemini({ contents, systemPrompt, tools, temperature, signal });
}

async function generateVision({ messages, imageParts = [], systemPrompt, signal }) {
  const contents = toGeminiContents(messages);
  const last = contents[contents.length - 1];
  if (last && last.role === "user") {
    for (const img of imageParts) {
      last.parts.push({ inlineData: { mimeType: img.mimeType, data: img.base64 } });
    }
  }
  return callGemini({ contents, systemPrompt, signal });
}

export const geminiProvider = {
  name: "gemini",
  generate,
  generateVision,
};
