import rateLimit from "express-rate-limit";
import { env } from "../config/env.js";

export const apiRateLimiter = rateLimit({
  windowMs: env.rateLimit.windowMs,
  max: env.rateLimit.max,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many requests. Please slow down and try again shortly." },
});
