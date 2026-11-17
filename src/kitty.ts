import { merge, type Backup } from "./backup";
import { isCommon, result, uid } from "./engine/engine";
import type { Match } from "./engine/types";

/** Tracking only: who paid what for the game. Amounts are whole rupees; no payments happen here. */
export type ExpenseKind = "ball" | "tape" | "bat" | "turf" | "chai" | "other";

/** editedAt orders two copies of the same record; deleted keeps a removal from coming back on merge. */
interface Rec { id: string; createdAt: number; editedAt?: number; deleted?: true }

export interface Expense extends Rec {
  what: ExpenseKind;
  label?: string;                    // free text, e.g. "Cosco ball" or what "other" was
  amount: number;
  paidBy: string;
  split: string[];
  custom?: Record<string, number>;   // exact shares instead of an equal split
  matchId?: string;
  note?: string;
}
export interface Settlement extends Rec { from: string; to: string; amount: number }
/** "<player> owes one ball", tied to the ball in the match where it was lost. */
export interface BallDebt extends Rec { player: string; matchId: string; innings: number; ball: number; resolved: boolean }
/** losers stays null until the match has a result; [] after a tie or draw. */
export interface Stake extends Rec { matchId: string; label: string; losers: string[] | null; settled: boolean }
export interface Kitty { expenses: Expense[]; settlements: Settlement[]; debts: BallDebt[]; stakes: Stake[] }
export interface Balance { name: string; net: number }
export interface Transfer { from: string; to: string; amount: number }

export const emptyKitty = (): Kitty => ({ expenses: [], settlements: [], debts: [], stakes: [] });

const key = (name: string) => name.trim().toLowerCase();
const rupees = (n: number) => (Number.isFinite(n) ? Math.max(0, Math.round(n)) : 0);
const live = <T extends Rec>(list: T[]) => list.filter((x) => !x.deleted);

/** Names with blanks and case-insensitive repeats dropped; the first spelling wins. */
export function uniqueNames(names: string[]): string[] {
  const seen = new Set<string>(), out: string[] = [];
  for (const n of names) {
    const k = key(n);
    if (k && !seen.has(k)) { seen.add(k); out.push(n.trim()); }
  }
  return out;
}

export function newExpense(
  input: { what: ExpenseKind; amount: number; paidBy: string; split?: string[]; label?: string; custom?: Record<string, number>; matchId?: string; note?: string },
  now = Date.now(),
): Expense {
  const paidBy = input.paidBy.trim(), split = uniqueNames(input.split ?? []);
  const e: Expense = { id: uid(), createdAt: now, what: input.what, amount: rupees(input.amount), paidBy, split: split.length ? split : [paidBy] };
  if (input.label?.trim()) e.label = input.label.trim();
  if (input.custom) e.custom = Object.fromEntries(Object.entries(input.custom).map(([n, a]) => [n.trim(), rupees(a)]));
  if (input.matchId) e.matchId = input.matchId;
  if (input.note?.trim()) e.note = input.note.trim();
  return e;
}

/** Equal split; the leftover rupees land on the payer so the shares always add up to the total. */
export function splitEqually(amount: number, players: string[], payer: string): Record<string, number> {
  const names = uniqueNames(players), total = rupees(amount), out: Record<string, number> = {};
  if (!names.length) return payer.trim() ? { [payer.trim()]: total } : out;
  const each = Math.floor(total / names.length);
  for (const n of names) out[n] = each;
  return addTo(out, payer, total - each * names.length);
}

function addTo(shares: Record<string, number>, name: string, amount: number): Record<string, number> {
  if (!amount) return shares;
  const hit = Object.keys(shares).find((n) => key(n) === key(name));
  shares[hit ?? name.trim()] = (hit ? shares[hit] : 0) + amount;
  return shares;
}

/** What each player owes for one expense, payer's own share included. Custom shares that miss the total settle on the payer. */
export function expenseShares(e: Expense): Record<string, number> {
  if (!e.custom) return splitEqually(e.amount, e.split, e.paidBy);
  const out: Record<string, number> = {};
  for (const [n, a] of Object.entries(e.custom)) addTo(out, n, rupees(a));
  const gap = e.amount - Object.values(out).reduce((s, a) => s + a, 0);
  if (gap >= 0) return addTo(out, e.paidBy, gap);
  return splitEqually(e.amount, e.split, e.paidBy);   // custom shares add up to more than was paid: fall back
}

/** Net per player, largest first. Positive means the group owes them. */
export function balances(expenses: Expense[], settlements: Settlement[] = []): Balance[] {
  const net = new Map<string, Balance>();
  const add = (name: string, amount: number) => {
    const k = key(name);
    if (!k) return;
    const b = net.get(k) ?? { name: name.trim(), net: 0 };
    b.net += amount;
    net.set(k, b);
  };
  for (const e of live(expenses)) {
    add(e.paidBy, e.amount);
    for (const [n, a] of Object.entries(expenseShares(e))) add(n, -a);
  }
  for (const s of live(settlements)) { add(s.from, rupees(s.amount)); add(s.to, -rupees(s.amount)); }
  return [...net.values()].sort((x, y) => y.net - x.net || x.name.localeCompare(y.name));
}

/** Greedy settle-up: the biggest debtor pays the biggest creditor until everyone is square. */
export function settleUp(list: Balance[]): Transfer[] {
  const side = (sign: 1 | -1) => list.filter((b) => b.net * sign > 0).map((b) => ({ name: b.name, left: b.net * sign }));
  const owed = side(1), owing = side(-1), out: Transfer[] = [];
  const top = (xs: { name: string; left: number }[]) => xs.sort((x, y) => y.left - x.left || x.name.localeCompare(y.name))[0];
  while (owed.length && owing.length) {
    const to = top(owed), from = top(owing), amount = Math.min(to.left, from.left);
    out.push({ from: from.name, to: to.name, amount });
    to.left -= amount; from.left -= amount;
    if (!to.left) owed.shift();
    if (!from.left) owing.shift();
  }
  return out;
}

export const newSettlement = (from: string, to: string, amount: number, now = Date.now()): Settlement =>
  ({ id: uid(), createdAt: now, from: from.trim(), to: to.trim(), amount: rupees(amount) });

/** Everyone on either team, a common player counted once. */
export function matchPlayers(m: Match): string[] {
  const ids = new Set<string>(), names: string[] = [];
  for (const t of m.teams) for (const p of t.players) if (!ids.has(p.id)) { ids.add(p.id); names.push(p.name); }
  return uniqueNames(names);
}

/** Turf fee shared by the match's players. Leftover rupees go to the payer, or the first player if none is given. */
export function turfSplit(fee: number, m: Match, paidBy?: string): { players: string[]; each: number; shares: Record<string, number> } {
  const players = matchPlayers(m);
  const each = players.length ? Math.floor(rupees(fee) / players.length) : 0;
  return { players, each, shares: splitEqually(fee, players, paidBy?.trim() || players[0] || "") };
}

export const turfExpense = (fee: number, m: Match, paidBy: string, now = Date.now()): Expense =>
  newExpense({ what: "turf", amount: fee, paidBy, split: matchPlayers(m), matchId: m.id }, now);

export const newBallDebt = (player: string, matchId: string, innings: number, ball: number, now = Date.now()): BallDebt =>
  ({ id: uid(), createdAt: now, player: player.trim(), matchId, innings, ball, resolved: false });

/**
 * A debt for every ball hit out of the ground (a "hit out" wicket) or marked lost, that the ledger does not have yet.
 * A lost ball's striker owes it. A lost ball right after a hit out, with no ball bowled between, is that same ball.
 */
export function lostBallDebts(m: Match, existing: BallDebt[] = [], now = Date.now()): BallDebt[] {
  const out: BallDebt[] = [], players = m.teams.flatMap((t) => t.players);
  const owe = (id: string | null | undefined, i: number, j: number) => {
    const name = players.find((p) => p.id === id)?.name;
    if (!name || existing.some((d) => d.matchId === m.id && d.innings === i && d.ball === j)) return;
    out.push(newBallDebt(name, m.id, i, j, now));
  };
  m.innings.forEach((inn, i) => {
    let hitOut = false;   // the last ball bowled was hit out of the ground
    inn.events.forEach((ev, j) => {
      if (ev.t === "ball") {
        hitOut = ev.wicket?.kind === "hit out";
        if (hitOut && ev.wicket?.outId) owe(ev.wicket.outId, i, j);
      } else if (ev.t === "lost") {
        if (!hitOut) owe(ev.striker, i, j);
        hitOut = false;
      }
    });
  });
  return out;
}

/** Unresolved debts grouped by player, players spelled as first seen. */
export function openDebts(debts: BallDebt[]): Record<string, BallDebt[]> {
  const names = new Map<string, string>(), out: Record<string, BallDebt[]> = {};
  for (const d of live(debts)) {
    if (d.resolved) continue;
    const k = key(d.player);
    if (!names.has(k)) names.set(k, d.player);
    (out[names.get(k)!] ??= []).push(d);
  }
  return out;
}

export const openDebtsFor = (debts: BallDebt[], player: string) => live(debts).filter((d) => !d.resolved && key(d.player) === key(player));

export const resolveDebt = (d: BallDebt, now = Date.now()): BallDebt => ({ ...d, resolved: true, editedAt: now });

export const newStake = (matchId: string, label: string, now = Date.now()): Stake =>
  ({ id: uid(), createdAt: now, matchId, label: label.trim(), losers: null, settled: false });

/** Losing side's players, without a common player (he played for the winners too). Null until there is a result. */
export function stakeLosers(m: Match): string[] | null {
  const r = result(m);
  if (!r) return null;
  if (r.winner === null) return [];
  return uniqueNames(m.teams[r.winner === 0 ? 1 : 0].players.filter((p) => !isCommon(m, p.id)).map((p) => p.name));
}

/** Fills in the losers once the match is done; a stake that already has them is left alone. */
export function updateStake(s: Stake, m: Match, now = Date.now()): Stake {
  if (s.losers || s.matchId !== m.id) return s;
  const losers = stakeLosers(m);
  return losers ? { ...s, losers, editedAt: now } : s;
}

export const settleStake = (s: Stake, now = Date.now()): Stake => ({ ...s, settled: true, editedAt: now });

/** Soft delete, so merging with a copy that still has the record does not bring it back. */
export const remove = <T extends Rec>(x: T, now = Date.now()): T => ({ ...x, deleted: true, editedAt: now });

const stamp = (x: Rec) => x.editedAt ?? x.createdAt;

function byId<T extends Rec>(a: T[] = [], b: T[] = [], tie: (x: T, y: T) => boolean = () => false): T[] {
  const out = new Map(a.map((x) => [x.id, x]));
  for (const y of b) {
    const x = out.get(y.id);
    const takeY = !x || stamp(y) > stamp(x) || (stamp(y) === stamp(x) && ((y.deleted && !x.deleted) || tie(x, y)));
    out.set(y.id, takeY ? y : x);
  }
  return [...out.values()].sort((x, y) => y.createdAt - x.createdAt);
}

/** Joins two copies by id like backup.ts: nothing is dropped, and for the same id the later edit wins. */
export function mergeKitty(local?: Kitty | null, cloud?: Kitty | null): Kitty {
  const l = local ?? emptyKitty(), c = cloud ?? emptyKitty();
  return {
    expenses: byId(l.expenses, c.expenses),
    settlements: byId(l.settlements, c.settlements),
    debts: byId(l.debts, c.debts, (x, y) => y.resolved && !x.resolved),
    stakes: byId(l.stakes, c.stakes, (x, y) => (y.settled && !x.settled) || (!!y.losers && !x.losers)),
  };
}

/** Backup plus the kitty. Use mergeBackup wherever account sync calls merge(). */
export type KittyBackup = Backup & { kitty?: Kitty };

export function mergeBackup(local: KittyBackup, cloud: KittyBackup | null): KittyBackup {
  return { ...merge(local, cloud), kitty: mergeKitty(local.kitty, cloud?.kitty) };
}
