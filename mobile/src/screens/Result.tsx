import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Animated, Dimensions, Easing, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import Svg, { Path } from "react-native-svg";
import { FileText, Handshake, Image as ImageIcon, RotateCcw, Share2, Star, Trophy, Undo2, type LucideIcon } from "lucide-react-native";
import * as E from "@shared/engine/engine";
import type { Match } from "@shared/engine/types";
import { canScore } from "@/lib/device";
import { useMatch, useStore } from "@/lib/store";
import { sendText, shareImage, sharePdf, shareText, type ImageKind } from "@/lib/share";
import { AdBanner } from "@/ui/AdBanner";
import { Badge, Board, C, Card, GhostButton, Header, Num, Page, Press, PrimaryButton, ScoreHero, Txt, tw } from "@/ui/ui";
import { SmallCard } from "@/ui/ScorecardImages";
import { MatchPoster, WinnerPoster } from "@/ui/Posters";
import { AwardsCard } from "@/ui/Charts";
import { playerOfTheMatch } from "@shared/mvp";
import { soloLines } from "@shared/share";
import { OpenersSheet, SoloTable, SoloTurnSheet } from "./sheets";
import { canRematch, rematchMatch, tallyText } from "@shared/afterMatch";
import { SeriesAfterMatch } from "./Series";
import { track } from "@/lib/track";
import { EV } from "@shared/events";

const FRAMES = 260;
const COLORS = [C.sun, C.sun, C.teal, C.mute, "#ffffff"];
const lbl = [tw`text-[12px] font-medium text-mute`, { letterSpacing: 0.4 }];

function Confetti() {
  const t = useRef(new Animated.Value(0)).current;
  const [done, setDone] = useState(false);
  const bits = useMemo(() => {
    const { width, height } = Dimensions.get("window");
    return Array.from({ length: 140 }, () => {
      const x = Math.random() * width, y = -20 - Math.random() * height * 0.6, vx = (Math.random() - 0.5) * 3, vy = 2 + Math.random() * 4;
      const r = Math.random() * Math.PI, vr = (Math.random() - 0.5) * 0.3, s = 6 + Math.random() * 8;
      return {
        s, col: COLORS[Math.floor(Math.random() * COLORS.length)],
        tx: t.interpolate({ inputRange: [0, 1], outputRange: [x - s / 2, x - s / 2 + vx * FRAMES] }),
        ty: t.interpolate({ inputRange: [0, 1], outputRange: [y - s / 4, y - s / 4 + vy * FRAMES] }),
        rot: t.interpolate({ inputRange: [0, 1], outputRange: [`${r}rad`, `${r + vr * FRAMES}rad`] }),
      };
    });
  }, [t]);
  useEffect(() => {
    const a = Animated.timing(t, { toValue: 1, duration: (FRAMES * 1000) / 60, easing: Easing.linear, useNativeDriver: true });
    a.start(() => setDone(true));
    return () => a.stop();
  }, [t]);
  if (done) return null;
  return (
    <View pointerEvents="none" style={[tw`absolute inset-0`, { zIndex: 50, elevation: 50 }]}>
      {bits.map((b, i) => (
        <Animated.View key={i} style={{ position: "absolute", left: 0, top: 0, width: b.s, height: b.s / 2, backgroundColor: b.col,
          transform: [{ translateX: b.tx }, { translateY: b.ty }, { rotate: b.rot }] }} />
      ))}
    </View>
  );
}

function Preview({ m }: { m: Match }) {
  const [w, setW] = useState(0);
  return (
    <View onLayout={(e) => setW(e.nativeEvent.layout.width)} accessibilityLabel="Scorecard to share"
      style={[tw`w-full rounded-3xl overflow-hidden`, { elevation: 10, shadowColor: "#000", shadowOpacity: 0.4, shadowRadius: 15, shadowOffset: { width: 0, height: 10 } }]}>
      {w > 0 && <SmallCard m={m} width={w} />}
    </View>
  );
}

/** WhatsApp mark drawn in the same outline style as the lucide icons. */
function WhatsApp({ size = 18, color }: { size?: number; color: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <Path d="M3 21l1.65-3.8a9 9 0 1 1 3.4 2.9L3 21" />
      <Path d="M9 10a.5.5 0 0 0 1 0V9a.5.5 0 0 0-1 0v1a5 5 0 0 0 5 5h1a.5.5 0 0 0 0-1h-1a.5.5 0 0 0 0 1" />
    </Svg>
  );
}

/** Icon and label laid out for the inside of a button. */
function IconLabel({ icon: I, mark, children, tone = C.fg, strong }: { icon?: LucideIcon; mark?: ReactNode; children: string; tone?: string; strong?: boolean }) {
  return (
    <View style={tw`flex-row items-center justify-center gap-2`}>
      {mark}
      {I && <I size={18} color={tone} strokeWidth={2} />}
      <Txt style={[tw`text-[15px] ${strong ? "font-semibold" : "font-medium"}`, { color: tone, flexShrink: 1 }]}>{children}</Txt>
    </View>
  );
}

/** The evening's running score and a one-tap rematch: same teams and rules, straight to the openers. */
function Rematch({ m }: { m: Match }) {
  const { matches, add, put, go } = useStore();
  const [next, setNext] = useState<Match | null>(null);
  const tally = tallyText(matches, m);
  const start = (n: Match) => { track(EV.rematch); add(n); put(n); setNext(null); go("live", n.id); };
  return (
    <>
      {tally && (
        <Card style={tw`items-center p-3`}>
          <Txt style={lbl}>This evening</Txt>
          <Txt style={tw`mt-1 text-center text-[15px] font-semibold text-fg`}>{tally}</Txt>
        </Card>
      )}
      {canRematch(m) && canScore(m) && <PrimaryButton tone="navy" onPress={() => setNext(rematchMatch(m))}><IconLabel icon={RotateCcw}>{E.isSolo(m) ? "Rematch, same players and rules" : "Rematch, same teams and rules"}</IconLabel></PrimaryButton>}
      {next && (E.isSolo(next) ? <SoloTurnSheet match={next} onClose={() => setNext(null)} onStart={start} />
        : <OpenersSheet match={next} onClose={() => setNext(null)} onStart={start} />)}
    </>
  );
}

function PotmCard({ name, line }: { name: string; line: string }) {
  return (
    <View style={[tw`rounded-[22px] overflow-hidden border`, { borderColor: "#4a2c14" }]}>
      <LinearGradient colors={[C.sunSoft, C.panel]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={tw`p-4`}>
        <Txt style={[lbl, { color: "#ffb27a" }]}>Player of the match</Txt>
        <View style={tw`mt-2.5 flex-row items-center gap-3`}>
          <Badge name={name} size={44} />
          <View style={tw`flex-1`}>
            <Txt style={tw`text-[17px] font-semibold text-fg`} numberOfLines={1}>{name}</Txt>
            <Num style={tw`mt-0.5 text-[12px] font-medium text-teal`}>{line}</Num>
          </View>
          <Star size={20} color={C.sun} strokeWidth={2} />
        </View>
      </LinearGradient>
    </View>
  );
}

function PosterTile({ m, kind, label }: { m: Match; kind: ImageKind; label: string }) {
  const [w, setW] = useState(0);
  return (
    <Press onPress={() => shareImage(m, kind)} accessibilityLabel={`Send ${label.toLowerCase()}`} style={tw`flex-1 overflow-hidden rounded-[18px] border border-line bg-panel`}>
      <View onLayout={(e) => setW(e.nativeEvent.layout.width)} style={{ width: "100%", aspectRatio: 360 / 450 }}>
        {w > 0 && (kind === "match" ? <MatchPoster m={m} width={w} /> : <WinnerPoster m={m} width={w} />)}
      </View>
      <View style={tw`flex-row items-center justify-between px-3 py-2.5`}>
        <Txt style={tw`text-[14px] font-medium text-fg`}>{label}</Txt>
        <Share2 size={16} color={C.teal} strokeWidth={2} />
      </View>
    </Press>
  );
}

/** Highlights preview and every way to send the match: images, text, posters and the PDF scoresheet. */
function Sharing({ m, text, textLabel }: { m: Match; text: () => void; textLabel: string }) {
  const [busy, setBusy] = useState(false);
  return (
    <>
      <Preview m={m} />
      <PrimaryButton onPress={() => shareImage(m, "full")}><IconLabel mark={<WhatsApp color={C.ink} />} tone={C.ink} strong>Send full scorecard on WhatsApp</IconLabel></PrimaryButton>
      <View style={tw`flex-row gap-2`}>
        <View style={tw`flex-1`}><GhostButton onPress={() => shareImage(m, "card")}><IconLabel icon={ImageIcon}>Send highlights</IconLabel></GhostButton></View>
        <View style={tw`flex-1`}><GhostButton onPress={text}><IconLabel icon={Share2}>{textLabel}</IconLabel></GhostButton></View>
      </View>
      <View style={tw`mt-2 flex-row items-center justify-between`}>
        <Txt style={lbl}>Posters</Txt>
        <Txt style={tw`text-xs text-mute`}>tap one to send it</Txt>
      </View>
      <View style={tw`flex-row gap-2`}>
        <PosterTile m={m} kind="match" label="Match poster" />
        <PosterTile m={m} kind="winner" label="Winner poster" />
      </View>
      <GhostButton disabled={busy} onPress={async () => { setBusy(true); await sharePdf(m); setBusy(false); }}>
        <IconLabel icon={FileText}>{busy ? "Making the PDF…" : "Save scoresheet as PDF"}</IconLabel>
      </GhostButton>
    </>
  );
}

/** Each side's total, first-batting side first, as on the scorecard. */
function scores(m: Match) {
  const first = E.firstBatting(m), order = [first, first === 0 ? 1 : 0] as const;
  return order.map((side) => {
    if (E.isTest(m)) return { side, score: E.sideScore(m, side) ?? "Yet to bat", overs: "" };
    const i = m.innings.findIndex((inn) => inn.bat === side && !inn.superOver);
    if (i < 0) return { side, score: "Yet to bat", overs: "" };
    const st = E.replay(m, i);
    return { side, score: `${st.runs}/${st.wickets}`, overs: `${E.oversText(st.legal, st.bpo)} ov` };
  });
}

export default function Result() {
  const m = useMatch();
  const { go, put, undo } = useStore();
  const [superOver, setSuperOver] = useState(false);
  useEffect(() => { if (m && m.status !== "done") go("live"); }, [m, go]);
  if (!m || m.status !== "done") return null;

  if (E.isSolo(m)) return <SoloResult m={m} />;
  const res = E.result(m)!, aw = E.awards(m), potm = playerOfTheMatch(m);
  const winner = res.winner !== null ? m.teams[res.winner].name : null;
  const canSuper = res.tie && m.innings.length === 2;

  const margin = winner && res.text.startsWith(`${winner} won `) ? res.text.slice(winner.length + 5) : null;
  const date = new Date(m.createdAt).toLocaleDateString("en-IN", { day: "numeric", month: "short" });

  return (
    <View style={tw`flex-1`}>
      <Page>
        <Header title="Match summary" back={() => go("home")} />
        <View style={tw`gap-3 px-4 pt-1`}>
          <View style={tw`items-center`}>
            <Num style={[lbl, tw`font-medium`]}>{`${date} · ${E.formatText(m)}`}</Num>
            <View style={tw`mt-4 h-16 w-16 rounded-full items-center justify-center ${winner ? "bg-sun" : "border border-line bg-key"}`}>
              {winner ? <Trophy size={30} color={C.ink} strokeWidth={2} /> : <Handshake size={28} color={C.teal} strokeWidth={2} />}
            </View>
            <Txt accessibilityRole="header" style={[tw`mt-3 px-2 text-center text-[26px] font-bold text-fg`, { letterSpacing: -0.4, lineHeight: 32 }]}>
              {winner ? `${winner} win` : res.text}
            </Txt>
            {!!margin && <Txt style={tw`mt-0.5 text-center text-[14px] text-teal`}>{margin}</Txt>}
          </View>
          <ScoreHero wall style={tw`mt-2`}>
            {scores(m).map(({ side, score, overs }, i) => {
              const won = res.winner === side;
              return (
                <View key={side} style={[tw`flex-row items-center justify-between gap-3 ${i ? "pt-2.5" : "pb-2.5 border-b border-line"}`]}>
                  <View style={tw`flex-1`}>
                    <Txt style={tw`text-[14px] ${won ? "font-semibold text-fg" : "text-teal"}`} numberOfLines={1}>{m.teams[side].name}</Txt>
                    {!!overs && <Num style={tw`mt-0.5 text-[11px] font-medium text-mute`}>{overs}</Num>}
                  </View>
                  {won
                    ? <Board style={{ fontSize: 30, lineHeight: 34 }} numberOfLines={1} adjustsFontSizeToFit>{score}</Board>
                    : <Num style={tw`text-[20px] ${res.winner === null ? "text-fg" : "text-teal"}`}>{score}</Num>}
                </View>
              );
            })}
          </ScoreHero>
          {canSuper && canScore(m) && <PrimaryButton tone="navy" onPress={() => setSuperOver(true)}>Play a super over</PrimaryButton>}
          {m.series && <SeriesAfterMatch m={m} />}
          {potm && <PotmCard name={potm.name} line={potm.line} />}
          <View style={tw`flex-row gap-2`}>
            <Card style={tw`flex-1 p-3`}>
              <Txt style={lbl}>Top scorer</Txt>
              <Txt style={tw`mt-1.5 text-[14px] font-semibold text-fg`} numberOfLines={1}>{aw.topScorer?.name ?? "-"}</Txt>
              <Num style={tw`mt-0.5 text-[13px] text-sun`}>{aw.topScorer?.line ?? ""}</Num>
            </Card>
            <Card style={tw`flex-1 p-3`}>
              <Txt style={lbl}>Best bowling</Txt>
              <Txt style={tw`mt-1.5 text-[14px] font-semibold text-fg`} numberOfLines={1}>{aw.bestBowler?.name ?? "-"}</Txt>
              <Num style={tw`mt-0.5 text-[13px] text-sun`}>{aw.bestBowler?.line ?? ""}</Num>
            </Card>
          </View>
          <AwardsCard m={m} />
          <Sharing m={m} text={() => void shareText(m)} textLabel="Send as text" />
          <View style={tw`flex-row gap-2`}>
            <View style={tw`flex-1`}><GhostButton onPress={() => go("scorecard")}><IconLabel tone={C.teal}>Full scorecard</IconLabel></GhostButton></View>
            {canScore(m) ? (
              <View style={tw`flex-1`}><GhostButton onPress={() => undo(m.id)}><IconLabel icon={Undo2} tone={C.mute}>Undo last ball</IconLabel></GhostButton></View>
            ) : <View style={tw`flex-1`} />}
          </View>
          <Rematch m={m} />
          {m.series ? null : m.cup
            ? <PrimaryButton tone="navy" onPress={() => { useStore.setState({ cupId: m.cup!.id }); go("cup"); }}>Back to the tournament</PrimaryButton>
            : <PrimaryButton tone="navy" onPress={() => go("setup")}>Play again, same teams</PrimaryButton>}
          <View style={tw`pt-3`}><AdBanner /></View>
        </View>
      </Page>
      {winner && <Confetti />}
      {superOver && <OpenersSheet match={m} onClose={() => setSuperOver(false)} onStart={(n) => { put(n); setSuperOver(false); go("live"); }} />}
    </View>
  );
}

/** Solo standings as WhatsApp text. */
const soloText = (m: Match) =>
  [`Gully cricket, ${E.formatText(m)}`, E.result(m)?.text ?? "", "", ...soloLines(m), "", "Scored with ai.sahilchalke.com/score"].join("\n");

const BOWL: [string, number][] = [["O", 36], ["W", 30], ["R", 34], ["Econ", 44]];

function SoloResult({ m }: { m: Match }) {
  const { go, undo } = useStore();
  const res = E.result(m)!, rows = E.soloStandings(m), potm = playerOfTheMatch(m);
  const winner = rows.find((r) => r.id === res.winnerId), second = winner ? rows.find((r) => r.id !== winner.id) : undefined;
  const bowlers = rows.filter((r) => r.bowled > 0).sort((a, b) => b.wickets - a.wickets || a.conceded - b.conceded);
  const date = new Date(m.createdAt).toLocaleDateString("en-IN", { day: "numeric", month: "short" });
  function again() {
    const names = m.teams[0].players.map((p) => p.name);
    useStore.setState({ lastSetup: { a: "", b: "", na: names, nb: [], size: names.length, rules: m.rules, common: "" } });
    go("setup");
  }
  return (
    <View style={tw`flex-1`}>
      <Page>
        <Header title="Match summary" back={() => go("home")} />
        <View style={tw`gap-3 px-4 pt-1`}>
          <View style={tw`items-center`}>
            <Num style={[lbl, tw`font-medium`]}>{`${date} · ${E.formatText(m)}`}</Num>
            <View style={tw`mt-4 h-16 w-16 rounded-full items-center justify-center ${winner ? "bg-sun" : "border border-line bg-key"}`}>
              {winner ? <Trophy size={30} color={C.ink} strokeWidth={2} /> : <Handshake size={28} color={C.teal} strokeWidth={2} />}
            </View>
            <Txt accessibilityRole="header" style={[tw`mt-3 px-2 text-center text-[26px] font-bold text-fg`, { letterSpacing: -0.4, lineHeight: 32 }]}>
              {winner ? `${winner.name} wins` : res.text}
            </Txt>
            {winner && <Txt style={tw`mt-0.5 px-2 text-center text-[14px] text-teal`}>{res.text}</Txt>}
          </View>
          {winner && (
            <ScoreHero wall style={tw`mt-2`}>
              <View style={tw`flex-row items-center justify-between gap-3`}>
                <View style={tw`flex-1`}>
                  <Txt style={tw`text-[14px] font-semibold text-fg`} numberOfLines={1}>{winner.name}</Txt>
                  <Num style={tw`mt-0.5 text-[11px] font-medium text-mute`}>{`${winner.balls} balls · SR ${winner.strikeRate.toFixed(0)}`}</Num>
                </View>
                <Board style={{ fontSize: 40, lineHeight: 44 }} numberOfLines={1} adjustsFontSizeToFit>{winner.runs}</Board>
              </View>
              {second && (
                <View style={tw`mt-2.5 flex-row items-center justify-between gap-3 border-t border-line pt-2.5`}>
                  <Txt style={tw`flex-1 text-[14px] text-teal`} numberOfLines={1}>{second.name}</Txt>
                  <Num style={tw`text-[20px] text-teal`}>{second.runs}</Num>
                </View>
              )}
            </ScoreHero>
          )}
          {potm && <PotmCard name={potm.name} line={potm.line} />}
          <Txt style={[lbl, tw`mt-2`]}>Standings</Txt>
          <Card style={tw`p-0 overflow-hidden`}><SoloTable match={m} full highlight={res.winnerId} /></Card>
          <Txt style={[lbl, tw`mt-2`]}>Bowling</Txt>
          <Card style={tw`p-0 overflow-hidden`}>
            <View style={tw`flex-row items-center px-3.5 py-2.5`}>
              <Txt style={tw`flex-1 text-[12px] font-medium text-mute`}>Bowler</Txt>
              {BOWL.map(([h, w]) => <Txt key={h} style={[tw`text-right text-[12px] font-medium text-mute`, { width: w }]}>{h}</Txt>)}
            </View>
            {bowlers.map((r) => {
              const vals = [E.oversText(r.bowled, E.ballsPerOver(m.rules)), r.wickets, r.conceded, E.runRate(r.conceded, r.bowled, E.ballsPerOver(m.rules)).toFixed(1)];
              return (
                <View key={r.id} style={tw`flex-row items-center border-t border-line px-3.5 py-3`}>
                  <Txt style={tw`flex-1 min-w-0 pr-1 text-[14px] font-medium text-fg`} numberOfLines={1}>{r.name}</Txt>
                  {vals.map((v, k) => <Num key={k} style={[k === 1 ? tw`text-[16px] text-fg` : tw`text-[13px] text-teal`, { textAlign: "right", width: BOWL[k][1] }]}>{String(v)}</Num>)}
                </View>
              );
            })}
          </Card>
          <AwardsCard m={m} />
          <Sharing m={m} text={() => { track(EV.share, { what: "text" }); void sendText(soloText(m)); }} textLabel="Send standings as text" />
          <View style={tw`flex-row gap-2`}>
            <View style={tw`flex-1`}><GhostButton onPress={() => go("scorecard")}><IconLabel tone={C.teal}>Full scorecard</IconLabel></GhostButton></View>
            {canScore(m) ? (
              <View style={tw`flex-1`}><GhostButton onPress={() => undo(m.id)}><IconLabel icon={Undo2} tone={C.mute}>Undo last ball</IconLabel></GhostButton></View>
            ) : <View style={tw`flex-1`} />}
          </View>
          <Rematch m={m} />
          <PrimaryButton tone="navy" onPress={again}><IconLabel icon={RotateCcw}>Play again, same players</IconLabel></PrimaryButton>
          <View style={tw`pt-3`}><AdBanner /></View>
        </View>
      </Page>
      {winner && <Confetti />}
    </View>
  );
}
