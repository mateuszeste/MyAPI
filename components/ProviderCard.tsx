"use client";

import { useState, useEffect } from "react";
import type { ProviderData } from "@/lib/types";

import { shortTimeLocal, timeAgo, timeUntil } from "@/lib/utils";

const STATUS_COLOR: Record<string, string> = {
  ok: "var(--green)",
  warning: "var(--amber)",
  critical: "var(--red)",
  error: "var(--red)",
  loading: "var(--muted)",
};

const STATUS_LABEL: Record<string, string> = {
  ok: "NOMINAL",
  warning: "ELEVATED",
  critical: "CRITICAL",
  error: "OFFLINE",
  loading: "LOADING",
};

const PROVIDER_ICONS: Record<string, string> = {
  claude: "⬡",
  openrouter: "⊕",
  openai: "◎",
  antigravity: "◈",
  ollama: "◉",
  kilocode: "⟐",
  aws: "⬟",
  elevenlabs: "◆",
};

function UsageBar({ label, used, resetsIn, resetsAt, mounted = true }: {
  label: string;
  used: number;
  resetsIn?: string;
  resetsAt?: string;
  mounted?: boolean;
}) {
  const pct = Math.min(Math.max(used, 0), 100);
  const isCritical = pct >= 90;
  const color = isCritical ? "var(--red)" : "var(--green)";
  const displayResetsIn = mounted && resetsAt ? timeUntil(resetsAt) : resetsIn;

  return (
    <div className="space-y-2">
      <div className="flex justify-between items-end">
        <span className="text-[12px] font-bold text-muted uppercase tracking-wider">
          {label}
        </span>
        <span className="text-[14px] font-bold tabular-nums" style={{ color }}>
          {pct.toFixed(0)}%
        </span>
      </div>

      {/* Progress Track */}
      <div className="h-1 rounded-full bg-border/20 overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-1000 ease-out"
          style={{
            width: `${pct}%`,
            backgroundColor: color,
            boxShadow: `0 0 8px ${color}40`
          }}
        />
      </div>

      {/* Reset info */}
      {(displayResetsIn || resetsAt) && (
        <div className="flex justify-between opacity-70">
          {displayResetsIn && (
            <span className="text-[10px] font-bold text-muted uppercase tracking-[0.1em]">
              {displayResetsIn.includes('d') ? (parseInt(displayResetsIn) > 7 ? 'Monthly Reset' : 'Weekly Reset') : 'Reset'}: {displayResetsIn}
            </span>
          )}
          {resetsAt && (
            <span className="text-[10px] font-bold text-muted uppercase tracking-[0.1em]">
              @{mounted ? shortTimeLocal(resetsAt) : "--:--"}
            </span>
          )}
        </div>
      )}
    </div>
  );
}

function CreditDisplay({ remaining, total, currency }: {
  remaining?: number;
  total?: number;
  currency?: string;
}) {
  const sym = currency === "USD" ? "$" : currency ?? "";
  const pct = total && remaining !== undefined ? ((remaining / total) * 100) : null;
  const isCritical = pct !== null && pct < 10;
  const color = isCritical ? "var(--red)" : "var(--green)";

  return (
    <div className="space-y-4">
      <div className="flex items-baseline gap-1">
        <span className="text-3xl font-black tracking-tighter text-bright">
          <span className="text-muted opacity-30 mr-1">{sym}</span>
          {remaining?.toFixed(2) ?? "—"}
        </span>
        {total !== undefined && (
          <span className="text-[11px] font-bold text-muted opacity-40 uppercase tracking-widest ml-1">
            / {sym}{total.toFixed(0)}
          </span>
        )}
      </div>

      {pct !== null && (
        <div className="h-1 rounded-full bg-border/40 overflow-hidden">
          <div
            className="h-full rounded-full transition-all duration-1000 ease-out"
            style={{
              width: `${pct}%`,
              backgroundColor: color,
              boxShadow: `0 0 8px ${color}40`
            }}
          />
        </div>
      )}
    </div>
  );
}

function SharedCreditsDisplay({ label, value, subtext }: { label: string; value: string; subtext?: string }) {
  return (
    <div className="bg-panel/50 border border-border/10 rounded-lg p-4 transition-colors hover:bg-panel">
      <div className="flex justify-between items-center">
        <span className="text-[10px] font-bold text-muted uppercase tracking-widest">
          {label}
        </span>
        <span className="text-lg font-black tracking-tight text-bright">
          {value}
        </span>
      </div>
      {subtext && (
        <div className="text-[10px] font-bold text-muted opacity-70 uppercase tracking-[0.1em] text-right mt-1">
          {subtext}
        </div>
      )}
    </div>
  );
}

function UsageFooter({
  timestamp,
  mounted,
  featured = false,
  status,
}: {
  timestamp?: string;
  mounted: boolean;
  featured?: boolean;
  status: ProviderData["status"];
}) {
  const borderClass = featured ? "border-black/10" : "border-border";
  const labelClass = featured
    ? "text-[9px] font-black text-black/60 uppercase tracking-widest"
    : "text-[9px] font-bold text-muted uppercase tracking-widest";
  const valueClass = featured
    ? "text-[10px] font-black text-black/40"
    : "text-[10px] font-medium text-muted opacity-60";

  let label = "Used";
  let value = mounted && timestamp ? timeAgo(timestamp) : "—";

  if (!timestamp) {
    label = status === "loading" ? "Syncing" : "Tracking";
    value = mounted ? (status === "loading" ? "…" : "No history yet") : "—";
  }

  return (
    <div className={`flex items-center justify-between pt-4 border-t ${borderClass}`}>
      <span className={labelClass}>
        {label}
      </span>
      <span className={valueClass}>
        {value}
      </span>
    </div>
  );
}


interface Props {
  data: ProviderData;
  style?: React.CSSProperties;
  featured?: boolean;
}

export default function ProviderCard({ data, style, featured }: Props) {
  const [mounted, setMounted] = useState(false);
  const [, setTick] = useState(0);

  useEffect(() => {
    setMounted(true);
    // Re-render every 60s so relative timestamps stay fresh
    const id = setInterval(() => setTick(t => t + 1), 60_000);
    return () => clearInterval(id);
  }, []);

  const statusColor = STATUS_COLOR[data.status];

  const icon = PROVIDER_ICONS[data.id] ?? "◌";

  if (featured) {
    return (
      <div
        className="group relative flex flex-col gap-6 rounded-lg p-6 bg-green text-black shadow-heavy hover:scale-[1.01] transition-all duration-500 animate-slide-up"
        aria-label={`${data.name} featured provider card`}
        style={style}
      >
        {/* Header */}
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-4 text-black">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-black/10">
              <span className="text-2xl text-black">
                {icon}
              </span>
            </div>
            <div>
              <h3 className="text-[16px] font-black tracking-tight text-black">
                {data.name}
              </h3>
              <p className="text-[11px] font-bold uppercase tracking-widest text-black/60">
                {data.type}
              </p>
            </div>
          </div>
        </div>

        {/* Body (simplified for featured) */}
        <div className="flex-1">
          {data.usageBars?.map(bar => {
            const isCritical = bar.used >= 90;
            const displayResetsIn = mounted && bar.resetsAt ? timeUntil(bar.resetsAt) : bar.resetsIn;
            return (
              <div key={bar.label} className="space-y-2 mb-4 last:mb-0">
                <div className="flex justify-between text-[11px] font-black uppercase tracking-widest text-black/60">
                  <span>{bar.label}</span>
                  <span className={isCritical ? "text-[#991b1b]" : "text-black"}>{bar.used.toFixed(0)}%</span>
                </div>
                <div className="h-0.5 rounded-full bg-black/5 overflow-hidden">
                  <div className="h-full rounded-full transition-all duration-1000 ease-out" style={{ width: `${bar.used}%`, backgroundColor: isCritical ? "#991b1b" : "black" }} />
                </div>
                {(displayResetsIn || bar.resetsAt) && (
                  <div className="flex justify-between opacity-60">
                    {displayResetsIn && (
                      <span className="text-[10px] font-black uppercase tracking-[0.1em] text-black">
                        {displayResetsIn.includes('d') ? (parseInt(displayResetsIn) > 7 ? 'Monthly Reset' : 'Weekly Reset') : 'Reset'}: {displayResetsIn}
                      </span>
                    )}
                    {bar.resetsAt && (
                      <span className="text-[10px] font-black uppercase tracking-[0.1em] text-black">
                        @{mounted ? shortTimeLocal(bar.resetsAt) : "--:--"}
                      </span>
                    )}
                  </div>
                )}
              </div>
            );
          })}
          {(!data.usageBars || data.usageBars.length === 0) && (
            <div className="text-4xl font-black tracking-tighter text-black">
              {data.currency === "USD" ? "$" : ""}{data.creditsRemaining?.toFixed(2) ?? "—"}
            </div>
          )}
        </div>

        {data.sharedCredits && (
          <div className="bg-black/5 rounded-lg p-4 border border-black/5">
            <div className="flex justify-between items-center">
              <span className="text-[10px] font-black uppercase tracking-widest text-black/60">
                {data.sharedCredits.label}
              </span>
              <span className="text-lg font-black tracking-tight text-black">
                {data.sharedCredits.value}
              </span>
            </div>
            {data.sharedCredits.subtext && (
              <div className="text-[10px] font-black text-black/60 uppercase tracking-[0.1em] text-right mt-1">
                {data.sharedCredits.subtext}
              </div>
            )}
          </div>
        )}
        <UsageFooter
          timestamp={data.lastUpdated}
          mounted={mounted}
          featured={true}
          status={data.status}
        />
      </div>
    );
  }

  return (
    <div
      className="group relative flex flex-col gap-6 rounded-lg p-6 bg-surface border border-border shadow-medium hover:shadow-heavy hover:bg-dim transition-all duration-300 animate-slide-up"
      aria-label={`${data.name} provider card`}
      style={style}
    >

      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-4">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-panel shadow-inner">
            <span className="text-2xl text-bright transition-colors duration-300">
              {icon}
            </span>
          </div>
          <div>
            <h3 className="text-[16px] font-bold text-bright tracking-tight">
              {data.name}
            </h3>
            <p className="text-[11px] font-medium text-muted uppercase tracking-widest mt-0.5">
              {data.type}
            </p>
          </div>
        </div>

        {/* Status Badge */}
        <div className="flex items-center gap-2 px-2 py-1 rounded-full bg-panel border border-border">
          <div
            className={`w-1.5 h-1.5 rounded-full ${data.status === 'ok' ? 'animate-pulse-slow' : ''}`}
            style={{ backgroundColor: statusColor }}
          />
          <span className="text-[9px] font-black uppercase tracking-[0.15em] text-muted">
            {STATUS_LABEL[data.status]}
          </span>
        </div>
      </div>

      {/* Body */}
      <div className="flex-1 space-y-6">
        {data.sharedCredits && (
          <SharedCreditsDisplay {...data.sharedCredits} />
        )}

        {data.status === "error" ? (
          <div className="text-[11px] font-mono leading-relaxed text-red bg-red/5 rounded-md p-4 border border-red/10">
            {data.error ?? "Fetch failed. Please check endpoint connectivity."}
          </div>
        ) : data.usageBars && data.usageBars.length > 0 ? (
          <div className="space-y-4">
            {data.usageBars.map((bar) => (
              <UsageBar key={bar.label} {...bar} mounted={mounted} />
            ))}
          </div>
        ) : (
          <CreditDisplay
            remaining={data.creditsRemaining}
            total={data.creditsTotal}
            currency={data.currency}
          />
        )}
      </div>

      <UsageFooter
        timestamp={data.lastUpdated}
        mounted={mounted}
        status={data.status}
      />
    </div>
  );
}
