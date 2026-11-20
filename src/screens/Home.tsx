import { useRef, useState } from "react";
import * as E from "../engine/engine";
import { cleanCode, liveSupported } from "../live";
import { InstallCard } from "../install";
import { AccountButton } from "../accountUi";
import { NextGameCard } from "../nextGameUi";
import type { Match } from "../engine/types";
import { useStore } from "../store";
import { seriesScore } from "../engine/series";
import { seriesNames, SeriesNext } from "./Series";
import { AdBox } from "../ad";
import { tipLink } from "../upi";
import { track } from "../track";
import { EV } from "../events";
import { cardStatus } from "../cardStatus";
import { matchTotals } from "../stats";
import { Badge, BottomNav, Card, ConfirmSheet, cx, LivePill, PrimaryButton, Sheet } from "../ui";

export function MatchCard({ m, onHold }: { m: Match; onHold?: () => void }) {
  const { go } = useStore();
  const held = useRef(false), timer = useRef(0);
  const { text: status, live } = cardStatus(m), res = E.result(m);
  const idx = m.innings.length - 1, batting = live && idx >= 0 && !E.isSolo(m) && !E.isTest(m) ? m.innings[idx].bat : null;
  const score = (side: 0 | 1) => {
    if (E.isTest(m)) return { main: E.sideScore(m, side) ?? "Yet to bat", ov: "" };
    const i = m.innings.findIndex((inn) => inn.bat === side && !inn.superOver);
    if (i < 0) return { main: "Yet to bat", ov: "" };
    const st = E.replay(m, i);
    return { main: `${st.runs}/${st.wickets}`, ov: ` (${E.oversText(st.legal)})` };
  };
  return (
    <button onClick={() => { if (!held.current) go(live ? "live" : m.status === "done" ? "result" : "home", m.id); held.current = false; }}
      onPointerDown={() => { if (!onHold) return; held.current = false; timer.current = window.setTimeout(() => { held.current = true; onHold(); }, 550); }}
      onPointerUp={() => window.clearTimeout(timer.current)} onPointerLeave={() => window.clearTimeout(timer.current)} onPointerCancel={() => window.clearTimeout(timer.current)}
      onContextMenu={(e) => { if (onHold) { e.preventDefault(); onHold(); } }} className="press block w-full select-none text-left">
      <Card className="!py-3">
        <div className="mb-1.5 flex items-center justify-between text-xs font-medium text-mute">
          <span className="truncate">{new Date(m.createdAt).toLocaleDateString("en-IN", { day: "numeric", month: "short" })} · {E.formatText(m)}</span>
          {live ? <LivePill /> : <span className="text-[11px] font-semibold">RESULT</span>}
        </div>
        {([0, 1] as const).map((s) => {
          const strong = batting === s || res?.winner === s, sc = score(s);
          return (
            <div key={s} className="flex items-center gap-3 py-1">
              <Badge name={m.teams[s].name} size={28} kind="team" />
              <span className={cx("flex-1 truncate text-[15px]", strong ? "font-semibold text-fg" : "font-medium text-teal")}>{m.teams[s].name}</span>
              <span className={cx("text-[15px] tabular-nums", strong ? "font-bold text-fg" : "font-medium text-teal")}>{sc.main}<span className="text-xs font-normal text-mute">{sc.ov}</span></span>
            </div>
          );
        })}
        {status && <p className={cx("mt-1.5 text-[13px] font-medium", live ? "text-sun" : "text-fg")}>{status}</p>}
      </Card>
    </button>
  );
}

/** A live match you can remove: hold it (or right-click), or drag it sideways. Both ask before deleting. */
function LiveRow({ m }: { m: Match }) {
  const { remove } = useStore();
  const [ask, setAsk] = useState(false);
  const [dx, setDx] = useState(0);
  const start = useRef<{ x: number; y: number } | null>(null), moved = useRef(false);
  const end = () => { if (Math.abs(dx) > 110) setAsk(true); setDx(0); start.current = null; setTimeout(() => { moved.current = false; }, 0); };
  return (
    <div className="relative overflow-hidden rounded-3xl"
      onTouchStart={(e) => { start.current = { x: e.touches[0].clientX, y: e.touches[0].clientY }; }}
      onTouchMove={(e) => { const s = start.current; if (!s) return; const ddx = e.touches[0].clientX - s.x, ddy = e.touches[0].clientY - s.y; if (moved.current || (Math.abs(ddx) > 14 && Math.abs(ddx) > Math.abs(ddy) * 2)) { moved.current = true; setDx(ddx); } }}
      onTouchEnd={end} onTouchCancel={() => { setDx(0); start.current = null; }}>
      <div className="absolute inset-0 grid place-items-center bg-out font-bold text-white" aria-hidden>Delete</div>
      <div style={{ transform: `translateX(${dx}px)`, transition: dx ? "none" : "transform .2s" }}><MatchCard m={m} onHold={() => setAsk(true)} /></div>
      {ask && <ConfirmSheet title="Delete this match?" body={`${m.teams[0].name} v ${m.teams[1].name} will be removed from this phone. This can't be undone.`} yes="Delete" danger
        onYes={() => { track(EV.match_delete, { how: "live_row" }); remove(m.id); }} onClose={() => setAsk(false)} />}
    </div>
  );
}

export default function Home() {
  const { matches, go, watchMatch, series, me, openPlayer, setMe } = useStore();
  const tip = tipLink(import.meta.env.VITE_TIP_UPI as string | undefined, "Sahil Chalke");
  const going = series.filter((s) => { const sc = seriesScore(s, matches); return sc.current || sc.next !== null; }).slice(0, 2);
  const [ask, setAsk] = useState(false);
  const [code, setCode] = useState("");
  const live = matches.filter((m) => m.status === "live" || m.status === "break");
  const done = matches.filter((m) => m.status === "done").slice(0, 3);
  const sums = matchTotals(matches);
  const stats: [string, number][] = [["Matches", matches.length], ["Runs", sums.runs], ["Sixes", sums.sixes], ["Wickets", sums.wickets]];

  return (
    <div className="min-h-screen pb-28">
      <header className="header-glow rounded-b-[36px] border-b border-line px-5 pb-6 pt-[max(22px,env(safe-area-inset-top))]">
        <div className="flex items-center justify-between"><p className="text-sm font-semibold text-sun">GULLY SCORER</p><AccountButton /></div>
        <h1 className="mt-1 text-[34px] font-extrabold leading-[1.05] text-fg">Score every ball.<br /><span className="text-sun">No login needed.</span></h1>
        {matches.length > 0 && (
          <div className="mt-4 grid grid-cols-4 gap-2">
            {stats.map(([k, v]) => (
              <div key={k} className="rounded-2xl bg-key px-2 py-2.5 text-center">
                <p className="text-xl font-extrabold text-fg tabular-nums">{v}</p>
                <p className="text-[11px] font-medium text-mute">{k}</p>
              </div>
            ))}
          </div>
        )}
      </header>
      <main className="mx-auto max-w-[480px] space-y-3 px-4 pt-5">
        <button type="button" onClick={() => go("setup")}
          className="press relative flex min-h-[72px] w-full items-center gap-3 overflow-hidden rounded-[20px] border border-[#ffd2ad] bg-[linear-gradient(160deg,#ffb070_0%,#ff8a3d_45%,#e0701f_100%)] px-5 text-left text-ink shadow-[0_10px_28px_-8px_rgba(255,138,61,.75)]">
          <span aria-hidden className="pointer-events-none absolute inset-x-0 top-0 h-1/2 rounded-b-[50%] bg-gradient-to-b from-white/55 to-white/5" />
          <span aria-hidden className="pointer-events-none absolute -bottom-6 -right-4 text-[80px] leading-none opacity-90 rotate-[-18deg]">🎾</span>
          <span aria-hidden className="relative grid h-9 w-9 place-items-center rounded-full border border-white/45 bg-black/15 text-xl font-bold">+</span>
          <span className="relative text-[18px] font-extrabold">Start new match</span>
        </button>
        {liveSupported && <button onClick={() => setAsk(true)} className="press min-h-12 w-full rounded-2xl border-2 border-line bg-panel font-semibold text-fg">📡 Watch a live match</button>}
        {live.length > 0 && <h2 className="pt-3 font-bold text-fg">Live now</h2>}
        {live.map((m) => <LiveRow key={m.id} m={m} />)}
        {done.length > 0 && (
          <div className="flex items-center justify-between pt-3">
            <h2 className="font-bold text-fg">Recent matches</h2>
            <button type="button" onClick={() => go("history")} aria-label="See all matches" className="press -mr-2 min-h-11 px-2 text-sm font-semibold text-sun">See all</button>
          </div>
        )}
        {done.map((m) => <MatchCard key={m.id} m={m} />)}
        {!matches.length && (
          <Card className="text-center">
            <p className="text-4xl">🏏</p>
            <p className="mt-2 font-semibold text-fg">No matches yet</p>
            <p className="text-sm text-mute">Set one up in 30 seconds.</p>
          </Card>
        )}
        <div className="grid grid-cols-2 gap-2">
          {([["book", "📖", "Gully Book", "Records and bragging rights"], ["kitty", "💰", "Kitty", "Who paid for the ball"]] as const).map(([s, icon, title, sub]) => (
            <button key={s} onClick={() => go(s)} className="press rounded-3xl border border-line bg-panel p-4 text-left">
              <span className="text-2xl">{icon}</span>
              <span className="mt-2 block font-bold text-fg">{title}</span>
              <span className="block text-xs text-mute">{sub}</span>
            </button>
          ))}
        </div>
        {me && (
          <div className="flex items-center gap-3 rounded-3xl border border-line bg-panel p-3 pl-4">
            <Badge name={me} size={40} />
            <span className="min-w-0 flex-1"><span className="block truncate font-bold text-fg">{me}</span><span className="block text-xs text-mute">Your stats and skill card</span></span>
            <button onClick={() => openPlayer(me)} className="press min-h-10 rounded-full bg-sun px-4 text-sm font-bold text-ink">My stats</button>
            <button onClick={() => setMe(null)} aria-label="Not me" className="press min-h-10 px-2 text-mute">✕</button>
          </div>
        )}
        <NextGameCard />
        {going.map((s) => (
          <Card key={s.id} className="!p-3">
            <button onClick={() => { useStore.setState({ seriesId: s.id }); go("series"); }} className="press mb-2 flex w-full items-center justify-between px-1 text-left text-sm">
              <span className="truncate font-semibold text-fg">{s.name}</span>
              <span className="shrink-0 pl-2 text-mute">{seriesScore(s, matches).text(seriesNames(s))} ›</span>
            </button>
            <SeriesNext s={s} matches={matches} />
          </Card>
        ))}
        {done.length > 0 && (
          // Same site as /cards/, so Gully Cards reads these matches straight from this phone.
          <a href="/cards/" className="press flex min-h-12 w-full items-center justify-center rounded-2xl border-2 border-line bg-panel font-semibold text-teal">Rate your squad: player cards from these matches</a>
        )}
        <InstallCard />
        {tip && (
          <a href={tip} onClick={() => track(EV.tip_open)} className="press block rounded-3xl border border-line bg-panel p-4 text-center text-sm font-semibold text-fg">Enjoying the app? Tip the developer</a>
        )}
      </main>
      {ask && (
        <Sheet title="Watch a live match" onClose={() => setAsk(false)}>
          <p className="text-sm text-mute">Ask the scorer for the 6-letter code on their screen.</p>
          <form className="mt-3 grid gap-3" onSubmit={(e) => { e.preventDefault(); if (code.length === 6) { setAsk(false); watchMatch(code); } }}>
            <input aria-label="Match code" value={code} onChange={(e) => { const c = cleanCode(e.target.value); setCode(c); if (c.length === 6) { setAsk(false); watchMatch(c); } }} placeholder="ABC123" autoFocus autoCapitalize="characters"
              className="min-h-14 w-full rounded-2xl border-2 border-line bg-panel px-4 text-center text-2xl font-extrabold tracking-[0.3em] text-fg outline-none focus:border-sun" />
            <PrimaryButton disabled={code.length !== 6}>Watch</PrimaryButton>
          </form>
        </Sheet>
      )}
      <AdBox />
      <BottomNav />
    </div>
  );
}
