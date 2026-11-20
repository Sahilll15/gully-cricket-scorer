import { describe, expect, it } from "vitest";
import { atTime, minutesOf, TIME_PRESETS, timeText } from "./nextGame";

describe("TIME_PRESETS", () => {
  it("has unique labels and valid minutes", () => {
    expect(new Set(TIME_PRESETS.map((p) => p.label)).size).toBe(TIME_PRESETS.length);
    for (const p of TIME_PRESETS) expect(p.minutes >= 0 && p.minutes < 1440).toBe(true);
  });
  it("round-trips through atTime and reads as a clock time", () => {
    const day = new Date(2026, 10, 20).getTime();
    for (const p of TIME_PRESETS) expect(minutesOf(atTime(day, p.minutes))).toBe(p.minutes);
    expect(timeText(atTime(day, TIME_PRESETS[2].minutes))).toBe("6 pm");
  });
});
