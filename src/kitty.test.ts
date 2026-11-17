import { describe, expect, it } from "vitest";
import type { Backup } from "./backup";
import type { Ev, Match } from "./engine/types";
import {
  balances, emptyKitty, expenseShares, lostBallDebts, matchPlayers, mergeBackup, mergeKitty, newBallDebt, newExpense,
  newSettlement, newStake, openDebts, openDebtsFor, remove, resolveDebt, settleStake, settleUp, splitEqually, stakeLosers,
  turfExpense, turfSplit, updateStake, type Kitty,
} from "./kitty";

const ball = (runs: number, extra: Partial<Extract<Ev, { t: "ball" }>> = {}): Ev => ({ t: "ball", runs, bowler: "b1", ...extra });
const match = (first: Ev[], second: Ev[], status: Match["status"] = "done"): Match => ({
  id: "m1", createdAt: 1, toss: null, status,
  teams: [
    { name: "Lane", players: [{ id: "a1", name: "Rahul" }, { id: "a2", name: "Amit" }, { id: "c", name: "Chotu" }] },
    { name: "Gully", players: [{ id: "b1", name: "Vikas" }, { id: "b2", name: "Sunny" }, { id: "c", name: "Chotu" }] },
  ],
  rules: { overs: 2, extraRun: true, rebowl: true, freeHit: false, lastManStands: false, oneTipCatch: false, wall: "none", tipAndRun: false, maxOversPerBowler: null },
  innings: [
    { bat: 0, overs: 2, wicketLimit: 2, superOver: false, striker: "a1", nonStriker: "a2", bowler: "b1", bowlerSetAt: 0, closed: true, events: first },
    { bat: 1, overs: 2, wicketLimit: 2, superOver: false, striker: "b1", nonStriker: "b2", bowler: "a1", bowlerSetAt: 0, closed: true, events: second },
  ],
});
const sum = (r: Record<string, number>) => Object.values(r).reduce((s, a) => s + a, 0);

describe("splitting an expense", () => {
  it("splits equally when it divides", () => {
    expect(splitEqually(90, ["Rahul", "Amit", "Vikas"], "Rahul")).toEqual({ Rahul: 30, Amit: 30, Vikas: 30 });
  });
  it("puts the leftover rupees on the payer", () => {
    const shares = splitEqually(100, ["Rahul", "Amit", "Vikas"], "Amit");
    expect(shares).toEqual({ Rahul: 33, Amit: 34, Vikas: 33 });
    expect(sum(shares)).toBe(100);
  });
  it("charges the leftover to a payer who is not in the split", () => {
    const shares = splitEqually(100, ["Rahul", "Amit", "Vikas"], "Sunny");
    expect(shares).toEqual({ Rahul: 33, Amit: 33, Vikas: 33, Sunny: 1 });
  });
  it("ignores repeated names in any case and blank names", () => {
    expect(splitEqually(50, ["Rahul", "rahul ", "", "Amit"], "RAHUL")).toEqual({ Rahul: 25, Amit: 25 });
  });
  it("rounds amounts to whole rupees and defaults the split to the payer", () => {
    const e = newExpense({ what: "chai", amount: 59.6, paidBy: " Rahul " });
    expect(e).toMatchObject({ amount: 60, paidBy: "Rahul", split: ["Rahul"] });
    expect(expenseShares(e)).toEqual({ Rahul: 60 });
  });
  it("keeps free text for what was bought", () => {
    expect(newExpense({ what: "other", label: " Stumps ", amount: 200, paidBy: "Amit", split: ["Amit"] }).label).toBe("Stumps");
  });
  it("uses custom shares and puts any gap on the payer", () => {
    const e = newExpense({ what: "bat", amount: 1000, paidBy: "Rahul", split: ["Rahul", "Amit"], custom: { Amit: 700, Rahul: 200 } });
    expect(expenseShares(e)).toEqual({ Amit: 700, Rahul: 300 });
  });
});

describe("balances and settling up", () => {
  const ballBuy = newExpense({ what: "ball", amount: 100, paidBy: "Rahul", split: ["Rahul", "Amit", "Vikas"] }, 1);
  const chai = newExpense({ what: "chai", amount: 60, paidBy: "Vikas", split: ["Rahul", "Amit", "Vikas"] }, 2);

  it("nets what each player paid against their shares", () => {
    const b = balances([ballBuy, chai]);
    expect(b).toEqual([{ name: "Rahul", net: 46 }, { name: "Vikas", net: 7 }, { name: "Amit", net: -53 }]);
    expect(b.reduce((s, x) => s + x.net, 0)).toBe(0);
  });
  it("counts a settlement as money paid back", () => {
    const b = balances([ballBuy, chai], [newSettlement("Amit", "Rahul", 46)]);
    expect(b).toEqual([{ name: "Vikas", net: 7 }, { name: "Rahul", net: 0 }, { name: "Amit", net: -7 }]);
  });
  it("leaves deleted expenses out", () => {
    expect(balances([remove(ballBuy), chai]).find((b) => b.name === "Rahul")?.net).toBe(-20);
  });
  it("settles one debtor with one transfer per creditor", () => {
    expect(settleUp(balances([ballBuy, chai]))).toEqual([
      { from: "Amit", to: "Rahul", amount: 46 },
      { from: "Amit", to: "Vikas", amount: 7 },
    ]);
  });
  it("needs no more than players minus one transfers and clears every balance", () => {
    const ex = [
      newExpense({ what: "turf", amount: 1200, paidBy: "A", split: ["A", "B", "C", "D", "E"] }),
      newExpense({ what: "ball", amount: 150, paidBy: "B", split: ["A", "B", "C", "D", "E"] }),
      newExpense({ what: "chai", amount: 100, paidBy: "C", split: ["C", "D"] }),
    ];
    const b = balances(ex), moves = settleUp(b);
    expect(moves.length).toBeLessThanOrEqual(4);
    const left = new Map(b.map((x) => [x.name, x.net]));
    for (const t of moves) { left.set(t.from, left.get(t.from)! + t.amount); left.set(t.to, left.get(t.to)! - t.amount); }
    expect([...left.values()].every((v) => v === 0)).toBe(true);
  });
  it("has nothing to settle when everyone is square", () => {
    expect(settleUp(balances([newExpense({ what: "tape", amount: 40, paidBy: "Amit", split: ["Amit"] })]))).toEqual([]);
  });
});

describe("turf split", () => {
  const m = match([ball(1)], [ball(0)]);
  it("counts a common player once", () => {
    expect(matchPlayers(m)).toEqual(["Rahul", "Amit", "Chotu", "Vikas", "Sunny"]);
  });
  it("shares the fee and gives the leftover to the payer", () => {
    const t = turfSplit(1002, m, "Vikas");
    expect(t.each).toBe(200);
    expect(t.shares).toEqual({ Rahul: 200, Amit: 200, Chotu: 200, Vikas: 202, Sunny: 200 });
    expect(sum(t.shares)).toBe(1002);
  });
  it("makes a turf expense tied to the match", () => {
    const e = turfExpense(1000, m, "Rahul", 5);
    expect(e).toMatchObject({ what: "turf", amount: 1000, matchId: "m1", split: matchPlayers(m) });
    expect(balances([e])[0]).toEqual({ name: "Rahul", net: 800 });
  });
});

describe("lost-ball ledger", () => {
  const lost = ball(0, { wicket: { kind: "hit out", out: "s", newId: "a2", outId: "a1" } });
  const m = match([ball(1), lost], [ball(0)]);

  it("logs a debt for a ball hit out of the ground", () => {
    const [d, ...rest] = lostBallDebts(m, [], 3);
    expect(rest).toEqual([]);
    expect(d).toMatchObject({ player: "Rahul", matchId: "m1", innings: 0, ball: 1, resolved: false, createdAt: 3 });
  });
  it("does not log the same ball twice", () => {
    const first = lostBallDebts(m);
    expect(lostBallDebts(m, first)).toEqual([]);
  });
  it("lists open debts per player and drops resolved ones", () => {
    const a = newBallDebt("Rahul", "m1", 0, 1), b = newBallDebt("rahul", "m2", 1, 4), c = newBallDebt("Amit", "m2", 0, 2);
    expect(openDebts([a, b, c])).toEqual({ Rahul: [a, b], Amit: [c] });
    expect(openDebtsFor([a, resolveDebt(b), c], "RAHUL")).toEqual([a]);
    expect(openDebts([resolveDebt(a), remove(c)])).toEqual({});
  });
});

describe("stakes", () => {
  it("has no losers until the match has a result", () => {
    const m = match([ball(4)], [], "live");
    expect(stakeLosers(m)).toBeNull();
    const s = newStake("m1", "Losers buy chai");
    expect(updateStake(s, m)).toBe(s);
  });
  it("names the losing side without the common player", () => {
    const m = match([ball(4)], [ball(1)]);
    const s = updateStake(newStake("m1", " Losers buy chai ", 1), m, 9);
    expect(s).toMatchObject({ label: "Losers buy chai", losers: ["Vikas", "Sunny"], settled: false, editedAt: 9 });
    expect(settleStake(s).settled).toBe(true);
  });
  it("has nobody to pay after a tie", () => {
    expect(stakeLosers(match([ball(2)], [ball(2)]))).toEqual([]);
  });
  it("ignores a different match", () => {
    const s = newStake("other", "Losers buy chai");
    expect(updateStake(s, match([ball(4)], [ball(1)]))).toBe(s);
  });
});

describe("merging local and cloud", () => {
  const e1 = newExpense({ what: "ball", amount: 100, paidBy: "Rahul", split: ["Rahul", "Amit"] }, 1);
  const e2 = newExpense({ what: "chai", amount: 40, paidBy: "Amit", split: ["Rahul", "Amit"] }, 2);
  const d = newBallDebt("Rahul", "m1", 0, 1, 1);
  const s = newStake("m1", "Losers buy chai", 1);
  const k = (p: Partial<Kitty>): Kitty => ({ ...emptyKitty(), ...p });

  it("keeps records from both sides, newest first", () => {
    const out = mergeKitty(k({ expenses: [e1] }), k({ expenses: [e2], settlements: [newSettlement("Amit", "Rahul", 10, 3)] }));
    expect(out.expenses.map((x) => x.id)).toEqual([e2.id, e1.id]);
    expect(out.settlements).toHaveLength(1);
  });
  it("takes the later edit of the same record from either side", () => {
    const edited = { ...e1, amount: 120, editedAt: 5 };
    expect(mergeKitty(k({ expenses: [e1] }), k({ expenses: [edited] })).expenses[0].amount).toBe(120);
    expect(mergeKitty(k({ expenses: [edited] }), k({ expenses: [e1] })).expenses[0].amount).toBe(120);
  });
  it("keeps a removal so the record does not come back", () => {
    const out = mergeKitty(k({ expenses: [remove(e1, 4)] }), k({ expenses: [e1] }));
    expect(out.expenses[0].deleted).toBe(true);
    expect(balances(out.expenses)).toEqual([]);
  });
  it("keeps a resolved debt and a settled stake", () => {
    const out = mergeKitty(k({ debts: [d], stakes: [settleStake(s, 4)] }), k({ debts: [resolveDebt(d, 4)], stakes: [s] }));
    expect(out.debts[0].resolved).toBe(true);
    expect(out.stakes[0].settled).toBe(true);
  });
  it("handles a missing side", () => {
    expect(mergeKitty(undefined, k({ debts: [d] })).debts).toEqual([d]);
    expect(mergeKitty(null, null)).toEqual(emptyKitty());
  });
  it("carries the kitty through a backup merge", () => {
    const base: Backup = { v: 1, matches: [], teams: [], cups: [] };
    const out = mergeBackup({ ...base, kitty: k({ expenses: [e1] }) }, { ...base, kitty: k({ expenses: [e2] }) });
    expect(out.kitty?.expenses).toHaveLength(2);
    expect(mergeBackup({ ...base }, null).kitty).toEqual(emptyKitty());
  });
});
