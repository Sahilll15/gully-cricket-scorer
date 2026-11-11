import { Component, useEffect, useState, type ReactNode } from "react";
import * as E from "../engine/engine";
import type { Match } from "../engine/types";
import { fingerprint, watch, type LiveState } from "../live";
import { track } from "../track";
import { useStore } from "../store";
import { Badge, BallChip, Card, Header, LivePill, PrimaryButton } from "../ui";

export default function Watch() {
  const { watchCode, watchKey, go } = useStore();
  const [live, setLive] = useState<LiveState | null>(null);
  const [status, setStatus] = useState("CONNECTING");
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => (watchCode ? watch(watchCode, watchKey, setLive, setStatus) : undefined), [watchCode, watchKey]);
  useEffect(() => { const t = setInterval(() => setNow(Date.now()), 5000); return () => clearInterval(t); }, []);
  if (!watchCode) return null;

  const m = live?.match;
  const ago = live ? Math.max(0, Math.round((now - live.at) / 1000)) : 0;
  const done = m?.status === "done";

  return (
    <div className="min-h-screen pb-10">
      <Header title="Watching live" back={() => go("home")} right={done ? undefined : <LivePill />}>
        {m && m.innings.length > 0 ? <Safe><Board m={m} /></Safe> : (
          <div className="stadium mt-3 rounded-3xl px-5 py-6 text-center text-white">
            <p className="text-sm font-semibold text-white/80">Match code</p>
            <p className="mt-1 text-4xl font-extrabold tracking-[0.2em]">{watchCode}</p>
            <p className="mt-3 text-sm text-white/80">
              {m ? "The scorer is setting up the match." : status === "SUBSCRIBED" ? "Waiting for the scorer. Their app needs to be open." : "Connecting..."}
            </p>
          </div>
        )}
      </Header>
      <main className="mx-auto max-w-[480px] space-y-3 px-4 pt-4">
        {m && m.innings.length > 0 && <Safe><Details m={m} /></Safe>}
        {live && !done && (
          <p className="text-center text-xs text-mute">
            {ago < 60 ? `Updated ${ago < 5 ? "just now" : `${ago}s ago`}` : "No update for a while. The scorer's phone may be locked."}
          </p>
        )}
        {!watchKey && <p className="text-center text-xs text-mute">Joined by code. Open the scorer's link to be sure it's really them.</p>}
        <PrimaryButton tone="navy" onClick={() => go("home")}>Stop watching</PrimaryButton>
      </main>
    </div>
  );
}

/** Opened from a hand-over link: waits for the scorer's phone, then carries on scoring here. */
export function JoinScoring() {
  const { joinCode, joinKey, go } = useStore();
  const [status, setStatus] = useState("CONNECTING");
  useEffect(() => {
    if (!joinCode || !joinKey) return;
    let stop = () => {}, got = false, gone = false;
    void fingerprint(joinKey.x, joinKey.y).then((fp) => {
      if (gone) return;
      stop = watch(joinCode, fp, ({ match }) => {
        if (got) return;
        got = true;
        if (!replays(match)) { setStatus("BAD"); return; }
        const s = useStore.getState(), mine = s.matches.find((x) => x.id === match.id);
        // Only a phone already scoring with this same key may have its copy replaced; anything else lands as a new match.
        const same = mine && mine.liveKey?.x === joinKey.x && mine.liveKey?.y === joinKey.y;
        const keep: Match = same ? ((mine.editedAt ?? 0) > (match.editedAt ?? 0) ? mine : match) : { ...match, id: mine ? E.uid() : match.id, cup: undefined };
        s.adopt({ ...keep, live: joinCode, liveKey: joinKey, liveFp: fp });
        useStore.setState({ redo: [] });
        track("take_over_scoring");
        go("live", keep.id);
      }, setStatus);
    });
    return () => { gone = true; stop(); };
  }, [joinCode, joinKey, go]);
  if (!joinCode) return null;
  return (
    <div className="min-h-screen pb-10">
      <Header title="Score on this phone" back={() => go("home")}>
        <div className="stadium mt-3 rounded-3xl px-5 py-6 text-center text-white">
          <p className="text-sm font-semibold text-white/80">Match code</p>
          <p className="mt-1 text-4xl font-extrabold tracking-[0.2em]">{joinCode}</p>
          <p className="mt-3 text-sm text-white/80">
            {status === "BAD" ? "That match couldn't be read. Ask for a fresh link." : status === "SUBSCRIBED" ? "Getting the match from the other phone. The app needs to be open on it." : "Connecting..."}
          </p>
        </div>
      </Header>
      <main className="mx-auto max-w-[480px] space-y-3 px-4 pt-4">
        <p className="text-center text-sm text-mute">Once it loads you can score here. Both phones stay in sync, so score on one at a time.</p>
        <PrimaryButton tone="navy" onClick={() => go("home")}>Cancel</PrimaryButton>
      </main>
    </div>
  );
}

function replays(m: Match) {
  try { m.innings.forEach((_, i) => E.replay(m, i)); return typeof m.id === "string" && m.id.length > 0; } catch { return false; }
}

// A bad update must not blank the viewer's screen; the next good one renders again.
class Safe extends Component<{ children: ReactNode }, { err: boolean }> {
  state = { err: false };
  static getDerivedStateFromError() { return { err: true }; }
  componentDidUpdate(prev: { children: ReactNode }) { if (prev.children !== this.props.children && this.state.err) this.setState({ err: false }); }
  render() { return this.state.err ? <p className="py-4 text-center text-sm text-mute">Couldn't read the last update. Waiting for the next ball.</p> : this.props.children; }
}

function Board({ m }: { m: NonNullable<LiveState["match"]> }) {
  const idx = m.innings.length - 1, inn = m.innings[idx], st = E.replay(m, idx);
  const tgt = E.target(m, idx), batTeam = m.teams[inn.bat];
  const need = tgt !== null ? tgt - st.runs : 0, left = inn.overs * 6 - st.legal;
  const res = E.result(m);
  const label = inn.superOver ? "Super over" : idx === 0 ? "1st innings" : "2nd innings";
  return (
    <div className="stadium mt-3 overflow-hidden rounded-3xl px-5 pb-5 pt-4 text-white">
      <div className="flex items-center gap-2 text-[13px] font-medium text-white/85">
        <Badge name={batTeam.name} size={28} /><span className="truncate">{batTeam.name} · {label}</span>
      </div>
      <p className="mt-2 flex items-baseline gap-2">
        <span key={st.runs + "-" + st.wickets} className="roll text-[64px] font-extrabold leading-none tracking-tight tabular-nums">{st.runs}/{st.wickets}</span>
        <span className="text-xl font-semibold text-white/85 tabular-nums">({E.oversText(st.legal)}/{inn.overs})</span>
      </p>
      <p className="mt-2 text-[13px] text-white/85">
        {res ? <b className="text-sun">{res.text}</b>
          : m.status === "break" ? <>Innings break · {m.teams[E.otherSide(inn.bat)].name} need {st.runs + 1}</>
          : tgt !== null ? <>Need <b className="text-sun">{Math.max(0, need)}</b> off <b className="text-sun">{left}</b> ball{left === 1 ? "" : "s"} · Target {tgt}</>
          : <>Run rate {E.runRate(st.runs, st.legal).toFixed(2)}</>}
      </p>
    </div>
  );
}

function Details({ m }: { m: NonNullable<LiveState["match"]> }) {
  const idx = m.innings.length - 1, inn = m.innings[idx], st = E.replay(m, idx);
  const name = (id: string | null) => E.playerName(m, id);
  const bowler = st.bowl.get(inn.bowler);
  const overNo = Math.floor(st.legal / 6);
  const over = st.overs[overNo]?.length ? st.overs[overNo] : (st.overs[overNo - 1] ?? []);
  const others = m.innings.slice(0, idx).map((x, i) => ({ x, st: E.replay(m, i) }));
  return (
    <>
      {m.status === "live" && (
        <div className="grid grid-cols-2 gap-3">
          {[st.striker, st.nonStriker].map((id, i) => id ? (
            <div key={id} className={i === 0 ? "rounded-3xl border-2 border-sun bg-panel p-3" : "rounded-3xl border-2 border-transparent bg-panel p-3"}>
              <span className="flex items-center gap-1 text-[15px] font-semibold text-fg">{i === 0 && <span aria-label="On strike">🏏</span>}<span className="truncate">{name(id)}</span></span>
              <span className="text-sm font-medium text-teal tabular-nums">{st.bat.get(id)?.runs ?? 0} ({st.bat.get(id)?.balls ?? 0})</span>
            </div>
          ) : <div key={i} />)}
        </div>
      )}
      <Card className="!p-3">
        <div className="flex items-center justify-between text-sm">
          <span className="text-mute">Bowler: <b className="font-semibold text-fg">{name(inn.bowler)}</b></span>
          <span className="font-semibold text-teal tabular-nums">{bowler ? `${E.oversText(bowler.legal)}-${bowler.maidens}-${bowler.runs}-${bowler.wickets}` : "0.0-0-0-0"}</span>
        </div>
        <div className="mt-3 flex items-center gap-2 overflow-x-auto pb-1">
          <span className="shrink-0 text-xs font-semibold text-mute">{over.length ? `Over ${st.overs[overNo]?.length ? overNo + 1 : overNo}` : "New over"}</span>
          {over.map((b, i) => <BallChip key={i} b={b} />)}
        </div>
      </Card>
      {others.map(({ x, st: s }, i) => (
        <Card key={i} className="flex items-center gap-3 !p-3">
          <Badge name={m.teams[x.bat].name} size={34} />
          <span className="flex-1 truncate font-semibold text-teal">{m.teams[x.bat].name}{x.superOver ? " (super over)" : ""}</span>
          <span className="font-bold text-fg tabular-nums">{s.runs}/{s.wickets} ({E.oversText(s.legal)})</span>
        </Card>
      ))}
      <Card className="!p-3">
        <p className="mb-2 text-sm font-semibold text-teal">Batting · {m.teams[inn.bat].name}</p>
        {[...st.bat.entries()].map(([id, b]) => (
          <div key={id} className="flex items-center justify-between border-t border-line py-2 text-sm first:border-0">
            <span className="font-semibold text-fg">{name(id)}{b.out ? "" : " *"}</span>
            <span className="tabular-nums text-fg"><b>{b.runs}</b> <span className="text-mute">({b.balls})</span></span>
          </div>
        ))}
      </Card>
    </>
  );
}
