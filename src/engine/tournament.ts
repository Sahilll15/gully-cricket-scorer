import { replay, result, uid } from "./engine";
import type { Match, Player, Rules, Side } from "./types";

/** league-final: top 2 to the final. ipl: Qualifier 1, Eliminator, Qualifier 2. semis: 1v4, 2v3. knockout: no league. */
export type CupFormat = "league" | "league-final" | "ipl" | "semis" | "knockout";

export interface SavedTeam { id: string; name: string; players: Player[] }

export interface Fixture {
  id: string;
  a: string;                 // team ids; side 0 of the match is `a`
  b: string;
  round: number;
  stage: "league" | "final" | "q1" | "elim" | "q2" | "semi" | "ko";
  matchId: string | null;
}

export interface Tournament {
  id: string;
  name: string;
  createdAt: number;
  teamIds: string[];
  format: CupFormat;
  rules: Rules;
  fixtures: Fixture[];
}

export interface Standing {
  teamId: string;
  p: number; w: number; l: number; t: number;
  pts: number;
  nrr: number;
  runsFor: number; ballsFaced: number; runsAgainst: number; ballsBowled: number;
}

/** Every team plays every other once, spread over rounds with the circle method. */
export function roundRobin(teamIds: string[]): Fixture[] {
  const ids = [...teamIds];
  if (ids.length % 2) ids.push("");
  const n = ids.length, out: Fixture[] = [];
  for (let r = 0; r < n - 1; r++) {
    for (let i = 0; i < n / 2; i++) {
      const a = ids[i], b = ids[n - 1 - i];
      if (a && b) out.push({ id: uid(), a: r % 2 ? b : a, b: r % 2 ? a : b, round: r + 1, stage: "league", matchId: null });
    }
    ids.splice(1, 0, ids.pop()!);
  }
  return out;
}

export function newTournament(name: string, teamIds: string[], rules: Rules, format: CupFormat): Tournament {
  const fixtures = format === "knockout" ? koRound(teamIds, teamIds, 1, true) : roundRobin(teamIds);
  return { id: uid(), name, createdAt: Date.now(), teamIds, format, rules, fixtures };
}

/** Matches in all, before anyone has played: league plus playoffs, or n - 1 for a knockout. */
export function fixtureCount(format: CupFormat, n: number): number {
  if (format === "knockout") return Math.max(0, n - 1);
  const league = (n * (n - 1)) / 2;
  if (format === "league" || n < 3) return league;
  if (n >= 4 && format === "ipl") return league + 4;
  if (n >= 4 && format === "semis") return league + 3;
  return league + 1;
}

/** IPL and semis need 4 teams; with 3 they fall back to a top-2 final. */
const playoffKind = (t: Tournament) =>
  t.format === "knockout" ? "knockout" : t.format === "league" || t.teamIds.length < 3 ? "none" : t.teamIds.length < 4 ? "league-final" : t.format;

/** Top seed plays the lowest seed left. The first round gives byes to the top seeds so later rounds are a power of two. */
function koRound(entrants: string[], seeds: string[], round: number, first = false): Fixture[] {
  const list = [...entrants].sort((x, y) => seeds.indexOf(x) - seeds.indexOf(y));
  const size = 2 ** Math.ceil(Math.log2(Math.max(2, list.length)));
  const playing = first ? list.slice(size - list.length) : list;
  const stage: Fixture["stage"] = list.length === 2 ? "final" : "ko";
  const out: Fixture[] = [];
  for (let i = 0; i < playing.length / 2; i++) out.push({ id: uid(), a: playing[i], b: playing[playing.length - 1 - i], round, stage, matchId: null });
  return out;
}

const doneMatch = (f: Fixture, matches: Match[]) => matches.find((m) => m.id === f.matchId && m.status === "done");

export function sideOf(f: Fixture, teamId: string): Side { return f.a === teamId ? 0 : 1; }

/** Points: win 2, tie 1. NRR = runs per over scored minus runs per over conceded; all out counts the full quota. */
export function standings(t: Tournament, matches: Match[]): Standing[] {
  const rows = new Map<string, Standing>(t.teamIds.map((id) => [id, { teamId: id, p: 0, w: 0, l: 0, t: 0, pts: 0, nrr: 0, runsFor: 0, ballsFaced: 0, runsAgainst: 0, ballsBowled: 0 }]));
  for (const f of t.fixtures.filter((x) => x.stage === "league")) {
    const m = doneMatch(f, matches);
    if (!m) continue;
    const res = result(m)!;
    for (const id of [f.a, f.b]) {
      const r = rows.get(id)!, side = sideOf(f, id);
      r.p++;
      if (res.winner === null) { r.t++; r.pts += 1; }
      else if (res.winner === side) { r.w++; r.pts += 2; }
      else r.l++;
    }
    for (let i = 0; i < Math.min(2, m.innings.length); i++) {
      const inn = m.innings[i], st = replay(m, i);
      const balls = st.allOut ? inn.overs * 6 : st.legal;
      const bat = inn.bat === 0 ? f.a : f.b, bowl = inn.bat === 0 ? f.b : f.a;
      const rb = rows.get(bat)!, rw = rows.get(bowl)!;
      rb.runsFor += st.runs; rb.ballsFaced += balls;
      rw.runsAgainst += st.runs; rw.ballsBowled += balls;
    }
  }
  for (const r of rows.values()) {
    const forRate = r.ballsFaced ? (r.runsFor * 6) / r.ballsFaced : 0;
    const agRate = r.ballsBowled ? (r.runsAgainst * 6) / r.ballsBowled : 0;
    r.nrr = Math.round((forRate - agRate) * 1000) / 1000;
  }
  return [...rows.values()].sort((x, y) => y.pts - x.pts || y.nrr - x.nrr || y.w - x.w);
}

export const leagueDone = (t: Tournament, matches: Match[]) =>
  t.fixtures.filter((f) => f.stage === "league").every((f) => doneMatch(f, matches));

/** Team order used to break a tie in a playoff: the league table, or the seeding for a knockout. */
function seeding(t: Tournament, matches: Match[]): string[] {
  return t.format === "knockout" ? t.teamIds : standings(t, matches).map((r) => r.teamId);
}

/** Winner and loser of a played fixture. A tie sends the better-placed team through. */
function decided(t: Tournament, f: Fixture | undefined, matches: Match[]): { w: string; l: string } | null {
  const m = f && doneMatch(f, matches);
  if (!f || !m) return null;
  const res = result(m)!;
  let w = res.winner === null ? null : res.winner === 0 ? f.a : f.b;
  if (!w) { const seeds = seeding(t, matches); w = seeds.indexOf(f.a) <= seeds.indexOf(f.b) ? f.a : f.b; }
  return { w, l: w === f.a ? f.b : f.a };
}

/** Adds every playoff fixture the results so far decide. Returns the same object if nothing changes. */
export function advance(t: Tournament, matches: Match[]): Tournament {
  const kind = playoffKind(t);
  if (kind === "none") return t;
  const fx = t.fixtures, has = (s: Fixture["stage"]) => fx.filter((f) => f.stage === s);
  const round = Math.max(0, ...fx.map((f) => f.round)) + 1;
  const add = (a: string, b: string, stage: Fixture["stage"]): Tournament => ({ ...t, fixtures: [...fx, { id: uid(), a, b, round, stage, matchId: null }] });
  if (has("final").length) return t;
  if (kind === "knockout") {
    const last = Math.max(...fx.map((f) => f.round)), cur = fx.filter((f) => f.round === last);
    const res = cur.map((f) => decided(t, f, matches));
    if (res.some((x) => !x)) return t;
    const played = new Set(fx.flatMap((f) => [f.a, f.b]));
    const byes = last === 1 ? t.teamIds.filter((id) => !played.has(id)) : [];
    return { ...t, fixtures: [...fx, ...koRound([...byes, ...res.map((x) => x!.w)], t.teamIds, last + 1)] };
  }
  if (!leagueDone(t, matches)) return t;
  const top = standings(t, matches).map((r) => r.teamId);
  if (kind === "league-final") return add(top[0], top[1], "final");
  if (kind === "semis") {
    const semis = has("semi");
    if (!semis.length) return { ...t, fixtures: [...fx, ...[[0, 3], [1, 2]].map(([a, b]) => ({ id: uid(), a: top[a], b: top[b], round, stage: "semi" as const, matchId: null }))] };
    const [s1, s2] = semis.map((f) => decided(t, f, matches));
    return s1 && s2 ? add(s1.w, s2.w, "final") : t;
  }
  const q1 = has("q1")[0], elim = has("elim")[0];
  if (!q1) return { ...t, fixtures: [...fx, { id: uid(), a: top[0], b: top[1], round, stage: "q1", matchId: null }, { id: uid(), a: top[2], b: top[3], round, stage: "elim", matchId: null }] };
  const d1 = decided(t, q1, matches), de = decided(t, elim, matches), q2 = has("q2")[0];
  if (!q2) return d1 && de ? add(d1.l, de.w, "q2") : t;
  const d2 = decided(t, q2, matches);
  return d1 && d2 ? add(d1.w, d2.w, "final") : t;
}

/** Older code and saved screens call it by its first name. */
export const withFinal = advance;

/** "Qualifier 1", "Semi-final 2", "Quarter-final", "Final". */
export function stageLabel(t: Tournament, f: Fixture): string {
  if (f.stage === "final") return "Final";
  if (f.stage === "q1") return "Qualifier 1";
  if (f.stage === "q2") return "Qualifier 2";
  if (f.stage === "elim") return "Eliminator";
  if (f.stage === "semi") return `Semi-final ${t.fixtures.filter((x) => x.stage === "semi").indexOf(f) + 1}`;
  if (f.stage === "ko") {
    const left = t.fixtures.filter((x) => x.round === f.round).length * 2;
    return left === 4 ? "Semi-final" : left === 8 ? "Quarter-final" : `Round ${f.round}`;
  }
  return `Round ${f.round}`;
}

export function champion(t: Tournament, matches: Match[]): string | null {
  const fin = t.fixtures.find((f) => f.stage === "final");
  if (fin) {
    const m = doneMatch(fin, matches);
    const r = m && result(m);
    return r && r.winner !== null ? (r.winner === 0 ? fin.a : fin.b) : null;
  }
  if (t.format === "league" && leagueDone(t, matches)) return standings(t, matches)[0]?.teamId ?? null;
  return null;
}
