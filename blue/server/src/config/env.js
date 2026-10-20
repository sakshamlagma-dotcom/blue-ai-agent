import "dotenv/config";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const serverRoot = path.resolve(__dirname, "../../");

function toInt(value, fallback) {
  const n = Number.parseInt(value, 10);
  return Number.isFinite(n) ? n : fallback;
}

export const env = {
  port: toInt(process.env.PORT, 8787),
  nodeEnv: process.env.NODE_ENV || "development",
  clientOrigin: process.env.CLIENT_ORIGIN || "http://localhost:5173",

  aiProvider: process.env.AI_PROVIDER || "gemini",
  geminiApiKey: process.env.GEMINI_API_KEY || "",
  geminiModel: (process.env.GEMINI_MODEL || "gemini-2.0-flash").trim(),

  searchProvider: process.env.SEARCH_PROVIDER || "duckduckgo",
  serpapiKey: process.env.SERPAPI_KEY || "",

  databasePath: path.resolve(serverRoot, process.env.DATABASE_PATH || "./data/blue.sqlite"),

  uploadDir: path.resolve(serverRoot, process.env.UPLOAD_DIR || "./uploads"),
  maxUploadMb: toInt(process.env.MAX_UPLOAD_MB, 15),

  agent: {
    maxSteps: toInt(process.env.AGENT_MAX_STEPS, 8),
    maxToolCalls: toInt(process.env.AGENT_MAX_TOOL_CALLS, 6),
    stepTimeoutMs: toInt(process.env.AGENT_STEP_TIMEOUT_MS, 30000),
    totalTimeoutMs: toInt(process.env.AGENT_TOTAL_TIMEOUT_MS, 120000),
  },

  rateLimit: {
    windowMs: toInt(process.env.RATE_LIMIT_WINDOW_MS, 60000),
    max: toInt(process.env.RATE_LIMIT_MAX, 30),
  },

  serverRoot,
};

export function getGeminiModelName() {
  const modelName = (env.geminiModel || "").trim();
  if (!modelName) {
    const err = new Error(
      "GEMINI_MODEL is not configured. Set it to a model enabled for your Google project and API key."
    );
    err.code = "INVALID_MODEL_CONFIGURATION";
    throw err;
  }
  return modelName;
}

export function assertConfigured() {
  const warnings = [];
  if (env.aiProvider === "gemini") {
    if (!env.geminiApiKey) {
      warnings.push(
        "GEMINI_API_KEY is not set. Chat/agent requests will fail until you add it to server/.env."
      );
    }

    if (!env.geminiModel || !env.geminiModel.trim()) {
      warnings.push(
        "GEMINI_MODEL is not set. Set it to a model enabled for your Google project and API key."
      );
    }
  }
  return warnings;
}
