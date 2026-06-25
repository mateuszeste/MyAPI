"use client";

import { useState, useEffect } from "react";
import useSWR from "swr";
import type { ProviderData } from "@/lib/types";
import AntigravityCard from "@/components/AntigravityCard";
import ChatGptCard from "@/components/ChatGptCard";
import ProviderCard from "@/components/ProviderCard";
import Logo from "@/components/Logo";
import { PromoWidget } from "@/components/PromoWidget";
import { ThemeToggle } from "@/components/ThemeToggle";
import { parseProviderUsageSnapshot, resolveProviderUsageTracking, timeAgo } from "@/lib/utils";

// ─── Providers to display ────────────────────────────────────────────────────
// Add / remove entries here as you wire up more API routes
const PROVIDERS = [
  { id: "antigravity", name: "Antigravity", endpoint: "/api/credits/antigravity" },
  { id: "claude", name: "Claude Pro", endpoint: "/api/credits/claude" },
  { id: "openai", name: "OpenAI", endpoint: "/api/credits/openai" },
  { id: "openrouter", name: "OpenRouter", endpoint: "/api/credits/openrouter" },
  { id: "ollama", name: "Ollama Cloud", endpoint: "/api/credits/ollama" },
  { id: "kilocode", name: "Kilo Code", endpoint: "/api/credits/kilocode" },
  { id: "aws", name: "Amazon Bedrock", endpoint: "/api/credits/aws" },
  { id: "elevenlabs", name: "ElevenLabs", endpoint: "/api/credits/elevenlabs" },
];

const fetcher = (url: string) => fetch(url).then((r) => r.json());

// ─── Live "Synced X ago" footer indicator ─────────────────────────────────────
function SyncedAgo({ timestamp }: { timestamp: string | undefined }) {
  const [mounted, setMounted] = useState(false);
  const [, setTick] = useState(0);

  useEffect(() => {
    setMounted(true);
    const id = setInterval(() => setTick(t => t + 1), 30_000);
    return () => clearInterval(id);
  }, []);

  if (!mounted || !timestamp) {
    return (
      <span className="text-[10px] font-bold text-muted uppercase tracking-[0.1em]">
        Syncing...
      </span>
    );
  }

  return (
    <span className="text-[10px] font-bold text-muted uppercase tracking-[0.1em]">
      Synced {timeAgo(timestamp)}
    </span>
  );
}

// ─── Individual provider tile with its own SWR hook ──────────────────────────
function ProviderTile({ id, name, index, onSync }: { id: string; name: string; index: number; onSync?: (ts: string) => void }) {
  const usedAtStorageKey = `provider-used-at-v3-${id}`;
  const snapshotStorageKey = `provider-usage-snapshot-v3-${id}`;
  const [usedAt, setUsedAt] = useState<string | undefined>(undefined);

  useEffect(() => {
    // Client-only initialization
    const storedUsedAt = localStorage.getItem(usedAtStorageKey) || undefined;
    setUsedAt(storedUsedAt);
  }, [usedAtStorageKey]);

  const { data, error, isLoading } = useSWR<ProviderData>(
    `/api/credits/${id}`, 
    fetcher,
    { 
      refreshInterval: 60000 * 5,
      onSuccess: (_data) => {
        if (onSync) onSync(new Date().toISOString());
      }
    }
  );

  useEffect(() => {
    if (!data || data.status === "error") return;

    const previousSnapshotRaw = localStorage.getItem(snapshotStorageKey);
    const previousSnapshot = parseProviderUsageSnapshot(previousSnapshotRaw);
    const previousUsedAt = localStorage.getItem(usedAtStorageKey) || undefined;
    const { snapshot, usedAt: nextUsedAt } = resolveProviderUsageTracking(
      previousSnapshot,
      data,
      previousUsedAt
    );
    const nextSnapshotRaw = JSON.stringify(snapshot);

    if (previousSnapshotRaw !== nextSnapshotRaw) {
      localStorage.setItem(snapshotStorageKey, nextSnapshotRaw);
    }
    if (nextUsedAt) {
      localStorage.setItem(usedAtStorageKey, nextUsedAt);
    } else {
      localStorage.removeItem(usedAtStorageKey);
    }

    setUsedAt(nextUsedAt);
  }, [data, snapshotStorageKey, usedAtStorageKey]);

  const placeholder: ProviderData = {
    id,
    name,
    type: "subscription",
    status: isLoading ? "loading" : "error",
    error: error?.message ?? (isLoading ? undefined : "Failed to load"),
  };

  const cardData = data ? { ...data, lastUpdated: usedAt } : placeholder;

  return (
    <ProviderCard
      data={cardData}
      style={{ animationDelay: `${index * 80}ms`, animationFillMode: "both" }}
    />
  );
}

// ─── Header ──────────────────────────────────────────────────────────────────
function Header() {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const now = new Date();
  const dateStr = mounted
    ? now.toLocaleDateString("en-US", {
      weekday: "short",
      month: "short",
      day: "numeric",
    })
    : "";
  const timeStr = mounted
    ? now.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
    : "";

  return (
    <header className="flex flex-col md:grid md:grid-cols-3 gap-6 items-center px-10 py-8 transition-colors duration-300">
      {/* Left: Mission Info */}
      <div className="flex flex-col">
        <h1 className="text-[11px] font-bold text-muted uppercase tracking-[0.2em]">
          Mission Control
        </h1>
        <p className="text-[11px] font-medium text-muted opacity-40 uppercase tracking-widest mt-0.5">
          Global Cloud Registry
        </p>
        <PromoWidget />
      </div>

      {/* Center: Brand Logo */}
      <div className="flex justify-center">
        <Logo size={100} className="hover:scale-105 transition-transform duration-500 ease-out" />
      </div>

      {/* Right: Date, Time & Theme Toggle */}
      <div className="flex items-center gap-6 md:justify-end">
        <div className="text-right">
          <div className="text-[11px] font-mono text-muted tracking-tight">
            {dateStr}
          </div>
          <div className="text-base font-bold tabular-nums text-bright">
            {timeStr}
          </div>
        </div>
        <ThemeToggle />
      </div>
    </header>
  );
}

export default function Dashboard() {
  const [globalSyncAt, setGlobalSyncAt] = useState<string | undefined>(undefined);

  return (
    <div className="min-h-screen flex flex-col">
      <Header />

      <main className="flex-1 px-10 py-4 max-w-[1600px] mx-auto w-full">
        {/* Section label (Spotify Style) */}
        <div className="flex items-center gap-4 mb-8">
          <h2 className="text-[14px] font-black uppercase tracking-widest text-bright">
            Provider Inventory
          </h2>
          <div className="h-px flex-1 bg-border opacity-50" />
        </div>

        {/* Cards grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          <AntigravityCard index={0} onSync={setGlobalSyncAt} />
          <ChatGptCard index={1} onSync={setGlobalSyncAt} />
          {PROVIDERS.filter(p => p.id !== "antigravity" && p.id !== "openai").map((p, i) => (
            <ProviderTile 
              key={p.id} 
              {...p} 
              index={i + 2} 
              onSync={setGlobalSyncAt}
            />
          ))}
        </div>
      </main>

      {/* Footer */}
      <footer className="px-10 py-6 mt-10 border-t border-border flex items-center justify-between">
        <div className="flex gap-6 items-center">
          <span className="text-[10px] font-bold text-muted uppercase tracking-widest">
            System is live
          </span>
          <span className="text-muted opacity-30">·</span>
          <SyncedAgo timestamp={globalSyncAt} />
        </div>
        <span className="text-[10px] font-medium text-muted opacity-40 text-right">
          © 2026 MyAPI System • Protected
        </span>
      </footer>
    </div>
  );
}
