// ─── Shared provider response shape ─────────────────────────────────────────

export type ProviderStatus = "ok" | "warning" | "critical" | "error" | "loading";

export interface UsageBar {
  label: string;
  used: number;       // 0–100 percentage
  resetsAt?: string;  // ISO date string
  resetsIn?: string;  // Human-readable e.g. "2h 4m"
}

export interface ProviderData {
  id: string;
  name: string;
  type: "subscription" | "credits" | "hybrid"; // subscription = plan limits, credits = pay-as-you-go
  status: ProviderStatus;

  // For subscription plans (Claude Pro, Antigravity, etc.)
  usageBars?: UsageBar[];

  // For credit-based (OpenRouter, OpenAI API, Kilo Code)
  creditsRemaining?: number;
  creditsTotal?: number;
  currency?: string;

  // Shared/Global Info (e.g. Google One AI Credits)
  sharedCredits?: {
    label: string;
    value: string;
    subtext?: string;
  };

  // Meta
  lastUpdated?: string;
  error?: string;

  // Public account labels for multi-account providers. Never expose secrets or raw emails here.
  accounts?: { label?: string }[];
}

// ─── Individual API route response types ─────────────────────────────────────

export interface ClaudeUsageResponse {
  five_hour: { utilization: number; resets_at: string } | null;
  seven_day: { utilization: number; resets_at: string } | null;
  extra_usage: { is_enabled: boolean } | null;
}

export interface OpenRouterCreditsResponse {
  data: {
    total_credits: number;
    total_usage: number;
  };
}
