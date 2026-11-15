import type { Ball, BallInput, Ev, Innings, Match, Player, Rules, Side, Team } from "./types";

export interface BatStat { id: string; runs: number; balls: number; fours: number; sixes: number; out: { kind: string; bowler: string; fielder?: string } | null; retired?: boolean }
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
  allOut: boolean;
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

/** How a batter's innings ended, as a scorecard shows it. */
export function howOut(m: Match, b: BatStat): string {
  const o = b.out;
  if (b.retired) return "retired not out";
  if (!o) return "not out";
  const by = o.fielder ? playerName(m, o.fielder) : null, bw = playerName(m, o.bowler);
  if (o.kind === "run out") return by ? `run out (${by})` : "run out";
  if (o.kind === "wall out") return o.kind;
  if (o.kind === "bowled") return `b ${bw}`;
  if (by && o.kind === "caught") return o.fielder === o.bowler ? `c & b ${bw}` : `c ${by} b ${bw}`;
  if (by && o.kind === "stumped") return `st ${by} b ${bw}`;
  if (by) return `${o.kind} (${by}), b ${bw}`;
  return `${o.kind}, b ${bw}`;
}

/** Common players are on both teams under the same id: they bat for both and bowl for either. */
export const isCommon = (m: Match, id: string) => m.teams.every((t) => t.players.some((p) => p.id === id));

export const wicketLimit = (team: Team, rules: Rules, solo = false) =>
  Math.max(1, rules.lastManStands || solo ? team.players.length : team.players.length - 1);

export const isTest = (m: Match) => m.rules.format === "test";

/** One innings on its own, ended only by itself (not by a target, an overs cap or a stopped Test). */
function play(m: Match, idx: number): State {
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
    overs: [], freeHit: false, fow: [], lastOverBowler: null, allOut: false, ended: false,
  };
  addBat(st.striker); addBat(st.nonStriker);
  let overConceded = 0, allOut = false;
  const walkIn = (id: string | null) => { const back = id ? bat.get(id) : undefined; if (back) back.retired = false; addBat(id); };

  for (const e of inn.events) {
    if (e.t === "swap") { if (st.nonStriker) [st.striker, st.nonStriker] = [st.nonStriker, st.striker]; continue; }
    if (e.t === "retire") {
      const b = bat.get((e.out === "s" ? st.striker : st.nonStriker) ?? "");
      if (b) b.retired = true;
      walkIn(e.newId);
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

    // The scorer picks the run-out batter by name before the run is counted, so read it before they cross.
    const namedOut = e.wicket?.outId ?? null;
    // Batters cross on odd runs actually run; boundaries are even anyway.
    if (e.runs % 2 === 1 && !e.stay && st.nonStriker) [st.striker, st.nonStriker] = [st.nonStriker, st.striker];

    if (e.wicket) {
      const w = e.wicket;
      const outId = namedOut ?? (w.out === "s" ? st.striker : st.nonStriker);
      st.wickets++;
      if (w.kind !== "run out") bw.wickets++;
      if (outId) {
        const b = bat.get(outId);
        if (b) b.out = { kind: w.kind, bowler: e.bowler, ...(w.fielderId && { fielder: w.fielderId }) };
        st.fow.push({ score: st.runs, wicket: st.wickets, over: oversText(st.legal), id: outId });
      }
      walkIn(w.newId);
      // Nobody walking in is all out, unless last man stands lets the partner bat on.
      if (!w.newId && !r.lastManStands) allOut = true;
      if (st.striker === outId) st.striker = w.newId; else st.nonStriker = w.newId;
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

  st.allOut = allOut || st.wickets >= inn.wicketLimit;
  st.ended = inn.closed || st.allOut || !st.striker || (!isTest(m) && st.legal >= inn.overs * 6);
  return st;
}

export function replay(m: Match, idx: number): State {
  const st = play(m, idx), tgt = target(m, idx);
  if (tgt !== null && st.runs >= tgt) st.ended = true;
  if (isTest(m) && (m.stopped || capReached(m, idx, st.legal))) st.ended = true;
  return st;
}

/** Legal balls left before a Test's overs cap stops it, or null with no cap. */
export function matchBallsLeft(m: Match): number | null {
  const cap = isTest(m) ? m.rules.matchOvers : null;
  if (!cap) return null;
  return Math.max(0, cap * 6 - m.innings.reduce((n, _, i) => n + play(m, i).legal, 0));
}

function capReached(m: Match, idx: number, legal: number): boolean {
  const cap = m.rules.matchOvers;
  if (!cap) return false;
  for (let j = 0; j < idx; j++) legal += play(m, j).legal;
  return legal >= cap * 6;
}

/** Runs each side has scored in innings 0 to upto (inclusive). */
function totals(m: Match, upto: number): [number, number] {
  const t: [number, number] = [0, 0];
  for (let j = 0; j <= upto && j < m.innings.length; j++) t[m.innings[j].bat] += play(m, j).runs;
  return t;
}

function countBoundary(b: BatStat, runs: number) {
  if (runs === 4) b.fours++;
  if (runs === 6) b.sixes++;
}

export function target(m: Match, idx: number): number | null {
  if (isTest(m)) {
    if (idx !== 3) return null;
    const t = totals(m, 2), chaser = m.innings[3].bat;
    return t[otherSide(chaser)] - t[chaser] + 1;
  }
  if (idx % 2 === 0) return null;
  return play(m, idx - 1).runs + 1;
}

/** Test: the side that batted first may make the other side bat again if it leads after two innings. */
export function canFollowOn(m: Match): boolean {
  if (!isTest(m) || m.innings.length !== 2 || m.status !== "break") return false;
  const t = totals(m, 1);
  return t[m.innings[0].bat] > t[m.innings[1].bat];
}

/** Test: the lead, or what the chasing side needs. Null in the first innings and once the match is over. */
export function testStatus(m: Match): string | null {
  if (!isTest(m) || !m.innings.length || m.status === "done") return null;
  const idx = m.innings.length - 1, upcoming = m.status === "break" ? idx + 1 : idx;
  if (upcoming === 0 || (idx === 0 && m.status === "live")) return null;
  const t = totals(m, idx), name = (s: Side) => m.teams[s].name;
  if (upcoming === 3) {
    const chaser = m.status === "break" ? nextBattingSide(m) : m.innings[3].bat;
    return `${name(chaser)} need ${t[otherSide(chaser)] - t[chaser] + 1} to win`;
  }
  if (t[0] === t[1]) return "Scores level";
  const lead: Side = t[0] > t[1] ? 0 : 1;
  return `${name(lead)} lead by ${Math.abs(t[0] - t[1])}`;
}

const ORD = ["1st", "2nd", "3rd", "4th"];
export function inningsLabel(m: Match, idx: number): string {
  const inn = m.innings[idx];
  if (inn?.superOver) return "Super over";
  if (isTest(m)) return `${ORD[idx] ?? `${idx + 1}th`} innings${inn?.followOn ? ", follow-on" : ""}`;
  return idx === 0 ? "1st innings" : "2nd innings";
}

/** "5 overs", or "Test match" for a Test. */
export const formatText = (m: Match) =>
  isTest(m) ? `Test match${m.rules.matchOvers ? `, ${m.rules.matchOvers} overs max` : ""}` : `${m.rules.overs} overs`;

/** Score of one innings, with "d" after a declaration. */
export function inningsScore(m: Match, i: number): string {
  const st = replay(m, i);
  return `${st.runs}/${st.wickets}${m.innings[i].declared ? "d" : ""}`;
}

/** Test: every innings a side has batted, "120/10 & 85/3". */
export const sideScore = (m: Match, side: Side): string | null =>
  m.innings.map((inn, i) => (inn.bat === side ? inningsScore(m, i) : "")).filter(Boolean).join(" & ") || null;

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

/** Who can walk in after the next wicket: new batters, else retired ones coming back. Empty on the last wicket. */
export function afterWicket(m: Match, idx: number): { fresh: Player[]; back: Player[] } {
  const st = replay(m, idx), inn = m.innings[idx];
  if (st.wickets + 1 >= inn.wicketLimit) return { fresh: [], back: [] };
  const team = m.teams[inn.bat].players;
  const back = [...st.bat.values()].filter((b) => b.retired && b.id !== st.striker && b.id !== st.nonStriker)
    .map((b) => team.find((p) => p.id === b.id)).filter((p): p is Player => !!p);
  return { fresh: yetToBat(m, idx), back };
}

const clone = (m: Match): Match => JSON.parse(JSON.stringify(m));

export function startInnings(m: Match, striker: string, nonStriker: string | null, bowler: string, opts?: { followOn?: boolean }): Match {
  const n = clone(m), idx = n.innings.length, test = isTest(n);
  const superOver = !test && idx >= 2, followOn = !!opts?.followOn && canFollowOn(n);
  const bat = nextBattingSide(n, followOn);
  n.innings.push({
    ...(followOn && { followOn: true as const }),
    bat, overs: test ? 0 : superOver ? 1 : n.rules.overs,
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

/** Limited overs: the side that batted second opens the super over. Test: A, B, A, B, or A, B, B, A on the follow-on. */
export function nextBattingSide(m: Match, followOn = false): Side {
  const idx = m.innings.length;
  if (idx === 0) return firstBatting(m);
  if (isTest(m) && idx === 2) return followOn && canFollowOn(m) ? m.innings[1].bat : m.innings[0].bat;
  if (idx === 2) return m.innings[1].bat;
  return otherSide(m.innings[idx - 1].bat);
}

function settle(n: Match): Match {
  const idx = n.innings.length - 1;
  if (idx < 0) return n;
  const st = replay(n, idx);
  if (!st.ended) n.status = "live";
  else if (isTest(n)) n.status = testOver(n, idx) ? "done" : "break";
  else n.status = idx % 2 === 0 ? "break" : "done";
  return n;
}

/** After innings idx ends: stopped, capped, the 4th innings done, or the side batting 3rd still behind. */
function testOver(m: Match, idx: number): boolean {
  if (m.stopped || capReached(m, idx, play(m, idx).legal) || idx >= 3) return true;
  if (idx < 2) return false;
  const t = totals(m, 2), b = m.innings[2].bat;
  return t[b] < t[otherSide(b)];
}

/** Test: call the match off before a result, like when it gets dark. Undo takes it back. */
export function stopMatch(m: Match): Match {
  if (!isTest(m) || !m.innings.length) return m;
  const n = clone(m);
  n.stopped = true;
  return settle(n);
}

export function addBall(m: Match, input: BallInput): Match {
  const n = clone(m), inn = n.innings[n.innings.length - 1];
  if (n.status !== "live") return m;
  inn.events.push({ t: "ball", ...input, bowler: inn.bowler });
  return settle(n);
}

/** Marks whether the batters crossed on the last ball's odd runs. */
export function setCrossed(m: Match, crossed: boolean): Match {
  const n = clone(m), evs = n.innings[n.innings.length - 1]?.events ?? [], ev = evs[evs.length - 1];
  if (!ev || ev.t !== "ball" || ev.runs % 2 === 0) return m;
  if (crossed) delete ev.stay; else ev.stay = true;
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
  const n = clone(m), inn = n.innings[n.innings.length - 1];
  inn.closed = true;
  if (isTest(n)) inn.declared = true;
  return settle(n);
}

/** Test: the batting side declares. Same as ending the innings by hand. */
export const declare = closeInnings;

/** Removes the last event, stepping back into the previous innings if this one is empty. */
export function undo(m: Match): { match: Match; popped: Ev | null; droppedInnings: Innings | null } {
  const n = clone(m);
  let dropped: Innings | null = null;
  const inn = n.innings[n.innings.length - 1];
  if (!inn) return { match: m, popped: null, droppedInnings: null };
  if (n.stopped) { delete n.stopped; return { match: settle(n), popped: null, droppedInnings: null }; }
  if (inn.closed) { inn.closed = false; delete inn.declared; return { match: settle(n), popped: null, droppedInnings: null }; }
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
  if (ev.t === "ball") { inn.bowler = ev.bowler; return addBall(n, { runs: ev.runs, extra: ev.extra, wicket: ev.wicket, ...(ev.stay && { stay: true as const }) }); }
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

export interface Result { text: string; winner: Side | null; tie: boolean; superOver: boolean; draw?: boolean }

export function result(m: Match): Result | null {
  if (m.status !== "done") return null;
  if (isTest(m)) return testResult(m);
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

function testResult(m: Match): Result {
  const n = m.innings.length, name = (s: Side) => m.teams[s].name;
  const plural = (k: number, w: string) => `${k} ${w}${k === 1 ? "" : "s"}`;
  const win = (s: Side, by: string): Result => ({ text: `${name(s)} won by ${by}`, winner: s, tie: false, superOver: false });
  const complete = (i: number) => { const st = play(m, i), t = target(m, i); return st.ended || (t !== null && st.runs >= t); };
  if (n === 4 && complete(3)) {
    const t = totals(m, 3), chaser = m.innings[3].bat, other = otherSide(chaser);
    if (t[chaser] > t[other]) return win(chaser, plural(m.innings[3].wicketLimit - play(m, 3).wickets, "wicket"));
    if (t[chaser] < t[other]) return win(other, plural(t[other] - t[chaser], "run"));
    return { text: "Match tied", winner: null, tie: true, superOver: false };
  }
  if (n >= 3 && complete(2)) {
    const t = totals(m, 2), b = m.innings[2].bat, other = otherSide(b);
    if (t[b] < t[other]) return win(other, `an innings and ${plural(t[other] - t[b], "run")}`);
  }
  return { text: "Match drawn", winner: null, tie: false, superOver: false, draw: true };
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
