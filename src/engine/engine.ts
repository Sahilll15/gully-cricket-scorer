import type { Ball, BallInput, Ev, Innings, Match, Player, Rules, Side, Team } from "./types";

export interface BatStat { id: string; runs: number; balls: number; fours: number; sixes: number; out: { kind: string; bowler: string } | null; retired?: boolean }
export interface BowlStat { id: string; legal: number; runs: number; wickets: number; maidens: number; wides: number; noBalls: number }
export interface Fow { score: number; wicket: number; over: string; id: string }

export interface State {
  runs: number;
  wickets: number;
  legal: number;
  extras: { wd: number; nb: number; b: number; lb: number };
  striker: string | null;
  nonStriker: string | null;
  bat: Map<string, BatStat>;
  bowl: Map<string, BowlStat>;
  order: string[];          // batters in the order they came in
  bowlOrder: string[];
  overs: Ball[][];
  freeHit: boolean;
  fow: Fow[];
  lastOverBowler: string | null;
  ended: boolean;
}

export const otherSide = (s: Side): Side => (s === 0 ? 1 : 0);
export const oversText = (legal: number) => `${Math.floor(legal / 6)}.${legal % 6}`;
export const runRate = (runs: number, legal: number) => (legal ? (runs * 6) / legal : 0);
export const uid = () => Math.random().toString(36).slice(2, 10);

export const isLegal = (b: Ball, rules: Rules) =>
  !(b.extra === "wd" || b.extra === "nb") || !rules.rebowl;
export const extraPenalty = (b: Ball, rules: Rules) =>
  (b.extra === "wd" || b.extra === "nb") && rules.extraRun ? 1 : 0;
export const ballTotal = (b: Ball, rules: Rules) => b.runs + extraPenalty(b, rules);

export function playerName(m: Match, id: string | null): string {
  if (!id) return "";
  for (const t of m.teams) for (const p of t.players) if (p.id === id) return p.name;
  return "Unknown";
}

/** Common players are on both teams under the same id: they bat for both and bowl for either. */
export const isCommon = (m: Match, id: string) => m.teams.every((t) => t.players.some((p) => p.id === id));

export const wicketLimit = (team: Team, rules: Rules, solo = false) =>
  Math.max(1, rules.lastManStands || solo ? team.players.length : team.players.length - 1);

export function replay(m: Match, idx: number): State {
  const inn = m.innings[idx], r = m.rules;
  const bat = new Map<string, BatStat>(), bowl = new Map<string, BowlStat>();
  const order: string[] = [], bowlOrder: string[] = [];
  const addBat = (id: string | null) => {
    if (id && !bat.has(id)) { bat.set(id, { id, runs: 0, balls: 0, fours: 0, sixes: 0, out: null }); order.push(id); }
  };
  const getBowl = (id: string) => {
    if (!bowl.has(id)) { bowl.set(id, { id, legal: 0, runs: 0, wickets: 0, maidens: 0, wides: 0, noBalls: 0 }); bowlOrder.push(id); }
    return bowl.get(id)!;
  };
  const st: State = {
    runs: 0, wickets: 0, legal: 0, extras: { wd: 0, nb: 0, b: 0, lb: 0 },
    striker: inn.striker, nonStriker: inn.nonStriker, bat, bowl, order, bowlOrder,
    overs: [], freeHit: false, fow: [], lastOverBowler: null, ended: false,
  };
  addBat(st.striker); addBat(st.nonStriker);
  let overConceded = 0;

  for (const e of inn.events) {
    if (e.t === "swap") { if (st.nonStriker) [st.striker, st.nonStriker] = [st.nonStriker, st.striker]; continue; }
    if (e.t === "retire") {
      const b = bat.get((e.out === "s" ? st.striker : st.nonStriker) ?? "");
      if (b) b.retired = true;
      addBat(e.newId);
      if (e.out === "s") st.striker = e.newId; else st.nonStriker = e.newId;
      if (!st.striker && st.nonStriker) { st.striker = st.nonStriker; st.nonStriker = null; }
      continue;
    }
    const legal = isLegal(e, r), pen = extraPenalty(e, r), total = e.runs + pen;
    const overIdx = Math.floor(st.legal / 6);
    (st.overs[overIdx] ||= []).push(e);
    st.runs += total;

    const bw = getBowl(e.bowler);
    const striker = st.striker ? bat.get(st.striker)! : null;
    if (e.extra === "wd") { st.extras.wd += total; bw.runs += total; bw.wides++; overConceded += total; }
    else if (e.extra === "nb") {
      st.extras.nb += pen; bw.runs += total; bw.noBalls++; overConceded += total;
      if (striker) { striker.runs += e.runs; striker.balls++; countBoundary(striker, e.runs); }
    } else if (e.extra === "b" || e.extra === "lb") {
      st.extras[e.extra] += e.runs;
      if (striker) striker.balls++;
    } else {
      bw.runs += e.runs; overConceded += e.runs;
      if (striker) { striker.runs += e.runs; striker.balls++; countBoundary(striker, e.runs); }
    }
    if (legal) { st.legal++; bw.legal++; }

    // Batters cross on odd runs actually run; boundaries are even anyway.
    if (e.runs % 2 === 1 && st.nonStriker) [st.striker, st.nonStriker] = [st.nonStriker, st.striker];

    if (e.wicket) {
      const w = e.wicket;
      const outId = w.out === "s" ? st.striker : st.nonStriker;
      st.wickets++;
      if (w.kind !== "run out") bw.wickets++;
      if (outId) {
        const b = bat.get(outId);
        if (b) b.out = { kind: w.kind, bowler: e.bowler };
        st.fow.push({ score: st.runs, wicket: st.wickets, over: oversText(st.legal), id: outId });
      }
      addBat(w.newId);
      if (w.out === "s") st.striker = w.newId; else st.nonStriker = w.newId;
      if (!st.striker && st.nonStriker) { st.striker = st.nonStriker; st.nonStriker = null; }
    }

    if (legal && st.legal % 6 === 0) {
      if (overConceded === 0 && st.overs[overIdx].every((b) => b.bowler === e.bowler)) bw.maidens++;
      overConceded = 0;
      st.lastOverBowler = e.bowler;
      if (st.nonStriker) [st.striker, st.nonStriker] = [st.nonStriker, st.striker];
    }
    st.freeHit = r.freeHit && (e.extra === "nb" || (e.extra === "wd" && st.freeHit));
  }

  const tgt = target(m, idx);
  st.ended = inn.closed || !st.striker || st.legal >= inn.overs * 6 || st.wickets >= inn.wicketLimit ||
    (tgt !== null && st.runs >= tgt);
  return st;
}

function countBoundary(b: BatStat, runs: number) {
  if (runs === 4) b.fours++;
  if (runs === 6) b.sixes++;
}

export function target(m: Match, idx: number): number | null {
  if (idx % 2 === 0) return null;
  return replay(m, idx - 1).runs + 1;
}

export function needsBowler(m: Match, idx: number): boolean {
  const st = replay(m, idx), inn = m.innings[idx];
  if (st.ended || st.legal === 0 || st.legal % 6 !== 0) return false;
  // Undo across an over can leave last over's bowler in place with a matching count, so check who is bowling too.
  return inn.bowlerSetAt !== st.legal || !canBowl(m, idx, inn.bowler);
}

export function canBowl(m: Match, idx: number, id: string): boolean {
  const st = replay(m, idx), max = m.rules.maxOversPerBowler;
  if (id === st.striker || id === st.nonStriker) return false;
  // Whoever bowled the last over can't bowl any part of this one, mid-over changes included.
  if (id === st.lastOverBowler && m.teams[otherSide(m.innings[idx].bat)].players.length > 1) return false;
  const b = st.bowl.get(id);
  return !(max && b && Math.floor(b.legal / 6) >= max);
}

export function yetToBat(m: Match, idx: number): Player[] {
  const st = replay(m, idx), inn = m.innings[idx];
  const left = m.teams[inn.bat].players.filter((p) => !st.bat.has(p.id));
  // A common player who is bowling cannot walk in to bat, unless he is the only one left.
  const notBowling = left.filter((p) => p.id !== inn.bowler);
  return notBowling.length ? notBowling : left;
}

const clone = (m: Match): Match => JSON.parse(JSON.stringify(m));

export function startInnings(m: Match, striker: string, nonStriker: string | null, bowler: string): Match {
  const n = clone(m), idx = n.innings.length;
  const superOver = idx >= 2;
  const bat: Side = idx === 0 ? firstBatting(n) : idx === 2 ? n.innings[1].bat : otherSide(n.innings[idx - 1].bat);
  n.innings.push({
    bat, overs: superOver ? 1 : n.rules.overs,
    wicketLimit: superOver ? Math.min(2, wicketLimit(n.teams[bat], n.rules)) : wicketLimit(n.teams[bat], n.rules, !nonStriker),
    superOver, striker, nonStriker, solo: !nonStriker, bowler, bowlerSetAt: 0, events: [], closed: false,
  });
  n.status = "live";
  return n;
}

export function firstBatting(m: Match): Side {
  if (!m.toss) return 0;
  return m.toss.choice === "bat" ? m.toss.winner : otherSide(m.toss.winner);
}

export function nextBattingSide(m: Match): Side {
  const idx = m.innings.length;
  if (idx === 0) return firstBatting(m);
  if (idx === 2) return m.innings[1].bat;
  return otherSide(m.innings[idx - 1].bat);
}

function settle(n: Match): Match {
  const idx = n.innings.length - 1;
  if (idx < 0) return n;
  const st = replay(n, idx);
  if (!st.ended) n.status = "live";
  else n.status = idx % 2 === 0 ? "break" : "done";
  return n;
}

export function addBall(m: Match, input: BallInput): Match {
  const n = clone(m), inn = n.innings[n.innings.length - 1];
  if (n.status !== "live") return m;
  inn.events.push({ t: "ball", ...input, bowler: inn.bowler });
  return settle(n);
}

export function swapStrike(m: Match): Match {
  const n = clone(m);
  n.innings[n.innings.length - 1].events.push({ t: "swap" });
  return n;
}

export function retire(m: Match, out: "s" | "ns", newId: string | null): Match {
  const n = clone(m);
  n.innings[n.innings.length - 1].events.push({ t: "retire", out, newId });
  return settle(n);
}

/** Fewest overs the match can be cut to now: the current innings can't drop below balls already bowled. */
export function minOvers(m: Match): number {
  const idx = m.innings.length - 1, inn = m.innings[idx];
  if (!inn || inn.superOver || m.status === "break") return 1;
  return Math.max(1, Math.ceil(replay(m, idx).legal / 6));
}

/** Changes the overs for the rest of the match, like a gully game cut short when it gets dark. */
export function setOvers(m: Match, overs: number): Match {
  const n = clone(m), inn = n.innings[n.innings.length - 1];
  n.rules.overs = overs;
  if (n.rules.maxOversPerBowler) n.rules.maxOversPerBowler = Math.min(n.rules.maxOversPerBowler, overs);
  if (inn && !inn.superOver && n.status === "live") inn.overs = Math.max(overs, minOvers(m));
  return settle(n);
}

export function setBowler(m: Match, id: string): Match {
  const n = clone(m), idx = n.innings.length - 1;
  n.innings[idx].bowler = id;
  n.innings[idx].bowlerSetAt = replay(n, idx).legal;
  return n;
}

export function closeInnings(m: Match): Match {
  const n = clone(m);
  n.innings[n.innings.length - 1].closed = true;
  return settle(n);
}

/** Removes the last event, stepping back into the previous innings if this one is empty. */
export function undo(m: Match): { match: Match; popped: Ev | null; droppedInnings: Innings | null } {
  const n = clone(m);
  let dropped: Innings | null = null;
  const inn = n.innings[n.innings.length - 1];
  if (!inn) return { match: m, popped: null, droppedInnings: null };
  if (inn.closed) { inn.closed = false; return { match: settle(n), popped: null, droppedInnings: null }; }
  if (!inn.events.length) {
    if (n.innings.length === 1) return { match: m, popped: null, droppedInnings: null };
    dropped = n.innings.pop()!;
    return { match: settle(n), popped: null, droppedInnings: dropped };
  }
  const popped = inn.events.pop() ?? null;
  if (popped?.t === "ball") inn.bowler = popped.bowler;
  return { match: settle(n), popped, droppedInnings: dropped };
}

export function redo(m: Match, ev: Ev): Match {
  const n = clone(m), inn = n.innings[n.innings.length - 1];
  if (ev.t === "ball") { inn.bowler = ev.bowler; return addBall(n, { runs: ev.runs, extra: ev.extra, wicket: ev.wicket }); }
  if (ev.t === "retire") return retire(n, ev.out, ev.newId);
  return swapStrike(n);
}

/** Corrects runs or extras of a past ball. Wickets stay as recorded. */
export function editBall(m: Match, idx: number, evIdx: number, patch: { runs: number; extra?: Ball["extra"] }): Match {
  const n = clone(m), ev = n.innings[idx].events[evIdx];
  if (!ev || ev.t !== "ball") return m;
  ev.runs = patch.runs;
  if (patch.extra) ev.extra = patch.extra; else delete ev.extra;
  return settle(n);
}

export interface Result { text: string; winner: Side | null; tie: boolean; superOver: boolean }

export function result(m: Match): Result | null {
  if (m.status !== "done") return null;
  const base = m.innings.length >= 4 ? 2 : 0;
  const a = replay(m, base), b = replay(m, base + 1);
  const first = m.innings[base].bat, second = m.innings[base + 1].bat;
  const so = base === 2 ? " (super over)" : "";
  if (b.runs > a.runs) {
    const left = m.innings[base + 1].wicketLimit - b.wickets;
    return { text: `${m.teams[second].name} won by ${left} wicket${left === 1 ? "" : "s"}${so}`, winner: second, tie: false, superOver: !!so };
  }
  if (a.runs > b.runs) {
    const by = a.runs - b.runs;
    return { text: `${m.teams[first].name} won by ${by} run${by === 1 ? "" : "s"}${so}`, winner: first, tie: false, superOver: !!so };
  }
  return { text: base === 2 ? "Super over tied too. Shake hands." : "Match tied", winner: null, tie: true, superOver: !!so };
}

export interface Award { id: string; name: string; line: string; points: number }

export function awards(m: Match) {
  const rows = new Map<string, { runs: number; balls: number; wickets: number; conceded: number; sixes: number; side: Side }>();
  m.innings.forEach((inn, i) => {
    const st = replay(m, i);
    for (const b of st.bat.values()) {
      const r = rows.get(b.id) ?? { runs: 0, balls: 0, wickets: 0, conceded: 0, sixes: 0, side: inn.bat };
      r.runs += b.runs; r.balls += b.balls; r.sixes += b.sixes; rows.set(b.id, r);
    }
    for (const w of st.bowl.values()) {
      const r = rows.get(w.id) ?? { runs: 0, balls: 0, wickets: 0, conceded: 0, sixes: 0, side: otherSide(inn.bat) };
      r.wickets += w.wickets; r.conceded += w.runs; rows.set(w.id, r);
    }
  });
  const res = result(m);
  const list = [...rows.entries()].map(([id, r]) => ({ id, ...r, name: playerName(m, id) }));
  const won = (r: (typeof list)[number]) => res?.winner != null && (res.winner === r.side || isCommon(m, r.id));
  const points = (r: (typeof list)[number]) => r.runs + r.wickets * 20 + r.sixes * 2 + (won(r) ? 10 : 0);
  const potm = [...list].sort((x, y) => points(y) - points(x))[0];
  const top = [...list].sort((x, y) => y.runs - x.runs || x.balls - y.balls)[0];
  const best = [...list].filter((r) => r.wickets > 0).sort((x, y) => y.wickets - x.wickets || x.conceded - y.conceded)[0];
  return {
    potm: potm && { id: potm.id, name: potm.name, line: line(potm), points: points(potm) },
    topScorer: top && top.runs > 0 ? { id: top.id, name: top.name, line: `${top.runs} (${top.balls})`, points: top.runs } : null,
    bestBowler: best ? { id: best.id, name: best.name, line: `${best.wickets}/${best.conceded}`, points: best.wickets } : null,
  };
}

function line(r: { runs: number; balls: number; wickets: number; conceded: number }) {
  const parts = [];
  if (r.balls || r.runs) parts.push(`${r.runs} (${r.balls})`);
  if (r.wickets) parts.push(`${r.wickets}/${r.conceded}`);
  return parts.join(" & ") || "Played";
}

export function newMatch(teams: [Team, Team], rules: Rules): Match {
  return { id: uid(), createdAt: Date.now(), teams, rules, toss: null, innings: [], status: "setup" };
}

export function ballLabel(b: Ball): string {
  const w = b.wicket ? "W" : "";
  if (b.extra === "wd") return `Wd${b.runs ? "+" + b.runs : ""}${w ? " " + w : ""}`;
  if (b.extra === "nb") return `Nb${b.runs ? "+" + b.runs : ""}${w ? " " + w : ""}`;
  if (b.extra === "b") return `${b.runs}B${w ? " " + w : ""}`;
  if (b.extra === "lb") return `${b.runs}LB${w ? " " + w : ""}`;
  if (w) return b.runs ? `${b.runs} W` : "W";
  return b.runs === 0 ? "•" : String(b.runs);
}
