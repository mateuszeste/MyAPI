import { NextResponse } from "next/server";
import type { ProviderData } from "@/lib/types";
import { utilizationStatus } from "@/lib/utils";

export const dynamic = "force-dynamic";

const SESSION_COOKIE = process.env.KILO_SESSION_COOKIE;

interface CreditBlock {
  id: string;
  effective_date: string;
  expiry_date: string;
  balance_mUsd: number;
  amount_mUsd: number;
  is_free: boolean;
}

interface CreditBlocksResponse {
  result: {
    data: {
      creditBlocks: CreditBlock[];
      totalBalance_mUsd: number;
      autoTopUpEnabled: boolean;
    };
  };
}

// amounts are in micro-USD (1/1,000,000 of a dollar)
const toUsd = (mUsd: number) => Math.round((mUsd / 1_000_000) * 10000) / 10000;

export async function GET() {
  if (!SESSION_COOKIE) {
    return NextResponse.json(
      { id: "kilocode", name: "Kilo Code", type: "credits", status: "error", error: "KILO_SESSION_COOKIE must be set in .env.local", lastUpdated: new Date().toISOString() } as ProviderData,
      { status: 200 }
    );
  }

  try {
    const res = await fetch(
      "https://app.kilo.ai/api/trpc/user.getCreditBlocks?batch=1&input=%7B%220%22%3A%7B%7D%7D",
      {
        headers: {
          Cookie: SESSION_COOKIE,
          Accept: "*/*",
          "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.3.1 Safari/605.1.15",
          Referer: "https://app.kilo.ai/credits",
        },
        cache: 'no-store',
      }
    );

    if (!res.ok) throw new Error(`Kilo Code returned ${res.status}`);

    const json: CreditBlocksResponse[] = await res.json();
    const data = json[0]?.result?.data;
    if (!data) throw new Error("Unexpected response shape from Kilo Code API");

    const totalUsd = toUsd(data.totalBalance_mUsd);

    // Use the largest block's amount as the "total granted" for % calculation
    const maxBlock = data.creditBlocks.reduce(
      (best, b) => (b.amount_mUsd > best.amount_mUsd ? b : best),
      data.creditBlocks[0]
    );
    const totalGrantedUsd = maxBlock ? toUsd(maxBlock.amount_mUsd) : undefined;

    const usedPct = totalGrantedUsd
      ? Math.max(0, ((totalGrantedUsd - totalUsd) / totalGrantedUsd) * 100)
      : 0;

    const provider: ProviderData = {
      id: "kilocode",
      name: "Kilo Code",
      type: "credits",
      status: utilizationStatus(usedPct),
      creditsRemaining: totalUsd,
      creditsTotal: totalGrantedUsd,
      currency: "USD",
      lastUpdated: new Date().toISOString(),
    };

    return NextResponse.json(provider);
  } catch (err) {
    console.error("Kilo Code route failed", {
      message: err instanceof Error ? err.message : "Unknown upstream error",
    });
    return NextResponse.json({
      id: "kilocode",
      name: "Kilo Code",
      type: "credits",
      status: "error",
      error: "Failed to fetch Kilo Code credits. Check server logs and credentials.",
      lastUpdated: new Date().toISOString(),
    } as ProviderData, { status: 200 });
  }
}
