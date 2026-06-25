import { NextResponse } from "next/server";
import type { ProviderData } from "@/lib/types";
import { timeUntil, utilizationStatus } from "@/lib/utils";

export const dynamic = "force-dynamic";

const SESSION_COOKIE = process.env.OLLAMA_SESSION_COOKIE;

// Note: This endpoint parses HTML from ollama.com/settings which may break at any time
// if Ollama changes their page structure. The regex patterns below are specific to
// the current page structure but may need updates. Consider using an official API if available.

export async function GET() {
  if (!SESSION_COOKIE) {
    return NextResponse.json(
      { id: "ollama", name: "Ollama Cloud", type: "subscription", status: "error", error: "OLLAMA_SESSION_COOKIE must be set in .env.local", lastUpdated: new Date().toISOString() } as ProviderData,
      { status: 200 }
    );
  }

  try {
    const res = await fetch("https://ollama.com/settings", {
      headers: {
        Cookie: SESSION_COOKIE,
        Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.3.1 Safari/605.1.15",
      },
      cache: 'no-store',
    });

    if (!res.ok) throw new Error(`ollama.com returned ${res.status}`);

    const html = await res.text();

    // Parse session and weekly usage percentage using multiple robust fallback strategies
    let sessionPct: number | null = null;
    let weeklyPct: number | null = null;

    // Strategy 1: Parse aria-label on data-usage-track
    const sessionAria = html.match(/aria-label="Session usage\s+([\d.]+)%\s+used"/i);
    const weeklyAria = html.match(/aria-label="Weekly usage\s+([\d.]+)%\s+used"/i);
    if (sessionAria) sessionPct = parseFloat(sessionAria[1]);
    if (weeklyAria) weeklyPct = parseFloat(weeklyAria[1]);

    // Strategy 2: Parse text content matching "X usage" and "Y% used"
    if (sessionPct === null) {
      const sessionText = html.match(/Session usage<\/span>\s*<span[^>]*>\s*([\d.]+)%\s*used/i);
      if (sessionText) sessionPct = parseFloat(sessionText[1]);
    }
    if (weeklyPct === null) {
      const weeklyText = html.match(/Weekly usage<\/span>\s*<span[^>]*>\s*([\d.]+)%\s*used/i);
      if (weeklyText) weeklyPct = parseFloat(weeklyText[1]);
    }

    // Strategy 3: Fallback to progress bar width of bg-neutral-950 div (excluding button segments)
    if (sessionPct === null || weeklyPct === null) {
      const divWidthMatches = [...html.matchAll(/<div[^>]*class="[^"]*bg-neutral-950[^"]*"[^>]*style="width:\s*([\d.]+)%/g)];
      const divWidths = divWidthMatches.map((m) => parseFloat(m[1])).filter((v) => v >= 0 && v <= 100);
      if (divWidths.length >= 2) {
        if (sessionPct === null) sessionPct = divWidths[0];
        if (weeklyPct === null) weeklyPct = divWidths[1];
      }
    }

    // Extract reset times: data-time="..." from local-time elements
    const timeMatches1 = [...html.matchAll(/class="[^"]*local-time[^"]*"[^>]*data-time="([^"]+)"/g)].map(m => m[1]);
    const timeMatches2 = [...html.matchAll(/data-time="([^"]+)"/g)].map(m => m[1]);
    const times = timeMatches1.length >= 2 ? timeMatches1 : timeMatches2;

    if (sessionPct === null || weeklyPct === null || times.length < 2) {
      throw new Error("Could not parse usage data from page — session cookie may have expired or page structure changed");
    }

    const sessionReset = times[0];
    const weeklyReset = times[1];

    const usageBars = [
      {
        label: "Session usage",
        used: sessionPct,
        resetsAt: sessionReset,
        resetsIn: timeUntil(sessionReset),
      },
      {
        label: "Weekly usage",
        used: weeklyPct,
        resetsAt: weeklyReset,
        resetsIn: timeUntil(weeklyReset),
      },
    ];

    const provider: ProviderData = {
      id: "ollama",
      name: "Ollama Cloud",
      type: "subscription",
      status: utilizationStatus(Math.max(sessionPct, weeklyPct)),
      usageBars,
      lastUpdated: new Date().toISOString(),
    };

    return NextResponse.json(provider);
  } catch (err) {
    console.error("Ollama route failed", {
      message: err instanceof Error ? err.message : "Unknown upstream error",
    });
    return NextResponse.json({
      id: "ollama",
      name: "Ollama Cloud",
      type: "subscription",
      status: "error",
      error: "Failed to fetch Ollama Cloud usage. Check server logs and credentials.",
      lastUpdated: new Date().toISOString(),
    } as ProviderData, { status: 200 });
  }
}
