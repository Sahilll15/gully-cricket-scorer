import type {
  Ball, BallInput, Change, Ev, Extra, Innings, Lost, Match, MustRun, Penalty, Player, Rules, RulesChange, Side, Surface, Team, WicketKind,
} from "./types";

export interface BatStat {
  id: string; runs: number; balls: number; fours: number; sixes: number; out: { kind: string; bowler: string; fielder?: string } | null;
  retired?: boolean; cameBack?: boolean;
  hurt?: boolean;   // retired hurt: never out, can come back
  outs?: number;    // Pairs: dismissals while batting on
  saved?: number;   // protected player: dismissals that cost runs instead
}
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
  feed: { over: number; evIdx: number; ev: Ball | Lost | Penalty }[];   // balls, lost balls and penalties, in order
  bpo: number;                // balls an over
  maxBalls: number | null;    // legal balls the innings can last, null with no limit
  penalties: number;          // penalty runs awarded to the batting side, already in runs
  deducted: number;           // runs taken off for dismissals, already out of runs
  dotRun: Map<string, number>;   // dot balls in a row each batter has faced
  misses: Map<string, number>;   // play-and-misses each batter has had since last out
  blocks: PairBlock[];        // Pairs: what each pair made in its overs, in batting order
}

/** Pairs: one pair's stint of pairOvers overs. */
export interface PairBlock { ids: [string, string | null]; runs: number; outs: number; legal: number }

export const otherSide = (s: Side): Side => (s === 0 ? 1 : 0);
export const oversText = (legal: number, bpo = 6) => `${Math.floor(legal / bpo)}.${legal % bpo}`;
export const runRate = (runs: number, legal: number, bpo = 6) => (legal ? (runs * bpo) / legal : 0);

/** Balls an over, 3 to 8. */
export const ballsPerOver = (r: Rules) => Math.min(8, Math.max(3, Math.round(r.ballsPerOver ?? 6)));
/** Must run in force; older matches only have tipAndRun. */
export const mustRunMode = (r: Rules): MustRun => r.mustRun ?? (r.tipAndRun ? "touch" : "off");
/** Runs a dismissal costs the batting side. */
export const wicketPenaltyOf = (r: Rules) => Math.max(0, r.wicketPenalty ?? (r.format === "pairs" ? 5 : 0));
export const pairOversOf = (r: Rules) => Math.max(1, Math.round(r.pairOvers ?? 4));
/** Runs for hitting a surface: its own value, else the old one-wall rule, else nothing. */
export const wallValue = (r: Rules, s: Surface) => r.walls?.[s] ?? (r.wall === "four" ? 4 : r.wall === "six" ? 6 : 0);
const runningCounts = (r: Rules) => !r.onlyBoundaries && !r.noRunning;
/** Run-out style dismissals are not the bowler's. */
export const bowlerCredited = (kind: WicketKind) => kind !== "run out" && kind !== "didn't run";

/** Runs a ball scores before any multiplier: runs run (or the boundary), overthrows and the wall's value. */
function ranRuns(e: Ball, r: Rules, alone: boolean): number {
  const boundary = !e.wall && (e.runs === 4 || e.runs === 6), ot = e.overthrow ?? 0;
  const wall = e.wall ? wallValue(r, e.wall) : 0;
  if (!runningCounts(r)) return (boundary ? e.runs : 0) + wall;
  if (alone && r.lastManRunsTwo && !boundary) return Math.floor((e.runs + ot) / 2) + wall;
  return e.runs + ot + wall;
}
/** 2 per multiplier that falls on this ball: golden ball, power ball, Joker over. */
function multiplier(r: Rules, over: number, ball: number): { x: number; golden: boolean } {
  const golden = !!r.goldenBall && r.goldenBall.over === over && r.goldenBall.ball === ball;
  const x = (golden ? 2 : 1) * (r.powerBall === ball ? 2 : 1) * (r.jokerOver === over ? 2 : 1);
  return { x, golden };
}
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
  if (b.retired) return b.hurt ? "retired hurt" : "retired not out";
  if (!o) return b.outs ? `not out, dismissed ${b.outs} time${b.outs === 1 ? "" : "s"}` : "not out";
  const by = o.fielder ? playerName(m, o.fielder) : null, bw = playerName(m, o.bowler);
  if (o.kind === "run out") return by ? `run out (${by})` : "run out";
  if (o.kind === "wall out" || o.kind === "hit out" || o.kind === "didn't run" || o.kind === "dot balls") return o.kind;
  if (o.kind === "misses") return "out on misses";
  if (o.kind === "bowled") return `b ${bw}`;
  if (by && o.kind === "caught") return o.fielder === o.bowler ? `c & b ${bw}` : `c ${by} b ${bw}`;
  if (by && o.kind === "stumped") return `st ${by} b ${bw}`;
  if (by) return `${o.kind} (${by}), b ${bw}`;
  return `${o.kind}, b ${bw}`;
}

/** Ways out the wicket sheet offers on this ball, given the gully rules. */
export function wicketKinds(rules: Rules, extra: Extra | null, freeHit: boolean): WicketKind[] {
  if (rules.format === "french") return rules.oneTipCatch ? ["caught", "one-tip catch", "hit legs"] : ["caught", "hit legs"];
  const didntRun: WicketKind[] = mustRunMode(rules) !== "off" && !rules.noRunning ? ["didn't run"] : [];
  if (freeHit || extra === "nb") return ["run out", ...didntRun];
  if (extra === "b" || extra === "lb") return ["run out"];
  if (extra === "wd") return ["stumped", "run out"];
  const kinds: WicketKind[] = ["bowled", "caught", "run out", "stumped", "lbw", "hit wicket"];
  if (rules.oneTipCatch) kinds.push("one-tip catch");
  if (rules.wall === "out") kinds.push("wall out");
  if (rules.sixOut) kinds.push("hit out");
  kinds.push(...didntRun);
  if (rules.dotOut || rules.dotBallsOut) kinds.push("dot balls");
  if (rules.missesOut) kinds.push("misses");
  return rules.noLbw ? kinds.filter((k) => k !== "lbw") : kinds;
}

/** True when a ball scored 0 should ask "did they run?": must run is on and the batter touched it (or every ball, compulsory run). */
export function mustRunPrompt(rules: Rules, input: BallInput): boolean {
  const mode = mustRunMode(rules);
  if (mode === "off" || rules.noRunning || rules.format === "french" || input.wicket || input.extra === "wd") return false;
  if (input.runs !== 0 || input.overthrow || input.wall) return false;
  return mode === "every-hit" || !!input.touched;
}

/** Common players are on both teams under the same id: they bat for both and bowl for either. */
export const isCommon = (m: Match, id: string) => m.teams.every((t) => t.players.some((p) => p.id === id));

export const wicketLimit = (team: Team, rules: Rules, solo = false) =>
  Math.max(1, rules.lastManStands || solo ? team.players.length : team.players.length - 1);

export const isTest = (m: Match) => m.rules.format === "test";
/** Solo and French cricket: no teams, one batter at a time. */
export const isSolo = (m: Match) => m.rules.format === "solo" || m.rules.format === "french";
export const isFrench = (m: Match) => m.rules.format === "french";
export const isPairs = (m: Match) => m.rules.format === "pairs";

const soloLives = (r: Rules) => Math.max(1, r.lives ?? 1);
const soloCap = (r: Rules) => {
  if (r.format === "french") return null;
  const c = r.ballsPerTurn === undefined ? 12 : r.ballsPerTurn;
  return c && c > 0 ? c : null;
};
const soloRounds = (r: Rules) => Math.max(1, r.rounds ?? 1);
export const hasLeft = (m: Match, id: string) => !!m.left?.includes(id);
/** The team without players who went home. */
const activeTeam = (m: Match, side: Side): Team => ({ ...m.teams[side], players: m.teams[side].players.filter((p) => !hasLeft(m, p.id)) });

/** Solo: every turn in order. A player who left keeps the turns already started and loses the rest. */
function soloSlots(m: Match): { id: string; round: number }[] {
  const out: { id: string; round: number }[] = [];
  if (isFrench(m)) return m.innings.map((inn) => ({ id: inn.striker, round: 1 }));
  for (let round = 1; round <= soloRounds(m.rules); round++) for (const p of m.teams[0].players) {
    if (hasLeft(m, p.id) && m.innings[out.length]?.striker !== p.id) continue;
    out.push({ id: p.id, round });
  }
  return out;
}
const soloTurns = (m: Match) => soloSlots(m).length;
const soloBatterAt = (m: Match, k: number) => soloSlots(m)[k]?.id ?? m.teams[0].players[k % m.teams[0].players.length]?.id ?? null;

/** Where penalty runs for `side`, given in innings j, land: its innings before j, else its next one. -1 if none yet. */
function penaltyHome(m: Match, j: number, side: Side): number {
  for (let i = j - 1; i >= 0; i--) if (m.innings[i].bat === side) return i;
  for (let i = j + 1; i < m.innings.length; i++) if (m.innings[i].bat === side) return i;
  return -1;
}

/** One innings on its own, ended only by itself (not by a target, an overs cap or a stopped Test). */
function play(m: Match, idx: number): State {
  const inn = m.innings[idx], solo = isSolo(m), french = isFrench(m), pairs = isPairs(m);
  let r = rulesAt(m, idx);
  const bpo = ballsPerOver(m.rules), pairList = pairs ? inn.pairs ?? [[inn.striker, inn.nonStriker]] : null;
  const perPair = pairOversOf(m.rules) * bpo;
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
    runs: inn.given?.runs ?? 0, wickets: inn.given?.wickets ?? 0, legal: 0, extras: { wd: 0, nb: 0, b: 0, lb: 0 },
    striker: inn.striker || null, nonStriker: inn.nonStriker, bat, bowl, order, bowlOrder,
    overs: [], freeHit: false, fow: [], lastOverBowler: null, allOut: false, ended: false, feed: [],
    bpo, maxBalls: solo || isTest(m) ? null : inn.balls ?? inn.overs * bpo,
    penalties: 0, deducted: 0, dotRun: new Map(), misses: new Map(), blocks: [],
  };
  addBat(st.striker); addBat(st.nonStriker);
  if (!solo) m.innings.forEach((other, j) => {
    if (j === idx) return;
    for (const e of other.events)
      if (e.t === "penalty" && e.side === inn.bat && e.side !== other.bat && penaltyHome(m, j, e.side) === idx) { st.runs += e.runs; st.penalties += e.runs; }
  });
  const block = (legal: number) => {
    const k = Math.floor(legal / perPair);
    return (st.blocks[k] ||= { ids: pairList![k % pairList!.length], runs: 0, outs: 0, legal: 0 });
  };
  let overConceded = 0, allOut = false;
  const saved = new Set<string>();
  const walkIn = (id: string | null) => { const back = id ? bat.get(id) : undefined; if (back) { back.retired = false; back.cameBack = true; delete back.hurt; } addBat(id); };

  for (const [evIdx, e] of inn.events.entries()) {
    if (e.t === "rules") { if (!e.between) r = { ...r, ...e.to }; continue; }
    if (e.t === "lost") { st.feed.push({ over: Math.floor(st.legal / bpo), evIdx, ev: e }); continue; }
    if (e.t === "penalty") {
      st.feed.push({ over: Math.floor(st.legal / bpo), evIdx, ev: e });
      if (e.side === inn.bat) { st.runs += e.runs; st.penalties += e.runs; if (pairList) block(st.legal).runs += e.runs; }
      continue;
    }
    if (e.t === "swap") { if (st.nonStriker) [st.striker, st.nonStriker] = [st.nonStriker, st.striker]; continue; }
    if (e.t === "retire") {
      const b = bat.get((e.out === "s" ? st.striker : st.nonStriker) ?? "");
      if (b) { b.retired = true; if (e.hurt) b.hurt = true; }
      walkIn(e.newId);
      if (e.out === "s") st.striker = e.newId; else st.nonStriker = e.newId;
      if (!st.striker && st.nonStriker) { st.striker = st.nonStriker; st.nonStriker = null; }
      continue;
    }
    const legal = isLegal(e, r), overIdx = Math.floor(st.legal / bpo), legalBefore = st.legal;
    const { x, golden } = multiplier(r, overIdx + 1, (st.legal % bpo) + 1);
    const scored = ranRuns(e, r, !solo && !st.nonStriker) * x, pen = extraPenalty(e, r) * x, total = scored + pen;
    (st.overs[overIdx] ||= []).push(e);
    st.feed.push({ over: overIdx, evIdx, ev: e });
    st.runs += total;

    const bw = getBowl(e.bowler);
    const striker = st.striker ? bat.get(st.striker)! : null;
    if (e.extra === "wd") { st.extras.wd += total; bw.runs += total; bw.wides++; overConceded += total; }
    else if (e.extra === "nb") {
      st.extras.nb += pen; bw.runs += total; bw.noBalls++; overConceded += total;
      if (striker) { striker.runs += scored; striker.balls++; countBoundary(striker, e); }
    } else if (e.extra === "b" || e.extra === "lb") {
      st.extras[e.extra] += scored;
      if (striker) striker.balls++;
    } else {
      bw.runs += scored; overConceded += scored;
      if (striker) { striker.runs += scored; striker.balls++; countBoundary(striker, e); }
    }
    if (legal) { st.legal++; bw.legal++; }
    if (striker && e.extra !== "wd") {
      if (total > 0) st.dotRun.delete(striker.id);
      else if (legal && !e.wicket) st.dotRun.set(striker.id, (st.dotRun.get(striker.id) ?? 0) + 1);
      if (e.missed) st.misses.set(striker.id, (st.misses.get(striker.id) ?? 0) + 1);
    }

    // The scorer picks the run-out batter by name before the run is counted, so read it before they cross.
    const namedOut = e.wicket?.outId ?? null;
    // Batters cross on odd runs actually run; boundaries are even anyway.
    if ((e.runs + (e.overthrow ?? 0)) % 2 === 1 && !e.stay && !r.noRunning && st.nonStriker) [st.striker, st.nonStriker] = [st.nonStriker, st.striker];

    let cost = 0, fell = false;
    if (e.wicket) {
      const w = e.wicket;
      const outId = namedOut ?? (w.out === "s" ? st.striker : st.nonStriker);
      cost = golden ? 6 : 0;
      if (outId && r.protectedPlayers?.includes(outId) && !saved.has(outId)) {
        // A protected player's first dismissal costs runs and nothing else.
        saved.add(outId);
        const b = bat.get(outId);
        if (b) b.saved = (b.saved ?? 0) + 1;
        cost += wicketPenaltyOf(r) || 5;
      } else {
        fell = true;
        cost += wicketPenaltyOf(r);
        st.runs -= cost;
        st.wickets++;
        if (bowlerCredited(w.kind)) bw.wickets++;
        // Solo: losing a life that isn't the last keeps the batter in, and not out on the card. Pairs: the batter bats on.
        const lifeLeft = solo && st.wickets < inn.wicketLimit;
        if (outId) {
          const b = bat.get(outId);
          if (b && pairs) b.outs = (b.outs ?? 0) + 1;
          else if (b && !lifeLeft) b.out = { kind: w.kind, bowler: e.bowler, ...(w.fielderId && { fielder: w.fielderId }) };
          st.fow.push({ score: st.runs, wicket: st.wickets, over: oversText(st.legal, bpo), id: outId });
          st.dotRun.delete(outId); st.misses.delete(outId);
        }
        if (!solo && !pairs) {
          walkIn(w.newId);
          // Nobody walking in is all out, unless last man stands lets the partner bat on.
          if (!w.newId && !r.lastManStands) allOut = true;
          if (st.striker === outId) st.striker = w.newId; else st.nonStriker = w.newId;
          if (!st.striker && st.nonStriker) { st.striker = st.nonStriker; st.nonStriker = null; }
        }
      }
      if (!fell) st.runs -= cost;
      st.deducted += cost;
    }
    if (pairList) { const blk = block(legalBefore); blk.runs += total - cost; if (fell) blk.outs++; if (legal) blk.legal++; }

    if (legal && st.legal % bpo === 0 && !french) {
      if (overConceded === 0 && st.overs[overIdx].every((b) => b.bowler === e.bowler)) bw.maidens++;
      overConceded = 0;
      st.lastOverBowler = e.bowler;
      if (st.nonStriker) [st.striker, st.nonStriker] = [st.nonStriker, st.striker];
      if (pairList && st.legal % perPair === 0 && (st.maxBalls === null || st.legal < st.maxBalls)) {
        [st.striker, st.nonStriker] = pairList[(st.legal / perPair) % pairList.length];
        addBat(st.striker); addBat(st.nonStriker);
      }
    }
    st.freeHit = r.freeHit && (e.extra === "nb" || (e.extra === "wd" && st.freeHit));
  }

  st.allOut = !pairs && (allOut || st.wickets >= inn.wicketLimit);
  if (solo) st.maxBalls = soloCap(r);
  st.ended = inn.closed || st.allOut || !st.striker || (st.maxBalls !== null && st.legal >= st.maxBalls);
  return st;
}

export function replay(m: Match, idx: number): State {
  const st = play(m, idx), tgt = target(m, idx);
  // Pairs: a dismissal can take the chase back under, so the chasing side bats out its overs.
  if (tgt !== null && st.runs >= tgt && !isPairs(m)) st.ended = true;
  if (isTest(m) && (m.stopped || capReached(m, idx, st.legal))) st.ended = true;
  if (isFrench(m) && m.stopped) st.ended = true;
  if (m.stoppedLead && !isTest(m) && !isSolo(m)) st.ended = true;
  return st;
}

/** Rules in force when innings idx started: today's rules with every later change taken back. */
export function rulesAt(m: Match, idx: number): Rules {
  const r = { ...m.rules };
  for (let j = m.innings.length - 1; j >= idx; j--) {
    const evs = m.innings[j]?.events ?? [];
    for (let k = evs.length - 1; k >= 0; k--) { const e = evs[k]; if (e.t === "rules") Object.assign(r, e.from); }
  }
  return r;
}

/** Legal balls left before a Test's overs cap stops it, or null with no cap. */
export function matchBallsLeft(m: Match): number | null {
  const cap = isTest(m) ? m.rules.matchOvers : null;
  if (!cap) return null;
  return Math.max(0, cap * ballsPerOver(m.rules) - m.innings.reduce((n, _, i) => n + play(m, i).legal, 0));
}

function capReached(m: Match, idx: number, legal: number): boolean {
  const cap = m.rules.matchOvers;
  if (!cap) return false;
  for (let j = 0; j < idx; j++) legal += play(m, j).legal;
  return legal >= cap * ballsPerOver(m.rules);
}

/** Runs each side has scored in innings 0 to upto (inclusive). */
function totals(m: Match, upto: number): [number, number] {
  const t: [number, number] = [0, 0];
  for (let j = 0; j <= upto && j < m.innings.length; j++) t[m.innings[j].bat] += play(m, j).runs;
  return t;
}

function countBoundary(b: BatStat, e: Ball) {
  if (e.wall) return;
  if (e.runs === 4) b.fours++;
  if (e.runs === 6) b.sixes++;
}

export function target(m: Match, idx: number): number | null {
  if (isSolo(m)) return null;
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
  if (isFrench(m)) return playerName(m, inn?.striker ?? null);
  if (isSolo(m)) {
    const who = playerName(m, inn?.striker ?? soloBatterAt(m, idx));
    const round = soloSlots(m)[idx]?.round ?? Math.floor(idx / m.teams[0].players.length) + 1;
    return soloRounds(m.rules) > 1 ? `${who}, round ${round}` : who;
  }
  if (isTest(m)) return `${ORD[idx] ?? `${idx + 1}th`} innings${inn?.followOn ? ", follow-on" : ""}`;
  return idx === 0 ? "1st innings" : "2nd innings";
}

/** "5 overs", "Test match" for a Test, "Solo, 12 balls a turn" for a solo match, "French cricket", "Pairs, 16 overs" or "100 balls". */
export function formatText(m: Match): string {
  const r = m.rules, bpo = ballsPerOver(r);
  if (isFrench(m)) return "French cricket";
  if (isSolo(m)) return soloText(r);
  if (isTest(m)) return `Test match${r.matchOvers ? `, ${r.matchOvers} overs max` : ""}${bpo !== 6 ? `, ${bpo}-ball overs` : ""}`;
  const len = r.inningsBalls ? `${r.inningsBalls} balls` : `${r.overs} overs${bpo !== 6 ? ` of ${bpo} balls` : ""}`;
  return isPairs(m) ? `Pairs, ${len}` : len;
}

/** Score of one innings, with "d" after a declaration. */
export function inningsScore(m: Match, i: number): string {
  const st = replay(m, i);
  return `${st.runs}/${st.wickets}${m.innings[i].declared ? "d" : ""}`;
}

/** Test: every innings a side has batted, "120/10 & 85/3". */
export const sideScore = (m: Match, side: Side): string | null =>
  m.innings.map((inn, i) => (inn.bat === side ? inningsScore(m, i) : "")).filter(Boolean).join(" & ") || null;

export function needsBowler(m: Match, idx: number): boolean {
  if (isFrench(m)) return false;   // whoever has the ball bowls it
  const st = replay(m, idx), inn = m.innings[idx];
  if (st.ended || st.legal === 0 || st.legal % st.bpo !== 0) return false;
  // Undo across an over can leave last over's bowler in place with a matching count, so check who is bowling too.
  return inn.bowlerSetAt !== st.legal || !canBowl(m, idx, inn.bowler);
}

/** Why a player can't bowl the next ball: gone home, batting, the common player under that rule, just bowled, or out of overs. */
export type BowlBlock = "left" | "batting" | "common" | "just bowled" | "cap";

const commonBarred = (m: Match, id: string) => !!m.rules.commonCantBowl && !isSolo(m) && isCommon(m, id);

function bowlBlock(m: Match, idx: number, id: string, st: State): BowlBlock | null {
  if (hasLeft(m, id)) return "left";
  if (id === st.striker || id === st.nonStriker) return "batting";
  if (commonBarred(m, id)) return "common";
  // Whoever bowled the last over can't bowl any part of this one, mid-over changes included.
  const pool = isSolo(m) ? activeTeam(m, 0).players : activeTeam(m, otherSide(m.innings[idx].bat)).players.filter((p) => !commonBarred(m, p.id));
  const others = isSolo(m) ? pool.length - 1 : pool.length;
  if (id === st.lastOverBowler && others > 1) return "just bowled";
  const b = st.bowl.get(id), max = m.rules.maxOversPerBowler;
  return max && b && Math.floor(b.legal / st.bpo) >= max ? "cap" : null;
}

export function canBowl(m: Match, idx: number, id: string): boolean {
  return bowlBlock(m, idx, id, replay(m, idx)) === null;
}

export function yetToBat(m: Match, idx: number): Player[] {
  if (isSolo(m)) return [];   // nobody walks in: the rotation picks the next batter
  const st = replay(m, idx), inn = m.innings[idx];
  const left = m.teams[inn.bat].players.filter((p) => !st.bat.has(p.id) && !hasLeft(m, p.id));
  // A common player who is bowling cannot walk in to bat, unless he is the only one left.
  const notBowling = left.filter((p) => p.id !== inn.bowler);
  return notBowling.length ? notBowling : left;
}

/** Who can walk in after the next wicket: new batters, else retired ones coming back. Empty on the last wicket. */
export function afterWicket(m: Match, idx: number): { fresh: Player[]; back: Player[] } {
  if (isSolo(m) || isPairs(m)) return { fresh: [], back: [] };
  const st = replay(m, idx), inn = m.innings[idx];
  if (st.wickets + 1 >= inn.wicketLimit) return { fresh: [], back: [] };
  const team = m.teams[inn.bat].players;
  const back = [...st.bat.values()].filter((b) => b.retired && b.id !== st.striker && b.id !== st.nonStriker && !hasLeft(m, b.id))
    .map((b) => team.find((p) => p.id === b.id)).filter((p): p is Player => !!p);
  return { fresh: yetToBat(m, idx), back };
}

/** Batter at the crease who has reached the retire-at score. One who already retired and came back bats on. */
export function dueToRetire(m: Match, idx: number): string | null {
  const at = m.rules.retireAt, st = replay(m, idx);
  if (!at) return null;
  return [st.striker, st.nonStriker].find((id) => {
    const b = id ? st.bat.get(id) : undefined;
    return b && !b.retired && !b.cameBack && b.runs >= at;
  }) ?? null;
}

const clone = (m: Match): Match => JSON.parse(JSON.stringify(m));

/**
 * Starts the next innings. Pairs: `opts.pairs` sets the batting pairs in order, the openers first;
 * by default the openers, then the rest of the side two by two (an odd one out partners the first opener).
 */
export function startInnings(m: Match, striker: string, nonStriker: string | null, bowler: string, opts?: { followOn?: boolean; pairs?: [string, string | null][] }): Match {
  if (isSolo(m)) return startTurn(m, bowler);
  const n = clone(m), idx = n.innings.length, test = isTest(n);
  const superOver = !test && idx >= 2, followOn = !!opts?.followOn && canFollowOn(n);
  const bat = nextBattingSide(n, followOn), balls = !test && !superOver && n.rules.inningsBalls ? n.rules.inningsBalls : 0;
  n.innings.push({
    ...(followOn && { followOn: true as const }),
    ...(balls ? { balls } : {}),
    ...(isPairs(n) && { pairs: superOver ? [[striker, nonStriker]] : opts?.pairs ?? defaultPairs(activeTeam(n, bat), striker, nonStriker) }),
    bat, overs: test ? 0 : superOver ? 1 : balls ? Math.ceil(balls / ballsPerOver(n.rules)) : n.rules.overs,
    wicketLimit: superOver ? Math.min(2, wicketLimit(activeTeam(n, bat), n.rules)) : wicketLimit(activeTeam(n, bat), n.rules, !nonStriker),
    superOver, striker, nonStriker, solo: !nonStriker, bowler, bowlerSetAt: 0, events: [], closed: false,
  });
  n.status = "live";
  if (idx === 0) n.rulesLockedAt = Date.now();
  return n;
}

function defaultPairs(team: Team, striker: string, nonStriker: string | null): [string, string | null][] {
  const rest = team.players.map((p) => p.id).filter((id) => id !== striker && id !== nonStriker), out: [string, string | null][] = [[striker, nonStriker]];
  for (let i = 0; i < rest.length; i += 2) out.push([rest[i], rest[i + 1] ?? striker]);
  return out;
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
  if (isFrench(n)) n.status = n.stopped ? "done" : st.ended ? "break" : "live";
  else if (!st.ended) n.status = "live";
  else if (isSolo(n)) n.status = idx + 1 >= soloTurns(n) ? "done" : "break";
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

/** Test: call the match off before a result, like when it gets dark. French cricket: end it, most runs wins. Undo takes it back. */
export function stopMatch(m: Match): Match {
  if (!(isTest(m) || isFrench(m)) || !m.innings.length) return m;
  const n = clone(m);
  n.stopped = true;
  return settle(n);
}

/**
 * Adds a ball. When the rules make it out on their own (dot balls in a row, too many misses) and no wicket is
 * given, it is added for the striker, with the next new batter walking in. Pass a wicket to pick someone else.
 */
export function addBall(m: Match, input: BallInput): Match {
  const n = clone(m), idx = n.innings.length - 1, inn = n.innings[idx];
  if (n.status !== "live") return m;
  const ev: Ball = { t: "ball", ...input, bowler: inn.bowler }, kind = input.wicket ? null : forcedOut(m, input);
  if (kind) {
    const outId = replay(m, idx).striker!;
    ev.wicket = { kind, out: "s", outId, newId: needsNewBatter(m, outId) ? afterWicket(m, idx).fresh[0]?.id ?? null : null };
  }
  inn.events.push(ev);
  return settle(n);
}

/** The wicket the rules force on this ball if it is played as given: "dot balls" or "misses". Null otherwise. */
export function forcedOut(m: Match, input: BallInput): WicketKind | null {
  const idx = m.innings.length - 1, inn = m.innings[idx], r = m.rules;
  if (!inn || m.status !== "live" || input.wicket || input.extra === "wd") return null;
  const st = replay(m, idx), id = st.striker;
  if (!id) return null;
  if (r.missesOut && input.missed && (st.misses.get(id) ?? 0) + 1 >= r.missesOut) return "misses";
  const need = r.dotOut ? 1 : r.dotBallsOut ?? 0, ball: Ball = { t: "ball", ...input, bowler: inn.bowler };
  const dot = isLegal(ball, r) && ranRuns(ball, r, !isSolo(m) && !st.nonStriker) + extraPenalty(ball, r) === 0;
  return need > 0 && dot && (st.dotRun.get(id) ?? 0) + 1 >= need ? "dot balls" : null;
}

/** False when this batter would bat on after a dismissal now: solo, pairs, or a protected player's first one. */
export function needsNewBatter(m: Match, outId: string): boolean {
  if (isSolo(m) || isPairs(m)) return false;
  const idx = m.innings.length - 1;
  if (!m.rules.protectedPlayers?.includes(outId) || idx < 0) return true;
  return !!replay(m, idx).bat.get(outId)?.saved;
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

/** Batter leaves without being out. Hurt: shown as retired hurt; like any retired batter they can come back later. */
export function retire(m: Match, out: "s" | "ns", newId: string | null, hurt = false): Match {
  const n = clone(m);
  n.innings[n.innings.length - 1].events.push({ t: "retire", out, newId, ...(hurt && { hurt: true as const }) });
  return settle(n);
}

/** Penalty runs to a side (5 for a fielder's helmet, say). Runs for the fielding side go on its own total. */
export function addPenalty(m: Match, side: Side, runs: number, reason = "Penalty"): Match {
  if ((m.status !== "live" && m.status !== "break") || !m.innings.length || !Number.isFinite(runs) || !runs) return m;
  const n = clone(m);
  n.innings[n.innings.length - 1].events.push({ t: "penalty", side, runs: Math.round(runs), reason: reason.trim() || "Penalty" });
  return settle(n);
}

/** Fewest overs the match can be cut to now: the current innings can't drop below balls already bowled. */
export function minOvers(m: Match): number {
  const idx = m.innings.length - 1, inn = m.innings[idx];
  if (!inn || inn.superOver || m.status === "break") return 1;
  const st = replay(m, idx);
  return Math.max(1, Math.ceil(st.legal / st.bpo));
}

/** Changes the overs for the rest of the match, like a gully game cut short when it gets dark. */
export function setOvers(m: Match, overs: number): Match {
  const n = clone(m), inn = n.innings[n.innings.length - 1];
  n.rules.overs = overs;
  delete n.rules.inningsBalls;
  if (n.rules.maxOversPerBowler) n.rules.maxOversPerBowler = Math.min(n.rules.maxOversPerBowler, overs);
  if (inn && !inn.superOver && n.status === "live") {
    inn.overs = Math.max(overs, minOvers(m));
    if (inn.balls) inn.balls = Math.max(overs * ballsPerOver(n.rules), replay(m, n.innings.length - 1).legal);
  }
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
  const tail = inn.events[inn.events.length - 1];
  if (tail?.t === "rules" && tail.between) return { match: settle(takeBackRules(n, inn)), popped: tail, droppedInnings: null };
  if (n.stopped) { delete n.stopped; return { match: settle(n), popped: null, droppedInnings: null }; }
  if (n.stoppedLead) { delete n.stoppedLead; return { match: settle(n), popped: null, droppedInnings: null }; }
  if (inn.closed) { inn.closed = false; delete inn.declared; return { match: settle(n), popped: null, droppedInnings: null }; }
  if (!inn.events.length) {
    if (n.innings.length === 1) return { match: m, popped: null, droppedInnings: null };
    dropped = n.innings.pop()!;
    return { match: settle(n), popped: null, droppedInnings: dropped };
  }
  if (inn.events[inn.events.length - 1].t === "rules") return { match: settle(takeBackRules(n, inn)), popped: tail, droppedInnings: null };
  const popped = inn.events.pop() ?? null;
  if (popped?.t === "ball") inn.bowler = popped.bowler;
  return { match: settle(n), popped, droppedInnings: dropped };
}

/** Pops a trailing rules change and puts the old rules, and the innings' own limits, back. */
function takeBackRules(n: Match, inn: Innings): Match {
  const e = inn.events.pop() as RulesChange;
  Object.assign(n.rules, e.from);
  if (e.inn) Object.assign(inn, e.inn);
  return n;
}

export function redo(m: Match, ev: Ev): Match {
  const n = clone(m), inn = n.innings[n.innings.length - 1];
  if (ev.t === "ball") {
    inn.bowler = ev.bowler;
    const { t: _t, bowler: _b, ...input } = ev;
    return addBall(n, input);
  }
  if (ev.t === "retire") return retire(n, ev.out, ev.newId, !!ev.hurt);
  if (ev.t === "lost") return ballLost(n, ev.reason);
  if (ev.t === "penalty") return addPenalty(n, ev.side, ev.runs, ev.reason);
  if (ev.t === "rules") return changeRules(n, ev.to, ev.agreedBy, ev.at);
  return swapStrike(n);
}

/** Corrects runs or extras of a past ball. Wickets stay as recorded. */
export function editBall(m: Match, idx: number, evIdx: number, patch: { runs: number; extra?: Ball["extra"] }, now = Date.now()): Match {
  const n = clone(m), ev = n.innings[idx]?.events[evIdx];
  if (!ev || ev.t !== "ball") return m;
  const from = { runs: ev.runs, ...(ev.extra && { extra: ev.extra }) }, to = { runs: patch.runs, ...(patch.extra && { extra: patch.extra }) };
  if (from.runs !== to.runs || from.extra !== to.extra) n.changes = [...(n.changes ?? []), { at: now, innings: idx, ball: evIdx, from, to }];
  ev.runs = patch.runs;
  if (patch.extra) ev.extra = patch.extra; else delete ev.extra;
  return settle(n);
}

/** `winnerId` is the winning player in a solo match, where `winner` (a side) is always null. */
export interface Result { text: string; winner: Side | null; tie: boolean; superOver: boolean; draw?: boolean; winnerId?: string; stopped?: true }

export function result(m: Match): Result | null {
  if (m.status !== "done") return null;
  if (isSolo(m)) return soloResult(m);
  if (isTest(m)) return testResult(m);
  if (m.stoppedLead) return leadResult(m);
  const base = m.innings.length >= 4 ? 2 : 0;
  const a = replay(m, base), b = replay(m, base + 1);
  const first = m.innings[base].bat, second = m.innings[base + 1].bat;
  const so = base === 2 ? " (super over)" : "";
  if (isPairs(m) && b.runs > a.runs) {
    const by = b.runs - a.runs;
    return { text: `${m.teams[second].name} won by ${by} run${by === 1 ? "" : "s"}${so}`, winner: second, tie: false, superOver: !!so };
  }
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
  const won = (r: (typeof list)[number]) =>
    res?.winnerId === r.id || (res?.winner != null && (res.winner === r.side || isCommon(m, r.id)));
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

const SURFACE: Record<Surface, string> = { side: "Side", back: "Back", roof: "Roof", fullBack: "Full back" };

/** "4", "Wd+1", "1+4 ot", "Back 4+1". Pass the rules to show a wall's runs. */
export function ballLabel(b: Ball, rules?: Rules): string {
  const w = b.wicket ? "W" : "", ot = b.overthrow ? `+${b.overthrow} ot` : "";
  if (b.wall) {
    const v = rules ? ` ${wallValue(rules, b.wall)}` : "";
    return `${SURFACE[b.wall]}${v}${b.runs ? "+" + b.runs : ""}${ot}${w ? " " + w : ""}`;
  }
  if (b.extra === "wd") return `Wd${b.runs ? "+" + b.runs : ""}${ot}${w ? " " + w : ""}`;
  if (b.extra === "nb") return `Nb${b.runs ? "+" + b.runs : ""}${ot}${w ? " " + w : ""}`;
  if (b.extra === "b") return `${b.runs}B${ot}${w ? " " + w : ""}`;
  if (b.extra === "lb") return `${b.runs}LB${ot}${w ? " " + w : ""}`;
  if (w) return b.runs || ot ? `${b.runs}${ot} W` : "W";
  return b.runs === 0 && !ot ? "•" : `${b.runs}${ot}`;
}

// Solo: no teams. Players bat one at a time in list order, everyone else bowls. Innings k is turn k.

export interface SoloRow {
  id: string; name: string;
  runs: number;   // everything scored in their turns, extras included: this decides the winner
  balls: number; strikeRate: number; outs: number; turns: number; fours: number; sixes: number;
  wickets: number; conceded: number; bowled: number;   // bowled counts legal balls
}

/** Solo: a match in setup from a player list (batting order) and settings such as lives, ballsPerTurn and rounds. */
export function newSoloMatch(players: Player[], settings: Partial<Rules> = {}): Match {
  if (players.length < 2) throw new Error("A solo match needs at least two players");
  const rules: Rules = {
    overs: 0, extraRun: true, rebowl: true, freeHit: false, lastManStands: false, oneTipCatch: false,
    wall: "none", tipAndRun: false, maxOversPerBowler: null, ...settings, format: settings.format === "french" ? "french" : "solo",
  };
  const cap = soloCap(rules);
  rules.overs = cap ? Math.ceil(cap / ballsPerOver(rules)) : 0;
  const list = players.map((p) => ({ id: p.id, name: p.name }));
  return newMatch([{ name: "Solo", players: list }, { name: "Solo", players: list.map((p) => ({ ...p })) }], rules);
}

/** Solo: a new match with the first batter's turn already started. */
export const startSolo = (players: Player[], settings: Partial<Rules> = {}, bowler?: string): Match =>
  startTurn(newSoloMatch(players, settings), bowler);

/** Solo: starts the next batter's turn with a fresh over. Unchanged if the bowler is the batter or the match is over. */
export function startTurn(m: Match, bowler?: string): Match {
  if (isFrench(m)) return frenchNext(m, frenchOutBy(m) ?? m.teams[0].players.find((p) => !hasLeft(m, p.id))?.id ?? "", bowler);
  if (!isSolo(m) || m.status === "live" || m.status === "done") return m;
  const k = m.innings.length, striker = soloBatterAt(m, k), by = bowler ?? suggestedBowler(m);
  if (!striker || k >= soloTurns(m) || !by || by === striker || hasLeft(m, by) || !m.teams[0].players.some((p) => p.id === by)) return m;
  const n = clone(m), cap = soloCap(n.rules);
  n.innings.push({
    bat: 0, overs: cap ? Math.ceil(cap / ballsPerOver(n.rules)) : 0, wicketLimit: soloLives(n.rules), superOver: false,
    striker, nonStriker: null, solo: true, bowler: by, bowlerSetAt: 0, events: [], closed: false,
  });
  n.status = "live";
  if (k === 0) n.rulesLockedAt = Date.now();
  return n;
}

/** Solo: who is batting now, or null between turns. */
export function currentBatter(m: Match): string | null {
  return isSolo(m) && m.status === "live" ? m.innings[m.innings.length - 1].striker : null;
}

/** Solo: who bats in the next turn not yet started (the one waiting, between turns). Null when none are left. */
export function nextBatter(m: Match): string | null {
  if (isFrench(m)) return m.status === "break" ? frenchOutBy(m) : null;
  return isSolo(m) && m.innings.length < soloTurns(m) ? soloBatterAt(m, m.innings.length) : null;
}

/** Solo: round of the turn being played, or of the next one between turns. Starts at 1; 0 if not solo. */
export function soloRound(m: Match): number {
  if (!isSolo(m)) return 0;
  const k = m.status === "live" || m.status === "done" ? m.innings.length - 1 : m.innings.length, slots = soloSlots(m);
  return slots[Math.max(0, Math.min(k, slots.length - 1))]?.round ?? 1;
}

/** Solo: batters still to come in this round, in order, not counting the one batting now. */
export function upcomingBatters(m: Match): string[] {
  if (!isSolo(m) || isFrench(m) || m.status === "done") return [];
  const out: string[] = [], slots = soloSlots(m), round = soloRound(m);
  for (let k = m.innings.length; k < slots.length && slots[k].round === round; k++) out.push(slots[k].id);
  return out;
}

/** Solo: legal balls left in the turn (a full turn between turns), or null with no cap. */
export function turnBallsLeft(m: Match): number | null {
  const cap = soloCap(m.rules);
  if (!isSolo(m) || cap === null) return null;
  if (m.status === "done") return 0;
  return m.status === "live" ? Math.max(0, cap - replay(m, m.innings.length - 1).legal) : cap;
}

/** Solo: outs the batter can still take before the turn ends (all of them between turns). */
export function livesLeft(m: Match): number {
  if (!isSolo(m) || m.status === "done") return 0;
  if (m.status !== "live") return soloLives(m.rules);
  const idx = m.innings.length - 1;
  return Math.max(0, m.innings[idx].wicketLimit - replay(m, idx).wickets);
}

/** Solo: the next player in order after the last bowler, never the batter. */
export function suggestedBowler(m: Match): string | null {
  if (!isSolo(m) || m.status === "done") return null;
  const ids = m.teams[0].players.map((p) => p.id), batter = currentBatter(m) ?? nextBatter(m);
  const last = m.innings[m.innings.length - 1]?.bowler, from = last ? ids.indexOf(last) : -1;
  for (let i = 1; i <= ids.length; i++) {
    const id = ids[(from + i + ids.length) % ids.length];
    if (id !== batter && !hasLeft(m, id)) return id;
  }
  return null;
}

/** Solo: every player's batting and bowling so far, best score first; equal runs go to fewer balls faced. */
export function soloStandings(m: Match): SoloRow[] {
  if (!isSolo(m)) return [];
  const rows = new Map<string, SoloRow>(m.teams[0].players.map((p) => [p.id, {
    id: p.id, name: p.name, runs: 0, balls: 0, strikeRate: 0, outs: 0, turns: 0, fours: 0, sixes: 0, wickets: 0, conceded: 0, bowled: 0,
  }]));
  m.innings.forEach((inn, i) => {
    const st = replay(m, i), row = rows.get(inn.striker), b = st.bat.get(inn.striker);
    if (row) {
      row.turns++; row.runs += st.runs; row.outs += st.wickets;
      if (b) { row.balls += b.balls; row.fours += b.fours; row.sixes += b.sixes; }
    }
    for (const w of st.bowl.values()) {
      const r = rows.get(w.id);
      if (r) { r.wickets += w.wickets; r.conceded += w.runs; r.bowled += w.legal; }
    }
  });
  for (const r of rows.values()) r.strikeRate = r.balls ? (r.runs * 100) / r.balls : 0;
  return [...rows.values()].sort((a, b) => b.runs - a.runs || a.balls - b.balls);
}

function soloResult(m: Match): Result {
  const [top, ...rest] = soloStandings(m);
  const level = rest.filter((r) => r.runs === top.runs && r.balls === top.balls);
  if (level.length) {
    const names = [top, ...level].map((r) => r.name);
    return { text: `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]} tie on ${top.runs}`, winner: null, tie: true, superOver: false };
  }
  const second = rest[0];
  const text = second && second.runs === top.runs
    ? `${top.name} wins with ${top.runs}, ${top.balls} balls to ${second.name}'s ${second.balls}`
    : `${top.name} wins with ${top.runs}`;
  return { text, winner: null, tie: false, superOver: false, winnerId: top.id };
}

// French cricket: solo with no overs. Caught or hit on the legs; whoever got you out bats next.

/** French cricket: a match in setup. Everyone is on both sides like solo. */
export const newFrenchMatch = (players: Player[], settings: Partial<Rules> = {}): Match =>
  newSoloMatch(players, { ...settings, format: "french" });

/** French cricket: a new match with the first batter in (default the first player). */
export const startFrench = (players: Player[], settings: Partial<Rules> = {}, batter?: string, bowler?: string): Match => {
  const m = newFrenchMatch(players, settings);
  return frenchNext(m, batter ?? players[0].id, bowler);
};

/** French cricket: who got the last batter out (the catcher, else the bowler). Null before anyone is out. */
export function frenchOutBy(m: Match): string | null {
  if (!isFrench(m)) return null;
  const evs = m.innings[m.innings.length - 1]?.events ?? [];
  for (let k = evs.length - 1; k >= 0; k--) {
    const e = evs[k];
    if (e.t === "ball" && e.wicket) return e.wicket.fielderId ?? e.bowler;
  }
  return null;
}

/** French cricket: starts the next turn with playerId batting. The bowler defaults to whoever just batted. */
export function frenchNext(m: Match, playerId: string, bowler?: string): Match {
  if (!isFrench(m) || m.status === "live" || m.status === "done") return m;
  const here = m.teams[0].players.filter((p) => !hasLeft(m, p.id)).map((p) => p.id);
  if (!here.includes(playerId)) return m;
  const prev = m.innings[m.innings.length - 1]?.striker;
  const by = bowler ?? (prev && prev !== playerId && here.includes(prev) ? prev : here.find((id) => id !== playerId));
  if (!by || by === playerId || !here.includes(by)) return m;
  const n = clone(m), k = n.innings.length;
  n.innings.push({
    bat: 0, overs: 0, wicketLimit: soloLives(n.rules), superOver: false,
    striker: playerId, nonStriker: null, solo: true, bowler: by, bowlerSetAt: 0, events: [], closed: false,
  });
  n.status = "live";
  if (k === 0) n.rulesLockedAt = Date.now();
  return n;
}

function soloText(r: Rules): string {
  const cap = soloCap(r), lives = soloLives(r), rounds = soloRounds(r);
  return ["Solo", cap ? `${cap} balls a turn` : "no ball limit", lives > 1 && `${lives} lives`, rounds > 1 && `${rounds} rounds`]
    .filter(Boolean).join(", ");
}

// Fair play and match day.

/** What an unset optional rule means, so a change can be taken back exactly. */
const RULE_DEFAULTS: Partial<Rules> = {
  sixOut: false, noLbw: false, retireAt: null, rotateUmpire: false, commonCantBowl: false,
  matchOvers: null, lives: 1, ballsPerTurn: 12, rounds: 1,
  walls: {}, noRunning: false, dotBallsOut: 0, onlyBoundaries: false, dotOut: false, lastManRunsTwo: false, missesOut: 0,
  goldenBall: null, powerBall: null, jokerOver: null, protectedPlayers: [],
};
/** Set by the format at the start: they can't change once the first innings is under way. */
const FIXED: (keyof Rules)[] = ["format", "ballsPerOver", "inningsBalls", "pairOvers"];
/** A rule's value as the engine reads it, so an unset one is taken back to what it meant. */
const ruleNow = (r: Rules, k: keyof Rules): unknown =>
  k === "mustRun" ? mustRunMode(r) : k === "wicketPenalty" ? wicketPenaltyOf(r) : r[k] === undefined ? RULE_DEFAULTS[k] : r[k];

/**
 * Changes rules both sides agreed to. Before the toss it just sets them. After, it records who agreed and when
 * as an event, and the replay applies it from that ball on. The format can't change mid-match.
 */
export function changeRules(m: Match, rules: Partial<Rules>, agreedBy: string[], now = Date.now()): Match {
  const want: Partial<Rules> = { ...rules };
  if (want.overs !== undefined && m.rules.maxOversPerBowler && m.rules.maxOversPerBowler > want.overs && want.maxOversPerBowler === undefined)
    want.maxOversPerBowler = want.overs;
  const from: Record<string, unknown> = {}, to: Record<string, unknown> = {};
  for (const k of Object.keys(want) as (keyof Rules)[]) {
    if (want[k] === undefined || k === "format" || (m.innings.length && FIXED.includes(k))) continue;
    const cur = ruleNow(m.rules, k);
    if (JSON.stringify(cur) !== JSON.stringify(want[k])) { from[k] = cur; to[k] = want[k]; }
  }
  if (!Object.keys(to).length) return m;
  const n = clone(m), idx = n.innings.length - 1, inn = n.innings[idx];
  Object.assign(n.rules, to);
  if (!inn) return n;   // before the toss the rules are still open
  const ev: RulesChange = { t: "rules", from: from as Partial<Rules>, to: to as Partial<Rules>, agreedBy: [...agreedBy], at: now };
  if (n.status !== "live") ev.between = true;
  else if (!inn.superOver && !isSolo(n)) {
    const team = activeTeam(n, inn.bat), next = { overs: inn.overs, wicketLimit: inn.wicketLimit, ...(inn.balls ? { balls: inn.balls } : {}) };
    if (to.overs !== undefined && !isTest(n)) {
      next.overs = Math.max(to.overs as number, minOvers(m));
      if (inn.balls) next.balls = Math.max((to.overs as number) * ballsPerOver(n.rules), replay(m, idx).legal);
    }
    if (to.lastManStands !== undefined)
      next.wicketLimit = Math.max(1, inn.wicketLimit + wicketLimit(team, n.rules, inn.solo) - wicketLimit(team, m.rules, inn.solo));
    if (next.overs !== inn.overs || next.wicketLimit !== inn.wicketLimit || next.balls !== inn.balls) {
      ev.inn = { overs: inn.overs, wicketLimit: inn.wicketLimit, ...(inn.balls ? { balls: inn.balls } : {}) };
      Object.assign(inn, next);
    }
  }
  inn.events.push(ev);
  return settle(n);
}

/** Every rule change made after the toss, oldest first. */
export const ruleChanges = (m: Match): RulesChange[] =>
  m.innings.flatMap((inn) => inn.events.filter((e): e is RulesChange => e.t === "rules"));

/** The rules in force, one short sentence each, for a card both sides can share. */
export function rulesCard(m: Match): string[] {
  const r = m.rules, out: string[] = [], plural = (k: number, w: string) => `${k} ${w}${k === 1 ? "" : "s"}`;
  if (isFrench(m)) {
    out.push("French cricket: bat until you're caught or hit on the legs.");
    out.push("Whoever gets you out bats next.");
  } else if (isSolo(m)) {
    const cap = soloCap(r), lives = soloLives(r), rounds = soloRounds(r);
    out.push("Solo: everyone bats on their own, everyone else bowls.");
    out.push(cap ? `${plural(cap, "ball")} a turn.` : "No ball limit in a turn.");
    out.push(lives === 1 ? "One life a turn." : `${lives} lives a turn.`);
    if (rounds > 1) out.push(`Everyone bats ${rounds} times.`);
  } else if (isTest(m)) {
    out.push("Test match: two innings a side.");
    if (r.matchOvers) out.push(`Draw if it isn't over after ${plural(r.matchOvers, "over")}.`);
  } else out.push(r.inningsBalls ? `${plural(r.inningsBalls, "ball")} a side.` : `${plural(r.overs, "over")} a side.`);
  if (isPairs(m)) out.push(`Pairs bat ${plural(pairOversOf(r), "over")} each and bat on when out.`);
  if (ballsPerOver(r) !== 6) out.push(`${ballsPerOver(r)} balls an over.`);
  if (r.extraRun) out.push("Wides and no-balls give a run.");
  if (r.rebowl) out.push("Wides and no-balls are bowled again.");
  if (r.freeHit) out.push("Free hit after a no-ball.");
  if (r.lastManStands) out.push("Last man stands: the last batter bats on alone.");
  if (r.oneTipCatch) out.push("One tip, one hand catch is out.");
  if (r.wall === "four") out.push("Hitting the wall is a four.");
  if (r.wall === "six") out.push("Hitting the wall is a six.");
  if (r.wall === "out") out.push("Hitting the wall is out.");
  if (r.sixOut) out.push("Hit out of the ground is out.");
  if (mustRunMode(r) === "touch") out.push("Tip and run: touch it and you run.");
  if (mustRunMode(r) === "every-hit") out.push("Compulsory run: run on every ball.");
  if (r.noLbw) out.push("No lbw.");
  if (r.maxOversPerBowler) out.push(`A bowler bowls ${plural(r.maxOversPerBowler, "over")} at most.`);
  if (r.retireAt) out.push(`Retire at ${r.retireAt} runs, so everyone bats.`);
  if (r.rotateUmpire) out.push("Fielders take turns to umpire, one over each.");
  if (r.commonCantBowl && !isSolo(m)) out.push("The common player can't bowl.");
  const walls = (Object.keys(SURFACE) as Surface[]).filter((k) => r.walls?.[k] !== undefined);
  if (walls.length) out.push(`Walls: ${walls.map((k) => `${SURFACE[k].toLowerCase()} ${r.walls![k]}`).join(", ")}.`);
  if (r.noRunning) out.push("No running: only boundaries and walls score.");
  if (r.onlyBoundaries) out.push("Only 4s, 6s and walls count. Running scores nothing.");
  if (r.dotOut) out.push("A dot ball is out.");
  else if (r.dotBallsOut) out.push(`${r.dotBallsOut} dot balls in a row is out.`);
  if (r.missesOut) out.push(`${r.missesOut} miss${r.missesOut === 1 ? "" : "es"} and you're out.`);
  const pen = wicketPenaltyOf(r);
  if (pen) out.push(`Every dismissal costs ${plural(pen, "run")}.`);
  if (r.lastManRunsTwo) out.push("The last batter on his own runs two for one.");
  if (r.goldenBall) out.push(`Golden ball, over ${r.goldenBall.over} ball ${r.goldenBall.ball}: runs double, a wicket costs 6.`);
  if (r.powerBall) out.push(`Power ball: ball ${r.powerBall} of every over scores double.`);
  if (r.jokerOver) out.push(`Joker over: over ${r.jokerOver} scores double.`);
  if (r.protectedPlayers?.length)
    out.push(`Protected: ${r.protectedPlayers.map((id) => playerName(m, id)).join(", ")}. First time out costs ${plural(pen || 5, "run")} instead.`);
  return out;
}

export interface ChangeLine extends Change { over: number; text: string }

/** Every correction of an earlier ball, oldest first, with a line to show for each. */
export function changeLog(m: Match): ChangeLine[] {
  return (m.changes ?? []).map((c) => {
    const ev = m.innings[c.innings]?.events[c.ball];
    const over = m.innings[c.innings] ? (replay(m, c.innings).feed.find((f) => f.evIdx === c.ball)?.over ?? 0) : 0;
    const label = (p: Change["from"]) => ballLabel({ t: "ball", bowler: "", ...(ev?.t === "ball" && ev.wicket && { wicket: ev.wicket }), ...p });
    return { ...c, over, text: `${inningsLabel(m, c.innings)}, over ${over + 1}: ${label(c.from)} changed to ${label(c.to)}` };
  });
}

export interface BowlerOption { id: string; name: string; balls: number; overs: string; oversLeft: number | null; blocked: BowlBlock | null }

/** Everyone on the fielding side who hasn't gone home, with their overs this innings and why they can't bowl now. */
export function bowlerOptions(m: Match): BowlerOption[] {
  const idx = m.innings.length - 1, inn = m.innings[idx];
  if (!inn) return [];
  const st = replay(m, idx), max = m.rules.maxOversPerBowler;
  return activeTeam(m, isSolo(m) ? 0 : otherSide(inn.bat)).players.map((p) => {
    const balls = st.bowl.get(p.id)?.legal ?? 0;
    return {
      id: p.id, name: p.name, balls, overs: oversText(balls, st.bpo),
      oversLeft: max ? Math.max(0, max - Math.floor(balls / st.bpo)) : null, blocked: bowlBlock(m, idx, p.id, st),
    };
  });
}

/** With rotateUmpire on: the fielder who umpires this over. Moves one along each over, skipping the bowler and anyone batting. */
export function umpire(m: Match): Player | null {
  const idx = m.innings.length - 1, inn = m.innings[idx];
  if (!m.rules.rotateUmpire || !inn || m.status !== "live") return null;
  const st = replay(m, idx), side = isSolo(m) ? 0 : otherSide(inn.bat);
  const pool = activeTeam(m, side).players.filter((p) => p.id !== st.striker && p.id !== st.nonStriker);
  const over = Math.floor(st.legal / st.bpo);
  for (let i = 0; i < pool.length; i++) {
    const p = pool[(over + i) % pool.length];
    if (p.id !== inn.bowler) return p;
  }
  return null;
}

/** Players on this side still here who haven't batted for it yet. */
export function notBattedYet(m: Match, side: Side): Player[] {
  const done = new Set<string>();
  m.innings.forEach((inn, i) => { if (isSolo(m) || inn.bat === side) for (const id of replay(m, i).bat.keys()) done.add(id); });
  return activeTeam(m, side).players.filter((p) => !done.has(p.id));
}

/** Players on this side still here, and allowed to bowl, who haven't bowled for it yet. */
export function notBowledYet(m: Match, side: Side): Player[] {
  const done = new Set<string>();
  m.innings.forEach((inn, i) => { if (isSolo(m) || inn.bat !== side) for (const id of replay(m, i).bowl.keys()) done.add(id); });
  return activeTeam(m, side).players.filter((p) => !done.has(p.id) && !commonBarred(m, p.id));
}

/**
 * Limited overs: calls the match off now and the side ahead on runs per ball wins. Only once both sides have
 * faced a ball in this pair of innings. Undo takes it back. The Test draw is stopMatch.
 */
export function stopLeaderWins(m: Match): Match {
  const idx = m.innings.length - 1;
  if (isTest(m) || isSolo(m) || m.status !== "live" || idx % 2 !== 1) return m;
  if (!play(m, idx - 1).legal || !play(m, idx).legal) return m;
  const n = clone(m);
  n.stoppedLead = true;
  return settle(n);
}

function leadResult(m: Match): Result {
  const base = m.innings.length - 2, a = replay(m, base), b = replay(m, base + 1);
  const so = base >= 2, first = m.innings[base].bat, second = m.innings[base + 1].bat;
  const lhs = a.runs * b.legal, rhs = b.runs * a.legal;   // runs per ball, cross-multiplied
  if (lhs === rhs) return { text: "Match tied, match stopped: level on run rate", winner: null, tie: true, superOver: so, stopped: true };
  const winner = lhs > rhs ? first : second;
  return { text: `${m.teams[winner].name} win, match stopped: ahead on run rate`, winner, tie: false, superOver: so, stopped: true };
}

/** Adds a player mid-match. Solo puts them in the batting order; a side batting now gets one more wicket. */
export function addPlayer(m: Match, side: Side, name: string): { match: Match; id: string } {
  const n = clone(m), id = uid(), solo = isSolo(n), sides: Side[] = solo ? [0, 1] : [side];
  const inn = n.innings[n.innings.length - 1];
  const before = inn && !solo ? wicketLimit(activeTeam(n, inn.bat), n.rules, inn.solo) : 0;
  for (const s of sides) n.teams[s].players.push({ id, name: name.trim() });
  if (inn && !solo && !inn.superOver && n.status === "live" && inn.bat === side)
    inn.wicketLimit = Math.max(1, inn.wicketLimit + wicketLimit(activeTeam(n, side), n.rules, inn.solo) - before);
  return { match: settle(n), id };
}

/** A player went home: they can't bat or bowl again. Balls already played stay as they are. */
export function markLeft(m: Match, id: string): Match {
  if (hasLeft(m, id) || !m.teams.some((t) => t.players.some((p) => p.id === id))) return m;
  const n = clone(m), idx = n.innings.length - 1, inn = n.innings[idx];
  const shrink = !!inn && !isSolo(n) && !inn.superOver && n.status === "live"
    && n.teams[inn.bat].players.some((p) => p.id === id) && !replay(n, idx).bat.has(id);
  const before = shrink ? wicketLimit(activeTeam(n, inn.bat), n.rules, inn.solo) : 0;
  n.left = [...(n.left ?? []), id];
  if (shrink) inn.wicketLimit = Math.max(1, inn.wicketLimit + wicketLimit(activeTeam(n, inn.bat), n.rules, inn.solo) - before);
  return settle(n);
}

/** The ball went missing: a dead ball that doesn't count, kept with who was on strike for the lost-ball ledger. */
export function ballLost(m: Match, reason = "Ball lost"): Match {
  if (m.status !== "live") return m;
  const n = clone(m), idx = n.innings.length - 1, inn = n.innings[idx];
  inn.events.push({ t: "lost", reason: reason.trim() || "Ball lost", striker: replay(n, idx).striker, bowler: inn.bowler });
  return n;
}

export interface FeedItem { evIdx: number; label: string; ball?: Ball; lost?: string; penalty?: Penalty }

/** Ball-by-ball for one innings, over by over, with lost balls and penalty runs in place. */
export function ballByBall(m: Match, idx: number): FeedItem[][] {
  const out: FeedItem[][] = [], rules = rulesAt(m, idx);
  for (const { over, evIdx, ev } of replay(m, idx).feed)
    (out[over] ||= []).push(ev.t === "lost" ? { evIdx, label: "Lost", lost: ev.reason }
      : ev.t === "penalty" ? { evIdx, label: `Pen ${ev.runs > 0 ? "+" : ""}${ev.runs}`, penalty: ev }
      : { evIdx, label: ballLabel(ev, rules), ball: ev });
  return out;
}

/** Legal balls left in the innings, or null with no limit. */
export function ballsLeft(m: Match, idx: number): number | null {
  const st = replay(m, idx);
  return st.maxBalls === null ? null : Math.max(0, st.maxBalls - st.legal);
}

export interface PairRow { ids: [string, string | null]; names: string; runs: number; outs: number; balls: number }

/** Pairs: each pair's runs (after dismissal costs) and dismissals in one innings, best first. A pair batting twice is added up. */
export function pairStandings(m: Match, idx: number): PairRow[] {
  if (!isPairs(m) || !m.innings[idx]) return [];
  const rows = new Map<string, PairRow>();
  for (const b of replay(m, idx).blocks) {
    const key = b.ids.join("|"), row = rows.get(key) ?? { ids: b.ids, names: b.ids.filter(Boolean).map((id) => playerName(m, id)).join(" & "), runs: 0, outs: 0, balls: 0 };
    row.runs += b.runs; row.outs += b.outs; row.balls += b.legal;
    rows.set(key, row);
  }
  return [...rows.values()].sort((a, b) => b.runs - a.runs || a.outs - b.outs);
}

/**
 * A match that starts in the second innings: teams[0] batted first and set `target`, teams[1] chases.
 * It waits at the break; start the chase with startInnings as usual.
 */
export function startChase(teams: [Team, Team], rules: Rules, target: number, wicketsFallen = 0, now = Date.now()): Match {
  const m = newMatch(teams, rules), bpo = ballsPerOver(rules);
  m.toss = { winner: 0, choice: "bat" };
  m.innings.push({
    bat: 0, overs: rules.inningsBalls ? Math.ceil(rules.inningsBalls / bpo) : rules.overs, wicketLimit: wicketLimit(teams[0], rules),
    superOver: false, striker: "", nonStriker: null, bowler: "", bowlerSetAt: 0, events: [], closed: true,
    given: { runs: Math.max(0, Math.round(target) - 1), wickets: Math.max(0, Math.round(wicketsFallen)) },
  });
  m.status = "break";
  m.rulesLockedAt = now;
  return m;
}

/** Same teams and today's rules, ready for the toss. Players who went home stay out. */
export function rematch(m: Match, now = Date.now()): Match {
  const teams = clone(m).teams.map((t) => ({ ...t, players: t.players.filter((p) => !hasLeft(m, p.id)) })) as [Team, Team];
  return { ...newMatch(teams, clone(m).rules), createdAt: now, prevId: m.id };
}

export interface Tally { played: number; drawn: number; wins: { name: string; wins: number }[] }

/** Wins across this match's chain of rematches played the same day, most wins first. */
export function eveningTally(matches: Match[], m: Match): Tally {
  const day = new Date(m.createdAt).toDateString(), sameDay = (x: Match) => new Date(x.createdAt).toDateString() === day;
  const byId = new Map(matches.filter(sameDay).map((x) => [x.id, x]));
  byId.set(m.id, m);
  const chain = new Set<string>([m.id]);
  for (let cur: Match | undefined = m; cur?.prevId && byId.has(cur.prevId) && !chain.has(cur.prevId);) { chain.add(cur.prevId); cur = byId.get(cur.prevId); }
  for (let grew = true; grew;) {
    grew = false;
    for (const x of byId.values()) if (x.prevId && chain.has(x.prevId) && !chain.has(x.id)) { chain.add(x.id); grew = true; }
  }
  const wins = new Map<string, number>(isSolo(m) ? [] : m.teams.map((t) => [t.name, 0]));
  let played = 0, drawn = 0;
  for (const id of chain) {
    const res = result(byId.get(id)!);
    if (!res) continue;
    played++;
    const name = res.winnerId ? playerName(byId.get(id)!, res.winnerId) : res.winner !== null ? byId.get(id)!.teams[res.winner].name : null;
    if (name) wins.set(name, (wins.get(name) ?? 0) + 1); else drawn++;
  }
  return { played, drawn, wins: [...wins.entries()].map(([name, w]) => ({ name, wins: w })).sort((x, y) => y.wins - x.wins) };
}
