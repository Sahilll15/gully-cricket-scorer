import * as E from "./engine/engine";
import type { Match } from "./engine/types";

export interface Fielding { catches: number; runOuts: number; stumpings: number }
export interface Leader extends Fielding { name: string; matches: number; runs: number; balls: number; sixes: number; fours: number; wickets: number; conceded: number; legal: number; maidens: number }

const AUTO = /^player \d+$/i;

/** Test and limited overs are never added together. Matches saved before Test mode count as limited overs, and so do pairs.
 *  Solo and French matches count as limited overs: each turn is a batting innings. They never win or lose for a team. */
export type Fmt = "limited" | "test";
export const fmtOf = (m: Match): Fmt => (E.isTest(m) ? "test" : "limited");

/** Fielders credited in one innings: catches (c & b too), run outs and stumpings, by player id. */
function fielding(st: E.State): Map<string, Fielding> {
  const out = new Map<string, Fielding>();
  for (const b of st.bat.values()) {
    const f = b.out?.fielder, k = b.out?.kind;
    if (!f) continue;
    const r = out.get(f) ?? { catches: 0, runOuts: 0, stumpings: 0 };
    if (k === "caught" || k === "one-tip catch") r.catches++;
    else if (k === "run out") r.runOuts++;
    else if (k === "stumped") r.stumpings++;
    out.set(f, r);
  }
  return out;
}

/** Career numbers in one format across every saved match, keyed by player name. */
export function leaders(matches: Match[], fmt: Fmt): Leader[] {
  const rows = new Map<string, Leader & { seen: Set<string> }>();
  for (const m of matches.filter((x) => fmtOf(x) === fmt)) {
    m.innings.forEach((_, i) => {
      const st = E.replay(m, i);
      const get = (id: string) => {
        const name = E.playerName(m, id), key = name.toLowerCase();
        if (!rows.has(key)) rows.set(key, { name, matches: 0, runs: 0, balls: 0, sixes: 0, fours: 0, wickets: 0, conceded: 0, legal: 0, maidens: 0, catches: 0, runOuts: 0, stumpings: 0, seen: new Set() });
        const r = rows.get(key)!;
        if (!r.seen.has(m.id)) { r.seen.add(m.id); r.matches++; }
        return r;
      };
      for (const b of st.bat.values()) { const r = get(b.id); r.runs += b.runs; r.balls += b.balls; r.sixes += b.sixes; r.fours += b.fours; }
      for (const w of st.bowl.values()) { const r = get(w.id); r.wickets += w.wickets; r.conceded += w.runs; r.legal += w.legal; r.maidens += w.maidens; }
      for (const [id, f] of fielding(st)) { const r = get(id); r.catches += f.catches; r.runOuts += f.runOuts; r.stumpings += f.stumpings; }
    });
  }
  return [...rows.values()].filter((r) => !AUTO.test(r.name)).map(({ seen: _seen, ...r }) => r);
}

/** Totals across every innings, including players nobody named, for the Home counters. */
export function matchTotals(matches: Match[]) {
  const t = { runs: 0, sixes: 0, wickets: 0 };
  for (const m of matches) m.innings.forEach((_, i) => {
    const st = E.replay(m, i);
    t.runs += st.runs; t.wickets += st.wickets;
    for (const b of st.bat.values()) t.sixes += b.sixes;
  });
  return t;
}

export const strikeRate = (runs: number, balls: number) => (balls ? (runs * 100) / balls : 0);
/** Runs per 6 balls, so careers with 5- or 8-ball overs still add up. */
export const economy = (runs: number, legal: number) => (legal ? (runs * 6) / legal : 0);

export interface Profile extends Fielding {
  name: string; matches: number; maidens: number; wides: number; noBalls: number;
  innings: number; notOuts: number; runs: number; balls: number; best: number; bestNotOut: boolean; fours: number; sixes: number; thirties: number; fifties: number;
  bowlInnings: number; legal: number; conceded: number; wickets: number; bestW: number; bestR: number;
  recent: { matchId: string; date: number; vs: string; bat: string; bowl: string }[];
}

/** One player's career in one format, matched by name. */
export function profile(matches: Match[], name: string, fmt: Fmt): Profile {
  const key = name.toLowerCase();
  const p: Profile = { name, matches: 0, innings: 0, notOuts: 0, runs: 0, balls: 0, best: 0, bestNotOut: false, fours: 0, sixes: 0, thirties: 0, fifties: 0,
    bowlInnings: 0, legal: 0, conceded: 0, wickets: 0, bestW: 0, bestR: Infinity, recent: [], maidens: 0, wides: 0, noBalls: 0, catches: 0, runOuts: 0, stumpings: 0 };
  for (const m of matches.filter((x) => fmtOf(x) === fmt).sort((a, b) => b.createdAt - a.createdAt)) {
    const side = m.teams.findIndex((t) => t.players.some((x) => x.name.toLowerCase() === key));
    if (side < 0) continue;
    const id = m.teams[side].players.find((x) => x.name.toLowerCase() === key)!.id;
    let played = false, bat = "", bowl = "";
    m.innings.forEach((_, i) => {
      const st = E.replay(m, i), b = st.bat.get(id), w = st.bowl.get(id), f = fielding(st).get(id);
      if (f) { played = true; p.catches += f.catches; p.runOuts += f.runOuts; p.stumpings += f.stumpings; }
      if (b) {
        played = true; p.innings++; p.runs += b.runs; p.balls += b.balls; p.fours += b.fours; p.sixes += b.sixes;
        if (!b.out && !b.outs) p.notOuts++;   // pairs: dismissed but batted on still counts as out
        if (b.runs > p.best || (b.runs === p.best && !b.out)) { p.best = b.runs; p.bestNotOut = !b.out; }
        if (b.runs >= 50) p.fifties++; else if (b.runs >= 30) p.thirties++;
        bat = `${bat ? `${bat} & ` : ""}${b.runs}${b.out ? "" : "*"} (${b.balls})`;
      }
      if (w) {
        played = true; p.bowlInnings++; p.legal += w.legal; p.conceded += w.runs; p.wickets += w.wickets;
        p.maidens += w.maidens; p.wides += w.wides; p.noBalls += w.noBalls;
        if (w.wickets > p.bestW || (w.wickets === p.bestW && w.runs < p.bestR)) { p.bestW = w.wickets; p.bestR = w.runs; }
        bowl = `${bowl ? `${bowl} & ` : ""}${w.wickets}/${w.runs}`;
      }
    });
    if (!played) continue;
    p.matches++;
    const vs = E.isSolo(m) ? `Solo with ${m.teams[0].players.length - 1} other${m.teams[0].players.length === 2 ? "" : "s"}` : E.isCommon(m, id) ? `${m.teams[0].name} and ${m.teams[1].name} (common)` : m.teams[side === 0 ? 1 : 0].name;
    if (p.recent.length < 8) p.recent.push({ matchId: m.id, date: m.createdAt, vs, bat, bowl });
  }
  return p;
}

export const bowlAverage = (p: Profile) => (p.wickets ? p.conceded / p.wickets : null);
/** Balls bowled per wicket. */
export const bowlStrikeRate = (p: Profile) => (p.wickets ? p.legal / p.wickets : null);

export const average = (p: Profile) => (p.innings - p.notOuts ? p.runs / (p.innings - p.notOuts) : p.runs);

/** Every named player from saved teams and past matches, most recent match first. */
export function playerPool(matches: Match[], teams: { players: { name: string }[] }[]): string[] {
  const seen = new Set<string>(), out: string[] = [];
  const names = [...matches.flatMap((m) => m.teams.flatMap((t) => t.players)), ...teams.flatMap((t) => t.players)].map((p) => p.name.trim());
  for (const n of names) if (n && !AUTO.test(n) && !seen.has(n.toLowerCase())) { seen.add(n.toLowerCase()); out.push(n); }
  return out;
}
