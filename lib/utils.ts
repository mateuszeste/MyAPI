import type { ProviderData, ProviderStatus } from "./types";

export interface ProviderUsageSnapshot {
  usageBars: Record<string, number>;
  creditsRemaining?: number;
  sharedCreditsValue?: number;
}

/**
 * Convert a future ISO date string into a human-readable countdown.
 * e.g. "2026-03-18T14:00:00Z" → "1h 45m"
 */
export function timeUntil(isoOrEpoch: string): string {
  const parsedNum = Number(isoOrEpoch);
  const ts = isNaN(parsedNum) 
    ? new Date(isoOrEpoch).getTime() 
    : parsedNum * 1000;
  
  if (isNaN(ts)) return "unknown";
  
  const diff = ts - Date.now();
  if (diff <= 0) return "now";
  
  const totalHours = Math.floor(diff / 3_600_000);
  const m = Math.floor((diff % 3_600_000) / 60_000);
  
  if (totalHours >= 24) {
    const d = Math.floor(totalHours / 24);
    const h = totalHours % 24;
    const parts = [`${d}d`];
    if (h > 0) parts.push(`${h}h`);
    if (m > 0) parts.push(`${m}m`);
    return parts.join(" ");
  }
  
  if (totalHours === 0) return `${m}m`;
  if (m === 0) return `${totalHours}h`;
  return `${totalHours}h ${m}m`;
}

/**
 * Format an ISO date to a short local time string (24h format).
 * ⚠️ Uses local timezone — only safe to call in client-only contexts
 *    (guarded by a `mounted` check to avoid SSR/CSR mismatch).
 * e.g. "2026-03-18T14:00:00Z" → "14:00" (in UTC+0)
 */
export function shortTimeLocal(isoOrEpoch: string): string {
  const parsedNum = Number(isoOrEpoch);
  const ts = isNaN(parsedNum) 
    ? new Date(isoOrEpoch).getTime() 
    : parsedNum * 1000;

  if (isNaN(ts)) return "--:--";

  const d = new Date(ts);
  const h = d.getHours().toString().padStart(2, '0');
  const m = d.getMinutes().toString().padStart(2, '0');
  return `${h}:${m}`;
}

function parseNumericMetric(value?: string): number | undefined {
  if (!value) return undefined;

  const normalized = value.replace(/,/g, "").trim();
  if (!/^[-+]?\d*\.?\d+$/.test(normalized)) return undefined;

  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : undefined;
}

export function createProviderUsageSnapshot(data: ProviderData): ProviderUsageSnapshot {
  const usageBars = Object.fromEntries(
    (data.usageBars ?? []).map((bar) => [bar.label, bar.used])
  );

  return {
    usageBars,
    creditsRemaining: data.creditsRemaining,
    sharedCreditsValue: parseNumericMetric(data.sharedCredits?.value),
  };
}

export function parseProviderUsageSnapshot(raw: string | null): ProviderUsageSnapshot | null {
  if (!raw) return null;

  try {
    const parsed = JSON.parse(raw) as Partial<ProviderUsageSnapshot>;
    const usageBars =
      parsed.usageBars && typeof parsed.usageBars === "object"
        ? Object.fromEntries(
            Object.entries(parsed.usageBars).filter((entry): entry is [string, number] => {
              const [, value] = entry;
              return typeof value === "number" && Number.isFinite(value);
            })
          )
        : {};

    return {
      usageBars,
      creditsRemaining:
        typeof parsed.creditsRemaining === "number" && Number.isFinite(parsed.creditsRemaining)
          ? parsed.creditsRemaining
          : undefined,
      sharedCreditsValue:
        typeof parsed.sharedCreditsValue === "number" && Number.isFinite(parsed.sharedCreditsValue)
          ? parsed.sharedCreditsValue
          : undefined,
    };
  } catch {
    return null;
  }
}

export function didProviderUsageIncrease(
  previous: ProviderUsageSnapshot,
  next: ProviderUsageSnapshot
): boolean {
  for (const [label, nextValue] of Object.entries(next.usageBars)) {
    const previousValue = previous.usageBars[label];
    if (typeof previousValue === "number" && nextValue > previousValue) {
      return true;
    }
  }

  if (
    typeof previous.creditsRemaining === "number" &&
    typeof next.creditsRemaining === "number" &&
    next.creditsRemaining < previous.creditsRemaining
  ) {
    return true;
  }

  if (
    typeof previous.sharedCreditsValue === "number" &&
    typeof next.sharedCreditsValue === "number" &&
    next.sharedCreditsValue < previous.sharedCreditsValue
  ) {
    return true;
  }

  return false;
}

export function resolveProviderUsageTracking(
  previousSnapshot: ProviderUsageSnapshot | null,
  data: ProviderData,
  previousUsedAt?: string,
  nowIso = new Date().toISOString()
): { snapshot: ProviderUsageSnapshot; usedAt?: string } {
  if (data.status === "error") {
    return { snapshot: createProviderUsageSnapshot(data), usedAt: previousUsedAt };
  }

  const snapshot = createProviderUsageSnapshot(data);

  if (!previousSnapshot) {
    return { snapshot, usedAt: previousUsedAt };
  }

  if (didProviderUsageIncrease(previousSnapshot, snapshot)) {
    return { snapshot, usedAt: nowIso };
  }

  return { snapshot, usedAt: previousUsedAt };
}


/**
 * Derive a status colour from a utilisation percentage (0–100).
 */
export function utilizationStatus(pct: number): ProviderStatus {
  if (pct >= 90) return "critical";
  if (pct >= 60) return "warning";
  return "ok";
}

/**
 * Convert a past ISO date string into a human-readable relative time.
 * e.g. "2026-04-04T01:00:00Z" → "3m ago", "2h ago", "just now"
 * ⚠️ Only safe to call client-side (guarded by mounted check).
 */
export function timeAgo(isoOrEpoch: string): string {
  const parsedNum = Number(isoOrEpoch);
  const ts = isNaN(parsedNum)
    ? new Date(isoOrEpoch).getTime()
    : parsedNum * 1000;

  if (isNaN(ts)) return "unknown";

  const diff = Date.now() - ts;
  if (diff < 10_000) return "just now";
  if (diff < 60_000) return `${Math.floor(diff / 1_000)}s ago`;

  const m = Math.floor(diff / 60_000);
  if (m < 60) return `${m}m ago`;

  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;

  const d = Math.floor(h / 24);
  return `${d}d ago`;
}
