import { oversText } from "./engine/engine";
import type { Match } from "./engine/types";
import { economy, leaders, strikeRate, type Fmt } from "./stats";

const HEAD = ["Player", "Matches", "Runs", "Balls", "Strike rate", "Fours", "Sixes", "Wickets", "Overs", "Runs conceded", "Economy", "Maidens", "Catches", "Run outs", "Stumpings"];

/** One CSV cell. A leading = + - @ is quoted away so a spreadsheet never runs a name as a formula. */
export function cell(v: string | number): string {
  let s = String(v);
  if (typeof v === "string" && /^[=+\-@]/.test(s)) s = `'${s}`;
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

/** Every player's numbers in one format, most runs first, as a CSV file's text. */
export function statsCsv(matches: Match[], fmt: Fmt): string {
  const rows = leaders(matches, fmt).sort((a, b) => b.runs - a.runs || b.wickets - a.wickets || a.name.localeCompare(b.name));
  const lines = rows.map((r) => [
    r.name, r.matches, r.runs, r.balls, strikeRate(r.runs, r.balls).toFixed(1), r.fours, r.sixes, r.wickets, oversText(r.legal), r.conceded,
    economy(r.conceded, r.legal).toFixed(2), r.maidens, r.catches, r.runOuts, r.stumpings,
  ].map(cell).join(","));
  return [HEAD.join(","), ...lines].join("\r\n") + "\r\n";
}

export const csvName = (fmt: Fmt, now = Date.now()) =>
  `gully-stats-${fmt === "test" ? "test" : "limited-overs"}-${new Date(now).toISOString().slice(0, 10)}.csv`;
