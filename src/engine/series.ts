import { result, uid } from "./engine";
import type { Match, Rules, Side } from "./types";

/** The same two saved teams over a set number of matches, all with the same rules (overs or Test). */
export interface Series { id: string; name: string; createdAt: number; a: string; b: string; games: number; rules: Rules }

export interface SeriesScore {
  a: number; b: number; drawn: number; played: number;
  next: number | null;      // number of the match to start, or null when one is under way or all are played
  current: string | null;   // id of a match still being scored
  winner: Side | null;      // clinched, or ahead once every match is played
  done: boolean;
  text: (names: [string, string]) => string;
}

export function newSeries(name: string, a: string, b: string, games: number, rules: Rules): Series {
  return { id: uid(), name, createdAt: Date.now(), a, b, games, rules };
}

export const seriesMatches = (s: Series, matches: Match[]) =>
  matches.filter((m) => m.series?.id === s.id).sort((x, y) => x.createdAt - y.createdAt);

export function seriesScore(s: Series, matches: Match[]): SeriesScore {
  const list = seriesMatches(s, matches);
  let a = 0, b = 0, drawn = 0;
  for (const m of list) {
    const r = result(m);
    if (!r) continue;
    if (r.winner === 0) a++; else if (r.winner === 1) b++; else drawn++;
  }
  const played = a + b + drawn, done = played >= s.games;
  const current = list.find((m) => m.status !== "done")?.id ?? null;
  const half = s.games / 2;
  const winner: Side | null = a > half ? 0 : b > half ? 1 : done && a !== b ? (a > b ? 0 : 1) : null;
  const text = (names: [string, string]) => {
    const hi = Math.max(a, b), lo = Math.min(a, b);
    if (winner !== null) return `${names[winner]} win the series ${hi}-${lo}`;
    if (done) return `Series drawn ${a}-${b}`;
    if (!played) return `${s.games}-match series`;
    if (a === b) return `Series level ${a}-${b}`;
    return `${names[a > b ? 0 : 1]} lead ${hi}-${lo}`;
  };
  return { a, b, drawn, played, next: current || done ? null : played + 1, current, winner, done, text };
}
