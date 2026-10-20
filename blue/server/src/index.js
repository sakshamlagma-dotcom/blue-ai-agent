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
import {
errorHandler,
notFoundHandler
} from "./middleware/errorHandler.js";

const app = express();

// Render reverse proxy configuration
app.set("trust proxy", 1);

// Basic middleware
app.use(
cors({
origin: env.clientOrigin,
credentials: true
})
);

app.use(express.json({ limit: "2mb" }));

// Uploaded files
app.use("/uploads", express.static(env.uploadDir));

// Serve frontend in production
if (env.nodeEnv === "production") {
const clientDistPath = path.resolve(
env.serverRoot,
"../client/dist"
);

app.use(express.static(clientDistPath));
}

// Health check routes
app.use("/api", healthRoutes);

// API routes
app.use("/api", apiRateLimiter, chatRoutes);
app.use("/api", apiRateLimiter, conversationRoutes);
app.use("/api", apiRateLimiter, uploadRoutes);

// Error handling
app.use(notFoundHandler);
app.use(errorHandler);

// Validate configuration
const warnings = assertConfigured();

for (const warning of warnings) {
console.warn(`[Blue] WARNING: ${warning}`);
}

// Start server
app.listen(env.port, "0.0.0.0", () => {
console.log("");
console.log("Blue server started successfully.");
console.log(`Port: ${env.port}`);
console.log(`Environment: ${env.nodeEnv}`);
console.log(`AI provider: ${env.aiProvider}`);
console.log(`AI model: ${env.geminiModel}`);
console.log(`Client origin: ${env.clientOrigin}`);
console.log("");
});
