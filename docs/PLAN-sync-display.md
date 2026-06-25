# Plan: Fix Sync Display Timezone Issue

The user identified a 2-hour time difference between the "Last Sync" time and their wall clock. Analysis confirms this is because the system uses UTC methods (`getUTCHours()`, `getUTCMinutes()`) in the formatting utility, while the user expects local time.

## Phase 1: Formatting Fix

Modify `lib/utils.ts` to use local time methods but implement a hydration-safe pattern to avoid Next.js hydration warnings.

- **File:** `lib/utils.ts`
- **Action:** Update `shortTime` to use `getHours()` and `getMinutes()`.

## Phase 2: Hydration Safety in UI

Update `ProviderCard.tsx` to handle the transition between SSR/Build-time rendering and client-side local time rendering.

- **File:** `components/ProviderCard.tsx`
- **Action:** Use a `mounted` state to only display the specific time string after the component has hydrated on the client.

## Phase 3: Freshness Enforcement

Ensure that API routes always calculate a fresh timestamp by marking them as dynamic. This prevents Next.js from caching the "Static" part of the response (like `lastUpdated`) during build or through aggressive caching.

- **Files:**
  - `app/api/credits/claude/route.ts`
  - `app/api/credits/openai/route.ts`
  - `app/api/credits/antigravity/route.ts`
  - `app/api/credits/ollama/route.ts`
  - `app/api/credits/kilocode/route.ts`
- **Action:** Add `export const dynamic = "force-dynamic";` to each file.

## Verification

1. Open the dashboard.
2. Check if "Last Sync" matches the local time shown in the header.
3. Verify no "Hydration failed" errors in the browser console.

