import type { Match } from "./engine/types";
import { records } from "./records";
import { matchTotals } from "./stats";

/** The plain numbers one scorer adds to the world card. No names, no match data. */
export function myStats(matches: Match[]) {
  const t = matchTotals(matches);
  return { matches: matches.length, runs: t.runs, sixes: t.sixes, wickets: t.wickets, best_score: records(matches, "limited").highestScore?.value ?? 0 };
}

export interface GullyWorld { people: number; active7: number; matches: number; runs: number; sixes: number; wickets: number; best: number; reporting: number }
