import { Router } from "express";
import multer from "multer";
import path from "node:path";
import fs from "node:fs";
import { nanoid } from "nanoid";
import { env } from "../config/env.js";
import { handleUpload } from "../controllers/uploadController.js";

fs.mkdirSync(env.uploadDir, { recursive: true });

const ALLOWED_EXT = [".pdf", ".txt", ".docx", ".csv", ".json", ".png", ".jpg", ".jpeg", ".webp", ".gif"];

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, env.uploadDir),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, `${nanoid()}${ext}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: env.maxUploadMb * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    if (!ALLOWED_EXT.includes(ext)) {
      return cb(new Error(`File type "${ext}" is not supported.`));
    }
    cb(null, true);
  },
});

const router = Router();
router.post("/files/upload", upload.array("files", 5), handleUpload);

export default router;
