# Changelog

## [2026-05-04]

### Added
- **Amazon Bedrock Integration**: Added a new credit tracking card to the Dashboard specifically for Amazon Bedrock.
- **AWS API Endpoint**: Created `/api/credits/aws` backend route to serve AWS credit usage data to the dashboard.
- **Chrome Extension AWS Support**: Added AWS to the extension popup UI. Created a dedicated content script (`aws.js`) that injects a floating "Copy to .env" button directly into the AWS Console UI.

### Changed
- **Extension Permissions**: Updated `manifest.json` `host_permissions` to include `https://*.amazon.com/*` and `https://*.aws.amazon.com/*`.
- **Extension Cookie Extraction**: Upgraded background service worker to fetch cookies using `url` matching instead of strict `domain` matching, ensuring all cross-domain AWS session cookies (like `aws-userInfo`) are successfully captured.
- **Workflow Documentation**: Updated the `/change-cookie` workflow docs with patterns and instructions for `AWS_SESSION_COOKIE`.

## [2026-04-24]

### Maintenance
- **ChatGPT Codex Authentication**: Successfully extracted and updated BOTH `CHATGPT_AUTH_TOKEN` and `CHATGPT_SESSION_COOKIE` in `.env.local` and `.env.prod.local`.
- **Extension Fix**: Rewrote `extension/content/chatgpt.js` to properly intercept main-world fetch requests and added a fallback to `/api/auth/session` to guarantee token extraction.
- **Vercel Sync**: Updated production environment variables via CLI with fresh authentication tokens.
- **ESLint Fixes**: Resolved minor linting issues to pass pre-deployment checks.
- **Production Deployment**: Successfully pushed updates to Vercel (my-api-swart-two.vercel.app).

## [2026-04-11]


### Added (2026-04-11)

- **Code Review Graph**: Initialized and built a persistent incremental knowledge graph for code reviews using `code-review-graph`.
  - **Scale**: Parsed 27 files, indexed 108 nodes and 691 edges.
  - **Visualization**: Generated an interactive HTML graph at `.code-review-graph/graph.html` for codebase exploration.
  - **Community Detection**: Enabled file-based community detection to identify structural clusters within the Next.js application.

### Removed (2026-04-11)

- **UI Cleanup**: Completely removed the `DottedGlowBackground` and `DynamicBackground` components to simplify the dark mode aesthetic.
  - **Aesthetic Shift**: Removed the animated dotted canvas background in favor of a cleaner, solid dark theme.
  - **Codebase Optimization**: Deleted unused component files and removed global layout references to reduce bundle size and runtime complexity.

## [2026-04-05]

### Fixed (2026-04-05 — ChatGPT Token Error)

- **ChatGPT Error Clarity**: Updated the `openai/route.ts` API endpoint to intercept 401 Unauthorized errors and return a specific, actionable error message. Instead of just displaying "Offline", it now informs the user that their `.env.local` tokens have naturally expired and how to renew them.
- **ChatGPT Documentation**: Updated the `README.md` to clarify that ChatGPT Codex tracking now uses the web session's Bearer token and Cookie (which naturally expire) rather than a static platform API key.

## [2026-04-04]

### Added (2026-04-04 — Dashboard Sync & Metadata Accuracy)

- **Dashboard Metadata**: Replaced misleading server-side `lastUpdated` timestamps with client-side `lastFetchedAt` tracking.
- **Global Sync Status**: Implemented a "Synced X ago" global footer that tracks real-time API activity across all providers, giving a visual "heartbeat" to the dashboard.
- **Persistent "Used" Timestamps**: Refactored provider-specific footers to show "Used X ago".
  - **Content-Aware**: Timestamps now only reset to "just now" when the actual credit usage percentage or count changes.
  - **Persistence**: Stored timestamps and usage fingerprints in `localStorage` so the "Used" history survives page reloads and browser restarts.
- **Hydration Safety**: Fixed potential Next.js hydration mismatches by wrapping `localStorage` access in `useEffect` hooks and deferring timestamp calculation until the component is mounted.
- **UI Consistency**: Restored the "Used X ago" footer to the featured `AntigravityCard` layout to match the standard provider cards.
- **Component Refactoring**: Extracted core footer logic into a dedicated `UsageFooter` component.
  - **Dynamic States**: Added "Syncing..." and "No history yet" visual states to handle edge cases gracefully.
  - **Theming**: Implemented unified styling for featured vs. standard card variants.
- **Antigravity Accuracy**: Fixed an issue where Antigravity models wrongly displayed 0% used when actually exhausted.
  - **Implicit Quota Interpretation**: Correctly interprets the absence of `remainingFraction` (when a `resetTime` is present) as 0% remaining (100% used). This aligns with and fixes the "0% everything" behavior for Claude and Gemini Pro models.

### Changed (2026-04-04)

- **UI Design Evolution**: Refined the color palette to remove jarring "pink-on-green" high-vibration elements.
  - **Global Color Update**: Adjusted `var(--red)` from a bright pinkish salmon (#f3727f) to a more neutral, saturated "True Red" (#e53e3e) for better universal contrast and accessibility.
  - **Featured Card Styling**: Optimized the `ProviderCard` featured variant (Antigravity) with a sophisticated dark red (#991b1b) for critical usage indicators, ensuring a high-contrast (4.8:1) accessible look on the vibrant green background.
  - **Visual Refinement**: Removed "glow" effects from featured usage bars and reduced bar height (h-0.5) for a cleaner, more technical visual hierarchy.
- **Quality**: Fixed several linting errors (unused variables, let/const) and optimized the `npm run lint` script.

## [2026-04-03]

### Fixed (2026-04-03 — cookie auth debug)

- **Root cause: Google `SIDCC` cookie rotates per-request**: Discovered that `SIDCC`/`__Secure-*PSIDCC` tokens are rotated by Google on every page load. A static env var cookie string becomes invalid after 1 request, causing all subsequent server-side fetches to redirect to the sign-in page silently. Fix: store only stable long-lived cookies (`SID`, `__Secure-1PSID`, `__Secure-3PSID`, `HSID`, `SSID`, `APISID`, `SAPISID`, `__Secure-1PSIDTS`, `__Secure-3PSIDTS`, `NID`, `OTZ`) which don't rotate. These are valid for weeks.
- **Added `redirect: 'manual'` to fetch**: Previously `redirect: 'follow'` silently followed the sign-in redirect and returned 200 with login page HTML. Google's login page happens to contain its own `ds:0` script with garbage values (e.g. `"af"`). Now detects 3xx and returns `undefined` cleanly with a warning log.
- **Sanity check on page identity**: Added guard to verify the returned HTML is actually the credits page before attempting to parse `ds:0`.

### Fixed (2026-04-03 — code review)

- **ISS-1 (HIGH) — String-aware bracket parser**: The `ds:0` JSON array extractor in `fetchGeminiCredits()` now correctly tracks string boundaries (`inStr`/`esc`), making it immune to `[` or `]` characters inside JSON string values that previously could corrupt the depth counter and cause silent parse failures.
- **ISS-2 (MEDIUM) — Structure validation logging**: Added a `console.warn` when `dataArray[0][0]` is not a valid array, providing visibility into unexpected Google API shape changes instead of silently falling through to the fallback.
- **ISS-3 (LOW) — ESLint configuration**: Added `eslint.config.mjs` (flat config for ESLint v10+) with `typescript-eslint` recommended rules. Installed `typescript-eslint` and `@eslint/js` as dev deps. Fixed two resulting lint errors: replaced `as any` cast (line 112) with a typed interface, and removed superfluous empty initializer on `accounts` variable.
- **ISS-4 (LOW) — Build artifact in git**: Added `*.tsbuildinfo` to `.gitignore` and removed `tsconfig.tsbuildinfo` from git tracking.
- **ISS-5 (LOW) — Fallback source transparency**: Strategy 2 (WIZ_global_data) now logs a `console.warn` when triggered (visible in Vercel logs) and the UI subtext changes to `Quota limit · Next update: ...` so users can distinguish the limit from the actual remaining balance.

### Fixed (2026-04-03 — session 2)

- **Gemini AI Credits parsing**: Confirmed and hardened the `ds:0` `AF_initDataCallback` parsing strategy in `app/api/credits/antigravity/route.ts`. Verified via live browser inspection that the credit value (e.g. `931`) is **server-side rendered** in the initial HTML — not fetched via any XHR/batchexecute call. Data path: `data[0][0][0]` = remaining credits, `data[0][0][1][0]` = next reset epoch (seconds). Strategy 1 in `fetchGeminiCredits()` is aligned with the live structure.

### Fixed (2026-04-03)

- **Sync Display Timezone**: Fixed the "Last Sync" timestamp showing UTC time (2 hours behind local time) by using local time methods (`getHours`, `getMinutes`) with a `mounted` state in `ProviderCard` to ensure hydration safety. Renamed `shortTime` helper to `shortTimeLocal` for clarity.
- **Freshness Enforcement**: Forced API routes to be dynamic (`force-dynamic`) and replaced `next: { revalidate: 300 }` with `cache: 'no-store'` in all `fetch()` calls to ensure `lastUpdated` timestamps are always fresh and never statically cached or stale.

## [2026-03-31]

### Added (2026-03-31)

- **Vercel Agentic Integration Guide**: Added a new documentation file `.agent/VERCEL_AGENT_INTEGRATION.md` based on new Vercel features (March 2026) including `vercel api`, `-m` metadata support, machine-readable guides, and LLM documentation access.

### Changed (2026-03-31)

- **PromoWidget**: Updated Claude logic to align with standard global Peak/Off-peak 13:00-19:00 UTC schedule, and enhanced visual distinction using `red-500` and `emerald-500` text indicators.

## [2026-03-20]

### Added (2026-03-20)

- **PromoWidget**: Display live off-peak tracking for Claude and other providers on the main dashboard header without third-party API dependencies.
- **Accessibility**: Improved page accessibility by explicitly defining HTML `lang` attributes and adding descriptive `aria-label` tags to navigational and interactive components.

### Fixed (2026-03-20)

- **Vercel Deployment**: Fixed layout wrapping issues, interval leaks in PromoWidget, and integrated Vercel Production deploying scripts.
- **Favicon**: Migrated `icon.svg` to App Router standard `app/icon.svg` and removed explicit metadata overrides to fix tab icon display across all browsers.

## [2026-03-18]

### Added (2026-03-18)

- **Multi-account support for Antigravity**: Refactored the dashboard and API to support switching between multiple Google accounts using a tabbed interface.
- **Shared AI Credits display**: Integrated shared Google One AI Credits information (Remaining Credits and Next Update) into the Antigravity section, extracted from page data.
- **Improved Filter for Antigravity**: Curated the model list to show only highly relevant models: Gemini 3.1 Pro (High), Gemini 3 Flash, Claude Opus 4.6 (Thinking), and Claude Sonnet 4.6 (Thinking).

### Fixed (2026-03-18)

- Hydration mismatch error in `Header` component by using `mounted` state to defer date/time rendering to the client. [#ddf1e0c2]
- Potential hydration mismatches in `ProviderCard` by using deterministic `shortTime` helper from `lib/utils`.
- Updated `lib/utils` `shortTime` to be more predictable across environments by using manual 24h formatting instead of local-dependent `toLocaleTimeString`.
- Fixed static type checking errors in `.agent/scripts/checklist.py` and implemented robust type hints using `TypedDict` for better maintainability.
