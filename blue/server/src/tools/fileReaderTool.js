import fs from "node:fs/promises";
import path from "node:path";
import { env } from "../config/env.js";

async function extractText(filePath, mimeOrExt) {
  const ext = (mimeOrExt || path.extname(filePath)).toLowerCase();

  if (ext.includes("pdf")) {
    const pdfParse = (await import("pdf-parse")).default;
    const buffer = await fs.readFile(filePath);
    const data = await pdfParse(buffer);
    return data.text;
  }
  if (ext.includes("docx") || ext.includes("word")) {
    const mammoth = (await import("mammoth")).default;
    const buffer = await fs.readFile(filePath);
    const { value } = await mammoth.extractRawText({ buffer });
    return value;
  }
  if (ext.includes("json")) {
    const raw = await fs.readFile(filePath, "utf-8");
    return raw;
  }
  // txt, csv, and anything else plain-text
  return fs.readFile(filePath, "utf-8");
}

export const fileReaderTool = {
  name: "file_reader",
  description:
    "Read and extract text content from a file the user has uploaded to this conversation (PDF, DOCX, TXT, CSV, JSON). Provide the fileId exactly as given in the conversation's attachments list.",
  inputSchema: {
    type: "object",
    properties: {
      fileId: {
        type: "string",
        description: "The stored filename/id of the uploaded attachment.",
      },
    },
    required: ["fileId"],
  },
  async execute({ fileId }) {
    if (!fileId) throw new Error("file_reader requires 'fileId'.");
    const safeName = path.basename(fileId); // prevent path traversal
    const filePath = path.join(env.uploadDir, safeName);
    try {
      await fs.access(filePath);
    } catch {
      throw new Error(`Uploaded file "${fileId}" was not found on the server.`);
    }
    const text = await extractText(filePath, safeName);
    const MAX_CHARS = 20000;
    const truncated = text.length > MAX_CHARS;
    return {
      fileId: safeName,
      characterCount: text.length,
      truncated,
      content: truncated ? text.slice(0, MAX_CHARS) : text,
    };
  },
};
