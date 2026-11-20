import { useEffect, useRef, useState } from "react";
import * as E from "../engine/engine";
import type { BallInput, Extra, Match, Surface, WicketKind } from "../engine/types";
import { useMatch, useStore } from "../store";
import { BowlerSheet, EditBallSheet, FrenchNextSheet, OpenersSheet, OversSheet, RainSheet, RetireSheet, SoloTable, SoloTurnSheet, WicketSheet } from "../sheets";
import { AddPlayerSheet, BallLostSheet, ChangeLogSheet, Chip, DidRunSheet, OverthrowSheet, PairsStrip, PenaltySheet, PlayerLeftSheet, RulesSheet, TurfChip, TurfSheet, WagonSheet } from "../liveSheets";
import * as K from "../liveKit";
import { useLivePrefs, type LivePrefs } from "../livePrefs";
import { say, speakSupported } from "../speak";
import { Badge, BallChip, Card, ConfirmSheet, cx, Header, LivePill, NotFound, PrimaryButton, Sheet, Toggle } from "../ui";
import { listen, parse, voiceSupported } from "../voice";
import { liveSupported, newCode, newLiveKey, newMoveToken, scoreLink, watchLink } from "../live";
import { canScore, deviceId, movedAway } from "../device";
import { track } from "../track";
import { EV } from "../events";

const buzz = (p: number | number[]) => { if (navigator.vibrate) navigator.vibrate(p); };

export default function Live() {
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
  const [rainOpen, setRainOpen] = useState(false);
  const [retireOpen, setRetireOpen] = useState(false);
  const [retireFor, setRetireFor] = useState<string | null>(null);
  const [ending, setEnding] = useState(false);
  const [stopping, setStopping] = useState(false);
  const [panel, setPanel] = useState<Panel | null>(null);
  const [touched, setTouched] = useState(false);
  const [missed, setMissed] = useState(false);
  const [wall, setWall] = useState<Surface | null>(null);
  const [ot, setOt] = useState(0);
  const [didRun, setDidRun] = useState<BallInput | null>(null);
  const [wagon, setWagon] = useState<{ idx: number; evIdx: number } | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [flash, setFlash] = useState<{ text: string; tone: string; key: number } | null>(null);
  const [mic, setMic] = useState(false);
  const [heard, setHeard] = useState("");
  const stopRef = useRef<() => void>(() => {});
  const latest = useRef(m);
  latest.current = m;
  const micOn = useRef(mic);
  micOn.current = mic;
  const prefs = useLivePrefs((s) => (m ? s.prefs[m.id] : undefined)) ?? NO_PREFS;
  const setPrefs = useLivePrefs((s) => s.setPrefs);

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
  if (!m || !m.innings.length) return <NotFound what="match" />;

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
    if (input.wicket || (before && after && K.ballWasOut(before, after))) { setFlash({ text: "OUT!", tone: "text-out", key: Date.now() }); buzz([60, 40, 120]); }
    else if (!input.extra && !input.wall && input.runs === 6) { setFlash({ text: "SIX!", tone: "text-six", key: Date.now() }); buzz([30, 30, 80]); }
    else if (!input.extra && !input.wall && input.runs === 4) { setFlash({ text: "FOUR!", tone: "text-four", key: Date.now() }); buzz([30, 30, 80]); }
    else buzz(15);
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
  const closeRetire = () => { setRetireOpen(false); setRetireFor(null); };

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
    }, () => { setMic(false); setHeard("Mic is blocked. Allow it in your browser settings."); });
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
  const solo = E.isSolo(m), me = bat(inn.striker), upNext = solo ? E.nextBatter(m) : null;
  const canRain = !test && !solo && !E.isPairs(m) && m.status === "live" && m.innings.length === 2 && idx === 1 && !inn.superOver;
  const turnLeft = solo ? E.turnBallsLeft(m) : null, livesLeft = solo ? E.livesLeft(m) : 0;
  const rounds = m.rules.rounds ?? 1, round = solo ? E.soloRound(m) : 0;
  const badges = m.status === "live" ? K.nextBallBadges(m, st) : [];
  const ump = E.umpire(m), guard = m.status === "live" ? K.protectedNote(m, st) : null;
  const leader = E.stopLeaderWins(m) !== m;
  const anyArmed = !!armed || !!wall || ot > 0;
  const armedText = [armed && { wd: "Wide", nb: "No ball", b: "Byes", lb: "Leg byes" }[armed], wall && `${K.SURFACE_NAME[wall]} (${E.wallValue(m.rules, wall)})`, ot > 0 && `overthrow +${ot}`]
    .filter(Boolean).join(", ");
  const keyLabel = (r: number) => (armed ? extraLabel(armed, r) : wall ? `${K.SURFACE_NAME[wall]}${r ? `+${r}` : ""}` : String(r));
  const notBatted = !solo && m.status === "break" ? E.notBattedYet(m, inn.bat) : [];
  const turf = prefs.turfEnd ?? null;
  const onTurfAlert = (text: string) => { buzz([200, 100, 200]); setNotice(text); };
  const closeMore = (then: () => void) => () => { setMore(false); then(); };

  return (
    <div className="min-h-screen pb-10">
      <Header title="Live scoring" back={() => go("home")} right={<LivePill />}>
        <div className="stadium relative mt-3 overflow-hidden rounded-3xl px-5 pb-5 pt-4 text-white">
          {solo ? <>
          <div className="flex items-center gap-2 text-[13px] font-medium text-white/85">
            <Badge name={name(inn.striker)} size={28} /><span className="truncate">{name(inn.striker)} {m.status === "live" ? "batting" : "· turn over"}{rounds > 1 && !french ? ` · Round ${round} of ${rounds}` : ""}</span>
            {st.freeHit && m.status === "live" && <span className="ml-auto rounded-full bg-sun px-2.5 py-0.5 text-[11px] font-extrabold text-ink">FREE HIT</span>}
          </div>
          <p className={cx("mt-2 flex items-baseline gap-2", voiceSupported && "pr-[68px]")}>
            <span key={st.runs} className="roll text-[52px] min-[360px]:text-[64px] font-extrabold leading-none tracking-tight tabular-nums">{st.runs}</span>
            <span className="text-xl font-semibold text-white/85 tabular-nums">off {me?.balls ?? 0}</span>
          </p>
          {m.status === "live" && <div className="mt-3 flex flex-wrap gap-2 text-[13px] font-bold">
            <span className={cx("rounded-full px-3 py-1 tabular-nums", turnLeft !== null && turnLeft <= 3 ? "bg-sun text-ink" : "bg-white/15")}>
              {turnLeft === null ? "No ball limit" : `${turnLeft} ball${turnLeft === 1 ? "" : "s"} left`}</span>
            <span className={cx("rounded-full px-3 py-1 tabular-nums", livesLeft === 1 && inn.wicketLimit > 1 ? "bg-out text-white" : "bg-white/15")}>
              {livesLeft} {livesLeft === 1 ? "life" : "lives"} left</span>
          </div>}
          </> : <>
          <div className="flex items-center gap-2 text-[13px] font-medium text-white/85">
            <Badge name={batTeam.name} size={28} kind="team" /><span className="truncate">{batTeam.name} · {label}</span>
            {st.freeHit && m.status === "live" && <span className="ml-auto rounded-full bg-sun px-2.5 py-0.5 text-[11px] font-extrabold text-ink">FREE HIT</span>}
          </div>
          <p className={cx("mt-2 flex items-baseline gap-2", voiceSupported && "pr-[68px]")}>
            <span key={st.runs + "-" + st.wickets} className="roll text-[52px] min-[360px]:text-[64px] font-extrabold leading-none tracking-tight tabular-nums">{st.runs}/{st.wickets}</span>
            {!inn.superOver && !test && !solo && m.status === "live"
              ? <button onClick={() => setOversOpen(true)} aria-label="Change the overs for this innings" className="press text-xl font-semibold text-white/85 tabular-nums underline decoration-dotted underline-offset-4">({K.oversLine(m, idx, st)})</button>
              : <span className="text-xl font-semibold text-white/85 tabular-nums">({K.oversLine(m, idx, st)})</span>}
          </p>
          <p className="mt-2 text-[13px] text-white/85">
            {test
              ? <>{status ? <b className="text-sun">{status}</b> : <>Run rate {E.runRate(st.runs, st.legal, bpo).toFixed(2)}</>}{capText}</>
              : tgt !== null
              ? <>Need <b className="text-sun">{Math.max(0, need)}</b> off <b className="text-sun">{left}</b> ball{left === 1 ? "" : "s"} · Target {tgt} · RRR {left ? ((need * bpo) / left).toFixed(2) : "-"}</>
              : <>Run rate {E.runRate(st.runs, st.legal, bpo).toFixed(2)}{m.toss && idx === 0 && st.legal === 0 ? ` · ${m.teams[m.toss.winner].name} won the toss, chose to ${m.toss.choice}` : ""}</>}
            {st.penalties > 0 && <> · incl. {st.penalties} penalty</>}
          </p>
          </>}
          {(badges.length > 0 || m.live || turf) && <div className="mt-2 flex flex-wrap items-center gap-2">
            {badges.map((b) => <span key={b} className="rounded-full bg-sun px-2.5 py-1 text-[11px] font-extrabold text-ink">{b}</span>)}
            {m.live && <span className="inline-flex items-center gap-1.5 rounded-full bg-white/15 px-2.5 py-1 text-[11px] font-bold"><span className="live-dot text-out">●</span>Sharing live · {m.live}</span>}
            {turf && <TurfChip end={turf} onClick={() => setPanel("turf")} onAlert={onTurfAlert} />}
          </div>}
          {voiceSupported && !locked && (
            <button onClick={toggleMic} aria-label="Score by voice"
              className={cx("press absolute right-4 top-12 grid h-14 w-14 place-items-center rounded-full text-2xl shadow-lg", mic ? "bg-out text-white" : "bg-sun text-ink")}>
              {mic ? <span className="live-dot">●</span> : "🎙"}
            </button>
          )}
        </div>
      </Header>

      <main className="mx-auto max-w-[480px] px-4">
        {heard && <p className="mt-3 text-center text-sm font-medium text-teal">{heard}</p>}
        {mic && !heard && <p className="mt-3 text-center text-sm font-medium text-teal">Listening. Say "four", "wide", "out" or "undo"</p>}
        {notice && <p className="mt-3 rounded-2xl bg-sun-soft p-3 text-sm font-medium text-fg">{notice}</p>}

        {locked ? (<>
          <Card className="mt-4 !p-3">
            <p className="text-sm text-mute">On strike: <b className="font-semibold text-fg">{name(st.striker)}</b> {bat(st.striker)?.runs ?? 0} ({bat(st.striker)?.balls ?? 0}) · Bowler: <b className="font-semibold text-fg">{name(inn.bowler)}</b></p>
            <div className="mt-2 flex items-center gap-2 overflow-x-auto pb-1">{shownOver.map((b, i) => <BallChip key={i} b={b} />)}</div>
          </Card>
          <Locked match={m} />
        </>) : m.status === "break" && solo ? (
          <Card className="mt-4">
            <p className="text-center text-sm font-semibold text-teal">Turn over</p>
            <p className="mt-1 text-center text-2xl font-extrabold text-fg">{turnLine(m, idx)}</p>
            {rounds > 1 && !french && <p className="mt-1 text-center text-sm text-mute">Next up: round {round} of {rounds}</p>}
            <div className="-mx-4 mt-4 overflow-hidden border-y border-line"><SoloTable match={m} highlight={upNext} /></div>
            <div className="mt-5"><PrimaryButton onClick={() => setTurnOpen(true)}>{french ? "Who bats next?" : `Start ${name(upNext)}'s turn`}</PrimaryButton></div>
            {french && <button onClick={() => setPanel("frenchStop")} className="press mt-3 min-h-12 w-full rounded-2xl border-2 border-line font-semibold text-fg">Stop, most runs wins</button>}
            <button onClick={() => undo(m.id)} className="press mt-3 min-h-12 w-full rounded-2xl font-semibold text-mute">↶ Undo last ball</button>
          </Card>
        ) : m.status === "break" && test ? (
          <Card className="mt-4 text-center">
            <p className="text-sm font-semibold text-teal">{inn.declared ? "Declared" : "Innings over"}</p>
            <p className="mt-1 text-3xl font-extrabold text-fg">{batTeam.name} {E.inningsScore(m, idx)}</p>
            <p className="mt-1 font-semibold text-sun">{status}</p>
            {capText && <p className="mt-1 text-sm text-mute">{capText.slice(3)}</p>}
            {notBatted.length > 0 && <p className="mt-2 text-sm text-mute">Yet to bat for {batTeam.name}: {notBatted.map((p) => p.name).join(", ")}</p>}
            <div className="mt-5"><PrimaryButton onClick={() => setOpeners(true)}>Start the {["", "2nd", "3rd", "4th"][idx + 1]} innings</PrimaryButton></div>
            <button onClick={() => setStopping(true)} className="press mt-3 min-h-12 w-full rounded-2xl border-2 border-line font-semibold text-fg">Stop the match, call it a draw</button>
            <button onClick={() => undo(m.id)} className="press mt-3 min-h-12 w-full rounded-2xl font-semibold text-mute">↶ Undo last ball</button>
          </Card>
        ) : m.status === "break" ? (
          <Card className="mt-4 text-center">
            <p className="text-sm font-semibold text-teal">{inn.superOver ? "Super over break" : "Innings break"}</p>
            <p className="mt-1 text-3xl font-extrabold text-fg">{batTeam.name} {st.runs}/{st.wickets}</p>
            <p className="mt-1 text-mute">{fieldTeam.name} need {st.runs + 1} off {inn.balls ?? inn.overs * bpo} balls</p>
            {notBatted.length > 0 && <p className="mt-2 text-sm text-mute">Didn't get a bat: {notBatted.map((p) => p.name).join(", ")}</p>}
            <div className="mt-5"><PrimaryButton onClick={() => setOpeners(true)}>Start the chase</PrimaryButton></div>
            {!inn.superOver && <button onClick={() => setOversOpen(true)} className="press mt-3 min-h-12 w-full rounded-2xl border-2 border-line font-semibold text-fg">Change overs ({m.rules.overs})</button>}
            <button onClick={() => undo(m.id)} className="press mt-3 min-h-12 w-full rounded-2xl font-semibold text-mute">↶ Undo last ball</button>
          </Card>
        ) : (
          <>
            {solo ? <SoloStrip match={m} batting={inn.striker} next={upNext} /> : <div className="mt-4 grid grid-cols-2 gap-3">
              {[st.striker, st.nonStriker].map((id, i) => id ? (
                <button key={id} onClick={() => i === 1 && put(E.swapStrike(m))}
                  className={cx("press rounded-3xl border-2 bg-panel p-3 text-left", i === 0 ? "border-sun shadow-[0_8px_24px_-14px_rgba(255,138,61,1)]" : "border-transparent")}>
                  <span className="flex items-center gap-1 text-[15px] font-semibold text-fg">{i === 0 && <span aria-label="On strike">🏏</span>}<span className="truncate">{name(id)}</span></span>
                  <span className="text-sm font-medium text-teal tabular-nums">{bat(id)?.runs ?? 0} ({bat(id)?.balls ?? 0}){bat(id)?.outs ? ` · out ${bat(id)!.outs}×` : ""}</span>
                </button>
              ) : <div key={i} className="grid place-items-center rounded-3xl border-2 border-dashed border-line text-xs text-mute">Batting alone</div>)}
            </div>}
            {pairs && <PairsStrip match={m} idx={idx} />}
            {guard && <p className="mt-2 text-xs text-mute">{guard}</p>}

            <Card className="mt-3 !p-3">
              <div className="flex items-center justify-between text-sm">
                <span className="text-mute">Bowler: <b className="font-semibold text-fg">{name(inn.bowler)}</b></span>
                <span className="font-semibold text-teal tabular-nums">{bowler ? `${E.oversText(bowler.legal, bpo)}-${bowler.maidens}-${bowler.runs}-${bowler.wickets}` : `0.0-0-0-0`}</span>
              </div>
              {ump && <p className="mt-1 text-xs text-mute">Umpire this over: <b className="font-semibold text-fg">{ump.name}</b></p>}
              <div className="mt-3 flex items-center gap-2 overflow-x-auto pb-1">
                <span className="shrink-0 text-xs font-semibold text-mute">{french ? "Balls" : thisOver.length ? `Over ${overNo + 1}` : shownOver.length ? `Over ${overNo}` : "New over"}</span>
                {shownOver.map((b, i) => <BallChip key={i} b={b} onClick={thisOver.length ? () => setEdit(overStart + eventIndex(inn.events, overStart, i)) : undefined} />)}
              </div>
            </Card>

            {oddRuns && !anyArmed && (
              <div className="mt-3 flex min-h-12 items-center gap-2 rounded-full bg-panel pl-4 pr-1">
                <p className="flex-1 text-[13px] font-medium leading-tight text-mute">
                  {oddRuns.stay ? "Didn't cross: " : "Batters crossed: "}<b className="font-semibold text-fg">{name(st.striker)}</b> on strike
                </p>
                <button onClick={() => put(E.setCrossed(m, !!oddRuns.stay))}
                  className="press min-h-10 shrink-0 rounded-full border-2 border-sun/80 px-3 text-sm font-semibold text-fg">
                  {oddRuns.stay ? "They crossed" : "Didn't cross"}
                </button>
              </div>
            )}
            <div className="mt-3 flex flex-wrap items-center gap-2">
              {mustTouch && <Chip on={touched} onClick={() => setTouched((v) => !v)}>Bat touched</Chip>}
              {!!m.rules.missesOut && <Chip on={missed} onClick={() => setMissed((v) => !v)}>Missed <span className="tabular-nums opacity-80">{st.misses.get(st.striker ?? "") ?? 0}/{m.rules.missesOut}</span></Chip>}
              {walls.map((s) => <Chip key={s} on={wall === s} onClick={() => setWall((w) => (w === s ? null : s))}>{K.SURFACE_NAME[s]} <span className="tabular-nums">{E.wallValue(m.rules, s)}</span></Chip>)}
              <Chip on={ot > 0} onClick={() => setPanel("ot")}>{ot > 0 ? `Overthrow +${ot}` : "Overthrow"}</Chip>
            </div>
            {anyArmed ? (
              <div className="mt-3 flex min-h-12 items-center gap-2 rounded-full border-2 border-sun bg-sun-soft pl-4 pr-1">
                <p className="flex-1 text-[13px] font-semibold leading-tight text-fg">{armedText}: {armed === "wd" || armed === "nb" ? "tap runs taken, 0 if none" : wall ? "tap runs they ran too, 0 if none" : "tap runs they ran"}</p>
                <button onClick={clearMods} className="press min-h-10 shrink-0 rounded-full bg-panel px-3 text-sm font-semibold text-mute">Cancel</button>
              </div>
            ) : (
              <div className="mt-3 grid grid-cols-4 gap-2">
                {(["wd", "nb", "b", "lb"] as Extra[]).map((x) => (
                  <button key={x} onClick={() => setArmed(x)} disabled={waiting}
                    className="press min-h-12 rounded-full border-2 border-sun/80 bg-panel text-sm font-semibold text-fg">
                    {{ wd: "Wide", nb: "No ball", b: "Byes", lb: "Leg bye" }[x]}
                  </button>
                ))}
              </div>
            )}
            <div className={cx("mt-3 grid grid-cols-4 gap-2.5 transition-opacity", anyArmed && "rounded-[24px] ring-2 ring-sun/60 ring-offset-4 ring-offset-cream", waiting && "pointer-events-none opacity-40")}>
              {[0, 1, 2, 3].map((r) => <Key key={r} onClick={() => score(r)} label={keyLabel(r)} />)}
              <Key onClick={() => score(4)} label="4" sub={anyArmed ? keyLabel(4) : "Four"} tone="text-four" />
              <Key onClick={() => score(6)} label="6" sub={anyArmed ? keyLabel(6) : "Six"} tone="text-six" />
              <Key onClick={() => score(5)} label="5" sub={anyArmed ? keyLabel(5) : "Overthrow"} />
              <Key onClick={() => setWicket(armed)} label="OUT" tone="text-white" bg="bg-out" />
            </div>

            <div className="mt-4 flex items-center justify-around rounded-full bg-panel px-2 py-1.5 shadow-[0_10px_30px_-12px_rgba(0,0,0,.3)]">
              <Tool onClick={() => undo(m.id)} icon="↶" label="Undo" />
              <Tool onClick={() => redoBall(m.id)} icon="↷" label="Redo" disabled={!redo.length} />
              {!solo && <Tool onClick={() => put(E.swapStrike(m))} icon="⇄" label="Swap" disabled={!st.nonStriker} />}
              <Tool onClick={() => go("scorecard")} icon="▤" label="Scorecard" />
              {liveSupported && <Tool onClick={() => setShare(true)} icon="📡" label={m.live ? "Live on" : "Go live"} />}
              <Tool onClick={() => setMore(true)} icon="⋯" label="More" />
            </div>
            {canDeclare && <button onClick={() => setEnding(true)} disabled={waiting}
              className="press mt-3 min-h-12 w-full rounded-2xl border-2 border-sun/80 bg-panel font-semibold text-fg">Declare {batTeam.name}'s innings</button>}
          </>
        )}
      </main>

      {flash && <div key={flash.key} className="pointer-events-none fixed inset-0 z-50 grid place-items-center">
        <span className={cx("pop text-[110px] font-extrabold italic tracking-tighter drop-shadow-[0_6px_0_#000]", flash.tone)}>{flash.text}</span>
      </div>}

      {!locked && m.status === "live" && (pickBowler || bowlerDue) && !retireOpen && !wagon && !didRun && <BowlerSheet match={m} onPick={(n) => { put(n); setPickBowler(false); }}
        onClose={E.needsBowler(m, idx) ? undefined : () => setPickBowler(false)}
        onEnd={!test ? () => setEnding(true) : canDeclare ? () => setEnding(true) : undefined} endLabel={test ? "Declare instead" : solo ? "End turn instead" : undefined} />}
      {ending && <ConfirmSheet title={test ? "Declare?" : solo ? "End this turn?" : "End this innings?"} yes={test ? "Declare" : solo ? "End turn" : "End innings"} danger onClose={() => setEnding(false)}
        onYes={() => { put(E.closeInnings(m)); setPickBowler(false); useStore.setState({ redo: [] }); }}
        body={solo
          ? <>{name(inn.striker)} finishes on <b>{st.runs}</b> off {me?.balls ?? 0}.{upNext || french ? "" : " That ends the match."} You can undo it.</>
          : test
          ? <>{batTeam.name} declare on <b>{st.runs}/{st.wickets}</b>. {fieldTeam.name} bat next. You can undo it.</>
          : <>{batTeam.name} finish on <b>{st.runs}/{st.wickets}</b> in {E.oversText(st.legal, bpo)} overs.{tgt !== null ? " That ends the match." : ""} You can undo it.</>} />}
      {stopping && <ConfirmSheet title="Stop the match?" yes="Call it a draw" danger onClose={() => setStopping(false)}
        onYes={() => { put(E.stopMatch(m)); setStopping(false); setPickBowler(false); useStore.setState({ redo: [] }); }}
        body={<>Ends as a draw. You can undo it.</>} />}
      {panel === "frenchStop" && <ConfirmSheet title="Stop the game?" yes="Stop, most runs wins" danger onClose={() => setPanel(null)}
        onYes={() => { put(E.stopMatch(m)); setPickBowler(false); useStore.setState({ redo: [] }); }}
        body={<>French cricket goes on until you stop it. Whoever has the most runs wins. You can undo it.</>} />}
      {panel === "leader" && <ConfirmSheet title="Stop now?" yes="Stop, leader wins" danger onClose={() => setPanel(null)}
        onYes={() => { put(E.stopLeaderWins(m)); setPickBowler(false); useStore.setState({ redo: [] }); }}
        body={<>The match ends here and the side ahead on runs per ball wins. You can undo it.</>} />}
      {rainOpen && <RainSheet match={m} onClose={() => setRainOpen(false)} onSave={(n) => { track(EV.rain_rule); put(n); setRainOpen(false); }} />}
      {oversOpen && <OversSheet match={m} onClose={() => setOversOpen(false)} onSave={(n) => { put(n); setOversOpen(false); }} />}
      {retireOpen && <RetireSheet match={m} batter={retireFor} onClose={closeRetire} onSave={(n) => { put(n); closeRetire(); useStore.setState({ redo: [] }); }} />}
      {wicket !== false && <WicketSheet match={m} extra={wicket} preset={wicketKind} onDone={confirmWicket} onClose={() => { setWicket(false); setWicketKind(null); }} />}
      {didRun && <DidRunSheet match={m} input={didRun} onClose={() => setDidRun(null)}
        onRan={(r) => { const input = { ...didRun, runs: r }; setDidRun(null); commit(input); }}
        onOut={() => { setWicketKind("didn't run"); setWicket(didRun.extra ?? null); setDidRun(null); }} />}
      {wagon && !locked && <WagonSheet box={K.boxMode(m.rules)} onSkip={() => setWagon(null)}
        onPick={(z) => { const cur = latest.current; if (cur) { track(EV.wagon_zone_set); put(K.setZone(cur, wagon.idx, wagon.evIdx, z)); } setWagon(null); }} />}
      {edit !== null && inn.events[edit]?.t === "ball" && (
        <EditBallSheet ball={inn.events[edit] as E.State["overs"][number][number]} onClose={() => setEdit(null)}
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
          <div className="grid gap-2">
            <PrimaryButton tone="navy" onClick={closeMore(() => setPickBowler(true))}>Change bowler</PrimaryButton>
            {!inn.superOver && !test && !solo && <PrimaryButton tone="navy" onClick={closeMore(() => setOversOpen(true))}>Change overs ({inn.overs})</PrimaryButton>}
            {canRain && <PrimaryButton tone="navy" onClick={closeMore(() => setRainOpen(true))}>Rain rule{m.revisedTarget ? ` (target ${m.revisedTarget})` : ""}</PrimaryButton>}
            {!solo && <PrimaryButton tone="navy" onClick={closeMore(() => setRetireOpen(true))}>Retire a batter</PrimaryButton>}
            {!test && <PrimaryButton onClick={closeMore(() => setEnding(true))}>{solo ? "End turn" : "End innings"}</PrimaryButton>}
            {canDeclare && <PrimaryButton onClick={closeMore(() => setEnding(true))}>Declare innings</PrimaryButton>}
            {test && <PrimaryButton tone="navy" onClick={closeMore(() => setStopping(true))}>Stop the match, call it a draw</PrimaryButton>}
            {french && <PrimaryButton tone="navy" onClick={closeMore(() => setPanel("frenchStop"))}>Stop, most runs wins</PrimaryButton>}
          </div>
          <p className="mb-2 mt-5 text-sm font-semibold text-teal">Match day</p>
          <div className="grid grid-cols-2 gap-2">
            <MoreItem onClick={closeMore(() => setPanel("lost"))}>Ball lost</MoreItem>
            {!solo && <MoreItem onClick={closeMore(() => setPanel("penalty"))}>Penalty runs</MoreItem>}
            <MoreItem onClick={closeMore(() => setPanel("add"))}>Add a player</MoreItem>
            <MoreItem onClick={closeMore(() => setPanel("left"))}>Player left</MoreItem>
            {leader && <MoreItem onClick={closeMore(() => setPanel("leader"))}>Stop now, leader wins</MoreItem>}
            <MoreItem onClick={closeMore(() => setPanel("rules"))}>Rules</MoreItem>
            <MoreItem onClick={closeMore(() => setPanel("log"))}>Change log</MoreItem>
          </div>
          <p className="mb-1 mt-5 text-sm font-semibold text-teal">On this phone</p>
          <Toggle on={!!prefs.wagon} set={(v) => { if (v) track(EV.wagon_wheel_on); setPrefs(m.id, { wagon: v }); }} label="Wagon wheel" hint="Tap where each shot went." />
          {speakSupported && <Toggle on={!!prefs.speak} set={(v) => { if (v) track(EV.commentary_on); setPrefs(m.id, { speak: v }); }} label="Spoken commentary" hint={mic ? "Quiet while the mic is on, so it doesn't score itself." : "Says each ball out loud."} />}
          <button onClick={closeMore(() => setPanel("turf"))} className="flex w-full items-center gap-3 py-3 text-left">
            <span className="flex-1"><span className="block font-semibold text-fg">Turf timer</span><span className="block text-xs text-mute">{turf ? `Ends at ${new Date(turf).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}` : "Count down the booked time"}</span></span>
            <span className="text-sm font-semibold text-sun">{turf ? "Change" : "Set"}</span>
          </button>
        </Sheet>
      )}
    </div>
  );
}

type Panel = "ot" | "rules" | "log" | "lost" | "penalty" | "add" | "left" | "turf" | "leader" | "frenchStop";
const NO_PREFS: LivePrefs = {};

function MoreItem({ children, onClick }: { children: string; onClick: () => void }) {
  return <button onClick={onClick} className="press min-h-12 rounded-2xl border-2 border-line bg-panel px-3 text-sm font-semibold text-fg">{children}</button>;
}

function ShareSheet({ match: m, onClose }: { match: Match; onClose: () => void }) {
  const { put } = useStore();
  const [copied, setCopied] = useState(false);
  const move = (extra: Partial<Match> = {}) => { track(EV.handover_start); put({ ...m, ...extra, scorer: deviceId, handover: newMoveToken() }); onClose(); };
  const moveButton = (onClick: () => void) => (
    <button onClick={onClick} className="press min-h-12 w-full rounded-2xl border-2 border-line bg-panel font-semibold text-fg">Move scoring to another phone</button>
  );
  if (!m.live) return (
    <Sheet title="Share this match live" onClose={onClose}>
      <p className="text-sm text-mute">Anyone with the code or link follows every ball. Keep this app open.</p>
      <div className="mt-4 grid gap-2">
        <PrimaryButton onClick={() => void newLiveKey().then((k) => { track(EV.live_share_start); put({ ...m, live: newCode(), ...k }); })}>Start live sharing</PrimaryButton>
        {moveButton(() => void newLiveKey().then((k) => move({ live: newCode(), ...k })))}
      </div>
    </Sheet>
  );
  const link = watchLink(m.live, m.liveFp);
  const msg = `Watch ${matchName(m)} live, ball by ball: ${link}`;
  return (
    <Sheet title="You're live" onClose={onClose}>
      <div className="rounded-3xl bg-key p-4 text-center">
        <p className="text-sm font-semibold text-mute">Match code</p>
        <p className="mt-1 text-[44px] font-extrabold tracking-[0.2em] text-sun">{m.live}</p>
        <p className="mt-1 break-all text-xs text-mute">{link}</p>
      </div>
      <div className="mt-4 grid gap-2">
        <PrimaryButton onClick={() => window.open("https://wa.me/?text=" + encodeURIComponent(msg), "_blank")}>Send link on WhatsApp</PrimaryButton>
        <button onClick={() => { void navigator.clipboard?.writeText(link).then(() => setCopied(true)); }}
          className="press min-h-12 w-full rounded-2xl border-2 border-line bg-panel font-semibold text-fg">{copied ? "Copied" : "Copy link"}</button>
        {m.liveKey && moveButton(() => move())}
        <button onClick={() => { track(EV.live_share_stop); put({ ...m, live: undefined, liveKey: undefined, liveFp: undefined, scorer: undefined, handover: undefined }); onClose(); }} className="press min-h-12 w-full rounded-2xl font-semibold text-out">Stop sharing</button>
      </div>
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
    <Card className="mt-4">
      {waiting ? (<>
        <p className="font-bold text-fg">Moving scoring to another phone</p>
        <p className="mt-1 text-sm text-mute">Scoring pauses here. Send the link to the new scorer only.</p>
        <p className="mt-3 rounded-2xl bg-sun-soft p-3 text-sm text-fg">Send it only to the new scorer, not to the group. The app opens it once, but the link holds this match's scoring key.</p>
        <div className="mt-4 grid gap-2">
          <PrimaryButton onClick={() => window.open("https://wa.me/?text=" + encodeURIComponent(text), "_blank")}>Send on WhatsApp</PrimaryButton>
          <button onClick={() => { void navigator.clipboard?.writeText(link).then(() => setCopied(true)); }}
            className="press min-h-12 w-full rounded-2xl border-2 border-line bg-panel font-semibold text-fg">{copied ? "Copied" : "Copy link"}</button>
          <button onClick={() => put({ ...m, handover: undefined })} className="press min-h-12 w-full rounded-2xl font-semibold text-teal">Cancel, keep scoring here</button>
        </div>
      </>) : (<>
        <p className="font-bold text-fg">Scoring is on another phone</p>
        <p className="mt-1 text-sm text-mute">This phone follows every ball. To score here again, ask that phone to move scoring back to you.</p>
        <div className="mt-4 grid gap-2">
          <PrimaryButton tone="navy" onClick={() => go("scorecard")}>Full scorecard</PrimaryButton>
          <button onClick={() => setTakeBack(true)} className="press min-h-12 w-full rounded-2xl font-semibold text-mute">Take scoring back</button>
        </div>
      </>)}
      {takeBack && <ConfirmSheet title="Take scoring back?" yes="Score on this phone" onClose={() => setTakeBack(false)}
        onYes={() => { track(EV.take_scoring_back); put({ ...m, scorer: deviceId, handover: undefined }); setTakeBack(false); }}
        body={<>Only do this if the other phone can't score any more, like a dead battery. That phone will stop scoring.</>} />}
    </Card>
  );
}

const matchName = (m: Match) => (E.isSolo(m) ? "our gully match" : `${m.teams[0].name} vs ${m.teams[1].name}`);

/** Solo: "Aarav: 18 off 12, out" for a finished turn. */
function turnLine(m: Match, idx: number) {
  const inn = m.innings[idx], st = E.replay(m, idx), balls = st.bat.get(inn.striker)?.balls ?? 0;
  const lost = st.wickets >= inn.wicketLimit ? "out" : st.wickets ? `not out, lost ${st.wickets} ${st.wickets === 1 ? "life" : "lives"}` : "not out";
  return `${E.playerName(m, inn.striker)}: ${st.runs} off ${balls}, ${lost}`;
}

/** Solo: the top three so far and who bats next, where the two batters sit in a team match. */
function SoloStrip({ match: m, batting, next }: { match: Match; batting: string; next: string | null }) {
  const rows = E.soloStandings(m).slice(0, 3);
  return (
    <Card className="mt-4 !p-3">
      <div className="flex items-center gap-2 overflow-x-auto pb-0.5">
        {rows.map((r, i) => (
          <span key={r.id} className={cx("flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 text-sm", r.id === batting ? "bg-sun-soft font-semibold text-fg ring-1 ring-sun" : "bg-key text-fg")}>
            <span className="text-xs font-bold text-mute tabular-nums">{i + 1}</span><span className="max-w-[96px] truncate">{r.name}</span><b className="tabular-nums">{r.runs}</b>
          </span>
        ))}
      </div>
      <p className="mt-2 text-sm text-mute">{next ? <>Up next: <b className="font-semibold text-fg">{E.playerName(m, next)}</b></> : "Last turn of the match"}</p>
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

function Key({ label, sub, onClick, tone = "text-fg", bg = "bg-key" }: { label: string; sub?: string; onClick: () => void; tone?: string; bg?: string }) {
  return (
    <button onClick={onClick} className={cx("press flex h-[76px] flex-col items-center justify-center rounded-[20px] shadow-[0_4px_0_rgba(0,0,0,.08)]", bg, tone)}>
      <span className="text-[28px] font-bold leading-none tabular-nums">{label}</span>
      {sub && <span className="mt-1 text-[11px] font-semibold opacity-80">{sub}</span>}
    </button>
  );
}

function Tool({ icon, label, onClick, disabled }: { icon: string; label: string; onClick: () => void; disabled?: boolean }) {
  return (
    <button onClick={onClick} disabled={disabled} className="press flex min-h-12 flex-1 flex-col items-center justify-center rounded-full text-teal disabled:opacity-30">
      <span className="text-lg leading-none">{icon}</span><span className="text-[11px] font-semibold">{label}</span>
    </button>
  );
}
