import type { Match } from "../../engine/types";
import {
  bestPlayer, hallOfShame, milestones, overview, playerStreaks, records, teamStreaks,
  type HallOfShame, type MilestoneKind, type PlayerMilestones, type Rated, type Rec, type Records,
} from "../../records";
import { leaders, type Fmt } from "../../stats";

/** Words and summaries for the Gully Book screen, shared by the web and the app. */

export type Section = "overview" | "records" | "milestones" | "shame" | "streaks" | "h2h" | "rivalry";

export const SECTIONS: { v: Section; label: string }[] = [
  { v: "overview", label: "Overview" }, { v: "records", label: "Records" }, { v: "milestones", label: "Milestones" },
  { v: "shame", label: "Hall of shame" }, { v: "streaks", label: "Streaks" }, { v: "h2h", label: "Head to head" }, { v: "rivalry", label: "Rivalry" },
];

const DAY = 86_400_000;

export function dateText(ts: number, now = Date.now()) {
  const d = new Date(ts), sameYear = d.getFullYear() === new Date(now).getFullYear();
  return d.toLocaleDateString("en-IN", sameYear ? { day: "numeric", month: "short" } : { day: "numeric", month: "short", year: "numeric" });
}

export const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

export interface RecordRow { key: keyof Records; label: string; big: (r: Rec) => string | null; who: (r: Rec) => string }

const lead = (r: Rec) => r.text.split(" ")[0];
const num = (r: Rec) => String(r.value);
const name = (r: Rec) => r.name;

export const RECORD_ROWS: RecordRow[] = [
  { key: "highestScore", label: "Highest score", big: lead, who: name },
  { key: "bestBowling", label: "Best bowling", big: (r) => r.text, who: name },
  { key: "mostSixesInnings", label: "Most sixes in an innings", big: num, who: name },
  { key: "highestTotal", label: "Highest team total", big: lead, who: name },
  { key: "lowestAllOut", label: "Lowest all-out total", big: num, who: name },
  { key: "closestFinish", label: "Closest finish", big: () => null, who: name },
  { key: "biggestWinRuns", label: "Biggest win by runs", big: num, who: name },
  { key: "biggestWinWickets", label: "Biggest win by wickets", big: num, who: name },
  { key: "mostRunsInOver", label: "Most runs in an over", big: num, who: (r) => `Bowled by ${r.name}` },
  { key: "biggestCollapse", label: "Biggest collapse", big: num, who: (r) => `${r.name} batting` },
];

/** The record's longer line, left out when it only repeats the big number. */
export const recordDetail = (row: RecordRow, r: Rec) => (row.big(r) === r.text ? null : r.text);

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

export interface ShameGroup { key: keyof HallOfShame; title: string; blurb: string; unit: (n: number) => string; empty: string }

export const SHAME: ShameGroup[] = [
  { key: "ducks", title: "Ducks", blurb: "Walked in, walked back, scoreboard untouched.", unit: (n) => plural(n, "duck"), empty: "Not a single duck yet. Enjoy it while it lasts." },
  { key: "goldenDucks", title: "Golden ducks", blurb: "Out first ball. It happens to the best.", unit: (n) => plural(n, "golden duck"), empty: "Nobody has gone first ball. Yet." },
  { key: "runOutsSuffered", title: "Run out", blurb: "Left stranded halfway down the pitch.", unit: (n) => plural(n, "run out"), empty: "Everyone made their ground so far." },
  { key: "runOutsCaused", title: "Safe while a partner was run out", blurb: "Was at the other end when a partner fell short. Who called it? The app does not know.", unit: (n) => plural(n, "partner"), empty: "No partners left stranded." },
  { key: "extrasBowled", title: "Wides and no-balls", blurb: "Free runs, gift-wrapped.", unit: (n) => plural(n, "extra"), empty: "Line and length all round. Suspiciously disciplined." },
  { key: "expensiveOvers", title: "Most expensive over", blurb: "The over everyone still brings up.", unit: (n) => plural(n, "run"), empty: "No over has gone for runs yet." },
];

/** Why the best player tops the ranking, from the same numbers the rating uses. */
export function bestWhy(matches: Match[], fmt: Fmt, best: Rated): string {
  const l = leaders(matches.filter((m) => m.status === "done"), fmt).find((x) => x.name.toLowerCase() === best.name.toLowerCase());
  if (!l) return `Rating ${best.rating} over ${plural(best.matches, "match", "matches")}`;
  const field = l.catches + l.runOuts + l.stumpings;
  const bits = [plural(l.runs, "run"), plural(l.wickets, "wicket"), l.sixes ? plural(l.sixes, "six", "sixes") : "", field ? plural(field, "dismissal") + " in the field" : ""].filter(Boolean);
  const list = bits.length > 1 ? `${bits.slice(0, -1).join(", ")} and ${bits[bits.length - 1]}` : bits[0];
  return `Rating ${best.rating}: ${list} in ${plural(l.matches, "match", "matches")}`;
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
  const o = overview(matches, fmt), best = bestPlayer(matches, fmt), rec = records(matches, fmt), ms = milestones(matches, fmt);
  return {
    o, best, why: best ? bestWhy(matches, fmt, best) : null, rec, ms, feed: milestoneFeed(ms),
    shame: hallOfShame(matches, fmt), players: playerStreaks(matches, fmt), teams: teamStreaks(matches, teams, fmt),
    summary: shareSummary({ fmt, played: o.played, since: o.first, runs: o.runs, sixes: o.sixes, wickets: o.wickets, ducks: o.ducks, best, records: rec }),
  };
}
export type BookData = ReturnType<typeof bookData>;

export const emptyBook =(fmt: Fmt) => (fmt === "test"
  ? "No Test matches yet. Pick Test match when you set one up and the book starts filling."
  : "No matches yet. Finish one and the runs, records and bragging rights land here.");
