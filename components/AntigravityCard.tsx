"use client";

import { useState, useEffect } from "react";
import useSWR from "swr";
import type { ProviderData } from "@/lib/types";
import ProviderCard from "@/components/ProviderCard";
import { parseProviderUsageSnapshot, resolveProviderUsageTracking } from "@/lib/utils";

// Tabs are populated from API response labels. Raw emails stay server-side.
const fetcher = (url: string) => fetch(url).then((r) => r.json());

export default function AntigravityCard({ index, onSync }: { index: number; onSync?: (ts: string) => void }) {
  const [activeTab, setActiveTab] = useState(0);
  const [accountLabels, setAccountLabels] = useState<string[]>([]);
  
  const { data, error, isLoading } = useSWR<ProviderData>(
    `/api/credits/antigravity?accountIndex=${activeTab}`,
    fetcher,
    {
      // Usage tracking assumes SWR only exposes data for the active account key.
      keepPreviousData: false,
      refreshInterval: 5 * 60 * 1000,
      revalidateOnFocus: true,
      onSuccess: (_data) => {
        if (onSync) onSync(new Date().toISOString());
      }
    }
  );

  useEffect(() => {
    if (data?.accounts && Array.isArray(data.accounts)) {
      const labels = data.accounts.map((acc, i) => acc.label ?? `Account ${i + 1}`);
      if (labels.length > 0 && labels[0]) {
        setAccountLabels(labels);
      }
    }
  }, [data]);

  const activeAccountLabel = data?.accounts?.[activeTab]?.label ?? accountLabels[activeTab];
  const storageScope = activeAccountLabel ? `account-${activeAccountLabel}` : `tab-${activeTab}`;
  const usedAtStorageKey = `provider-used-at-v3-antigravity-${storageScope}`;
  const snapshotStorageKey = `provider-usage-snapshot-v3-antigravity-${storageScope}`;
  const [usedAt, setUsedAt] = useState<string | undefined>(undefined);

  useEffect(() => {
    // Client-only initialization to avoid hydration mismatch
    const storedUsedAt = localStorage.getItem(usedAtStorageKey) || undefined;
    setUsedAt(storedUsedAt);
  }, [usedAtStorageKey]);

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

  const tabs = accountLabels.length > 0
    ? accountLabels
    : ["..."];

  const placeholder: ProviderData = {
    id: "antigravity",
    name: "Antigravity",
    type: "subscription",
    status: "ok",
    usageBars: [],
  };

  if (error) {
    const errorPlaceholder: ProviderData = {
      ...placeholder,
      status: "error",
      error: "Failed to load Antigravity data. Please try again later.",
    };
    return <ProviderCard featured={true} data={errorPlaceholder} />;
  }
  if (isLoading || !data) return <ProviderCard featured={true} data={placeholder} style={{ opacity: 0.5 }} />;

  return (
    <div className="flex flex-col gap-4 group">
      {/* Account Tags (Spotify Style Chips) */}
      <div className="flex flex-wrap gap-2 px-1">
        {tabs.map((_, i) => (
          <button
            key={i}
            onClick={() => setActiveTab(i)}
            className={`px-3 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest transition-all duration-300 ${
              activeTab === i
                ? "bg-bright text-[var(--panel)] shadow-lg shadow-black/20"
                : "bg-surface/50 text-muted border border-border/10 hover:bg-dim hover:text-bright"
            }`}
          >
            {tabs[i]}
          </button>
        ))}
      </div>

      <ProviderCard
        data={data ? { ...data, lastUpdated: usedAt } : placeholder}
        featured={true}
        style={{ 
          animationDelay: `${index * 80}ms`, 
          animationFillMode: "both",
        }}
      />
    </div>
  );
}
