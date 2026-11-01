import { describe, expect, it } from "vitest";
import { cleanPhone, merge, validPasscode, type Backup } from "./backup";
import type { Match } from "./engine/types";

const match = (id: string, events: number, createdAt = 1): Match => ({
  id, createdAt, teams: [{ name: "A", players: [] }, { name: "B", players: [] }], toss: null, status: "live",
  rules: { overs: 5, extraRun: true, rebowl: true, freeHit: false, lastManStands: false, oneTipCatch: false, wall: "none", tipAndRun: false, maxOversPerBowler: null },
  innings: [{ bat: 0, overs: 5, wicketLimit: 5, superOver: false, striker: "a", nonStriker: "b", bowler: "c", bowlerSetAt: 0, closed: false,
    events: Array.from({ length: events }, () => ({ t: "ball" as const, runs: 1, bowler: "c" })) }],
});
const backup = (matches: Match[], teams: Backup["teams"] = []): Backup => ({ v: 1, matches, teams, cups: [] });

describe("phone and passcode", () => {
  it.each([["98765 43210", "9876543210"], ["+91 98765-43210", "9876543210"], ["09876543210", "9876543210"]])("%s cleans to %s", (raw, want) =>
    expect(cleanPhone(raw)).toBe(want));
  it.each(["12345", "5876543210", "98765432101"])("%s is not a mobile number", (raw) => expect(cleanPhone(raw)).toBeNull());
  it("passcode is exactly 6 digits", () => {
    expect(validPasscode("123456")).toBe(true);
    expect(validPasscode("12345")).toBe(false);
    expect(validPasscode("12345a")).toBe(false);
  });
});

describe("merging a phone with the account", () => {
  it("keeps matches from both sides, newest first", () => {
    const out = merge(backup([match("x", 1, 1)]), backup([match("y", 1, 2)]));
    expect(out.matches.map((m) => m.id)).toEqual(["y", "x"]);
  });
  it("for the same match keeps the copy scored further", () => {
    expect(merge(backup([match("x", 3)]), backup([match("x", 5)])).matches[0].innings[0].events).toHaveLength(5);
    expect(merge(backup([match("x", 6)]), backup([match("x", 5)])).matches[0].innings[0].events).toHaveLength(6);
  });
  it("joins the squads of a team saved on both", () => {
    const out = merge(backup([], [{ id: "t", name: "W", players: [{ id: "1", name: "Rahul" }] }]),
      backup([], [{ id: "t", name: "W", players: [{ id: "2", name: "rahul" }, { id: "3", name: "Amit" }] }]));
    expect(out.teams[0].players.map((p) => p.name)).toEqual(["Rahul", "Amit"]);
  });
  it("with no account copy yet, the phone's data is used as is", () => {
    const local = backup([match("x", 1)]);
    expect(merge(local, null)).toBe(local);
  });
});
