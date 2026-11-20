import { describe, expect, it } from "vitest";
import type { Ev, Match } from "./engine/types";
import { balances, emptyKitty, newExpense, newSettlement, newStake, openDebts, type Kitty } from "./kitty";
import { expenseDefaults, history, inr, isEmpty, kittyActions, knownNames, pot, scanMatches } from "./kittyView";

const ball = (runs: number, extra: Partial<Extract<Ev, { t: "ball" }>> = {}): Ev => ({ t: "ball", runs, bowler: "b1", ...extra });
const lost = ball(0, { wicket: { kind: "hit out", out: "s", newId: "a2", outId: "a1" } });
const match = (id: string, first: Ev[], second: Ev[], status: Match["status"] = "done"): Match => ({
  id, createdAt: 1, toss: null, status,
  teams: [
    { name: "Lane", players: [{ id: "a1", name: "Rahul" }, { id: "a2", name: "Amit" }] },
    { name: "Gully", players: [{ id: "b1", name: "Vikas" }, { id: "b2", name: "Player 4" }] },
  ],
  rules: { overs: 2, extraRun: true, rebowl: true, freeHit: false, lastManStands: false, oneTipCatch: false, wall: "none", tipAndRun: false, maxOversPerBowler: null },
  innings: [
    { bat: 0, overs: 2, wicketLimit: 2, superOver: false, striker: "a1", nonStriker: "a2", bowler: "b1", bowlerSetAt: 0, closed: true, events: first },
    { bat: 1, overs: 2, wicketLimit: 2, superOver: false, striker: "b1", nonStriker: "b2", bowler: "a1", bowlerSetAt: 0, closed: true, events: second },
  ],
});

function store(matches: Match[], kitty: Kitty = emptyKitty()) {
  let state = { kitty, matches };
  const act = kittyActions(() => state, (p) => { state = { ...state, ...p }; });
  return { act, get: () => state, setMatches: (m: Match[]) => { state = { ...state, matches: m }; } };
}

describe("kitty store actions", () => {
  it("adds expenses and payments that feed the balances, newest first", () => {
    const s = store([]);
    s.act.addExpense(newExpense({ what: "ball", amount: 100, paidBy: "Rahul", split: ["Rahul", "Amit"] }, 1));
    s.act.addSettlement(newSettlement("Amit", "Rahul", 50, 2));
    expect(balances(s.get().kitty.expenses, s.get().kitty.settlements).every((b) => b.net === 0)).toBe(true);
    expect(history(s.get().kitty).map((h) => h.kind)).toEqual(["settlement", "expense"]);
    expect(pot(s.get().kitty)).toBe(100);
  });

  it("soft-deletes so the record stays for sync but drops out of the totals", () => {
    const s = store([]);
    const e = newExpense({ what: "chai", amount: 40, paidBy: "Amit" });
    s.act.addExpense(e);
    s.act.removeKittyItem("expenses", e.id);
    expect(s.get().kitty.expenses[0]).toMatchObject({ id: e.id, deleted: true });
    expect(pot(s.get().kitty)).toBe(0);
    expect(isEmpty(s.get().kitty)).toBe(true);
  });

  it("picks up a lost ball from a finished match once, and resolves it", () => {
    const s = store([match("m1", [ball(1), lost], [ball(0)])]);
    s.act.scanKitty();
    const after = s.get().kitty;
    expect(openDebts(after.debts)).toMatchObject({ Rahul: [{ matchId: "m1", ball: 1 }] });
    s.act.scanKitty();
    expect(s.get().kitty).toBe(after);
    s.act.resolveDebt(after.debts[0].id);
    expect(openDebts(s.get().kitty.debts)).toEqual({});
    s.act.scanKitty();
    expect(s.get().kitty.debts).toHaveLength(1);
  });

  it("waits for a live match to finish before logging its lost balls", () => {
    const k = emptyKitty();
    expect(scanMatches(k, [match("m1", [lost], [], "live")])).toBe(k);
  });

  it("fills in stake losers when the match ends, then settles", () => {
    const s = store([match("m1", [ball(4)], [], "live")]);
    s.act.addStake(newStake("m1", "Losers buy chai"));
    expect(s.get().kitty.stakes[0].losers).toBeNull();
    s.setMatches([match("m1", [ball(4)], [ball(1)])]);
    s.act.scanKitty();
    expect(s.get().kitty.stakes[0].losers).toEqual(["Vikas", "Player 4"]);
    s.act.settleStake(s.get().kitty.stakes[0].id);
    expect(s.get().kitty.stakes[0].settled).toBe(true);
  });

  it("names the losers at once for a stake on a finished match", () => {
    const s = store([match("m1", [ball(4)], [ball(1)])]);
    s.act.addStake(newStake("m1", "Losers pay the turf"));
    expect(s.get().kitty.stakes[0].losers).toEqual(["Vikas", "Player 4"]);
  });
});

describe("kitty screen helpers", () => {
  it("formats rupees the Indian way", () => {
    expect([inr(0), inr(999), inr(1000), inr(123456), inr(1234567)]).toEqual(["0", "999", "1,000", "1,23,456", "12,34,567"]);
  });

  it("lists known names once, without placeholder players", () => {
    const k = { ...emptyKitty(), expenses: [newExpense({ what: "chai", amount: 20, paidBy: "Om", split: ["rahul"] })] };
    const names = knownNames([{ id: "t", name: "T", players: [{ id: "x", name: "Sam" }, { id: "y", name: "amit" }] }], [match("m1", [], [])], k);
    expect(names).toEqual(["Rahul", "Amit", "Vikas", "Sam", "Om"]);
  });
});

describe("expenseDefaults", () => {
  it("pays as me and splits among everyone", () => {
    expect(expenseDefaults(["Rahul", "Amit", "rahul"], "rahul")).toEqual({ paidBy: "Rahul", split: ["Rahul", "Amit"] });
  });
  it("leaves paid by empty when me is unknown or not listed", () => {
    expect(expenseDefaults(["Rahul"], null).paidBy).toBe("");
    expect(expenseDefaults(["Rahul"], "Zed").paidBy).toBe("");
  });
});
