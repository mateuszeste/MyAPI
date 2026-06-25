import { NextResponse } from "next/server";
import type { ProviderData } from "@/lib/types";
import { timeUntil, utilizationStatus } from "@/lib/utils";

export const dynamic = "force-dynamic";

const ACCOUNTS_JSON = process.env.CHATGPT_ACCOUNTS;

interface ChatGptAccount {
  label: string;
  auth_token: string;
  session_cookie: string;
}

interface WhamWindow {
  used_percent: number;
  limit_window_seconds: number;
  reset_after_seconds: number;
  reset_at: number; // Unix timestamp (seconds)
}

interface WhamUsageResponse {
  plan_type: string;
  rate_limit: { 
    primary_window: WhamWindow | null;
    secondary_window?: WhamWindow | null;
  } | null;
  code_review_rate_limit: { 
    primary_window: WhamWindow | null;
    secondary_window?: WhamWindow | null;
  } | null;
}

function getWindowLabel(seconds: number, _prefix: string): string {
  if (seconds <= 18000) return `Current session (5h)`;
  if (seconds <= 86400) return `Daily (24h)`;
  if (seconds <= 604800) return `Weekly (all models)`;
  return `Monthly limit`;
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const indexStr = searchParams.get("accountIndex");
  const accountIndex = indexStr && !isNaN(parseInt(indexStr, 10)) ? parseInt(indexStr, 10) : 0;

  if (!ACCOUNTS_JSON) {
    return NextResponse.json(
      { id: "openai", name: "ChatGPT Codex", type: "subscription", status: "error", error: "CHATGPT_ACCOUNTS must be set in .env.local", lastUpdated: new Date().toISOString() } as ProviderData,
      { status: 200 }
    );
  }

  let accounts: ChatGptAccount[];
  try {
    accounts = JSON.parse(ACCOUNTS_JSON);
    if (!Array.isArray(accounts)) {
      throw new Error("CHATGPT_ACCOUNTS must be a JSON array");
    }
    for (const acc of accounts) {
      if (typeof acc !== "object" || acc === null) {
        throw new Error("Each account must be an object");
      }
      if (
        typeof acc.label !== "string" ||
        typeof acc.auth_token !== "string" ||
        typeof acc.session_cookie !== "string"
      ) {
        throw new Error("Each account must have label, auth_token, and session_cookie as strings");
      }
    }
  } catch (e) {
    console.error("ChatGPT account configuration error", {
      message: e instanceof Error ? e.message : "Unknown configuration error",
    });
    return NextResponse.json({
      id: "openai",
      name: "ChatGPT Codex",
      type: "subscription",
      status: "error",
      error: "Backend configuration error. Check CHATGPT_ACCOUNTS on the server.",
      lastUpdated: new Date().toISOString()
    } as ProviderData, { status: 200 });
  }

  const account = accounts[accountIndex];
  if (!account) {
    return NextResponse.json({
      id: "openai",
      name: "ChatGPT Codex",
      type: "subscription",
      status: "error",
      error: `Account index ${accountIndex} out of range`,
      lastUpdated: new Date().toISOString()
    } as ProviderData, { status: 200 });
  }

  const AUTH_TOKEN = account.auth_token;
  const SESSION_COOKIE = account.session_cookie;

  try {
    const res = await fetch("https://chatgpt.com/backend-api/wham/usage", {
      headers: {
        Authorization: `Bearer ${AUTH_TOKEN}`,
        Cookie: SESSION_COOKIE,
        "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.3.1 Safari/605.1.15",
        Accept: "*/*",
        Referer: "https://chatgpt.com/codex/settings/usage",
        "OAI-Client-Version": "prod-eaf930e5ee4c7f67213362b2579543fa4519d4f5",
        "OAI-Language": "pl-PL",
        "X-OpenAI-Target-Path": "/backend-api/wham/usage",
        "X-OpenAI-Target-Route": "/backend-api/wham/usage",
      },
      cache: 'no-store',
    });

    if (!res.ok) {
      if (res.status === 401) {
        throw new Error("Token expired. Please update CHATGPT_ACCOUNTS in .env.local.");
      }
      throw new Error(`ChatGPT returned ${res.status}`);
    }

    const data: WhamUsageResponse = await res.json();

    const usageBars = [];

    const primaryWindow = data.rate_limit?.primary_window;
    if (primaryWindow) {
      const resetIso = new Date(primaryWindow.reset_at * 1000).toISOString();
      usageBars.push({
        label: getWindowLabel(primaryWindow.limit_window_seconds, "Limit"),
        used: primaryWindow.used_percent,
        resetsAt: resetIso,
        resetsIn: timeUntil(resetIso),
      });
    }

    const secondaryWindow = data.rate_limit?.secondary_window;
    if (secondaryWindow) {
      const resetIso = new Date(secondaryWindow.reset_at * 1000).toISOString();
      usageBars.push({
        label: getWindowLabel(secondaryWindow.limit_window_seconds, "Limit"),
        used: secondaryWindow.used_percent,
        resetsAt: resetIso,
        resetsIn: timeUntil(resetIso),
      });
    }

    const codeReviewWindow = data.code_review_rate_limit?.primary_window;
    if (codeReviewWindow) {
      const resetIso = new Date(codeReviewWindow.reset_at * 1000).toISOString();
      usageBars.push({
        label: getWindowLabel(codeReviewWindow.limit_window_seconds, "Code review"),
        used: codeReviewWindow.used_percent,
        resetsAt: resetIso,
        resetsIn: timeUntil(resetIso),
      });
    }

    const maxUsed = usageBars.reduce((max, b) => Math.max(max, b.used), 0);
    const accountLabels = accounts.map(acc => ({ label: acc.label }));

    const provider: ProviderData = {
      id: "openai",
      name: "ChatGPT Codex",
      type: "subscription",
      status: utilizationStatus(maxUsed),
      usageBars,
      accounts: accountLabels,
      lastUpdated: new Date().toISOString(),
    };

    return NextResponse.json(provider);
  } catch (err) {
    console.error("ChatGPT route failed", {
      message: err instanceof Error ? err.message : "Unknown upstream error",
    });
    return NextResponse.json({
      id: "openai",
      name: "ChatGPT Codex",
      type: "subscription",
      status: "error",
      error: "Failed to fetch ChatGPT Codex usage. Check server logs and credentials.",
      lastUpdated: new Date().toISOString(),
    } as ProviderData, { status: 200 });
  }
}
