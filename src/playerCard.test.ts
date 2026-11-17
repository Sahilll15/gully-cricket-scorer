import { describe, expect, it } from "vitest";
import type { Match } from "./engine/types";
import { filterMatches, kindsPlayed, skillCard, skillScore, tierOf, yearsPlayed } from "./playerCard";
import { backupFileName, readBackupFile, restoreFrom, toBackupFile } from "./backupFile";
import { emptyKitty } from "./kitty";
import { nextGameIcs, nextGameText, reminderAt, timeText } from "./nextGame";
import { upiLink, validUpi } from "./upi";

describe("skill rating to tier", () => {
  it("maps the edges of each tier", () => {
    expect([0, 49].map(tierOf)).toEqual(["Bronze", "Bronze"]);
    expect([50, 69].map(tierOf)).toEqual(["Silver", "Silver"]);
    expect([70, 84].map(tierOf)).toEqual(["Gold", "Gold"]);
    expect([85, 99].map(tierOf)).toEqual(["Icon", "Icon"]);
  });
  it("rounds the rating and holds it to 0 to 99", () => {
    expect(skillScore(49.6)).toBe(50);
    expect(skillScore(140)).toBe(99);
    expect(skillScore(-3)).toBe(0);
    expect(skillScore(NaN)).toBe(0);
  });
});

const rules = { overs: 2, extraRun: true, rebowl: true, freeHit: false, lastManStands: false, oneTipCatch: false, wall: "none" as const, tipAndRun: false, maxOversPerBowler: null };
const game = (id: string, createdAt: number, runs: number, format?: "test" | "solo"): Match => ({
  id, createdAt, toss: null, status: "done", rules: { ...rules, ...(format ? { format } : {}) },
  teams: [{ name: "A", players: [{ id: "r", name: "Rahul" }, { id: "s", name: "Sam" }] }, { name: "B", players: [{ id: "v", name: "Vikas" }, { id: "o", name: "Om" }] }],
  innings: [{ bat: 0, overs: 2, wicketLimit: 2, superOver: false, striker: "r", nonStriker: "s", bowler: "v", bowlerSetAt: 0, closed: true,
    events: [{ t: "ball", runs, bowler: "v" }, { t: "ball", runs, bowler: "v" }] }],
});
const y25 = new Date(2025, 5, 1).getTime(), y26 = new Date(2026, 5, 1).getTime();

describe("profile filters and the card", () => {
  const ms = [game("a", y25, 6), game("b", y26, 4), game("c", y26, 1, "test")];
  it("filters by kind and year", () => {
    expect(filterMatches(ms, "limited", null).map((m) => m.id)).toEqual(["a", "b"]);
    expect(filterMatches(ms, "limited", 2026).map((m) => m.id)).toEqual(["b"]);
    expect(kindsPlayed(ms, "rahul")).toEqual(["limited", "test"]);
    expect(yearsPlayed(ms, "Rahul", "limited")).toEqual([2026, 2025]);
  });
  it("builds a batter's card from the filtered matches", () => {
    const c = skillCard(filterMatches(ms, "limited", 2026), "Rahul", "limited");
    expect(c).toMatchObject({ score: 8, tier: "Bronze", role: "Batter", matches: 1 });
    expect(c.stats[0]).toEqual({ label: "Runs", value: "8" });
  });
});

describe("kitty QR, next game and backup files", () => {
  it("builds the UPI link with the exact amount", () => {
    expect(upiLink(" Rahul@OKAxis ", "Rahul", 40)).toBe("upi://pay?pa=rahul@okaxis&pn=Rahul&am=40&cu=INR&tn=Gully%20kitty");
    expect(validUpi("rahul.k@okaxis")).toBe(true);
    expect(validUpi("rahul")).toBe(false);
  });
  it("words the next game like a group message", () => {
    const now = new Date(2026, 10, 16, 20).getTime(), at = new Date(2026, 10, 22, 7).getTime();
    const g = { at, place: "Lane 4", who: ["A", "B", "C", "D", "E", "F", "G", "H"] };
    expect(nextGameText(g, now).split("\n")[0]).toBe("Gully match Sunday 7 am at Lane 4, 8 in so far");
    expect(timeText(new Date(2026, 0, 1, 18, 30).getTime())).toBe("6:30 pm");
    expect(reminderAt(g, now)).toBe(at - 3600_000);
    expect(reminderAt(g, at - 1000)).toBeNull();
    expect(nextGameIcs(g, now)).toContain("LOCATION:Lane 4");
  });
  it("restores a backup file by merging, never dropping what is on the phone", () => {
    const local = { v: 1 as const, matches: [game("a", y25, 6)], teams: [], cups: [], series: [], infos: {}, kitty: emptyKitty() };
    const file = readBackupFile(toBackupFile({ ...local, matches: [game("b", y26, 4)] }))!;
    const { data, added } = restoreFrom(local, file);
    expect(data.matches.map((m) => m.id).sort()).toEqual(["a", "b"]);
    expect(added).toBe("Added 1 match.");
    expect(readBackupFile("not json")).toBeNull();
    expect(readBackupFile("{\"hello\":1}")).toBeNull();
    expect(backupFileName(y26)).toBe("gully-backup-2026-06-01.json");
  });
});
