import * as E from "./engine/engine";
import type { Match, Side } from "./engine/types";
import { contribution, mvp } from "./mvp";

/** What the match and winner posters say. The web draws it on a canvas, the app lays it out and captures it. */

export interface PosterRow { name: string; score: string; sub: string; won: boolean }
export interface Performer { name: string; line: string; points: number }
export interface Poster {
  date: string; format: string; solo: boolean;
  rows: PosterRow[];   // teams first-batting first; solo: standings, best first (up to 4)
  result: string;
  headline: string;   // "Lions win", "Aarav wins", "Match tied", "Match drawn"
  winner: string | null;
  margin: string;   // "by 12 runs", or the solo result line
  performers: Performer[];   // top 3 by MVP points
  star: Performer | null;   // the winning side's best, or the solo winner
  tagline: string;
}

const TAGLINES = [
  "Bragging rights till the next match",
  "Tennis ball, taped up, all heart",
  "Street rules. Real glory.",
  "One tip, one hand, still out",
  "Same lane, same time, rematch?",
  "Gully ka king, for today",
];

const hash = (s: string) => [...s].reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 7);

export const posterDate = (m: Match) =>
  new Date(m.createdAt).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });

function teamRows(m: Match, winner: Side | null): PosterRow[] {
  const first = E.firstBatting(m);
  return ([first, first === 0 ? 1 : 0] as Side[]).map((side) => {
    const name = m.teams[side].name, won = winner === side;
    if (E.isTest(m)) return { name, score: E.sideScore(m, side) ?? "Yet to bat", sub: "", won };
    const i = m.innings.findIndex((inn) => inn.bat === side && !inn.superOver);
    if (i < 0) return { name, score: "Yet to bat", sub: "", won };
    const st = E.replay(m, i);
    return { name, score: `${st.runs}/${st.wickets}`, sub: `${E.oversText(st.legal, st.bpo)} ov`, won };
  });
}

export function poster(m: Match): Poster {
  const res = E.result(m), solo = E.isSolo(m), rows = mvp(m);
  const perf = (r: (typeof rows)[number]): Performer => ({ name: r.name, line: contribution(r), points: r.points });
  let headline: string, winner: string | null = null, margin = "", star: Performer | null = null, list: PosterRow[];

  if (solo) {
    const table = E.soloStandings(m);
    list = table.slice(0, 4).map((r) => ({ name: r.name, score: String(r.runs), sub: `${r.balls} balls`, won: r.id === res?.winnerId }));
    const w = table.find((r) => r.id === res?.winnerId);
    winner = w?.name ?? null;
    const sr = rows.find((r) => r.id === res?.winnerId);
    star = sr ? perf(sr) : null;
    headline = winner ? `${winner} wins` : res?.tie ? "Honours even" : "Match on";
    margin = res?.text ?? "";
  } else {
    const side = res?.winner ?? null;
    list = teamRows(m, side);
    winner = side === null ? null : m.teams[side].name;
    headline = winner ? `${winner} win` : res?.draw ? "Match drawn" : res?.tie ? "Match tied" : "Match on";
    margin = winner && res && res.text.startsWith(`${winner} won `) ? res.text.slice(winner.length + 5) : res?.text ?? "";
    const best = side === null ? null : rows.find((r) => r.side === side || (r.side === null && E.isCommon(m, r.id)));
    star = best ? perf(best) : null;
  }
  return {
    date: posterDate(m), format: E.formatText(m), solo, rows: list, result: res?.text ?? "In progress",
    headline, winner, margin, star, performers: rows.filter((r) => r.points > 0).slice(0, 3).map(perf),
    tagline: TAGLINES[hash(m.id) % TAGLINES.length],
  };
}
