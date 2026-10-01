# Blue AI Agent

This repository contains two related but independently runnable Blue projects. The Android API is a separate service; it is not part of the web app's Express server.

## Projects

- **`blue/`** — React/Vite web client and Express backend with Gemini chat, agent tools, SQLite conversation storage, and file uploads. See [`blue/README.md`](blue/README.md).
- **`blue-android-backend/`** — Vercel serverless API that turns mobile commands into allow-listed, schema-validated action plans. See [`blue-android-backend/README.md`](blue-android-backend/README.md).

## Run the web app

1. In `blue/server`, copy `../.env.example` to `.env` and set `GEMINI_API_KEY`.
2. Run `npm install` and `npm run dev` from `blue/server` (the API listens on port 8787).
3. In a second terminal, run `npm install` and `npm run dev` from `blue/client` (Vite listens on port 5173 and proxies API requests to the server).

The server creates its SQLite database on first start. For deployment and configuration details, see the web project's README.

## Run the Android API tests

From `blue-android-backend`, run `npm install` followed by `npm test`. The test suite uses a mocked Gemini API and does not need a real API key. Local Vercel development and deployment instructions are in that project's README.

## Before public deployment

Both projects are independent of each other's keys and runtime. Keep real credentials in local `.env` files or deployment environment settings, never in source control. The Android API currently has no device authentication or shared rate limiting, and the web app does not yet implement user authentication; add the appropriate protections before exposing either service to untrusted users.
