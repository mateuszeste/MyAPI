import { describe, test } from "node:test";
import assert from "node:assert";
import type { ProviderData } from "../../lib/types";
import {
  createProviderUsageSnapshot,
  didProviderUsageIncrease,
  resolveProviderUsageTracking,
} from "../../lib/utils";

function makeUsageProvider(used: number): ProviderData {
  return {
    id: "openai",
    name: "ChatGPT Codex",
    type: "subscription",
    status: "ok",
    usageBars: [
      { label: "Codex monthly", used },
    ],
  };
}

function makeCreditsProvider(creditsRemaining: number): ProviderData {
  return {
    id: "kilocode",
    name: "Kilo Code",
    type: "credits",
    status: "ok",
    creditsRemaining,
    creditsTotal: 5,
    currency: "USD",
  };
}

function makeSharedCreditsProvider(value: string): ProviderData {
  return {
    id: "antigravity",
    name: "Antigravity",
    type: "hybrid",
    status: "ok",
    sharedCredits: {
      label: "Gemini AI Credits",
      value,
    },
  };
}

describe("provider usage tracking", () => {
  test("usage bar increase triggers used tracking", () => {
    const previous = createProviderUsageSnapshot(makeUsageProvider(24));
    const next = createProviderUsageSnapshot(makeUsageProvider(26));

    assert.strictEqual(didProviderUsageIncrease(previous, next), true);
  });

  test("usage bar decrease does not trigger used tracking", () => {
    const previous = createProviderUsageSnapshot(makeUsageProvider(24));
    const next = createProviderUsageSnapshot(makeUsageProvider(2));

    assert.strictEqual(didProviderUsageIncrease(previous, next), false);
  });

  test("credit decrease triggers used tracking", () => {
    const previous = createProviderUsageSnapshot(makeCreditsProvider(1.39));
    const next = createProviderUsageSnapshot(makeCreditsProvider(1.38));

    assert.strictEqual(didProviderUsageIncrease(previous, next), true);
  });

  test("credit increase does not trigger used tracking", () => {
    const previous = createProviderUsageSnapshot(makeCreditsProvider(1.38));
    const next = createProviderUsageSnapshot(makeCreditsProvider(5));

    assert.strictEqual(didProviderUsageIncrease(previous, next), false);
  });

  test("shared credits decrease triggers used tracking", () => {
    const previous = createProviderUsageSnapshot(makeSharedCreditsProvider("500"));
    const next = createProviderUsageSnapshot(makeSharedCreditsProvider("300"));

    assert.strictEqual(didProviderUsageIncrease(previous, next), true);
  });

  test("non-numeric shared credits values do not trigger used tracking", () => {
    const previous = createProviderUsageSnapshot(makeSharedCreditsProvider("unlimited"));
    const next = createProviderUsageSnapshot(makeSharedCreditsProvider("N/A"));

    assert.strictEqual(didProviderUsageIncrease(previous, next), false);
  });

  test("first snapshot seeds history without setting usedAt", () => {
    const result = resolveProviderUsageTracking(
      null,
      makeUsageProvider(24),
      undefined,
      "2026-04-04T12:00:00.000Z"
    );

    assert.deepStrictEqual(result.snapshot, createProviderUsageSnapshot(makeUsageProvider(24)));
    assert.strictEqual(result.usedAt, undefined);
  });

  test("reset baseline is updated so later consumption still triggers", () => {
    const initial = createProviderUsageSnapshot(makeUsageProvider(24));
    const afterReset = resolveProviderUsageTracking(
      initial,
      makeUsageProvider(0),
      "2026-04-04T12:00:00.000Z",
      "2026-04-04T12:10:00.000Z"
    );

    assert.strictEqual(afterReset.usedAt, "2026-04-04T12:00:00.000Z");

    const afterUsage = resolveProviderUsageTracking(
      afterReset.snapshot,
      makeUsageProvider(2),
      afterReset.usedAt,
      "2026-04-04T12:20:00.000Z"
    );

    assert.strictEqual(afterUsage.usedAt, "2026-04-04T12:20:00.000Z");
  });

  test("unchanged snapshot preserves prior usedAt", () => {
    const previous = createProviderUsageSnapshot(makeUsageProvider(24));
    const result = resolveProviderUsageTracking(
      previous,
      makeUsageProvider(24),
      "2026-04-04T12:00:00.000Z",
      "2026-04-04T12:20:00.000Z"
    );

    assert.strictEqual(result.usedAt, "2026-04-04T12:00:00.000Z");
  });
});
