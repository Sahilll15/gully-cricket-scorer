import { describe, expect, it } from "vitest";
import type { Match } from "./engine/types";
import { balances, emptyKitty, newBallDebt, newExpense, newSettlement, newStake, type Kitty } from "./kitty";
import { mergePlayers, mergeReach, undoMerge, type Roster } from "./merge";
import { profile } from "./stats";

const rules = { overs: 2, extraRun: true, rebowl: true, freeHit: false, lastManStands: false, oneTipCatch: false, wall: "none" as const, tipAndRun: false, maxOversPerBowler: null };
const match = (id: string, a: string, b: string, runs: number): Match => ({
  id, createdAt: 1, toss: null, status: "done", rules,
  teams: [
    { name: "Lane", players: [{ id: `${id}a`, name: a }, { id: `${id}x`, name: "Amit" }] },
    { name: "Gully", players: [{ id: `${id}b`, name: b }, { id: `${id}y`, name: "Vikas" }] },
  ],
  innings: [{ bat: 0, overs: 2, wicketLimit: 2, superOver: false, striker: `${id}a`, nonStriker: `${id}x`, bowler: `${id}b`, bowlerSetAt: 0, closed: true,
    events: [{ t: "ball", runs, bowler: `${id}b` }] }],
});

function roster(): Roster {
  const k: Kitty = emptyKitty();
  k.expenses.push(newExpense({ what: "ball", amount: 90, paidBy: "rahul", split: ["Rahul", "Rahul K", "Amit"] }, 10));
  k.expenses.push(newExpense({ what: "chai", amount: 40, paidBy: "Amit", split: ["Amit", "Vikas"], custom: { Amit: 20, Vikas: 20 } }, 11));
  k.settlements.push(newSettlement("Rahul", "Amit", 30, 12));
  k.debts.push(newBallDebt("RAHUL", "m1", 0, 0, 13));
  k.stakes.push({ ...newStake("m1", "Losers buy chai", 14), losers: ["Rahul", "Amit"] });
  return {
    matches: [match("m1", "Rahul", "Sunny", 4), match("m2", "Rahul K", "Sunny", 6), match("m3", "Om", "Sunny", 1)],
    teams: [
      { id: "t1", name: "Lane", players: [{ id: "p1", name: "Rahul" }, { id: "p2", name: "Amit" }, { id: "p3", name: "Rahul K" }] },
      { id: "t2", name: "Old", players: [{ id: "p4", name: "rahul" }] },
    ],
    infos: { rahul: { role: "bat", upi: "rahul@okaxis" }, "rahul k": { hand: "L" } },
    kitty: k,
  };
}

describe("merging two names for one player", () => {
  it("renames them in every match, so their stats add up", () => {
    const r = roster();
    const before = profile(r.matches, "Rahul K", "limited").runs;
    const { roster: out } = mergePlayers(r, "Rahul", "Rahul K", 100);
    expect(out.matches.flatMap((m) => m.teams.flatMap((t) => t.players.map((p) => p.name)))).not.toContain("Rahul");
    expect(profile(out.matches, "Rahul K", "limited").runs).toBe(before + 4);
    expect(out.matches[2]).toBe(r.matches[2]);
  });

  it("drops the duplicate from a team that already has the kept name, and renames it elsewhere", () => {
    const { roster: out } = mergePlayers(roster(), "Rahul", "Rahul K", 100);
    expect(out.teams[0].players.map((p) => p.name)).toEqual(["Amit", "Rahul K"]);
    expect(out.teams[1].players).toEqual([{ id: "p4", name: "Rahul K" }]);
  });

  it("folds player details together, the kept name winning a clash", () => {
    const { roster: out } = mergePlayers(roster(), "Rahul", "Rahul K", 100);
    expect(out.infos).toEqual({ "rahul k": { role: "bat", upi: "rahul@okaxis", hand: "L" } });
  });

  it("moves kitty entries over without changing anyone else's balance", () => {
    const r = roster();
    const { roster: out } = mergePlayers(r, "Rahul", "Rahul K", 100);
    const e = out.kitty.expenses.find((x) => x.what === "ball")!;
    expect(e.paidBy).toBe("Rahul K");
    expect(e.split).toEqual(["Rahul K", "Amit"]);
    expect(out.kitty.settlements[0]).toMatchObject({ from: "Rahul K", to: "Amit" });
    expect(out.kitty.debts[0].player).toBe("Rahul K");
    expect(out.kitty.stakes[0].losers).toEqual(["Rahul K", "Amit"]);
    expect(out.kitty.expenses.find((x) => x.what === "chai")).toBe(r.kitty.expenses.find((x) => x.what === "chai"));
    const vikas = (k: Kitty) => balances(k.expenses, k.settlements).find((b) => b.name === "Vikas")?.net;
    expect(vikas(out.kitty)).toBe(vikas(r.kitty));
  });

  it("counts what it will touch", () => {
    expect(mergeReach(roster(), "rahul")).toEqual({ matches: 1, teams: 2, kitty: 4 });
  });

  it("does nothing when both names are the same person already", () => {
    const r = roster();
    expect(mergePlayers(r, "rahul k", "Rahul K").roster).toBe(r);
  });
});

describe("undoing a merge", () => {
  it("puts every name, team and detail back", () => {
    const r = roster();
    const { roster: out, undo } = mergePlayers(r, "Rahul", "Rahul K", 100);
    const back = undoMerge(out, undo, 200);
    expect(back.matches.map((m) => m.teams)).toEqual(r.matches.map((m) => m.teams));
    expect(back.teams).toEqual(r.teams);
    expect(back.infos).toEqual(r.infos);
    const strip = (k: Kitty) => JSON.parse(JSON.stringify(k, (key, v) => (key === "editedAt" ? undefined : v)));
    expect(strip(back.kitty)).toEqual(strip(r.kitty));
  });

  it("keeps a match scored after the merge", () => {
    const { roster: out, undo } = mergePlayers(roster(), "Rahul", "Rahul K", 100);
    const later = { ...match("m9", "Rahul K", "Sunny", 2) };
    const back = undoMerge({ ...out, matches: [later, ...out.matches] }, undo, 200);
    expect(back.matches[0].teams).toEqual(later.teams);
    expect(back.matches).toHaveLength(4);
  });

  it("leaves details alone when the merged name had none", () => {
    const r = roster();
    const { roster: out, undo } = mergePlayers(r, "Om", "Amit", 100);
    const edited = { ...out, infos: { ...out.infos, amit: { role: "bowl" as const } } };
    expect(undoMerge(edited, undo, 200).infos.amit).toEqual({ role: "bowl" });
  });
});
