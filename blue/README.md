# 🔵 Blue — Think. Plan. Act.

A real, working AI agent: understands your request, plans steps, calls tools (web search,
calculator, file reader, URL reader), executes them, and gives you a final answer — with a
live activity indicator so you can see what it's doing.

This is **Phase 1** of the full Blue spec: the agent engine, tool system, chat UI, conversation
history/persistence, and file upload + analysis are built and working end-to-end. Sections not
yet implemented (voice, image generation, auth) are called out below with what's needed to add them.

---

## 1. What's actually implemented (and works)

| Feature | Status |
|---|---|
| Agent loop (plan → tool select → execute → observe → retry → final answer) | ✅ Working |
| Web search tool (DuckDuckGo, no key needed; SerpAPI optional) | ✅ Working |
| Calculator tool (safe expression evaluator) | ✅ Working |
| File reader tool (PDF, DOCX, TXT, CSV, JSON) | ✅ Working |
| URL reader tool (reads a page's text content) | ✅ Working |
| File upload (drag/attach, size + type validated) | ✅ Working |
| Conversation history, persisted in SQLite | ✅ Working |
| New / rename / delete / search conversations | ✅ Working |
| Markdown rendering, code blocks, tables, links | ✅ Working |
| Agent activity indicator (live step list) | ✅ Working |
| Modes: Chat / Agent / Research / Files | ✅ Working (Chat mode disables tools) |
| Copy / Regenerate / Edit-and-resend | ✅ Working |
| Dark mode (default) + Light mode | ✅ Working |
| Responsive mobile layout (collapsible sidebar) | ✅ Working |
| Rate limiting, input validation, safe error messages | ✅ Working |
| Gemini provider via env var, swappable provider architecture | ✅ Working |

## 2. What needs an external API key you must supply

| Feature | Requires | Notes |
|---|---|---|
| Any actual chat/agent reply | `GEMINI_API_KEY` | Get one at https://aistudio.google.com/apikey — free tier available |
| Higher-quality web search | `SERPAPI_KEY` (optional) | Default search (DuckDuckGo) needs no key but is best-effort |
| Image analysis (vision) | Same `GEMINI_API_KEY` | Gemini models are multimodal; wiring for this is in `geminiProvider.generateVision` — image messages need a small controller addition (see "Next steps") |

## 3. Not yet built (architected for, but out of scope for Phase 1)

These were requested in the full spec. The architecture supports adding them, but they are
**not implemented yet** — I'm telling you plainly rather than faking them:

- **Voice (STT/TTS)** — needs browser Web Speech API or a paid STT/TTS API; no fake mic button was added.
- **Image generation** — needs an image-gen API (e.g. Gemini image models, Stable Diffusion API); no fake images are shown anywhere.
- **Authentication / multi-user accounts** — DB schema has a placeholder-friendly shape but no user table/auth flow yet.
- **Long-term memory extraction** — the `memories` table exists in the schema but nothing writes to it yet.

---

## 4. Project structure

```
blue/
├── client/                 # React + Vite frontend
│   └── src/
│       ├── components/     # Sidebar, MessageBubble, Composer, AgentActivity, SettingsModal
│       ├── lib/api.js       # API client
│       └── App.jsx
├── server/                 # Express backend
│   └── src/
│       ├── agents/agentEngine.js      # the plan/act/observe loop
│       ├── providers/                 # AI provider abstraction (gemini today)
│       ├── tools/                     # web_search, calculator, file_reader, url_reader
│       ├── routes/ controllers/ services/ middleware/
│       └── db/                        # SQLite schema + connection
├── .env.example
└── README.md   (this file)
```

---

## 5. Installation

Requires **Node.js 18+** (uses native `fetch`).

```bash
# 1. Clone/extract the project, then:
cd blue/server
cp ../.env.example .env
# edit server/.env and paste in your GEMINI_API_KEY

npm install

cd ../client
npm install
```

## 6. Get a Gemini API key (free)

1. Go to https://aistudio.google.com/apikey
2. Create an API key
3. Paste it into `server/.env` as `GEMINI_API_KEY=...`
4. (Optional) change `GEMINI_MODEL` if you want a different Gemini model

## 7. Database setup

No manual setup needed — SQLite is file-based. On first server start, it automatically creates
`server/data/blue.sqlite` and runs the schema in `server/src/db/schema.sql`.

To reset the database at any time: stop the server and delete `server/data/blue.sqlite`.

To move to PostgreSQL later: swap `server/src/db/db.js` for a Postgres client (e.g. `pg`) behind
the same exported query shape — the rest of the app only calls functions in
`services/conversationService.js`, so that's the one file to rewrite.

## 8. Run locally

Open two terminals:

```bash
# Terminal 1 — backend
cd blue/server
npm run dev
# → running at http://localhost:8787

# Terminal 2 — frontend
cd blue/client
npm run dev
# → running at http://localhost:5173
```

Open **http://localhost:5173** in your browser.

## 9. Deploy

- **Backend**: deploy `server/` to any Node host (Render, Railway, Fly.io, a VPS). Set the same
  env vars from `.env.example` in the host's environment settings. SQLite works fine for
  low-to-medium traffic; for production scale, move to Postgres (see above).
- **Frontend**: run `npm run build` in `client/`, then deploy the generated `client/dist/` folder
  to any static host (Vercel, Netlify, Cloudflare Pages, or served by the Express server itself
  via `express.static`). Set `CLIENT_ORIGIN` on the backend to your deployed frontend's URL, and
  update the `/api` proxy target (or use an absolute API URL) in the frontend build.

## 10. Testing instructions

With both servers running:

1. **Normal chat** — switch to "Chat" mode, send "Hello" → should get a plain reply, no tool use.
2. **Multi-step agent task** — "Find information about Bihar government schemes and summarize them" in "Agent" or "Research" mode → watch the activity panel show "Searching the web" → "Reading sources" → "Preparing final answer", then check the final answer includes source links.
3. **Web search** — ask any current-events question; check the response cites sources.
4. **Calculator** — "What's 18% tip on 3200?" → should call the calculator tool and give an exact number.
5. **File upload** — attach a PDF or .txt file and ask "Summarize this document" → Blue should call `file_reader` and produce a real summary of your actual file content.
6. **Conversation history** — refresh the browser; your conversations should still be listed (they're in SQLite, not browser storage).
7. **Error handling** — temporarily remove `GEMINI_API_KEY` from `server/.env` and restart; sending a message should show a clear "Blue couldn't connect to the AI service" message, not a crash.
8. **Mobile UI** — resize the browser below 860px width (or open on a phone) — sidebar should collapse behind a ☰ button.
9. **Desktop UI** — full sidebar + chat layout, mode switch pills visible in the top bar.

## 11. API reference

```
POST   /api/chat                 { message, conversationId?, mode?, attachments? }
POST   /api/agent/run            (identical to /api/chat)
POST   /api/files/upload         multipart/form-data, field name "files" (up to 5)
GET    /api/conversations
GET    /api/conversations/:id
PATCH  /api/conversations/:id    { title?, mode? }
DELETE /api/conversations/:id
GET    /api/health
```

## 12. Safety notes

- API keys are read only from `server/.env` — never sent to or stored in the frontend.
- The calculator tool uses a hand-written tokenizer/evaluator — no `eval()`.
- Uploaded files are validated by extension and size (`MAX_UPLOAD_MB`), and `file_reader` blocks
  path traversal (it only reads by basename inside the configured upload directory).
- The agent loop has hard limits: `AGENT_MAX_STEPS`, `AGENT_MAX_TOOL_CALLS`,
  `AGENT_STEP_TIMEOUT_MS`, `AGENT_TOTAL_TIMEOUT_MS` — all configurable in `.env`, all enforced in
  `agentEngine.js`, so a runaway loop can't hang the server or burn unlimited API quota.
- Tool failures are surfaced honestly in the activity panel and never presented as success.

## 13. Suggested next steps (Phase 2)

1. Wire image uploads into `geminiProvider.generateVision` end-to-end (backend plumbing exists; needs a small controller branch when an attachment is an image).
2. Add Web Speech API (browser-native, free) for voice input/output — no backend change needed.
3. Add streaming responses (Server-Sent Events) so the activity panel updates live instead of all-at-once.
4. Add an image-generation tool once you choose a provider (Gemini image models, Stable Diffusion API, etc.).
5. Add simple auth (email/password or OAuth) if this needs to support multiple separate users.
