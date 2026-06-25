# GEMINI.md

This file provides guidance to Google Gemini / Antigravity when working with code in this repository.

## Commands

```bash
npm install       # Install dependencies
npm run dev       # Start development server at http://localhost:3000
npm run build     # Build for production
npm start         # Run production server
npm test          # Run test suite (tsx __tests__/all.test.ts)
npm run lint      # Run ESLint
```

Tests live in `__tests__/` and are registered via `__tests__/all.test.ts`. TypeScript strict mode is the primary type safety mechanism.

## Architecture

This is a **Next.js 16 App Router** dashboard that aggregates AI credit/usage data from multiple providers into a single UI.

**Data flow:**

1. `app/page.tsx` defines a `PROVIDERS` array and renders `ProviderTile` components
2. Each `ProviderTile` independently fetches from its API route via SWR (auto-refreshes every 5 minutes, revalidates on window focus)
3. API routes in `app/api/credits/{provider}/route.ts` call external provider APIs using server-side credentials from `.env.local`, then return a `ProviderData` object
4. `components/ProviderCard.tsx` renders status, usage bars, and credit balances

**Key design decisions:**

- Each provider is fully isolated — failures don't block others; errors return HTTP 200 with `status: "error"`
- All credentials stay server-side; no API keys are exposed to the client
- Backend responses are cached by Next.js for 300 seconds

## Adding a New Provider

1. Create `app/api/credits/{provider}/route.ts` returning `ProviderData`
2. Add entry to `PROVIDERS` array in `app/page.tsx`
3. Add icon to `PROVIDER_ICONS` in `components/ProviderCard.tsx`
4. Add credentials to `.env.local` (see `.env.local.example`)

## Key Types

Defined in `lib/types.ts`:

- `ProviderData` — unified response shape for all providers
- `UsageBar` — represents a single progress bar (subscription limits with reset time)
- `ProviderStatus` — `"ok" | "warning" | "critical" | "error" | "loading"`

Status thresholds: warning at 60%, critical at 90% (via `utilizationStatus()` in `lib/utils.ts`).

## Environment Variables

Copy `.env.local.example` to `.env.local`. See that file for exact format — several vars are quirky (JSON, full cookie headers).

**Pro tip:** Use the browser extension (`extension/`) to extract credentials from provider websites instead of manually copying from DevTools.

| Provider | Variables |
| --- | --- |
| Claude Pro | `CLAUDE_SESSION_COOKIE`, `CLAUDE_ORG_ID` (`CLAUDE_DEVICE_ID` optional) |
| OpenRouter | `OPENROUTER_API_KEY` |
| OpenAI (ChatGPT/Codex) | `CHATGPT_AUTH_TOKEN`, `CHATGPT_SESSION_COOKIE` — **not** the OpenAI platform API key |
| Antigravity | `ANTIGRAVITY_ACCOUNTS` (JSON array of `{email, refresh_token}`), `ANTIGRAVITY_PROJECT_ID`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_ONE_COOKIES` |
| Ollama Cloud | `OLLAMA_SESSION_COOKIE` |
| Kilo Code | `KILO_SESSION_COOKIE` |
| AWS (Amazon Bedrock) | `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY` — IAM user with `freetier:GetAccountPlanState`. Falls back to `AWS_SESSION_COOKIE` (expires). |
| ElevenLabs | `ELEVENLABS_API_KEY` |
| Production auth (Vercel) | `ADMIN_USERNAME`, `ADMIN_PASSWORD` |

> **Cookie-based auths expire.** Use the browser extension to refresh credentials easily - see ROADMAP.md for instructions.

## Browser Extension

A companion Chrome extension (`extension/`) extracts credentials from provider websites. See `ROADMAP.md` for usage instructions.

### Quick Install

```bash
# Extension is in extension/ folder
# Load via: chrome://extensions → Developer mode → Load unpacked → select extension/
```

### Quick Usage

1. Click extension icon in Chrome toolbar
2. Click **Copy** next to provider
3. Paste into `.env.local`

## Gotchas

- **Middleware is fail-closed in production.** `middleware.ts` returns HTTP 500 if `ADMIN_PASSWORD` is unset when `NODE_ENV=production`. Dev bypasses auth entirely when the password is absent. Don't forget this env var on Vercel.
- **Ollama scraping is fragile.** `app/api/credits/ollama/route.ts` parses usage out of the `ollama.com/settings` HTML with regex — expect it to break when Ollama ships UI changes.
- **Antigravity is multi-account.** `components/AntigravityCard.tsx` is a dedicated component (not a generic `ProviderTile`) because it renders per-account tabs driven by `ANTIGRAVITY_ACCOUNTS`. Each tab fetches `/api/credits/antigravity?accountIndex=N`.

---

## Agent Working Checklist

**At session start (mandatory):**

```bash
mempalace wake-up --wing myapi
```

This loads compressed identity + recent project context (L0 + L1) directly into
your context window. Run it via Bash as the **first action** of any new session
before reading files or planning. Note: wing name is lowercase `myapi`.

Before coding:

1. Read `directives/project_memory.md` for complex tasks or when context feels thin.
2. Search MemPalace for prior work on this topic (`mempalace_search`, `mempalace_diary_read`).
3. Find nearby examples and reuse patterns.
4. Keep changes scoped to the request.
5. Prefer existing abstractions over new architecture.

After coding:

1. Run lint/typecheck/tests for the touched workspace(s).
2. Update `directives/project_memory.md` with key decisions and debugging lessons.
3. Write MemPalace diary entry for major tasks (`mempalace_diary_write`). Record new facts to knowledge graph if applicable (`mempalace_kg_add`).

---

## Persistent Memory Protocol

Two complementary memory layers exist. Use **both**:

| Layer | Scope | Tool |
|-------|-------|------|
| **`directives/project_memory.md`** | Local file, quick scratchpad for unwritten rules & debugging lessons | File read/write |
| **MemPalace** | Structured cross-session knowledge graph + semantic search | MCP tools (`mempalace_*`) |

### Layer 1: project_memory.md (Quick Context)

- Do not assume context is preserved between sessions.
- Always read `directives/project_memory.md` at the start of complex tasks or when context feels thin. (The `directives/` folder is gitignored — it's a local long-term memory store, not a committed doc.)
- Always update `directives/project_memory.md` with key architectural decisions, unwritten rules, blocked paths, and debugging lessons before concluding a major task.

### Layer 2: MemPalace (Structured Long-Term Memory)

MemPalace is a semantic knowledge store accessible via MCP. **Every agent** should use it for durable, searchable project knowledge.

**Core tools (always available):**

| Tool | When to use |
|------|-------------|
| `mempalace_search` | Before starting work — search for prior context, decisions, patterns |
| `mempalace_kg_query` | Query known entities (e.g., project name, key technologies) |
| `mempalace_kg_add` | Record architectural decisions, entity relationships, tech choices |
| `mempalace_kg_invalidate` | Mark outdated facts (deprecated APIs, removed features) |
| `mempalace_diary_write` | End-of-session summary: what was done, what matters, lessons learned |
| `mempalace_diary_read` | Start-of-session: read recent diary entries for continuity |
| `mempalace_status` | Quick overview of what's stored |
| `mempalace_list_wings` | Browse knowledge structure |

**When to use MemPalace (mandatory triggers):**

| Trigger | Action | Tool |
|---------|--------|------|
| **Session start** (complex task) | Search for prior work on this topic | `mempalace_search` + `mempalace_diary_read` |
| **Session end** (major task) | Write session diary entry | `mempalace_diary_write` |
| **Architectural decision made** | Record as knowledge graph fact | `mempalace_kg_add` |
| **Bug root cause found** | Record the lesson | `mempalace_diary_write` or `mempalace_kg_add` |
| **Feature deprecated/removed** | Invalidate the old fact | `mempalace_kg_invalidate` |
| **"I've seen this before" feeling** | Search before re-investigating | `mempalace_search` |

**Diary format (AAAK compressed):**

```
SESSION:YYYY-MM-DD|what.was.done+key.decisions|lessons.learned|★★★
```

> 🔴 **Rule:** If a task takes >15 minutes or produces an architectural decision, it MUST be recorded in MemPalace before the session ends.

---

## Self-annealing Loop

Errors are learning opportunities. When something breaks:

1. Fix it.
2. If a directive/protocol is wrong, update it.
3. Test the fix.
4. Capture the lesson in `directives/project_memory.md` if a future session would re-hit it.
5. Record in MemPalace (`mempalace_kg_add` or `mempalace_diary_write`) if the lesson is reusable across sessions.
