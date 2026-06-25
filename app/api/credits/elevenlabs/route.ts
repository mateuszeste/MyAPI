import { NextResponse } from "next/server";
import type { ProviderData } from "@/lib/types";
import { utilizationStatus } from "@/lib/utils";

export const dynamic = "force-dynamic";

const API_KEY = process.env.ELEVENLABS_API_KEY;

export async function GET() {
  if (!API_KEY) {
    return NextResponse.json(
      { id: "elevenlabs", name: "ElevenLabs", type: "credits", status: "error", error: "ELEVENLABS_API_KEY must be set in .env.local", lastUpdated: new Date().toISOString() } as ProviderData,
      { status: 200 }
    );
  }

  try {
    const res = await fetch("https://api.elevenlabs.io/v1/user/subscription", {
      headers: {
        "xi-api-key": API_KEY,
        Accept: "application/json",
      },
      cache: "no-store",
    });

    if (!res.ok) throw new Error(`ElevenLabs returned ${res.status}`);

    const data = await res.json();

    const used: number = data.character_count ?? 0;
    const limit: number = data.character_limit ?? 0;
    const remaining = Math.max(0, limit - used);
    const usagePct = limit > 0 ? (used / limit) * 100 : 0;

    const provider: ProviderData = {
      id: "elevenlabs",
      name: "ElevenLabs",
      type: "credits",
      status: utilizationStatus(usagePct),
      creditsRemaining: remaining,
      creditsTotal: limit,
      lastUpdated: new Date().toISOString(),
    };

    return NextResponse.json(provider);
  } catch (err) {
    console.error("ElevenLabs route failed", {
      message: err instanceof Error ? err.message : "Unknown upstream error",
    });
    return NextResponse.json({
      id: "elevenlabs",
      name: "ElevenLabs",
      type: "credits",
      status: "error",
      error: "Failed to fetch ElevenLabs subscription data. Check server logs and credentials.",
      lastUpdated: new Date().toISOString(),
    } as ProviderData, { status: 200 });
  }
}
