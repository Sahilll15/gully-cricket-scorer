import { useEffect, useRef, useState, type ReactNode } from "react";
import { Animated, Easing, Pressable, ScrollView, StyleSheet, View, useWindowDimensions, type ScrollViewInstance } from "react-native";
import { useKeepAwake } from "expo-keep-awake";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Svg, { Circle, Path } from "react-native-svg";
import { ArrowLeftRight, ChevronLeft, ChevronRight, ClipboardList, Heart, Mic, MicOff, MoreHorizontal, Radio, Redo2, Timer, Undo2, type LucideIcon } from "lucide-react-native";
import * as E from "@shared/engine/engine";
import type { Ball, BallInput, Extra, Match, Surface, WicketKind } from "@shared/engine/types";
import * as K from "@shared/liveKit";
import { useMatch, useStore } from "@/lib/store";
import { useLivePrefs, type LivePrefs } from "@/lib/livePrefs";
import { say } from "@/lib/speak";
import { BowlerSheet, EditBallSheet, FrenchNextSheet, Note, OpenersSheet, OversSheet, RetireSheet, SoloTable, SoloTurnSheet, WicketSheet } from "./sheets";
import { AddPlayerSheet, BallLostSheet, ChangeLogSheet, Chip, DidRunSheet, OverthrowSheet, PairsStrip, PenaltySheet, PlayerLeftSheet, RulesSheet, TurfChip, TurfSheet, WagonSheet } from "./liveSheets";
import { BallChip, Beams, Board, buzz, C, Card, ChaseRing, ConfirmSheet, IconButton, LiveDot, LivePill, Num, Press, PrimaryButton, Sheet, Toggle, Txt, tw } from "@/ui/ui";
import { Crease } from "@/ui/gully";
import { listen, parse, voiceSupported } from "@/lib/voice";
import { liveSupported, newCode, newLiveKey, newMoveToken, scoreLink, watchLink } from "@/lib/live";
import { canScore, deviceId, movedAway } from "@/lib/device";
import { copyText, sendText } from "@/lib/share";
import { track } from "@/lib/track";
import { EV } from "@shared/events";

const HAIR = "#1e2321";
const OUT_BG = "#2b1311", OUT_LINE = "#4a1f1a";
const LBL = { fontSize: 11, letterSpacing: 0.6, color: C.mute };
type SixMoment = { name: string; runs: number; balls: number; key: number };

export default function Live() {
  useKeepAwake();
  const m = useMatch();
  const { go, put, redo, ball, undo, redoBall } = useStore();
  const [armed, setArmed] = useState<Extra | null>(null);
  const [wicket, setWicket] = useState<Extra | null | false>(false);
  const [wicketKind, setWicketKind] = useState<WicketKind | null>(null);
  const [edit, setEdit] = useState<number | null>(null);
  const [more, setMore] = useState(false);
  const [share, setShare] = useState(false);
  const [openers, setOpeners] = useState(false);
  const [turnOpen, setTurnOpen] = useState(false);
  const [pickBowler, setPickBowler] = useState(false);
  const [oversOpen, setOversOpen] = useState(false);
  const [retireOpen, setRetireOpen] = useState(false);
  const [retireFor, setRetireFor] = useState<string | null>(null);
  const [retireHurt, setRetireHurt] = useState(false);
  const [panel, setPanel] = useState<Panel | null>(null);
  const [touched, setTouched] = useState(false);
  const [missed, setMissed] = useState(false);
  const [wall, setWall] = useState<Surface | null>(null);
  const [ot, setOt] = useState(0);
  const [didRun, setDidRun] = useState<BallInput | null>(null);
  const [wagon, setWagon] = useState<{ idx: number; evIdx: number } | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [ending, setEnding] = useState(false);
  const [stopping, setStopping] = useState(false);
  const [six, setSix] = useState<SixMoment | null>(null);
  const [outFlash, setOutFlash] = useState(0);
  const [fourPop, setFourPop] = useState(0);
  const [mic, setMic] = useState(false);
  const [heard, setHeard] = useState("");
  const stopRef = useRef<() => void>(() => {});
  const topRef = useRef<ScrollViewInstance>(null);
  const fit = useRef({ view: 0, content: 0 });
  const nudge = () => { const over = fit.current.content - fit.current.view; if (over > 0 && over <= 56) topRef.current?.scrollToEnd({ animated: false }); };
  const latest = useRef(m);
  latest.current = m;
  const micOn = useRef(mic);
  micOn.current = mic;
  const prefs = useLivePrefs((s) => (m ? s.prefs[m.id] : undefined)) ?? NO_PREFS;
  const setPrefs = useLivePrefs((s) => s.setPrefs);
  const { width, height } = useWindowDimensions();
  const wide = width >= 360, keyH = height >= 780 ? 66 : 62;
  const insets = useSafeAreaInsets();

  useEffect(() => { if (m?.status === "done") go("result"); }, [m?.status, go]);
  const overDone = !!m && m.status === "live" && m.innings.length > 0 && E.needsBowler(m, m.innings.length - 1);
  const [bowlerDue, setBowlerDue] = useState(overDone);
  // Let the last ball's FOUR or SIX land before the bowler sheet slides over it.
  useEffect(() => {
    if (!overDone) { setBowlerDue(false); return; }
    const t = setTimeout(() => setBowlerDue(true), 700);
    return () => clearTimeout(t);
  }, [overDone]);
  const waiting = overDone && !bowlerDue;
  const locked = !!m && !canScore(m);
  useEffect(() => () => stopRef.current(), []);
  useEffect(() => { if (locked && mic) { stopRef.current(); setMic(false); } }, [locked, mic]);
  if (!m || !m.innings.length) return null;

  const idx = m.innings.length - 1, inn = m.innings[idx], st = E.replay(m, idx);
  const tgt = E.target(m, idx), batTeam = m.teams[inn.bat], fieldTeam = m.teams[E.otherSide(inn.bat)];
  const bpo = st.bpo, overNo = Math.floor(st.legal / bpo);
  const thisOver = st.legal % bpo === 0 && st.legal > 0 && !E.needsBowler(m, idx) ? [] : (st.overs[overNo] ?? []);
  const shownOver = thisOver.length ? thisOver : (st.overs[overNo - 1] ?? []);
  const overStart = inn.events.length - (thisOver.length ? countEvents(inn.events, thisOver.length) : 0);

  const french = E.isFrench(m), pairs = E.isPairs(m);
  const mustTouch = E.mustRunMode(m.rules) === "touch" && !m.rules.noRunning && !french;
  const walls = K.wallKeys(m.rules);

  function show(input: BallInput, before?: Match, after?: Match) {
    if (input.wicket || (before && after && K.ballWasOut(before, after))) { setOutFlash(Date.now()); buzz("warn"); }
    else if (!input.extra && !input.wall && input.runs === 6) {
      if (before && after) {
        const i = before.innings.length - 1, sid = E.replay(before, i).striker, s = sid ? E.replay(after, i).bat.get(sid) : undefined;
        setSix({ name: E.playerName(after, sid), runs: s?.runs ?? 0, balls: s?.balls ?? 0, key: Date.now() });
      }
      buzz("heavy");
    }
    else if (!input.extra && !input.wall && input.runs === 4) { setFourPop(Date.now()); buzz("heavy"); }
    else buzz("tap");
  }
  const clearMods = () => { setArmed(null); setTouched(false); setMissed(false); setWall(null); setOt(0); };
  // After any ball: what the rules did, the spoken line, and the wagon wheel tap.
  function afterBall(before: Match, after: Match, input: BallInput) {
    // Voice scoring holds an old closure, so read the live values; speech would also be heard as a score.
    const now = useLivePrefs.getState().prefs[before.id] ?? NO_PREFS, i = before.innings.length - 1;
    setNotice(K.ballNotice(before, after, input));
    if (now.speak && !micOn.current) say(K.commentary(before, after, input));
    if (now.wagon && K.wantsZone(input) && after.status !== "done" && after.innings[i]) setWagon({ idx: i, evIdx: after.innings[i].events.length - 1 });
  }
  function commit(input: BallInput) {
    const before = m!, after = E.addBall(before, input);
    ball(before.id, input); show(input, before, after); clearMods();
    retireCheck(before, after); afterBall(before, after, input);
  }
  function score(runs: number) {
    const input: BallInput = {
      runs, ...(armed && { extra: armed }), ...(touched && { touched: true as const }), ...(missed && { missed: true as const }),
      ...(wall && { wall }), ...(ot > 0 && { overthrow: ot }),
    };
    if (E.mustRunPrompt(m!.rules, input)) { setDidRun(input); return; }
    commit(input);
  }
  function confirmWicket(next: Match, input: BallInput) {
    const full: BallInput = { ...input, ...(touched && { touched: true as const }), ...(missed && { missed: true as const }) };
    const after = E.addBall(next, full);
    put(after); useStore.setState({ redo: [] }); retireCheck(next, after);
    show(full); setWicket(false); setWicketKind(null); clearMods(); afterBall(next, after, full);
  }

  // Only the ball that takes a batter to the retire-at score opens the sheet, so closing it sticks.
  function retireCheck(before: Match, after: Match) {
    const i = after.innings.length - 1, id = after.status === "live" ? E.dueToRetire(after, i) : null;
    if (id && (E.replay(before, i).bat.get(id)?.runs ?? 0) < (after.rules.retireAt ?? 0)) { setRetireFor(id); setRetireOpen(true); }
  }
  const closeRetire = () => { setRetireOpen(false); setRetireFor(null); setRetireHurt(false); };

  function toggleMic() {
    if (mic) { track(EV.voice_off); stopRef.current(); setMic(false); setHeard(""); return; }
    track(EV.voice_on);
    stopRef.current = listen((said) => {
      const cur = latest.current, cmd = parse(said);
      track(EV.voice_command, { understood: cmd ? 1 : 0, kind: cmd?.kind ?? "none" });
      setHeard(cmd ? `Heard "${said}"` : `Heard "${said}", not a score`);
      if (!cmd || !cur || cur.status !== "live") return;
      if (cmd.kind === "undo") useStore.getState().undo(cur.id);
      else if (cmd.kind === "out") setWicket(cmd.extra ?? null);
      else if (!E.needsBowler(cur, cur.innings.length - 1)) {
        const after = E.addBall(cur, cmd.input);
        useStore.getState().ball(cur.id, cmd.input); show(cmd.input, cur, after); retireCheck(cur, after); afterBall(cur, after, cmd.input);
      }
    }, () => { setMic(false); setHeard("Mic is blocked. Allow it in your phone settings."); });
    setMic(true);
  }

  const name = (id: string | null) => E.playerName(m, id);
  const bat = (id: string | null) => (id ? st.bat.get(id) : undefined);
  const bowler = st.bowl.get(inn.bowler);
  const need = tgt !== null ? tgt - st.runs : 0, left = E.ballsLeft(m, idx) ?? 0;
  const label = E.inningsLabel(m, idx);
  const test = E.isTest(m), status = E.testStatus(m), ballsLeft = E.matchBallsLeft(m);
  // A Test's 4th innings has nothing to declare for: it ends in a result or a draw.
  const canDeclare = test && idx < 3;
  const capText = ballsLeft !== null ? ` · ${E.oversText(ballsLeft, bpo)} overs left in the match` : "";
  const last = inn.events[inn.events.length - 1];
  // Odd runs usually swap ends, but a short run or a misfield can leave them where they were.
  const oddRuns = m.status === "live" && last?.t === "ball" && last.runs % 2 === 1 && !last.wicket && !!st.nonStriker ? last : null;
  const editing = edit !== null ? inn.events[edit] : undefined;
  const chasing = !test && tgt !== null;
  const crr = E.runRate(st.runs, st.legal, bpo);
  const scoring = !locked && m.status === "live";
  const showMic = voiceSupported && !locked;
  const solo = E.isSolo(m), me = bat(inn.striker), upNext = solo ? E.nextBatter(m) : null;
  const turnLeft = solo ? E.turnBallsLeft(m) : null, livesLeft = solo ? E.livesLeft(m) : 0;
  const rounds = french ? 1 : m.rules.rounds ?? 1, round = solo ? E.soloRound(m) : 0, turns = m.teams[0].players.length * rounds;
  const badges = m.status === "live" ? K.nextBallBadges(m, st) : [];
  const ump = E.umpire(m), guard = m.status === "live" ? K.protectedNote(m, st) : null;
  const leader = E.stopLeaderWins(m) !== m;
  const anyArmed = !!armed || !!wall || ot > 0;
  const armedText = [armed && { wd: "Wide", nb: "No ball", b: "Byes", lb: "Leg byes" }[armed], wall && `${K.SURFACE_NAME[wall]} (${E.wallValue(m.rules, wall)})`, ot > 0 && `overthrow +${ot}`]
    .filter(Boolean).join(", ");
  const keyLabel = (r: number) => (armed ? extraLabel(armed, r) : wall ? `${K.SURFACE_NAME[wall]}${r ? `+${r}` : ""}` : String(r));
  const notBatted = !solo && m.status === "break" ? E.notBattedYet(m, inn.bat) : [];
  const turf = prefs.turfEnd ?? null;
  const onTurfAlert = (text: string) => { buzz("warn"); setNotice(text); };
  const closeMore = (then: () => void) => () => { setMore(false); then(); };

  const strip = anyArmed ? (
    <View style={tw`mb-2 min-h-11 flex-row items-center gap-2 rounded-full border border-sun bg-sun-soft pl-4 pr-1`}>
      <Txt style={tw`flex-1 text-[13px] font-medium leading-tight text-fg`}>{armedText}: {armed === "wd" || armed === "nb" ? "tap runs taken, 0 if none" : wall ? "tap runs they ran too, 0 if none" : "tap runs they ran"}</Txt>
      <Press onPress={clearMods} style={tw`min-h-9 items-center justify-center rounded-full bg-panel px-3`}>
        <Txt style={tw`text-[13px] font-semibold text-teal`}>Cancel</Txt>
      </Press>
    </View>
  ) : oddRuns ? (
    <View style={tw`mb-2 min-h-11 flex-row items-center gap-2 rounded-full border border-line bg-panel pl-4 pr-1`}>
      <Txt style={tw`flex-1 text-[13px] leading-tight text-teal`}>
        {oddRuns.stay ? "Didn't cross: " : "Batters crossed: "}<Txt style={tw`font-semibold text-fg`}>{name(st.striker)}</Txt> on strike
      </Txt>
      <Press onPress={() => put(E.setCrossed(m, !!oddRuns.stay))} style={tw`min-h-9 items-center justify-center rounded-full border border-sun px-3`}>
        <Txt style={tw`text-[13px] font-semibold text-sun`}>{oddRuns.stay ? "They crossed" : "Didn't cross"}</Txt>
      </Press>
    </View>
  ) : null;
  const otChip = <Chip on={ot > 0} onPress={() => setPanel("ot")}>{ot > 0 ? `Overthrow +${ot}` : "Overthrow"}</Chip>;
  return (
    <View style={tw`flex-1 bg-cream`}>
      <Beams />
      {/* When the keypad panel grows by a little, nudge the top area so the tools row stays in view. */}
      <ScrollView ref={topRef} style={tw`flex-1`} contentContainerStyle={{ flexGrow: 1, paddingBottom: scoring ? 14 : 24 + insets.bottom }} keyboardShouldPersistTaps="handled"
        onLayout={(e) => { fit.current.view = e.nativeEvent.layout.height; nudge(); }} onContentSizeChange={(_, h) => { fit.current.content = h; nudge(); }}>
        <View style={[tw`w-full self-center px-5`, { maxWidth: 480, paddingTop: Math.max(14, insets.top + 6) }]}>
          <View style={tw`flex-row items-center justify-between gap-3`}>
            <IconButton icon={ChevronLeft} onPress={() => go("home")} label="Back" size={38} />
            <View style={tw`flex-1 items-center`}>
              {solo ? (
                <Txt style={tw`text-[13px] text-teal`} numberOfLines={1}>{name(inn.striker)} {m.status === "live" ? "batting" : "· turn over"}</Txt>
              ) : (
                <Txt style={tw`text-[13px] text-teal`} numberOfLines={1}>
                  {batTeam.name} {tgt !== null ? <>chasing <Num style={tw`text-[13px] text-teal`}>{tgt}</Num></> : "batting"}
                </Txt>
              )}
              <View style={tw`mt-0.5 flex-row items-center gap-1.5`}>
                <LivePill /><Txt style={tw`text-[11px] text-mute`}>· {solo
                  ? french ? <>French cricket, turn <Num style={tw`text-[11px] text-mute`}>{idx + 1}</Num></>
                  : <>{rounds > 1 ? <>Round <Num style={tw`text-[11px] text-mute`}>{round}</Num> of <Num style={tw`text-[11px] text-mute`}>{rounds}</Num>, turn </> : "Turn "}<Num style={tw`text-[11px] text-mute`}>{idx + 1}</Num> of <Num style={tw`text-[11px] text-mute`}>{turns}</Num></>
                  : label}</Txt>
              </View>
            </View>
            {showMic ? <MicButton on={mic} onPress={toggleMic} /> : <View style={{ width: 38 }} />}
          </View>

          {solo ? (
            <View style={tw`mt-5`}>
              <View style={tw`flex-row items-end gap-3`}>
                <ScoreRoll runs={st.runs} wickets={null} size={wide ? 64 : 56} pop={fourPop} />
                <Txt style={[tw`text-[14px] text-teal`, { marginBottom: 8 }]}>off <Num style={tw`text-[14px] text-fg`}>{me?.balls ?? 0}</Num> ball{me?.balls === 1 ? "" : "s"}</Txt>
              </View>
              {m.status === "live" && (
                <View style={tw`mt-3 flex-row flex-wrap gap-2`}>
                  <StatChip icon={Timer} tone={turnLeft !== null && turnLeft <= 3 ? "sun" : "plain"}>
                    {turnLeft === null ? "No ball limit" : <><Num style={tw`text-[13px] ${turnLeft <= 3 ? "text-sun" : "text-fg"}`}>{turnLeft}</Num> ball{turnLeft === 1 ? "" : "s"} left</>}
                  </StatChip>
                  <StatChip icon={Heart} tone={livesLeft === 1 && inn.wicketLimit > 1 ? "out" : "plain"}>
                    <Num style={tw`text-[13px] ${livesLeft === 1 && inn.wicketLimit > 1 ? "text-out" : "text-fg"}`}>{livesLeft}</Num> {livesLeft === 1 ? "life" : "lives"} left
                  </StatChip>
                </View>
              )}
            </View>
          ) : <>
          <View style={tw`mt-3 flex-row items-center gap-4`}>
            {chasing && (
              <View accessible accessibilityLabel={`Need ${Math.max(0, need)} off ${left} ball${left === 1 ? "" : "s"}`}>
                <ChaseRing done={st.runs / (tgt || 1)} size={wide ? 118 : 104}>
                  <Num style={tw`text-[24px] font-bold`}>{Math.max(0, need)}</Num>
                  <Txt style={LBL}>off <Num style={[LBL, { fontWeight: "500" }]}>{left}</Num></Txt>
                </ChaseRing>
              </View>
            )}
            <View style={tw`flex-1`}>
              <ScoreRoll runs={st.runs} wickets={st.wickets} size={chasing ? 54 : wide ? 60 : 54} pop={fourPop} />
              <Num style={[tw`mt-1 text-[13px] text-teal`, { fontWeight: "500" }]} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.8}>
                {K.oversLine(m, idx, st)}{inn.balls ? "" : " ov"}
                {chasing ? ` · RRR ${left ? ((need * bpo) / left).toFixed(2) : "-"}` : !test ? ` · CRR ${crr.toFixed(2)}` : ""}
              </Num>
              {chasing ? (
                <Num style={[tw`mt-0.5 text-[12px] text-mute`, { fontWeight: "500" }]}>Target {tgt}{st.penalties ? ` · incl. ${st.penalties} pen` : ""}</Num>
              ) : test ? (
                status ? <Txt style={tw`mt-0.5 text-[12px] font-medium text-sun`}>{status}<Txt style={tw`text-mute`}>{capText}</Txt></Txt>
                  : <Num style={[tw`mt-0.5 text-[12px] text-mute`, { fontWeight: "500" }]}>CRR {crr.toFixed(2)}{capText}</Num>
              ) : (
                <Num style={[tw`mt-0.5 text-[12px] text-mute`, { fontWeight: "500" }]}>Projected {Math.round(crr * ((st.maxBalls ?? inn.overs * bpo) / bpo))}{st.penalties ? ` · incl. ${st.penalties} pen` : ""}</Num>
              )}
            </View>
          </View>
          {!test && tgt === null && m.toss && idx === 0 && st.legal === 0 && (
            <Txt style={tw`mt-2 text-[12px] text-mute`}>{m.teams[m.toss.winner].name} won the toss, chose to {m.toss.choice}</Txt>
          )}
          </>}
          {/* The sharing pill rides on the crease line so it costs no row above the keypad. */}
          <View style={tw`mt-3 flex-row items-center gap-3`}>
            <Crease style={tw`flex-1`} />
            {!!m.live && (
              <View style={tw`flex-row items-center gap-1.5 rounded-full border border-line bg-panel px-3 py-1`}>
                <LiveDot size={6} /><Txt style={tw`text-[12px] text-teal`}>Sharing live · <Num style={tw`text-[12px] text-fg`}>{m.live}</Num></Txt>
              </View>
            )}
          </View>
          {((st.freeHit && m.status === "live") || badges.length > 0 || !!turf) && (
            <View style={tw`mt-3 flex-row flex-wrap gap-2`}>
              {st.freeHit && m.status === "live" && (
                <View style={tw`rounded-full border border-sun px-3 py-1`}><Txt style={tw`text-[12px] font-semibold text-sun`}>Free hit</Txt></View>
              )}
              {badges.map((b) => (
                <View key={b} style={tw`rounded-full border border-sun px-3 py-1`}><Txt style={tw`text-[12px] font-semibold text-sun`}>{b}</Txt></View>
              ))}
              {!!turf && <TurfChip end={turf} onPress={() => setPanel("turf")} onAlert={onTurfAlert} />}
            </View>
          )}

          {!!heard && <Txt style={tw`mt-3 text-center text-[13px] text-teal`}>{heard}</Txt>}
          {mic && !heard && <Txt style={tw`mt-3 text-center text-[13px] text-teal`}>Listening. Say "four", "wide", "out" or "undo"</Txt>}
          {!!notice && <Note style="mt-3" weight="font-medium">{notice}</Note>}

          {locked ? (<>
            <Card style={tw`mt-4`}>
              <Txt style={tw`text-[13px] text-mute`}>On strike: <Txt style={tw`font-semibold text-fg`}>{name(st.striker)}</Txt> <Num style={tw`text-[13px] text-fg`}>{bat(st.striker)?.runs ?? 0} ({bat(st.striker)?.balls ?? 0})</Num> · Bowler: <Txt style={tw`font-semibold text-fg`}>{name(inn.bowler)}</Txt></Txt>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={tw`mt-3`} contentContainerStyle={tw`flex-row items-center gap-2`}>
                {shownOver.map((b, i) => <BallChip key={i} b={b} size={30} />)}
              </ScrollView>
            </Card>
            <Locked match={m} />
          </>) : m.status === "break" && solo ? (
            <View style={tw`mt-5`}>
              <Card style={tw`items-center p-5`}>
                <Txt style={LBL}>Turn over</Txt>
                <Txt style={tw`mt-1.5 text-center text-[16px] font-semibold`}>{name(inn.striker)}</Txt>
                <Board style={{ fontSize: 44, lineHeight: 48, marginTop: 4 }}>{st.runs}</Board>
                <Txt style={tw`mt-1 text-center text-[14px] text-teal`}>off <Num style={tw`text-[14px] text-fg`}>{me?.balls ?? 0}</Num>, {turnEnd(m, idx)}</Txt>
                {rounds > 1 && <Txt style={tw`mt-1 text-center text-[12px] text-mute`}>Next up: round <Num style={tw`text-[12px] text-mute`}>{round}</Num> of <Num style={tw`text-[12px] text-mute`}>{rounds}</Num></Txt>}
              </Card>
              <Txt style={[LBL, tw`mt-5 mb-2`]}>Standings</Txt>
              <Card style={tw`p-0 overflow-hidden`}><SoloTable match={m} highlight={upNext} /></Card>
              <View style={tw`mt-5`}><PrimaryButton onPress={() => setTurnOpen(true)}>{french ? "Who bats next?" : `Start ${name(upNext)}'s turn`}</PrimaryButton></View>
              {french && <Wide onPress={() => setPanel("frenchStop")} border mt>Stop, most runs wins</Wide>}
              <Wide onPress={() => undo(m.id)} icon={Undo2} color="text-teal" mt>Undo last ball</Wide>
            </View>
          ) : m.status === "break" && test ? (
            <Card style={tw`mt-5 items-center p-5`}>
              <Txt style={LBL}>{inn.declared ? "Declared" : "Innings over"}</Txt>
              <Txt style={tw`mt-1 text-center text-[16px] font-semibold`}>{batTeam.name} <Num style={tw`text-[28px]`}>{E.inningsScore(m, idx)}</Num></Txt>
              <Txt style={tw`mt-1 text-center font-semibold text-sun`}>{status}</Txt>
              {!!capText && <Txt style={tw`mt-1 text-center text-[13px] text-mute`}>{capText.slice(3)}</Txt>}
              {notBatted.length > 0 && <Txt style={tw`mt-2 text-center text-[13px] text-mute`}>Yet to bat for {batTeam.name}: {notBatted.map((p) => p.name).join(", ")}</Txt>}
              <View style={tw`mt-5 w-full`}><PrimaryButton onPress={() => setOpeners(true)}>{`Start the ${["", "2nd", "3rd", "4th"][idx + 1]} innings`}</PrimaryButton></View>
              <Wide onPress={() => setStopping(true)} border mt>Stop the match, call it a draw</Wide>
              <Wide onPress={() => undo(m.id)} icon={Undo2} color="text-teal" mt>Undo last ball</Wide>
            </Card>
          ) : m.status === "break" ? (
            <Card style={tw`mt-5 items-center p-5`}>
              <Txt style={LBL}>{inn.superOver ? "Super over break" : "Innings break"}</Txt>
              <Txt style={tw`mt-1 text-center text-[16px] font-semibold`}>{batTeam.name} <Num style={tw`text-[28px]`}>{st.runs}/{st.wickets}</Num></Txt>
              <Txt style={tw`mt-1 text-center text-teal`}>{fieldTeam.name} need <Num style={tw`font-bold text-sun`}>{st.runs + 1}</Num> off <Num style={tw`text-teal`}>{inn.balls ?? inn.overs * bpo}</Num> balls</Txt>
              {notBatted.length > 0 && <Txt style={tw`mt-2 text-center text-[13px] text-mute`}>Didn't get a bat: {notBatted.map((p) => p.name).join(", ")}</Txt>}
              <View style={tw`mt-5 w-full`}><PrimaryButton onPress={() => setOpeners(true)}>Start the chase</PrimaryButton></View>
              {!inn.superOver && <Wide onPress={() => setOversOpen(true)} border mt>Change overs (<Num style={tw`text-fg`}>{m.rules.overs}</Num>)</Wide>}
              <Wide onPress={() => undo(m.id)} icon={Undo2} color="text-teal" mt>Undo last ball</Wide>
            </Card>
          ) : (
            <>
              {solo ? <SoloStrip match={m} batting={inn.striker} next={upNext} /> : <Card style={[tw`mt-3`, { paddingVertical: 2, paddingHorizontal: 14 }]}>
                {[st.striker, st.nonStriker].map((id, i) => id ? (
                  <Press key={id} onPress={() => { if (i === 1) put(E.swapStrike(m)); }} haptic={i === 1}
                    accessibilityLabel={i === 0 ? `${name(id)}, on strike` : `${name(id)}, tap to swap strike`}
                    style={[tw`flex-row items-center py-2`, i === 0 && { borderBottomWidth: 1, borderBottomColor: HAIR }]}>
                    <View style={tw`w-3.5 items-start`}>
                      {i === 0
                        ? <View accessibilityLabel="On strike" style={tw`h-1.5 w-1.5 rounded-full bg-sun`} />
                        : <ArrowLeftRight size={10} color={C.mute} strokeWidth={2.2} />}
                    </View>
                    <Txt style={tw`flex-1 text-[15px] ${i === 0 ? "font-semibold text-fg" : "text-teal"}`} numberOfLines={1}>{name(id)}</Txt>
                    <Num style={tw`text-[18px] ${i === 0 ? "font-bold text-fg" : "text-teal"}`}>{bat(id)?.runs ?? 0}</Num>
                    <Num style={[tw`ml-1.5 text-[12px] text-mute`, { minWidth: 30, fontWeight: "500" }]}>({bat(id)?.balls ?? 0})</Num>
                    {!!bat(id)?.outs && <Txt style={tw`ml-1 text-[11px] text-out`}>out <Num style={tw`text-[11px] text-out`}>{bat(id)!.outs}</Num>×</Txt>}
                  </Press>
                ) : (
                  <View key={i} style={tw`flex-row items-center py-2.5`}>
                    <View style={tw`w-3.5`} /><Txt style={tw`text-[13px] text-mute`}>Batting alone</Txt>
                  </View>
                ))}
              </Card>}

              {pairs && <PairsStrip match={m} idx={idx} />}
              {!!guard && <Txt style={tw`mt-2 text-[12px] text-mute`}>{guard}</Txt>}

              <OverTrack over={shownOver} current={(thisOver.length > 0 || !shownOver.length) && !french} bpo={bpo}
                title={`${french ? "Balls" : thisOver.length || !shownOver.length ? "This over" : `Over ${overNo}`} · ${name(inn.bowler)}`}
                figures={bowler ? `${E.oversText(bowler.legal, bpo)}-${bowler.maidens}-${bowler.runs}-${bowler.wickets}` : "0.0-0-0-0"}
                umpire={ump?.name ?? null} rules={m.rules} onEdit={thisOver.length ? (i) => setEdit(overStart + eventIndex(inn.events, overStart, i)) : undefined} />

              <View style={tw`mt-3 flex-row items-start justify-between`}>
                <Tool onPress={() => redoBall(m.id)} icon={Redo2} label="Redo" disabled={!redo.length} />
                {!solo && <Tool onPress={() => put(E.swapStrike(m))} icon={ArrowLeftRight} label="Swap" disabled={!st.nonStriker} />}
                <Tool onPress={() => go("scorecard")} icon={ClipboardList} label="Scorecard" />
                {liveSupported && <Tool onPress={() => setShare(true)} icon={Radio} label={m.live ? "Live on" : "Go live"} on={!!m.live} />}
                <Tool onPress={() => setMore(true)} icon={MoreHorizontal} label="More" />
              </View>
              {canDeclare && (
                <Press onPress={() => setEnding(true)} disabled={waiting}
                  style={tw`mt-3 min-h-12 w-full items-center justify-center rounded-[18px] border border-line`}>
                  <Txt style={tw`text-[14px] font-medium text-fg`}>Declare {batTeam.name}'s innings</Txt>
                </Press>
              )}
            </>
          )}
        </View>
      </ScrollView>

      {scoring && (
        <View style={[tw`rounded-t-[28px] border-t px-3.5 pt-3`, { backgroundColor: "#0e100f", borderColor: "#1a1e1c", paddingBottom: Math.max(18, insets.bottom + 10) }]}>
          <View style={[tw`w-full self-center`, { maxWidth: 480 }]}>
            {/* With only the overthrow chip, the strip takes its row so the keypad doesn't grow over the tools. */}
            {(anyArmed || oddRuns) && !mustTouch && !m.rules.missesOut && !walls.length ? (
              <View style={tw`flex-row items-center gap-1.5`}>
                <View style={tw`flex-1`}>{strip}</View>
                <View style={tw`mb-2`}>{otChip}</View>
              </View>
            ) : (
              <>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={tw`mb-2`} contentContainerStyle={{ gap: 6 }} keyboardShouldPersistTaps="handled">
              {mustTouch && <Chip on={touched} onPress={() => setTouched((v) => !v)}>Bat touched</Chip>}
              {!!m.rules.missesOut && <Chip on={missed} onPress={() => setMissed((v) => !v)} a11y="Missed">
                <Txt style={{ fontSize: 12, fontWeight: missed ? "600" : "500", color: missed ? C.ink : C.teal }}>Missed <Num style={{ fontSize: 12, color: missed ? C.ink : C.teal }}>{st.misses.get(st.striker ?? "") ?? 0}/{m.rules.missesOut}</Num></Txt>
              </Chip>}
              {walls.map((w) => (
                <Chip key={w} on={wall === w} onPress={() => setWall((x) => (x === w ? null : w))} a11y={`${K.SURFACE_NAME[w]} wall`}>
                  <Txt style={{ fontSize: 12, fontWeight: wall === w ? "600" : "500", color: wall === w ? C.ink : C.teal }}>{K.SURFACE_NAME[w]} <Num style={{ fontSize: 12, color: wall === w ? C.ink : C.teal }}>{E.wallValue(m.rules, w)}</Num></Txt>
                </Chip>
              ))}
              {otChip}
            </ScrollView>
            {strip}
              </>
            )}
            <View style={tw`mb-2 flex-row gap-1.5`}>
              {(["wd", "nb", "b", "lb"] as Extra[]).map((x) => (
                <ExtraPill key={x} onPress={() => setArmed(x)} disabled={waiting || !!armed} active={armed === x}
                  label={{ wd: "Wide", nb: "No ball", b: "Bye", lb: "Leg bye" }[x]} />
              ))}
              <ExtraPill onPress={() => score(5)} disabled={waiting} num flex={0.7}
                label={anyArmed ? keyLabel(5) : "5"} a11y={`5, ${anyArmed ? keyLabel(5) : "Overthrow"}`} />
            </View>
            {/* The ring is a border the keypad always has, so arming never shifts the keys. */}
            <View style={[tw`-mx-1 rounded-[22px] border-2 p-0.5`, { gap: 7, borderColor: anyArmed ? C.sun : "transparent" }]}>
              <View style={{ flexDirection: "row", gap: 7 }}>
                {[0, 1, 2, 3].map((r) => <Key key={r} h={keyH} disabled={waiting} onPress={() => score(r)} label={keyLabel(r)} />)}
              </View>
              <View style={{ flexDirection: "row", gap: 7 }}>
                <Key h={keyH} disabled={waiting} onPress={() => score(4)} label="4" sub={anyArmed ? keyLabel(4) : undefined} a11y={`4, ${anyArmed ? keyLabel(4) : "Four"}`} kind="four" />
                <Key h={keyH} disabled={waiting} onPress={() => score(6)} label="6" sub={anyArmed ? keyLabel(6) : undefined} a11y={`6, ${anyArmed ? keyLabel(6) : "Six"}`} kind="six" />
                <Key h={keyH} disabled={waiting} onPress={() => setWicket(armed)} label="Out" kind="out" haptic />
                <Key h={keyH} onPress={() => undo(m.id)} label="Undo" kind="icon" haptic />
              </View>
            </View>
          </View>
        </View>
      )}

      {!!outFlash && <OutFlash key={outFlash} />}
      {six && <SixOverlay key={six.key} six={six} onDone={() => setSix(null)} onUndo={() => { setSix(null); undo(m.id); }} />}

      {!locked && m.status === "live" && (pickBowler || bowlerDue) && !retireOpen && !six && !wagon && !didRun && <BowlerSheet match={m} onPick={(n) => { put(n); setPickBowler(false); }}
        onClose={E.needsBowler(m, idx) ? undefined : () => setPickBowler(false)}
        onEnd={!test ? () => setEnding(true) : canDeclare ? () => setEnding(true) : undefined} endLabel={test ? "Declare instead" : solo ? "End turn instead" : undefined} />}
      {ending && <ConfirmSheet title={test ? "Declare?" : solo ? "End this turn?" : "End this innings?"} yes={test ? "Declare" : solo ? "End turn" : "End innings"} danger onClose={() => setEnding(false)}
        onYes={() => { put(E.closeInnings(m)); setPickBowler(false); useStore.setState({ redo: [] }); }}
        body={<Body>{solo
          ? <>{name(inn.striker)} finishes on <B>{st.runs}</B> off <B>{me?.balls ?? 0}</B>.{upNext || french ? "" : " That ends the match."} You can undo it.</>
          : test
          ? <>{batTeam.name} declare on <B>{st.runs}/{st.wickets}</B>. {fieldTeam.name} bat next. You can undo it.</>
          : <>{batTeam.name} finish on <B>{st.runs}/{st.wickets}</B> in <B>{E.oversText(st.legal, bpo)}</B> overs.{tgt !== null ? " That ends the match." : ""} You can undo it.</>}</Body>} />}
      {stopping && <ConfirmSheet title="Stop the match?" yes="Call it a draw" danger onClose={() => setStopping(false)}
        onYes={() => { put(E.stopMatch(m)); setStopping(false); setPickBowler(false); useStore.setState({ redo: [] }); }}
        body={<Body>Nobody has won yet, so the match ends as a draw. You can undo it.</Body>} />}
      {panel === "frenchStop" && <ConfirmSheet title="Stop the game?" yes="Stop, most runs wins" danger onClose={() => setPanel(null)}
        onYes={() => { put(E.stopMatch(m)); setPickBowler(false); useStore.setState({ redo: [] }); }}
        body={<Body>French cricket goes on until you stop it. Whoever has the most runs wins. You can undo it.</Body>} />}
      {panel === "leader" && <ConfirmSheet title="Stop now?" yes="Stop, leader wins" danger onClose={() => setPanel(null)}
        onYes={() => { put(E.stopLeaderWins(m)); setPickBowler(false); useStore.setState({ redo: [] }); }}
        body={<Body>The match ends here and the side ahead on runs per ball wins. You can undo it.</Body>} />}
      {oversOpen && <OversSheet match={m} onClose={() => setOversOpen(false)} onSave={(n) => { put(n); setOversOpen(false); }} />}
      {retireOpen && <RetireSheet match={m} batter={retireFor} hurt={retireHurt} onClose={closeRetire} onSave={(n) => { put(n); closeRetire(); useStore.setState({ redo: [] }); }} />}
      {wicket !== false && <WicketSheet match={m} extra={wicket} preset={wicketKind} onDone={confirmWicket} onClose={() => { setWicket(false); setWicketKind(null); }} />}
      {didRun && <DidRunSheet match={m} input={didRun} onClose={() => setDidRun(null)}
        onRan={(r) => { const input = { ...didRun, runs: r }; setDidRun(null); commit(input); }}
        onOut={() => { setWicketKind("didn't run"); setWicket(didRun.extra ?? null); setDidRun(null); }} />}
      {wagon && !locked && !six && <WagonSheet box={K.boxMode(m.rules)} onSkip={() => setWagon(null)}
        onPick={(z) => { const cur = latest.current; if (cur) { track(EV.wagon_zone_set); put(K.setZone(cur, wagon.idx, wagon.evIdx, z)); } setWagon(null); }} />}
      {edit !== null && editing?.t === "ball" && (
        <EditBallSheet ball={editing} onClose={() => setEdit(null)}
          onSave={(p) => { put(E.editBall(m, idx, edit, p)); setEdit(null); }} />
      )}
      {turnOpen && (french
        ? <FrenchNextSheet match={m} onClose={() => setTurnOpen(false)} onStart={(n) => { put(n); setTurnOpen(false); useStore.setState({ redo: [] }); }} />
        : <SoloTurnSheet match={m} onClose={() => setTurnOpen(false)} onStart={(n) => { put(n); setTurnOpen(false); useStore.setState({ redo: [] }); }} />)}
      {openers && <OpenersSheet match={m} onClose={() => setOpeners(false)} onStart={(n) => { put(n); setOpeners(false); useStore.setState({ redo: [] }); }} />}
      {share && <ShareSheet match={m} onClose={() => setShare(false)} />}
      {panel === "ot" && <OverthrowSheet value={ot} onClose={() => setPanel(null)} onPick={(n) => { setOt(n); setPanel(null); }} />}
      {panel === "rules" && <RulesSheet match={m} onClose={() => setPanel(null)} onSave={(n) => { put(n); useStore.setState({ redo: [] }); setPanel(null); }} />}
      {panel === "log" && <ChangeLogSheet match={m} onClose={() => setPanel(null)} />}
      {panel === "lost" && <BallLostSheet match={m} onClose={() => setPanel(null)} onSave={(n) => { put(n); useStore.setState({ redo: [] }); setNotice("Ball lost. Dead ball, the over carries on."); }} />}
      {panel === "penalty" && <PenaltySheet match={m} onClose={() => setPanel(null)} onSave={(n) => { put(n); useStore.setState({ redo: [] }); }} />}
      {panel === "add" && <AddPlayerSheet match={m} onClose={() => setPanel(null)} onSave={(n) => put(n)} />}
      {panel === "left" && <PlayerLeftSheet match={m} onClose={() => setPanel(null)}
        onSave={(n, id) => { put(n); useStore.setState({ redo: [] }); if (n.status === "live" && id === inn.bowler && !solo) setPickBowler(true); }} />}
      {panel === "turf" && <TurfSheet end={turf} onClose={() => setPanel(null)} onSet={(end) => { if (end) track(EV.turf_timer_set, { minutes: Math.round((end - Date.now()) / 60000) }); setPrefs(m.id, { turfEnd: end }); }} />}
      {more && (
        <Sheet title="Quick options" onClose={() => setMore(false)}>
          <View style={{ borderTopWidth: 1, borderTopColor: HAIR }}>
            <Row onPress={closeMore(() => setPickBowler(true))}>Change bowler</Row>
            {!inn.superOver && !test && !solo && <Row onPress={closeMore(() => setOversOpen(true))}>Change overs (<Num style={tw`text-[15px] text-fg`}>{inn.overs}</Num>)</Row>}
            {!solo && <Row onPress={closeMore(() => setRetireOpen(true))}>Retire a batter</Row>}
            {!test && <Row accent onPress={closeMore(() => setEnding(true))}>{solo ? "End turn" : "End innings"}</Row>}
            {canDeclare && <Row accent onPress={closeMore(() => setEnding(true))}>Declare innings</Row>}
            {test && <Row onPress={closeMore(() => setStopping(true))}>Stop the match, call it a draw</Row>}
            {french && <Row onPress={closeMore(() => setPanel("frenchStop"))}>Stop, most runs wins</Row>}
          </View>
          <Txt style={[LBL, tw`mt-5 mb-1`]}>Match day</Txt>
          <View style={{ borderTopWidth: 1, borderTopColor: HAIR }}>
            <Row onPress={closeMore(() => setPanel("lost"))}>Ball lost</Row>
            {!solo && <Row onPress={closeMore(() => setPanel("penalty"))}>Penalty runs</Row>}
            {!solo && <Row onPress={closeMore(() => { setRetireHurt(true); setRetireOpen(true); })}>Retired hurt</Row>}
            <Row onPress={closeMore(() => setPanel("add"))}>Add a player</Row>
            <Row onPress={closeMore(() => setPanel("left"))}>Player left</Row>
            {leader && <Row onPress={closeMore(() => setPanel("leader"))}>Stop now, leader wins</Row>}
            <Row onPress={closeMore(() => setPanel("rules"))}>Rules</Row>
            <Row onPress={closeMore(() => setPanel("log"))}>Change log</Row>
          </View>
          <Txt style={[LBL, tw`mt-5`]}>On this phone</Txt>
          <Toggle on={!!prefs.wagon} set={(v) => { if (v) track(EV.wagon_wheel_on); setPrefs(m.id, { wagon: v }); }} label="Wagon wheel" hint="After a scoring shot, tap where it went. You can skip it." />
          <Toggle on={!!prefs.speak} set={(v) => { if (v) track(EV.commentary_on); setPrefs(m.id, { speak: v }); }} label="Spoken commentary" hint={mic ? "Quiet while the mic is on, so it doesn't score itself." : "Says each ball out loud."} />
          <Row onPress={closeMore(() => setPanel("turf"))}>{turf ? `Turf timer, ends ${new Date(turf).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}` : "Turf timer"}</Row>
        </Sheet>
      )}
    </View>
  );
}

function ShareSheet({ match: m, onClose }: { match: Match; onClose: () => void }) {
  const { put } = useStore();
  const [copied, setCopied] = useState(false);
  const move = (extra: Partial<Match> = {}) => { track(EV.handover_start); put({ ...m, ...extra, scorer: deviceId(), handover: newMoveToken() }); onClose(); };
  const moveButton = (onPress: () => void) => <Wide onPress={onPress} border>Move scoring to another phone</Wide>;
  if (!m.live) return (
    <Sheet title="Share this match live" onClose={onClose}>
      <Txt style={tw`text-[14px] leading-5 text-teal`}>Anyone with the code or link can follow every ball as you score it. Keep this app open while you score.</Txt>
      <View style={tw`mt-4 gap-2`}>
        <PrimaryButton onPress={() => void newLiveKey().then((k) => { track(EV.live_share_start); put({ ...m, live: newCode(), ...k }); })}>Start live sharing</PrimaryButton>
        {moveButton(() => void newLiveKey().then((k) => move({ live: newCode(), ...k })))}
      </View>
    </Sheet>
  );
  const link = watchLink(m.live, m.liveFp);
  const msg = `Watch ${matchName(m)} live, ball by ball: ${link}`;
  return (
    <Sheet title="You're live" onClose={onClose}>
      <View style={tw`items-center rounded-[22px] border border-line bg-panel p-5`}>
        <Txt style={LBL}>Match code</Txt>
        <Num selectable style={[tw`mt-1 text-[48px] text-sun`, { letterSpacing: 8, lineHeight: 56 }]}>{m.live}</Num>
        <Txt selectable style={tw`mt-1 text-center text-xs text-teal`}>{link}</Txt>
      </View>
      <View style={tw`mt-4 gap-2`}>
        <PrimaryButton onPress={() => void sendText(msg)}>Send link on WhatsApp</PrimaryButton>
        <Wide onPress={() => { void copyText(link).then(() => setCopied(true)); }} border>{copied ? "Copied" : "Copy link"}</Wide>
        {m.liveKey && moveButton(() => move())}
        <Wide onPress={() => { track(EV.live_share_stop); put({ ...m, live: undefined, liveKey: undefined, liveFp: undefined, scorer: undefined, handover: undefined }); onClose(); }} color="text-out">Stop sharing</Wide>
      </View>
    </Sheet>
  );
}

/** Shown instead of the keypad on a phone that doesn't hold the pen right now. */
function Locked({ match: m }: { match: Match }) {
  const { put, go } = useStore();
  const [copied, setCopied] = useState(false);
  const [takeBack, setTakeBack] = useState(false);
  const waiting = !!m.handover && !movedAway(m);
  const link = waiting && m.live && m.liveKey ? scoreLink(m.live, m.liveKey, m.handover!) : "";
  const text = `Take over scoring ${matchName(m)} on your phone: ${link}`;
  return (
    <Card style={tw`mt-3`}>
      {waiting ? (<>
        <Txt style={tw`text-[16px] font-semibold text-fg`}>Moving scoring to another phone</Txt>
        <Txt style={tw`mt-1 text-[14px] leading-5 text-teal`}>Scoring is paused here. Send this link to the new scorer. When they open it, scoring moves to their phone and this one follows along.</Txt>
        <Note style="mt-3">Send it only to the new scorer, not to the group. The app opens it once, but the link holds this match's scoring key.</Note>
        <View style={tw`mt-4 gap-2`}>
          <PrimaryButton onPress={() => void sendText(text)}>Send on WhatsApp</PrimaryButton>
          <Wide onPress={() => { void copyText(link).then(() => setCopied(true)); }} border>{copied ? "Copied" : "Copy link"}</Wide>
          <Wide onPress={() => put({ ...m, handover: undefined })} color="text-teal">Cancel, keep scoring here</Wide>
        </View>
      </>) : (<>
        <Txt style={tw`text-[16px] font-semibold text-fg`}>Scoring is on another phone</Txt>
        <Txt style={tw`mt-1 text-[14px] leading-5 text-teal`}>This phone follows every ball. To score here again, ask that phone to move scoring back to you.</Txt>
        <View style={tw`mt-4 gap-2`}>
          <PrimaryButton tone="navy" onPress={() => go("scorecard")}>Full scorecard</PrimaryButton>
          <Wide onPress={() => setTakeBack(true)} color="text-teal">Take scoring back</Wide>
        </View>
      </>)}
      {takeBack && <ConfirmSheet title="Take scoring back?" yes="Score on this phone" onClose={() => setTakeBack(false)}
        onYes={() => { track(EV.take_scoring_back); put({ ...m, scorer: deviceId(), handover: undefined }); setTakeBack(false); }}
        body={<Body>Only do this if the other phone can't score any more, like a dead battery. That phone will stop scoring.</Body>} />}
    </Card>
  );
}

const matchName = (m: Match) => (E.isSolo(m) ? "our gully match" : `${m.teams[0].name} vs ${m.teams[1].name}`);

/** Solo: how a finished turn ended, "out" or "not out, lost 1 life". */
function turnEnd(m: Match, idx: number) {
  const inn = m.innings[idx], st = E.replay(m, idx);
  if (st.wickets >= inn.wicketLimit) return "out";
  return st.wickets ? `not out, lost ${st.wickets} ${st.wickets === 1 ? "life" : "lives"}` : "not out";
}

/** Solo: a small outlined fact under the score, lime when the turn is nearly over, red on the last life. */
function StatChip({ icon: I, tone, children }: { icon: LucideIcon; tone: "plain" | "sun" | "out"; children: ReactNode }) {
  const line = tone === "sun" ? C.sun : tone === "out" ? OUT_LINE : C.line, ink = tone === "sun" ? C.sun : tone === "out" ? C.out : C.teal;
  return (
    <View style={[tw`flex-row items-center gap-1.5 rounded-full border px-3 py-1.5`, { borderColor: line, backgroundColor: tone === "out" ? OUT_BG : C.panel }]}>
      <I size={14} color={ink} strokeWidth={2.2} />
      <Txt style={[tw`text-[13px] font-medium`, { color: tone === "plain" ? C.fg : ink }]}>{children}</Txt>
    </View>
  );
}

/** Solo: the top three so far and who bats next, where the two batters sit in a team match. */
function SoloStrip({ match: m, batting, next }: { match: Match; batting: string; next: string | null }) {
  const rows = E.soloStandings(m).slice(0, 3);
  return (
    <Card style={[tw`mt-3`, { paddingVertical: 2, paddingHorizontal: 14 }]}>
      <View style={tw`flex-row`}>
        {rows.map((r, i) => (
          <View key={r.id} style={[tw`flex-1 py-2.5`, i > 0 && { borderLeftWidth: 1, borderLeftColor: HAIR, paddingLeft: 10 }]}>
            <View style={tw`flex-row items-center gap-1.5`}>
              {r.id === batting ? <View accessibilityLabel="Batting" style={tw`h-1.5 w-1.5 rounded-full bg-sun`} /> : <Num style={[tw`text-[11px] text-mute`, { fontWeight: "500" }]}>{i + 1}</Num>}
              <Txt style={tw`flex-1 text-[13px] ${r.id === batting ? "font-semibold text-fg" : "text-teal"}`} numberOfLines={1}>{r.name}</Txt>
            </View>
            <Num style={tw`mt-0.5 text-[18px] ${r.id === batting ? "text-fg" : "text-teal"}`}>{r.runs}</Num>
          </View>
        ))}
      </View>
      <View style={[tw`flex-row items-center py-2.5`, { borderTopWidth: 1, borderTopColor: HAIR }]}>
        {next
          ? <Txt style={tw`text-[13px] text-mute`}>Up next: <Txt style={tw`font-semibold text-fg`}>{E.playerName(m, next)}</Txt></Txt>
          : <Txt style={tw`text-[13px] text-mute`}>Last turn of the match</Txt>}
      </View>
    </Card>
  );
}

function countEvents(events: Match["innings"][number]["events"], balls: number) {
  let seen = 0, i = events.length;
  while (i > 0 && seen < balls) { i--; if (events[i].t === "ball") seen++; }
  return events.length - i;
}
function eventIndex(events: Match["innings"][number]["events"], start: number, ballIdx: number) {
  let seen = -1;
  for (let i = start; i < events.length; i++) if (events[i].t === "ball" && ++seen === ballIdx) return i - start;
  return 0;
}

function extraLabel(x: Extra, r: number) {
  if (x === "wd") return r ? `Wd+${r}` : "Wd";
  if (x === "nb") return r ? `Nb+${r}` : "Nb";
  return `${r}${x === "b" ? "B" : "LB"}`;
}

/** Six slots: balls bowled as chips (extras inline), the next ball outlined in lime, the rest empty. */
function OverTrack({ over, current, bpo, title, figures, umpire, rules, onEdit }: {
  over: Ball[]; current: boolean; bpo: number; title: string; figures: string; umpire: string | null; rules: Match["rules"]; onEdit?: (i: number) => void;
}) {
  const runs = over.reduce((n, b) => n + E.ballTotal(b, rules), 0);
  const legal = over.filter((b) => E.isLegal(b, rules)).length;
  const open = current ? Math.max(0, bpo - legal) : 0;
  return (
    <View style={tw`mt-4`}>
      <View style={tw`flex-row items-center justify-between gap-3`}>
        <Txt style={[LBL, tw`flex-1`]} numberOfLines={1}>{title}</Txt>
        <Num style={[tw`text-[12px] text-teal`, { fontWeight: "500" }]}>{runs} run{runs === 1 ? "" : "s"} <Num style={[tw`text-[12px] text-mute`, { fontWeight: "500" }]}>· {figures}</Num></Num>
      </View>
      {!!umpire && <Txt style={tw`mt-1 text-[12px] text-mute`}>Umpire this over: <Txt style={tw`font-medium text-fg`}>{umpire}</Txt></Txt>}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={tw`mt-2`} contentContainerStyle={[tw`flex-row items-center py-1`, { gap: 7 }]}>
        {over.map((b, i) => <BallChip key={i} b={b} size={30} onPress={onEdit ? () => onEdit(i) : undefined} />)}
        {Array.from({ length: open }, (_, i) => (
          <View key={`s${i}`} style={[{ width: 30, height: 30, borderRadius: 30, borderWidth: 1.5 },
            i === 0 ? { borderColor: C.sun, backgroundColor: "rgba(214,255,99,0.08)", shadowColor: C.sun, shadowOpacity: 0.5, shadowRadius: 6, shadowOffset: { width: 0, height: 0 } }
              : { borderColor: C.line }]} />
        ))}
      </ScrollView>
    </View>
  );
}

function MicButton({ on, onPress }: { on: boolean; onPress: () => void }) {
  return (
    <Press onPress={onPress} accessibilityLabel="Score by voice" accessibilityState={{ checked: on }}
      style={{ width: 38, height: 38, borderRadius: 38, alignItems: "center", justifyContent: "center",
        backgroundColor: on ? OUT_BG : C.sun, borderWidth: on ? 1 : 0, borderColor: OUT_LINE }}>
      {on ? <MicOff size={18} color={C.out} strokeWidth={2.2} /> : <Mic size={18} color={C.ink} strokeWidth={2.2} />}
      {on && <View style={tw`absolute -right-0.5 -top-0.5`}><Pulse /></View>}
    </Press>
  );
}

function ExtraPill({ label, onPress, active, disabled, num, flex = 1, a11y }: {
  label: string; onPress: () => void; active?: boolean; disabled?: boolean; num?: boolean; flex?: number; a11y?: string;
}) {
  const color = active ? C.ink : C.teal;
  return (
    <Press onPress={onPress} disabled={disabled} accessibilityLabel={a11y ?? label} accessibilityState={{ selected: !!active, disabled: !!disabled }}
      style={[{ flex, minHeight: 38, borderRadius: 99, borderWidth: 1, borderColor: active ? C.sun : "#2a302c", backgroundColor: active ? C.sun : "transparent",
        alignItems: "center", justifyContent: "center", paddingHorizontal: 4 }, active && { opacity: 1 }]}>
      {num
        ? <Num style={{ fontSize: 13, color }} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7}>{label}</Num>
        : <Txt style={{ fontSize: 12, fontWeight: active ? "600" : "500", color }} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.8}>{label}</Txt>}
    </Press>
  );
}

type KeyKind = "plain" | "four" | "six" | "out" | "icon";
const KEY_LOOK: Record<KeyKind, { bg: string; line: string; fg: string }> = {
  plain: { bg: C.key, line: "#262b28", fg: C.fg },
  four: { bg: C.key, line: "#262b28", fg: C.sun },
  six: { bg: C.sun, line: C.sun, fg: C.ink },
  out: { bg: OUT_BG, line: OUT_LINE, fg: C.out },
  icon: { bg: C.key, line: "#262b28", fg: C.fg },
};

/** Score keys buzz from show() once the ball is in, so the press itself stays silent. */
function Key({ label, sub, onPress, kind = "plain", haptic = false, disabled, h, a11y }: {
  label: string; sub?: string; onPress: () => void; kind?: KeyKind; haptic?: boolean; disabled?: boolean; h: number; a11y?: string;
}) {
  const look = KEY_LOOK[kind];
  return (
    <Press onPress={onPress} haptic={haptic} disabled={disabled} accessibilityLabel={a11y ?? label}
      style={{ flex: 1, height: h, borderRadius: 18, borderWidth: 1, borderColor: look.line, backgroundColor: look.bg, alignItems: "center", justifyContent: "center", paddingHorizontal: 4 }}>
      {kind === "icon" ? <Undo2 size={22} color={look.fg} strokeWidth={2.2} />
        : kind === "out" ? <Txt style={{ fontSize: 16, fontWeight: "600", color: look.fg }}>{label}</Txt>
        : <Num adjustsFontSizeToFit numberOfLines={1} minimumFontScale={0.6} style={{ fontSize: 24, color: look.fg }}>{label}</Num>}
      {sub && <Num style={{ fontSize: 10, color: look.fg, opacity: 0.8, fontWeight: "500" }} numberOfLines={1}>{sub}</Num>}
    </Press>
  );
}

function Tool({ icon: I, label, onPress, disabled, on }: { icon: LucideIcon; label: string; onPress: () => void; disabled?: boolean; on?: boolean }) {
  return (
    <Press onPress={onPress} disabled={disabled} accessibilityLabel={label} style={tw`flex-1 items-center gap-1`}>
      <View style={[tw`h-10 w-10 items-center justify-center rounded-full border bg-panel`, { borderColor: on ? C.sun : C.line }]}>
        <I size={18} color={on ? C.sun : C.teal} strokeWidth={2} />
      </View>
      <Txt style={tw`text-[10.5px] font-medium ${on ? "text-sun" : "text-mute"}`} numberOfLines={1}>{label}</Txt>
    </Press>
  );
}

type Panel = "ot" | "rules" | "log" | "lost" | "penalty" | "add" | "left" | "turf" | "leader" | "frenchStop";
const NO_PREFS: LivePrefs = {};

/** Hairline list row for sheets. */
function Row({ children, onPress, accent }: { children: ReactNode; onPress: () => void; accent?: boolean }) {
  return (
    <Press onPress={onPress} style={[tw`min-h-12 flex-row items-center gap-3 py-3`, { borderBottomWidth: 1, borderBottomColor: HAIR }]}>
      <Txt style={tw`flex-1 text-[15px] ${accent ? "font-semibold text-sun" : "text-fg"}`}>{children}</Txt>
      <ChevronRight size={18} color={C.mute} strokeWidth={2} />
    </Press>
  );
}

/** Full-width secondary button: hairline-outlined or plain text with an optional icon. */
function Wide({ children, onPress, border, mt, icon: I, color = "text-fg" }: { children: ReactNode; onPress: () => void; border?: boolean; mt?: boolean; icon?: LucideIcon; color?: string }) {
  return (
    <Press onPress={onPress} style={tw`min-h-12 w-full flex-row items-center justify-center gap-2 rounded-[18px] ${border ? "border border-line" : ""} ${mt ? "mt-3" : ""}`}>
      {I && <I size={18} color={color === "text-out" ? C.out : C.teal} strokeWidth={2.2} />}
      <Txt style={tw`text-[15px] font-medium ${color}`}>{children}</Txt>
    </Press>
  );
}

const Body = ({ children }: { children: ReactNode }) => <Txt style={tw`text-[15px] leading-6 text-teal`}>{children}</Txt>;
const B = ({ children }: { children: ReactNode }) => <Num style={tw`text-[15px] text-fg`}>{children}</Num>;

/** The main score: rolls up on every change, and pops a little on a four. */
function ScoreRoll({ runs, wickets, size, pop }: { runs: number; wickets: number | null; size: number; pop: number }) {
  const t = useRef(new Animated.Value(1)).current;
  const s = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    t.setValue(0);
    Animated.timing(t, { toValue: 1, duration: 250, easing: Easing.out(Easing.quad), useNativeDriver: true }).start();
  }, [runs, wickets, t]);
  useEffect(() => {
    if (!pop) return;
    s.setValue(1);
    Animated.sequence([
      Animated.timing(s, { toValue: 1.14, duration: 120, easing: Easing.out(Easing.quad), useNativeDriver: true }),
      Animated.spring(s, { toValue: 1, speed: 14, bounciness: 8, useNativeDriver: true }),
    ]).start();
  }, [pop, s]);
  const shift = t.interpolate({ inputRange: [0, 1], outputRange: [size * 0.3, 0] });
  return (
    <Animated.View style={{ alignSelf: "flex-start", maxWidth: "100%", opacity: t, transform: [{ translateY: shift }, { scale: s }] }}>
      <Board numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.6} style={{ fontSize: size, lineHeight: size * 1.02 }}>{wickets === null ? runs : `${runs}/${wickets}`}</Board>
    </Animated.View>
  );
}

/** A short red wash over the screen on a wicket; never catches taps. */
function OutFlash() {
  const o = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.sequence([
      Animated.timing(o, { toValue: 1, duration: 80, useNativeDriver: true }),
      Animated.timing(o, { toValue: 0, duration: 380, easing: Easing.out(Easing.quad), useNativeDriver: true }),
    ]).start();
  }, [o]);
  return <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, { backgroundColor: C.out, opacity: o.interpolate({ inputRange: [0, 1], outputRange: [0, 0.28] }), zIndex: 50, elevation: 50 }]} />;
}

/** The six moment: full-screen lime for about 1.4s. A tap anywhere dismisses it early. */
function SixOverlay({ six, onDone, onUndo }: { six: SixMoment; onDone: () => void; onUndo: () => void }) {
  const o = useRef(new Animated.Value(0)).current;
  const done = useRef(onDone);
  done.current = onDone;
  useEffect(() => {
    const a = Animated.sequence([
      Animated.timing(o, { toValue: 1, duration: 120, useNativeDriver: true }),
      Animated.delay(900),
      Animated.timing(o, { toValue: 0, duration: 380, easing: Easing.in(Easing.quad), useNativeDriver: true }),
    ]);
    a.start(({ finished }) => { if (finished) done.current(); });
    return () => a.stop();
  }, [o]);
  const scale = o.interpolate({ inputRange: [0, 1], outputRange: [0.94, 1] });
  return (
    <Animated.View style={[StyleSheet.absoluteFill, { opacity: o, zIndex: 60, elevation: 60 }]}>
      <Pressable onPress={() => done.current()} accessibilityLabel="Six. Tap to close" style={[StyleSheet.absoluteFill, { backgroundColor: C.sun }]}>
        <View pointerEvents="none" style={StyleSheet.absoluteFill}>
          <Svg width="100%" height="100%">
            {Array.from({ length: 22 }, (_, i) => <Circle key={i} cx="50%" cy="42%" r={22 * (i + 1)} stroke={C.ink} strokeOpacity={0.06} strokeWidth={2} fill="none" />)}
          </Svg>
        </View>
        <Animated.View style={[tw`flex-1 items-center justify-center px-6`, { transform: [{ scale }] }]}>
          <Svg width={210} height={90} viewBox="0 0 210 90">
            <Path d="M10 80 Q105 -20 200 30" fill="none" stroke={C.ink} strokeWidth={2.5} strokeDasharray="3 7" strokeLinecap="round" />
            <Circle cx={200} cy={30} r={9} fill={C.ink} />
          </Svg>
          <Board style={{ color: C.ink, fontSize: 120, lineHeight: 112, letterSpacing: -2, textShadowRadius: 0, textShadowColor: "transparent" }}>SIX</Board>
          <Txt style={[tw`mt-3.5 text-center text-[16px] font-semibold`, { color: C.ink }]} numberOfLines={1}>
            {six.name}, <Num style={{ color: C.ink, fontSize: 16 }}>{six.runs}</Num> off <Num style={{ color: C.ink, fontSize: 16 }}>{six.balls}</Num>
          </Txt>
          <Press onPress={onUndo} style={tw`mt-6 flex-row items-center gap-1.5 rounded-full bg-ink px-4 py-2.5`}>
            <Undo2 size={16} color={C.sun} strokeWidth={2.2} />
            <Txt style={tw`text-[13px] font-semibold text-sun`}>Undo if it was caught</Txt>
          </Press>
        </Animated.View>
      </Pressable>
    </Animated.View>
  );
}

/** Pulsing red dot on the mic button while it listens. */
function Pulse() {
  const o = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    const loop = Animated.loop(Animated.sequence([
      Animated.timing(o, { toValue: 0.3, duration: 500, useNativeDriver: true }),
      Animated.timing(o, { toValue: 1, duration: 500, useNativeDriver: true }),
    ]));
    loop.start();
    return () => loop.stop();
  }, [o]);
  return <Animated.View style={{ width: 9, height: 9, borderRadius: 9, backgroundColor: C.out, opacity: o }} />;
}
