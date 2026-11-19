import { result, uid } from "./engine";
import type { Match, Rules, Side } from "./types";

/**
 * The same two saved teams over any number of matches. `games` is an optional plan (null or missing
 * means open) and `rules` are the defaults for the first match; each match sets its own after that.
 */
export interface Series { id: string; name: string; createdAt: number; a: string; b: string; games?: number | null; rules: Rules; ended?: number }

export interface SeriesScore {
  a: number; b: number; drawn: number; played: number;
  planned: number | null;   // planned number of matches, if any
  next: number | null;      // number of the match to start, or null when one is under way or the series is over
  current: string | null;   // id of a match still being scored
  leader: Side | null;      // ahead on wins right now
  clinched: boolean;        // planned length set and one side has won more than half of it
  winner: Side | null;      // only once the series is over, null for a tie
  done: boolean;            // ended by hand, or every planned match played
  text: (names: [string, string]) => string;
  tally: (names: [string, string]) => string;
}

export function newSeries(name: string, a: string, b: string, games: number | null, rules: Rules): Series {
  return { id: uid(), name, createdAt: Date.now(), a, b, games, rules };
}

export const endSeries = (s: Series): Series => ({ ...s, ended: s.ended ?? Date.now() });

export const planned = (s: Series) => (typeof s.games === "number" && s.games > 0 ? s.games : null);

export const seriesMatches = (s: Series, matches: Match[]) =>
  matches.filter((m) => m.series?.id === s.id).sort((x, y) => x.createdAt - y.createdAt);

/** Rules for the next match: the last one played in the series, else the series defaults. */
export const nextRules = (s: Series, matches: Match[]): Rules => {
  const last = seriesMatches(s, matches).at(-1);
  return last ? last.rules : s.rules;
};

export function seriesScore(s: Series, matches: Match[]): SeriesScore {
  const list = seriesMatches(s, matches);
  let a = 0, b = 0, drawn = 0;
  for (const m of list) {
    const r = result(m);
    if (!r) continue;
    if (r.winner === 0) a++; else if (r.winner === 1) b++; else drawn++;
  }
  const played = a + b + drawn, plan = planned(s);
  const current = list.find((m) => m.status !== "done")?.id ?? null;
  const done = !!s.ended || (plan !== null && played >= plan && !current);
  const leader: Side | null = a === b ? null : a > b ? 0 : 1;
  const clinched = plan !== null && (a > plan / 2 || b > plan / 2);
  const winner = done ? leader : null;
  const tally = (names: [string, string]) => `${names[0]} ${a}, ${names[1]} ${b}`;
  const text = (names: [string, string]) => {
    const hi = Math.max(a, b), lo = Math.min(a, b);
    if (done) return winner === null ? `Series tied ${a}-${b}` : `${names[winner]} win the series ${hi}-${lo}`;
    if (clinched && leader !== null) return `${names[leader]} have clinched the series ${hi}-${lo}`;
    if (!played) return plan ? `${plan}-match series` : "Open series";
    if (leader === null) return `Level ${a}-${b}`;
    return `${names[leader]} lead ${hi}-${lo}`;
  };
  return { a, b, drawn, played, planned: plan, next: current || done ? null : played + 1, current, leader, clinched, winner, done, text, tally };
}

export const rulesLabel = (r: Rules) => (r.format === "test" ? `Test${r.matchOvers ? `, ${r.matchOvers} overs max` : ""}` : `${r.overs} over${r.overs === 1 ? "" : "s"}`);

/** "Open series, 2 played" or "Best of 5 planned, 2 played", for lists and the series page. */
export const seriesSub = (s: Series, sc: SeriesScore) => {
  const n = `${sc.played} played`;
  return sc.planned ? `${sc.planned} matches planned · ${n}` : `Open series · ${n}`;
};

/** Body of the confirm sheet for ending a series. */
export function endBody(s: Series, matches: Match[], names: [string, string]) {
  const now = seriesScore(s, matches), after = seriesScore(endSeries(s), matches);
  return `${now.tally(names)}. ${after.text(names)}.${now.current ? " The match in progress will not count." : ""}`;
}
