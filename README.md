# AI Credits Dashboard

A personal dashboard to monitor AI usage and credit balances across providers.

> **Security warning:** This app is intended for private self-hosting only. It stores and uses provider credentials server-side and protects the dashboard with Basic Auth in production. Never run it as a shared/public instance, and never commit `.env*`, cookies, HAR files, provider page dumps, or screenshots with real account data.

## Table of Contents

- [Stack](#stack)
- [Setup](#setup)
  - [1. Install dependencies](#1-install-dependencies)
  - [2. Configure environment variables](#2-configure-environment-variables)
  - [3. Run the dev server](#3-run-the-dev-server)
- [Provider Setup Notes](#provider-setup-notes)
  - [Claude Pro](#claude-pro)
  - [OpenAI (ChatGPT)](#openai-chatgpt)
  - [OpenRouter](#openrouter)
  - [Ollama Cloud](#ollama-cloud)
  - [Antigravity](#antigravity)
- [Data Refresh](#data-refresh)
- [Troubleshooting](#troubleshooting)
- [Project Structure](#project-structure)
- [Adding a New Provider](#adding-a-new-provider)
- [Browser Extension](#browser-extension)

---

## Stack

- **Next.js 16** (App Router) — frontend + secure serverless API routes
- **Tailwind CSS** — styling
- **SWR** — data fetching with auto-refresh
- **TypeScript** — throughout

## Setup

### 1. Install dependencies

```bash
npm install
```

### 2. Configure environment variables

```bash
cp .env.local.example .env.local
```

Then edit `.env.local` with your credentials. See notes below per provider.

### 3. Run the dev server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

---

## Provider Setup Notes

### Claude Pro

The session cookie expires periodically. To refresh it:

1. Open [https://claude.ai/settings/usage](https://claude.ai/settings/usage) in your browser
2. DevTools → Network → filter XHR → refresh page
3. Click the `usage` request → Headers → copy the `Cookie` header value
4. Paste it into `CLAUDE_SESSION_COOKIE` in `.env.local`

Your `CLAUDE_ORG_ID` is: `your-org-id`  
Your `CLAUDE_DEVICE_ID` is in the `anthropic-device-id` request header.

### OpenRouter

Get your API key at [https://openrouter.ai/keys](https://openrouter.ai/keys) — works out of the box.

### OpenAI (ChatGPT Codex)

The session tokens for the ChatGPT web API expire periodically. To refresh them:

1. Open [https://chatgpt.com/codex/settings/usage](https://chatgpt.com/codex/settings/usage) in your browser.
2. DevTools → Network → filter traffic (or refresh page).
3. Look for a request to `usage` (or `me`).
4. Click the request → Headers → copy the following into `CHATGPT_ACCOUNTS`:
   - `Authorization: Bearer <...>` becomes `auth_token`
   - `Cookie: <...>` becomes `session_cookie`

Example:

```env
CHATGPT_ACCOUNTS=[{"label":"Personal","auth_token":"token","session_cookie":"cookie"}]
```

### Antigravity

Add your account refresh tokens to `ANTIGRAVITY_ACCOUNTS` in `.env.local` as a JSON array. Emails remain server-side; labels are what the dashboard displays in tabs.

```env
ANTIGRAVITY_ACCOUNTS=[{"label":"Personal","email":"user@example.com","refresh_token":"token"}]
```

### Ollama Cloud

Automatic fetching from your Ollama Cloud account. Get your session cookie from [https://ollama.com/settings](https://ollama.com/settings).

### AWS (Amazon Bedrock)

Uses IAM credentials — never expire, work from any IP including Vercel.

1. AWS Console → **IAM → Users → Create user** (e.g. `MyAPI-Monitor`)
2. **Attach policy** → Create inline policy with one action: `freetier:GetAccountPlanState`
3. **Security credentials → Create access key → Other** → copy both keys
4. Add to `.env.local`:
   ```
   AWS_ACCESS_KEY_ID=AKIA...
   AWS_SECRET_ACCESS_KEY=...
   ```

> **Fallback:** `AWS_SESSION_COOKIE` (browser session cookie) is also supported but expires and may fail on Vercel due to IP changes.

---

## Data Refresh

Dashboard data automatically refreshes every **5 minutes**. You can see this noted in the footer. To change the interval, edit `refreshInterval` in `app/page.tsx` (line 33).

---

## Troubleshooting

### Common Issues

#### "Failed to fetch data" error on a provider card

- Verify your credentials are correct in `.env.local`
- Check that the session cookie hasn't expired (Claude and ChatGPT cookies expire periodically)
- For Claude/ChatGPT: Follow the instructions in the respective sections above to refresh your tokens.

#### Provider card shows "OFFLINE"

- The API route returned an error. Check the terminal running `npm run dev` for details
- Verify network connectivity to the provider's website

#### Antigravity shows no accounts

- Ensure `ANTIGRAVITY_ACCOUNTS` is a valid JSON array in `.env.local`
- Verify your refresh tokens are still valid

### Security Notes

- All API keys and credentials are stored server-side only
- Keys are never exposed to the browser
- Session cookies should be kept confidential
- Multi-account tabs should use labels, not raw emails, for browser-visible display
- Production deployments require `ADMIN_PASSWORD`; without it, production auth fails closed
- Some providers rely on private/session-cookie endpoints. Use only with accounts you control and respect provider terms.

---

## Project Structure

```text
.
├── app/
│   ├── api/credits/
│   │   ├── claude/route.ts       ← fetches claude.ai usage
│   │   ├── openai/route.ts       ← fetches ChatGPT usage
│   │   ├── openrouter/route.ts   ← fetches OpenRouter balance
│   │   ├── ollama/route.ts        ← fetches Ollama Cloud usage
│   │   └── antigravity/route.ts  ← fetches Antigravity credits
│   ├── page.tsx                  ← main dashboard
│   ├── layout.tsx
│   └── globals.css
├── components/
│   ├── ProviderCard.tsx          ← reusable card component
│   ├── AntigravityCard.tsx       ← special card for Antigravity
│   └── Logo.tsx                  ← dashboard logo
├── lib/
│   ├── types.ts                  ← shared TypeScript types
│   └── utils.ts                  ← helpers (time formatting, etc.)
└── .env.local.example
```

## Adding a New Provider

1. Create `app/api/credits/{provider}/route.ts`
2. Return a `ProviderData` object (see `lib/types.ts`)
3. Add an entry to the `PROVIDERS` array in `app/page.tsx`
4. Add an icon to `PROVIDER_ICONS` in `components/ProviderCard.tsx`

---

## Browser Extension

A Chrome extension is included to easily extract credentials from provider websites.

### Install

1. Open `chrome://extensions`
2. Enable **Developer mode** (top right)
3. Click **Load unpacked**
4. Select the `extension/` folder

### Usage

**Method 1 - Via popup:**
1. Click the extension icon in Chrome's toolbar
2. Click **Copy** next to the provider you want credentials for
3. Paste directly into `.env.local`

**Method 2 - On provider page:**
1. Visit the provider website while logged in (e.g., claude.ai)
2. Click the floating **"Copy to .env"** button

If clipboard doesn't work, a dialog will appear with the text to copy manually.

### Supported Providers

| Provider | Extracted Credentials |
| --- | --- |
| Claude Pro | `CLAUDE_SESSION_COOKIE`, `CLAUDE_ORG_ID`, `CLAUDE_DEVICE_ID` |
| ChatGPT Codex | `CHATGPT_ACCOUNTS` fields |
| Ollama Cloud | `OLLAMA_SESSION_COOKIE` |
| OpenRouter | `OPENROUTER_API_KEY` |
| Kilo Code | `KILO_SESSION_COOKIE` |

The extension copies snippets on demand and does not persist full generated credential snippets in extension storage.
