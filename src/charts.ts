import * as E from "./engine/engine";
import type { Match, Side } from "./engine/types";
import { deliveries } from "./records";

/** Chart data for one match, platform free: the web draws it with inline SVG, the app with react-native-svg. */

/** Innings worth charting: super overs are left out, so the worm compares like with like. */
export const chartInnings = (m: Match): number[] =>
  m.innings.flatMap((inn, i) => (inn.superOver ? [] : [i]));

export interface Point { x: number; y: number }
export interface Line {
  idx: number; label: string;
  side: Side;   // batting side; solo turns are always 0
  nth: number;   // 0 for a side's first innings, 1 for its second (Test)
  batter?: string;   // solo: whose turn it was
  points: Point[];
  wickets: Point[];
}

interface Step { legal: number; runs: number; over: number; wicket: boolean }
interface Track { bpo: number; start: number; steps: Step[]; maxBalls: number | null }

const cut = (m: Match, i: number, k: number): Match =>
  ({ ...m, innings: [...m.innings.slice(0, i), { ...m.innings[i], events: m.innings[i].events.slice(0, k) }] });

const memo = new WeakMap<Match, Track[]>();
/** Score after every ball and penalty, read from the engine's own replay of each prefix, so multipliers,
 *  dismissal costs and penalties all count. Penalties that land here from a later innings go in at the start. */
function tracks(m: Match): Track[] {
  let t = memo.get(m);
  if (!t) {
    t = m.innings.map((inn, i) => {
      const full = E.replay(m, i), steps: Step[] = [];
      let before = E.replay(cut(m, i, 0), i);
      inn.events.forEach((ev, k) => {
        if (ev.t !== "ball" && ev.t !== "penalty") return;
        const after = E.replay(cut(m, i, k + 1), i);
        steps.push({ legal: after.legal, runs: after.runs, over: Math.floor(before.legal / full.bpo), wicket: after.wickets > before.wickets });
        before = after;
      });
      const shift = full.runs - (steps.length ? steps[steps.length - 1].runs : before.runs);
      for (const st of steps) st.runs += shift;
      return { bpo: full.bpo, start: E.replay(cut(m, i, 0), i).runs + shift, steps, maxBalls: full.maxBalls };
    });
    memo.set(m, t);
  }
  return t;
}

/** Short name for a legend: the team, a Test innings or the solo batter. */
export function lineLabel(m: Match, idx: number): string {
  const inn = m.innings[idx];
  if (E.isSolo(m)) return E.inningsLabel(m, idx);
  const name = m.teams[inn.bat].name;
  return E.isTest(m) ? `${name}, ${E.inningsLabel(m, idx)}` : name;
}

function nthOf(m: Match, idx: number): number {
  const side = m.innings[idx].bat;
  return m.innings.slice(0, idx).filter((x) => x.bat === side && !x.superOver).length;
}

/** Worm: cumulative runs against overs, one line per innings, with a dot where each wicket fell. */
export function worm(m: Match): Line[] {
  const all = tracks(m);
  return chartInnings(m).map((idx) => {
    const { bpo, start, steps } = all[idx], inn = m.innings[idx];
    const points: Point[] = [{ x: 0, y: start }], wickets: Point[] = [];
    steps.forEach((st, k) => {
      if (st.wicket) wickets.push({ x: st.legal / bpo, y: st.runs });
      if (k === steps.length - 1 || steps[k + 1].over !== st.over) points.push({ x: st.legal / bpo, y: st.runs });
    });
    return { idx, label: lineLabel(m, idx), side: inn.bat, nth: nthOf(m, idx), batter: E.isSolo(m) ? inn.striker : undefined, points, wickets };
  });
}

/** Legal balls an innings can last, in overs, for the x axis. 0 with no limit. */
export const inningsOvers = (m: Match, idx: number) => {
  const t = tracks(m)[idx];
  return t?.maxBalls ? t.maxBalls / t.bpo : 0;
};

export interface OverBar { over: number; runs: number; wickets: number }

/** Manhattan: runs and wickets in each over of one innings. */
export function manhattan(m: Match, idx: number): OverBar[] {
  const t = tracks(m)[idx];
  if (!t) return [];
  const out: OverBar[] = [];
  let prev = t.start;
  for (const st of t.steps) {
    const bar = (out[st.over] ||= { over: st.over + 1, runs: 0, wickets: 0 });
    bar.runs += st.runs - prev; prev = st.runs;
    if (st.wicket) bar.wickets++;
  }
  return Array.from(out, (b, o) => b ?? { over: o + 1, runs: 0, wickets: 0 });
}

export interface RateLine extends Line { required: (number | null)[] }

/**
 * Run rate after each over for every innings. A limited-overs chase also gets the rate it still needs,
 * read at the same over ends (null once nothing is needed or no balls are left).
 */
export function runRates(m: Match): RateLine[] {
  const chase = !E.isTest(m) && !E.isSolo(m), all = tracks(m);
  return worm(m).map((line) => {
    const tgt = chase ? E.target(m, line.idx) : null, { bpo, maxBalls } = all[line.idx];
    const points = line.points.slice(1).map((p) => ({ x: p.x, y: p.x ? p.y / p.x : 0 }));
    const required = line.points.slice(1).map((p) => {
      if (tgt === null || maxBalls === null) return null;
      const need = tgt - p.y, left = maxBalls - Math.round(p.x * bpo);
      return need > 0 && left > 0 ? (need * bpo) / left : null;
    });
    return { ...line, points, wickets: [], required };
  });
}

export interface Partnership {
  wicket: number;   // 1 for the opening stand
  a: string; b: string | null;
  aRuns: number; bRuns: number; extras: number;
  runs: number; balls: number;
  end: "out" | "retired" | "unbroken";
}

/** Stands for each wicket in one innings: runs (each batter's share and extras) and legal balls. */
export function partnerships(m: Match, idx: number): Partnership[] {
  const ds = deliveries(m)[idx] ?? [], out: Partnership[] = [];
  let cur: Partnership | null = null;
  const same = (p: Partnership, x: string | null, y: string | null) => (p.a === x && p.b === y) || (p.a === y && p.b === x);
  for (const d of ds) {
    if (cur && !same(cur, d.striker, d.nonStriker)) { out.push({ ...cur, end: "retired" }); cur = null; }
    if (!cur) cur = { wicket: out.length + 1, a: d.striker ?? "", b: d.nonStriker, aRuns: 0, bRuns: 0, extras: 0, runs: 0, balls: 0, end: "unbroken" };
    cur.runs += d.total;
    if (d.striker === cur.a) cur.aRuns += d.bat; else cur.bRuns += d.bat;
    cur.extras += d.total - d.bat;
    if (d.legal) cur.balls++;
    if (d.outId) { out.push({ ...cur, end: "out" }); cur = null; }
  }
  if (cur) out.push(cur);
  return out;
}

export interface TurnBar { idx: number; label: string; batter: string; runs: number; balls: number; outs: number }

/** Solo: runs and balls in each turn, in the order they were batted. */
export function turns(m: Match): TurnBar[] {
  if (!E.isSolo(m)) return [];
  return m.innings.map((inn, idx) => {
    const st = E.replay(m, idx);
    return { idx, label: E.inningsLabel(m, idx), batter: inn.striker, runs: st.runs, balls: st.bat.get(inn.striker)?.balls ?? 0, outs: st.wickets };
  });
}

/** Round axis ticks from 0 up to at least max: steps of 1, 2, 5, 10, 20, 50 and so on. */
export function ticks(max: number, count = 5): number[] {
  const raw = Math.max(1, max) / count, mag = Math.pow(10, Math.floor(Math.log10(raw)));
  const step = [1, 2, 5, 10].map((k) => k * mag).find((s) => s >= raw) ?? 10 * mag;
  const top = Math.ceil(Math.max(1, max) / step) * step;
  return Array.from({ length: Math.round(top / step) + 1 }, (_, i) => Math.round(i * step * 100) / 100);
}

/** Over numbers under Manhattan bars, thinned out the same way as overTicks. */
export const barTicks = (n: number): number[] => {
  const step = n <= 12 ? 1 : n <= 30 ? 5 : 10;
  return Array.from({ length: n }, (_, i) => i + 1).filter((o) => o === 1 || o % step === 0);
};

/** Overs on the x axis: whole overs with sensible gaps, always ending on the last over played. */
export function overTicks(overs: number): number[] {
  const end = Math.max(1, Math.ceil(overs)), step = end <= 6 ? 1 : end <= 12 ? 2 : end <= 30 ? 5 : 10;
  const out: number[] = [];
  for (let x = 0; x < end - step / 2; x += step) out.push(x);
  out.push(end);
  return out;
}

/** 1st, 2nd, 3rd, 4th ... 11th, 12th, 13th, 21st. */
export const ordinal = (n: number) => `${n}${n % 100 >= 11 && n % 100 <= 13 ? "th" : ["th", "st", "nd", "rd"][n % 10] ?? "th"}`;
