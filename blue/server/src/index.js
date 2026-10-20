```js
import express from "express";
import cors from "cors";
import path from "node:path";
import { env, assertConfigured } from "./config/env.js";
import "./db/db.js";

import chatRoutes from "./routes/chatRoutes.js";
import conversationRoutes from "./routes/conversationRoutes.js";
import healthRoutes from "./routes/healthRoutes.js";
import uploadRoutes from "./routes/uploadRoutes.js";
import { apiRateLimiter } from "./middleware/rateLimiter.js";
import { errorHandler, notFoundHandler } from "./middleware/errorHandler.js";

const app = express();

// Render reverse proxy configuration
app.set("trust proxy", 1);

app.use(cors({ origin: env.clientOrigin, credentials: true }));
app.use(express.json({ limit: "2mb" }));
app.use("/uploads", express.static(env.uploadDir));

if (env.nodeEnv === "production") {
  app.use(express.static(path.resolve(env.serverRoot, "../client/dist")));
}

app.use("/api", healthRoutes);
app.use("/api", apiRateLimiter, chatRoutes);
app.use("/api", apiRateLimiter, conversationRoutes);
app.use("/api", apiRateLimiter, uploadRoutes);

app.use(notFoundHandler);
app.use(errorHandler);

const warnings = assertConfigured();

for (const warning of warnings) {
  console.warn("[Blue] WARNING: " + warning);
}

app.listen(env.port, "0.0.0.0", () => {
  console.log("");
  console.log("Blue server running on port " + env.port);
  console.log("AI provider: " + env.aiProvider + " (model: " + env.geminiModel + ")");
  console.log("Client origin (CORS): " + env.clientOrigin);
  console.log("");
});
```
