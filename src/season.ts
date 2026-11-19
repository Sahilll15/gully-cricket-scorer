import type { Match } from "./engine/types";
import type { PlayerGroup } from "./groups";
import { leaders, type Leader } from "./stats";
import { fairTeams, ratingsFor, type FairSplit } from "./records";

const low = (s: string) => s.trim().toLowerCase();
const WEEK = 7 * 24 * 3600 * 1000;

export interface BoardRow extends Leader { points: number }
export type Span = "week" | "all";

/** Same points idea as the match MVP: a run is 1, a wicket 20, a catch, run out or stumping 8. */
const pointsOf = (r: Leader) => r.runs + r.fours + r.sixes * 2 + r.wickets * 20 + (r.catches + r.runOuts + r.stumpings) * 8;

/** The group's players ranked over the matches they played, this week or all time. Players with no matches are left out. */
export function groupBoard(matches: Match[], group: PlayerGroup, span: Span, now = Date.now()): BoardRow[] {
  const inGroup = new Set(group.players.map((p) => low(p.name)));
  const pool = span === "week" ? matches.filter((m) => m.createdAt >= now - WEEK) : matches;
  return leaders(pool, "limited")
    .filter((r) => inGroup.has(low(r.name)))
    .map((r) => ({ ...r, points: pointsOf(r) }))
    .sort((a, b) => b.points - a.points || b.runs - a.runs || a.name.localeCompare(b.name));
}

const link = (base: string) => `Score your own matches free: ${base}`;

/** WhatsApp text for the board: top five with their numbers, plus the app link. */
export function boardText(group: PlayerGroup, rows: BoardRow[], span: Span, base: string): string {
  const head = `${group.name}: ${span === "week" ? "this week" : "all time"} leaderboard`;
  const lines = rows.slice(0, 5).map((r, i) => `${i + 1}. ${r.name}: ${r.runs} runs, ${r.wickets} wkts, ${r.points} pts`);
  return [head, ...(lines.length ? lines : ["No matches yet."]), "", link(base)].join("\n");
}

/** One line a group can send on Sunday: how many matches, and who led. Null if nothing was played. */
export function weeklyNudge(matches: Match[], group: PlayerGroup, base: string, now = Date.now()): string | null {
  const played = matches.filter((m) => m.createdAt >= now - WEEK && m.status === "done");
  const rows = groupBoard(matches, group, "week", now);
  if (!played.length || !rows.length) return null;
  const top = [...rows].sort((a, b) => b.runs - a.runs)[0];
  return `${group.name} played ${played.length} match${played.length === 1 ? "" : "es"} this week. Top scorer: ${top.name} with ${top.runs}.\n${link(base)}`;
}

/** A player's year in one shareable message. Null if they played nothing that year. */
export function recapText(matches: Match[], name: string, year: number, base: string): string | null {
  const pool = matches.filter((m) => new Date(m.createdAt).getFullYear() === year);
  const r = leaders(pool, "limited").find((x) => low(x.name) === low(name));
  if (!r) return null;
  const bits = [`${r.matches} match${r.matches === 1 ? "" : "es"}`, `${r.runs} runs`, `${r.sixes} sixes`, `${r.wickets} wickets`];
  if (r.catches) bits.push(`${r.catches} catches`);
  return `${r.name}'s ${year} on Gully Cricket Scorer: ${bits.join(", ")}.\n${link(base)}`;
}

/** A fair two-way split of the group, reusing the Setup balancer. A new seed gives another close split. */
export function splitGroup(matches: Match[], group: PlayerGroup, seed = 0): FairSplit {
  const names = group.players.map((p) => p.name);
  return fairTeams(names, ratingsFor(matches, names, "limited"), { seed });
}

/** Tonight's "who is in" message to paste into WhatsApp. */
export const pollText = (group: PlayerGroup, when: string, base: string) =>
  `${group.name}: game ${when}? Reply IN or OUT.\n${group.players.map((p) => p.name).join(", ")}\n${link(base)}`;

/** Runs needed after the match is cut short: the first innings total, scaled to the overs left, plus one. */
export function revisedTarget(firstRuns: number, originalOvers: number, newOvers: number): number {
  if (originalOvers <= 0 || newOvers <= 0) return firstRuns + 1;
  return Math.floor((firstRuns * newOvers) / originalOvers) + 1;
}
