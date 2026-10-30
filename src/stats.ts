import * as E from "./engine/engine";
import type { Match } from "./engine/types";

export interface Leader { name: string; matches: number; runs: number; balls: number; sixes: number; fours: number; wickets: number; conceded: number; legal: number }

const AUTO = /^player \d+$/i;

/** Career numbers across every saved match, keyed by player name. */
export function leaders(matches: Match[]): Leader[] {
  const rows = new Map<string, Leader & { seen: Set<string> }>();
  for (const m of matches) {
    m.innings.forEach((_, i) => {
      const st = E.replay(m, i);
      const get = (id: string) => {
        const name = E.playerName(m, id), key = name.toLowerCase();
        if (!rows.has(key)) rows.set(key, { name, matches: 0, runs: 0, balls: 0, sixes: 0, fours: 0, wickets: 0, conceded: 0, legal: 0, seen: new Set() });
        const r = rows.get(key)!;
        if (!r.seen.has(m.id)) { r.seen.add(m.id); r.matches++; }
        return r;
      };
      for (const b of st.bat.values()) { const r = get(b.id); r.runs += b.runs; r.balls += b.balls; r.sixes += b.sixes; r.fours += b.fours; }
      for (const w of st.bowl.values()) { const r = get(w.id); r.wickets += w.wickets; r.conceded += w.runs; r.legal += w.legal; }
    });
  }
  return [...rows.values()].filter((r) => !AUTO.test(r.name)).map(({ seen: _seen, ...r }) => r);
}

export const strikeRate = (runs: number, balls: number) => (balls ? (runs * 100) / balls : 0);
export const economy = (runs: number, legal: number) => (legal ? (runs * 6) / legal : 0);

export interface Profile {
  name: string; matches: number;
  innings: number; notOuts: number; runs: number; balls: number; best: number; bestNotOut: boolean; fours: number; sixes: number; thirties: number; fifties: number;
  bowlInnings: number; legal: number; conceded: number; wickets: number; bestW: number; bestR: number;
  recent: { matchId: string; date: number; vs: string; bat: string; bowl: string }[];
}

/** One player's career across every saved match, matched by name. */
export function profile(matches: Match[], name: string): Profile {
  const key = name.toLowerCase();
  const p: Profile = { name, matches: 0, innings: 0, notOuts: 0, runs: 0, balls: 0, best: 0, bestNotOut: false, fours: 0, sixes: 0, thirties: 0, fifties: 0,
    bowlInnings: 0, legal: 0, conceded: 0, wickets: 0, bestW: 0, bestR: Infinity, recent: [] };
  for (const m of [...matches].sort((a, b) => b.createdAt - a.createdAt)) {
    const side = m.teams.findIndex((t) => t.players.some((x) => x.name.toLowerCase() === key));
    if (side < 0) continue;
    const id = m.teams[side].players.find((x) => x.name.toLowerCase() === key)!.id;
    let played = false, bat = "", bowl = "";
    m.innings.forEach((_, i) => {
      const st = E.replay(m, i), b = st.bat.get(id), w = st.bowl.get(id);
      if (b) {
        played = true; p.innings++; p.runs += b.runs; p.balls += b.balls; p.fours += b.fours; p.sixes += b.sixes;
        if (!b.out) p.notOuts++;
        if (b.runs > p.best || (b.runs === p.best && !b.out)) { p.best = b.runs; p.bestNotOut = !b.out; }
        if (b.runs >= 50) p.fifties++; else if (b.runs >= 30) p.thirties++;
        bat = `${b.runs}${b.out ? "" : "*"} (${b.balls})`;
      }
      if (w) {
        played = true; p.bowlInnings++; p.legal += w.legal; p.conceded += w.runs; p.wickets += w.wickets;
        if (w.wickets > p.bestW || (w.wickets === p.bestW && w.runs < p.bestR)) { p.bestW = w.wickets; p.bestR = w.runs; }
        bowl = `${w.wickets}/${w.runs}`;
      }
    });
    if (!played) continue;
    p.matches++;
    const vs = E.isCommon(m, id) ? `${m.teams[0].name} and ${m.teams[1].name} (common)` : m.teams[side === 0 ? 1 : 0].name;
    if (p.recent.length < 8) p.recent.push({ matchId: m.id, date: m.createdAt, vs, bat, bowl });
  }
  return p;
}

export const average = (p: Profile) => (p.innings - p.notOuts ? p.runs / (p.innings - p.notOuts) : p.runs);
