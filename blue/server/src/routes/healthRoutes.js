import { Router } from "express";
import { env } from "../config/env.js";

const router = Router();
router.get("/health", (req, res) => {
  res.json({
    status: "ok",
    provider: env.aiProvider,
    geminiConfigured: Boolean(env.geminiApiKey),
    time: new Date().toISOString(),
  });
});

export default router;
