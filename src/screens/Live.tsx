import { useEffect, useRef, useState } from "react";
import * as E from "../engine/engine";
import type { BallInput, Extra, Match } from "../engine/types";
import { useMatch, useStore } from "../store";
import { BowlerSheet, EditBallSheet, OpenersSheet, OversSheet, RetireSheet, WicketSheet } from "../sheets";
import { Badge, BallChip, Card, ConfirmSheet, cx, Header, LivePill, PrimaryButton, Sheet } from "../ui";
import { listen, parse, voiceSupported } from "../voice";
import { liveSupported, newCode, newLiveKey, newMoveToken, scoreLink, watchLink } from "../live";
import { canScore, deviceId, movedAway } from "../device";
import { track } from "../track";

const buzz = (p: number | number[]) => { if (navigator.vibrate) navigator.vibrate(p); };

export default function Live() {
  const m = useMatch();
  const { go, put, redo, ball, undo, redoBall } = useStore();
  const [armed, setArmed] = useState<Extra | null>(null);
  const [wicket, setWicket] = useState<Extra | null | false>(false);
  const [edit, setEdit] = useState<number | null>(null);
  const [more, setMore] = useState(false);
  const [share, setShare] = useState(false);
  const [openers, setOpeners] = useState(false);
  const [pickBowler, setPickBowler] = useState(false);
  const [oversOpen, setOversOpen] = useState(false);
  const [retireOpen, setRetireOpen] = useState(false);
  const [ending, setEnding] = useState(false);
  const [flash, setFlash] = useState<{ text: string; tone: string; key: number } | null>(null);
  const [mic, setMic] = useState(false);
  const [heard, setHeard] = useState("");
  const stopRef = useRef<() => void>(() => {});
  const latest = useRef(m);
  latest.current = m;

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
  const overNo = Math.floor(st.legal / 6);
  const thisOver = st.legal % 6 === 0 && st.legal > 0 && !E.needsBowler(m, idx) ? [] : (st.overs[overNo] ?? []);
  const shownOver = thisOver.length ? thisOver : (st.overs[overNo - 1] ?? []);
  const overStart = inn.events.length - (thisOver.length ? countEvents(inn.events, thisOver.length) : 0);

  function show(input: BallInput) {
    if (input.wicket) { setFlash({ text: "OUT!", tone: "text-out", key: Date.now() }); buzz([60, 40, 120]); }
    else if (!input.extra && input.runs === 6) { setFlash({ text: "SIX!", tone: "text-six", key: Date.now() }); buzz([30, 30, 80]); }
    else if (!input.extra && input.runs === 4) { setFlash({ text: "FOUR!", tone: "text-four", key: Date.now() }); buzz([30, 30, 80]); }
    else buzz(15);
  }
  function score(runs: number) {
    const input: BallInput = armed ? { runs, extra: armed } : { runs };
    ball(m!.id, input); show(input); setArmed(null);
  }
  function confirmWicket(next: Match, input: BallInput) {
    put(E.addBall(next, input)); useStore.setState({ redo: [] });
    show(input); setWicket(false); setArmed(null);
  }

  function toggleMic() {
    if (mic) { stopRef.current(); setMic(false); setHeard(""); return; }
    track("voice_on");
    stopRef.current = listen((said) => {
      const cur = latest.current, cmd = parse(said);
      track("voice_command", { understood: cmd ? 1 : 0, kind: cmd?.kind ?? "none" });
      setHeard(cmd ? `Heard "${said}"` : `Heard "${said}", not a score`);
      if (!cmd || !cur || cur.status !== "live") return;
      if (cmd.kind === "undo") useStore.getState().undo(cur.id);
      else if (cmd.kind === "out") setWicket(cmd.extra ?? null);
      else if (!E.needsBowler(cur, cur.innings.length - 1)) { useStore.getState().ball(cur.id, cmd.input); show(cmd.input); }
    }, () => { setMic(false); setHeard("Mic is blocked. Allow it in your browser settings."); });
    setMic(true);
  }

  const name = (id: string | null) => E.playerName(m, id);
  const bat = (id: string | null) => (id ? st.bat.get(id) : undefined);
  const bowler = st.bowl.get(inn.bowler);
  const need = tgt !== null ? tgt - st.runs : 0, left = inn.overs * 6 - st.legal;
  const label = inn.superOver ? "Super over" : idx === 0 ? "1st innings" : "2nd innings";
  const last = inn.events[inn.events.length - 1];
  // Odd runs usually swap ends, but a short run or a misfield can leave them where they were.
  const oddRuns = m.status === "live" && last?.t === "ball" && last.runs % 2 === 1 && !last.wicket && !!st.nonStriker ? last : null;

  return (
    <div className="min-h-screen pb-10">
      <Header title="Live Scoring" back={() => go("home")} right={<LivePill />}>
        <div className="stadium relative mt-3 overflow-hidden rounded-3xl px-5 pb-5 pt-4 text-white">
          <div className="flex items-center gap-2 text-[13px] font-medium text-white/85">
            <Badge name={batTeam.name} size={28} /><span className="truncate">{batTeam.name} · {label}</span>
            {st.freeHit && m.status === "live" && <span className="ml-auto rounded-full bg-sun px-2.5 py-0.5 text-[11px] font-extrabold text-ink">FREE HIT</span>}
          </div>
          <p className={cx("mt-2 flex items-baseline gap-2", voiceSupported && "pr-[68px]")}>
            <span key={st.runs + "-" + st.wickets} className="roll text-[52px] min-[360px]:text-[64px] font-extrabold leading-none tracking-tight tabular-nums">{st.runs}/{st.wickets}</span>
            <span className="text-xl font-semibold text-white/85 tabular-nums">({E.oversText(st.legal)}/{inn.overs})</span>
          </p>
          <p className="mt-2 text-[13px] text-white/85">
            {tgt !== null
              ? <>Need <b className="text-sun">{Math.max(0, need)}</b> off <b className="text-sun">{left}</b> ball{left === 1 ? "" : "s"} · Target {tgt} · RRR {left ? ((need * 6) / left).toFixed(2) : "-"}</>
              : <>Run rate {E.runRate(st.runs, st.legal).toFixed(2)}{m.toss && idx === 0 && st.legal === 0 ? ` · ${m.teams[m.toss.winner].name} won the toss, chose to ${m.toss.choice}` : ""}</>}
          </p>
          {m.live && <p className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-white/15 px-2.5 py-1 text-[11px] font-bold"><span className="live-dot text-out">●</span>Sharing live · {m.live}</p>}
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

        {locked ? (<>
          <Card className="mt-4 !p-3">
            <p className="text-sm text-mute">On strike: <b className="font-semibold text-fg">{name(st.striker)}</b> {bat(st.striker)?.runs ?? 0} ({bat(st.striker)?.balls ?? 0}) · Bowler: <b className="font-semibold text-fg">{name(inn.bowler)}</b></p>
            <div className="mt-2 flex items-center gap-2 overflow-x-auto pb-1">{shownOver.map((b, i) => <BallChip key={i} b={b} />)}</div>
          </Card>
          <Locked match={m} />
        </>) : m.status === "break" ? (
          <Card className="mt-4 text-center">
            <p className="text-sm font-semibold text-teal">{inn.superOver ? "Super over break" : "Innings break"}</p>
            <p className="mt-1 text-3xl font-extrabold text-fg">{batTeam.name} {st.runs}/{st.wickets}</p>
            <p className="mt-1 text-mute">{fieldTeam.name} need {st.runs + 1} off {inn.overs * 6} balls</p>
            <div className="mt-5"><PrimaryButton onClick={() => setOpeners(true)}>Start the chase</PrimaryButton></div>
            {!inn.superOver && <button onClick={() => setOversOpen(true)} className="press mt-3 min-h-12 w-full rounded-2xl border-2 border-line font-semibold text-fg">Change overs ({m.rules.overs})</button>}
            <button onClick={() => undo(m.id)} className="press mt-3 min-h-12 w-full rounded-2xl font-semibold text-mute">↶ Undo last ball</button>
          </Card>
        ) : (
          <>
            <div className="mt-4 grid grid-cols-2 gap-3">
              {[st.striker, st.nonStriker].map((id, i) => id ? (
                <button key={id} onClick={() => i === 1 && put(E.swapStrike(m))}
                  className={cx("press rounded-3xl border-2 bg-panel p-3 text-left", i === 0 ? "border-sun shadow-[0_8px_24px_-14px_rgba(255,138,61,1)]" : "border-transparent")}>
                  <span className="flex items-center gap-1 text-[15px] font-semibold text-fg">{i === 0 && <span aria-label="On strike">🏏</span>}<span className="truncate">{name(id)}</span></span>
                  <span className="text-sm font-medium text-teal tabular-nums">{bat(id)?.runs ?? 0} ({bat(id)?.balls ?? 0})</span>
                </button>
              ) : <div key={i} className="grid place-items-center rounded-3xl border-2 border-dashed border-line text-xs text-mute">Batting alone</div>)}
            </div>

            <Card className="mt-3 !p-3">
              <div className="flex items-center justify-between text-sm">
                <span className="text-mute">Bowler: <b className="font-semibold text-fg">{name(inn.bowler)}</b></span>
                <span className="font-semibold text-teal tabular-nums">{bowler ? `${E.oversText(bowler.legal)}-${bowler.maidens}-${bowler.runs}-${bowler.wickets}` : "0.0-0-0-0"}</span>
              </div>
              <div className="mt-3 flex items-center gap-2 overflow-x-auto pb-1">
                <span className="shrink-0 text-xs font-semibold text-mute">{thisOver.length ? `Over ${overNo + 1}` : shownOver.length ? `Over ${overNo}` : "New over"}</span>
                {shownOver.map((b, i) => <BallChip key={i} b={b} onClick={thisOver.length ? () => setEdit(overStart + eventIndex(inn.events, overStart, i)) : undefined} />)}
              </div>
            </Card>

            {oddRuns && !armed && (
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
            {armed ? (
              <div className="mt-4 flex min-h-12 items-center gap-2 rounded-full border-2 border-sun bg-sun-soft pl-4 pr-1">
                <p className="flex-1 text-[13px] font-semibold leading-tight text-fg">{{ wd: "Wide", nb: "No ball", b: "Byes", lb: "Leg byes" }[armed]}: {armed === "wd" || armed === "nb" ? "tap runs taken, 0 if none" : "tap runs they ran"}</p>
                <button onClick={() => setArmed(null)} className="press min-h-10 shrink-0 rounded-full bg-panel px-3 text-sm font-semibold text-mute">Cancel</button>
              </div>
            ) : (
              <div className="mt-4 grid grid-cols-4 gap-2">
                {(["wd", "nb", "b", "lb"] as Extra[]).map((x) => (
                  <button key={x} onClick={() => setArmed(x)} disabled={waiting}
                    className="press min-h-12 rounded-full border-2 border-sun/80 bg-panel text-sm font-semibold text-fg">
                    {{ wd: "Wide", nb: "No Ball", b: "Byes", lb: "Leg Bye" }[x]}
                  </button>
                ))}
              </div>
            )}
            <div className={cx("mt-3 grid grid-cols-4 gap-2.5 transition-opacity", armed && "rounded-[24px] ring-2 ring-sun/60 ring-offset-4 ring-offset-cream", waiting && "pointer-events-none opacity-40")}>
              {[0, 1, 2, 3].map((r) => <Key key={r} onClick={() => score(r)} label={armed ? extraLabel(armed, r) : String(r)} />)}
              <Key onClick={() => score(4)} label="4" sub={armed ? extraLabel(armed, 4) : "Four"} tone="text-four" />
              <Key onClick={() => score(6)} label="6" sub={armed ? extraLabel(armed, 6) : "Six"} tone="text-six" />
              <Key onClick={() => score(5)} label="5" sub={armed ? extraLabel(armed, 5) : "Overthrow"} />
              <Key onClick={() => setWicket(armed)} label="OUT" tone="text-white" bg="bg-out" />
            </div>

            <div className="mt-4 flex items-center justify-around rounded-full bg-panel px-2 py-1.5 shadow-[0_10px_30px_-12px_rgba(0,0,0,.3)]">
              <Tool onClick={() => undo(m.id)} icon="↶" label="Undo" />
              <Tool onClick={() => redoBall(m.id)} icon="↷" label="Redo" disabled={!redo.length} />
              <Tool onClick={() => put(E.swapStrike(m))} icon="⇄" label="Swap" disabled={!st.nonStriker} />
              <Tool onClick={() => go("scorecard")} icon="▤" label="Scorecard" />
              {liveSupported && <Tool onClick={() => setShare(true)} icon="📡" label={m.live ? "Live on" : "Go live"} />}
              <Tool onClick={() => setMore(true)} icon="⋯" label="More" />
            </div>
          </>
        )}
      </main>

      {flash && <div key={flash.key} className="pointer-events-none fixed inset-0 z-50 grid place-items-center">
        <span className={cx("pop text-[110px] font-extrabold italic tracking-tighter drop-shadow-[0_6px_0_#000]", flash.tone)}>{flash.text}</span>
      </div>}

      {!locked && m.status === "live" && (pickBowler || bowlerDue) && <BowlerSheet match={m} onPick={(n) => { put(n); setPickBowler(false); }}
        onClose={E.needsBowler(m, idx) ? undefined : () => setPickBowler(false)} onEnd={() => setEnding(true)} />}
      {ending && <ConfirmSheet title="End this innings?" yes="End innings" danger onClose={() => setEnding(false)}
        onYes={() => { put(E.closeInnings(m)); setPickBowler(false); useStore.setState({ redo: [] }); }}
        body={<>{batTeam.name} finish on <b>{st.runs}/{st.wickets}</b> in {E.oversText(st.legal)} overs.{tgt !== null ? " That ends the match." : ""} You can undo it.</>} />}
      {oversOpen && <OversSheet match={m} onClose={() => setOversOpen(false)} onSave={(n) => { put(n); setOversOpen(false); }} />}
      {retireOpen && <RetireSheet match={m} onClose={() => setRetireOpen(false)} onSave={(n) => { put(n); setRetireOpen(false); useStore.setState({ redo: [] }); }} />}
      {wicket !== false && <WicketSheet match={m} extra={wicket} onDone={confirmWicket} onClose={() => setWicket(false)} />}
      {edit !== null && inn.events[edit]?.t === "ball" && (
        <EditBallSheet ball={inn.events[edit] as E.State["overs"][number][number]} onClose={() => setEdit(null)}
          onSave={(p) => { put(E.editBall(m, idx, edit, p)); setEdit(null); }} />
      )}
      {openers && <OpenersSheet match={m} onClose={() => setOpeners(false)} onStart={(n) => { put(n); setOpeners(false); useStore.setState({ redo: [] }); }} />}
      {share && <ShareSheet match={m} onClose={() => setShare(false)} />}
      {more && (
        <Sheet title="Quick options" onClose={() => setMore(false)}>
          <div className="grid gap-2">
            <PrimaryButton tone="navy" onClick={() => { setMore(false); setPickBowler(true); }}>Change bowler</PrimaryButton>
            {!inn.superOver && <PrimaryButton tone="navy" onClick={() => { setMore(false); setOversOpen(true); }}>Change overs ({inn.overs})</PrimaryButton>}
            <PrimaryButton tone="navy" onClick={() => { setMore(false); setRetireOpen(true); }}>Retire a batter</PrimaryButton>
            <PrimaryButton onClick={() => { setMore(false); setEnding(true); }}>End innings</PrimaryButton>
          </div>
          <div className="mt-4 rounded-2xl bg-sun-soft p-3 text-sm text-fg">
            <b>Rules this match:</b> {m.rules.overs} overs
            {m.rules.extraRun ? " · wide/no-ball +1" : ""}{m.rules.rebowl ? " · re-bowl" : ""}{m.rules.freeHit ? " · free hit" : ""}
            {m.rules.lastManStands ? " · last man stands" : ""}{m.rules.oneTipCatch ? " · one-tip catch" : ""}
            {m.rules.wall !== "none" ? ` · wall = ${m.rules.wall}` : ""}{m.rules.tipAndRun ? " · tip and run" : ""}
            {m.rules.maxOversPerBowler ? ` · max ${m.rules.maxOversPerBowler} overs a bowler` : ""}
          </div>
        </Sheet>
      )}
    </div>
  );
}

function ShareSheet({ match: m, onClose }: { match: Match; onClose: () => void }) {
  const { put } = useStore();
  const [copied, setCopied] = useState(false);
  const move = (extra: Partial<Match> = {}) => { track("move_scoring_out"); put({ ...m, ...extra, scorer: deviceId, handover: newMoveToken() }); onClose(); };
  const moveButton = (onClick: () => void) => (
    <button onClick={onClick} className="press min-h-12 w-full rounded-2xl border-2 border-line bg-panel font-semibold text-fg">Move scoring to another phone</button>
  );
  if (!m.live) return (
    <Sheet title="Share this match live" onClose={onClose}>
      <p className="text-sm text-mute">Anyone with the code or link can follow every ball as you score it. Keep this app open while you score.</p>
      <div className="mt-4 grid gap-2">
        <PrimaryButton onClick={() => void newLiveKey().then((k) => { track("go_live"); put({ ...m, live: newCode(), ...k }); })}>Start live sharing</PrimaryButton>
        {moveButton(() => void newLiveKey().then((k) => move({ live: newCode(), ...k })))}
      </div>
    </Sheet>
  );
  const link = watchLink(m.live, m.liveFp);
  const msg = `Watch ${m.teams[0].name} vs ${m.teams[1].name} live, ball by ball: ${link}`;
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
        <button onClick={() => { put({ ...m, live: undefined, liveKey: undefined, liveFp: undefined, scorer: undefined, handover: undefined }); onClose(); }} className="press min-h-12 w-full rounded-2xl font-semibold text-out">Stop sharing</button>
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
  const text = `Take over scoring ${m.teams[0].name} vs ${m.teams[1].name} on your phone: ${link}`;
  return (
    <Card className="mt-4">
      {waiting ? (<>
        <p className="font-bold text-fg">Moving scoring to another phone</p>
        <p className="mt-1 text-sm text-mute">Scoring is paused here. Send this link to the new scorer. When they open it, scoring moves to their phone and this one follows along. The link works once.</p>
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
        onYes={() => { track("take_scoring_back"); put({ ...m, scorer: deviceId, handover: undefined }); setTakeBack(false); }}
        body={<>Only do this if the other phone can't score any more, like a dead battery. That phone will stop scoring.</>} />}
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
