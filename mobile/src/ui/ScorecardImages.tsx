import { Fragment, type ReactNode } from "react";
import { View, type TextStyle } from "react-native";
import * as E from "@shared/engine/engine";
import type { Match } from "@shared/engine/types";
import { playerOfTheMatch } from "@shared/mvp";
import { extrasLine, inningsTitle } from "@shared/scoresheet";
import { highlightRows } from "@shared/share";
import { Txt } from "./ui";

// Native copies of the web canvas images in src/share.ts. Every number below is in canvas pixels (1080 wide)
// and is scaled by k, so the default 360pt layout captures back to the same 1080px image.
const CANVAS = 1080;
const ASCENT = 1.05; // Poppins hhea ascender: canvas y is the text baseline, a View is placed by its top

interface TextProps {
  k: number; x: number; y: number; size: number; weight: TextStyle["fontWeight"]; color: string; max?: number; right?: boolean; children: string;
}
function T({ k, x, y, size, weight, color, max, right, children }: TextProps) {
  const top = (y - size * ASCENT) * k;
  const pos: TextStyle = right ? { right: (CANVAS - x) * k, textAlign: "right" } : { left: x * k };
  return (
    <Txt numberOfLines={1} ellipsizeMode="tail"
      style={[{ position: "absolute", top, fontSize: size * k, fontWeight: weight, color, includeFontPadding: false }, pos, max ? { maxWidth: max * k } : null]}>
      {children}
    </Txt>
  );
}

function Box({ k, x, y, w, h, r, color }: { k: number; x: number; y: number; w: number; h: number; r: number; color: string }) {
  return <View style={{ position: "absolute", left: x * k, top: y * k, width: w * k, height: h * k, borderRadius: r * k, backgroundColor: color }} />;
}

const dateLine = (m: Match) =>
  `${new Date(m.createdAt).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })} · ${E.formatText(m)}`;

const innTitle = (m: Match, i: number) => {
  const st = E.replay(m, i);
  return { team: inningsTitle(m, i), score: `${E.inningsScore(m, i)} (${E.oversText(st.legal, st.bpo)} ov)`, st };
};

/** A tall image with every innings: batting with how each batter got out, extras, then the bowling. */
export function FullCard({ m, width = 360 }: { m: Match; width?: number }) {
  const k = width / CANVAS, W = CANVAS, X = 70, R = W - 70, name = (id: string) => E.playerName(m, id);
  const BAT = ["R", "B", "4s", "6s", "SR"], BOWL = ["O", "M", "R", "W", "Econ"], COLS = [630, 720, 800, 875, R];
  const sections = m.innings.map((_, i) => innTitle(m, i));
  const H = 340 + sections.reduce((h, s) => h + 332 + s.st.order.length * 96 + s.st.bowlOrder.length * 70, 0) + 80;
  const res = E.result(m), potm = playerOfTheMatch(m);
  const out: ReactNode[] = [];
  const head = (label: string, cols: string[], y: number) => {
    out.push(<T key={`h${y}`} k={k} x={X} y={y} size={24} weight="600" color="#9a9aa5">{label}</T>);
    cols.forEach((h, c) => out.push(<T key={`h${y}-${c}`} k={k} x={COLS[c]} y={y} size={24} weight="600" color="#9a9aa5" right>{h}</T>));
  };

  let y = 340;
  sections.forEach(({ team, score, st }, s) => {
    out.push(<Box key={`s${s}`} k={k} x={X - 20} y={y} w={W - 100} h={80} r={22} color="#0d0d12" />);
    out.push(<T key={`t${s}`} k={k} x={X} y={y + 53} size={36} weight="700" color="#ffffff" max={560}>{team}</T>);
    out.push(<T key={`sc${s}`} k={k} x={R} y={y + 53} size={36} weight="700" color="#ff8a3d" right>{score}</T>);
    y += 110 + 30;
    head("Batting", BAT, y); y += 26;
    for (const id of st.order) {
      const b = st.bat.get(id)!;
      out.push(<T key={`b${s}${id}`} k={k} x={X} y={y + 40} size={32} weight="700" color="#ffffff" max={500}>{name(id)}</T>);
      out.push(<T key={`o${s}${id}`} k={k} x={X} y={y + 76} size={24} weight="500" color="#9a9aa5" max={500}>{E.howOut(m, b)}</T>);
      [b.runs, b.balls, b.fours, b.sixes, b.balls ? Math.round((b.runs * 100) / b.balls) : 0].forEach((v, c) =>
        out.push(<T key={`b${s}${id}${c}`} k={k} x={COLS[c]} y={y + 40} size={30} weight="600" color="#ffffff" right>{String(v)}</T>));
      y += 96;
    }
    out.push(<T key={`e${s}`} k={k} x={X} y={y + 44} size={26} weight="500" color="#9a9aa5" max={W - 140}>{extrasLine(st)}</T>);
    y += 70 + 30;
    head("Bowling", BOWL, y); y += 26;
    for (const id of st.bowlOrder) {
      const w = st.bowl.get(id)!;
      out.push(<T key={`w${s}${id}`} k={k} x={X} y={y + 46} size={32} weight="700" color="#ffffff" max={500}>{name(id)}</T>);
      [E.oversText(w.legal, st.bpo), w.maidens, w.runs, w.wickets, w.legal ? ((w.runs * st.bpo) / w.legal).toFixed(1) : "0.0"].forEach((v, c) =>
        out.push(<T key={`w${s}${id}${c}`} k={k} x={COLS[c]} y={y + 46} size={30} weight="600" color="#ffffff" right>{String(v)}</T>));
      y += 70;
    }
    y += 40;
  });

  return (
    <View style={{ width: W * k, height: H * k, backgroundColor: "#050507", overflow: "hidden" }}>
      <T k={k} x={X} y={100} size={44} weight="800" color="#ff8a3d">Gully cricket</T>
      <T k={k} x={X} y={148} size={30} weight="500" color="#9a9aa5">{dateLine(m)}</T>
      <Box k={k} x={X} y={180} w={W - 140} h={100} r={28} color="#ff8a3d" />
      <T k={k} x={X + 34} y={244} size={40} weight="800" color="#111111" max={W - 200}>{res?.text ?? "In progress"}</T>
      {potm && <T k={k} x={X} y={320} size={28} weight="500" color="#ffffff" max={W - 140}>{`Player of the match: ${potm.name}, ${potm.line}`}</T>}
      {out}
      <T k={k} x={X} y={H - 40} size={28} weight="500" color="#9a9aa5">Scored with ai.sahilchalke.com/score</T>
    </View>
  );
}

// No radial gradient in React Native: stacked circles fade the orange from r=40 to r=700 around the top centre.
const GLOW_STEPS = 16, GLOW_ALPHA = 1 - Math.pow(1 - 0.28, 1 / GLOW_STEPS);
function TopGlow({ k }: { k: number }) {
  return (
    <View style={{ position: "absolute", left: 0, top: 0, width: CANVAS * k, height: 460 * k, overflow: "hidden" }}>
      {Array.from({ length: GLOW_STEPS }, (_, i) => {
        const r = 40 + (660 * (i + 1)) / GLOW_STEPS;
        return <View key={i} style={{ position: "absolute", left: (CANVAS / 2 - r) * k, top: -r * k, width: 2 * r * k, height: 2 * r * k, borderRadius: r * k, backgroundColor: `rgba(255,138,61,${GLOW_ALPHA.toFixed(4)})` }} />;
      })}
    </View>
  );
}

/** The 4:5 highlights card: both scores (solo: the standings), the result, then player of the match, top scorer and best bowling. */
export function SmallCard({ m, width = 360 }: { m: Match; width?: number }) {
  const k = width / CANVAS, W = CANVAS, H = 1350;
  const test = E.isTest(m), solo = E.isSolo(m), res = E.result(m), rows = highlightRows(m);

  return (
    <View style={{ width: W * k, height: H * k, backgroundColor: "#050507", overflow: "hidden" }}>
      <Box k={k} x={0} y={-60} w={W} h={520} r={80} color="#0d0d12" />
      <TopGlow k={k} />
      <T k={k} x={70} y={100} size={44} weight="800" color="#ff8a3d">Gully cricket</T>
      <T k={k} x={70} y={148} size={30} weight="500" color="#9a9aa5">{dateLine(m)}</T>

      {solo && E.soloStandings(m).slice(0, 4).map((r, i) => {
        const y = 232 + i * 62;
        return (
          <Fragment key={r.id}>
            <T k={k} x={70} y={y} size={34} weight="800" color={i === 0 ? "#ff8a3d" : "#9a9aa5"}>{String(i + 1)}</T>
            <T k={k} x={120} y={y} size={38} weight="700" color={i === 0 ? "#ffffff" : "#ffffff"} max={560}>{r.name}</T>
            <T k={k} x={880} y={y} size={44} weight="800" color="#ffffff" right>{String(r.runs)}</T>
            <T k={k} x={W - 70} y={y} size={26} weight="500" color="#9a9aa5" right>{`${r.balls} b`}</T>
          </Fragment>
        );
      })}
      {test && ([0, 1] as const).map((s) => {
        const x = s === 0 ? 70 : 570;
        return (
          <Fragment key={s}>
            <T k={k} x={x} y={250} size={36} weight="700" color="#ffffff" max={440}>{m.teams[s].name}</T>
            <T k={k} x={x - 4} y={350} size={64} weight="800" color="#ffffff" max={440}>{E.sideScore(m, s) ?? "Yet to bat"}</T>
          </Fragment>
        );
      })}
      {!test && !solo && m.innings.slice(0, 2).map((inn, i) => {
        const st = E.replay(m, i), x = i === 0 ? 70 : 570;
        return (
          <Fragment key={i}>
            <T k={k} x={x} y={250} size={36} weight="700" color="#ffffff" max={440}>{m.teams[inn.bat].name}</T>
            <T k={k} x={x - 4} y={370} size={110} weight="800" color="#ffffff">{`${st.runs}/${st.wickets}`}</T>
            <T k={k} x={x} y={418} size={30} weight="500" color="#ffffff">{`(${E.oversText(st.legal, st.bpo)} overs)`}</T>
          </Fragment>
        );
      })}

      <Box k={k} x={70} y={520} w={W - 140} h={150} r={36} color="#ff8a3d" />
      <T k={k} x={110} y={612} size={50} weight="800" color="#111111" max={W - 220}>{res?.text ?? "In progress"}</T>

      {rows.map(([label, value, sub], i) => {
        const y = 760 + i * 150;
        return (
          <Fragment key={label}>
            <Box k={k} x={70} y={y} w={W - 140} h={130} r={32} color="#0d0d12" />
            <T k={k} x={110} y={y + 50} size={26} weight="500" color="#9a9aa5">{label}</T>
            <T k={k} x={110} y={y + 100} size={40} weight="700" color="#ffffff" max={560}>{value}</T>
            <T k={k} x={W - 110} y={y + 100} size={40} weight="700" color="#ff8a3d" right>{sub}</T>
          </Fragment>
        );
      })}

      <T k={k} x={70} y={H - 50} size={28} weight="500" color="#9a9aa5">Scored with ai.sahilchalke.com/score</T>
    </View>
  );
}
