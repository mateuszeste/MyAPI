import { NextResponse } from "next/server";
import type { ClaudeUsageResponse, ProviderData } from "@/lib/types";
import { timeUntil, utilizationStatus } from "@/lib/utils";

export const dynamic = "force-dynamic";

const ORG_ID = process.env.CLAUDE_ORG_ID;
const SESSION_COOKIE = process.env.CLAUDE_SESSION_COOKIE;
const DEVICE_ID = process.env.CLAUDE_DEVICE_ID;

export async function GET() {
  if (!ORG_ID || !SESSION_COOKIE) {
    return NextResponse.json(
      { id: "claude", name: "Claude Pro", type: "subscription", status: "error", error: "CLAUDE_ORG_ID and CLAUDE_SESSION_COOKIE must be set in .env.local", lastUpdated: new Date().toISOString() } as ProviderData,
      { status: 200 }
    );
  }

  try {
    const res = await fetch(
      `https://claude.ai/api/organizations/${ORG_ID}/usage`,
      {
        headers: {
          Cookie: SESSION_COOKIE,
          "anthropic-client-platform": "web_claude_ai",
          "anthropic-client-version": "1.0.0",
          "anthropic-client-sha": process.env.CLAUDE_CLIENT_SHA || "5240f40ceecb8c378bcaf4241ded41c269c66777",
          "anthropic-device-id": DEVICE_ID ?? "",
          "anthropic-anonymous-id": process.env.CLAUDE_ANONYMOUS_ID || "claudeai.v1.d0216b77-3f66-4748-bbf0-97d0d3ec5f2d",
          "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.3.1 Safari/605.1.15",
          Referer: "https://claude.ai/settings/usage",
          Accept: "application/json",
          "Content-Type": "application/json",
        },
        // Revalidate every 5 minutes
        cache: 'no-store',
      }
    );

    if (!res.ok) {
      throw new Error(`claude.ai returned ${res.status}`);
    }

    const data: ClaudeUsageResponse = await res.json();

    const usageBars = [];

    if (data.five_hour) {
      usageBars.push({
        label: "Current session (5h)",
        used: data.five_hour.utilization,
        resetsAt: data.five_hour.resets_at,
        resetsIn: timeUntil(data.five_hour.resets_at),
      });
    }

    if (data.seven_day) {
      usageBars.push({
        label: "Weekly (all models)",
        used: data.seven_day.utilization,
        resetsAt: data.seven_day.resets_at,
        resetsIn: timeUntil(data.seven_day.resets_at),
      });
    }

    // Derive overall status from the most-used bar
    const maxUsed = usageBars.reduce((max, b) => Math.max(max, b.used), 0);

    const provider: ProviderData = {
      id: "claude",
      name: "Claude Pro",
      type: "subscription",
      status: utilizationStatus(maxUsed),
      usageBars,
      lastUpdated: new Date().toISOString(),
    };

    return NextResponse.json(provider);
  } catch (err) {
    console.error("Claude route failed", {
      message: err instanceof Error ? err.message : "Unknown upstream error",
    });
    const provider: ProviderData = {
      id: "claude",
      name: "Claude Pro",
      type: "subscription",
      status: "error",
      error: "Failed to fetch Claude usage. Check server logs and credentials.",
      lastUpdated: new Date().toISOString(),
    };
    return NextResponse.json(provider, { status: 200 });
  }
}
