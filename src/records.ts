import * as E from "./engine/engine";
import type { Ball, Match, Side } from "./engine/types";
import { fmtOf, leaders, strikeRate, type Fmt, type Leader } from "./stats";

/** Gully Book: history, records and bragging rights. Every function takes saved matches and one format. */

const AUTO = /^player \d+$/i;
const named = (n: string) => !!n && !AUTO.test(n);
const low = (n: string) => n.trim().toLowerCase();
/** Solo matches are one group taking turns: player records count them, team records do not. */
const teamPool = (pool: Match[]) => pool.filter((m) => !E.isSolo(m));

/** Completed matches in one format, oldest first, so the earlier match keeps a tied record. */
export const finished = (ms: Match[], fmt: Fmt) =>
  ms.filter((m) => m.status === "done" && fmtOf(m) === fmt).sort((a, b) => a.createdAt - b.createdAt);

function cached<T>(fn: (m: Match) => T): (m: Match) => T {
  const memo = new WeakMap<Match, T>();
  return (m) => {
    if (!memo.has(m)) memo.set(m, fn(m));
    return memo.get(m)!;
  };
}

/** Matches are replaced, never mutated, so caching by object is safe. */
const states = cached((m) => m.innings.map((_, i) => E.replay(m, i)));

/** total: runs the ball scored (multipliers in, dismissal costs out). bat: runs the striker got. conceded: runs against the bowler. */
export interface Delivery {
  inn: number; ball: Ball; over: number; striker: string | null; nonStriker: string | null; outId: string | null; legal: boolean;
  total: number; bat: number; conceded: number;
}

const cut = (m: Match, i: number, k: number): Match =>
  ({ ...m, innings: [...m.innings.slice(0, i), { ...m.innings[i], events: m.innings[i].events.slice(0, k) }] });

/** Every ball with who faced it and who fell, read from the engine's own replay of each prefix. */
export const deliveries = cached((m): Delivery[][] => m.innings.map((inn, i) => {
  const out: Delivery[] = [];
  let before = E.replay(cut(m, i, 0), i);
  inn.events.forEach((ev, k) => {
    const after = E.replay(cut(m, i, k + 1), i);
    if (ev.t === "ball") {
      const fell = after.fow.length > before.fow.length ? after.fow[after.fow.length - 1].id : null;
      const bat = (st: E.State) => (before.striker ? st.bat.get(before.striker)?.runs ?? 0 : 0);
      const bowled = (st: E.State) => st.bowl.get(ev.bowler)?.runs ?? 0;
      out.push({
        inn: i, ball: ev, over: Math.floor(before.legal / before.bpo), striker: before.striker, nonStriker: before.nonStriker, outId: fell,
        legal: E.isLegal(ev, m.rules), total: after.runs + after.deducted - before.runs - before.deducted,
        bat: bat(after) - bat(before), conceded: bowled(after) - bowled(before),
      });
    }
    before = after;
  });
  return out;
}));

const isSix = (b: Ball) => b.runs === 6 && !b.wall && (b.extra === undefined || b.extra === "nb");
/** A wicket that fell and was the bowler's: not a run out, and not a protected player's free one. */
const bowlerWicket = (d: Delivery) => !!d.outId && !!d.ball.wicket && E.bowlerCredited(d.ball.wicket.kind);

export interface Over { inn: number; idx: number; bowler: string; runs: number; conceded: number; wickets: number; labels: string[]; bat: Map<string, { runs: number; sixes: number }> }

/** Overs of every innings; the bowler is whoever bowled most of it. */
export const overs = cached((m): Over[] => deliveries(m).flatMap((ds, inn) => {
  const byIdx = new Map<number, Delivery[]>();
  for (const d of ds) byIdx.set(d.over, [...(byIdx.get(d.over) ?? []), d]);
  return [...byIdx.entries()].map(([idx, list]) => {
    const count = new Map<string, number>(), bat = new Map<string, { runs: number; sixes: number }>();
    for (const { ball, striker, bat: runs } of list) {
      count.set(ball.bowler, (count.get(ball.bowler) ?? 0) + 1);
      if (!striker) continue;
      const r = bat.get(striker) ?? { runs: 0, sixes: 0 };
      r.runs += runs; if (isSix(ball)) r.sixes++;
      bat.set(striker, r);
    }
    const bowler = [...count.entries()].sort((a, b) => b[1] - a[1])[0][0];
    return {
      inn, idx, bowler, bat, labels: list.map((d) => E.ballLabel(d.ball)),
      runs: list.reduce((s, d) => s + d.total, 0),
      conceded: list.reduce((s, d) => s + d.conceded, 0),
      wickets: list.filter((d) => d.outId).length,
    };
  });
}));

/** Highest key wins, compared left to right. The first item keeps a tie. */
function best<T>(items: Iterable<T>, key: (x: T) => number[]): T | null {
  let top: T | null = null, topKey: number[] = [];
  for (const x of items) {
    const k = key(x), i = k.findIndex((v, j) => v !== topKey[j]);
    if (top === null || (i >= 0 && k[i] > topKey[i])) { top = x; topKey = k; }
  }
  return top;
}

// ---------- Overview ----------

export interface Overview { played: number; completed: number; runs: number; wickets: number; sixes: number; fours: number; ducks: number; first: number | null; last: number | null }

/** Played counts any match with an innings started; every total is from completed matches. */
export function overview(matches: Match[], fmt: Fmt): Overview {
  const played = matches.filter((m) => fmtOf(m) === fmt && m.innings.length).map((m) => m.createdAt);
  const o: Overview = { played: played.length, completed: 0, runs: 0, wickets: 0, sixes: 0, fours: 0, ducks: 0,
    first: played.length ? Math.min(...played) : null, last: played.length ? Math.max(...played) : null };
  for (const m of finished(matches, fmt)) {
    o.completed++;
    for (const st of states(m)) {
      o.runs += st.runs; o.wickets += st.wickets;
      for (const b of st.bat.values()) { o.sixes += b.sixes; o.fours += b.fours; if (isDuck(b)) o.ducks++; }
    }
  }
  return o;
}

const isDuck = (b: E.BatStat) => !!b.out && b.runs === 0;
const isGolden = (b: E.BatStat) => isDuck(b) && b.balls === 1;

// ---------- Records ----------

export interface Rec { value: number; text: string; name: string; matchId: string; date: number }

export interface Records {
  highestScore: Rec | null; bestBowling: Rec | null; mostSixesInnings: Rec | null;
  highestTotal: Rec | null; lowestAllOut: Rec | null;
  closestFinish: Rec | null; biggestWinRuns: Rec | null; biggestWinWickets: Rec | null;
  mostRunsInOver: Rec | null; biggestCollapse: Rec | null;
}

const rec = (m: Match, name: string, value: number, text: string): Rec => ({ value, text, name, matchId: m.id, date: m.createdAt });

interface BatInn { m: Match; b: E.BatStat; name: string }
interface BowlInn { m: Match; w: E.BowlStat; name: string }
interface TeamInn { m: Match; st: E.State; name: string }

const batInnings = (pool: Match[]): BatInn[] => pool.flatMap((m) =>
  states(m).flatMap((st) => [...st.bat.values()].map((b) => ({ m, b, name: E.playerName(m, b.id) })))).filter((x) => named(x.name));
const bowlInnings = (pool: Match[]): BowlInn[] => pool.flatMap((m) =>
  states(m).flatMap((st) => [...st.bowl.values()].map((w) => ({ m, w, name: E.playerName(m, w.id) })))).filter((x) => named(x.name));
/** Team innings, super overs and scores carried in from elsewhere left out. */
const teamInnings = (pool: Match[]): TeamInn[] => teamPool(pool).flatMap((m) =>
  states(m).flatMap((st, i) => (m.innings[i].superOver || m.innings[i].given ? [] : [{ m, st, name: m.teams[m.innings[i].bat].name }])));

const score = (b: E.BatStat) => `${b.runs}${b.out ? "" : "*"} (${b.balls})`;

export function highestScore(pool: Match[]): Rec | null {
  const x = best(batInnings(pool), ({ b }) => [b.runs, b.out ? 0 : 1, -b.balls]);
  return x ? rec(x.m, x.name, x.b.runs, score(x.b)) : null;
}

export function bestBowling(pool: Match[]): Rec | null {
  const x = best(bowlInnings(pool).filter(({ w }) => w.wickets > 0), ({ w }) => [w.wickets, -w.runs]);
  return x ? rec(x.m, x.name, x.w.wickets, `${x.w.wickets}/${x.w.runs}`) : null;
}

export function mostSixesInnings(pool: Match[]): Rec | null {
  const x = best(batInnings(pool).filter(({ b }) => b.sixes > 0), ({ b }) => [b.sixes, b.runs]);
  return x ? rec(x.m, x.name, x.b.sixes, `${x.b.sixes} sixes in ${score(x.b)}`) : null;
}

export function highestTotal(pool: Match[]): Rec | null {
  const x = best(teamInnings(pool), ({ st }) => [st.runs, -st.wickets]);
  return x ? rec(x.m, x.name, x.st.runs, `${x.st.runs}/${x.st.wickets} (${E.oversText(x.st.legal, x.st.bpo)} ov)`) : null;
}

export function lowestAllOut(pool: Match[]): Rec | null {
  const x = best(teamInnings(pool).filter(({ st }) => st.allOut), ({ st }) => [-st.runs, st.legal]);
  return x ? rec(x.m, x.name, x.st.runs, `${x.st.runs} all out (${E.oversText(x.st.legal, x.st.bpo)} ov)`) : null;
}

export interface Margin { winner: Side | null; kind: "runs" | "wickets" | "innings" | "tie" | "super over" | "draw"; value: number; ballsLeft: number | null; text: string }

/** How a completed match was won, with numbers instead of the result sentence. */
export function margin(m: Match): Margin | null {
  const res = E.isSolo(m) ? null : E.result(m);
  if (!res) return null;
  const base = { winner: res.winner, value: 0, ballsLeft: null, text: res.text };
  if (res.draw) return { ...base, kind: "draw" };
  if (res.tie) return { ...base, kind: "tie" };
  if (res.superOver) return { ...base, kind: "super over" };
  return E.isTest(m) ? testMargin(m, res.winner!, base) : limitedMargin(m, base);
}

/** Pairs is always won on runs: the chasing side bats out its overs. */
function limitedMargin(m: Match, base: Omit<Margin, "kind">): Margin {
  const [a, b] = states(m), chase = m.innings[1];
  if (E.isPairs(m)) return { ...base, kind: "runs", value: Math.abs(a.runs - b.runs) };
  if (b.runs > a.runs) return { ...base, kind: "wickets", value: chase.wicketLimit - b.wickets, ballsLeft: Math.max(0, (b.maxBalls ?? chase.overs * 6) - b.legal) };
  return { ...base, kind: "runs", value: a.runs - b.runs };
}

function testMargin(m: Match, winner: Side, base: Omit<Margin, "kind">): Margin {
  const st = states(m), n = m.innings.length;
  if (n === 4 && m.innings[3].bat === winner) return { ...base, kind: "wickets", value: m.innings[3].wicketLimit - st[3].wickets };
  const t = [0, 0];
  m.innings.forEach((inn, i) => { t[inn.bat] += st[i].runs; });
  const once = m.innings.filter((inn) => inn.bat === winner).length === 1;
  return { ...base, kind: once ? "innings" : "runs", value: t[winner] - t[E.otherSide(winner)] };
}

const lastBall = (g: Margin) => g.kind === "wickets" && g.ballsLeft === 0;
/** 0 for a tie or super over, 1 for a chase won off the last ball, else 1 + the margin. Draws have none. */
export function closeness(g: Margin): number | null {
  if (g.kind === "draw") return null;
  if (g.kind === "tie" || g.kind === "super over") return 0;
  return lastBall(g) ? 1 : 1 + g.value;
}

const winnerName = (m: Match, g: Margin) => (g.winner === null ? `${m.teams[0].name} and ${m.teams[1].name}` : m.teams[g.winner].name);
const margins = (pool: Match[]) => pool.map((m) => ({ m, g: margin(m)! })).filter((x) => x.g);

export function closestFinish(pool: Match[]): Rec | null {
  const x = best(margins(pool).filter(({ g }) => closeness(g) !== null), ({ g }) => [-closeness(g)!]);
  return x ? rec(x.m, winnerName(x.m, x.g), closeness(x.g)!, `${x.g.text}${lastBall(x.g) ? ", off the last ball" : ""}`) : null;
}

export function biggestWinRuns(pool: Match[]): Rec | null {
  const x = best(margins(pool).filter(({ g }) => g.kind === "runs" || g.kind === "innings"), ({ g }) => [g.value, g.kind === "innings" ? 1 : 0]);
  return x ? rec(x.m, winnerName(x.m, x.g), x.g.value, x.g.text) : null;
}

export function biggestWinWickets(pool: Match[]): Rec | null {
  const x = best(margins(pool).filter(({ g }) => g.kind === "wickets"), ({ g }) => [g.value, g.ballsLeft ?? 0]);
  return x ? rec(x.m, winnerName(x.m, x.g), x.g.value, `${x.g.text}${x.g.ballsLeft ? `, ${x.g.ballsLeft} balls left` : ""}`) : null;
}

const allOvers = (pool: Match[]) => pool.flatMap((m) => overs(m).map((o) => ({ m, o, name: E.playerName(m, o.bowler) })));

export function mostRunsInOver(pool: Match[]): Rec | null {
  const x = best(allOvers(pool).filter((x) => named(x.name)), ({ o }) => [o.runs]);
  return x ? rec(x.m, x.name, x.o.runs, `${x.o.runs} off over ${x.o.idx + 1}: ${x.o.labels.join(" ")}`) : null;
}

/** Most wickets for fewest runs in any 3 overs in a row (the whole innings if shorter). Needs 2 wickets. Not pairs: nobody is out there. */
export function biggestCollapse(pool: Match[]): Rec | null {
  const wins = teamPool(pool).filter((m) => !E.isPairs(m)).flatMap((m) => m.innings.flatMap((inn, i) => {
    if (inn.superOver) return [];
    const os = overs(m).filter((o) => o.inn === i).sort((a, b) => a.idx - b.idx);
    return os.slice(0, Math.max(1, os.length - 2)).map((_, s) => {
      const w = os.slice(s, s + 3);
      return { m, team: m.teams[inn.bat].name, from: w[0].idx, to: w[w.length - 1].idx, wickets: w.reduce((n, o) => n + o.wickets, 0), runs: w.reduce((n, o) => n + o.runs, 0) };
    });
  })).filter((w) => w.wickets >= 2);
  const x = best(wins, (w) => [w.wickets, -w.runs]);
  return x ? rec(x.m, x.team, x.wickets, `${x.wickets} wickets for ${x.runs} runs, overs ${x.from + 1} to ${x.to + 1}`) : null;
}

export function records(matches: Match[], fmt: Fmt): Records {
  const pool = finished(matches, fmt);
  return {
    highestScore: highestScore(pool), bestBowling: bestBowling(pool), mostSixesInnings: mostSixesInnings(pool),
    highestTotal: highestTotal(pool), lowestAllOut: lowestAllOut(pool),
    closestFinish: closestFinish(pool), biggestWinRuns: biggestWinRuns(pool), biggestWinWickets: biggestWinWickets(pool),
    mostRunsInOver: mostRunsInOver(pool), biggestCollapse: biggestCollapse(pool),
  };
}

// ---------- Career speed ----------

export const SPEED_MARKS = [50, 100, 200, 500, 1000] as const;
export interface SpeedRow { name: string; balls: number; innings: number; matchId: string; date: number }
export interface SpeedBoard { runs: number; rows: SpeedRow[] }

/** Fewest balls faced, over a whole career and not one innings, to reach each run mark. Top three per mark. */
export function careerSpeed(matches: Match[], fmt: Fmt, top = 3): SpeedBoard[] {
  const acc = new Map<string, { name: string; runs: number; balls: number; inns: number; hit: Map<number, SpeedRow> }>();
  for (const m of finished(matches, fmt)) {
    deliveries(m).forEach((ds) => {
      const seen = new Set<string>();
      for (const d of ds) {
        if (!d.striker) continue;
        const name = E.playerName(m, d.striker);
        if (!named(name)) continue;
        const a = acc.get(low(name)) ?? { name, runs: 0, balls: 0, inns: 0, hit: new Map() };
        acc.set(low(name), a);
        if (!seen.has(low(name))) { seen.add(low(name)); a.inns += 1; }
        if (d.ball.extra !== "wd") a.balls += 1;
        a.runs += d.bat;
        for (const t of SPEED_MARKS) if (a.runs >= t && !a.hit.has(t)) a.hit.set(t, { name: a.name, balls: a.balls, innings: a.inns, matchId: m.id, date: m.createdAt });
      }
    });
  }
  return SPEED_MARKS.map((runs) => ({
    runs,
    rows: [...acc.values()].flatMap((a) => a.hit.get(runs) ?? [])
      .sort((x, y) => x.balls - y.balls || x.innings - y.innings || x.date - y.date).slice(0, top),
  }));
}

// ---------- Milestones ----------

export type MilestoneKind = "25" | "50" | "100" | "3w" | "5w" | "hatTrick" | "fiveSixesOver" | "thirtyOver" | "goldenDuck" | "maiden";

export const MILESTONES: Record<MilestoneKind, string> = {
  "25": "First 25", "50": "First 50", "100": "First 100", "3w": "Three wickets", "5w": "Five wickets",
  hatTrick: "Hat-trick", fiveSixesOver: "5 sixes in an over", thirtyOver: "30 runs in an over", goldenDuck: "Golden duck", maiden: "Maiden over",
};

/** First time it happened, and how many times since. */
export interface Milestone { kind: MilestoneKind; label: string; matchId: string; date: number; count: number }
export interface PlayerMilestones { name: string; items: Milestone[] }

export function milestones(matches: Match[], fmt: Fmt): PlayerMilestones[] {
  const rows = new Map<string, { name: string; got: Map<MilestoneKind, Milestone> }>();
  const hit = (m: Match, id: string, kind: MilestoneKind, n = 1) => {
    const name = E.playerName(m, id);
    if (!named(name) || n <= 0) return;
    const row = rows.get(low(name)) ?? { name, got: new Map() };
    const prev = row.got.get(kind);
    row.got.set(kind, prev ? { ...prev, count: prev.count + n } : { kind, label: MILESTONES[kind], matchId: m.id, date: m.createdAt, count: n });
    rows.set(low(name), row);
  };
  for (const m of finished(matches, fmt)) {
    states(m).forEach((st) => {
      for (const b of st.bat.values()) {
        for (const t of [25, 50, 100] as const) if (b.runs >= t) hit(m, b.id, `${t}`);
        if (isGolden(b)) hit(m, b.id, "goldenDuck");
      }
      for (const w of st.bowl.values()) {
        if (w.wickets >= 3) hit(m, w.id, "3w");
        if (w.wickets >= 5) hit(m, w.id, "5w");
        hit(m, w.id, "maiden", w.maidens);
      }
    });
    for (const o of overs(m)) for (const [id, r] of o.bat) {
      if (r.sixes >= 5) hit(m, id, "fiveSixesOver");
      if (r.runs >= 30) hit(m, id, "thirtyOver");
    }
    deliveries(m).forEach((ds) => hatTricks(ds).forEach((id) => hit(m, id, "hatTrick")));
  }
  const order = Object.keys(MILESTONES) as MilestoneKind[];
  return [...rows.values()]
    .map((r) => ({ name: r.name, items: order.flatMap((k) => r.got.get(k) ?? []) }))
    .sort((a, b) => b.items.length - a.items.length || a.name.localeCompare(b.name));
}

/** Bowler ids, once per hat-trick. Wides and no-balls in between neither count nor break it; 4 in 4 is two. */
export function hatTricks(ds: Delivery[]): string[] {
  const run = new Map<string, number>(), out: string[] = [];
  for (const d of ds) {
    if (!d.legal) continue;
    const n = bowlerWicket(d) ? (run.get(d.ball.bowler) ?? 0) + 1 : 0;
    run.set(d.ball.bowler, n);
    if (n >= 3) out.push(d.ball.bowler);
  }
  return out;
}

// ---------- Hall of shame ----------

export interface ShameRow { name: string; value: number; text?: string; matchId?: string; date?: number }
export interface HallOfShame { ducks: ShameRow[]; goldenDucks: ShameRow[]; runOutsSuffered: ShameRow[]; runOutsCaused: ShameRow[]; extrasBowled: ShameRow[]; expensiveOvers: ShameRow[] }

class Tally {
  rows = new Map<string, ShameRow>();
  add(name: string, n = 1) {
    if (!named(name) || n <= 0) return;
    const r = this.rows.get(low(name)) ?? { name, value: 0 };
    r.value += n;
    this.rows.set(low(name), r);
  }
  /** Keeps each player's single worst entry. */
  worst(row: ShameRow) {
    if (!named(row.name)) return;
    const prev = this.rows.get(low(row.name));
    if (!prev || row.value > prev.value) this.rows.set(low(row.name), row);
  }
  top(limit: number) {
    return [...this.rows.values()].sort((a, b) => b.value - a.value || a.name.localeCompare(b.name)).slice(0, limit);
  }
}

/**
 * Run-outs caused credits the partner who stayed in, since the app does not record who called the run.
 * Solo innings have no partner, so nobody is credited there.
 */
export function hallOfShame(matches: Match[], fmt: Fmt, limit = 5): HallOfShame {
  const ducks = new Tally(), golden = new Tally(), suffered = new Tally(), caused = new Tally(), extras = new Tally(), expensive = new Tally();
  for (const m of finished(matches, fmt)) {
    for (const st of states(m)) {
      for (const b of st.bat.values()) {
        const name = E.playerName(m, b.id);
        if (isDuck(b)) ducks.add(name);
        if (isGolden(b)) golden.add(name);
        if (b.out?.kind === "run out") suffered.add(name);
      }
      for (const w of st.bowl.values()) extras.add(E.playerName(m, w.id), w.wides + w.noBalls);
    }
    for (const d of deliveries(m).flat()) {
      if (d.ball.wicket?.kind !== "run out" || !d.outId) continue;
      const partner = [d.striker, d.nonStriker].find((id) => id && id !== d.outId);
      if (partner) caused.add(E.playerName(m, partner));
    }
    for (const o of overs(m)) if (o.conceded > 0) {
      expensive.worst({ name: E.playerName(m, o.bowler), value: o.conceded, text: o.labels.join(" "), matchId: m.id, date: m.createdAt });
    }
  }
  return { ducks: ducks.top(limit), goldenDucks: golden.top(limit), runOutsSuffered: suffered.top(limit), runOutsCaused: caused.top(limit), extrasBowled: extras.top(limit), expensiveOvers: expensive.top(limit) };
}

// ---------- Streaks ----------

export interface Streak { current: number; best: number }
export interface PlayerStreaks { name: string; tens: Streak; wickets: Streak }

const step = (s: Streak, ok: boolean): Streak => {
  const current = ok ? s.current + 1 : 0;
  return { current, best: Math.max(s.best, current) };
};

/** One match's batting and bowling per player name. Players who did neither are left out. */
function matchLines(m: Match) {
  const out = new Map<string, { name: string; batted: boolean; runs: number; bowled: boolean; wickets: number }>();
  const get = (id: string) => {
    const name = E.playerName(m, id);
    const r = out.get(low(name)) ?? { name, batted: false, runs: 0, bowled: false, wickets: 0 };
    out.set(low(name), r);
    return r;
  };
  for (const st of states(m)) {
    for (const b of st.bat.values()) { const r = get(b.id); r.batted = true; r.runs += b.runs; }
    for (const w of st.bowl.values()) { const r = get(w.id); r.bowled = true; r.wickets += w.wickets; }
  }
  return out;
}

/**
 * Matches in a row scoring 10 or more, and with a wicket. A match where the player
 * did not bat (or bowl) is skipped, not a break.
 */
export function playerStreaks(matches: Match[], fmt: Fmt): PlayerStreaks[] {
  const rows = new Map<string, PlayerStreaks>();
  for (const m of finished(matches, fmt)) for (const [key, l] of matchLines(m)) {
    if (!named(l.name)) continue;
    const r = rows.get(key) ?? { name: l.name, tens: { current: 0, best: 0 }, wickets: { current: 0, best: 0 } };
    if (l.batted) r.tens = step(r.tens, l.runs >= 10);
    if (l.bowled) r.wickets = step(r.wickets, l.wickets > 0);
    rows.set(key, r);
  }
  return [...rows.values()].sort((a, b) => b.tens.best + b.wickets.best - (a.tens.best + a.wickets.best) || a.name.localeCompare(b.name));
}

export interface TeamStreak extends Streak { name: string }

/** Winning runs for saved teams, matched to match sides by name. A tie, draw or loss ends the run. */
export function teamStreaks(matches: Match[], teams: { name: string }[], fmt: Fmt): TeamStreak[] {
  const pool = teamPool(finished(matches, fmt));
  return teams.map(({ name }) => {
    let s: Streak = { current: 0, best: 0 };
    for (const m of pool) {
      const side = m.teams.findIndex((t) => low(t.name) === low(name));
      if (side < 0) continue;
      s = step(s, E.result(m)?.winner === side);
    }
    return { name, ...s };
  });
}

// ---------- Head to head ----------

export interface Duel { batter: string; bowler: string; runs: number; balls: number; dismissals: number; strikeRate: number }

/** A batting against B bowling and the reverse. Run outs are not the bowler's, so they are not dismissals. */
export function headToHead(matches: Match[], a: string, b: string, fmt: Fmt): { aBatting: Duel; bBatting: Duel } {
  const duel = (bat: string, bowl: string): Duel => {
    const d: Duel = { batter: bat, bowler: bowl, runs: 0, balls: 0, dismissals: 0, strikeRate: 0 };
    for (const m of finished(matches, fmt)) for (const x of deliveries(m).flat()) {
      if (low(E.playerName(m, x.ball.bowler)) !== low(bowl)) continue;
      const faced = x.striker && low(E.playerName(m, x.striker)) === low(bat);
      if (faced && x.ball.extra !== "wd") { d.balls++; d.runs += x.bat; }
      if (bowlerWicket(x) && low(E.playerName(m, x.outId!)) === low(bat)) d.dismissals++;
    }
    return { ...d, strikeRate: strikeRate(d.runs, d.balls) };
  };
  return { aBatting: duel(a, b), bBatting: duel(b, a) };
}

/** The batter and bowler who have faced each other most balls, in either direction. */
export function busiestDuel(matches: Match[], fmt: Fmt): [string, string] | null {
  const pairs = new Map<string, { a: string; b: string; n: number }>();
  for (const m of finished(matches, fmt)) for (const x of deliveries(m).flat()) {
    if (!x.striker || x.ball.extra === "wd") continue;
    const bat = E.playerName(m, x.striker), bowl = E.playerName(m, x.ball.bowler);
    if (!named(bat) || !named(bowl) || low(bat) === low(bowl)) continue;
    const [a, b] = low(bat) < low(bowl) ? [bat, bowl] : [bowl, bat], key = `${low(a)}|${low(b)}`;
    const e = pairs.get(key) ?? { a, b, n: 0 };
    e.n++;
    pairs.set(key, e);
  }
  const top = [...pairs.values()].sort((x, y) => y.n - x.n || x.a.localeCompare(y.a) || x.b.localeCompare(y.b))[0];
  return top ? [top.a, top.b] : null;
}

// ---------- Team rivalry ----------

export interface RivalryResult { matchId: string; date: number; text: string; winner: string | null }
export interface BiggestWin { byRuns: Rec | null; byWickets: Rec | null }
export interface Rivalry { a: string; b: string; played: number; wonA: number; wonB: number; tied: number; drawn: number; last5: RivalryResult[]; biggestA: BiggestWin; biggestB: BiggestWin }

export function rivalry(matches: Match[], a: string, b: string, fmt: Fmt): Rivalry {
  const pool = teamPool(finished(matches, fmt)).filter((m) => {
    const names = m.teams.map((t) => low(t.name));
    return names.includes(low(a)) && names.includes(low(b)) && low(a) !== low(b);
  });
  const winnerOf = (m: Match) => { const w = margin(m)?.winner; return w == null ? null : m.teams[w].name; };
  const wonBy = (n: string) => pool.filter((m) => low(winnerOf(m) ?? "") === low(n));
  const biggest = (n: string): BiggestWin => ({ byRuns: biggestWinRuns(wonBy(n)), byWickets: biggestWinWickets(wonBy(n)) });
  const kinds = pool.map((m) => margin(m)!.kind);
  return {
    a, b, played: pool.length, wonA: wonBy(a).length, wonB: wonBy(b).length,
    tied: kinds.filter((k) => k === "tie").length, drawn: kinds.filter((k) => k === "draw").length,
    last5: [...pool].reverse().slice(0, 5).map((m) => ({ matchId: m.id, date: m.createdAt, text: E.result(m)!.text, winner: winnerOf(m) })),
    biggestA: biggest(a), biggestB: biggest(b),
  };
}

// ---------- Rating ----------

/** Rating = (runs + 20 × wickets + 2 × sixes + 10 × (catches + run outs + stumpings)) ÷ matches, one decimal. */
export const rating = (l: Leader) =>
  l.matches ? Math.round(((l.runs + 20 * l.wickets + 2 * l.sixes + 10 * (l.catches + l.runOuts + l.stumpings)) / l.matches) * 10) / 10 : 0;

export interface Rated { name: string; matches: number; rating: number }

/** Best player first, only those with at least minMatches completed matches. */
export function ranking(matches: Match[], fmt: Fmt, minMatches = 3): Rated[] {
  return leaders(finished(matches, fmt), fmt)
    .filter((l) => l.matches >= minMatches)
    .map((l) => ({ name: l.name, matches: l.matches, rating: rating(l) }))
    .sort((a, b) => b.rating - a.rating || b.matches - a.matches || a.name.localeCompare(b.name));
}

export const bestPlayer = (matches: Match[], fmt: Fmt, minMatches = 3): Rated | null => ranking(matches, fmt, minMatches)[0] ?? null;

/** Ratings by lower-case name with no cutoff. Someone with no matches gets the average of the rest. */
export function ratingsFor(matches: Match[], names: string[], fmt: Fmt): Record<string, number> {
  const known = new Map(ranking(matches, fmt, 1).map((r) => [low(r.name), r.rating]));
  const have = names.map(low).filter((n) => known.has(n)).map((n) => known.get(n)!);
  const avg = have.length ? have.reduce((s, x) => s + x, 0) / have.length : 0;
  return Object.fromEntries(names.map((n) => [low(n), known.get(low(n)) ?? avg]));
}

// ---------- Fair teams ----------

export interface FairSplit { a: string[]; b: string[]; common: string | null; ratingA: number; ratingB: number; diff: number }

const EXHAUSTIVE_MAX = 22, CHOICES = 64;

const mix = (x: number) => {
  x = Math.imul(x ^ (x >>> 16), 0x45d9f3b);
  x = Math.imul(x ^ (x >>> 16), 0x45d9f3b);
  return (x ^ (x >>> 16)) >>> 0;
};

/**
 * Two equal sides with the closest total rating. Seed 0 is the closest split; each next seed
 * gives another split close to it, so "reshuffle" changes teams but stays fair.
 * With an odd count and no common player, the lowest rated plays for both.
 */
export function fairTeams(names: string[], ratings: Record<string, number>, opts: { common?: string | null; seed?: number } = {}): FairSplit {
  const seen = new Set<string>();
  let pool = names.map((n) => n.trim()).filter((n) => n && !seen.has(low(n)) && seen.add(low(n)))
    .sort((a, b) => low(a).localeCompare(low(b)));
  const given = Object.values(ratings), avg = given.length ? given.reduce((s, x) => s + x, 0) / given.length : 0;
  const rate = (n: string) => ratings[low(n)] ?? avg;
  let common = opts.common?.trim() || null;
  if (common) pool = pool.filter((n) => low(n) !== low(common!));
  else if (pool.length % 2) {
    common = [...pool].sort((x, y) => rate(x) - rate(y))[0];
    pool = pool.filter((n) => n !== common);
  }
  const seed = Math.abs(Math.floor(opts.seed ?? 0));
  const inA = pool.length <= EXHAUSTIVE_MAX ? exhaustive(pool.map(rate), seed) : greedy(pool.map(rate), seed);
  const a = pool.filter((_, i) => inA[i]), b = pool.filter((_, i) => !inA[i]);
  const sum = (xs: string[]) => Math.round(xs.reduce((s, n) => s + rate(n), 0) * 10) / 10;
  const ratingA = sum(a), ratingB = sum(b);
  return { a, b, common, ratingA, ratingB, diff: Math.round(Math.abs(ratingA - ratingB) * 10) / 10 };
}

/** Every split with player 0 on side A (an even count would otherwise list each split twice). */
function exhaustive(r: number[], seed: number): boolean[] {
  const n = r.length, size = Math.ceil(n / 2), total = r.reduce((s, x) => s + x, 0);
  const splits: { mask: number; diff: number }[] = [];
  const walk = (i: number, left: number, mask: number, sum: number) => {
    if (left === 0) { splits.push({ mask, diff: Math.round(Math.abs(2 * sum - total) * 1e6) / 1e6 }); return; }
    if (n - i < left) return;
    walk(i + 1, left - 1, mask | (1 << i), sum + r[i]);
    if (!(i === 0 && n % 2 === 0)) walk(i + 1, left, mask, sum);
  };
  walk(0, size, 0, 0);
  const min = Math.min(...splits.map((s) => s.diff)), tol = Math.max(1, Math.abs(total) * 0.05);
  const fair = splits.filter((s) => s.diff <= min + tol).sort((x, y) => x.diff - y.diff || mix(x.mask) - mix(y.mask)).slice(0, CHOICES);
  const pick = fair[seed % fair.length].mask;
  return r.map((_, i) => !!(pick & (1 << i)));
}

/** Big groups: snake draft from a seeded start, then swap pairs while it brings the totals closer. */
function greedy(r: number[], seed: number): boolean[] {
  const n = r.length, order = r.map((_, i) => i).sort((x, y) => r[y] - r[x] || mix(x + seed) - mix(y + seed));
  const inA = new Array<boolean>(n).fill(false);
  order.forEach((p, k) => { inA[p] = k % 4 === 0 || k % 4 === 3; });
  const gap = () => Math.abs(r.reduce((s, x, i) => s + (inA[i] ? x : -x), 0));
  for (let improved = true; improved;) {
    improved = false;
    for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) {
      if (!inA[i] || inA[j]) continue;
      const before = gap();
      inA[i] = false; inA[j] = true;
      if (gap() < before - 1e-9) improved = true; else { inA[i] = true; inA[j] = false; }
    }
  }
  return inA;
}
