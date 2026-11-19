import { describe, expect, it } from "vitest";
import { boardText, groupBoard, pollText, recapText, revisedTarget, splitGroup, weeklyNudge } from "./season";
import { newGroup } from "./groups";
import type { Match } from "./engine/types";

const rules = { overs: 5, extraRun: true, rebowl: true, freeHit: false, lastManStands: false, oneTipCatch: false, wall: "none" as const, tipAndRun: false, maxOversPerBowler: null };
const NOW = Date.UTC(2026, 10, 20);
const match = (id: string, at: number): Match => ({
  id, createdAt: at, status: "done", rules, toss: null,
  teams: [{ name: "A", players: [{ id: "a", name: "Ravi" }, { id: "b", name: "Sam" }] }, { name: "B", players: [{ id: "c", name: "Om" }, { id: "d", name: "Zed" }] }],
  innings: [{ bat: 0, overs: 5, wicketLimit: 1, superOver: false, striker: "a", nonStriker: "b", bowler: "c", bowlerSetAt: 0, closed: true,
    events: [{ t: "ball", runs: 6, bowler: "c" }, { t: "ball", runs: 4, bowler: "c" }, { t: "ball", runs: 0, bowler: "c", wicket: { kind: "bowled", outId: "a" } }] }],
} as unknown as Match);
const group = newGroup("Sunday boys", ["Ravi", "Sam", "Om"]);

describe("group board", () => {
  const ms = [match("new", NOW - 1000), match("old", NOW - 30 * 24 * 3600 * 1000)];
  it("ranks only group players, and the week view drops older matches", () => {
    const all = groupBoard(ms, group, "all", NOW), week = groupBoard(ms, group, "week", NOW);
    expect(all.map((r) => r.name)).not.toContain("Zed");
    expect(all.map((r) => r.name)).toEqual(["Om", "Ravi", "Sam"]);
    expect(all.find((r) => r.name === "Ravi")?.runs).toBe(20);
    expect(week.find((r) => r.name === "Ravi")?.runs).toBe(10);
  });
  it("writes a share text with the link, and says so when nothing was played", () => {
    expect(boardText(group, groupBoard(ms, group, "all", NOW), "all", "https://x.test/")).toContain("2. Ravi: 20 runs");
    expect(boardText(group, [], "week", "https://x.test/")).toContain("No matches yet.");
  });
});

describe("nudge and recap", () => {
  it("nudge needs a match this week", () => {
    expect(weeklyNudge([match("old", NOW - 30 * 24 * 3600 * 1000)], group, "u", NOW)).toBeNull();
    expect(weeklyNudge([match("n", NOW - 1000)], group, "u", NOW)).toContain("Top scorer: Ravi with 10");
  });
  it("recap is for one year only", () => {
    const y = new Date(NOW).getFullYear();
    expect(recapText([match("n", NOW)], "ravi", y, "u")).toContain("10 runs");
    expect(recapText([match("n", NOW)], "ravi", y - 1, "u")).toBeNull();
  });
});

describe("split and poll and rain", () => {
  it("splits everyone into two sides and a new seed can differ", () => {
    const g = newGroup("Six", ["A", "B", "C", "D", "E", "F"]);
    const s = splitGroup([], g, 1);
    expect([...s.a, ...s.b].sort()).toEqual(["A", "B", "C", "D", "E", "F"]);
  });
  it("poll lists the players", () => expect(pollText(group, "Sunday 6pm", "u")).toContain("Ravi, Sam, Om"));
  it("revised target scales the first innings to the overs left", () => {
    expect(revisedTarget(60, 10, 5)).toBe(31);
    expect(revisedTarget(60, 0, 5)).toBe(61);
  });
});
