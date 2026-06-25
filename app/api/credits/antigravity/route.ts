import { NextResponse } from "next/server";
import type { ProviderData, UsageBar } from "@/lib/types";
import { timeUntil } from "@/lib/utils";

export const dynamic = "force-dynamic";
export const preferredRegion = "fra1";

// ─── Config ──────────────────────────────────────────────────────────────────
const ACCOUNTS_JSON  = process.env.ANTIGRAVITY_ACCOUNTS;
const PROJECT_ID     = process.env.ANTIGRAVITY_PROJECT_ID;



// Google OAuth2 client credentials
// Must set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET in .env.local
const GOOGLE_CLIENT_ID     = process.env.GOOGLE_CLIENT_ID;
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;

// ─── Token exchange ───────────────────────────────────────────────────────────
async function getAccessToken(refreshToken: string): Promise<string> {
  if (!GOOGLE_CLIENT_ID || !GOOGLE_CLIENT_SECRET) {
    throw new Error("Missing Google OAuth credentials. Set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET in .env.local");
  }

  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id:     GOOGLE_CLIENT_ID!,
      client_secret: GOOGLE_CLIENT_SECRET!,
      refresh_token: refreshToken,
      grant_type:    "refresh_token",
    }),
    cache: "no-store",
  });

  if (!res.ok) throw new Error(`Token exchange failed: ${res.status}`);
  const data = await res.json();
  if (!data.access_token) throw new Error("No access_token in response");
  return data.access_token;
}

// ─── Quota fetch ──────────────────────────────────────────────────────────────
interface ModelQuota {
  model:             string;
  remainingFraction: number;   // 0.0 = exhausted, 1.0 = full
  resetTime?:        string;   // ISO or epoch string, if present
}

interface RawModelEntry {
  name?: string;
  displayName?: string;
  model?: string;
  quotaInfo?: {
    remainingFraction?: number;
    quotaResetTime?: string;
    resetTime?: string;
    nextUpdateTime?: string | number | { seconds?: string | number };
  };
  remainingFraction?: number;
  quotaResetTime?: string;
  resetTime?: string;
  nextUpdateTime?: string | number | { seconds?: string | number };
}

async function fetchQuotas(accessToken: string, projectId: string): Promise<ModelQuota[]> {
  const res = await fetch(
    "https://cloudcode-pa.googleapis.com/v1internal:fetchAvailableModels",
    {
      method: "POST",
      headers: {
        Authorization:  `Bearer ${accessToken}`,
        "Content-Type": "application/json",
        "User-Agent":   "antigravity/1.104.0",
      },
      body: JSON.stringify({ project: projectId }),
      cache: "no-store",
    }
  );

  if (!res.ok) {
    console.error("Antigravity fetchAvailableModels failed", { status: res.status });
    throw new Error(`fetchAvailableModels returned ${res.status}`);
  }
  
  const data = await res.json();

  // Response shape (from observed traffic):
  // { models: [{ name: "...", remainingFraction: 0.95, quotaResetTime: "..." }] }
  // or sometimes { availableModels: { "id": { remainingFraction: ... } } }
  
  const rawModels = data.models ?? data.availableModels ?? data.quotas ?? [];
  let modelList: RawModelEntry[] = [];
  
  if (Array.isArray(rawModels)) {
    modelList = rawModels as RawModelEntry[];
  } else if (typeof rawModels === "object" && rawModels !== null) {
    // Handle object shape by converting to array and preserving key as name if needed
    modelList = Object.entries(rawModels as Record<string, RawModelEntry>).map(([key, value]) => ({
      name: value.name ?? value.model ?? key,
      ...value
    }));
  }

  const models: ModelQuota[] = modelList.map((m: RawModelEntry) => {
    // Data can be at root or inside quotaInfo
    const q = m.quotaInfo || m;
    
    const rawReset = q.quotaResetTime || q.resetTime || q.nextUpdateTime || m.nextUpdateTime || m.resetTime || m.quotaResetTime;
    let resetStr: string | undefined = undefined;

    if (typeof rawReset === "string" || typeof rawReset === "number") {
      resetStr = String(rawReset);
    } else if (rawReset && typeof rawReset === "object" && 'seconds' in rawReset) {
      resetStr = String((rawReset as { seconds: string | number }).seconds);
    }
    
    // Fallback: If the API doesn't provide a reset time, Gemini API globally resets at 09:00 PDT (16:00 UTC).
    if (!resetStr) {
       const now = new Date();
       const nextReset = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 16, 0, 0));
       if (now.getTime() >= nextReset.getTime()) {
           nextReset.setUTCDate(nextReset.getUTCDate() + 1);
       }
       resetStr = nextReset.toISOString();
    }

    const modelName = String(m.displayName || m.name || m.model || "unknown");

    return {
      model:             modelName,
      // If remainingFraction is missing:
      // - For Gemini models: fallback to 1 (full) because Google sometimes omits it when unexhausted.
      // - For Claude/GPT-OSS: Google omits it when the model is locked/exhausted, so fallback to 0.
      remainingFraction: typeof q.remainingFraction === "number"
        ? q.remainingFraction
        : (modelName.toLowerCase().includes("gemini") ? 1 : 0),
      resetTime:         resetStr,
    };
  });

  return models;
}



// ─── Route handler ────────────────────────────────────────────────────────────
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const indexStr = searchParams.get("accountIndex");
  const accountIndex = indexStr && !isNaN(parseInt(indexStr, 10)) ? parseInt(indexStr, 10) : 0;

  if (!ACCOUNTS_JSON || !PROJECT_ID) {
    return NextResponse.json({
      id: "antigravity",
      name: "Antigravity",
      type: "subscription",
      status: "error",
      error: "ANTIGRAVITY_ACCOUNTS and ANTIGRAVITY_PROJECT_ID must be set in .env.local",
      lastUpdated: new Date().toISOString(),
    } as ProviderData);
  }

  // Parse and validate ACCOUNTS_JSON
  let accounts: { email: string; refresh_token: string; label?: string }[];
  try {
    accounts = JSON.parse(ACCOUNTS_JSON || '[]');
    if (!Array.isArray(accounts)) {
      throw new Error('ANTIGRAVITY_ACCOUNTS must be a JSON array');
    }
    // Validate structure of each account
    for (const acc of accounts) {
      if (typeof acc !== 'object' || acc === null) {
        throw new Error('Each account must be an object');
      }
      if (typeof acc.email !== 'string' || typeof acc.refresh_token !== 'string') {
        throw new Error('Each account must have email and refresh_token as strings');
      }
      if (acc.label !== undefined && typeof acc.label !== 'string') {
        throw new Error('Account label must be a string when provided');
      }
    }
  } catch (e) {
    console.error("Antigravity account configuration error", {
      message: e instanceof Error ? e.message : "Unknown configuration error",
    });
    return NextResponse.json({
      id: 'antigravity',
      name: 'Antigravity',
      type: 'subscription',
      status: 'error',
      error: 'Backend configuration error. Check server logs.',
      lastUpdated: new Date().toISOString(),
    } as ProviderData);
  }

  const account = accounts[accountIndex];

  if (!account) {
    // Differentiate between empty array and out-of-range index
    const errorMsg = accountIndex > 0
      ? `Account index ${accountIndex} out of range (${accounts.length} accounts configured)`
      : 'Configured accounts array is empty';
    return NextResponse.json({
      id: 'antigravity',
      name: 'Antigravity',
      type: 'subscription',
      status: 'error',
      error: errorMsg,
      lastUpdated: new Date().toISOString(),
    } as ProviderData);
  }

  try {
    const accessToken = await getAccessToken(account.refresh_token);
    const models = await fetchQuotas(accessToken, PROJECT_ID);

    const defaultModels = [
      "Gemini 3.5 Flash (High)",
      "Gemini 3.5 Flash (Medium)",
      "Gemini 3.5 Flash (Low)",
      "Gemini 3.1 Pro (High)",
      "Gemini 3.1 Pro (Low)",
      "Claude Sonnet 4.6 (Thinking)",
      "Claude Opus 4.6 (Thinking)",
      "GPT-OSS 120B (Medium)",
    ];
    const ASKED_MODELS = process.env.ANTIGRAVITY_MODELS
      ? process.env.ANTIGRAVITY_MODELS.split(",").map(s => s.trim())
      : defaultModels;

    const usageBars: UsageBar[] = models
      .filter((m) => {
        const name = m.model.toLowerCase();
        return ASKED_MODELS.some(asked => {
          const askedLower = asked.toLowerCase();
          // Direct match
          if (name === askedLower || name.includes(askedLower)) return true;
          // Unified Claude: "claude 4.6 (thinking)" matches both opus and sonnet variants
          if (askedLower === "claude 4.6 (thinking)") {
            return name.includes("claude opus 4.6") || name.includes("claude sonnet 4.6");
          }
          return false;
        });
      })
      .sort((a, b) => a.remainingFraction - b.remainingFraction) // worst first
      .map((m) => {
        const nameLower = m.model.toLowerCase();
        let groupLabel = m.model;
        const finalResetStr = m.resetTime;

        if (nameLower.includes("gemini")) {
          groupLabel = "Gemini";
        } else if (nameLower.includes("claude") || nameLower.includes("gpt-oss")) {
          groupLabel = "Claude";
        }

        return {
          label:    groupLabel,
          used:     Math.round((1 - m.remainingFraction) * 100),
          resetsAt: finalResetStr,
          resetsIn: finalResetStr ? timeUntil(finalResetStr) : undefined,
        };
      });

    // Deduplicate by label (keep the one with most usage/first)
    const uniqueBars: UsageBar[] = [];
    const seen = new Set<string>();
    for (const bar of usageBars) {
      if (!seen.has(bar.label)) {
        uniqueBars.push(bar);
        seen.add(bar.label);
      }
    }

    const maxUsed = uniqueBars.length > 0 ? Math.max(...uniqueBars.map((b) => b.used), 0) : 0;
    const status  = maxUsed >= 90 ? "critical" : maxUsed >= 60 ? "warning" : "ok";

    const accountLabels = accounts.map((acc, i) => ({
      label: acc.label?.trim() || `Account ${i + 1}`,
    }));

    return NextResponse.json({
      id:          "antigravity",
      name:        "Antigravity",
      type:        "subscription",
      status,
      usageBars:   uniqueBars,
      accounts:    accountLabels,
      lastUpdated: new Date().toISOString(),
    } as ProviderData);
  } catch (err) {
    console.error("Antigravity route failed", {
      message: err instanceof Error ? err.message : "Unknown upstream error",
    });
    return NextResponse.json({
      id:          "antigravity",
      name:        "Antigravity",
      type:        "subscription",
      status:      "error",
      error:       "Failed to fetch upstream quotas. Please check server logs.",
      lastUpdated: new Date().toISOString(),
    } as ProviderData);
  }
}
