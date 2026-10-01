# BLUE Android — Backend API

This is the server-side "brain" for BLUE Android. It turns natural-language commands into
**validated, schema-checked action plans** that the Android app can safely execute — the Gemini
API key never leaves this server, and the model can never propose an action outside a fixed
allow-list.

This has been tested end-to-end in this environment with a mocked Gemini response (see
`test/run-tests.js` — 11 scenarios, 27 assertions, all passing). It has **not** yet been tested
against the real Gemini API or deployed live — that's the next step, once you add a real API key.

## 1. What this proves (verified by the test suite)

- A valid low-risk command (e.g. "search the web for X") returns immediately, no confirmation needed
- A valid medium-risk command (e.g. "message Rahul on WhatsApp") always comes back with `requiresConfirmation: true`
- A valid high-risk command (e.g. "delete this file") always comes back with `requiresConfirmation: true`
- **If the model tries to sneak in its own `riskLevel: "low"` on a delete action, the server ignores it and enforces `"high"` anyway** — risk tiers are never model-controlled
- If the model hallucinates an action that isn't on the allow-list, the server rejects it and falls back to a safe "reply" — it never passes an unrecognized action to the app
- If required parameters are missing or malformed, the plan is rejected rather than passed through broken
- Missing `GEMINI_API_KEY` gives a clear 503, not a crash

## 2. Project structure

```
blue-android-backend/
├── api/
│   ├── plan.js      # POST /api/plan  — command → validated action plan
│   ├── chat.js      # POST /api/chat  — plain conversational reply
│   └── health.js    # GET  /api/health
├── lib/
│   ├── gemini.js         # Gemini API client (planning + chat)
│   ├── actionSchema.js   # the fixed allow-list of actions + risk tiers
│   └── validatePlan.js   # enforces the allow-list before anything reaches the app
├── test/run-tests.js     # mocked end-to-end test suite (no API key needed to run)
├── vercel.json
├── .env.example
└── package.json
```

## 3. Run the tests yourself

```bash
npm install
npm test
```

No API key needed — the test suite mocks Gemini's response shape and checks that validation,
risk-tier enforcement, and error handling all behave correctly.

## 4. Get a Gemini API key

1. Go to https://aistudio.google.com/apikey
2. Create a key (free tier available)

## 5. Run locally against the real Gemini API

```bash
npm install -g vercel   # if you don't have the Vercel CLI yet
cp .env.example .env
# edit .env and paste in your real GEMINI_API_KEY
vercel dev
```

This starts the same serverless functions locally, typically at `http://localhost:3000`. Test with:

```bash
curl -X POST http://localhost:3000/api/plan \
  -H "Content-Type: application/json" \
  -d '{"command": "search the web for the latest cricket score"}'

curl -X POST http://localhost:3000/api/chat \
  -H "Content-Type: application/json" \
  -d '{"message": "hi there"}'
```

## 6. Deploy to Vercel (make it live)

1. Push this folder to a GitHub repository.
2. Go to vercel.com, sign in with GitHub, click "Add New… > Project", pick this repo.
3. Before deploying, add an environment variable: `GEMINI_API_KEY` = your real key
   (Project Settings → Environment Variables). Optionally set `GEMINI_MODEL` too.
4. Deploy. You'll get a URL like `https://blue-android-backend.vercel.app`.
5. Your Android app will call `https://blue-android-backend.vercel.app/api/plan` and
   `.../api/chat`.

## 7. API reference

### `POST /api/plan`
```json
// Request
{ "command": "tell Rahul on WhatsApp I'm on my way", "deviceContext": { "installedApps": ["WhatsApp"] } }

// Response
{
  "action": "send_whatsapp_message",
  "params": { "contact": "Rahul", "message": "I'm on my way" },
  "riskLevel": "medium",
  "requiresConfirmation": true
}
```
The Android app's job: if `requiresConfirmation` is `true`, show a confirmation dialog built from
`action`/`params` before doing anything. Only execute directly when it's `false`.

### `POST /api/chat`
```json
// Request
{ "message": "how's it going", "history": [{ "role": "user", "content": "hi" }] }
// Response
{ "text": "Doing well! What can I help you with?" }
```

### `GET /api/health`
```json
{ "status": "ok", "geminiConfigured": true, "model": "gemini-2.0-flash", "time": "..." }
```

## 8. Security notes

- `GEMINI_API_KEY` lives only in Vercel's environment variables — it is never sent to or
  readable from the Android app.
- The action allow-list lives in `lib/actionSchema.js`. Adding a new capability (e.g. Phase 2's
  `send_sms`) means adding it here first, with an explicit risk tier — the model can only ever
  use actions defined here.
- `riskLevel` and `requiresConfirmation` are always computed server-side from the action's fixed
  definition, never taken from the model's own output, even if the model includes those fields in
  its JSON (see test #5 — this is explicitly tested against prompt-injection-style attempts).
- Rate limiting isn't implemented yet in this serverless version (Vercel functions are stateless
  per-instance, so a simple in-memory limiter like BLUE Web's isn't reliable here). Before real
  users hit this, add a proper limiter backed by a shared store (e.g. Upstash Redis, which has a
  Vercel-native free tier).

## 9. What's NOT built yet

- No database/persistence yet (no conversation history storage) — add Vercel Postgres or similar
  when needed.
- No per-device authentication token yet — right now anyone with the URL could call these
  endpoints. Before shipping the Android app, add a simple API key or JWT check so only your app
  can call your backend.
- Only the *planning* logic exists here. The Android app that actually executes these plans
  (opens apps, sends messages, etc.) is the next phase — see `BLUE-Android-Architecture.md`.
