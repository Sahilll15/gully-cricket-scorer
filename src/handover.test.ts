import { describe, expect, it, vi } from "vitest";
import { newLiveKey, parseScoreKey } from "./live";
import { stamp } from "./store";
import type { Match } from "./engine/types";

describe("hand-over link", () => {
  it("carries the whole signing key and reads it back", async () => {
    const { liveKey } = await newLiveKey();
    const back = parseScoreKey(`#k=${liveKey.d}.${liveKey.x}.${liveKey.y}`)!;
    expect([back.d, back.x, back.y]).toEqual([liveKey.d, liveKey.x, liveKey.y]);
    const key = await crypto.subtle.importKey("jwk", back, { name: "ECDSA", namedCurve: "P-256" }, false, ["sign"]);
    expect(key.type).toBe("private");
  });
  it("ignores a hash without a key", () => {
    expect(parseScoreKey("")).toBeNull();
    expect(parseScoreKey("#k=abc.def.ghi")).toBeNull();
  });
});

describe("edit order across phones", () => {
  const m = { id: "m1" } as Match;
  it("moves forward even when this phone's clock is behind", () => {
    vi.spyOn(Date, "now").mockReturnValue(1000);
    const fromOther = { ...m, editedAt: 5000 };
    expect(stamp(fromOther, fromOther).editedAt).toBe(5001);
    vi.restoreAllMocks();
  });
  it("uses the clock when it is ahead", () => {
    vi.spyOn(Date, "now").mockReturnValue(9000);
    expect(stamp(m, { ...m, editedAt: 5000 }).editedAt).toBe(9000);
    vi.restoreAllMocks();
  });
});

describe("one phone scores at a time", async () => {
  const { canScore, movedAway } = await import("./device");
  const { parseMoveToken, newMoveToken } = await import("./live");
  const m = { id: "m1" } as Match;
  it("lets an unshared match be scored anywhere", () => expect(canScore(m, "a")).toBe(true));
  it("lets only the phone holding the pen score", () => {
    expect(canScore({ ...m, scorer: "a" }, "a")).toBe(true);
    expect(canScore({ ...m, scorer: "a" }, "b")).toBe(false);
    expect(movedAway({ ...m, scorer: "a" }, "b")).toBe(true);
  });
  it("pauses the sender while a move link is waiting", () => {
    expect(canScore({ ...m, scorer: "a", handover: "X" }, "a")).toBe(false);
    expect(movedAway({ ...m, scorer: "a", handover: "X" }, "a")).toBe(false);
  });
  it("reads the one-time token from the link", () => {
    const t = newMoveToken();
    expect(t).toHaveLength(12);
    expect(parseMoveToken(`#k=a.b.c&h=${t}`)).toBe(t);
    expect(parseMoveToken("#k=a.b.c")).toBeNull();
  });
});
