import * as E from "../../engine/engine";
import type { Match } from "../../engine/types";
import {
  bestPlayer, busiestDuel, careerSpeed, finished, ranking, hallOfShame, milestones, overview, playerStreaks, records, teamStreaks,
  type HallOfShame, type MilestoneKind, type PlayerMilestones, type Rated, type Rec, type Records, type ShameRow, type SpeedBoard,
} from "../../records";
import { leaders, type Fmt } from "../../stats";
import { skillScore, tierOf } from "../../playerCard";

/** Words and summaries for the Gully Book screen, shared by the web and the app. */

export type Section = "fame" | "shame" | "streaks" | "rivals" | "milestones";

/** Jump chips, in page order. */
export const SECTIONS: { v: Section; label: string }[] = [
  { v: "fame", label: "Fame" }, { v: "shame", label: "Shame" }, { v: "streaks", label: "Streaks" },
  { v: "rivals", label: "Rivals" }, { v: "milestones", label: "Milestones" },
];

const DAY = 86_400_000;

export function dateText(ts: number, now = Date.now()) {
  const d = new Date(ts), sameYear = d.getFullYear() === new Date(now).getFullYear();
  return d.toLocaleDateString("en-IN", sameYear ? { day: "numeric", month: "short" } : { day: "numeric", month: "short", year: "numeric" });
}

export const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

export interface RecordRow { key: keyof Records; label: string; big: (r: Rec) => string | null; who: (r: Rec) => string; player: boolean }

const lead = (r: Rec) => r.text.split(" ")[0];
const num = (r: Rec) => String(r.value);
const name = (r: Rec) => r.name;

export const RECORD_ROWS: RecordRow[] = [
  { key: "highestScore", label: "Highest score", big: lead, who: name, player: true },
  { key: "bestBowling", label: "Best bowling", big: (r) => r.text, who: name, player: true },
  { key: "mostSixesInnings", label: "Most sixes in an innings", big: num, who: name, player: true },
  { key: "highestTotal", label: "Highest team total", big: lead, who: name, player: false },
  { key: "lowestAllOut", label: "Lowest all-out total", big: num, who: name, player: false },
  { key: "closestFinish", label: "Closest finish", big: () => null, who: name, player: false },
  { key: "biggestWinRuns", label: "Biggest win by runs", big: num, who: name, player: false },
  { key: "biggestWinWickets", label: "Biggest win by wickets", big: num, who: name, player: false },
  { key: "mostRunsInOver", label: "Most runs in an over", big: num, who: (r) => `Bowled by ${r.name}`, player: true },
  { key: "biggestCollapse", label: "Biggest collapse", big: num, who: (r) => `${r.name} batting`, player: false },
];

/** The record's longer line, left out when it only repeats the big number. */
export const recordDetail = (row: RecordRow, r: Rec) => (row.big(r) === r.text ? null : r.text);

export interface RecordGroup { title: string; keys: (keyof Records)[] }

export const RECORD_GROUPS: RecordGroup[] = [
  { title: "Batting", keys: ["highestScore", "mostSixesInnings"] },
  { title: "Bowling", keys: ["bestBowling", "mostRunsInOver"] },
  { title: "Team", keys: ["highestTotal", "lowestAllOut", "closestFinish", "biggestWinRuns", "biggestWinWickets", "biggestCollapse"] },
];

/** Already shown as headline tiles, so the grouped grid skips them. */
export const HERO_RECORD_KEYS: (keyof Records)[] = ["highestScore", "bestBowling"];

export interface RecordTile { row: RecordRow; rec: Rec }

/** Record tiles per group, leaving out records nobody has set and the ones in skip. */
export function recordGroups(rec: Records, skip: (keyof Records)[] = HERO_RECORD_KEYS): { title: string; tiles: RecordTile[] }[] {
  return RECORD_GROUPS.map((g) => ({
    title: g.title,
    tiles: g.keys.filter((k) => !skip.includes(k)).flatMap((k) => {
      const row = RECORD_ROWS.find((r) => r.key === k)!, r = rec[k];
      return r ? [{ row, rec: r }] : [];
    }),
  })).filter((g) => g.tiles.length);
}

const FEED: Record<MilestoneKind, (n: string) => string> = {
  "25": (n) => `${n}'s first 25`,
  "50": (n) => `${n}'s first fifty`,
  "100": (n) => `${n}'s first hundred`,
  "3w": (n) => `${n}'s first three-wicket haul`,
  "5w": (n) => `${n}'s first five-for`,
  hatTrick: (n) => `${n} took a hat-trick`,
  fiveSixesOver: (n) => `${n} hit 5 sixes in one over`,
  thirtyOver: (n) => `${n} took 30 off one over`,
  goldenDuck: (n) => `${n}'s first golden duck`,
  maiden: (n) => `${n}'s first maiden over`,
};

export interface FeedItem { name: string; kind: MilestoneKind; label: string; line: string; matchId: string; date: number; isNew: boolean }

/** Every player's milestones in one list, newest first. New means earned in the last 7 days. */
export function milestoneFeed(rows: PlayerMilestones[], now = Date.now()): FeedItem[] {
  return rows.flatMap((p) => p.items.map((it) => ({
    name: p.name, kind: it.kind, label: it.label, line: FEED[it.kind](p.name), matchId: it.matchId, date: it.date, isNew: now - it.date < 7 * DAY,
  }))).sort((a, b) => b.date - a.date || a.name.localeCompare(b.name));
}

export interface ShameGroup { key: keyof HallOfShame; title: string; blurb: string; unit: (n: number) => string; empty: string; lead: (r: ShameRow) => string }

export const SHAME: ShameGroup[] = [
  { key: "ducks", title: "Ducks", blurb: "Walked in, walked back, scoreboard untouched.", unit: (n) => plural(n, "duck"), empty: "Not a single duck yet. Enjoy it while it lasts.", lead: (r) => `${r.name} leads the duck count with ${plural(r.value, "duck")}.` },
  { key: "goldenDucks", title: "Golden ducks", blurb: "Out first ball. It happens to the best.", unit: (n) => plural(n, "golden duck"), empty: "Nobody has gone first ball. Yet.", lead: (r) => `${r.name} has gone first ball ${plural(r.value, "time")}.` },
  { key: "runOutsSuffered", title: "Run out", blurb: "Left stranded halfway down the pitch.", unit: (n) => plural(n, "run out"), empty: "Everyone made their ground so far.", lead: (r) => `${r.name} has been run out ${plural(r.value, "time")}.` },
  { key: "runOutsCaused", title: "Safe while a partner was run out", blurb: "Was at the other end when a partner fell short. Who called it? The app does not know.", unit: (n) => plural(n, "partner"), empty: "No partners left stranded.", lead: (r) => `${r.name} watched ${plural(r.value, "partner")} walk back.` },
  { key: "extrasBowled", title: "Wides and no-balls", blurb: "Free runs, gift-wrapped.", unit: (n) => plural(n, "extra"), empty: "Line and length all round. Suspiciously disciplined.", lead: (r) => `${r.name} gifted ${plural(r.value, "extra")}.` },
  { key: "expensiveOvers", title: "Most expensive over", blurb: "The over everyone still brings up.", unit: (n) => plural(n, "run"), empty: "No over has gone for runs yet.", lead: (r) => `${r.name} went for ${plural(r.value, "run")} in one over.` },
];

/** The groups shown before "More groups". */
export const SHAME_FIRST: (keyof HallOfShame)[] = ["ducks", "runOutsSuffered", "expensiveOvers"];

/** One roast line for the group's worst entry, or null when nobody is on it yet. */
export const shameLead = (g: ShameGroup, rows: ShameRow[]): string | null => (rows[0] ? g.lead(rows[0]) : null);

/** Why the best player tops the ranking, from the same numbers the rating uses. */
export function bestWhy(matches: Match[], fmt: Fmt, best: Rated): string {
  const l = leaders(matches.filter((m) => m.status === "done"), fmt).find((x) => x.name.toLowerCase() === best.name.toLowerCase());
  if (!l) return `Rating ${best.rating} over ${plural(best.matches, "match", "matches")}`;
  const field = l.catches + l.runOuts + l.stumpings;
  const bits = [plural(l.runs, "run"), plural(l.wickets, "wicket"), l.sixes ? plural(l.sixes, "six", "sixes") : "", field ? plural(field, "dismissal") + " in the field" : ""].filter(Boolean);
  const list = bits.length > 1 ? `${bits.slice(0, -1).join(", ")} and ${bits[bits.length - 1]}` : bits[0];
  return `Rating ${best.rating}: ${list} in ${plural(l.matches, "match", "matches")}`;
}

export type TopMetric = "rating" | "runs" | "wickets" | "sixes";

export const TOP_METRICS: { v: TopMetric; label: string }[] = [
  { v: "rating", label: "Rating" }, { v: "runs", label: "Runs" }, { v: "wickets", label: "Wickets" }, { v: "sixes", label: "Sixes" },
];

export interface TopRow { rank: number; name: string; value: number; sub: string }

/** Ranked players for one metric, best first. Rating is the player card score, the rest are career totals. */
export function topList(matches: Match[], fmt: Fmt, metric: TopMetric, n = 8): TopRow[] {
  if (metric === "rating") {
    return ranking(matches, fmt, 1).slice(0, n).map((r, i) => {
      const score = skillScore(r.rating);
      return { rank: i + 1, name: r.name, value: score, sub: `${tierOf(score)}, ${plural(r.matches, "match", "matches")}` };
    });
  }
  return leaders(matches.filter((m) => m.status === "done"), fmt)
    .map((l) => ({ name: l.name, value: l[metric], matches: l.matches }))
    .filter((l) => l.value > 0)
    .sort((a, b) => b.value - a.value || a.matches - b.matches || a.name.localeCompare(b.name))
    .slice(0, n)
    .map((l, i) => ({ rank: i + 1, name: l.name, value: l.value, sub: plural(l.matches, "match", "matches") }));
}

export interface HeroPick { key: "best" | "highestScore" | "bestBowling" | "fastest"; label: string; big: string; who: string; matchId?: string; player?: string }

/** The headline records: best player, highest score, best bowling and the quickest to a run mark. */
export function heroRecords(best: Rated | null, rec: Records, speed: SpeedBoard[]): HeroPick[] {
  const fast = speed.find((b) => b.rows.length && b.runs === 50) ?? speed.find((b) => b.rows.length);
  const picks: (HeroPick | null)[] = [
    best ? { key: "best", label: "Best player", big: String(skillScore(best.rating)), who: best.name, player: best.name } : null,
    rec.highestScore ? { key: "highestScore", label: "Highest score", big: lead(rec.highestScore), who: rec.highestScore.name, matchId: rec.highestScore.matchId } : null,
    rec.bestBowling ? { key: "bestBowling", label: "Best bowling", big: rec.bestBowling.text, who: rec.bestBowling.name, matchId: rec.bestBowling.matchId } : null,
    fast ? { key: "fastest", label: `Fastest to ${fast.runs}`, big: `${fast.rows[0].balls} balls`, who: fast.rows[0].name, matchId: fast.rows[0].matchId } : null,
  ];
  return picks.filter((p): p is HeroPick => !!p);
}

/** The batter and bowler who have met most often, so head to head opens with an answer. */
export const defaultDuel = (matches: Match[], fmt: Fmt): [string, string] | null => busiestDuel(matches, fmt);

/** The saved-team pair with the most finished games together, else the first two teams. */
export function defaultRivalry(matches: Match[], teams: { name: string }[], fmt: Fmt): [string, string] | null {
  if (teams.length < 2) return null;
  const pool = finished(matches, fmt).filter((m) => !E.isSolo(m)), played = (a: string, b: string) =>
    pool.filter((m) => { const n = m.teams.map((t) => t.name.toLowerCase()); return n.includes(a.toLowerCase()) && n.includes(b.toLowerCase()); }).length;
  let top: [string, string] = [teams[0].name, teams[1].name], topN = -1;
  for (let i = 0; i < teams.length; i++) for (let j = i + 1; j < teams.length; j++) {
    if (teams[i].name.toLowerCase() === teams[j].name.toLowerCase()) continue;
    const c = played(teams[i].name, teams[j].name);
    if (c > topN) { top = [teams[i].name, teams[j].name]; topN = c; }
  }
  return top;
}

export interface Summary { fmt: Fmt; played: number; since: number | null; runs: number; sixes: number; wickets: number; ducks: number; best: Rated | null; records: Records }

/** Short WhatsApp text for the overview's Share button. */
export function shareSummary(s: Summary): string {
  const r = s.records;
  return [
    `Our Gully Book (${s.fmt === "test" ? "Test" : "limited overs"})`,
    `${plural(s.played, "match", "matches")}${s.since ? ` since ${dateText(s.since)}` : ""}`,
    `${plural(s.runs, "run")}, ${plural(s.sixes, "six", "sixes")}, ${plural(s.wickets, "wicket")}, ${plural(s.ducks, "duck")}`,
    s.best ? `Best player: ${s.best.name}, rating ${s.best.rating}` : "",
    r.highestScore ? `Highest score: ${r.highestScore.name} ${r.highestScore.text}` : "",
    r.bestBowling ? `Best bowling: ${r.bestBowling.name} ${r.bestBowling.text}` : "",
    r.highestTotal ? `Highest total: ${r.highestTotal.name} ${r.highestTotal.text}` : "",
  ].filter(Boolean).concat("", "Scored with ai.sahilchalke.com/score").join("\n");
}

/** Everything the book shows for one format. Memoise it on matches, teams and format. */
export function bookData(matches: Match[], teams: { name: string }[], fmt: Fmt) {
  const speed = careerSpeed(matches, fmt), o = overview(matches, fmt), best = bestPlayer(matches, fmt), rec = records(matches, fmt), ms = milestones(matches, fmt);
  return {
    o, speed, tops: Object.fromEntries(TOP_METRICS.map((t) => [t.v, topList(matches, fmt, t.v)])) as Record<TopMetric, TopRow[]>,
    heroes: heroRecords(best, rec, speed), best, why: best ? bestWhy(matches, fmt, best) : null, rec, ms, feed: milestoneFeed(ms),
    shame: hallOfShame(matches, fmt), duel: defaultDuel(matches, fmt), rival: defaultRivalry(matches, teams, fmt), players: playerStreaks(matches, fmt), teams: teamStreaks(matches, teams, fmt),
    summary: shareSummary({ fmt, played: o.played, since: o.first, runs: o.runs, sixes: o.sixes, wickets: o.wickets, ducks: o.ducks, best, records: rec }),
  };
}
export type BookData = ReturnType<typeof bookData>;

export const emptyBook = (fmt: Fmt) => (fmt === "test"
  ? "No Test matches yet. Pick Test match when you set one up and the book starts filling."
  : "No matches yet. Finish one and the runs, records and bragging rights land here.");
