import type { Match } from "./engine/types";
import type { SavedTeam } from "./engine/tournament";
import {
  lostBallDebts, matchPlayers, remove, resolveDebt as resolved, settleStake as settled, uniqueNames, updateStake,
  type BallDebt, type Expense, type ExpenseKind, type Kitty, type Settlement, type Stake,
} from "./kitty";

/** Store and screen glue for the kitty, shared by the web and the native app. */
export const KINDS: { v: ExpenseKind; label: string }[] = [
  { v: "ball", label: "Ball" }, { v: "tape", label: "Tape" }, { v: "bat", label: "Bat" },
  { v: "turf", label: "Turf" }, { v: "chai", label: "Chai" }, { v: "other", label: "Other" },
];
export const kindLabel = (k: ExpenseKind) => KINDS.find((x) => x.v === k)?.label ?? "Other";
export const expenseTitle = (e: Expense) => e.label ?? kindLabel(e.what);

/** A new expense starts as "I paid, everyone shares" when I am a known name. */
export function expenseDefaults(names: string[], me: string | null): { paidBy: string; split: string[] } {
  const people = uniqueNames(names);
  return { paidBy: (me && people.find((n) => n.toLowerCase() === me.toLowerCase())) || "", split: people };
}

export const STAKE_IDEAS = ["Losers buy chai", "Losers pay the turf", "Losers buy the next ball"];

/** Whole rupees with Indian grouping (1,23,456), no symbol. Hand-rolled because Hermes Intl varies by build. */
export function inr(n: number): string {
  const s = String(Math.abs(Math.round(n))), last = s.slice(-3), rest = s.slice(0, -3);
  return (rest ? `${rest.replace(/\B(?=(\d{2})+(?!\d))/g, ",")},` : "") + last;
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
export const shortDate = (t: number) => { const d = new Date(t); return `${d.getDate()} ${MONTHS[d.getMonth()]}`; };
export const matchTitle = (m: Match) => `${m.teams[0].name} v ${m.teams[1].name}`;

/** Matches worth picking from, newest first. Set-up-only matches have no players worth splitting with yet. */
export const pickableMatches = (matches: Match[], n = 6) =>
  [...matches].filter((m) => m.status !== "setup").sort((a, b) => b.createdAt - a.createdAt).slice(0, n);

const placeholder = (n: string) => /^player \d+$/i.test(n.trim());

/** Everyone the app knows: recent matches first, then saved teams, then anyone already in the kitty. */
export function knownNames(teams: SavedTeam[], matches: Match[], kitty: Kitty, recent = 8): string[] {
  return uniqueNames([
    ...pickableMatches(matches, recent).flatMap(matchPlayers),
    ...teams.flatMap((t) => t.players.map((p) => p.name)),
    ...kitty.expenses.filter((e) => !e.deleted).flatMap((e) => [e.paidBy, ...e.split]),
  ]).filter((n) => !placeholder(n));
}

export const pot = (k: Kitty) => k.expenses.reduce((s, e) => (e.deleted ? s : s + e.amount), 0);

export type HistoryItem = { kind: "expense"; at: number; x: Expense } | { kind: "settlement"; at: number; x: Settlement };

export function history(k: Kitty): HistoryItem[] {
  const out: HistoryItem[] = [
    ...k.expenses.filter((e) => !e.deleted).map((x) => ({ kind: "expense" as const, at: x.createdAt, x })),
    ...k.settlements.filter((s) => !s.deleted).map((x) => ({ kind: "settlement" as const, at: x.createdAt, x })),
  ];
  return out.sort((a, b) => b.at - a.at);
}

export const liveStakes = (k: Kitty) => k.stakes.filter((s) => !s.deleted);

export const isEmpty = (k: Kitty) =>
  !k.expenses.some((e) => !e.deleted) && !k.settlements.some((s) => !s.deleted) && !k.debts.some((d) => !d.deleted) && !k.stakes.some((s) => !s.deleted);

/** Adds lost-ball debts from finished matches and fills in stake losers. Returns the same object when nothing changed. */
export function scanMatches(k: Kitty, matches: Match[], now = Date.now()): Kitty {
  // Finished matches only: a ball undone mid-match would otherwise leave a debt nobody can clear.
  const done = matches.filter((m) => m.status === "done");
  const debts = done.flatMap((m) => lostBallDebts(m, k.debts, now));
  const byId = new Map(done.map((m) => [m.id, m]));
  let changed = debts.length > 0;
  const stakes = k.stakes.map((s) => {
    const m = byId.get(s.matchId);
    const next = m && !s.deleted ? updateStake(s, m, now) : s;
    if (next !== s) changed = true;
    return next;
  });
  return changed ? { ...k, debts: [...debts, ...k.debts], stakes } : k;
}

export type KittyList = "expenses" | "settlements" | "debts" | "stakes";

export interface KittyActions {
  addExpense: (e: Expense) => void;
  addSettlement: (s: Settlement) => void;
  addStake: (s: Stake) => void;
  removeKittyItem: (list: KittyList, id: string) => void;
  resolveDebt: (id: string) => void;
  settleStake: (id: string) => void;
  scanKitty: () => void;
}

/** The kitty slice's actions; both stores spread this in so the web and the app behave the same. */
export function kittyActions(get: () => { kitty: Kitty; matches: Match[] }, set: (p: { kitty: Kitty }) => void): KittyActions {
  const k = () => get().kitty;
  const swap = <T extends Expense | Settlement | BallDebt | Stake>(xs: T[], id: string, f: (x: T) => T) => xs.map((x) => (x.id === id ? f(x) : x));
  return {
    addExpense: (e) => set({ kitty: { ...k(), expenses: [e, ...k().expenses] } }),
    addSettlement: (s) => set({ kitty: { ...k(), settlements: [s, ...k().settlements] } }),
    addStake: (s) => {
      const m = get().matches.find((x) => x.id === s.matchId);
      set({ kitty: { ...k(), stakes: [m && m.status === "done" ? updateStake(s, m) : s, ...k().stakes] } });
    },
    removeKittyItem: (list, id) => {
      const cur = k(), gone = <T extends Expense | Settlement | BallDebt | Stake>(name: KittyList, xs: T[]) => (name === list ? swap(xs, id, (x) => remove(x)) : xs);
      set({ kitty: { expenses: gone("expenses", cur.expenses), settlements: gone("settlements", cur.settlements), debts: gone("debts", cur.debts), stakes: gone("stakes", cur.stakes) } });
    },
    resolveDebt: (id) => set({ kitty: { ...k(), debts: swap(k().debts, id, (d) => resolved(d)) } }),
    settleStake: (id) => set({ kitty: { ...k(), stakes: swap(k().stakes, id, (s) => settled(s)) } }),
    scanKitty: () => { const next = scanMatches(k(), get().matches); if (next !== k()) set({ kitty: next }); },
  };
}
