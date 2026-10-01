import express from "express";
import cors from "cors";
import path from "node:path";
import { env, assertConfigured } from "./config/env.js";
import "./db/db.js"; // initializes SQLite + schema on boot

import chatRoutes from "./routes/chatRoutes.js";
import conversationRoutes from "./routes/conversationRoutes.js";
import healthRoutes from "./routes/healthRoutes.js";
import uploadRoutes from "./routes/uploadRoutes.js";
import { apiRateLimiter } from "./middleware/rateLimiter.js";
import { errorHandler, notFoundHandler } from "./middleware/errorHandler.js";

const app = express();

app.use(cors({ origin: env.clientOrigin, credentials: true }));
app.use(express.json({ limit: "2mb" }));
app.use("/uploads", express.static(env.uploadDir));

app.use("/api", healthRoutes); // no rate limit on health check
app.use("/api", apiRateLimiter, chatRoutes);
app.use("/api", apiRateLimiter, conversationRoutes);
app.use("/api", apiRateLimiter, uploadRoutes);

app.use(notFoundHandler);
app.use(errorHandler);

const warnings = assertConfigured();
for (const w of warnings) console.warn(`[Blue] WARNING: ${w}`);

app.listen(env.port, () => {
  console.log(`\n  🔵 Blue server running at http://localhost:${env.port}`);
  console.log(`     AI provider: ${env.aiProvider} (model: ${env.geminiModel})`);
  console.log(`     Client origin (CORS): ${env.clientOrigin}\n`);
});
