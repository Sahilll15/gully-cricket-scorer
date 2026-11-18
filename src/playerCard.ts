import * as E from "./engine/engine";
import type { Match } from "./engine/types";
import { ratingsFor } from "./records";
import { average, economy, profile, strikeRate, type Fmt, type Profile } from "./stats";
import { ROLES, type PlayerInfo } from "./playerInfo";

/** Profile filters. Solo is its own kind here, so "limited" means team matches with an over limit. */
export type Kind = "limited" | "test" | "solo";
export const PROFILE_KINDS: { v: Kind; label: string }[] = [{ v: "limited", label: "Limited overs" }, { v: "test", label: "Test" }, { v: "solo", label: "Solo" }];
export const kindOf = (m: Match): Kind => (E.isTest(m) ? "test" : E.isSolo(m) ? "solo" : "limited");
/** Stats code keeps two formats; solo matches are counted as limited overs there. */
export const fmtFor = (k: Kind): Fmt => (k === "test" ? "test" : "limited");
export const kindLabel = (k: Kind) => (k === "test" ? "Test" : k === "solo" ? "solo" : "limited-overs");

const low = (n: string) => n.trim().toLowerCase();
const playedIn = (m: Match, name: string) => m.teams.some((t) => t.players.some((p) => low(p.name) === low(name)));

export const filterMatches = (matches: Match[], kind: Kind, year: number | null) =>
  matches.filter((m) => kindOf(m) === kind && (year === null || new Date(m.createdAt).getFullYear() === year));

/** Kinds this player has played, in PROFILE_KINDS order. */
export const kindsPlayed = (matches: Match[], name: string): Kind[] =>
  PROFILE_KINDS.map((k) => k.v).filter((k) => matches.some((m) => kindOf(m) === k && playedIn(m, name)));

/** Years this player has played in that kind, newest first. */
export const yearsPlayed = (matches: Match[], name: string, kind: Kind): number[] =>
  [...new Set(matches.filter((m) => kindOf(m) === kind && playedIn(m, name)).map((m) => new Date(m.createdAt).getFullYear()))].sort((a, b) => b - a);

// ---------- Skill card ----------

export type Tier = "Bronze" | "Silver" | "Gold" | "Icon";

/** The Gully Book rating, rounded and held to 0 to 99. */
export const skillScore = (rating: number) => (Number.isFinite(rating) ? Math.max(0, Math.min(99, Math.round(rating))) : 0);

export function tierOf(score: number): Tier {
  if (score >= 85) return "Icon";
  if (score >= 70) return "Gold";
  if (score >= 50) return "Silver";
  return "Bronze";
}

export interface SkillCard { name: string; score: number; tier: Tier; role: string; stats: { label: string; value: string }[]; matches: number }

/** Role set on their page, or a guess from where their points come from. */
function roleOf(p: Profile, info: PlayerInfo | undefined): string {
  const set = ROLES.find(([v]) => v === info?.role)?.[1];
  if (set) return set;
  const bat = p.runs, bowl = 20 * p.wickets;
  if (!bat && !bowl) return "Player";
  if (bat > 2 * bowl) return "Batter";
  if (bowl > 2 * bat) return "Bowler";
  return "All-rounder";
}

/** Card for one player from the matches given (already filtered by kind and year). */
export function skillCard(matches: Match[], name: string, kind: Kind, info?: PlayerInfo): SkillCard {
  const fmt = fmtFor(kind), p = profile(matches, name, fmt);
  const score = skillScore(ratingsFor(matches, [name], fmt)[low(name)] ?? 0);
  const role = roleOf(p, info);
  const runs = { label: "Runs", value: String(p.runs) }, wkts = { label: "Wickets", value: String(p.wickets) };
  const sr = { label: "Strike rate", value: strikeRate(p.runs, p.balls).toFixed(0) };
  const stats = role === "Bowler" ? [wkts, { label: "Economy", value: economy(p.conceded, p.legal).toFixed(1) }, { label: "Best", value: p.bowlInnings ? `${p.bestW}/${p.bestR === Infinity ? 0 : p.bestR}` : "-" }]
    : role === "Batter" ? [runs, { label: "Average", value: average(p).toFixed(1) }, sr]
    : role === "Wicketkeeper" ? [runs, { label: "Dismissals", value: String(p.catches + p.stumpings + p.runOuts) }, sr]
    : [runs, wkts, sr];
  return { name: p.name, score, tier: tierOf(score), role, stats, matches: p.matches };
}

export function skillCardText(c: SkillCard): string {
  return [`${c.name}: ${c.score} ${c.tier}`, c.role, c.stats.map((s) => `${s.label} ${s.value}`).join(" · "), "Gully Scorer player card"].join("\n");
}

/** Card accent per tier. Icon uses the app's floodlight lime. */
export const TIER_COLOR: Record<Tier, string> = { Bronze: "#cd8a4f", Silver: "#c9d0d6", Gold: "#f0c75e", Icon: "#ff8a3d" };

/** Opens on the leaderboard's format when they've played it, else the first kind they have. */
export const startKind = (played: Kind[], fmt: Fmt): Kind => (played.includes(fmt) || !played.length ? fmt : played[0]);

export const matchesLine = (n: number, kind: Kind, year: number | null) =>
  n ? `${n} ${kindLabel(kind)} match${n === 1 ? "" : "es"}${year ? ` in ${year}` : ""}` : `No ${kindLabel(kind)} matches${year ? ` in ${year}` : ""} yet`;
