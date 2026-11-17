import type { ReactNode } from "react";
import { View } from "react-native";
import Svg, { Circle, G, Line as SvgLine, Path, Rect, Text as SvgText } from "react-native-svg";
import * as E from "@shared/engine/engine";
import type { Match } from "@shared/engine/types";
import { barTicks, chartInnings, inningsOvers, manhattan, ordinal, overTicks, partnerships, runRates, ticks, turns, worm, type Line } from "@shared/charts";
import { matchAwards, mvp } from "@shared/mvp";
import { Badge, C, Card, Num, Press, SectionTitle, Txt, tw } from "./ui";

// Floodlights charts: lime for the side batting first (or the solo leader), grey for everyone else.
const GREY = C.teal, DIM = "#3a423c", GRID = "#1e2321", MONO = "JetBrainsMono_500Medium";
const VW = 340, VH = 180, PL = 30, PR = 12, PT = 10, PB = 22;

function tone(m: Match, l: Line, lead: string | null): { color: string; width: number; dash?: string } {
  if (E.isSolo(m)) return l.batter === lead ? { color: C.sun, width: 3 } : { color: DIM, width: 1.5 };
  return { color: l.side === m.innings[0]?.bat ? C.sun : GREY, width: 2.5, dash: l.nth ? "6 5" : undefined };
}

type Scale = (v: number) => number;
function Frame({ xMax, yMax, label, bars, children }: { xMax: number; yMax: number; label: string; bars?: boolean; children: (sx: Scale, sy: Scale) => ReactNode }) {
  const sx: Scale = (x) => PL + (x / xMax) * (VW - PL - PR), sy: Scale = (y) => VH - PB - (y / yMax) * (VH - PT - PB);
  return (
    <View accessible accessibilityLabel={label} style={{ width: "100%", aspectRatio: VW / VH }}>
      <Svg width="100%" height="100%" viewBox={`0 0 ${VW} ${VH}`}>
        {ticks(yMax).filter((t) => t <= yMax).map((t) => (
          <G key={t}>
            <SvgLine x1={PL} x2={VW - PR} y1={sy(t)} y2={sy(t)} stroke={GRID} strokeWidth={1} />
            <SvgText x={PL - 6} y={sy(t) + 3.5} fill={C.mute} fontSize={10} fontFamily={MONO} textAnchor="end">{String(t)}</SvgText>
          </G>
        ))}
        {(bars ? barTicks(xMax).map((o) => [o, o - 0.5]) : overTicks(xMax).map((t) => [t, t])).map(([t, at]) =>
          <SvgText key={t} x={sx(at)} y={VH - 6} fill={C.mute} fontSize={10} fontFamily={MONO} textAnchor="middle">{String(t)}</SvgText>)}
        {children(sx, sy)}
      </Svg>
    </View>
  );
}

function Legend({ items }: { items: { label: string; color: string; value?: string; dash?: boolean; ring?: boolean }[] }) {
  return (
    <View style={tw`mt-2 flex-row flex-wrap gap-x-4 gap-y-1`}>
      {items.map((it) => (
        <View key={it.label} style={tw`flex-row items-center gap-1.5`}>
          <Svg width={16} height={10}>
            {it.ring ? <Circle cx={8} cy={5} r={3.5} fill={C.panel} stroke={it.color} strokeWidth={2} />
              : <SvgLine x1={1} x2={15} y1={5} y2={5} stroke={it.color} strokeWidth={3} strokeLinecap="round" strokeDasharray={it.dash ? "3 3" : undefined} />}
          </Svg>
          <Txt style={tw`text-[12px] text-teal`}>{it.label}</Txt>
          {it.value !== undefined && <Num style={tw`text-[12px] text-fg`}>{it.value}</Num>}
        </View>
      ))}
    </View>
  );
}

function ChartCard({ title, hint, children }: { title: string; hint?: string; children: ReactNode }) {
  return (
    <Card>
      <SectionTitle action={hint ? <Txt style={tw`text-xs text-mute`} numberOfLines={1}>{hint}</Txt> : undefined}>{title}</SectionTitle>
      {children}
    </Card>
  );
}

const path = (pts: { x: number; y: number }[], sx: Scale, sy: Scale) =>
  pts.map((p, i) => `${i ? "L" : "M"}${sx(p.x).toFixed(1)} ${sy(p.y).toFixed(1)}`).join(" ");
const topTick = (v: number) => ticks(v).slice(-1)[0];

function Worm({ m, lead }: { m: Match; lead: string | null }) {
  const lines = worm(m);
  const xMax = Math.max(1, ...lines.flatMap((l) => l.points.map((p) => p.x)), ...chartInnings(m).map((i) => inningsOvers(m, i)));
  const yMax = topTick(Math.max(6, ...lines.flatMap((l) => l.points.map((p) => p.y))));
  const order = [...lines].sort((a, b) => tone(m, a, lead).width - tone(m, b, lead).width);
  return (
    <ChartCard title="Worm" hint="runs by over, dots are wickets">
      <Frame xMax={xMax} yMax={yMax} label="Cumulative runs by over">{(sx, sy) => order.map((l) => {
        const t = tone(m, l, lead);
        return (
          <G key={l.idx}>
            <Path d={path(l.points, sx, sy)} fill="none" stroke={t.color} strokeWidth={t.width} strokeDasharray={t.dash} strokeLinejoin="round" strokeLinecap="round" />
            {l.wickets.map((w, k) => <Circle key={k} cx={sx(w.x)} cy={sy(w.y)} r={3.5} fill={C.panel} stroke={t.color} strokeWidth={2} />)}
          </G>
        );
      })}</Frame>
      <Legend items={lines.slice(0, 8).map((l) => ({ label: l.label, color: tone(m, l, lead).color, dash: !!tone(m, l, lead).dash, value: `${l.points[l.points.length - 1].y}` }))} />
    </ChartCard>
  );
}

function Manhattan({ m, idx }: { m: Match; idx: number }) {
  const bars = manhattan(m, idx), n = Math.max(bars.length, Math.ceil(inningsOvers(m, idx)), 1);
  const yMax = topTick(Math.max(6, ...bars.map((b) => b.runs))), top = Math.max(0, ...bars.map((b) => b.runs));
  const slot = (VW - PL - PR) / n, w = Math.max(3, Math.min(22, slot * 0.7));
  return (
    <ChartCard title="Manhattan" hint={`${E.inningsLabel(m, idx)}, runs per over`}>
      <Frame xMax={n} yMax={yMax} label="Runs per over" bars>{(_, sy) => bars.map((b, i) => {
        const cx = PL + slot * (i + 0.5);
        return (
          <G key={i}>
            <Rect x={cx - w / 2} y={sy(b.runs)} width={w} height={Math.max(0, sy(0) - sy(b.runs))} rx={3} fill={b.runs === top && top > 0 ? C.sun : DIM} />
            {Array.from({ length: b.wickets }, (_, k) => <Circle key={k} cx={cx} cy={sy(b.runs) - 7 - k * 10} r={4} fill={C.panel} stroke={C.sun} strokeWidth={2} />)}
          </G>
        );
      })}</Frame>
      {!bars.length && <Txt style={tw`text-sm text-mute`}>No balls yet.</Txt>}
      <Legend items={[{ label: "Best over", color: C.sun }, { label: "Wicket", color: C.sun, ring: true }]} />
    </ChartCard>
  );
}

function Partnerships({ m, idx }: { m: Match; idx: number }) {
  const list = partnerships(m, idx), max = Math.max(1, ...list.map((p) => p.runs)), name = (id: string | null) => E.playerName(m, id);
  return (
    <ChartCard title="Partnerships" hint={E.inningsLabel(m, idx)}>
      <View style={tw`gap-3`}>
        {list.map((p) => (
          <View key={p.wicket}>
            <View style={tw`flex-row items-baseline justify-between gap-2`}>
              <Txt style={tw`flex-1 text-[12px] text-teal`} numberOfLines={1}>
                <Txt style={tw`text-mute`}>{ordinal(p.wicket)} wkt </Txt>{name(p.a)}{p.b ? ` & ${name(p.b)}` : ""}{p.end === "unbroken" ? " *" : ""}
              </Txt>
              <Num style={tw`text-[13px] text-fg`}>{p.runs}<Num style={tw`text-[11px] text-mute`}> ({p.balls})</Num></Num>
            </View>
            <View style={[tw`mt-1 h-2 flex-row overflow-hidden rounded-full`, { width: `${Math.max(4, (p.runs / max) * 100)}%`, backgroundColor: C.key }]}>
              <View style={{ flex: p.aRuns, backgroundColor: C.sun }} />
              <View style={{ flex: p.bRuns, backgroundColor: GREY }} />
              <View style={{ flex: p.extras, backgroundColor: DIM }} />
            </View>
          </View>
        ))}
      </View>
      {!list.length && <Txt style={tw`text-sm text-mute`}>No balls yet.</Txt>}
      {list.length > 0 && <Legend items={[{ label: "First named", color: C.sun }, { label: "Partner", color: GREY }, { label: "Extras", color: DIM }]} />}
    </ChartCard>
  );
}

function RunRates({ m, lead }: { m: Match; lead: string | null }) {
  const lines = runRates(m);
  const xMax = Math.max(1, ...lines.flatMap((l) => l.points.map((p) => p.x)));
  const yMax = topTick(Math.max(6, ...lines.flatMap((l) => [...l.points.map((p) => p.y), ...l.required.map((r) => r ?? 0)]).map((v) => Math.min(v, 36))));
  const chase = lines.find((l) => l.required.some((r) => r !== null));
  return (
    <ChartCard title="Run rate" hint="runs per over after each over">
      <Frame xMax={xMax} yMax={yMax} label="Run rate by over">{(sx, sy) => (
        <G>
          {lines.map((l) => {
            const t = tone(m, l, lead);
            return <Path key={l.idx} d={path(l.points.map((p) => ({ x: p.x, y: Math.min(p.y, yMax) })), sx, sy)} fill="none" stroke={t.color} strokeWidth={t.width} strokeDasharray={t.dash} strokeLinejoin="round" />;
          })}
          {chase && <Path d={path(chase.points.flatMap((p, i) => chase.required[i] === null ? [] : [{ x: p.x, y: Math.min(chase.required[i]!, yMax) }]), sx, sy)}
            fill="none" stroke={tone(m, chase, lead).color} strokeWidth={1.5} strokeDasharray="2 4" strokeLinecap="round" />}
        </G>
      )}</Frame>
      <Legend items={[...lines.slice(0, 8).map((l) => {
        const last = l.points[l.points.length - 1], t = tone(m, l, lead);
        return { label: l.label, color: t.color, dash: !!t.dash, value: last ? last.y.toFixed(1) : "0.0" };
      }), ...(chase ? [{ label: "Needed", color: tone(m, chase, lead).color, dash: true }] : [])]} />
    </ChartCard>
  );
}

function Turns({ m, idx, pick }: { m: Match; idx: number; pick: (i: number) => void }) {
  const list = turns(m), max = Math.max(1, ...list.map((t) => t.runs));
  return (
    <ChartCard title="Turns" hint="tap one for its overs">
      <View style={tw`gap-1`}>
        {list.map((t) => (
          <Press key={t.idx} onPress={() => pick(t.idx)} accessibilityState={{ selected: t.idx === idx }}
            style={[tw`rounded-xl px-2 py-1.5`, t.idx === idx && { backgroundColor: C.sunSoft }]}>
            <View style={tw`flex-row justify-between`}>
              <Txt style={tw`text-[12px] text-teal`} numberOfLines={1}>{t.label}</Txt>
              <Num style={tw`text-[13px] text-fg`}>{t.runs}<Num style={tw`text-[11px] text-mute`}> ({t.balls})</Num></Num>
            </View>
            <View style={[tw`mt-1 h-2 rounded-full`, { width: `${Math.max(3, (t.runs / max) * 100)}%`, backgroundColor: t.idx === idx ? C.sun : DIM }]} />
          </Press>
        ))}
      </View>
    </ChartCard>
  );
}

export function ChartsTab({ m, idx, pick }: { m: Match; idx: number; pick: (i: number) => void }) {
  const lead = E.isSolo(m) ? E.soloStandings(m)[0]?.id ?? null : null;
  return (
    <View style={tw`gap-3`}>
      <Worm m={m} lead={lead} />
      {E.isSolo(m) && <Turns m={m} idx={idx} pick={pick} />}
      <Manhattan m={m} idx={idx} />
      {!E.isSolo(m) && <Partnerships m={m} idx={idx} />}
      <RunRates m={m} lead={lead} />
    </View>
  );
}

/** MVP ranking, updating ball by ball: points split into batting, bowling and fielding. */
export function MvpTab({ m }: { m: Match }) {
  const rows = mvp(m), short = (s: string) => s.split(/\s+/).map((w) => w[0]).join("").slice(0, 3).toUpperCase();
  return (
    <View style={tw`gap-3`}>
      <View>
        {rows.map((r, i) => (
          <View key={r.id} style={tw`flex-row items-center gap-3 py-3 ${i ? "border-t border-line" : ""}`}>
            <Num style={tw`w-6 text-[14px] ${i === 0 ? "text-sun" : "text-mute"}`}>{i + 1}</Num>
            <Badge name={r.name} size={36} />
            <View style={tw`flex-1 min-w-0`}>
              <Txt style={tw`text-[15px] font-medium`} numberOfLines={1}>{r.name}{r.side !== null ? <Txt style={tw`text-[11px] text-mute`}>{`  ${short(m.teams[r.side].name)}`}</Txt> : null}</Txt>
              <Num style={tw`text-[11px] font-medium text-mute`}>{`Bat ${r.batting} · Bowl ${r.bowling} · Field ${r.fielding}`}</Num>
            </View>
            <View style={tw`items-end`}>
              <Num style={tw`text-[20px] ${i === 0 ? "text-sun" : "text-fg"}`}>{r.points}</Num>
              <Txt style={tw`text-[11px] text-mute`}>pts</Txt>
            </View>
          </View>
        ))}
        {!rows.length && <Txt style={tw`py-4 text-sm text-mute`}>No balls yet.</Txt>}
      </View>
      <Txt style={tw`text-xs leading-5 text-mute`}>1 a run, +1 a four, +2 a six, 20 a wicket, 8 a catch, run out or stumping. Up to 10 more for batting faster or bowling cheaper than the match run rate, from 6 balls.</Txt>
    </View>
  );
}

/** The four awards after Player of the match, each with its reason. */
export function AwardsCard({ m }: { m: Match }) {
  const list = matchAwards(m).filter((a) => a.key !== "potm");
  if (!list.length) return null;
  return (
    <Card style={tw`py-1`}>
      {list.map((a, i) => (
        <View key={a.key} style={tw`flex-row items-center gap-3 py-3 ${i ? "border-t border-line" : ""}`}>
          <Badge name={a.name} size={38} />
          <View style={tw`flex-1 min-w-0`}>
            <Txt style={[tw`text-[12px] font-medium text-sun`, { letterSpacing: 0.4 }]}>{a.title}</Txt>
            <Txt style={tw`text-[15px] font-semibold text-fg`} numberOfLines={1}>{a.name}</Txt>
            <Num style={tw`text-[12px] font-medium text-teal`}>{a.line}</Num>
          </View>
        </View>
      ))}
    </Card>
  );
}
