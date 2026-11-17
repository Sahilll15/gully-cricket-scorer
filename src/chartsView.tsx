import type { ReactNode } from "react";
import * as E from "./engine/engine";
import type { Match } from "./engine/types";
import { barTicks, chartInnings, inningsOvers, manhattan, ordinal, overTicks, partnerships, runRates, ticks, turns, worm, type Line, type RateLine } from "./charts";
import { matchAwards, mvp } from "./mvp";
import { Badge, Card, cx } from "./ui";

const SUN = "#ff8a3d", CREAM = "#f1ece4", MUTE = "#9a9aa5", GRID = "#24242d", DIM = "#4a4a55";
const VW = 340, VH = 180, PL = 30, PR = 12, PT = 10, PB = 22;

/** Colour per line: the side batting first in orange, the other in cream; solo lights the leader only. */
function tone(m: Match, l: Line, lead: string | null) {
  if (E.isSolo(m)) return l.batter === lead ? { color: SUN, width: 3 } : { color: DIM, width: 1.5 };
  return { color: l.side === m.innings[0]?.bat ? SUN : CREAM, width: 2.5, dash: l.nth ? "6 5" : undefined };
}

function Frame({ xMax, yMax, yLabel, bars, children }: { xMax: number; yMax: number; yLabel: string; bars?: boolean; children: (sx: (x: number) => number, sy: (y: number) => number) => ReactNode }) {
  const sx = (x: number) => PL + (x / xMax) * (VW - PL - PR), sy = (y: number) => VH - PB - (y / yMax) * (VH - PT - PB);
  const ys = ticks(yMax).filter((t) => t <= yMax);
  return (
    <svg viewBox={`0 0 ${VW} ${VH}`} className="w-full" role="img" aria-label={yLabel}>
      {ys.map((t) => <g key={t}>
        <line x1={PL} x2={VW - PR} y1={sy(t)} y2={sy(t)} stroke={GRID} strokeWidth={1} />
        <text x={PL - 6} y={sy(t) + 3.5} fill={MUTE} fontSize={10} textAnchor="end">{t}</text>
      </g>)}
      {(bars ? barTicks(xMax).map((o) => [o, o - 0.5]) : overTicks(xMax).map((t) => [t, t])).map(([t, at]) =>
        <text key={t} x={sx(at)} y={VH - 6} fill={MUTE} fontSize={10} textAnchor="middle">{t}</text>)}
      {children(sx, sy)}
    </svg>
  );
}

function Legend({ items }: { items: { label: string; color: string; value?: string; dash?: boolean }[] }) {
  return (
    <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs">
      {items.map((it) => (
        <span key={it.label} className="flex items-center gap-1.5 text-mute">
          <i className="inline-block h-[3px] w-4 rounded" style={{ background: it.dash ? `repeating-linear-gradient(90deg, ${it.color} 0 4px, transparent 4px 7px)` : it.color }} />
          <span className="text-fg/85">{it.label}</span>{it.value && <b className="text-fg tabular-nums">{it.value}</b>}
        </span>
      ))}
    </div>
  );
}

function ChartCard({ title, hint, children }: { title: string; hint?: string; children: ReactNode }) {
  return (
    <Card>
      <p className="font-semibold text-teal">{title}{hint && <span className="text-xs font-normal text-mute"> · {hint}</span>}</p>
      <div className="mt-2">{children}</div>
    </Card>
  );
}

const path = (pts: { x: number; y: number }[], sx: (x: number) => number, sy: (y: number) => number) =>
  pts.map((p, i) => `${i ? "L" : "M"}${sx(p.x).toFixed(1)} ${sy(p.y).toFixed(1)}`).join(" ");

function Worm({ m, lead }: { m: Match; lead: string | null }) {
  const lines = worm(m);
  const xMax = Math.max(1, ...lines.flatMap((l) => l.points.map((p) => p.x)), ...chartInnings(m).map((i) => inningsOvers(m, i)));
  const yMax = ticks(Math.max(6, ...lines.flatMap((l) => l.points.map((p) => p.y)))).slice(-1)[0];
  const order = [...lines].sort((a, b) => tone(m, a, lead).width - tone(m, b, lead).width);
  return (
    <ChartCard title="Worm" hint="runs by over, dots are wickets">
      <Frame xMax={xMax} yMax={yMax} yLabel="Cumulative runs by over">{(sx, sy) => order.map((l) => {
        const t = tone(m, l, lead);
        return <g key={l.idx}>
          <path d={path(l.points, sx, sy)} fill="none" stroke={t.color} strokeWidth={t.width} strokeDasharray={t.dash} strokeLinejoin="round" strokeLinecap="round" />
          {l.wickets.map((w, k) => <circle key={k} cx={sx(w.x)} cy={sy(w.y)} r={3.5} fill="#050507" stroke={t.color} strokeWidth={2} />)}
        </g>;
      })}</Frame>
      <Legend items={lines.slice(0, 8).map((l) => ({ label: l.label, color: tone(m, l, lead).color, dash: !!tone(m, l, lead).dash, value: `${l.points[l.points.length - 1].y}` }))} />
    </ChartCard>
  );
}

function Manhattan({ m, idx }: { m: Match; idx: number }) {
  const bars = manhattan(m, idx), n = Math.max(bars.length, Math.ceil(inningsOvers(m, idx)), 1);
  const yMax = ticks(Math.max(6, ...bars.map((b) => b.runs))).slice(-1)[0], top = Math.max(...bars.map((b) => b.runs), 0);
  const slot = (VW - PL - PR) / n, w = Math.max(3, Math.min(22, slot * 0.7));
  return (
    <ChartCard title="Manhattan" hint={`${E.inningsLabel(m, idx)}, runs per over`}>
      <Frame xMax={n} yMax={yMax} yLabel="Runs per over" bars>{(_, sy) => bars.map((b, i) => {
        const cx = PL + slot * (i + 0.5);
        return <g key={i}>
          <rect x={cx - w / 2} y={sy(b.runs)} width={w} height={Math.max(0, sy(0) - sy(b.runs))} rx={3} fill={b.runs === top && top > 0 ? SUN : "#3a3a46"} />
          {Array.from({ length: b.wickets }, (_, k) => <circle key={k} cx={cx} cy={sy(b.runs) - 7 - k * 10} r={4} fill={CREAM} />)}
        </g>;
      })}</Frame>
      {!bars.length && <p className="text-sm text-mute">No balls yet.</p>}
      <Legend items={[{ label: "Best over", color: SUN }, { label: "Wicket", color: CREAM }]} />
    </ChartCard>
  );
}

function Partnerships({ m, idx }: { m: Match; idx: number }) {
  const list = partnerships(m, idx), max = Math.max(1, ...list.map((p) => p.runs)), name = (id: string | null) => E.playerName(m, id);
  return (
    <ChartCard title="Partnerships" hint={E.inningsLabel(m, idx)}>
      <div className="space-y-2.5">{list.map((p) => (
        <div key={p.wicket}>
          <div className="flex items-baseline justify-between text-xs">
            <span className="text-fg/85"><span className="text-mute">{ordinal(p.wicket)} wkt</span> {name(p.a)}{p.b ? ` & ${name(p.b)}` : ""}{p.end === "unbroken" ? " *" : ""}</span>
            <b className="text-fg tabular-nums">{p.runs} <span className="font-normal text-mute">({p.balls})</span></b>
          </div>
          <div className="mt-1 flex h-2.5 overflow-hidden rounded-full bg-key" style={{ width: `${Math.max(4, (p.runs / max) * 100)}%` }}>
            <i style={{ flex: p.aRuns, background: SUN }} /><i style={{ flex: p.bRuns, background: CREAM }} /><i style={{ flex: p.extras, background: DIM }} />
          </div>
        </div>
      ))}</div>
      {!list.length && <p className="text-sm text-mute">No balls yet.</p>}
      {list.length > 0 && <Legend items={[{ label: "First named", color: SUN }, { label: "Partner", color: CREAM }, { label: "Extras", color: DIM }]} />}
    </ChartCard>
  );
}

function RunRates({ m, lead }: { m: Match; lead: string | null }) {
  const lines: RateLine[] = runRates(m);
  const xMax = Math.max(1, ...lines.flatMap((l) => l.points.map((p) => p.x)));
  const all = lines.flatMap((l) => [...l.points.map((p) => p.y), ...l.required.map((r) => r ?? 0)]);
  const yMax = ticks(Math.max(6, ...all.map((v) => Math.min(v, 36)))).slice(-1)[0];
  const chase = lines.find((l) => l.required.some((r) => r !== null));
  return (
    <ChartCard title="Run rate" hint="runs per over after each over">
      <Frame xMax={xMax} yMax={yMax} yLabel="Run rate by over">{(sx, sy) => <>
        {lines.map((l) => { const t = tone(m, l, lead); return <path key={l.idx} d={path(l.points.map((p) => ({ x: p.x, y: Math.min(p.y, yMax) })), sx, sy)} fill="none" stroke={t.color} strokeWidth={t.width} strokeDasharray={t.dash} strokeLinejoin="round" />; })}
        {chase && <path d={path(chase.points.flatMap((p, i) => chase.required[i] === null ? [] : [{ x: p.x, y: Math.min(chase.required[i]!, yMax) }]), sx, sy)}
          fill="none" stroke={tone(m, chase, lead).color} strokeWidth={1.5} strokeDasharray="2 4" strokeLinecap="round" />}
      </>}</Frame>
      <Legend items={[...lines.slice(0, 8).map((l) => { const last = l.points[l.points.length - 1]; return { label: l.label, color: tone(m, l, lead).color, dash: !!tone(m, l, lead).dash, value: last ? last.y.toFixed(1) : "0.0" }; }),
        ...(chase ? [{ label: "Needed", color: tone(m, chase, lead).color, dash: true }] : [])]} />
    </ChartCard>
  );
}

function Turns({ m, idx, pick }: { m: Match; idx: number; pick: (i: number) => void }) {
  const list = turns(m), max = Math.max(1, ...list.map((t) => t.runs));
  return (
    <ChartCard title="Turns" hint="tap one for its overs">
      <div className="space-y-2">{list.map((t) => (
        <button key={t.idx} onClick={() => pick(t.idx)} className={cx("press block w-full rounded-xl px-2 py-1.5 text-left", t.idx === idx && "bg-sun-soft")}>
          <div className="flex justify-between text-xs"><span className="text-fg/85">{t.label}</span><b className="text-fg tabular-nums">{t.runs} <span className="font-normal text-mute">({t.balls})</span></b></div>
          <div className="mt-1 h-2.5 rounded-full" style={{ width: `${Math.max(3, (t.runs / max) * 100)}%`, background: t.idx === idx ? SUN : "#3a3a46" }} />
        </button>
      ))}</div>
    </ChartCard>
  );
}

export function ChartsTab({ m, idx, pick }: { m: Match; idx: number; pick: (i: number) => void }) {
  const lead = E.isSolo(m) ? E.soloStandings(m)[0]?.id ?? null : null;
  return (
    <div className="space-y-3">
      <Worm m={m} lead={lead} />
      {E.isSolo(m) && <Turns m={m} idx={idx} pick={pick} />}
      <Manhattan m={m} idx={idx} />
      {!E.isSolo(m) && <Partnerships m={m} idx={idx} />}
      <RunRates m={m} lead={lead} />
    </div>
  );
}

/** MVP table, updating ball by ball: points split into batting, bowling and fielding. */
export function MvpTab({ m }: { m: Match }) {
  const rows = mvp(m), short = (s: string) => s.split(/\s+/).map((w) => w[0]).join("").slice(0, 3).toUpperCase();
  return (
    <div className="space-y-3">
      <Card className="!p-0 overflow-hidden">
        {rows.map((r, i) => (
          <div key={r.id} className="flex items-center gap-3 border-t border-line px-4 py-3 first:border-0">
            <span className={cx("w-5 tabular-nums", i === 0 ? "text-lg font-extrabold text-sun" : "font-bold text-mute")}>{i + 1}</span>
            <Badge name={r.name} size={36} />
            <span className="min-w-0 flex-1">
              <span className="block truncate font-semibold text-fg">{r.name}{r.side !== null && <span className="ml-1.5 text-[11px] font-semibold text-mute">{short(m.teams[r.side].name)}</span>}</span>
              <span className="text-xs text-mute">Bat {r.batting} · Bowl {r.bowling} · Field {r.fielding}</span>
            </span>
            <span className="text-right"><span className="block text-xl font-extrabold text-fg tabular-nums">{r.points}</span><span className="text-[11px] text-mute">pts</span></span>
          </div>
        ))}
        {!rows.length && <p className="p-4 text-sm text-mute">No balls yet.</p>}
      </Card>
      <p className="px-1 text-xs leading-relaxed text-mute">1 a run, +1 a four, +2 a six, 20 a wicket, 8 a catch, run out or stumping. Up to 10 more for batting faster or bowling cheaper than the match run rate, from 6 balls.</p>
    </div>
  );
}

/** The four awards after Player of the match, each with its reason. */
export function AwardsCard({ m }: { m: Match }) {
  const list = matchAwards(m).filter((a) => a.key !== "potm");
  if (!list.length) return null;
  return (
    <Card className="!p-0 overflow-hidden">
      {list.map((a) => (
        <div key={a.key} className="flex items-center gap-3 border-t border-line px-4 py-3 first:border-0">
          <Badge name={a.name} size={38} />
          <span className="min-w-0 flex-1"><span className="block text-xs font-semibold text-sun">{a.title}</span>
            <span className="block truncate font-bold text-fg">{a.name}</span><span className="text-xs text-mute">{a.line}</span></span>
        </div>
      ))}
    </Card>
  );
}
