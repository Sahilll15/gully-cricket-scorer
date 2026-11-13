import { replay, result, uid } from "./engine";
import type { Match, Player, Rules, Side } from "./types";

export interface SavedTeam { id: string; name: string; players: Player[] }

export interface Fixture {
  id: string;
  a: string;                 // team ids; side 0 of the match is `a`
  b: string;
  round: number;
  stage: "league" | "final";
  matchId: string | null;
}

export interface Tournament {
  id: string;
  name: string;
  createdAt: number;
  teamIds: string[];
  format: "league" | "league-final";
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

export function newTournament(name: string, teamIds: string[], rules: Rules, format: Tournament["format"]): Tournament {
  return { id: uid(), name, createdAt: Date.now(), teamIds, format, rules, fixtures: roundRobin(teamIds) };
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

/** Adds the final between the top two once the league is over. Returns the same object if nothing changes. */
export function withFinal(t: Tournament, matches: Match[]): Tournament {
  if (t.format !== "league-final" || t.fixtures.some((f) => f.stage === "final") || !leagueDone(t, matches) || t.teamIds.length < 3) return t;
  const [first, second] = standings(t, matches);
  const round = Math.max(...t.fixtures.map((f) => f.round)) + 1;
  return { ...t, fixtures: [...t.fixtures, { id: uid(), a: first.teamId, b: second.teamId, round, stage: "final", matchId: null }] };
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
