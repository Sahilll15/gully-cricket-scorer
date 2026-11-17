import type { Match, Player } from "./engine/types";
import type { SavedTeam } from "./engine/tournament";
import type { PlayerInfo } from "./playerInfo";
import { uniqueNames, type BallDebt, type Expense, type Kitty, type Settlement, type Stake } from "./kitty";

/** Everything that holds a player's name. Cups and series only hold team ids. */
export interface Roster { matches: Match[]; teams: SavedTeam[]; infos: Record<string, PlayerInfo>; kitty: Kitty }

type KittyFields = Partial<Pick<Expense, "paidBy" | "split" | "custom">> & Partial<Pick<Settlement, "from" | "to">>
  & Partial<Pick<BallDebt, "player">> & Partial<Pick<Stake, "losers">>;

/** The reverse of one merge: the old value of every name it changed, so undo can put each one back. */
export interface MergeUndo {
  from: string;
  into: string;
  at: number;
  matchNames: { matchId: string; playerId: string; name: string }[];
  teamNames: { teamId: string; playerId: string; name: string }[];
  teamDropped: { teamId: string; index: number; player: Player }[];
  infos: { from?: PlayerInfo; into?: PlayerInfo };   // empty when `from` had no details
  kitty: { list: keyof Kitty; id: string; was: KittyFields }[];
}

const key = (n: string) => n.trim().toLowerCase();

/** Renames `from` to `into` everywhere and folds their details together. `into` keeps its spelling. */
export function mergePlayers(r: Roster, from: string, into: string, now = Date.now()): { roster: Roster; undo: MergeUndo } {
  const f = key(from), name = into.trim();
  const is = (n: string) => key(n) === f;
  const undo: MergeUndo = { from: from.trim(), into: name, at: now, matchNames: [], teamNames: [], teamDropped: [], infos: {}, kitty: [] };
  if (!f || !name || f === key(name)) return { roster: r, undo };

  const matches = r.matches.map((m) => {
    if (!m.teams.some((t) => t.players.some((p) => is(p.name)))) return m;
    const teams = m.teams.map((t) => ({
      ...t,
      players: t.players.map((p) => {
        if (!is(p.name)) return p;
        if (!undo.matchNames.some((x) => x.matchId === m.id && x.playerId === p.id)) undo.matchNames.push({ matchId: m.id, playerId: p.id, name: p.name });
        return { ...p, name };
      }),
    })) as Match["teams"];
    return { ...m, teams, editedAt: Math.max(now, (m.editedAt ?? 0) + 1) };
  });

  const teams = r.teams.map((t) => {
    if (!t.players.some((p) => is(p.name))) return t;
    const hasInto = t.players.some((p) => key(p.name) === key(name));
    const players: Player[] = [];
    t.players.forEach((p, index) => {
      if (!is(p.name)) return void players.push(p);
      if (hasInto) return void undo.teamDropped.push({ teamId: t.id, index, player: p });
      undo.teamNames.push({ teamId: t.id, playerId: p.id, name: p.name });
      players.push({ ...p, name });
    });
    return { ...t, players };
  });

  const infos = { ...r.infos };
  const fi = infos[f], ii = infos[key(name)];
  if (fi) {
    undo.infos = { from: fi, into: ii };
    infos[key(name)] = { ...fi, ...ii };
    delete infos[f];
  }

  const rn = (n: string) => (is(n) ? name : n);
  const touch = <T extends { id: string }>(list: keyof Kitty, xs: T[], change: (x: T) => [T, KittyFields] | null) =>
    xs.map((x) => {
      const hit = change(x);
      if (!hit) return x;
      undo.kitty.push({ list, id: x.id, was: hit[1] });
      return hit[0];
    });
  const expenses = touch("expenses", r.kitty.expenses, (e) => {
    const custom = e.custom && Object.keys(e.custom).some(is);
    if (!is(e.paidBy) && !e.split.some(is) && !custom) return null;
    const next: Expense = { ...e, paidBy: rn(e.paidBy), split: uniqueNames(e.split.map(rn)), editedAt: now };
    if (e.custom) {
      const c: Record<string, number> = {};
      for (const [n, a] of Object.entries(e.custom)) c[rn(n)] = (c[rn(n)] ?? 0) + a;
      next.custom = c;
    }
    return [next, { paidBy: e.paidBy, split: e.split, ...(e.custom ? { custom: e.custom } : {}) }];
  });
  const settlements = touch("settlements", r.kitty.settlements, (s) =>
    is(s.from) || is(s.to) ? [{ ...s, from: rn(s.from), to: rn(s.to), editedAt: now }, { from: s.from, to: s.to }] : null);
  const debts = touch("debts", r.kitty.debts, (d) => (is(d.player) ? [{ ...d, player: name, editedAt: now }, { player: d.player }] : null));
  const stakes = touch("stakes", r.kitty.stakes, (s) =>
    s.losers?.some(is) ? [{ ...s, losers: uniqueNames(s.losers.map(rn)), editedAt: now }, { losers: s.losers }] : null);

  return { roster: { matches, teams, infos, kitty: { expenses, settlements, debts, stakes } }, undo };
}

/** Puts back every name the merge changed. Anything added since the merge is left as it is. */
export function undoMerge(r: Roster, u: MergeUndo, now = Date.now()): Roster {
  const matches = r.matches.map((m) => {
    const back = u.matchNames.filter((x) => x.matchId === m.id);
    if (!back.length) return m;
    const teams = m.teams.map((t) => ({
      ...t, players: t.players.map((p) => { const b = back.find((x) => x.playerId === p.id); return b ? { ...p, name: b.name } : p; }),
    })) as Match["teams"];
    return { ...m, teams, editedAt: Math.max(now, (m.editedAt ?? 0) + 1) };
  });

  const teams = r.teams.map((t) => {
    const back = u.teamNames.filter((x) => x.teamId === t.id), dropped = u.teamDropped.filter((x) => x.teamId === t.id);
    if (!back.length && !dropped.length) return t;
    const players = t.players.map((p) => { const b = back.find((x) => x.playerId === p.id); return b ? { ...p, name: b.name } : p; });
    for (const d of [...dropped].sort((a, b) => a.index - b.index)) {
      if (!players.some((p) => p.id === d.player.id)) players.splice(Math.min(d.index, players.length), 0, d.player);
    }
    return { ...t, players };
  });

  const infos = { ...r.infos }, f = key(u.from), i = key(u.into);
  if (u.infos.from) {
    infos[f] = u.infos.from;
    if (u.infos.into) infos[i] = u.infos.into;
    else delete infos[i];
  }

  const back = <T extends { id: string }>(list: keyof Kitty, xs: T[]) => xs.map((x) => {
    const w = u.kitty.find((k) => k.list === list && k.id === x.id);
    return w ? { ...x, ...w.was, editedAt: now } : x;
  });
  const k = r.kitty;
  return {
    matches, teams, infos,
    kitty: { expenses: back("expenses", k.expenses), settlements: back("settlements", k.settlements), debts: back("debts", k.debts), stakes: back("stakes", k.stakes) },
  };
}

/** How many places a merge would touch, for the confirm sheet. */
export function mergeReach(r: Roster, from: string): { matches: number; teams: number; kitty: number } {
  const f = key(from), is = (n: string) => key(n) === f;
  const k = r.kitty;
  return {
    matches: r.matches.filter((m) => m.teams.some((t) => t.players.some((p) => is(p.name)))).length,
    teams: r.teams.filter((t) => t.players.some((p) => is(p.name))).length,
    kitty: k.expenses.filter((e) => is(e.paidBy) || e.split.some(is) || Object.keys(e.custom ?? {}).some(is)).length
      + k.settlements.filter((s) => is(s.from) || is(s.to)).length + k.debts.filter((d) => is(d.player)).length
      + k.stakes.filter((s) => s.losers?.some(is)).length,
  };
}
