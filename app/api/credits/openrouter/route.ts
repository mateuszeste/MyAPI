import { NextResponse } from "next/server";
import type { OpenRouterCreditsResponse, ProviderData } from "@/lib/types";

const API_KEY = process.env.OPENROUTER_API_KEY;

export async function GET() {
  if (!API_KEY) {
    return NextResponse.json(
      { id: "openrouter", name: "OpenRouter", type: "credits", status: "error", error: "OPENROUTER_API_KEY must be set in .env.local", lastUpdated: new Date().toISOString() } as ProviderData,
      { status: 200 }
    );
  }

  try {
    const res = await fetch("https://openrouter.ai/api/v1/credits", {
      headers: {
        Authorization: `Bearer ${API_KEY}`,
        "Content-Type": "application/json",
      },
      cache: 'no-store',
    });

    if (!res.ok) throw new Error(`OpenRouter returned ${res.status}`);

    const { data }: OpenRouterCreditsResponse = await res.json();
    const totalCredits = data.total_credits ?? 0;
    const totalUsage = data.total_usage ?? 0;
    const remaining = Math.max(0, totalCredits - totalUsage);

    const ratio = totalCredits > 0 ? remaining / totalCredits : 1;
    const statusValue: ProviderData["status"] =
      remaining <= 0 ? "critical" : ratio < 0.15 ? "warning" : "ok";

    const provider: ProviderData = {
      id: "openrouter",
      name: "OpenRouter",
      type: "credits",
      status: statusValue,
      creditsRemaining: Math.round(remaining * 10000) / 10000,
      creditsTotal: totalCredits,
      currency: "USD",
      lastUpdated: new Date().toISOString(),
    };

    return NextResponse.json(provider);
  } catch (err) {
    console.error("OpenRouter route failed", {
      message: err instanceof Error ? err.message : "Unknown upstream error",
    });
    return NextResponse.json({
      id: "openrouter",
      name: "OpenRouter",
      type: "credits",
      status: "error",
      error: "Failed to fetch OpenRouter credits. Check server logs and credentials.",
      lastUpdated: new Date().toISOString(),
    } as ProviderData, { status: 200 });
  }
}
