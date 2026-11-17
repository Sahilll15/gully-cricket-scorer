import { useMemo, type ReactNode } from "react";
import { StyleSheet, View } from "react-native";
import Svg, { Defs, Ellipse, G, Line, LinearGradient, Path, RadialGradient, Rect, Stop } from "react-native-svg";
import type { Match } from "@shared/engine/types";
import { poster, type Poster } from "@shared/poster";
import { Board, C, Num, Txt } from "./ui";

// Share posters in Floodlights: charcoal, lime and grey. Laid out at 360 x 450 and scaled by k for previews.
const BASE = 360, RATIO = 450 / 360;

/** Same seed, same confetti: a poster looks the same every time it is shared. */
function rng(seed: string) {
  let a = [...seed].reduce((h, ch) => (h * 31 + ch.charCodeAt(0)) >>> 0, 9);
  return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

/** Brick courses of the gully wall, fading towards the middle, and two floodlight cones. */
function Backdrop({ k, wallH, glow }: { k: number; wallH: number; glow: { y: number; r: number; o: number } | null }) {
  const bricks: ReactNode[] = [];
  for (let row = 0, y = 0; y < wallH; row++, y += 19) {
    for (let x = row % 2 ? -20 : 0; x < BASE; x += 41)
      bricks.push(<Rect key={`${row}-${x}`} x={x + 1} y={y + 1} width={39} height={17} rx={2} fill={row % 3 ? "#121513" : "#151917"} opacity={0.95 * (1 - y / wallH)} />);
  }
  return (
    <Svg width={BASE * k} height={BASE * RATIO * k} viewBox={`0 0 ${BASE} ${BASE * RATIO}`} style={StyleSheet.absoluteFill}>
      <Defs>
        <RadialGradient id="beam" cx="50%" cy="0%" rx="50%" ry="100%">
          <Stop offset="0" stopColor={C.sun} stopOpacity="0.16" />
          <Stop offset="1" stopColor={C.sun} stopOpacity="0" />
        </RadialGradient>
        <RadialGradient id="glow" cx="50%" cy="50%" rx="50%" ry="50%">
          <Stop offset="0" stopColor={C.sun} stopOpacity={String(glow?.o ?? 0)} />
          <Stop offset="1" stopColor={C.sun} stopOpacity="0" />
        </RadialGradient>
      </Defs>
      {bricks}
      <Ellipse cx={20} cy={0} rx={190} ry={360} fill="url(#beam)" transform="rotate(-14)" />
      <Ellipse cx={340} cy={0} rx={190} ry={360} fill="url(#beam)" transform="rotate(14 340 0)" />
      {glow && <Ellipse cx={BASE / 2} cy={glow.y} rx={glow.r} ry={glow.r} fill="url(#glow)" />}
    </Svg>
  );
}

/** Three chalk stumps and bails, the way every gully draws its wicket on the wall. */
function Stumps({ k, x, y, h, seed }: { k: number; x: number; y: number; h: number; seed: string }) {
  const rand = useMemo(() => rng(seed), [seed]), passes = [2.4, 1.6, 0.9];
  return (
    <Svg width={50 * k} height={(h + 10) * k} viewBox={`-6 -8 50 ${h + 10}`} style={{ position: "absolute", left: x * k, top: (y - 8) * k }}>
      {passes.map((w, p) => (
        <G key={p} stroke="rgba(238,241,236,0.16)" strokeWidth={w} strokeLinecap="round">
          {[0, 16, 32].map((dx) => <Line key={dx} x1={dx + rand() * 1.5} y1={rand() * 1.5} x2={dx + rand() * 1.5} y2={h} />)}
          <Line x1={-2} y1={-3 + rand()} x2={34} y2={-3 + rand()} />
        </G>
      ))}
    </Svg>
  );
}

function Frame({ width, children }: { width: number; children: (k: number) => ReactNode }) {
  const k = width / BASE;
  return <View style={{ width, height: BASE * RATIO * k, backgroundColor: C.cream, overflow: "hidden" }}>{children(k)}</View>;
}

function Top({ k, p }: { k: number; p: Poster }) {
  return (
    <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
      <Txt style={{ fontSize: 11 * k, fontWeight: "600", color: C.sun, letterSpacing: 0.6 * k }}>Gully cricket</Txt>
      <Num style={{ fontSize: 10 * k, color: C.mute, fontWeight: "500" }}>{p.date}</Num>
    </View>
  );
}

function Footer({ k, p }: { k: number; p: Poster }) {
  return (
    <View style={{ position: "absolute", left: 20 * k, right: 20 * k, bottom: 14 * k, flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: 8 * k }}>
      <Txt numberOfLines={1} style={{ flexShrink: 1, fontSize: 10.5 * k, fontWeight: "500", color: C.teal }}>{p.tagline}</Txt>
      <Num style={{ fontSize: 8.5 * k, color: C.mute, fontWeight: "500" }}>ai.sahilchalke.com/score</Num>
    </View>
  );
}

/** Match poster: both teams (or the solo standings), the result and the top three on MVP points. */
export function MatchPoster({ m, width = BASE }: { m: Match; width?: number }) {
  const p = poster(m);
  return (
    <Frame width={width}>{(k) => (
      <>
        <Backdrop k={k} wallH={190} glow={null} />
        <Stumps k={k} x={286} y={42} h={64} seed={m.id} />
        <View style={{ paddingHorizontal: 20 * k, paddingTop: 20 * k }}>
          <Top k={k} p={p} />
          <Txt style={{ marginTop: 6 * k, fontSize: 36 * k, lineHeight: 40 * k, fontWeight: "700", color: C.fg, letterSpacing: -0.8 * k }}>Match day</Txt>
          <Num style={{ fontSize: 10.5 * k, color: C.mute, fontWeight: "500" }}>{p.format}</Num>

          <View style={{ marginTop: 14 * k }}>
            {p.rows.map((r, i) => (
              <View key={`${r.name}${i}`}>
                {!p.solo && i === 1 && (
                  <View style={{ height: 12 * k, justifyContent: "center" }}>
                    <View style={{ height: 1, backgroundColor: C.line }} />
                    <View style={{ position: "absolute", alignSelf: "center", paddingHorizontal: 8 * k, borderRadius: 99, borderWidth: 1, borderColor: C.sun, backgroundColor: C.cream }}>
                      <Txt style={{ fontSize: 9 * k, fontWeight: "600", color: C.sun }}>vs</Txt>
                    </View>
                  </View>
                )}
                <View style={{ height: (p.solo ? 30 : 50) * k, flexDirection: "row", alignItems: "center", gap: 8 * k }}>
                  {p.solo && <Num style={{ width: 14 * k, fontSize: 12 * k, color: i === 0 ? C.sun : C.mute }}>{i + 1}</Num>}
                  <View style={{ flex: 1 }}>
                    <Txt numberOfLines={1} style={{ fontSize: (p.solo ? 14 : 16) * k, fontWeight: r.won ? "600" : "500", color: r.won ? C.fg : C.teal }}>{r.name}</Txt>
                    {!!r.sub && !p.solo && <Num style={{ fontSize: 10 * k, color: C.mute, fontWeight: "500" }}>{r.sub}</Num>}
                  </View>
                  {p.solo && <Num style={{ fontSize: 10 * k, color: C.mute, fontWeight: "500" }}>{r.sub}</Num>}
                  {r.won
                    ? <Board numberOfLines={1} style={{ fontSize: (p.solo ? 24 : 36) * k, lineHeight: (p.solo ? 28 : 40) * k }}>{r.score}</Board>
                    : <Num numberOfLines={1} style={{ fontSize: (p.solo ? 18 : 26) * k, color: C.fg }}>{r.score}</Num>}
                </View>
              </View>
            ))}
          </View>

          <View style={{ marginTop: 10 * k, borderRadius: 14 * k, backgroundColor: C.sun, paddingHorizontal: 14 * k, paddingVertical: 10 * k }}>
            <Txt numberOfLines={1} adjustsFontSizeToFit style={{ fontSize: 14 * k, fontWeight: "600", color: C.ink }}>{p.result}</Txt>
          </View>

          {p.performers.length > 0 && <Txt style={{ marginTop: 14 * k, fontSize: 10.5 * k, fontWeight: "500", color: C.mute, letterSpacing: 0.4 * k }}>Top performers</Txt>}
          {p.performers.map((r, i) => (
            <View key={r.name} style={{ height: 32 * k, flexDirection: "row", alignItems: "center", gap: 10 * k, borderTopWidth: i ? 1 : 0, borderColor: C.line }}>
              <View style={{ width: 20 * k, height: 20 * k, borderRadius: 99, alignItems: "center", justifyContent: "center", backgroundColor: i === 0 ? C.sun : C.key }}>
                <Num style={{ fontSize: 10 * k, color: i === 0 ? C.ink : C.teal }}>{i + 1}</Num>
              </View>
              <View style={{ flex: 1 }}>
                <Txt numberOfLines={1} style={{ fontSize: 13 * k, fontWeight: "600", color: C.fg }}>{r.name}</Txt>
                <Num numberOfLines={1} style={{ fontSize: 9 * k, color: C.teal, fontWeight: "500" }}>{r.line}</Num>
              </View>
              <Num style={{ fontSize: 16 * k, color: i === 0 ? C.sun : C.fg }}>{r.points}<Num style={{ fontSize: 9 * k, color: C.mute }}> pts</Num></Num>
            </View>
          ))}
        </View>
        <Footer k={k} p={p} />
      </>
    )}</Frame>
  );
}

function Trophy({ k, lit }: { k: number; lit: boolean }) {
  const a = lit ? "#efffbf" : "#3a423c", b = lit ? C.ember : "#232825";
  return (
    <Svg width={92 * k} height={100 * k} viewBox="0 0 100 108">
      <Defs>
        <LinearGradient id="cup" x1="0" y1="0" x2="1" y2="1">
          <Stop offset="0" stopColor={a} />
          <Stop offset="1" stopColor={b} />
        </LinearGradient>
      </Defs>
      <Path d="M22 20 C4 20 4 48 27 52" stroke="url(#cup)" strokeWidth={7} fill="none" strokeLinecap="round" />
      <Path d="M78 20 C96 20 96 48 73 52" stroke="url(#cup)" strokeWidth={7} fill="none" strokeLinecap="round" />
      <Path d="M18 10 H82 Q82 62 50 68 Q18 62 18 10 Z" fill="url(#cup)" />
      <Rect x={45} y={66} width={10} height={16} fill="url(#cup)" />
      <Rect x={30} y={81} width={40} height={10} rx={2} fill="url(#cup)" />
      <Rect x={24} y={92} width={52} height={9} rx={2} fill="url(#cup)" />
      <Ellipse cx={32} cy={30} rx={4} ry={13} fill="#ffffff" opacity={lit ? 0.35 : 0.08} transform="rotate(-10 32 30)" />
    </Svg>
  );
}

/** Winner poster: the champions (or the solo winner) under a trophy, the margin and their star player. */
export function WinnerPoster({ m, width = BASE }: { m: Match; width?: number }) {
  const p = poster(m), won = !!p.winner;
  const confetti = useMemo(() => {
    const rand = rng(m.id);
    return Array.from({ length: won ? 46 : 0 }, () => ({ x: rand() * BASE, y: 30 + rand() * 230, s: 3 + rand() * 4, r: rand() * 180, o: 0.3 + rand() * 0.6, lime: rand() < 0.6 }));
  }, [m.id, won]);
  const label = won ? (p.solo ? "Gully king" : "Champions") : "Honours even";
  return (
    <Frame width={width}>{(k) => (
      <>
        <Backdrop k={k} wallH={140} glow={{ y: 120, r: 200, o: won ? 0.24 : 0.07 }} />
        {confetti.map((c, i) => (
          <View key={i} style={{ position: "absolute", left: c.x * k, top: c.y * k, width: c.s * k, height: (c.s / 2) * k, opacity: c.o,
            backgroundColor: c.lime ? C.sun : C.teal, transform: [{ rotate: `${c.r}deg` }] }} />
        ))}
        <Stumps k={k} x={28} y={350} h={44} seed={m.id} />
        <View style={{ paddingHorizontal: 20 * k, paddingTop: 20 * k, alignItems: "stretch" }}>
          <Top k={k} p={p} />
          <View style={{ alignItems: "center", marginTop: 14 * k }}>
            <Trophy k={k} lit={won} />
            <Txt style={{ marginTop: 10 * k, fontSize: 12 * k, fontWeight: "600", color: C.sun, letterSpacing: 2.4 * k }}>{label}</Txt>
            <Txt numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.45}
              style={{ marginTop: 2 * k, fontSize: 40 * k, lineHeight: 46 * k, fontWeight: "700", color: C.fg, letterSpacing: -0.8 * k, textAlign: "center", alignSelf: "stretch" }}>
              {won ? p.winner : p.headline}
            </Txt>
            <Txt numberOfLines={1} style={{ fontSize: 14 * k, color: C.teal, textAlign: "center" }}>{won ? p.margin : p.result}</Txt>
            <Num numberOfLines={1} style={{ marginTop: 6 * k, fontSize: 10 * k, color: C.mute, fontWeight: "500" }}>
              {p.rows.slice(0, p.solo ? 3 : 2).map((r) => `${r.name} ${r.score}`).join(p.solo ? "  ·  " : "  v  ")}
            </Num>
          </View>
          {p.star && (
            <View style={{ marginTop: 16 * k, borderRadius: 18 * k, borderWidth: 1, borderColor: "#2e3a22", backgroundColor: C.sunSoft, padding: 14 * k, flexDirection: "row", alignItems: "center", gap: 10 * k }}>
              <View style={{ flex: 1 }}>
                <Txt style={{ fontSize: 10.5 * k, fontWeight: "500", color: "#b8d96a", letterSpacing: 0.4 * k }}>{p.solo ? "Top of the gully" : "Star of the side"}</Txt>
                <Txt numberOfLines={1} style={{ marginTop: 2 * k, fontSize: 19 * k, fontWeight: "600", color: C.fg }}>{p.star.name}</Txt>
                <Num numberOfLines={1} style={{ marginTop: 1 * k, fontSize: 10 * k, color: C.teal, fontWeight: "500" }}>{p.star.line}</Num>
              </View>
              <View style={{ alignItems: "flex-end" }}>
                <Board style={{ fontSize: 30 * k, lineHeight: 34 * k }}>{String(p.star.points)}</Board>
                <Txt style={{ fontSize: 9 * k, color: C.mute }}>MVP points</Txt>
              </View>
            </View>
          )}
        </View>
        <Footer k={k} p={p} />
      </>
    )}</Frame>
  );
}
