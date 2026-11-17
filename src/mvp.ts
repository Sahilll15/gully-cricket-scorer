import * as E from "./engine/engine";
import type { Match, Side } from "./engine/types";

/** MVP points: 1 a run, +1 a four, +2 a six, 20 a wicket, 8 a catch, run out or stumping, and up to 10 each
 *  for batting faster or bowling cheaper than the match's own run rate (from 6 balls faced or bowled). */
export const POINTS = { run: 1, four: 1, six: 2, wicket: 20, catch: 8, runOut: 8, stumping: 8, bonusCap: 10, minBalls: 6 } as const;

export interface MvpRow {
  id: string; name: string;
  side: Side | null;   // null for a common player and in solo
  runs: number; balls: number; fours: number; sixes: number;
  wickets: number; conceded: number; legal: number;
  catches: number; runOuts: number; stumpings: number;
  batting: number; bowling: number; fielding: number; points: number;
}

const round1 = (n: number) => Math.round(n * 10) / 10;
const clamp = (n: number, hi: number) => Math.max(0, Math.min(hi, n));

/** Runs per over across the whole match so far. Null before a legal ball. */
export function matchPace(m: Match): number | null {
  let runs = 0, legal = 0;
  m.innings.forEach((_, i) => { const st = E.replay(m, i); runs += st.runs; legal += st.legal; });
  return legal ? (runs * E.ballsPerOver(m.rules)) / legal : null;
}

function sideOf(m: Match, id: string): Side | null {
  if (E.isSolo(m) || E.isCommon(m, id)) return null;
  return m.teams[0].players.some((p) => p.id === id) ? 0 : m.teams[1].players.some((p) => p.id === id) ? 1 : null;
}

/** Everyone who batted, bowled or fielded, best first. Updates ball by ball, so it works on a live match too. */
export function mvp(m: Match): MvpRow[] {
  const rows = new Map<string, MvpRow>();
  const get = (id: string) => {
    let r = rows.get(id);
    if (!r) {
      r = { id, name: E.playerName(m, id), side: sideOf(m, id), runs: 0, balls: 0, fours: 0, sixes: 0, wickets: 0, conceded: 0, legal: 0,
        catches: 0, runOuts: 0, stumpings: 0, batting: 0, bowling: 0, fielding: 0, points: 0 };
      rows.set(id, r);
    }
    return r;
  };
  m.innings.forEach((inn, i) => {
    const st = E.replay(m, i);
    for (const b of st.bat.values()) {
      if (!b.balls && !b.runs && !b.out) continue;
      const r = get(b.id); r.runs += b.runs; r.balls += b.balls; r.fours += b.fours; r.sixes += b.sixes;
    }
    for (const w of st.bowl.values()) { const r = get(w.id); r.wickets += w.wickets; r.conceded += w.runs; r.legal += w.legal; }
    // Read fielding off the balls: a solo life lost to a catch never reaches the batter's card.
    for (const e of inn.events) {
      const f = e.t === "ball" ? e.wicket : undefined;
      if (!f?.fielderId) continue;
      const r = get(f.fielderId);
      if (f.kind === "caught" || f.kind === "one-tip catch") r.catches++;
      else if (f.kind === "run out") r.runOuts++;
      else if (f.kind === "stumped") r.stumpings++;
    }
  });
  const pace = matchPace(m), bpo = E.ballsPerOver(m.rules);
  for (const r of rows.values()) {
    let bat = r.runs * POINTS.run + r.fours * POINTS.four + r.sixes * POINTS.six;
    if (pace !== null && r.balls >= POINTS.minBalls) bat += clamp(((r.runs * 100) / r.balls - (pace * 100) / bpo) / 10, POINTS.bonusCap);
    let bowl = r.wickets * POINTS.wicket;
    if (pace !== null && r.legal >= POINTS.minBalls) bowl += clamp(2 * (pace - (r.conceded * bpo) / r.legal), POINTS.bonusCap);
    r.batting = round1(bat); r.bowling = round1(bowl);
    r.fielding = r.catches * POINTS.catch + r.runOuts * POINTS.runOut + r.stumpings * POINTS.stumping;
    r.points = round1(bat + bowl + r.fielding);
  }
  return [...rows.values()].sort((a, b) => b.points - a.points || b.runs - a.runs || b.wickets - a.wickets || a.name.localeCompare(b.name));
}

const plural = (n: number, w: string, ws = `${w}s`) => `${n} ${n === 1 ? w : ws}`;
const oversWord = (legal: number, bpo: number) => (legal % bpo ? `${E.oversText(legal, bpo)} overs` : plural(legal / bpo, "over"));

/** "42 off 20, 2 for 15, 1 catch": what a player did, for an award line. */
export function contribution(r: MvpRow): string {
  const parts: string[] = [];
  if (r.balls || r.runs) parts.push(`${r.runs} off ${r.balls}`);
  if (r.wickets || r.legal) parts.push(`${r.wickets} for ${r.conceded}`);
  if (r.catches) parts.push(plural(r.catches, "catch", "catches"));
  if (r.runOuts) parts.push(plural(r.runOuts, "run out"));
  if (r.stumpings) parts.push(plural(r.stumpings, "stumping"));
  return parts.join(", ") || "Played";
}

export type AwardKey = "potm" | "hitter" | "wickets" | "economy" | "catches";
export interface MatchAward { key: AwardKey; title: string; id: string; name: string; line: string }

export const AWARD_TITLES: Record<AwardKey, string> = {
  potm: "Player of the match", hitter: "Super hitter", wickets: "Wicket taker", economy: "Economy king", catches: "Safe hands",
};

function best<T>(list: T[], key: (x: T) => number[]): T | null {
  let top: T | null = null, k: number[] = [];
  for (const x of list) {
    const v = key(x), i = v.findIndex((n, j) => n !== k[j]);
    if (top === null || (i >= 0 && v[i] > k[i])) { top = x; k = v; }
  }
  return top;
}

/** The five match awards, each with a one-line reason. An award nobody earned (no sixes, say) is left out. */
export function matchAwards(m: Match, rows = mvp(m)): MatchAward[] {
  const out: MatchAward[] = [], bpo = E.ballsPerOver(m.rules);
  const add = (key: AwardKey, r: MvpRow | null, line: (r: MvpRow) => string) => {
    if (r) out.push({ key, title: AWARD_TITLES[key], id: r.id, name: r.name, line: line(r) });
  };
  add("potm", rows[0] && rows[0].points > 0 ? rows[0] : null, (r) => `${contribution(r)} · ${r.points} points`);
  add("hitter", best(rows.filter((r) => r.sixes), (r) => [r.sixes, -r.balls, r.runs]),
    (r) => `${plural(r.sixes, "six", "sixes")} in ${r.runs} off ${r.balls}`);
  add("wickets", best(rows.filter((r) => r.wickets), (r) => [r.wickets, -r.conceded, -r.legal]),
    (r) => `${r.wickets} for ${r.conceded} in ${oversWord(r.legal, bpo)}`);
  add("economy", best(rows.filter((r) => r.legal >= POINTS.minBalls), (r) => [-r.conceded / r.legal, r.legal]),
    (r) => `${((r.conceded * bpo) / r.legal).toFixed(1)} an over across ${oversWord(r.legal, bpo)}`);
  add("catches", best(rows.filter((r) => r.catches), (r) => [r.catches, r.runOuts + r.stumpings]),
    (r) => `${plural(r.catches, "catch", "catches")} held${r.runOuts ? `, ${plural(r.runOuts, "run out")}` : ""}`);
  return out;
}

/** Player of the match by MVP points, with the same line the Result screen shows. */
export const playerOfTheMatch = (m: Match): MatchAward | null => matchAwards(m).find((a) => a.key === "potm") ?? null;
