import { describe, expect, it } from "vitest";
import { shouldPrompt } from "./sharePrompt";
import type { Match } from "./engine/types";

const m = (id: string, status: string, editedAt: number) => ({ id, status, editedAt, createdAt: 0 }) as unknown as Match;

describe("shouldPrompt", () => {
  it("asks once for a match that just finished", () => {
    expect(shouldPrompt(m("a", "done", 1000), 2000)).toBe(true);
    expect(shouldPrompt(m("a", "done", 1000), 3000)).toBe(false);
  });
  it("does not ask for live or old matches", () => {
    expect(shouldPrompt(m("b", "live", 1000), 2000)).toBe(false);
    expect(shouldPrompt(m("c", "done", 0), 11 * 60 * 1000)).toBe(false);
  });
});
