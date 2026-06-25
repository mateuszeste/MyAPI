import { test, describe } from "node:test";
import assert from "node:assert";
import { getClaudeBoostState } from "../../components/PromoWidget";

describe("Claude x2 boost countdown logic", () => {
  test("Well before end date: boost is active", () => {
    const state = getClaudeBoostState(new Date("2026-05-14T12:00:00Z"));
    assert.strictEqual(state.isActive, true);
  });

  test("One second before end: boost is still active", () => {
    const state = getClaudeBoostState(new Date("2026-07-12T22:59:59Z"));
    assert.strictEqual(state.isActive, true);
  });

  test("Exactly at end (July 13 01:00 CEST = July 12 23:00 UTC): boost is inactive", () => {
    const state = getClaudeBoostState(new Date("2026-07-12T23:00:00Z"));
    assert.strictEqual(state.isActive, false);
  });

  test("After end date: boost is inactive", () => {
    const state = getClaudeBoostState(new Date("2026-07-15T00:00:00Z"));
    assert.strictEqual(state.isActive, false);
  });

  test("Countdown format is 'Xd Yh Zm Ws'", () => {
    const state = getClaudeBoostState(new Date("2026-05-14T00:00:00Z"));
    assert.match(state.countdownStr, /^\d+d \d+h \d+m \d+s$/);
  });

  test("Countdown days are correct for known date", () => {
    // From 2026-07-11T23:00:00Z to 2026-07-12T23:00:00Z = exactly 1 day
    const state = getClaudeBoostState(new Date("2026-07-11T23:00:00Z"));
    assert.strictEqual(state.countdownStr, "1d 0h 0m 0s");
  });
});
