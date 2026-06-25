"use client";

import { useEffect, useState } from "react";

type BoostState = {
  isActive: boolean;
  countdownStr: string;
};

// Anthropic temporary +50% weekly limit boost ends July 13, 2026 at 01:00 Polish time (CEST, UTC+2).
const BOOST_END_UTC = new Date("2026-07-12T23:00:00Z");

export function getClaudeBoostState(now: Date): BoostState {
  const diffMs = BOOST_END_UTC.getTime() - now.getTime();

  if (diffMs <= 0) {
    return { isActive: false, countdownStr: "0d 0h 0m 0s" };
  }

  const diffSecs = Math.floor(diffMs / 1000);
  const d = Math.floor(diffSecs / 86400);
  const h = Math.floor((diffSecs % 86400) / 3600);
  const m = Math.floor((diffSecs % 3600) / 60);
  const s = diffSecs % 60;

  return {
    isActive: true,
    countdownStr: `${d}d ${h}h ${m}m ${s}s`,
  };
}

export function PromoWidget() {
  const [boostState, setBoostState] = useState<BoostState | null>(null);

  useEffect(() => {
    let interval: NodeJS.Timeout | null = null;

    const startInterval = () => {
      if (!interval) {
        interval = setInterval(() => {
          setBoostState(getClaudeBoostState(new Date()));
        }, 1000);
      }
    };

    const stopInterval = () => {
      if (interval) {
        clearInterval(interval);
        interval = null;
      }
    };

    const handleVisibility = () => {
      if (document.visibilityState === 'visible') {
        setBoostState(getClaudeBoostState(new Date()));
        startInterval();
      } else {
        stopInterval();
      }
    };

    if (document.visibilityState === 'visible') {
      setBoostState(getClaudeBoostState(new Date()));
      startInterval();
    }

    document.addEventListener('visibilitychange', handleVisibility);

    return () => {
      stopInterval();
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, []);

  if (!boostState || !boostState.isActive) return null;

  return (
    <div className="flex flex-col md:items-start items-center gap-2 mt-4">
      <div
        className="flex items-center gap-3 px-4 py-2 rounded-full border bg-surface border-border shadow-medium transition-all duration-300 hover:border-dim group"
        title="Anthropic temporarily boosted weekly limits by +50% (stacked with permanent 2x session limits). Ends July 13, 2026 01:00 CEST."
      >
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full shrink-0 relative bg-green">
            <div className="absolute inset-0 rounded-full bg-green animate-ping opacity-60" />
          </div>
          <span className="text-[11px] font-bold tracking-wider uppercase text-green">
            Claude x2 Active
          </span>
        </div>
        <div className="h-4 w-[1px] bg-border group-hover:bg-dim transition-colors" />
        <span className="text-[11px] font-medium text-muted whitespace-nowrap">
          Ends in <span className="font-bold tabular-nums text-bright">{boostState.countdownStr}</span>
        </span>
      </div>
    </div>
  );
}
