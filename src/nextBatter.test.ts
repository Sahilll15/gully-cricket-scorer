import { describe, expect, it } from "vitest";
import { confirmWicketLabel, nextBatterId } from "./nextBatter";

describe("nextBatterId", () => {
  const fresh = [{ id: "a" }, { id: "b" }];
  it("picks the first batter yet to bat when someone must come in", () => expect(nextBatterId(fresh, true)).toBe("a"));
  it("picks nobody when no new batter is needed", () => expect(nextBatterId(fresh, false)).toBeNull());
  it("picks nobody when the order is empty", () => expect(nextBatterId([], true)).toBeNull());
});

describe("confirmWicketLabel", () => {
  it("names the incoming batter", () => expect(confirmWicketLabel(true, "Ravi")).toBe("Confirm, Ravi comes in"));
  it("falls back to the plain label", () => {
    expect(confirmWicketLabel(true, null)).toBe("Confirm wicket");
    expect(confirmWicketLabel(false, "Ravi")).toBe("Confirm wicket");
  });
});
